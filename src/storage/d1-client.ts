/**
 * Cloudflare D1 client wrapper for MCP server persistent storage
 * Ported from Python Phase 1C d1_client.py
 */

import type { D1Database } from "@cloudflare/workers-types";
import type {
  SimpleRelationship,
  RelationshipInput,
  SimpleRelationshipResult,
  ModelRelationship,
} from "../types/relationships.js";

/**
 * Error thrown when attempting to create a duplicate relationship
 */
export class DuplicateRelationshipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DuplicateRelationshipError";
  }
}

export class D1Client {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  /**
   * Execute a query and return number of affected rows
   */
  async execute(sql: string, ...params: unknown[]): Promise<number> {
    try {
      const result = await this.db
        .prepare(sql)
        .bind(...params)
        .run();
      if (!result.success) {
        throw new Error(result.error || "D1 execution failed");
      }
      return result.meta.changes;
    } catch (error) {
      console.error("D1 EXECUTE failed", { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute a query and return all results
   */
  async query<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    try {
      const result = await this.db
        .prepare(sql)
        .bind(...params)
        .all();
      if (!result.success) {
        throw new Error(result.error || "D1 query failed");
      }
      return result.results as T[];
    } catch (error) {
      console.error("D1 QUERY failed", { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute a query and return first result
   */
  async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    try {
      const result = await this.db
        .prepare(sql)
        .bind(...params)
        .first();
      return result as T | null;
    } catch (error) {
      console.error("D1 QUERY_ONE failed", { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction(queries: Array<{ sql: string; params: unknown[] }>): Promise<boolean> {
    try {
      const statements = queries.map((q) => this.db.prepare(q.sql).bind(...q.params));

      await this.db.batch(statements);

      // If batch completes without throwing, consider it successful
      return true;
    } catch (error) {
      console.error("D1 TRANSACTION failed", { queries, error });
      return false;
    }
  }

  /**
   * Run database migrations
   */
  async runMigrations(): Promise<void> {
    // In a real implementation, this would read SQL files from migrationDir
    // and execute them in order. For now, we'll implement basic schema setup.

    const migrations = [
      // Sessions table
      `CREATE TABLE IF NOT EXISTS sessions (
        session_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        adapter_type TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_active TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 1,
        domain_state TEXT, -- JSON
        total_messages INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL NOT NULL DEFAULT 0,
        metadata TEXT -- JSON
      )`,

      // Messages table
      `CREATE TABLE IF NOT EXISTS messages (
        message_id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        tool_calls TEXT, -- JSON array
        tool_call_id TEXT,
        timestamp TEXT NOT NULL,
        metadata TEXT, -- JSON
        FOREIGN KEY (session_id) REFERENCES sessions(session_id)
      )`,

      // Base120 mental models table
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

      // Canonical relationships table with direction
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
        FOREIGN KEY (model_b) REFERENCES mental_models(code),
        CHECK (relationship_type IN ('enables', 'reinforces', 'conflicts', 'contains', 'sequences', 'complements')),
        CHECK (direction IN ('a→b', 'b→a', 'bidirectional')),
        CHECK (confidence IN ('A', 'B', 'C', 'U')),
        CHECK (review_status IN ('draft', 'reviewed', 'confirmed', 'disputed'))
      )`,

      // Unique index to prevent duplicates
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_relationships_unique 
       ON relationships(model_a, model_b, relationship_type, direction)`,

      // Legacy model_relationships table (kept for migration)
      `CREATE TABLE IF NOT EXISTS model_relationships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_code TEXT NOT NULL,
        target_code TEXT NOT NULL,
        relationship_type TEXT NOT NULL,
        confidence TEXT NOT NULL CHECK(confidence IN ('A', 'B', 'C')),
        evidence TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (source_code) REFERENCES mental_models(code),
        FOREIGN KEY (target_code) REFERENCES mental_models(code),
        UNIQUE(source_code, target_code, relationship_type)
      )`,

      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(last_active)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_model_a ON relationships(model_a)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_model_b ON relationships(model_b)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_type ON relationships(relationship_type)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_confidence ON relationships(confidence)`,
      `CREATE INDEX IF NOT EXISTS idx_relationships_status ON relationships(review_status)`,
    ];

    for (const migration of migrations) {
      try {
        await this.execute(migration);
        // eslint-disable-next-line no-console
        console.log("Migration executed:", migration.split("\n")[0]);
      } catch (error) {
        console.error("Migration failed:", migration, error);
        throw error;
      }
    }

    // Run legacy data migration
    await this.migrateLegacyRelationships();
  }

  /**
   * Migrate data from legacy model_relationships table to canonical relationships table
   */
  async migrateLegacyRelationships(): Promise<void> {
    try {
      // Check if legacy table has any data
      const legacyCount = await this.queryOne<{ count: number }>(
        `SELECT COUNT(*) as count FROM model_relationships`
      );

      if (!legacyCount || legacyCount.count === 0) {
        console.log("No legacy relationships to migrate");
        return;
      }

      console.log(`Found ${legacyCount.count} legacy relationships to migrate`);

      // Get all legacy relationships
      const legacyRels = await this.query<{
        id: number;
        source_code: string;
        target_code: string;
        relationship_type: string;
        confidence: string;
        evidence: string | null;
        created_at: string;
      }>(`SELECT * FROM model_relationships`);

      let migrated = 0;
      let skipped = 0;

      for (const rel of legacyRels) {
        try {
          // Generate ID for new relationship
          const id = `R${String(rel.id).padStart(3, "0")}`;

          // Insert into canonical relationships table
          // Default direction to 'a→b' for legacy data
          await this.execute(
            `INSERT INTO relationships (
              id, model_a, model_b, relationship_type, direction, confidence,
              logical_derivation, validated_by, validated_at, review_status,
              created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            id,
            rel.source_code,
            rel.target_code,
            rel.relationship_type,
            "a→b",
            rel.confidence,
            rel.evidence || "Migrated from legacy data",
            "system",
            rel.created_at,
            "confirmed",
            rel.created_at,
            rel.created_at
          );

          migrated++;
        } catch (error) {
          // Skip duplicates
          if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
            skipped++;
            console.log(
              `Skipped duplicate relationship: ${rel.source_code} → ${rel.target_code} (${rel.relationship_type})`
            );
          } else {
            throw error;
          }
        }
      }

      console.log(`Migration complete: ${migrated} migrated, ${skipped} skipped`);
    } catch (error) {
      console.error("Failed to migrate legacy relationships:", error);
      // Don't throw - migration failure shouldn't block server startup
    }
  }

  /**
   * Get enriched Base120 mental model data from database
   */
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
      return {
        ok: false,
        error: { type: "NOT_FOUND", message: `Model ${code} not found in database` },
      } as const;
    }

    return { ok: true, value: result } as const;
  }

  /**
   * Get relationships for a specific model (simplified)
   */
  async getRelationshipsForModel(
    code: string
  ): Promise<SimpleRelationshipResult<SimpleRelationship[]>> {
    try {
      const sql = `
        SELECT id, source_code, target_code, relationship_type, confidence, evidence, created_at
        FROM model_relationships
        WHERE source_code = ? OR target_code = ?
        ORDER BY confidence DESC, created_at DESC
      `;

      const relationships = await this.query<SimpleRelationship>(sql, code, code);
      return { ok: true as const, value: relationships };
    } catch (error) {
      return { ok: false, error: `Failed to get relationships: ${error}` };
    }
  }

  /**
   * Create a new relationship (simplified)
   */
  async createSimpleRelationship(rel: RelationshipInput): Promise<SimpleRelationshipResult> {
    try {
      const sql = `
        INSERT INTO model_relationships (source_code, target_code, relationship_type, confidence, evidence)
        VALUES (?, ?, ?, ?, ?)
      `;

      await this.query(
        sql,
        rel.source_code,
        rel.target_code,
        rel.relationship_type,
        rel.confidence,
        rel.evidence || null
      );

      // Return a simple success result - the actual created relationship would need to be fetched
      return {
        ok: true as const,
        value: {
          source_code: rel.source_code,
          target_code: rel.target_code,
          relationship_type: rel.relationship_type,
          confidence: rel.confidence,
        } as SimpleRelationship,
      };
    } catch (error) {
      return { ok: false, error: `Failed to create relationship: ${error}` };
    }
  }

  /**
   * Get all relationships with optional filters
   */
  async getRelationships(filters?: {
    model?: string;
    type?: string;
    confidence?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModelRelationship[]> {
    try {
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

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const sql = `
        SELECT id, model_a, model_b, relationship_type, direction,
               confidence, logical_derivation, has_literature_support,
               literature_citation, literature_url, empirical_observation,
               validated_by, validated_at, review_status, notes,
               created_at, updated_at
        FROM relationships
        ${whereClause}
        ORDER BY confidence DESC, created_at DESC
        LIMIT ? OFFSET ?
      `;

      return (await this.query(sql, [...params, limit, offset])) as ModelRelationship[];
    } catch (error) {
      console.error("Failed to get relationships:", error);
      throw error;
    }
  }

  /**
   * Get single relationship by ID
   */
  async getRelationship(id: string): Promise<ModelRelationship | null> {
    try {
      const sql = `
        SELECT id, model_a, model_b, relationship_type, direction,
               confidence, logical_derivation, has_literature_support,
               literature_citation, literature_url, empirical_observation,
               validated_by, validated_at, review_status, notes,
               created_at, updated_at
        FROM relationships
        WHERE id = ?
      `;

      const results = (await this.query(sql, id)) as ModelRelationship[];
      return results.length > 0 ? results[0] : null;
    } catch (error) {
      console.error("Failed to get relationship:", error);
      throw error;
    }
  }

  /**
   * Get all relationships for a specific model (using filters)
   */
  async getRelationshipsForModelWithFilters(code: string): Promise<ModelRelationship[]> {
    return this.getRelationships({ model: code });
  }

  /**
   * Create new relationship
   */
  async createRelationship(input: RelationshipInput): Promise<ModelRelationship> {
    try {
      const sql = `
        INSERT INTO model_relationships (source_code, target_code, relationship_type, confidence, evidence)
        VALUES (?, ?, ?, ?, ?)
      `;

      await this.query(
        sql,
        input.source_code,
        input.target_code,
        input.relationship_type,
        input.confidence,
        input.evidence || null
      );

      // Get the created relationship
      const selectSql = `
        SELECT id, source_code as model_a, target_code as model_b, relationship_type, 'a→b' as direction,
               confidence, evidence as logical_derivation, NULL as has_literature_support,
               NULL as literature_citation, NULL as literature_url, NULL as empirical_observation,
               'system' as validated_by, created_at as validated_at, 'confirmed' as review_status,
               NULL as notes, created_at, updated_at
        FROM model_relationships
        WHERE source_code = ? AND target_code = ? AND relationship_type = ?
        ORDER BY created_at DESC LIMIT 1
      `;

      const results = (await this.query(
        selectSql,
        input.source_code,
        input.target_code,
        input.relationship_type
      )) as ModelRelationship[];
      return results[0];
    } catch (error) {
      // Check if it's a UNIQUE constraint violation
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        throw new DuplicateRelationshipError(
          `Relationship already exists: ${input.source_code} → ${input.target_code} (${input.relationship_type})`
        );
      }
      console.error("Failed to create relationship:", error);
      throw error;
    }
  }

  /**
   * Create new relationship in canonical relationships table
   */
  async createCanonicalRelationship(input: {
    id: string;
    model_a: string;
    model_b: string;
    relationship_type: string;
    direction: string;
    confidence: string;
    logical_derivation: string;
    has_literature_support?: number;
    literature_citation?: string;
    literature_url?: string;
    empirical_observation?: string;
    validated_by: string;
    validated_at: string;
    review_status: string;
    notes?: string;
  }): Promise<ModelRelationship> {
    try {
      const sql = `
        INSERT INTO relationships (
          id, model_a, model_b, relationship_type, direction, confidence,
          logical_derivation, has_literature_support, literature_citation, literature_url,
          empirical_observation, validated_by, validated_at, review_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      await this.execute(
        sql,
        input.id,
        input.model_a,
        input.model_b,
        input.relationship_type,
        input.direction,
        input.confidence,
        input.logical_derivation,
        input.has_literature_support || 0,
        input.literature_citation || null,
        input.literature_url || null,
        input.empirical_observation || null,
        input.validated_by,
        input.validated_at,
        input.review_status,
        input.notes || null
      );

      // Get the created relationship
      const selectSql = `
        SELECT id, model_a, model_b, relationship_type, direction, confidence,
               logical_derivation, has_literature_support, literature_citation, literature_url,
               empirical_observation, validated_by, validated_at, review_status, notes,
               created_at, updated_at
        FROM relationships
        WHERE id = ?
      `;

      const results = (await this.query(selectSql, input.id)) as ModelRelationship[];
      return results[0];
    } catch (error) {
      // Check if it's a UNIQUE constraint violation
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        throw new DuplicateRelationshipError(
          `Relationship already exists: ${input.model_a} → ${input.model_b} (${input.relationship_type}, ${input.direction})`
        );
      }
      console.error("Failed to create canonical relationship:", error);
      throw error;
    }
  }

  /**
   * Update existing relationship (partial update)
   */
  async updateRelationship(
    id: string,
    updates: Partial<ModelRelationship>
  ): Promise<ModelRelationship> {
    try {
      const setParts: string[] = [];
      const params: unknown[] = [];

      // Map the simple relationship fields to the complex ones
      if (updates.relationship_type) {
        setParts.push("relationship_type = ?");
        params.push(updates.relationship_type);
      }
      if (updates.confidence) {
        setParts.push("confidence = ?");
        params.push(updates.confidence);
      }
      if (updates.logical_derivation) {
        setParts.push("evidence = ?");
        params.push(updates.logical_derivation);
      }

      if (setParts.length === 0) {
        throw new Error("No valid updates provided");
      }

      params.push(id);

      const sql = `UPDATE model_relationships SET ${setParts.join(", ")}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      await this.query(sql, ...params);

      // Return the updated relationship
      const result = await this.getRelationship(id);
      if (!result) {
        throw new Error("Relationship not found after update");
      }
      return result;
    } catch (error) {
      console.error("Failed to update relationship:", error);
      throw error;
    }
  }
}

/**
 * Create a D1Client instance from a D1Database
 */
export function createD1Client(db: D1Database): D1Client {
  return new D1Client(db);
}
