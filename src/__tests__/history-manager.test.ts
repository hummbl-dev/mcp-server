import { describe, it, expect, beforeEach } from "vitest";
import { HistoryManager } from "../storage/history-manager.js";
import type { RedisClient } from "../storage/redis-client.js";
import type { D1Client } from "../storage/d1-client.js";
import { Logger } from "../observability/logger.js";
import type { Message } from "../types/message.js";

function createMockRedis(store: Map<string, string[]>) {
  return {
    async rpush(key: string, value: string): Promise<boolean> {
      const list = store.get(key) ?? [];
      list.push(value);
      store.set(key, list);
      return true;
    },
    async ltrim(_key: string, _start: number, _end: number): Promise<boolean> {
      // Mock keeps the full list; trimming semantics aren't needed for round-trip tests.
      return true;
    },
    async expire(_key: string, _seconds: number): Promise<boolean> {
      return true;
    },
    async lrange<T>(key: string, _start: number, _end: number): Promise<T[]> {
      return (store.get(key) ?? []) as T[];
    },
    async delete(key: string): Promise<boolean> {
      return store.delete(key);
    },
  } as unknown as RedisClient;
}

function createMockD1() {
  return {
    async execute(_sql: string, ..._params: unknown[]): Promise<number> {
      return 1;
    },
    async query<T>(_sql: string, ..._params: unknown[]): Promise<T[]> {
      return [];
    },
    async queryOne<T>(_sql: string, ..._params: unknown[]): Promise<T | null> {
      return null;
    },
  } as unknown as D1Client;
}

function makeMessage(content: string): Message {
  return {
    role: "user",
    content,
    timestamp: new Date().toISOString(),
  };
}

describe("HistoryManager compression", () => {
  let store: Map<string, string[]>;
  let manager: HistoryManager;

  beforeEach(() => {
    store = new Map();
    // Sample rate 0 silences the logger output during tests.
    const logger = new Logger(0);
    manager = new HistoryManager(createMockRedis(store), createMockD1(), logger);
  });

  it("stores small messages in plain JSON (no compression)", async () => {
    const msg = makeMessage("hello world");
    await manager.addMessage("s1", msg);

    const cached = store.get("history:s1");
    expect(cached).toHaveLength(1);
    expect(cached![0].startsWith("gz:")).toBe(false);
    // Should be directly JSON-parseable.
    expect(() => JSON.parse(cached![0]!)).not.toThrow();
  });

  it("compresses messages larger than the 1024-byte threshold", async () => {
    const largeContent = "x".repeat(2048);
    const msg = makeMessage(largeContent);
    await manager.addMessage("s2", msg);

    const cached = store.get("history:s2");
    expect(cached).toHaveLength(1);
    expect(cached![0].startsWith("gz:")).toBe(true);
    // Gzip of a 2KB repeating string should be far smaller than the raw JSON.
    const rawSize = JSON.stringify(msg).length;
    expect(cached![0].length).toBeLessThan(rawSize);
  });

  it("round-trips a compressed message through getHistory", async () => {
    const largeContent = "A".repeat(5000);
    const msg = makeMessage(largeContent);
    await manager.addMessage("s3", msg);

    // Confirm it really was compressed.
    expect(store.get("history:s3")![0].startsWith("gz:")).toBe(true);

    const history = await manager.getHistory("s3");
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe(largeContent);
    expect(history[0].role).toBe("user");
    expect(history[0].timestamp).toBe(msg.timestamp);
  });

  it("handles a mix of compressed and uncompressed entries in the same session", async () => {
    const small = makeMessage("short");
    const large = makeMessage("L".repeat(4096));
    const tiny = makeMessage("ok");

    await manager.addMessage("mix", small);
    await manager.addMessage("mix", large);
    await manager.addMessage("mix", tiny);

    const cached = store.get("history:mix")!;
    expect(cached).toHaveLength(3);
    expect(cached[0].startsWith("gz:")).toBe(false);
    expect(cached[1].startsWith("gz:")).toBe(true);
    expect(cached[2].startsWith("gz:")).toBe(false);

    const history = await manager.getHistory("mix");
    expect(history).toHaveLength(3);
    expect(history[0].content).toBe("short");
    expect(history[1].content).toBe(large.content);
    expect(history[2].content).toBe("ok");
  });

  it("preserves multibyte unicode content through compression", async () => {
    // Characters that occupy multiple bytes in UTF-8; verifies our byte/base64
    // conversions handle the full range correctly.
    const content = "日本語テスト ".repeat(200) + "🎉".repeat(200);
    const msg = makeMessage(content);
    await manager.addMessage("unicode", msg);

    expect(store.get("history:unicode")![0].startsWith("gz:")).toBe(true);

    const history = await manager.getHistory("unicode");
    expect(history).toHaveLength(1);
    expect(history[0].content).toBe(content);
  });
});
