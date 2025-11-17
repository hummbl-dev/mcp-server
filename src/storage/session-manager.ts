/**
 * Session manager for MCP server state persistence
 * Ported from Python Phase 1C session_manager.py
 */

import { Session, SessionSchema, createSession, updateSessionActivity } from '../types/session.js';
import { RedisClient } from './redis-client.js';
import { D1Client } from './d1-client.js';
import { Logger } from '../observability/logger.js';
import {
  metrics,
  sessionReadLatency,
  sessionWriteLatency,
  sessionErrors,
  cacheHits,
  cacheMisses,
  activeSessions
} from '../observability/metrics.js';

export class SessionManager {
  private logger = new Logger('session-manager');

  constructor(
    private redis: RedisClient,
    private d1: D1Client
  ) {}

  /**
   * Create a new session
   */
  async create(userId: string, adapterType: string): Promise<Session> {
    return this.logger.timer('session_create', async () => {
      this.logger.info('session_create_start', { userId, adapterType });

      try {
        const session = createSession(userId, adapterType);

        // Write to Redis
        await metrics.recordLatency(sessionWriteLatency, async () => {
          await this.redis.set(
            `session:${session.sessionId}`,
            session,
            { ex: 86400 }
          );
        });

        // Async D1 write
        Promise.resolve(this.writeSessionToD1(session));

        // Update active sessions gauge
        metrics.increment(activeSessions, {}, 1);

        this.logger.info('session_created', {
          sessionId: session.sessionId,
          userId,
          adapterType
        });

        return session;
      } catch (e) {
        metrics.increment(sessionErrors, {
          operation: 'create',
          error_type: e instanceof Error ? e.name : 'unknown'
        });

        this.logger.error('session_create_failed', e instanceof Error ? e : undefined, {
          userId,
          adapterType
        });

        throw e;
      }
    });
  }

  /**
   * Helper method to write session to D1
   */
  private async writeSessionToD1(session: Session): Promise<void> {
    try {
      await this.d1.execute(
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
      );
    } catch (error) {
      this.logger.error('session_d1_write_failed', error instanceof Error ? error : undefined, {
        sessionId: session.sessionId
      });
      throw error;
    }
  }

  /**
   * Get a session by ID
   */
  async get(sessionId: string): Promise<Session | null> {
    return this.logger.timer('session_read', async () => {
      try {
        // Try Redis (fast path)
        const cached = await metrics.recordLatency(sessionReadLatency, async () => {
          return await this.redis.get<Session>(`session:${sessionId}`);
        }, { source: 'redis' });

        if (cached) {
          metrics.increment(cacheHits, { cache: 'redis' });
          this.logger.debug('session_cache_hit', { sessionId });
          return SessionSchema.parse(cached);
        }

        // Cache miss - try D1
        metrics.increment(cacheMisses, { cache: 'redis' });
        this.logger.debug('session_cache_miss', { sessionId });

        const session = await this.getSessionFromD1(sessionId);

        if (session) {
          // Re-hydrate to Redis
          await this.redis.set(
            `session:${sessionId}`,
            session,
            { ex: 86400 }
          );
        }

        return session;
      } catch (e) {
        metrics.increment(sessionErrors, {
          operation: 'get',
          error_type: e instanceof Error ? e.name : 'unknown'
        });

        this.logger.error('session_read_failed', e instanceof Error ? e : undefined, {
          sessionId
        });

        throw e;
      }
    });
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