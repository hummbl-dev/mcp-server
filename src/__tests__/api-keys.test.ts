import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  generateApiKey,
  isValidApiKeyFormat,
  validateApiKey,
} from "../auth/api-keys.js";
import type { ApiKeyInfo } from "../types/domain.js";
import type { KVNamespace } from "@cloudflare/workers-types";

type KvEntry = { value: string; expiresAt: number | null };

/**
 * Minimal in-memory KVNamespace mock. Only the methods used by the auth
 * module are implemented; everything else throws so accidental calls are
 * caught in tests.
 */
function createMockKV() {
  const store = new Map<string, KvEntry>();

  const get = async (key: string): Promise<string | null> => {
    const entry = store.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return entry.value;
  };

  const put = async (
    key: string,
    value: string,
    options?: { expirationTtl?: number }
  ): Promise<void> => {
    const expiresAt =
      options?.expirationTtl !== undefined ? Date.now() + options.expirationTtl * 1000 : null;
    store.set(key, { value, expiresAt });
  };

  const del = async (key: string): Promise<void> => {
    store.delete(key);
  };

  const kv = {
    get,
    put,
    delete: del,
    list: async () => ({ keys: [] }),
    getWithMetadata: async () => ({ value: null, metadata: null }),
  } as unknown as KVNamespace;

  return { kv, store };
}

function makeKeyInfo(overrides: Partial<ApiKeyInfo> = {}): ApiKeyInfo {
  return {
    id: "id-1",
    key: "hummbl_test1234567890abcd",
    tier: "free",
    name: "test-key",
    createdAt: new Date().toISOString(),
    usageCount: 0,
    rateLimit: { requestsPerHour: 3, requestsPerDay: 5 },
    permissions: ["read:models"],
    isActive: true,
    ...overrides,
  };
}

describe("isValidApiKeyFormat", () => {
  it("accepts keys with the hummbl_ prefix and extra chars", () => {
    expect(isValidApiKeyFormat("hummbl_abc")).toBe(true);
  });

  it("rejects keys missing the prefix", () => {
    expect(isValidApiKeyFormat("abc_hummbl")).toBe(false);
  });

  it("rejects the bare prefix with no body", () => {
    expect(isValidApiKeyFormat("hummbl_")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidApiKeyFormat(undefined as unknown as string)).toBe(false);
  });
});

describe("generateApiKey", () => {
  it("assigns tier-appropriate limits and permissions", () => {
    const info = generateApiKey("pro", "acme");
    expect(info.tier).toBe("pro");
    expect(info.name).toBe("acme");
    expect(info.isActive).toBe(true);
    expect(info.rateLimit.requestsPerHour).toBe(1000);
    expect(info.permissions).toContain("read:search");
    expect(info.key.startsWith("hummbl_")).toBe(true);
  });

  it("grants admin:* only to the enterprise tier", () => {
    expect(generateApiKey("free", "x").permissions).not.toContain("admin:*");
    expect(generateApiKey("pro", "x").permissions).not.toContain("admin:*");
    expect(generateApiKey("enterprise", "x").permissions).toContain("admin:*");
  });
});

describe("validateApiKey", () => {
  let kv: KVNamespace;
  let store: Map<string, KvEntry>;

  beforeEach(() => {
    const mock = createMockKV();
    kv = mock.kv;
    store = mock.store;
  });

  it("rejects malformed keys before touching KV", async () => {
    const result = await validateApiKey(kv, "not-a-key");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("INVALID_FORMAT");
  });

  it("returns KEY_NOT_FOUND when the key is absent", async () => {
    const result = await validateApiKey(kv, "hummbl_missing");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("KEY_NOT_FOUND");
  });

  it("returns KEY_INACTIVE when stored key is deactivated", async () => {
    const info = makeKeyInfo({ isActive: false });
    store.set(info.key, { value: JSON.stringify(info), expiresAt: null });

    const result = await validateApiKey(kv, info.key);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.type).toBe("KEY_INACTIVE");
  });

  it("returns the keyInfo for a valid active key", async () => {
    const info = makeKeyInfo();
    store.set(info.key, { value: JSON.stringify(info), expiresAt: null });

    const result = await validateApiKey(kv, info.key);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.key).toBe(info.key);
  });

  it("does NOT consume rate-limit quota (that is the middleware's job)", async () => {
    const info = makeKeyInfo();
    store.set(info.key, { value: JSON.stringify(info), expiresAt: null });

    await validateApiKey(kv, info.key);
    await validateApiKey(kv, info.key);

    const rlKeys = Array.from(store.keys()).filter((k) => k.startsWith("rl:"));
    expect(rlKeys).toHaveLength(0);
  });
});

describe("checkRateLimit", () => {
  let kv: KVNamespace;
  let store: Map<string, KvEntry>;

  beforeEach(() => {
    const mock = createMockKV();
    kv = mock.kv;
    store = mock.store;
  });

  it("allows the first request and reports remaining quota", async () => {
    const info = makeKeyInfo({
      rateLimit: { requestsPerHour: 3, requestsPerDay: 5 },
    });

    const result = await checkRateLimit(kv, info);
    expect(result.allowed).toBe(true);
    expect(result.status.hourLimit).toBe(3);
    expect(result.status.hourRemaining).toBe(2);
    expect(result.status.dayLimit).toBe(5);
    expect(result.status.dayRemaining).toBe(4);
    expect(result.status.hourResetSec).toBeGreaterThan(0);
    expect(result.status.hourResetSec).toBeLessThanOrEqual(3600);
    expect(result.status.dayResetSec).toBeGreaterThan(0);
    expect(result.status.dayResetSec).toBeLessThanOrEqual(86400);
  });

  it("increments counters across sequential requests", async () => {
    const info = makeKeyInfo({
      rateLimit: { requestsPerHour: 10, requestsPerDay: 100 },
    });

    const r1 = await checkRateLimit(kv, info);
    const r2 = await checkRateLimit(kv, info);
    const r3 = await checkRateLimit(kv, info);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(true);
    expect(r1.status.hourRemaining).toBe(9);
    expect(r2.status.hourRemaining).toBe(8);
    expect(r3.status.hourRemaining).toBe(7);
    expect(r3.status.dayRemaining).toBe(97);
  });

  it("blocks when the hourly limit is reached, without incrementing further", async () => {
    const info = makeKeyInfo({
      rateLimit: { requestsPerHour: 2, requestsPerDay: 100 },
    });

    const r1 = await checkRateLimit(kv, info);
    const r2 = await checkRateLimit(kv, info);
    const r3 = await checkRateLimit(kv, info);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);

    if (!r3.allowed) {
      expect(r3.error.type).toBe("RATE_LIMIT_EXCEEDED");
      expect(r3.error.message).toContain("Hourly");
      expect(r3.status.hourRemaining).toBe(0);
      expect(r3.retryAfterSec).toBe(r3.status.hourResetSec);
    }

    // Day counter should have been incremented twice only (the two allowed calls).
    const dayKeys = Array.from(store.keys()).filter((k) => k.includes(":d:"));
    expect(dayKeys).toHaveLength(1);
    const dayEntry = store.get(dayKeys[0]!);
    expect(dayEntry?.value).toBe("2");
  });

  it("blocks when the daily limit is reached", async () => {
    const info = makeKeyInfo({
      rateLimit: { requestsPerHour: 100, requestsPerDay: 1 },
    });

    const r1 = await checkRateLimit(kv, info);
    const r2 = await checkRateLimit(kv, info);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(false);

    if (!r2.allowed) {
      expect(r2.error.message).toContain("Daily");
      expect(r2.status.dayRemaining).toBe(0);
      expect(r2.retryAfterSec).toBe(r2.status.dayResetSec);
    }
  });

  it("writes counters with the correct TTLs", async () => {
    const info = makeKeyInfo();
    await checkRateLimit(kv, info);

    const hourEntry = Array.from(store.entries()).find(([k]) => k.includes(":h:"));
    const dayEntry = Array.from(store.entries()).find(([k]) => k.includes(":d:"));
    expect(hourEntry).toBeDefined();
    expect(dayEntry).toBeDefined();

    const hourTtlMs = hourEntry![1].expiresAt! - Date.now();
    const dayTtlMs = dayEntry![1].expiresAt! - Date.now();
    // TTLs are 1h / 24h. Allow a generous window for test execution jitter.
    expect(hourTtlMs).toBeGreaterThan(3590 * 1000);
    expect(hourTtlMs).toBeLessThanOrEqual(3600 * 1000);
    expect(dayTtlMs).toBeGreaterThan(86390 * 1000);
    expect(dayTtlMs).toBeLessThanOrEqual(86400 * 1000);
  });

  it("isolates counters between different API keys", async () => {
    const a = makeKeyInfo({ key: "hummbl_aaaaaaaaaa" });
    const b = makeKeyInfo({ key: "hummbl_bbbbbbbbbb" });

    await checkRateLimit(kv, a);
    await checkRateLimit(kv, a);
    const bResult = await checkRateLimit(kv, b);

    expect(bResult.allowed).toBe(true);
    expect(bResult.status.hourRemaining).toBe(2); // key b is at 1 of 3
  });
});
