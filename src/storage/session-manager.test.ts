/**
 * Tests for SessionManager
 * Ported from Python Phase 1C session_manager_test.py
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SessionManager } from './session-manager.js';
import { Session, createSession } from '../types/session.js';

// Mock the Redis and D1 clients
vi.mock('./redis-client.js');
vi.mock('./d1-client.js');

import { RedisClient } from './redis-client.js';
import { D1Client } from './d1-client.js';

describe('SessionManager', () => {
  let redisClient: RedisClient;
  let d1Client: D1Client;
  let sessionManager: SessionManager;

  beforeEach(() => {
    // Create mock instances
    redisClient = new RedisClient();
    d1Client = new D1Client();

    // Mock Redis methods
    vi.spyOn(redisClient, 'get').mockResolvedValue(null);
    vi.spyOn(redisClient, 'set').mockResolvedValue(true);
    vi.spyOn(redisClient, 'delete').mockResolvedValue(true);
    vi.spyOn(redisClient, 'exists').mockResolvedValue(false);
    vi.spyOn(redisClient, 'ttl').mockResolvedValue(-1);

    // Mock D1 methods
    vi.spyOn(d1Client, 'query').mockResolvedValue([]);
    vi.spyOn(d1Client, 'queryOne').mockResolvedValue(null);
    vi.spyOn(d1Client, 'execute').mockResolvedValue({ success: true });

    sessionManager = new SessionManager(redisClient, d1Client);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const userId = 'user123';
      const adapterType = 'discord';

      const result = await sessionManager.create(userId, adapterType);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.adapterType).toBe(adapterType);
      expect(result.version).toBe(1);
    });

    it('should store session in Redis cache', async () => {
      const userId = 'user123';
      const adapterType = 'discord';

      await sessionManager.createSession(userId, adapterType);

      expect(redisClient.set).toHaveBeenCalled();
    });

    it('should store session in D1 database', async () => {
      const userId = 'user123';
      const adapterType = 'discord';

      await sessionManager.createSession(userId, adapterType);

      expect(d1Client.execute).toHaveBeenCalled();
    });

    it('should handle Redis failure gracefully', async () => {
      vi.spyOn(redisClient, 'set').mockResolvedValue(false);

      const result = await sessionManager.createSession('user123', 'discord');

      expect(result).toBeDefined(); // Should still succeed with D1
    });

    it('should handle D1 failure', async () => {
      vi.spyOn(d1Client, 'execute').mockResolvedValue({ success: false, error: 'DB error' });

      await expect(sessionManager.createSession('user123', 'discord')).rejects.toThrow();
    });
  });

  describe('getSession', () => {
    it('should return session from Redis cache if available', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(session));

      const result = await sessionManager.getSession(session.sessionId);

      expect(result).toEqual(session);
      expect(redisClient.get).toHaveBeenCalledWith(`session:${session.sessionId}`);
      expect(d1Client.queryOne).not.toHaveBeenCalled();
    });

    it('should fetch from D1 if not in Redis cache', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(null);
      vi.spyOn(d1Client, 'queryOne').mockResolvedValue({
        session_id: session.sessionId,
        user_id: session.userId,
        adapter_type: session.adapterType,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
        last_activity: session.lastActivity,
        metadata: JSON.stringify(session.metadata),
        version: session.version
      });

      const result = await sessionManager.getSession(session.sessionId);

      expect(result).toBeDefined();
      expect(result?.sessionId).toBe(session.sessionId);
      expect(d1Client.queryOne).toHaveBeenCalled();
    });

    it('should cache D1 result in Redis', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(null);
      vi.spyOn(d1Client, 'queryOne').mockResolvedValue({
        session_id: session.sessionId,
        user_id: session.userId,
        adapter_type: session.adapterType,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
        last_activity: session.lastActivity,
        metadata: JSON.stringify(session.metadata),
        version: session.version
      });

      await sessionManager.getSession(session.sessionId);

      expect(redisClient.set).toHaveBeenCalled();
    });

    it('should return null for non-existent session', async () => {
      vi.spyOn(redisClient, 'get').mockResolvedValue(null);
      vi.spyOn(d1Client, 'queryOne').mockResolvedValue(null);

      const result = await sessionManager.getSession('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle Redis failure and fall back to D1', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockRejectedValue(new Error('Redis down'));
      vi.spyOn(d1Client, 'queryOne').mockResolvedValue({
        session_id: session.sessionId,
        user_id: session.userId,
        adapter_type: session.adapterType,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
        last_activity: session.lastActivity,
        metadata: JSON.stringify(session.metadata),
        version: session.version
      });

      const result = await sessionManager.getSession(session.sessionId);

      expect(result).toBeDefined();
    });
  });

  describe('updateSession', () => {
    it('should update session successfully', async () => {
      const session = createSession('user123', 'discord');
      const updates = { metadata: { key: 'value' } };

      vi.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(session));
      vi.spyOn(d1Client, 'execute').mockResolvedValue({ success: true });

      const result = await sessionManager.updateSession(session.sessionId, updates);

      expect(result).toBe(true);
      expect(d1Client.execute).toHaveBeenCalled();
    });

    it('should handle version conflicts', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(session));
      vi.spyOn(d1Client, 'queryOne').mockResolvedValue({
        ...session,
        version: session.version + 1 // Higher version in DB
      });

      const result = await sessionManager.updateSession(session.sessionId, {});

      expect(result).toBe(false);
    });

    it('should update Redis cache after successful D1 update', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(session));
      vi.spyOn(d1Client, 'execute').mockResolvedValue({ success: true });

      await sessionManager.updateSession(session.sessionId, { metadata: { updated: true } });

      expect(redisClient.set).toHaveBeenCalled();
    });

    it('should handle D1 update failure', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(session));
      vi.spyOn(d1Client, 'execute').mockResolvedValue({ success: false, error: 'Update failed' });

      const result = await sessionManager.updateSession(session.sessionId, {});

      expect(result).toBe(false);
    });
  });

  describe('endSession', () => {
    it('should end session successfully', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(session));
      vi.spyOn(d1Client, 'execute').mockResolvedValue({ success: true });

      const result = await sessionManager.endSession(session.sessionId);

      expect(result).toBe(true);
      expect(d1Client.execute).toHaveBeenCalled();
    });

    it('should remove session from Redis cache', async () => {
      const session = createSession('user123', 'discord');
      vi.spyOn(redisClient, 'get').mockResolvedValue(JSON.stringify(session));
      vi.spyOn(d1Client, 'execute').mockResolvedValue({ success: true });

      await sessionManager.endSession(session.sessionId);

      expect(redisClient.delete).toHaveBeenCalledWith(`session:${session.sessionId}`);
    });

    it('should handle non-existent session', async () => {
      vi.spyOn(redisClient, 'get').mockResolvedValue(null);

      const result = await sessionManager.endSession('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('listSessions', () => {
    it('should return list of sessions for user', async () => {
      const sessions = [
        createSession('user123', 'discord'),
        createSession('user123', 'slack')
      ];

      vi.spyOn(d1Client, 'query').mockResolvedValue(sessions.map(s => ({
        session_id: s.sessionId,
        user_id: s.userId,
        adapter_type: s.adapterType,
        created_at: s.createdAt,
        updated_at: s.updatedAt,
        last_activity: s.lastActivity,
        metadata: JSON.stringify(s.metadata),
        version: s.version
      })));

      const result = await sessionManager.listSessions('user123');

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user123');
    });

    it('should handle empty results', async () => {
      vi.spyOn(d1Client, 'query').mockResolvedValue([]);

      const result = await sessionManager.listSessions('user123');

      expect(result).toEqual([]);
    });

    it('should filter by adapter type', async () => {
      const sessions = [
        createSession('user123', 'discord'),
        createSession('user123', 'slack')
      ];

      vi.spyOn(d1Client, 'query').mockResolvedValue([{
        session_id: sessions[0].sessionId,
        user_id: sessions[0].userId,
        adapter_type: sessions[0].adapterType,
        created_at: sessions[0].createdAt,
        updated_at: sessions[0].updatedAt,
        last_activity: sessions[0].lastActivity,
        metadata: JSON.stringify(sessions[0].metadata),
        version: sessions[0].version
      }]);

      const result = await sessionManager.listSessions('user123', 'discord');

      expect(result).toHaveLength(1);
      expect(result[0].adapterType).toBe('discord');
    });
  });

  describe('cleanupExpiredSessions', () => {
    it('should remove expired sessions from Redis', async () => {
      vi.spyOn(redisClient, 'ttl').mockResolvedValue(0); // Expired
      vi.spyOn(redisClient, 'exists').mockResolvedValue(true);

      await sessionManager.cleanupExpiredSessions();

      expect(redisClient.delete).toHaveBeenCalled();
    });

    it('should not remove non-expired sessions', async () => {
      vi.spyOn(redisClient, 'ttl').mockResolvedValue(3600); // Not expired
      vi.spyOn(redisClient, 'exists').mockResolvedValue(true);

      await sessionManager.cleanupExpiredSessions();

      expect(redisClient.delete).not.toHaveBeenCalled();
    });
  });
});