/**
 * Tests for SessionManager
 * Ported from Python Phase 1C session_manager_test.py
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { SessionManager } from "./session-manager.js";
import { createSession } from "../types/session.js";

// Mock the Redis and D1 clients
vi.mock("./redis-client.js");
vi.mock("./d1-client.js");

import { RedisClient } from "./redis-client.js";
import { D1Client } from "./d1-client.js";

describe("SessionManager", () => {
  let redisClient: RedisClient;
  let d1Client: D1Client;
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Create mock instances
    redisClient = new RedisClient();
    d1Client = new D1Client({} as any); // Mock D1Database

    // Mock Redis methods
    vi.spyOn(redisClient, "get").mockResolvedValue(null);
    vi.spyOn(redisClient, "set").mockResolvedValue(true);
    vi.spyOn(redisClient, "delete").mockResolvedValue(true);
    vi.spyOn(redisClient, "exists").mockResolvedValue(false);
    vi.spyOn(redisClient, "ttl").mockResolvedValue(-1);

    // Mock D1 methods
    vi.spyOn(d1Client, "query").mockResolvedValue([]);
    vi.spyOn(d1Client, "queryOne").mockResolvedValue(null);
    vi.spyOn(d1Client, "execute").mockResolvedValue(1);

    sessionManager = new SessionManager(redisClient, d1Client);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("createSession", () => {
    it("should create a new session successfully", async () => {
      const userId = "user123";
      const adapterType = "discord";

      const result = await sessionManager.create(userId, adapterType);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.adapterType).toBe(adapterType);
      expect(result.version).toBe(1);
    });

    it("should store session in Redis cache", async () => {
      const userId = "user123";
      const adapterType = "discord";

      await sessionManager.create(userId, adapterType);

      expect(redisClient.set).toHaveBeenCalled();
    });

    it("should store session in D1 database", async () => {
      const userId = "user123";
      const adapterType = "discord";

      await sessionManager.create(userId, adapterType);

      expect(d1Client.execute).toHaveBeenCalled();
    });

    it("should handle Redis failure gracefully", async () => {
      vi.spyOn(redisClient, "set").mockResolvedValue(false);

      const result = await sessionManager.create("user123", "discord");

      expect(result).toBeDefined(); // Should still succeed with D1
    });

    it("should handle D1 failure", async () => {
      vi.spyOn(d1Client, "execute").mockRejectedValue(new Error("DB error"));

      // D1 write is non-blocking (fire-and-forget), so create should still succeed
      // The error is logged but doesn't throw
      const result = await sessionManager.create("user123", "discord");

      expect(result).toBeDefined();
      expect(result.userId).toBe("user123");
    });
  });

  describe("getSession", () => {
    it("should return session from Redis cache if available", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(session);

      const result = await sessionManager.get(session.sessionId);

      expect(result).toEqual(session);
      expect(redisClient.get).toHaveBeenCalledWith(`session:${session.sessionId}`);
      expect(d1Client.queryOne).not.toHaveBeenCalled();
    });

    it("should fetch from D1 if not in Redis cache", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(null);
      vi.spyOn(d1Client, "queryOne").mockResolvedValue({
        session_id: session.sessionId,
        user_id: session.userId,
        adapter_type: session.adapterType,
        created_at: session.createdAt,
        last_active: session.lastActive,
        metadata: JSON.stringify(session.metadata),
        version: session.version,
      });

      const result = await sessionManager.get(session.sessionId);

      expect(result).toBeDefined();
      expect(result?.sessionId).toBe(session.sessionId);
      expect(d1Client.queryOne).toHaveBeenCalled();
    });

    it("should cache D1 result in Redis", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(null);
      vi.spyOn(d1Client, "queryOne").mockResolvedValue({
        session_id: session.sessionId,
        user_id: session.userId,
        adapter_type: session.adapterType,
        created_at: session.createdAt,
        last_active: session.lastActive,
        metadata: JSON.stringify(session.metadata),
        version: session.version,
      });

      await sessionManager.get(session.sessionId);

      expect(redisClient.set).toHaveBeenCalled();
    });

    it("should return null for non-existent session", async () => {
      vi.spyOn(redisClient, "get").mockResolvedValue(null);
      vi.spyOn(d1Client, "queryOne").mockResolvedValue(null);

      const result = await sessionManager.get("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle Redis failure and fall back to D1", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockRejectedValue(new Error("Redis down"));
      vi.spyOn(d1Client, "queryOne").mockResolvedValue({
        session_id: session.sessionId,
        user_id: session.userId,
        adapter_type: session.adapterType,
        created_at: session.createdAt,
        last_active: session.lastActive,
        metadata: JSON.stringify(session.metadata),
        version: session.version,
      });

      const result = await sessionManager.get(session.sessionId);

      expect(result).toBeDefined();
    });
  });

  describe("updateSession", () => {
    it("should update session successfully", async () => {
      const session = createSession("user123", "discord");
      const updates = {
        metadata: {
          ...session.metadata,
          clientInfo: { key: "value" },
        },
      };

      vi.spyOn(redisClient, "get").mockResolvedValue(session);
      vi.spyOn(d1Client, "execute").mockResolvedValue(1);

      const result = await sessionManager.update(session.sessionId, updates, session.version);

      expect(result).toBe(true);
      expect(d1Client.execute).toHaveBeenCalled();
    });

    it("should handle version conflicts", async () => {
      const session = createSession("user123", "discord");
      // Mock get to return a session with different version
      const sessionWithNewVersion = { ...session, version: session.version + 1 };
      vi.spyOn(redisClient, "get").mockResolvedValue(sessionWithNewVersion);

      const result = await sessionManager.update(session.sessionId, {}, session.version);

      expect(result).toBe(false);
    });

    it("should update Redis cache after successful D1 update", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(session);
      vi.spyOn(d1Client, "execute").mockResolvedValue(1);

      await sessionManager.update(
        session.sessionId,
        {
          metadata: {
            ...session.metadata,
            clientInfo: { updated: true },
          },
        },
        session.version
      );

      expect(redisClient.set).toHaveBeenCalled();
    });

    it("should handle D1 update failure", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(session);
      // D1 write is non-blocking, so update should still succeed
      vi.spyOn(d1Client, "execute").mockRejectedValue(new Error("Update failed"));

      const result = await sessionManager.update(session.sessionId, {}, session.version);

      expect(result).toBe(true); // Redis update succeeds, D1 failure is non-blocking
    });
  });

  describe("endSession", () => {
    it("should end session successfully", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(session);
      vi.spyOn(d1Client, "execute").mockResolvedValue(1);

      const result = await sessionManager.end(session.sessionId);

      expect(result).toBe(true);
      expect(d1Client.execute).toHaveBeenCalled();
    });

    it("should remove session from Redis cache", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(session);
      vi.spyOn(d1Client, "execute").mockResolvedValue(1);

      await sessionManager.end(session.sessionId);

      // end() updates the session in Redis (sets with shorter TTL), doesn't delete
      expect(redisClient.set).toHaveBeenCalled();
    });

    it("should handle non-existent session", async () => {
      vi.spyOn(redisClient, "get").mockResolvedValue(null);

      const result = await sessionManager.end("nonexistent");

      expect(result).toBe(false);
    });

    it("returns false when Redis set fails", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(session);
      vi.spyOn(redisClient, "set").mockResolvedValueOnce(false);

      const result = await sessionManager.end(session.sessionId);

      expect(result).toBe(false);
    });

    it("returns false when D1 update fails", async () => {
      const session = createSession("user123", "discord");
      vi.spyOn(redisClient, "get").mockResolvedValue(session);
      vi.spyOn(d1Client, "execute").mockRejectedValueOnce(new Error("D1 down"));

      const result = await sessionManager.end(session.sessionId);

      expect(result).toBe(false);
    });
  });

  describe("exists", () => {
    it("returns false when Redis key missing", async () => {
      vi.spyOn(redisClient, "exists").mockResolvedValue(false);

      const exists = await sessionManager.exists("missing");

      expect(exists).toBe(false);
    });

    it("returns true when Redis key exists", async () => {
      vi.spyOn(redisClient, "exists").mockResolvedValue(true);

      const session = createSession("user123", "discord");
      const result = await sessionManager.exists(session.sessionId);

      expect(result).toBe(true);
    });
  });

  // Note: listSessions and cleanupExpiredSessions methods don't exist in current implementation
});
