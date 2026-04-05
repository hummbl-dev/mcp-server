import { describe, it, expect, beforeEach } from "vitest";
import app from "../api.js";
import type { ApiKeyInfo } from "../types/domain.js";
import type { D1Database, D1PreparedStatement, KVNamespace } from "@cloudflare/workers-types";

type KvEntry = { value: string; expiresAt: number | null };

function createMockKV() {
  const store = new Map<string, KvEntry>();
  const kv = {
    async get(key: string): Promise<string | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    async put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void> {
      const expiresAt =
        options?.expirationTtl !== undefined ? Date.now() + options.expirationTtl * 1000 : null;
      store.set(key, { value, expiresAt });
    },
    async delete(key: string): Promise<void> {
      store.delete(key);
    },
    async list() {
      return { keys: Array.from(store.keys()).map((name) => ({ name })) };
    },
    async getWithMetadata() {
      return { value: null, metadata: null };
    },
  } as unknown as KVNamespace;
  return { kv, store };
}

/**
 * Minimal D1 mock that supports the SQL shapes used by the relationships
 * route: SELECT by id, DELETE by id. Anything else throws.
 */
function createMockD1(relationships: Record<string, Record<string, unknown>>) {
  const db = {
    prepare(sql: string): D1PreparedStatement {
      let bound: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          bound = params;
          return stmt;
        },
        async run() {
          if (/DELETE FROM relationships/i.test(sql)) {
            const id = bound[0] as string;
            const existed = id in relationships;
            if (existed) delete relationships[id];
            return {
              success: true,
              meta: { changes: existed ? 1 : 0 },
              results: [],
            };
          }
          return { success: true, meta: { changes: 0 }, results: [] };
        },
        async all() {
          if (/FROM relationships\s+WHERE id = \?/i.test(sql)) {
            const id = bound[0] as string;
            const row = relationships[id];
            return {
              success: true,
              results: row ? [row] : [],
              meta: { changes: 0 },
            };
          }
          return { success: true, results: [], meta: { changes: 0 } };
        },
        async first() {
          return null;
        },
      };
      return stmt as unknown as D1PreparedStatement;
    },
  } as unknown as D1Database;
  return db;
}

function adminKeyInfo(key = "hummbl_admintestkey01"): ApiKeyInfo {
  return {
    id: "admin-1",
    key,
    tier: "enterprise",
    name: "admin",
    createdAt: new Date().toISOString(),
    usageCount: 0,
    rateLimit: { requestsPerHour: 10, requestsPerDay: 100 },
    permissions: ["admin:*", "read:models"],
    isActive: true,
  };
}

function freeKeyInfo(key = "hummbl_freetestkey01"): ApiKeyInfo {
  return {
    id: "free-1",
    key,
    tier: "free",
    name: "free-user",
    createdAt: new Date().toISOString(),
    usageCount: 0,
    rateLimit: { requestsPerHour: 2, requestsPerDay: 100 },
    permissions: ["read:models"],
    isActive: true,
  };
}

type Env = { DB: D1Database; API_KEYS: KVNamespace; SESSIONS: KVNamespace };

function buildEnv(
  keys: ApiKeyInfo[],
  relationships: Record<string, Record<string, unknown>> = {}
): Env {
  const apiKeysMock = createMockKV();
  const sessionsMock = createMockKV();
  for (const k of keys) {
    apiKeysMock.store.set(k.key, { value: JSON.stringify(k), expiresAt: null });
  }
  return {
    DB: createMockD1(relationships),
    API_KEYS: apiKeysMock.kv,
    SESSIONS: sessionsMock.kv,
  };
}

describe("authenticate middleware", () => {
  it("returns 401 when no Authorization header is present", async () => {
    const env = buildEnv([]);
    const res = await app.request("http://localhost/v1/models/P1", {}, env);
    expect(res.status).toBe(401);
  });

  it("returns 401 when the key format is invalid", async () => {
    const env = buildEnv([]);
    const res = await app.request(
      "http://localhost/v1/models/P1",
      { headers: { Authorization: "Bearer not-a-hummbl-key" } },
      env
    );
    expect(res.status).toBe(401);
  });

  it("sets X-RateLimit-* headers on successful authenticated requests", async () => {
    const key = adminKeyInfo();
    const env = buildEnv([key]);
    const res = await app.request(
      "http://localhost/v1/models/P1",
      { headers: { Authorization: `Bearer ${key.key}` } },
      env
    );
    // The route may 404 if the model code isn't present, but middleware headers
    // should be attached regardless.
    expect(res.headers.get("X-RateLimit-Limit-Hour")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining-Hour")).toBe("9");
    expect(res.headers.get("X-RateLimit-Limit-Day")).toBe("100");
    expect(res.headers.get("X-RateLimit-Remaining-Day")).toBe("99");
    expect(Number(res.headers.get("X-RateLimit-Reset-Hour"))).toBeGreaterThan(0);
    expect(Number(res.headers.get("X-RateLimit-Reset-Day"))).toBeGreaterThan(0);
  });

  it("returns 429 with Retry-After once the hourly quota is exhausted", async () => {
    const key = freeKeyInfo(); // 2/hour
    const env = buildEnv([key]);
    const auth = { Authorization: `Bearer ${key.key}` };

    const r1 = await app.request("http://localhost/v1/models/P1", { headers: auth }, env);
    const r2 = await app.request("http://localhost/v1/models/P1", { headers: auth }, env);
    const r3 = await app.request("http://localhost/v1/models/P1", { headers: auth }, env);

    // Whatever the route returns for existing keys, the first two must not be 429.
    expect(r1.status).not.toBe(429);
    expect(r2.status).not.toBe(429);
    expect(r3.status).toBe(429);
    expect(r3.headers.get("Retry-After")).not.toBeNull();
    expect(r3.headers.get("X-RateLimit-Remaining-Hour")).toBe("0");

    const body = (await r3.json()) as { error: string };
    expect(body.error).toMatch(/Hourly rate limit/);
  });
});

describe("DELETE /v1/relationships/:id", () => {
  let env: Env;
  let relationships: Record<string, Record<string, unknown>>;

  beforeEach(() => {
    relationships = {
      R100001: {
        id: "R100001",
        model_a: "P1",
        model_b: "IN1",
        relationship_type: "enables",
        direction: "a→b",
        confidence: "A",
        logical_derivation: "test",
        has_literature_support: 0,
        literature_citation: null,
        literature_url: null,
        empirical_observation: null,
        validated_by: "tester",
        validated_at: new Date().toISOString(),
        review_status: "draft",
        notes: null,
        created_at: null,
        updated_at: null,
      },
    };
    env = buildEnv([adminKeyInfo(), freeKeyInfo()], relationships);
  });

  it("returns 403 for non-admin callers", async () => {
    const res = await app.request(
      "http://localhost/v1/relationships/R100001",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${freeKeyInfo().key}` },
      },
      env
    );
    expect(res.status).toBe(403);
    expect(relationships["R100001"]).toBeDefined();
  });

  it("returns 200 and removes the row for admin callers", async () => {
    const res = await app.request(
      "http://localhost/v1/relationships/R100001",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKeyInfo().key}` },
      },
      env
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; id: string };
    expect(body).toEqual({ success: true, id: "R100001" });
    expect(relationships["R100001"]).toBeUndefined();
  });

  it("returns 404 for a missing relationship id", async () => {
    const res = await app.request(
      "http://localhost/v1/relationships/DOES-NOT-EXIST",
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKeyInfo().key}` },
      },
      env
    );
    expect(res.status).toBe(404);
  });
});
