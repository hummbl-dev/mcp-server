/**
 * Session manager for MCP server state persistence
 * Ported from Python Phase 1C session_manager.py
 * Phase 1D: Added observability instrumentation
 */

import type { Session } from "../types/session.js";
import { SessionSchema, createSession, updateSessionActivity } from "../types/session.js";
import { RedisClient } from "./redis-client.js";
import { D1Client } from "./d1-client.js";
import { Logger } from "../observability/logger.js";
import { parseJsonSafe, safeD1Call, safeRedisCall } from "./storage-utils.js";
import {
  sessionCreateCounter,
  sessionCreateDuration,
  sessionGetCounter,
  sessionGetDuration,
  sessionUpdateCounter,
  sessionEndCounter,
  cacheHitCounter,
  cacheMissCounter,
  activeSessionsGauge,
  d1WriteCounter,
  d1ReadCounter,
} from "../observability/metrics.js";
import { trace } from "../observability/tracing.js";

export class SessionManager {
  constructor(
    private redis: RedisClient,
    private d1: D1Client,
    private logger: Logger = new Logger()
  ) {}

  /**
   * Create a new session with observability instrumentation
   */
  @trace("session.create")
  async create(userId: string, adapterType: string): Promise<Session> {
    return this.logger.timer("session.create", { userId, adapterType }, async () => {
      const session = createSession(userId, adapterType);

      this.logger.info("Creating new session", {
        sessionId: session.sessionId,
        userId,
        adapterType,
      });

      try {
        // Write to Redis (blocking, fast)
        const redisKey = `session:${session.sessionId}`;
        const redisStart = Date.now();
        const redisSuccess = await safeRedisCall(this.logger, {
          operation: "session.create.redis_set",
          context: { sessionId: session.sessionId },
          fn: () => this.redis.set(redisKey, session, { ex: 86400 }),
          fallbackValue: false,
        });
        const redisDuration = Date.now() - redisStart;

        if (!redisSuccess) {
          sessionCreateCounter.increment({ result: "redis_error" });
          sessionCreateDuration.observe(redisDuration, { result: "redis_error" });
        } else {
          activeSessionsGauge.increment();
        }

        // Write to D1 (async, non-blocking)
        this.writeSessionToD1(session).catch(() => {
          /* Errors logged inside helper */
        });

        sessionCreateCounter.increment({ result: "success" });
        sessionCreateDuration.observe(redisDuration, { result: "success" });

        this.logger.info("Session created successfully", {
          sessionId: session.sessionId,
          duration: redisDuration,
        });

        return session;
      } catch (error) {
        sessionCreateCounter.increment({ result: "error" });
        this.logger.error(
          "Failed to create session",
          { sessionId: session.sessionId },
          error as Error
        );
        throw error;
      }
    });
  }

  /**
   * Helper method to write session to D1 with observability
   */
  private async writeSessionToD1(session: Session): Promise<void> {
    await safeD1Call(this.logger, {
      operation: "session.create.d1_insert",
      context: { sessionId: session.sessionId },
      rethrow: false,
      fn: () =>
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
        ),
      onSuccess: () => d1WriteCounter.increment({ table: "sessions", result: "success" }),
      onError: () => d1WriteCounter.increment({ table: "sessions", result: "error" }),
    });
  }

  /**
   * Get a session by ID with observability instrumentation
   */
  @trace("session.get")
  async get(sessionId: string): Promise<Session | null> {
    return this.logger.timer("session.get", { sessionId }, async () => {
      const redisKey = `session:${sessionId}`;

      this.logger.debug("Retrieving session", { sessionId });

      try {
        // Try Redis first (fast path)
        const startTime = Date.now();
        let cached: Session | null = null;
        let redisDuration = 0;
        cached = await safeRedisCall(this.logger, {
          operation: "session.get.redis_get",
          context: { sessionId },
          fn: () => this.redis.get<Session>(redisKey),
          fallbackValue: null,
        });
        redisDuration = Date.now() - startTime;

        if (cached) {
          try {
            // Validate the cached data
            const session = SessionSchema.parse(cached);
            cacheHitCounter.increment({ operation: "session.get" });
            sessionGetCounter.increment({ result: "cache_hit" });
            sessionGetDuration.observe(redisDuration, { result: "cache_hit" });

            this.logger.debug("Session retrieved from cache", {
              sessionId,
              duration: redisDuration,
            });

            return session;
          } catch (error) {
            this.logger.warn("Invalid cached session data, falling back to D1", {
              sessionId,
              error: (error as Error).message,
            });
          }
        }

        // Cache miss - fallback to D1 (slow path)
        cacheMissCounter.increment({ operation: "session.get" });
        const d1StartTime = Date.now();

        const row = await safeD1Call(this.logger, {
          operation: "session.get.d1_query",
          context: { sessionId },
          rethrow: false,
          fn: () =>
            this.d1.queryOne<{
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
            }>("SELECT * FROM sessions WHERE session_id = ?", sessionId),
          fallbackValue: null,
          onSuccess: (result) =>
            d1ReadCounter.increment({
              table: "sessions",
              result: result ? "success" : "not_found",
            }),
          onError: () => d1ReadCounter.increment({ table: "sessions", result: "error" }),
        });

        const d1Duration = Date.now() - d1StartTime;

        if (!row) {
          sessionGetCounter.increment({ result: "not_found" });
          sessionGetDuration.observe(d1Duration + redisDuration, { result: "not_found" });

          this.logger.info("Session not found", {
            sessionId,
            totalDuration: d1Duration + redisDuration,
          });
          return null;
        }

        // Reconstruct session from database row
        const domainState =
          parseJsonSafe<Record<string, unknown>>(
            row.domain_state,
            "session domain_state",
            this.logger,
            { sessionId }
          ) ?? {};
        const metadata = parseJsonSafe<Session["metadata"]>(
          row.metadata,
          "session metadata",
          this.logger,
          {
            sessionId,
          }
        ) ?? {
          totalMessages: row.total_messages,
          totalCostUsd: row.total_cost_usd,
          activeTools: [],
          lastActivity: row.last_active,
        };

        const session: Session = {
          sessionId: row.session_id,
          userId: row.user_id,
          adapterType: row.adapter_type,
          createdAt: row.created_at,
          lastActive: row.last_active,
          version: row.version,
          domainState,
          metadata: {
            totalMessages: metadata.totalMessages ?? row.total_messages,
            totalCostUsd: metadata.totalCostUsd ?? row.total_cost_usd,
            activeTools: metadata.activeTools ?? [],
            lastActivity: metadata.lastActivity ?? row.last_active,
          },
        };

        // Re-cache in Redis
        await safeRedisCall(this.logger, {
          operation: "session.get.redis_set_cache",
          context: { sessionId },
          fn: () => this.redis.set(redisKey, session, { ex: 86400 }),
          fallbackValue: false,
        });

        sessionGetCounter.increment({ result: "cache_miss" });
        sessionGetDuration.observe(d1Duration + redisDuration, { result: "cache_miss" });

        this.logger.info("Session retrieved from database and cached", {
          sessionId,
          redisDuration,
          d1Duration,
          totalDuration: d1Duration + redisDuration,
        });

        return session;
      } catch (error) {
        sessionGetCounter.increment({ result: "error" });
        this.logger.error("Failed to retrieve session", { sessionId }, error as Error);
        throw error;
      }
    });
  }

  /**
   * Update a session with optimistic locking and observability instrumentation
   */
  @trace("session.update")
  async update(
    sessionId: string,
    updates: Partial<Session>,
    expectedVersion: number
  ): Promise<boolean> {
    return this.logger.timer("session.update", { sessionId, expectedVersion }, async () => {
      const redisKey = `session:${sessionId}`;

      this.logger.debug("Updating session", { sessionId, expectedVersion });

      try {
        // Get current session
        const currentSession = await this.get(sessionId);
        if (!currentSession) {
          sessionUpdateCounter.increment({ result: "not_found" });
          this.logger.info("Session not found for update", { sessionId });
          return false;
        }

        // Check version (optimistic locking)
        if (currentSession.version !== expectedVersion) {
          sessionUpdateCounter.increment({ result: "version_conflict" });
          this.logger.warn("Version conflict in session update", {
            sessionId,
            expectedVersion,
            actualVersion: currentSession.version,
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
        const redisStartTime = Date.now();
        const success = await safeRedisCall(this.logger, {
          operation: "session.update.redis_set",
          context: { sessionId },
          fn: () => this.redis.set(redisKey, updatedSession, { ex: 86400 }),
          fallbackValue: false,
        });
        const redisDuration = Date.now() - redisStartTime;

        if (!success) {
          sessionUpdateCounter.increment({ result: "redis_error" });
          this.logger.error("Failed to update session in Redis", { sessionId });
          return false;
        }

        // Update D1 (async)
        Promise.resolve(
          safeD1Call(this.logger, {
            operation: "session.update.d1",
            context: { sessionId },
            rethrow: false,
            fn: () =>
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
              ),
            onSuccess: () => d1WriteCounter.increment({ table: "sessions", result: "success" }),
            onError: () => d1WriteCounter.increment({ table: "sessions", result: "error" }),
          })
        ).catch(() => {
          /* Errors already logged */
        });

        sessionUpdateCounter.increment({ result: "success" });
        this.logger.info("Session updated successfully", {
          sessionId,
          newVersion: updatedSession.version,
          redisDuration,
        });

        return true;
      } catch (error) {
        sessionUpdateCounter.increment({ result: "error" });
        this.logger.error(
          "Failed to update session",
          { sessionId, expectedVersion },
          error as Error
        );
        throw error;
      }
    });
  }

  /**
   * End a session (mark as inactive) with observability instrumentation
   */
  @trace("session.end")
  async end(sessionId: string): Promise<boolean> {
    return this.logger.timer("session.end", { sessionId }, async () => {
      const redisKey = `session:${sessionId}`;

      this.logger.debug("Ending session", { sessionId });

      try {
        // Get current session
        const session = await this.get(sessionId);
        if (!session) {
          sessionEndCounter.increment({ result: "not_found" });
          this.logger.info("Session not found for ending", { sessionId });
          return false;
        }

        // Update with ended status
        const endedSession = updateSessionActivity(session);

        // Update Redis
        const redisStartTime = Date.now();
        const success = await safeRedisCall(this.logger, {
          operation: "session.end.redis_set",
          context: { sessionId },
          fn: () => this.redis.set(redisKey, endedSession, { ex: 3600 }),
          fallbackValue: false,
        });
        const redisDuration = Date.now() - redisStartTime;

        if (!success) {
          sessionEndCounter.increment({ result: "redis_error" });
          this.logger.error("Failed to end session in Redis", { sessionId });
          return false;
        }

        // Update D1
        const d1Result = await safeD1Call(this.logger, {
          operation: "session.end.d1",
          context: { sessionId },
          rethrow: false,
          fn: () =>
            this.d1.execute(
              "UPDATE sessions SET last_active = ?, metadata = ? WHERE session_id = ?",
              endedSession.lastActive,
              JSON.stringify(endedSession.metadata),
              sessionId
            ),
          onSuccess: () => d1WriteCounter.increment({ table: "sessions", result: "success" }),
          onError: () => d1WriteCounter.increment({ table: "sessions", result: "error" }),
        });

        if (d1Result === undefined) {
          sessionEndCounter.increment({ result: "d1_error" });
          return false;
        }

        activeSessionsGauge.decrement();

        sessionEndCounter.increment({ result: "success" });
        this.logger.info("Session ended successfully", {
          sessionId,
          redisDuration,
        });

        return true;
      } catch (error) {
        sessionEndCounter.increment({ result: "error" });
        this.logger.error("Failed to end session", { sessionId }, error as Error);
        throw error;
      }
    });
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
