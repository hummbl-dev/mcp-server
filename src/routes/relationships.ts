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
  CytoscapeGraph,
  CytoscapeElement
} from "../types/relationships.js";
import { isRelationshipType, isDirection, isConfidence, isReviewStatus } from "../types/relationships.js";

const router = new Hono<{ Bindings: { DB: D1Database; API_KEYS: KVNamespace; SESSIONS: KVNamespace } }>();

/**
 * GET /v1/relationships
 * List relationships with optional filtering
 */
router.get("/relationships", async (c: AppContext) => {
  try {
    const db = createD1Client(c.env.DB);
    const query: RelationshipQuery = {
      model: c.req.query("model"),
      type: c.req.query("type"),
      confidence: c.req.query("confidence"),
      status: c.req.query("status"),
      limit: c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined,
      offset: c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined,
    };

    const result = await db.getRelationships(query);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({
      relationships: result.value.relationships,
      total: result.value.total,
      limit: query.limit || 50,
      offset: query.offset || 0,
    });
  } catch (_error) {
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
    if (!result.ok) {
      return c.json({ error: result.error }, 404);
    }

    return c.json(result.value);
  } catch (_error) {
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

    const result = await db.getModelRelationships(code);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    const relationships: ModelRelationshipsResponse["relationships"] = result.value.map(rel => {
      const isModelA = rel.model_a === code;
      return {
        related_model: isModelA ? rel.model_b : rel.model_a,
        type: rel.relationship_type,
        direction: isModelA ? "outgoing" : "incoming",
        confidence: rel.confidence,
        logical_derivation: rel.logical_derivation,
        relationship_id: rel.id,
      };
    });

    return c.json({
      model: code,
      relationships,
    });
  } catch (_error) {
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
    if (!body.model_a || !body.model_b || !body.relationship_type || !body.direction || !body.logical_derivation) {
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

    // Generate ID
    const id = `R${Date.now().toString().slice(-6)}`;

    const relationshipData = {
      id,
      model_a: body.model_a.toUpperCase(),
      model_b: body.model_b.toUpperCase(),
      relationship_type: body.relationship_type,
      direction: body.direction,
      confidence: body.confidence || "U",
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

    const result = await db.createRelationship(relationshipData);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ id, ...relationshipData }, 201);
  } catch (_error) {
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

    const updates: Parameters<typeof db.updateRelationship>[1] = {};
    if (body.relationship_type) updates.relationship_type = body.relationship_type;
    if (body.direction) updates.direction = body.direction;
    if (body.confidence) updates.confidence = body.confidence;
    if (body.logical_derivation) updates.logical_derivation = body.logical_derivation;
    if (body.literature_support) {
      updates.has_literature_support = body.literature_support.has_support ? 1 : 0;
      updates.literature_citation = body.literature_support.citation;
      updates.literature_url = body.literature_support.url;
    }
    if (body.empirical_observation) updates.empirical_observation = body.empirical_observation;
    if (body.review_status) updates.review_status = body.review_status;
    if (body.notes !== undefined) updates.notes = body.notes;

    const result = await db.updateRelationship(id, updates);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ success: true });
  } catch (_error) {
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

    const result = await db.deleteRelationship(id);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({ success: true });
  } catch (_error) {
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

    const result = await db.getGraphData({
      confidence_min: confidenceMin,
      status,
    });

    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    const { nodes, edges } = result.value;

    if (format === "cytoscape") {
      const elements: CytoscapeElement[] = [
        ...nodes.map(node => ({
          data: {
            id: node.id,
            label: node.name,
            type: "node",
            transformation: node.transformation,
          }
        })),
        ...edges.map(edge => ({
          data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            confidence: edge.confidence,
            direction: edge.direction,
          }
        }))
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
        confidence_filter: confidenceMin,
        status_filter: status,
        generated_at: new Date().toISOString(),
      }
    };

    return c.json(graphExport);
  } catch (_error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default router;
