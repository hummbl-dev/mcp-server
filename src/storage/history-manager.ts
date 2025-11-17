/**
 * History manager for MCP server conversation storage
 * Ported from Python Phase 1C history_manager.py
 * Phase 1D: Added observability instrumentation
 */

import type { Message } from "../types/message.js";
import { MessageSchema } from "../types/message.js";
import { RedisClient } from "./redis-client.js";
import { D1Client } from "./d1-client.js";
import { nanoid } from "nanoid";
import { Logger } from "../observability/logger.js";
import {
  d1WriteCounter,
  d1ReadCounter,
  cacheHitCounter,
  cacheMissCounter,
} from "../observability/metrics.js";
import { trace } from "../observability/tracing.js";

export class HistoryManager {
  constructor(
    private redis: RedisClient,
    private d1: D1Client,
    private logger: Logger = new Logger()
  ) {}

  /**
   * Add a message to conversation history with observability instrumentation
   */
  // @ts-expect-error - Decorator type compatibility issue with TypeScript 5.x
  @trace("history.add_message")
  async addMessage(sessionId: string, message: Message): Promise<string> {
    return this.logger.timer("history.addMessage", { sessionId, role: message.role }, async () => {
      const messageId = nanoid();
      const redisKey = `history:${sessionId}`;

      this.logger.debug("Adding message to history", { sessionId, messageId, role: message.role });

      try {
        // Compress large messages (>1KB) for Redis storage
        const messageJson = JSON.stringify(message);
        const compressedMessage =
          messageJson.length > 1024 ? await this.compressMessage(message) : messageJson;

        // Add to Redis cache (blocking, fast)
        const redisStartTime = Date.now();
        let redisSuccess = false;
        let redisDuration = 0;
        try {
          redisSuccess = await this.redis.rpush(redisKey, compressedMessage);
          redisDuration = Date.now() - redisStartTime;

          if (redisSuccess) {
            // Keep only last 20 messages in cache
            await this.redis.ltrim(redisKey, -20, -1).catch(() => {
              // Ignore ltrim failures
            });
            await this.redis.expire(redisKey, 3600).catch(() => {
              // Ignore expire failures
            }); // 1hr TTL
          } else {
            this.logger.error("Failed to add message to Redis cache", { sessionId, messageId });
            // Continue with D1 write - Redis failure is not fatal
          }
        } catch (redisError) {
          // Redis connection error - log and continue with D1
          redisDuration = Date.now() - redisStartTime;
          this.logger.error("Redis connection error, continuing with D1", {
            sessionId,
            messageId,
            error: (redisError as Error).message,
          });
          // Continue with D1 write - Redis failure is not fatal
        }

        // Write to D1 (async, non-blocking)
        Promise.resolve(
          this.d1.execute(
            `INSERT INTO messages (
              message_id, session_id, role, content, tool_calls,
              tool_call_id, timestamp, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            messageId,
            sessionId,
            message.role,
            message.content,
            message.toolCalls ? JSON.stringify(message.toolCalls) : null,
            message.toolCallId ?? null,
            message.timestamp,
            message.metadata ? JSON.stringify(message.metadata) : null
          )
        )
          .then(() => {
            d1WriteCounter.increment({ table: "messages", result: "success" });
          })
          .catch((error) => {
            d1WriteCounter.increment({ table: "messages", result: "error" });
            this.logger.error(
              "Failed to write message to D1",
              { sessionId, messageId },
              error as Error
            );
          });

        this.logger.info("Message added to history successfully", {
          sessionId,
          messageId,
          role: message.role,
          redisDuration,
          compressed: compressedMessage !== messageJson,
        });

        return messageId;
      } catch (error) {
        this.logger.error(
          "Failed to add message to history",
          { sessionId, role: message.role },
          error as Error
        );
        throw error;
      }
    });
  }

  /**
   * Get conversation history with observability instrumentation
   */
  // @ts-expect-error - Decorator type compatibility issue with TypeScript 5.x
  @trace("history.get_history")
  async getHistory(sessionId: string, limit = 50): Promise<Message[]> {
    return this.logger.timer("history.getHistory", { sessionId, limit }, async () => {
      const redisKey = `history:${sessionId}`;

      this.logger.debug("Retrieving conversation history", { sessionId, limit });

      try {
        // Try Redis cache first (last 20 messages)
        const redisStartTime = Date.now();
        let cachedMessages: string[] = [];
        let redisDuration = 0;
        try {
          cachedMessages = await this.redis.lrange<string>(redisKey, -20, -1);
          redisDuration = Date.now() - redisStartTime;
        } catch (redisError) {
          // Redis failure - fall back to D1
          this.logger.warn("Redis error, falling back to D1", {
            sessionId,
            error: (redisError as Error).message,
          });
          redisDuration = Date.now() - redisStartTime;
        }

        if (cachedMessages && cachedMessages.length > 0) {
          // Parse cached messages (use up to limit)
          const messages: Message[] = [];
          const messagesToUse = cachedMessages.slice(-limit);
          for (const cached of messagesToUse) {
            try {
              const parsed = JSON.parse(cached);
              messages.push(MessageSchema.parse(parsed));
            } catch (error) {
              this.logger.warn("Failed to parse cached message", {
                sessionId,
                error: (error as Error).message,
              });
            }
          }

          cacheHitCounter.increment({ operation: "history.getHistory" });
          this.logger.info("History retrieved from cache", {
            sessionId,
            messageCount: messages.length,
            redisDuration,
          });

          return messages;
        }

        // Cache miss - fetch from D1
        cacheMissCounter.increment({ operation: "history.getHistory" });
        const d1StartTime = Date.now();

        const rows = await this.d1.query<{
          message_id: string;
          session_id: string;
          role: string;
          content: string;
          tool_calls: string | null;
          tool_call_id: string | null;
          timestamp: string;
          metadata: string | null;
        }>(
          `SELECT * FROM messages
           WHERE session_id = ?
           ORDER BY timestamp DESC
           LIMIT ?`,
          sessionId,
          limit
        );

        const d1Duration = Date.now() - d1StartTime;
        d1ReadCounter.increment({ table: "messages", result: "success" });

        // Convert rows to messages and reverse (oldest first)
        const messages: Message[] = rows.reverse().map((row) => ({
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          role: row.role as any, // Type assertion - should be validated
          content: row.content,
          toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
          toolCallId: row.tool_call_id ?? undefined,
          timestamp: row.timestamp,
          metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
        }));

        // Cache messages back to Redis (last 20 messages)
        if (messages.length > 0) {
          Promise.resolve(
            (async () => {
              try {
                for (const message of messages.slice(-20)) {
                  await this.redis.rpush(redisKey, JSON.stringify(message));
                }
                await this.redis.ltrim(redisKey, -20, -1);
                await this.redis.expire(redisKey, 3600);
              } catch (error) {
                // Ignore Redis caching errors - non-blocking
                this.logger.warn("Failed to cache messages in Redis", {
                  sessionId,
                  error: (error as Error).message,
                });
              }
            })()
          );
        }

        this.logger.info("History retrieved from database", {
          sessionId,
          messageCount: messages.length,
          redisDuration,
          d1Duration,
          totalDuration: redisDuration + d1Duration,
        });

        return messages;
      } catch (error) {
        d1ReadCounter.increment({ table: "messages", result: "error" });
        this.logger.error(
          "Failed to retrieve conversation history",
          { sessionId, limit },
          error as Error
        );
        throw error;
      }
    });
  }

  /**
   * Get paginated history with cursor
   */
  async getHistoryPage(
    sessionId: string,
    cursor?: string,
    limit = 50
  ): Promise<{ messages: Message[]; nextCursor?: string }> {
    const queryLimit = limit + 1; // Get one extra to check if there are more

    let sql = `SELECT * FROM messages WHERE session_id = ?`;
    const params: unknown[] = [sessionId];

    if (cursor) {
      sql += ` AND timestamp > ?`;
      params.push(cursor);
    }

    sql += ` ORDER BY timestamp ASC LIMIT ?`;
    params.push(queryLimit);

    const rows = await this.d1.query<{
      message_id: string;
      session_id: string;
      role: string;
      content: string;
      tool_calls: string | null;
      tool_call_id: string | null;
      timestamp: string;
      metadata: string | null;
    }>(sql, ...params);

    const hasMore = rows.length === queryLimit;
    const messagesToReturn = hasMore ? rows.slice(0, -1) : rows;

    const messages: Message[] = messagesToReturn.map((row) => ({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      role: row.role as any,
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolCallId: row.tool_call_id ?? undefined,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));

    const nextCursor = hasMore
      ? messagesToReturn[messagesToReturn.length - 1].timestamp
      : undefined;

    return {
      messages,
      nextCursor,
    };
  }

  /**
   * Get message count for session
   */
  async getMessageCount(sessionId: string): Promise<number> {
    const result = await this.d1.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM messages WHERE session_id = ?",
      sessionId
    );

    return result?.count ?? 0;
  }

  /**
   * Clear history for session (dangerous - use with caution)
   */
  async clearHistory(sessionId: string): Promise<boolean> {
    const redisKey = `history:${sessionId}`;

    // Clear Redis cache
    await this.redis.delete(redisKey);

    // Clear D1 storage
    try {
      await this.d1.execute("DELETE FROM messages WHERE session_id = ?", sessionId);
      return true;
    } catch (error) {
      console.error("Failed to clear history from D1", { sessionId, error });
      return false;
    }
  }

  /**
   * Compress large messages for Redis storage
   * In a real implementation, this would use compression like gzip
   * For now, just return the JSON (placeholder)
   */
  private async compressMessage(message: Message): Promise<string> {
    // TODO: Implement compression (gzip, lz4, etc.)
    return JSON.stringify(message);
  }

  /**
   * Decompress messages from Redis
   * In a real implementation, this would decompress
   * For now, just parse JSON (placeholder)
   * @internal
   */
  // @ts-expect-error - Unused method, reserved for future compression implementation
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _decompressMessage(_compressed: string): Promise<Message> {
    // TODO: Implement decompression
    return JSON.parse(_compressed);
  }
}
