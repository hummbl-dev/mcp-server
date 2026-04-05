/**
 * Lightweight BM25 ranking for HUMMBL problem patterns.
 *
 * BM25 (Best Matching 25) is a probabilistic information-retrieval
 * scoring function that ranks documents by term-frequency, inverse
 * document-frequency, and document-length normalisation. It replaced
 * the previous keyword-containment filter in recommend_models and
 * search_problem_patterns, giving users ranked results with a numeric
 * relevance score.
 *
 * The implementation is intentionally minimal (~100 LOC) with no
 * external dependencies, deterministic, and fast enough to run on
 * every request without caching.
 */

const STOPWORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "but",
  "by",
  "do",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "his",
  "how",
  "i",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "my",
  "no",
  "not",
  "of",
  "on",
  "or",
  "our",
  "she",
  "so",
  "that",
  "the",
  "their",
  "them",
  "then",
  "there",
  "these",
  "they",
  "this",
  "to",
  "too",
  "us",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "will",
  "with",
  "you",
  "your",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

/**
 * A pre-built BM25 index over a fixed set of string documents.
 * Immutable after construction — safe to cache at module level.
 */
export class BM25Index {
  /** k1: term-frequency saturation. Standard default. */
  private readonly k1 = 1.5;
  /** b: document-length normalisation weight. Standard default. */
  private readonly b = 0.75;

  private readonly docs: string[][];
  private readonly avgDl: number;
  private readonly idf: Map<string, number>;

  constructor(documents: string[]) {
    this.docs = documents.map(tokenize);
    const totalLen = this.docs.reduce((sum, d) => sum + d.length, 0);
    this.avgDl = this.docs.length > 0 ? totalLen / this.docs.length : 1;
    this.idf = this.computeIdf();
  }

  private computeIdf(): Map<string, number> {
    const n = this.docs.length;
    const df = new Map<string, number>();
    for (const doc of this.docs) {
      const seen = new Set<string>();
      for (const term of doc) {
        if (!seen.has(term)) {
          df.set(term, (df.get(term) ?? 0) + 1);
          seen.add(term);
        }
      }
    }
    const idf = new Map<string, number>();
    for (const [term, freq] of df) {
      // Standard BM25 IDF with +0.5 smoothing to avoid negatives.
      idf.set(term, Math.log((n - freq + 0.5) / (freq + 0.5) + 1));
    }
    return idf;
  }

  /**
   * Score a query against every document in the index.
   * Returns an array of `{ index, score }` sorted by score descending.
   * Scores are always ≥ 0; a score of 0 means no query terms matched.
   */
  score(query: string): Array<{ index: number; score: number }> {
    const queryTerms = tokenize(query);
    const results: Array<{ index: number; score: number }> = [];

    for (let i = 0; i < this.docs.length; i++) {
      const doc = this.docs[i]!;
      const dl = doc.length;
      let score = 0;

      // Term-frequency map for this document.
      const tf = new Map<string, number>();
      for (const term of doc) {
        tf.set(term, (tf.get(term) ?? 0) + 1);
      }

      for (const term of queryTerms) {
        const termFreq = tf.get(term) ?? 0;
        if (termFreq === 0) continue;
        const idfVal = this.idf.get(term) ?? 0;
        const numerator = termFreq * (this.k1 + 1);
        const denominator = termFreq + this.k1 * (1 - this.b + this.b * (dl / this.avgDl));
        score += idfVal * (numerator / denominator);
      }

      results.push({ index: i, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results;
  }
}
