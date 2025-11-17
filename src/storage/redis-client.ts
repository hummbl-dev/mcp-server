/**
 * Redis client wrapper for MCP server session storage
 * Ported from Python Phase 1C redis_client.py
 */

import { Redis } from '@upstash/redis';

export class RedisClient {
  private client: Redis;

  constructor(redisToken?: string, redisUrl?: string) {
    // Use Upstash Redis v1 API - supports both explicit token/url and environment variables
    if (redisToken && redisUrl) {
      this.client = new Redis({ token: redisToken, url: redisUrl });
    } else {
      this.client = Redis.fromEnv();
    }
  }

  /**
   * Get a value from Redis
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const result = await this.client.get<T>(key);
      return result;
    } catch (error) {
      console.error('Redis GET failed', { key, error });
      return null;
    }
  }

  /**
   * Set a value in Redis with optional expiration
   */
  async set(
    key: string,
    value: unknown,
    options?: { ex: number }
  ): Promise<boolean> {
    try {
      if (options?.ex) {
        await this.client.setex(key, options.ex, value);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      console.error('Redis SET failed', { key, error });
      return false;
    }
  }

  /**
   * Delete a key from Redis
   */
  async delete(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('Redis DEL failed', { key, error });
      return false;
    }
  }

  /**
   * Append to a list (RPUSH)
   */
  async rpush(key: string, value: unknown): Promise<boolean> {
    try {
      await this.client.rpush(key, value);
      return true;
    } catch (error) {
      console.error('Redis RPUSH failed', { key, error });
      return false;
    }
  }

  /**
   * Get range from list (LRANGE)
   */
  async lrange<T>(key: string, start: number, end: number): Promise<T[]> {
    try {
      const result = await this.client.lrange<T>(key, start, end);
      return result;
    } catch (error) {
      console.error('Redis LRANGE failed', { key, error });
      return [];
    }
  }

  /**
   * Trim list to specified range (LTRIM)
   */
  async ltrim(key: string, start: number, end: number): Promise<boolean> {
    try {
      await this.client.ltrim(key, start, end);
      return true;
    } catch (error) {
      console.error('Redis LTRIM failed', { key, error });
      return false;
    }
  }

  /**
   * Set expiration on key (EXPIRE)
   */
  async expire(key: string, seconds: number): Promise<boolean> {
    try {
      await this.client.expire(key, seconds);
      return true;
    } catch (error) {
      console.error('Redis EXPIRE failed', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('Redis EXISTS failed', { key, error });
      return false;
    }
  }

  /**
   * Get time to live for key
   */
  async ttl(key: string): Promise<number> {
    try {
      const result = await this.client.ttl(key);
      return result;
    } catch (error) {
      console.error('Redis TTL failed', { key, error });
      return -1;
    }
  }
}