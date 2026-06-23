import { describe, it, expect } from "vitest";
import { D1Client, DuplicateRelationshipError } from "../storage/d1-client.js";
import type { RelationshipRecordInput } from "../types/relationships.js";
import type { D1Database } from "@cloudflare/workers-types";

type StatementResult = {
  success: boolean;
  error?: string;
  meta: { changes: number };
};

type AllResult = {
  success: boolean;
  error?: string;
  results?: unknown[];
};

type RunHandler = (sql: string, params: unknown[]) => Promise<StatementResult> | StatementResult;

type AllHandler = (sql: string, params: unknown[]) => Promise<AllResult> | AllResult;

type FirstHandler = (sql: string, params: unknown[]) => Promise<unknown> | unknown;

const createMockDb = (handlers?: {
  onRun?: RunHandler;
  onAll?: AllHandler;
  onFirst?: FirstHandler;
}): D1Database => {
  const onRun = handlers?.onRun;
  const onAll = handlers?.onAll;
  const onFirst = handlers?.onFirst;

  return {
    prepare(sql: string) {
      let bound: unknown[] = [];
      const statement = {
        bind(...params: unknown[]) {
          bound = params;
          return statement;
        },
        async run() {
          if (onRun) {
            return await onRun(sql, bound);
          }
          return { success: true, meta: { changes: 1 } };
        },
        async all() {
          if (onAll) {
            return await onAll(sql, bound);
          }
          return { success: true, results: [] };
        },
        async first() {
          if (onFirst) {
            return await onFirst(sql, bound);
          }
          return null;
        },
      };
      return statement;
    },
  } as D1Database;
};

describe("D1Client relationships", () => {
  it("creates a relationship and maps literature support", async () => {
    const row = {
      id: "REL-1",
      model_a: "P1",
      model_b: "P2",
      relationship_type: "enables",
      direction: "a→b",
      confidence: "H",
      logical_derivation: "logic",
      has_literature_support: 1,
      literature_citation: "citation",
      literature_url: "https://example.com",
      empirical_observation: null,
      validated_by: "tester",
      validated_at: "2026-02-02T00:00:00Z",
      review_status: "draft",
      notes: null,
      created_at: "2026-02-02T00:00:00Z",
      updated_at: null,
    };

    const db = createMockDb({
      onRun: (sql) => {
        if (sql.includes("INSERT INTO relationships")) {
          return { success: true, meta: { changes: 1 } };
        }
        throw new Error("Unexpected SQL");
      },
      onFirst: () => row,
    });

    const client = new D1Client(db);
    const input: RelationshipRecordInput = {
      id: "REL-1",
      model_a: "P1",
      model_b: "P2",
      relationship_type: "enables",
      direction: "a→b",
      confidence: "A",
      logical_derivation: "logic",
      literature_support: {
        has_support: true,
        citation: "citation",
        url: "https://example.com",
      },
      validated_by: "tester",
      validated_at: "2026-02-02T00:00:00Z",
      review_status: "draft",
    };

    const result = await client.createRelationship(input);
    expect(result.id).toBe("REL-1");
    expect(result.literature_support).toEqual({
      has_support: true,
      citation: "citation",
      url: "https://example.com",
    });
    expect(result.empirical_observation).toBeUndefined();
    expect(result.updated_at).toBeUndefined();
  });

  it("throws DuplicateRelationshipError on unique constraint violation", async () => {
    const db = createMockDb({
      onRun: () => {
        throw new Error("UNIQUE constraint failed: relationships.model_a, relationships.model_b");
      },
    });

    const client = new D1Client(db);
    const input: RelationshipRecordInput = {
      id: "REL-2",
      model_a: "P1",
      model_b: "P2",
      relationship_type: "enables",
      direction: "a→b",
      confidence: "A",
      logical_derivation: "logic",
      validated_by: "tester",
      validated_at: "2026-02-02T00:00:00Z",
      review_status: "draft",
    };

    await expect(client.createRelationship(input)).rejects.toBeInstanceOf(
      DuplicateRelationshipError
    );
  });

  it("rejects update with no valid fields", async () => {
    const client = new D1Client(createMockDb());
    await expect(client.updateRelationship("REL-3", {})).rejects.toThrow(
      "No valid updates provided"
    );
  });

  it("updates relationship and returns the refreshed record", async () => {
    const row = {
      id: "REL-4",
      model_a: "P1",
      model_b: "P2",
      relationship_type: "enables",
      direction: "a→b",
      confidence: "H",
      logical_derivation: "logic",
      has_literature_support: 0,
      literature_citation: null,
      literature_url: null,
      empirical_observation: "observed",
      validated_by: "tester",
      validated_at: "2026-02-02T00:00:00Z",
      review_status: "reviewed",
      notes: "updated",
      created_at: "2026-02-02T00:00:00Z",
      updated_at: "2026-02-02T01:00:00Z",
    };

    let lastRun: { sql: string; params: unknown[] } | null = null;

    const db = createMockDb({
      onRun: (sql, params) => {
        lastRun = { sql, params };
        return { success: true, meta: { changes: 1 } };
      },
      onAll: () => ({ success: true, results: [row] }),
    });

    const client = new D1Client(db);
    const result = await client.updateRelationship("REL-4", {
      review_status: "reviewed",
      notes: "updated",
      literature_support: {
        has_support: false,
      },
      empirical_observation: "observed",
    });

    expect(result.review_status).toBe("reviewed");
    expect(result.notes).toBe("updated");
    expect(result.literature_support).toBeUndefined();
    expect(lastRun).toBeTruthy();
    expect(lastRun!.sql).toContain("UPDATE relationships");
  });
});

describe("D1Client recommendations", () => {
  it("insertRecommendation persists JSON-encoded model codes with correct column order", async () => {
    let insertSql: string | undefined;
    let insertParams: unknown[] | undefined;

    const db = createMockDb({
      onRun: (sql, params) => {
        if (sql.includes("INSERT INTO recommendations")) {
          insertSql = sql;
          insertParams = params;
        }
        return { success: true, meta: { changes: 1 } };
      },
    });

    const client = new D1Client(db);
    await client.insertRecommendation({
      id: "rec-1",
      apiKeyId: "key-xyz",
      problem: "how do we scale the nightly job?",
      modelCodes: ["P1", "IN3", "CO7"],
      topPattern: "scaling pains",
    });

    expect(insertSql).toBeDefined();
    expect(insertParams).toEqual([
      "rec-1",
      "key-xyz",
      "how do we scale the nightly job?",
      JSON.stringify(["P1", "IN3", "CO7"]),
      "scaling pains",
    ]);
  });

  it("insertRecommendation stores NULL top_pattern when omitted", async () => {
    let capturedParams: unknown[] | undefined;
    const db = createMockDb({
      onRun: (sql, params) => {
        if (sql.includes("INSERT INTO recommendations")) {
          capturedParams = params;
        }
        return { success: true, meta: { changes: 1 } };
      },
    });
    const client = new D1Client(db);
    await client.insertRecommendation({
      id: "r",
      apiKeyId: "k",
      problem: "p",
      modelCodes: ["P1"],
    });
    expect(capturedParams![4]).toBeNull();
  });

  it("getRecommendationHistory parses model_codes JSON back into string arrays", async () => {
    const db = createMockDb({
      onAll: (sql) => {
        if (!sql.includes("FROM recommendations")) {
          return { success: true, results: [] };
        }
        return {
          success: true,
          results: [
            {
              id: "r1",
              problem: "first problem",
              model_codes: JSON.stringify(["P1", "P2"]),
              top_pattern: "pattern-A",
              created_at: "2026-04-05T10:00:00Z",
            },
            {
              id: "r2",
              problem: "second problem",
              model_codes: JSON.stringify(["CO1"]),
              top_pattern: null,
              created_at: "2026-04-05T09:00:00Z",
            },
          ],
        };
      },
    });
    const client = new D1Client(db);
    const rows = await client.getRecommendationHistory("api-key-id");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      id: "r1",
      problem: "first problem",
      modelCodes: ["P1", "P2"],
      topPattern: "pattern-A",
      createdAt: "2026-04-05T10:00:00Z",
    });
    expect(rows[1]!.modelCodes).toEqual(["CO1"]);
    expect(rows[1]!.topPattern).toBeNull();
  });

  it("getRecommendationHistory recovers with an empty array when model_codes JSON is malformed", async () => {
    const db = createMockDb({
      onAll: () => ({
        success: true,
        results: [
          {
            id: "r1",
            problem: "p",
            model_codes: "not-valid-json!!!",
            top_pattern: null,
            created_at: "2026-04-05T10:00:00Z",
          },
          {
            id: "r2",
            problem: "p2",
            model_codes: JSON.stringify({ not: "an array" }),
            top_pattern: null,
            created_at: "2026-04-05T09:00:00Z",
          },
        ],
      }),
    });
    const client = new D1Client(db);
    const rows = await client.getRecommendationHistory("api-key-id");

    expect(rows).toHaveLength(2);
    expect(rows[0]!.modelCodes).toEqual([]);
    expect(rows[1]!.modelCodes).toEqual([]);
  });

  it("getRecommendationHistory passes limit and offset to the SQL", async () => {
    let capturedParams: unknown[] | undefined;
    const db = createMockDb({
      onAll: (sql, params) => {
        if (sql.includes("FROM recommendations")) {
          capturedParams = params;
        }
        return { success: true, results: [] };
      },
    });
    const client = new D1Client(db);
    await client.getRecommendationHistory("key-a", 5, 10);
    expect(capturedParams).toEqual(["key-a", 5, 10]);
  });
});
