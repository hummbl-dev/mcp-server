import { describe, it, expect } from "vitest";
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
  } as unknown as KVNamespace;
  return { kv, store };
}

type RecRow = {
  id: string;
  problem: string;
  model_codes: string;
  top_pattern: string | null;
  created_at: string;
};

function createMockD1(seeded: RecRow[], inserts: RecRow[]) {
  const db = {
    prepare(sql: string): D1PreparedStatement {
      let bound: unknown[] = [];
      const stmt = {
        bind(...params: unknown[]) {
          bound = params;
          return stmt;
        },
        async run() {
          if (sql.includes("INSERT INTO recommendations")) {
            inserts.push({
              id: bound[0] as string,
              problem: bound[2] as string,
              model_codes: bound[3] as string,
              top_pattern: (bound[4] as string | null) ?? null,
              created_at: new Date().toISOString(),
            });
            return { success: true, meta: { changes: 1 }, results: [] };
          }
          return { success: true, meta: { changes: 0 }, results: [] };
        },
        async all() {
          if (sql.includes("FROM recommendations")) {
            const apiKeyId = bound[0] as string;
            const limit = (bound[1] as number) ?? 20;
            const offset = (bound[2] as number) ?? 0;
            const matching = seeded
              .filter(() => apiKeyId === "key-1")
              .slice(offset, offset + limit);
            return { success: true, results: matching, meta: { changes: 0 } };
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

function keyInfo(): ApiKeyInfo {
  return {
    id: "key-1",
    key: "hummbl_testkey0000000001",
    tier: "pro",
    name: "test",
    createdAt: new Date().toISOString(),
    usageCount: 0,
    rateLimit: { requestsPerHour: 100, requestsPerDay: 1000 },
    permissions: ["read:recommend"],
    isActive: true,
  };
}

function buildEnv(seeded: RecRow[], inserts: RecRow[]) {
  const k = keyInfo();
  const apiKeys = createMockKV();
  const sessions = createMockKV();
  apiKeys.store.set(k.key, { value: JSON.stringify(k), expiresAt: null });
  return {
    DB: createMockD1(seeded, inserts),
    API_KEYS: apiKeys.kv,
    SESSIONS: sessions.kv,
  };
}

describe("GET /v1/recommendations", () => {
  it("returns the caller's persisted recommendations newest-first", async () => {
    const seeded: RecRow[] = [
      {
        id: "r-new",
        problem: "newer problem",
        model_codes: JSON.stringify(["P1", "P2"]),
        top_pattern: "alpha",
        created_at: "2026-04-05T10:00:00Z",
      },
      {
        id: "r-old",
        problem: "older problem",
        model_codes: JSON.stringify(["CO1"]),
        top_pattern: null,
        created_at: "2026-04-05T08:00:00Z",
      },
    ];

    const res = await app.request(
      "http://localhost/v1/recommendations",
      { headers: { Authorization: `Bearer ${keyInfo().key}` } },
      buildEnv(seeded, [])
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      limit: number;
      offset: number;
      recommendations: Array<{
        id: string;
        problem: string;
        model_codes: string[];
        top_pattern: string | null;
      }>;
    };
    expect(body.count).toBe(2);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
    expect(body.recommendations[0]).toMatchObject({
      id: "r-new",
      problem: "newer problem",
      model_codes: ["P1", "P2"],
      top_pattern: "alpha",
    });
    expect(body.recommendations[1]!.model_codes).toEqual(["CO1"]);
  });

  it("honors limit and offset query parameters", async () => {
    const seeded: RecRow[] = Array.from({ length: 5 }, (_, i) => ({
      id: `r-${i}`,
      problem: `p${i}`,
      model_codes: JSON.stringify(["P1"]),
      top_pattern: null,
      created_at: `2026-04-05T1${i}:00:00Z`,
    }));

    const res = await app.request(
      "http://localhost/v1/recommendations?limit=2&offset=1",
      { headers: { Authorization: `Bearer ${keyInfo().key}` } },
      buildEnv(seeded, [])
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      count: number;
      limit: number;
      offset: number;
      recommendations: unknown[];
    };
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(1);
    expect(body.count).toBe(2);
    expect(body.recommendations).toHaveLength(2);
  });

  it("clamps limit to the maximum of 100", async () => {
    const res = await app.request(
      "http://localhost/v1/recommendations?limit=9999",
      { headers: { Authorization: `Bearer ${keyInfo().key}` } },
      buildEnv([], [])
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { limit: number };
    expect(body.limit).toBe(100);
  });

  it("returns 401 without authorization", async () => {
    const res = await app.request("http://localhost/v1/recommendations", {}, buildEnv([], []));
    expect(res.status).toBe(401);
  });
});

describe("POST /v1/recommend persists the recommendation", () => {
  it("writes one row containing the unique model codes and the top pattern", async () => {
    const inserts: RecRow[] = [];
    const env = buildEnv([], inserts);

    const res = await app.request(
      "http://localhost/v1/recommend",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${keyInfo().key}`,
        },
        body: JSON.stringify({ problem: "our onboarding funnel is leaking users" }),
      },
      env
    );

    expect(res.status).toBe(200);

    // Fire-and-forget persistence — yield to the microtask queue so the
    // insertRecommendation promise resolves against our mock.
    await new Promise((r) => setTimeout(r, 10));

    expect(inserts).toHaveLength(1);
    const row = inserts[0]!;
    expect(row.problem).toBe("our onboarding funnel is leaking users");
    const codes = JSON.parse(row.model_codes) as string[];
    expect(Array.isArray(codes)).toBe(true);
    // Codes deduped (no repeats in the persisted array).
    expect(codes.length).toBe(new Set(codes).size);
    expect(codes.length).toBeGreaterThan(0);
    // top_pattern is either a string or null, never undefined.
    expect(row.top_pattern === null || typeof row.top_pattern === "string").toBe(true);
  });

  it("still returns 200 when insertRecommendation rejects (fire-and-forget)", async () => {
    // D1 mock that throws whenever INSERT INTO recommendations is run.
    const throwingDb = {
      prepare(sql: string): D1PreparedStatement {
        const stmt = {
          bind() {
            return stmt;
          },
          async run() {
            if (sql.includes("INSERT INTO recommendations")) {
              throw new Error("D1 write simulated failure");
            }
            return { success: true, meta: { changes: 0 }, results: [] };
          },
          async all() {
            return { success: true, results: [], meta: { changes: 0 } };
          },
          async first() {
            return null;
          },
        };
        return stmt as unknown as D1PreparedStatement;
      },
    } as unknown as D1Database;

    const apiKeys = createMockKV();
    const sessions = createMockKV();
    const k = keyInfo();
    apiKeys.store.set(k.key, { value: JSON.stringify(k), expiresAt: null });

    const res = await app.request(
      "http://localhost/v1/recommend",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${k.key}`,
        },
        body: JSON.stringify({
          problem: "persistence is failing but the response must survive",
        }),
      },
      { DB: throwingDb, API_KEYS: apiKeys.kv, SESSIONS: sessions.kv }
    );

    // The recommend response must not be broken by a persistence failure.
    expect(res.status).toBe(200);
    const body = (await res.json()) as { recommendationCount: number };
    expect(body.recommendationCount).toBeGreaterThan(0);

    // Let the fire-and-forget .catch() resolve.
    await new Promise((r) => setTimeout(r, 10));
  });
});

describe("GET /v1/recommendations error path", () => {
  it("returns 500 when the D1 read throws", async () => {
    const throwingDb = {
      prepare(sql: string): D1PreparedStatement {
        const stmt = {
          bind() {
            return stmt;
          },
          async run() {
            return { success: true, meta: { changes: 0 }, results: [] };
          },
          async all() {
            if (sql.includes("FROM recommendations")) {
              throw new Error("D1 read simulated failure");
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

    const apiKeys = createMockKV();
    const sessions = createMockKV();
    const k = keyInfo();
    apiKeys.store.set(k.key, { value: JSON.stringify(k), expiresAt: null });

    const res = await app.request(
      "http://localhost/v1/recommendations",
      { headers: { Authorization: `Bearer ${k.key}` } },
      { DB: throwingDb, API_KEYS: apiKeys.kv, SESSIONS: sessions.kv }
    );

    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Failed to load recommendation history");
  });
});
