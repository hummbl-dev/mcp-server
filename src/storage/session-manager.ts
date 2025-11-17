/**
 * Session manager for MCP server state persistence
 * Ported from Python Phase 1C session_manager.py
 */

import { Session, SessionSchema, createSession, updateSessionActivity } from '../types/session.js';
import { RedisClient } from './redis-client.js';
import { D1Client } from './d1-client.js';

export class SessionManager {
  constructor(
    private redis: RedisClient,
    private d1: D1Client
  ) {}

  /**
   * Create a new session
   */
  async create(userId: string, adapterType: string): Promise<Session> {
    const session = createSession(userId, adapterType);

    // Write to Redis (blocking, fast)
    const redisKey = `session:${session.sessionId}`;
    const success = await this.redis.set(redisKey, session, { ex: 86400 }); // 24hr TTL

    if (!success) {
      throw new Error('Failed to create session in Redis');
    }

    // Write to D1 (async, non-blocking)
    Promise.resolve(
      this.d1.execute(
        `INSERT INTO sessions (
          session_id, user_id, adapter_type, created_at, last_active,
          version, domain_state, total_messages, total_cost_usd, metadata
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.sessionId,
        session.userId,
        session.adapterType,
        session.createdAt,
        session.lastActive,
        session.version,
        JSON.stringify(session.domainState),
        session.metadata.totalMessages,
        session.metadata.totalCostUsd,
        JSON.stringify(session.metadata)
      )
    ).catch(error => {
      console.error('Failed to write session to D1', { sessionId: session.sessionId, error });
    });

    return session;
  }

  /**
   * Get a session by ID
   */
  async get(sessionId: string): Promise<Session | null> {
    const redisKey = `session:${sessionId}`;

    // Try Redis first (fast path)
    const cached = await this.redis.get<Session>(redisKey);
    if (cached) {
      try {
        // Validate the cached data
        return SessionSchema.parse(cached);
      } catch (error) {
        console.warn('Invalid cached session data, falling back to D1', { sessionId, error });
      }
    }

    // Fallback to D1 (slow path)
    const row = await this.d1.queryOne<{
      session_id: string;
      user_id: string;
      adapter_type: string;
      created_at: string;
      last_active: string;
      version: number;
      domain_state: string;
      total_messages: number;
      total_cost_usd: number;
      metadata: string;
    }>(
      'SELECT * FROM sessions WHERE session_id = ?',
      sessionId
    );

    if (!row) {
      return null;
    }

    // Reconstruct session from database row
    const session: Session = {
      sessionId: row.session_id,
      userId: row.user_id,
      adapterType: row.adapter_type,
      createdAt: row.created_at,
      lastActive: row.last_active,
      version: row.version,
      domainState: JSON.parse(row.domain_state || '{}'),
      metadata: {
        totalMessages: row.total_messages,
        totalCostUsd: row.total_cost_usd,
        activeTools: [], // Would need to be stored separately or derived
        lastActivity: row.last_active,
      },
    };

    // Re-cache in Redis
    await this.redis.set(redisKey, session, { ex: 86400 });

    return session;
  }

  /**
   * Update a session with optimistic locking
   */
  async update(
    sessionId: string,
    updates: Partial<Session>,
    expectedVersion: number
  ): Promise<boolean> {
    const redisKey = `session:${sessionId}`;

    // Get current session
    const currentSession = await this.get(sessionId);
    if (!currentSession) {
      return false;
    }

    // Check version (optimistic locking)
    if (currentSession.version !== expectedVersion) {
      console.warn('Version conflict in session update', {
        sessionId,
        expectedVersion,
        actualVersion: currentSession.version
      });
      return false; // Conflict detected
    }

    // Apply updates
    const updatedSession: Session = {
      ...currentSession,
      ...updates,
      version: currentSession.version + 1,
      lastActive: new Date().toISOString(),
    };

    // Update Redis (blocking)
    const success = await this.redis.set(redisKey, updatedSession, { ex: 86400 });
    if (!success) {
      return false;
    }

    // Update D1 (async)
    Promise.resolve(
      this.d1.execute(
        `UPDATE sessions SET
          last_active = ?, version = ?, domain_state = ?,
          total_messages = ?, total_cost_usd = ?, metadata = ?
         WHERE session_id = ? AND version = ?`,
        updatedSession.lastActive,
        updatedSession.version,
        JSON.stringify(updatedSession.domainState),
        updatedSession.metadata.totalMessages,
        updatedSession.metadata.totalCostUsd,
        JSON.stringify(updatedSession.metadata),
        sessionId,
        expectedVersion
      )
    ).catch(error => {
      console.error('Failed to update session in D1', { sessionId, error });
    });

    return true;
  }

  /**
   * End a session (mark as inactive)
   */
  async end(sessionId: string): Promise<boolean> {
    const redisKey = `session:${sessionId}`;

    // Get current session
    const session = await this.get(sessionId);
    if (!session) {
      return false;
    }

    // Update with ended status
    const endedSession = updateSessionActivity(session);

    // Update Redis
    const success = await this.redis.set(redisKey, endedSession, { ex: 3600 }); // 1hr TTL
    if (!success) {
      return false;
    }

    // Update D1
    try {
      await this.d1.execute(
        'UPDATE sessions SET last_active = ?, metadata = ? WHERE session_id = ?',
        endedSession.lastActive,
        JSON.stringify(endedSession.metadata),
        sessionId
      );
    } catch (error) {
      console.error('Failed to end session in D1', { sessionId, error });
      return false;
    }

    return true;
  }

  /**
   * Check if session exists
   */
  async exists(sessionId: string): Promise<boolean> {
    const redisKey = `session:${sessionId}`;
    return await this.redis.exists(redisKey);
  }

  /**
   * Get time until session expires
   */
  async getTimeToExpiry(sessionId: string): Promise<number> {
    const redisKey = `session:${sessionId}`;
    return await this.redis.ttl(redisKey);
  }
}