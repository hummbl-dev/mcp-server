/**
 * History manager for MCP server conversation storage
 * Ported from Python Phase 1C history_manager.py
 */

import { Message, MessageSchema } from '../types/message.js';
import { RedisClient } from './redis-client.js';
import { D1Client } from './d1-client.js';
import { nanoid } from 'nanoid';

export class HistoryManager {
  constructor(
    private redis: RedisClient,
    private d1: D1Client
  ) {}

  /**
   * Add a message to conversation history
   */
  async addMessage(sessionId: string, message: Message): Promise<string> {
    const messageId = nanoid();
    const redisKey = `history:${sessionId}`;

    // Compress large messages (>1KB) for Redis storage
    const messageJson = JSON.stringify(message);
    const compressedMessage = messageJson.length > 1024
      ? await this.compressMessage(message)
      : messageJson;

    // Add to Redis cache (blocking, fast)
    const redisSuccess = await this.redis.rpush(redisKey, compressedMessage);
    if (!redisSuccess) {
      throw new Error('Failed to add message to Redis cache');
    }

    // Keep only last 20 messages in cache
    await this.redis.ltrim(redisKey, -20, -1);
    await this.redis.expire(redisKey, 3600); // 1hr TTL

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
    ).catch(error => {
      console.error('Failed to write message to D1', { sessionId, messageId, error });
    });

    return messageId;
  }

  /**
   * Get conversation history
   */
  async getHistory(sessionId: string, limit = 50): Promise<Message[]> {
    const redisKey = `history:${sessionId}`;

    // Try Redis cache first (last 20 messages)
    const cachedMessages = await this.redis.lrange<string>(redisKey, -20, -1);

    if (cachedMessages && cachedMessages.length >= limit) {
      // Parse cached messages
      const messages: Message[] = [];
      for (const cached of cachedMessages.slice(-limit)) {
        try {
          const parsed = JSON.parse(cached);
          messages.push(MessageSchema.parse(parsed));
        } catch (error) {
          console.warn('Failed to parse cached message', { sessionId, error });
        }
      }
      return messages;
    }

    // Need more messages - query D1
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

    // Convert rows to messages and reverse (oldest first)
    const messages: Message[] = rows.reverse().map((row: {
      role: string;
      content: string;
      tool_calls: string | null;
      tool_call_id: string | null;
      timestamp: string;
      metadata: string | null;
    }) => ({
      role: row.role as any, // Type assertion - should be validated
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolCallId: row.tool_call_id ?? undefined,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));

    return messages;
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

    const messages: Message[] = messagesToReturn.map((row: {
      message_id: string;
      session_id: string;
      role: string;
      content: string;
      tool_calls: string | null;
      tool_call_id: string | null;
      timestamp: string;
      metadata: string | null;
    }) => ({
      role: row.role as any,
      content: row.content,
      toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : undefined,
      toolCallId: row.tool_call_id ?? undefined,
      timestamp: row.timestamp,
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
    }));

    const nextCursor = hasMore ? messagesToReturn[messagesToReturn.length - 1].timestamp : undefined;

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
      'SELECT COUNT(*) as count FROM messages WHERE session_id = ?',
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
      await this.d1.execute('DELETE FROM messages WHERE session_id = ?', sessionId);
      return true;
    } catch (error) {
      console.error('Failed to clear history from D1', { sessionId, error });
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


}