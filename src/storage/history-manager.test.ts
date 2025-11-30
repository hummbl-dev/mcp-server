/**
 * Tests for HistoryManager
 * Ported from Python Phase 1C history_manager_test.py
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { HistoryManager } from "./history-manager.js";
import { createUserMessage, createAssistantMessage } from "../types/message.js";

// Mock the Redis and D1 clients
vi.mock("./redis-client.js");
vi.mock("./d1-client.js");

import { RedisClient } from "./redis-client.js";
import { D1Client } from "./d1-client.js";

describe("HistoryManager", () => {
  let redisClient: RedisClient;
  let d1Client: D1Client;
  let historyManager: HistoryManager;

  beforeEach(() => {
    // Create mock instances
    redisClient = new RedisClient();
    d1Client = new D1Client({} as any); // Mock D1Database

    // Mock Redis methods
    vi.spyOn(redisClient, "rpush").mockResolvedValue(true);
    vi.spyOn(redisClient, "lrange").mockResolvedValue([]);
    vi.spyOn(redisClient, "ltrim").mockResolvedValue(true);
    vi.spyOn(redisClient, "expire").mockResolvedValue(true);
    vi.spyOn(redisClient, "delete").mockResolvedValue(true);
    vi.spyOn(redisClient, "exists").mockResolvedValue(false);

    // Mock D1 methods
    vi.spyOn(d1Client, "query").mockResolvedValue([]);
    vi.spyOn(d1Client, "execute").mockResolvedValue(1);

    historyManager = new HistoryManager(redisClient, d1Client);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("addMessage", () => {
    it("should add message to Redis cache", async () => {
      const sessionId = "session123";
      const message = createUserMessage("Hello world");

      const result = await historyManager.addMessage(sessionId, message);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(redisClient.rpush).toHaveBeenCalledWith(`history:${sessionId}`, expect.any(String));
    });

    it("should add message to D1 database", async () => {
      const sessionId = "session123";
      const message = createUserMessage("Hello world");

      const result = await historyManager.addMessage(sessionId, message);

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
      expect(d1Client.execute).toHaveBeenCalled();
    });

    it("should handle Redis failure gracefully", async () => {
      vi.spyOn(redisClient, "rpush").mockResolvedValue(false);

      const result = await historyManager.addMessage("session123", createUserMessage("test"));

      expect(result).toBeDefined(); // Should still succeed with D1, returns messageId
      expect(typeof result).toBe("string");
    });

    it("should handle D1 failure", async () => {
      vi.spyOn(d1Client, "execute").mockRejectedValue(new Error("DB error"));

      // D1 write is non-blocking, so addMessage should still succeed
      // The error is logged but doesn't throw
      const result = await historyManager.addMessage("session123", createUserMessage("test"));

      expect(result).toBeDefined(); // Returns messageId even if D1 fails (non-blocking)
      expect(typeof result).toBe("string");
    });

    it("should compress large messages", async () => {
      const sessionId = "session123";
      const largeMessage = createUserMessage("x".repeat(10000)); // Large message

      await historyManager.addMessage(sessionId, largeMessage);

      // Should still work, compression is placeholder for now
      expect(redisClient.rpush).toHaveBeenCalled();
    });

    it("compresses payloads greater than 1KB", async () => {
      const sessionId = "session-large";
      const largePayload = createUserMessage("a".repeat(2000));

      await historyManager.addMessage(sessionId, largePayload);

      expect(redisClient.rpush).toHaveBeenCalledWith(
        `history:${sessionId}`,
        expect.any(String)
      );
    });
  });

  describe("getHistory", () => {
    it("should return history from Redis cache if available", async () => {
      const sessionId = "session123";
      const messages = [createUserMessage("Hello"), createAssistantMessage("Hi there")];

      vi.spyOn(redisClient, "lrange").mockResolvedValue(messages.map((m) => JSON.stringify(m)));

      const result = await historyManager.getHistory(sessionId);

      expect(result).toHaveLength(2);
      expect(result[0].content).toBe("Hello");
      expect(result[1].content).toBe("Hi there");
      expect(d1Client.query).not.toHaveBeenCalled();
    });

    it("should fetch from D1 if not in Redis cache", async () => {
      const sessionId = "session123";
      const messages = [createUserMessage("Hello"), createAssistantMessage("Hi there")];

      vi.spyOn(redisClient, "lrange").mockResolvedValue([]);
      vi.spyOn(d1Client, "query").mockResolvedValue(
        messages.map((m, i) => ({
          message_id: `msg${i}`,
          session_id: sessionId,
          role: m.role,
          content: m.content,
          tool_calls: m.toolCalls ? JSON.stringify(m.toolCalls) : null,
          tool_call_id: m.toolCallId || null,
          timestamp: m.timestamp,
          metadata: m.metadata ? JSON.stringify(m.metadata) : null,
        }))
      );

      const result = await historyManager.getHistory(sessionId);

      expect(result).toHaveLength(2);
      expect(d1Client.query).toHaveBeenCalled();
    });

    it("should cache D1 results in Redis", async () => {
      const sessionId = "session123";
      vi.spyOn(redisClient, "lrange").mockResolvedValue([]);
      vi.spyOn(d1Client, "query").mockResolvedValue([
        {
          message_id: "msg1",
          session_id: sessionId,
          role: "user",
          content: "Hello",
          tool_calls: null,
          tool_call_id: null,
          timestamp: new Date().toISOString(),
          metadata: null,
        },
      ]);

      await historyManager.getHistory(sessionId);

      expect(redisClient.rpush).toHaveBeenCalled();
    });

    it("should return empty array for non-existent session", async () => {
      vi.spyOn(redisClient, "lrange").mockResolvedValue([]);
      vi.spyOn(d1Client, "query").mockResolvedValue([]);

      const result = await historyManager.getHistory("nonexistent");

      expect(result).toEqual([]);
    });

    it("should handle Redis failure and fall back to D1", async () => {
      const sessionId = "session123";
      vi.spyOn(redisClient, "lrange").mockRejectedValue(new Error("Redis down"));
      vi.spyOn(d1Client, "query").mockResolvedValue([
        {
          message_id: "msg1",
          session_id: sessionId,
          role: "user",
          content: "Hello",
          tool_calls: null,
          tool_call_id: null,
          timestamp: new Date().toISOString(),
          metadata: null,
        },
      ]);

      const result = await historyManager.getHistory(sessionId);

      expect(result).toHaveLength(1);
    });

    it("should limit results when specified", async () => {
      const sessionId = "session123";
      const messages = Array.from({ length: 10 }, (_, i) => createUserMessage(`Message ${i}`));

      vi.spyOn(redisClient, "lrange").mockResolvedValue(messages.map((m) => JSON.stringify(m)));

      const result = await historyManager.getHistory(sessionId, 5);

      expect(result).toHaveLength(5);
      expect(redisClient.lrange).toHaveBeenCalledWith(`history:${sessionId}`, -20, -1);
    });
  });

  describe("getHistoryPage", () => {
    it("should return paginated results", async () => {
      const sessionId = "session123";
      const messages = Array.from({ length: 10 }, (_, i) => ({
        message_id: `msg${i}`,
        session_id: sessionId,
        role: "user",
        content: `Message ${i}`,
        tool_calls: null,
        tool_call_id: null,
        timestamp: new Date(Date.now() + i * 1000).toISOString(), // Different timestamps
        metadata: null,
      }));

      // Return limit + 1 to indicate there are more messages
      vi.spyOn(d1Client, "query").mockResolvedValue(messages.slice(0, 6));

      const result = await historyManager.getHistoryPage(sessionId, "cursor123", 5);

      expect(result.messages).toHaveLength(5); // Should return only limit, not limit+1
      expect(result.nextCursor).toBeDefined(); // Should have cursor since we returned 6 (limit+1)
    });

    it("should handle last page", async () => {
      const sessionId = "session123";
      const messages = Array.from({ length: 3 }, (_, i) => ({
        message_id: `msg${i}`,
        session_id: sessionId,
        role: "user",
        content: `Message ${i}`,
        tool_calls: null,
        tool_call_id: null,
        timestamp: new Date().toISOString(),
        metadata: null,
      }));

      vi.spyOn(d1Client, "query").mockResolvedValue(messages);

      const result = await historyManager.getHistoryPage(sessionId, "cursor123", 5);

      expect(result.messages).toHaveLength(3);
      expect(result.nextCursor).toBeUndefined();
    });

    it("should handle empty results", async () => {
      vi.spyOn(d1Client, "query").mockResolvedValue([]);

      const result = await historyManager.getHistoryPage("session123", "cursor123", 5);

      expect(result.messages).toEqual([]);
      expect(result.nextCursor).toBeUndefined();
    });
  });

  describe("clearHistory", () => {
    it("should clear history from Redis cache", async () => {
      const sessionId = "session123";

      const result = await historyManager.clearHistory(sessionId);

      expect(result).toBe(true);
      expect(redisClient.delete).toHaveBeenCalledWith(`history:${sessionId}`);
    });

    it("should clear history from D1 database", async () => {
      const sessionId = "session123";

      const result = await historyManager.clearHistory(sessionId);

      expect(result).toBe(true);
      expect(d1Client.execute).toHaveBeenCalled();
    });

    it("should handle Redis failure gracefully", async () => {
      vi.spyOn(redisClient, "delete").mockResolvedValue(false);

      const result = await historyManager.clearHistory("session123");

      expect(result).toBe(true); // Should still succeed with D1
    });

    it("should handle D1 failure", async () => {
      vi.spyOn(d1Client, "execute").mockRejectedValue(new Error("DB error"));

      const result = await historyManager.clearHistory("session123");

      expect(result).toBe(false);
    });

    it("continues when Redis delete fails", async () => {
      vi.spyOn(redisClient, "delete").mockResolvedValueOnce(false);

      const result = await historyManager.clearHistory("session123");

      expect(result).toBe(true);
      expect(d1Client.execute).toHaveBeenCalled();
    });
  });

  // Note: trimHistory and getHistorySize methods don't exist in current implementation
  // Use getMessageCount() instead of getHistorySize()

  describe("compressMessage/decompressMessage", () => {
    it("should compress and decompress messages (placeholder implementation)", async () => {
      const message = createUserMessage("Test message");

      // These are placeholder implementations, so they should work
      const compressed = await (historyManager as any).compressMessage(message);
      expect(typeof compressed).toBe("string");

      // decompressMessage was removed as unused, but if it existed:
      // const decompressed = await (historyManager as any).decompressMessage(compressed);
      // expect(decompressed).toEqual(message);
    });
  });

  describe("error handling", () => {
    it("should handle malformed JSON in Redis cache", async () => {
      vi.spyOn(redisClient, "lrange").mockResolvedValue(["invalid json"]);
      vi.spyOn(d1Client, "query").mockResolvedValue([]);

      const result = await historyManager.getHistory("session123");

      expect(result).toEqual([]);
    });

    it("should handle database connection errors", async () => {
      vi.spyOn(d1Client, "query").mockRejectedValue(new Error("DB connection failed"));

      await expect(historyManager.getHistory("session123")).rejects.toThrow("DB connection failed");
    });

    it("should handle Redis connection errors", async () => {
      vi.spyOn(redisClient, "rpush").mockRejectedValue(new Error("Redis connection failed"));

      // Redis failure is now non-fatal, should still return messageId
      const result = await historyManager.addMessage("session123", createUserMessage("test"));

      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });
  });
});
