import { describe, it, expect, beforeEach } from "vitest";
import { BM25Index } from "../framework/bm25.js";
import { PROBLEM_PATTERNS, PATTERN_BM25_INDEX } from "../framework/base120.js";
import { createMockServer } from "./setup.js";
import { registerModelTools } from "../tools/models.js";

describe("BM25Index", () => {
  const docs = [
    "the quick brown fox jumps over the lazy dog",
    "a fast red car drives down the highway",
    "machine learning models for natural language processing",
    "cooking recipes for pasta and italian food",
  ];
  let index: BM25Index;

  beforeEach(() => {
    index = new BM25Index(docs);
  });

  it("ranks documents containing query terms higher than those without", () => {
    const results = index.score("quick brown fox");
    expect(results[0]!.index).toBe(0); // doc 0 has all 3 terms
    expect(results[0]!.score).toBeGreaterThan(0);
  });

  it("returns score 0 for documents with no matching terms", () => {
    const results = index.score("quantum physics");
    for (const r of results) {
      expect(r.score).toBe(0);
    }
  });

  it("is deterministic across repeated calls", () => {
    const r1 = index.score("machine learning");
    const r2 = index.score("machine learning");
    expect(r1).toEqual(r2);
  });

  it("returns scores in non-increasing order", () => {
    const results = index.score("fast car highway");
    for (let i = 1; i < results.length; i++) {
      expect(results[i]!.score).toBeLessThanOrEqual(results[i - 1]!.score);
    }
  });

  it("self-match: each document scores highest when queried with its own text", () => {
    for (let i = 0; i < docs.length; i++) {
      const results = index.score(docs[i]!);
      expect(results[0]!.index).toBe(i);
      expect(results[0]!.score).toBeGreaterThan(0);
    }
  });

  it("handles an empty query gracefully (all scores 0)", () => {
    const results = index.score("");
    for (const r of results) {
      expect(r.score).toBe(0);
    }
  });

  it("handles single-word queries", () => {
    const results = index.score("pasta");
    expect(results[0]!.index).toBe(3);
    expect(results[0]!.score).toBeGreaterThan(0);
  });
});

describe("PATTERN_BM25_INDEX integration", () => {
  it("contains the same number of documents as PROBLEM_PATTERNS", () => {
    const results = PATTERN_BM25_INDEX.score("test");
    expect(results).toHaveLength(PROBLEM_PATTERNS.length);
  });

  it("ranks 'decision' query with strategic/coordination pattern at top", () => {
    const results = PATTERN_BM25_INDEX.score("strategic decision making");
    const topPattern = PROBLEM_PATTERNS[results[0]!.index];
    expect(topPattern).toBeDefined();
    expect(topPattern!.pattern.toLowerCase()).toContain("strategic");
  });

  it("ranks 'feedback iteration' query with recursion pattern", () => {
    const results = PATTERN_BM25_INDEX.score("feedback iteration loop");
    const topPattern = PROBLEM_PATTERNS[results[0]!.index];
    expect(topPattern).toBeDefined();
    expect(topPattern!.pattern.toLowerCase()).toContain("feedback");
  });
});

describe("search_problem_patterns tool with BM25", () => {
  let mockServer: any;

  beforeEach(() => {
    mockServer = createMockServer();
    registerModelTools(mockServer);
  });

  it("returns patterns ranked by BM25 score with a score field", async () => {
    const tool = mockServer.getTool("search_problem_patterns");
    const result = await tool.handler({ query: "complex system understanding" });

    expect(result.structuredContent.patternCount).toBeGreaterThan(0);
    const patterns = result.structuredContent.patterns;
    // Every result has a score field that's a finite number.
    for (const p of patterns) {
      expect(typeof p.score).toBe("number");
      expect(Number.isFinite(p.score)).toBe(true);
      expect(p.score).toBeGreaterThan(0);
    }
    // Scores are in non-increasing order.
    for (let i = 1; i < patterns.length; i++) {
      expect(patterns[i].score).toBeLessThanOrEqual(patterns[i - 1].score);
    }
  });

  it("returns 0 patterns for a query with no term overlap", async () => {
    const tool = mockServer.getTool("search_problem_patterns");
    const result = await tool.handler({ query: "xyznonexistent123" });
    expect(result.structuredContent.patternCount).toBe(0);
    expect(result.structuredContent.patterns).toEqual([]);
  });
});
