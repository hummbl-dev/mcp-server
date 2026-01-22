// HUMMBL Relationships API Routes
// CRUD endpoints for model relationship management

import { Hono } from "hono";
import type { AppContext } from "../api.js";
import { createD1Client } from "../storage/d1-client.js";
import type { D1Database, KVNamespace } from "@cloudflare/workers-types";
import type {
  CreateRelationshipRequest,
  UpdateRelationshipRequest,
  RelationshipQuery,
  ModelRelationshipsResponse,
  GraphExport,
  GraphNode,
  GraphEdge,
  CytoscapeGraph,
  CytoscapeElement,
  Confidence,
  ReviewStatus,
} from "../types/relationships.js";
import {
  isRelationshipType,
  isDirection,
  isConfidence,
  isReviewStatus,
} from "../types/relationships.js";

const router = new Hono<{
  Bindings: { DB: D1Database; API_KEYS: KVNamespace; SESSIONS: KVNamespace };
}>();

/**
 * GET /v1/relationships
 * List relationships with optional filtering
 */
router.get("/relationships", async (c: AppContext) => {
  try {
    const db = createD1Client(c.env.DB);
    const typeParam = c.req.query("type");
    const confidenceParam = c.req.query("confidence");
    const statusParam = c.req.query("status");

    const query: RelationshipQuery = {
      model: c.req.query("model"),
      type: typeParam && isRelationshipType(typeParam) ? typeParam : undefined,
      confidence: confidenceParam && isConfidence(confidenceParam) ? confidenceParam : undefined,
      status: statusParam && isReviewStatus(statusParam) ? statusParam : undefined,
      limit: c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined,
      offset: c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined,
    };

    const relationships = await db.getRelationships(query);
    const total = relationships.length;

    return c.json({
      relationships,
      total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/relationships/:id
 * Get single relationship by ID
 */
router.get("/relationships/:id", async (c: AppContext) => {
  try {
    const db = createD1Client(c.env.DB);
    const id = c.req.param("id");

    const result = await db.getRelationship(id);
    if (!result) {
      return c.json({ error: "Relationship not found" }, 404);
    }

    return c.json(result);
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/models/:code/relationships
 * Get relationships for a specific model
 */
router.get("/models/:code/relationships", async (c: AppContext) => {
  try {
    const db = createD1Client(c.env.DB);
    const code = c.req.param("code").toUpperCase();

    const relationshipsData = await db.getRelationships({ model: code });
    const relationships: ModelRelationshipsResponse["relationships"] = relationshipsData.map(
      (rel) => {
        const isModelA = rel.model_a === code;
        return {
          related_model: isModelA ? rel.model_b : rel.model_a,
          type: rel.relationship_type,
          direction: isModelA ? "outgoing" : "incoming",
          confidence: rel.confidence,
          logical_derivation: rel.logical_derivation,
          relationship_id: rel.id,
        };
      }
    );

    return c.json({
      model: code,
      relationships,
    });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * POST /v1/relationships
 * Create new relationship (admin only)
 */
router.post("/relationships", async (c: AppContext) => {
  try {
    // Check if user has admin permissions
    const user = c.get("user");
    if (!user?.permissions.includes("admin:*")) {
      return c.json({ error: "Admin permissions required" }, 403);
    }

    const db = createD1Client(c.env.DB);
    const body: CreateRelationshipRequest = await c.req.json();

    // Validate required fields
    if (
      !body.model_a ||
      !body.model_b ||
      !body.relationship_type ||
      !body.direction ||
      !body.logical_derivation
    ) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Validate relationship type
    if (!isRelationshipType(body.relationship_type)) {
      return c.json({ error: "Invalid relationship type" }, 400);
    }

    // Validate direction
    if (!isDirection(body.direction)) {
      return c.json({ error: "Invalid direction" }, 400);
    }

    // Validate confidence if provided
    if (body.confidence && !isConfidence(body.confidence)) {
      return c.json({ error: "Invalid confidence level" }, 400);
    }

    // Ensure confidence is valid for RelationshipInput (A, B, or C)
    // Default to "C" if not provided, or convert "U" to "C"
    const validConfidence =
      body.confidence && body.confidence !== "U" ? (body.confidence as "A" | "B" | "C") : "C";

    // Generate ID
    const id = `R${Date.now().toString().slice(-6)}`;

    const relationshipData = {
      id,
      model_a: body.model_a.toUpperCase(),
      model_b: body.model_b.toUpperCase(),
      relationship_type: body.relationship_type,
      direction: body.direction,
      confidence: body.confidence || "U", // Keep "U" for relationshipData (full ModelRelationship)
      logical_derivation: body.logical_derivation,
      has_literature_support: body.literature_support?.has_support ? 1 : 0,
      literature_citation: body.literature_support?.citation,
      literature_url: body.literature_support?.url,
      empirical_observation: body.empirical_observation,
      validated_by: user.name,
      validated_at: new Date().toISOString(),
      review_status: "draft" as const,
      notes: body.notes,
    };

    // Convert to RelationshipInput format
    const relationshipInput = {
      source_code: relationshipData.model_a,
      target_code: relationshipData.model_b,
      relationship_type: relationshipData.relationship_type,
      confidence: validConfidence,
      evidence: relationshipData.logical_derivation,
    };

    const result = await db.createRelationship(relationshipInput);

    return c.json(result, 201);
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * PATCH /v1/relationships/:id
 * Update relationship (admin only)
 */
router.patch("/relationships/:id", async (c: AppContext) => {
  try {
    // Check if user has admin permissions
    const user = c.get("user");
    if (!user?.permissions.includes("admin:*")) {
      return c.json({ error: "Admin permissions required" }, 403);
    }

    const db = createD1Client(c.env.DB);
    const id = c.req.param("id");
    const body: UpdateRelationshipRequest = await c.req.json();

    // Validate fields if provided
    if (body.relationship_type && !isRelationshipType(body.relationship_type)) {
      return c.json({ error: "Invalid relationship type" }, 400);
    }

    if (body.direction && !isDirection(body.direction)) {
      return c.json({ error: "Invalid direction" }, 400);
    }

    if (body.confidence && !isConfidence(body.confidence)) {
      return c.json({ error: "Invalid confidence level" }, 400);
    }

    if (body.review_status && !isReviewStatus(body.review_status)) {
      return c.json({ error: "Invalid review status" }, 400);
    }

    const updates: Partial<Parameters<typeof db.updateRelationship>[1]> = {};
    if (body.relationship_type) updates.relationship_type = body.relationship_type;
    if (body.confidence) updates.confidence = body.confidence;
    if (body.logical_derivation) updates.logical_derivation = body.logical_derivation;

    const result = await db.updateRelationship(id, updates);

    return c.json({ success: true, relationship: result });
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * DELETE /v1/relationships/:id
 * Delete relationship (admin only)
 */
router.delete("/relationships/:id", async (c: AppContext) => {
  try {
    // Check if user has admin permissions
    const user = c.get("user");
    if (!user?.permissions.includes("admin:*")) {
      return c.json({ error: "Admin permissions required" }, 403);
    }

    const db = createD1Client(c.env.DB);
    const id = c.req.param("id");

    // Check if relationship exists
    const existing = await db.getRelationship(id);
    if (!existing) {
      return c.json({ error: "Relationship not found" }, 404);
    }

    // TODO: Implement deleteRelationship method in D1Client
    // For now, return error
    return c.json({ error: "Delete not yet implemented" }, 501);
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

/**
 * GET /v1/graph
 * Export graph data for visualization
 */
router.get("/graph", async (c: AppContext) => {
  try {
    const db = createD1Client(c.env.DB);
    const format = c.req.query("format") || "json";
    const confidenceMin = c.req.query("confidence_min") || "C";
    const status = c.req.query("status") || "confirmed";

    // Get all relationships
    const relationships = await db.getRelationships({
      confidence: confidenceMin,
      status,
      limit: 1000,
    });

    // Build nodes and edges from relationships
    const nodeSet = new Set<string>();
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    relationships.forEach((rel) => {
      nodeSet.add(rel.model_a);
      nodeSet.add(rel.model_b);
      edges.push({
        source: rel.model_a,
        target: rel.model_b,
        type: rel.relationship_type,
        confidence: rel.confidence,
        direction: rel.direction || "a→b",
        logical_derivation: rel.logical_derivation,
      });
    });

    // Create nodes (simplified - would need model lookup for full data)
    nodeSet.forEach((modelCode) => {
      // Extract transformation from model code (e.g., "DE1" -> "DE")
      const transformation = modelCode.match(/^([A-Z]+)/)?.[1] || "";
      nodes.push({ id: modelCode, name: modelCode, transformation });
    });

    if (format === "cytoscape") {
      const elements: CytoscapeElement[] = [
        ...nodes.map((node) => ({
          data: {
            id: node.id,
            label: node.name,
            type: "node",
            transformation: node.transformation,
          },
        })),
        ...edges.map((edge) => ({
          data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            confidence: edge.confidence,
            direction: edge.direction,
          },
        })),
      ];

      return c.json({ elements } as CytoscapeGraph);
    }

    // Default JSON format
    const graphExport: GraphExport = {
      nodes,
      edges,
      metadata: {
        total_nodes: nodes.length,
        total_edges: edges.length,
        confidence_filter: (confidenceMin && isConfidence(confidenceMin)
          ? confidenceMin
          : "C") as Confidence,
        status_filter: (status && isReviewStatus(status) ? status : "confirmed") as ReviewStatus,
        generated_at: new Date().toISOString(),
      },
    };

    return c.json(graphExport);
  } catch {
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
