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

      // Mental models table
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

      // Indexes for performance
      `CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sessions_active ON sessions(last_active)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)`,
      `CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`,
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
  }

  /**
   * Get enriched mental model data from database
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
        whereClause += " AND (source_code = ? OR target_code = ?)";
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

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const sql = `
        SELECT id, source_code as model_a, target_code as model_b, relationship_type, 'a→b' as direction,
               confidence, evidence as logical_derivation, NULL as has_literature_support,
               NULL as literature_citation, NULL as literature_url, NULL as empirical_observation,
               'system' as validated_by, created_at as validated_at, 'confirmed' as review_status,
               NULL as notes, created_at, updated_at
        FROM model_relationships
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
        SELECT id, source_code as model_a, target_code as model_b, relationship_type, 'a→b' as direction,
               confidence, evidence as logical_derivation, NULL as has_literature_support,
               NULL as literature_citation, NULL as literature_url, NULL as empirical_observation,
               'system' as validated_by, created_at as validated_at, 'confirmed' as review_status,
               NULL as notes, created_at, updated_at
        FROM model_relationships
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
      console.error("Failed to create relationship:", error);
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
