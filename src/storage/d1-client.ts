/**
 * Cloudflare D1 client wrapper for MCP server persistent storage
 * Ported from Phase 1C implementation with relationship persistence upgrades
 */

import type { D1Database } from "@cloudflare/workers-types";
import type {
  ModelRelationship,
  RelationshipRecordInput,
} from "../types/relationships.js";

export class DuplicateRelationshipError extends Error {
  constructor() {
    super("duplicate_relationship");
    this.name = "DuplicateRelationshipError";
  }
}

const RELATIONSHIP_COLUMNS = `
    id,
    model_a,
    model_b,
    relationship_type,
    direction,
    confidence,
    logical_derivation,
    has_literature_support,
    literature_citation,
    literature_url,
    empirical_observation,
    validated_by,
    validated_at,
    review_status,
    notes,
    created_at,
    updated_at
  `;

type DbRelationshipRow = {
  id: string;
  model_a: string;
  model_b: string;
  relationship_type: string;
  direction: string;
  confidence: string;
  logical_derivation: string;
  has_literature_support: number | null;
  literature_citation: string | null;
  literature_url: string | null;
  empirical_observation: string | null;
  validated_by: string;
  validated_at: string;
  review_status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /** Execute a statement that mutates rows */
  async execute(sql: string, ...params: unknown[]): Promise<number> {
    try {
      const result = await this.db.prepare(sql).bind(...params).run();
      if (!result.success) {
        throw new Error(result.error || "D1 execution failed");
      }
      return result.meta.changes;
    } catch (error) {
      console.error("D1 EXECUTE failed", { sql, params, error });
      throw error;
    }
  }

  /** Query for multiple rows */
  async query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    try {
      const result = await this.db.prepare(sql).bind(...params).all();
      if (!result.success) {
        throw new Error(result.error || "D1 query failed");
      }
      return (result.results || []) as T[];
    } catch (error) {
      console.error("D1 QUERY failed", { sql, params, error });
      throw error;
    }
  }

  /** Query for a single row */
  async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    try {
      const result = await this.db.prepare(sql).bind(...params).first();
      return (result as T) || null;
    } catch (error) {
      console.error("D1 QUERY_ONE failed", { sql, params, error });
      throw error;
    }
  }

  /** Execute statements in a batch */
  async transaction(queries: Array<{ sql: string; params: unknown[] }>): Promise<boolean> {
    try {
      const statements = queries.map((q) => this.db.prepare(q.sql).bind(...q.params));
      await this.db.batch(statements);
      return true;
    } catch (error) {
      console.error("D1 TRANSACTION failed", { queries, error });
      return false;
    }
  }

  /** Run basic migrations (sessions/messages/models tables) */
  async runMigrations(): Promise<void> {
    const migrations = [
      `CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_active TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        domain_state TEXT,
        total_messages INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL NOT NULL DEFAULT 0,
        metadata TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS messages (
        message_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT,
        tool_call_id TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )`,
      `CREATE TABLE IF NOT EXISTS mental_models (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        transformation TEXT NOT NULL,
        definition TEXT NOT NULL,
        example TEXT NOT NULL,
        when_to_use TEXT NOT NULL,
        how_to_apply TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        version INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS relationships (
        id TEXT PRIMARY KEY,
        model_a TEXT NOT NULL,
        model_b TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        direction TEXT NOT NULL,
        confidence TEXT NOT NULL DEFAULT 'U',
        logical_derivation TEXT NOT NULL,
        has_literature_support INTEGER DEFAULT 0,
        literature_citation TEXT,
        literature_url TEXT,
        empirical_observation TEXT,
        validated_by TEXT NOT NULL,
        validated_at TEXT NOT NULL,
        review_status TEXT NOT NULL DEFAULT 'draft',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (model_a) REFERENCES mental_models(code),
        FOREIGN KEY (model_b) REFERENCES mental_models(code)
      )`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_model_a ON relationships(model_a)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_model_b ON relationships(model_b)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_confidence ON relationships(confidence)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_status ON relationships(review_status)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_logical ON relationships(model_a, model_b, relationship_type, direction)`,
    ];

    for (const migration of migrations) {
      await this.execute(migration);
    }

    await this.migrateLegacyRelationships();
  }

  private async migrateLegacyRelationships(): Promise<void> {
    try {
      const tableExists = await this.queryOne<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='model_relationships'"
      );
      if (!tableExists) {
        return;
      }

      const legacyCount = await this.queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM model_relationships"
      );
      if (!legacyCount || legacyCount.count === 0) {
        return;
      }

      const insertSql = `
        INSERT INTO relationships (
          id,
          model_a,
          model_b,
          relationship_type,
          direction,
          confidence,
          logical_derivation,
          has_literature_support,
          literature_citation,
          literature_url,
          empirical_observation,
          validated_by,
          validated_at,
          review_status,
          notes
        )
        SELECT
          printf('RMIG-%06d', id),
          source_code,
          target_code,
          relationship_type,
          'a→b',
          confidence,
          COALESCE(evidence, 'legacy import'),
          0,
          NULL,
          NULL,
          NULL,
          'legacy-import',
          COALESCE(created_at, CURRENT_TIMESTAMP),
          'draft',
          NULL
        FROM model_relationships mr
        WHERE NOT EXISTS (
          SELECT 1
          FROM relationships r
          WHERE r.model_a = mr.source_code
            AND r.model_b = mr.target_code
            AND r.relationship_type = mr.relationship_type
            AND r.direction = 'a→b'
        )
      `;

      await this.execute(insertSql);
    } catch (error) {
      console.error("Failed to migrate legacy relationships", error);
    }
  }


  /** Retrieve enriched mental model from DB */
  async getMentalModel(code: string) {
    const sql = `
      SELECT code, name, transformation, definition, example, when_to_use, how_to_apply
      FROM mental_models
      WHERE code = ?
    `;
    const result = await this.queryOne<{
      code: string;
      name: string;
      transformation: string;
      definition: string;
      example: string;
      when_to_use: string;
      how_to_apply: string;
    }>(sql, code);

    if (!result) {
      return { ok: false as const, error: { type: "NOT_FOUND", message: `Model ${code} not found in database` } };
    }

    return { ok: true as const, value: result };
  }

  /** Relationships touching a given model */
  async getRelationshipsForModel(code: string): Promise<ModelRelationship[]> {
    const sql = `
      SELECT ${RELATIONSHIP_COLUMNS}
      FROM relationships
      WHERE model_a = ? OR model_b = ?
      ORDER BY validated_at DESC, created_at DESC
    `;
    const rows = await this.query<DbRelationshipRow>(sql, code, code);
    return rows.map(mapRowToRelationship);
  }

  /** List relationships with optional filters */
  async getRelationships(filters?: {
    model?: string;
    type?: string;
    confidence?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModelRelationship[]> {
    let whereClause = "WHERE 1=1";
    const params: unknown[] = [];

    if (filters?.model) {
      whereClause += " AND (model_a = ? OR model_b = ?)";
      params.push(filters.model, filters.model);
    }

    if (filters?.type) {
      whereClause += " AND relationship_type = ?";
      params.push(filters.type);
    }

    if (filters?.confidence) {
      whereClause += " AND confidence = ?";
      params.push(filters.confidence);
    }

    if (filters?.status) {
      whereClause += " AND review_status = ?";
      params.push(filters.status);
    }

    const limit = filters?.limit ?? 50;
    const offset = filters?.offset ?? 0;

    const sql = `
      SELECT ${RELATIONSHIP_COLUMNS}
      FROM relationships
      ${whereClause}
      ORDER BY validated_at DESC, created_at DESC
      LIMIT ? OFFSET ?
    `;

    const rows = await this.query<DbRelationshipRow>(sql, ...params, limit, offset);
    return rows.map(mapRowToRelationship);
  }

  /** Fetch a single relationship */
  async getRelationship(id: string): Promise<ModelRelationship | null> {
    const sql = `
      SELECT ${RELATIONSHIP_COLUMNS}
      FROM relationships
      WHERE id = ?
    `;
    const row = await this.queryOne<DbRelationshipRow>(sql, id);
    return row ? mapRowToRelationship(row) : null;
  }

  async getRelationshipsForModelWithFilters(code: string): Promise<ModelRelationship[]> {
    return this.getRelationships({ model: code });
  }

  /** Persist a new relationship record */
  async createRelationship(input: RelationshipRecordInput): Promise<ModelRelationship> {
    const sql = `
      INSERT INTO relationships (
        id,
        model_a,
        model_b,
        relationship_type,
        direction,
        confidence,
        logical_derivation,
        has_literature_support,
        literature_citation,
        literature_url,
        empirical_observation,
        validated_by,
        validated_at,
        review_status,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    try {
      await this.execute(
        sql,
        input.id,
        input.model_a,
        input.model_b,
        input.relationship_type,
        input.direction,
        input.confidence,
        input.logical_derivation,
        input.has_literature_support ? 1 : 0,
        input.literature_citation ?? null,
        input.literature_url ?? null,
        input.empirical_observation ?? null,
        input.validated_by,
        input.validated_at,
        input.review_status,
        input.notes ?? null
      );
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        throw new DuplicateRelationshipError();
      }
      throw error;
    }

    const row = await this.queryOne<DbRelationshipRow>(
      `SELECT ${RELATIONSHIP_COLUMNS} FROM relationships WHERE id = ?`,
      input.id
    );
    if (!row) {
      throw new Error("Relationship not found after insert");
    }
    return mapRowToRelationship(row);
  }

  /** Update existing relationship fields */
  async updateRelationship(id: string, updates: Partial<ModelRelationship>): Promise<ModelRelationship> {
    const setParts: string[] = [];
    const params: unknown[] = [];

    if (updates.relationship_type) {
      setParts.push("relationship_type = ?");
      params.push(updates.relationship_type);
    }
    if (updates.direction) {
      setParts.push("direction = ?");
      params.push(updates.direction);
    }
    if (updates.confidence) {
      setParts.push("confidence = ?");
      params.push(updates.confidence);
    }
    if (updates.logical_derivation) {
      setParts.push("logical_derivation = ?");
      params.push(updates.logical_derivation);
    }
    if (updates.literature_support) {
      setParts.push("has_literature_support = ?");
      params.push(updates.literature_support.has_support ? 1 : 0);
      setParts.push("literature_citation = ?");
      params.push(updates.literature_support.citation ?? null);
      setParts.push("literature_url = ?");
      params.push(updates.literature_support.url ?? null);
    }
    if (updates.empirical_observation !== undefined) {
      setParts.push("empirical_observation = ?");
      params.push(updates.empirical_observation ?? null);
    }
    if (updates.review_status) {
      setParts.push("review_status = ?");
      params.push(updates.review_status);
    }
    if (updates.notes !== undefined) {
      setParts.push("notes = ?");
      params.push(updates.notes ?? null);
    }

    if (setParts.length === 0) {
      throw new Error("No valid updates provided");
    }

    setParts.push("updated_at = CURRENT_TIMESTAMP");
    params.push(id);

    const sql = `UPDATE relationships SET ${setParts.join(", ")} WHERE id = ?`;
    await this.execute(sql, ...params);

    const relationship = await this.getRelationship(id);
    if (!relationship) {
      throw new Error("Relationship not found after update");
    }
    return relationship;
  }

  async deleteRelationship(id: string): Promise<boolean> {
    const deleted = await this.execute(`DELETE FROM relationships WHERE id = ?`, id);
    return deleted > 0;
  }
}

function mapRowToRelationship(row: DbRelationshipRow): ModelRelationship {
  const literature_support = buildLiteratureSupport(row);

  return {
    id: row.id,
    model_a: row.model_a,
    model_b: row.model_b,
    relationship_type: row.relationship_type as ModelRelationship["relationship_type"],
    direction: row.direction as ModelRelationship["direction"],
    confidence: row.confidence as ModelRelationship["confidence"],
    logical_derivation: row.logical_derivation,
    literature_support,
    empirical_observation: row.empirical_observation || undefined,
    validated_by: row.validated_by,
    validated_at: row.validated_at,
    review_status: row.review_status as ModelRelationship["review_status"],
    notes: row.notes || undefined,
    created_at: row.created_at || undefined,
    updated_at: row.updated_at || undefined,
  };
}

const buildLiteratureSupport = (
  row: DbRelationshipRow
): ModelRelationship["literature_support"] => {
  const hasSupport = Boolean(row.has_literature_support);

  if (!hasSupport && !row.literature_citation && !row.literature_url) {
    return undefined;
  }

  return {
    has_support: hasSupport,
    citation: row.literature_citation || undefined,
    url: row.literature_url || undefined,
  };
};

const isUniqueConstraintError = (error: unknown): boolean =>
  error instanceof Error && error.message.includes("UNIQUE constraint failed: relationships");

/** Create a D1Client instance */
export function createD1Client(db: D1Database): D1Client {
  return new D1Client(db);
}
