/**
 * HUMMBL REST API Server
 * Hono.js-based REST API for mental models access
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Context, Next } from "hono";
import type { ApiKeyInfo } from "./types/domain.js";

import {
  TRANSFORMATIONS,
  PROBLEM_PATTERNS,
  getAllModels,
  getModelByCode,
  getTransformationByKey,
  searchModels,
  getModelsByTransformation,
} from "./framework/base120.js";
import { isOk, isTransformationType } from "./types/domain.js";
import { validateApiKey } from "./auth/api-keys.js";
import { createD1Client } from "./storage/d1-client.js";
import relationshipsRoutes from "./routes/relationships.js";
import type { SimpleRelationship, RelationshipInput } from "./types/relationships.js";

type Bindings = {
  DB: D1Database;
  API_KEYS: KVNamespace;
  SESSIONS: KVNamespace;
};

type Variables = {
  user?: ApiKeyInfo;
};

type AppContext = Context<{ Bindings: Bindings; Variables: Variables }>;

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Middleware
app.use("*", cors());
app.use("*", logger());

// Authentication middleware
async function authenticate(c: AppContext, next: Next): Promise<void> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    c.json({ error: "Missing or invalid authorization header" }, 401);
    return;
  }

  const apiKey = authHeader.substring(7); // Remove "Bearer "

  const authResult = await validateApiKey(c.env.API_KEYS, apiKey);
  if (!authResult.ok) {
    c.json({ error: authResult.error.message }, 401);
    return;
  }

  // Store authenticated user info in context for use in routes
  c.set("user", authResult.value);

  await next();
}

// Health check
app.get("/health", (c: AppContext) => {
  return c.json({
    status: "healthy",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    models_count: 120,
  });
});

// Get specific model by code
app.get("/v1/models/:code", authenticate, async (c: AppContext) => {
  const code = c.req.param("code").toUpperCase();

  const result = getModelByCode(code);
  if (!isOk(result)) {
    return c.json({ error: "Model not found" }, 404);
  }

  const model = result.value;
  const transformation = Object.values(TRANSFORMATIONS).find((t) =>
    t.models.some((m) => m.code === model.code)
  );

  // Get enriched data from D1
  const db = createD1Client(c.env.DB as any);
  const enrichedResult = await db.getMentalModel(code);

  if (!isOk(enrichedResult)) {
    // Fall back to basic model if not in DB
    return c.json({
      code: model.code,
      name: model.name,
      definition: model.definition,
      priority: model.priority,
      transformation: transformation?.key ?? null,
    });
  }

  return c.json(enrichedResult.value);
});

// Get relationships for a specific model
app.get("/v1/models/:code/relationships", async (c: AppContext) => {
  try {
    const code = c.req.param("code").toUpperCase();
    const db = createD1Client(c.env.DB as any);

    const result = await db.getRelationships(code);
    if (!result.ok) {
      return c.json({ error: result.error }, 500);
    }

    return c.json({
      model: code,
      relationships: result.value,
    });
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Create a new relationship (authenticated)
app.post("/v1/relationships", authenticate, async (c: AppContext) => {
  try {
    const body = await c.req.json();
    const db = createD1Client(c.env.DB as any);

    // Validate required fields
    if (!body.source_code || !body.target_code || !body.relationship_type || !body.confidence) {
      return c.json({ error: "Missing required fields: source_code, target_code, relationship_type, confidence" }, 400);
    }

    // Validate confidence
    if (!['A', 'B', 'C'].includes(body.confidence)) {
      return c.json({ error: "Confidence must be A, B, or C" }, 400);
    }

    const relationshipInput = {
      source_code: body.source_code.toUpperCase(),
      target_code: body.target_code.toUpperCase(),
      relationship_type: body.relationship_type,
      confidence: body.confidence,
      evidence: body.evidence,
    };

    const result = await db.createRelationship(relationshipInput);

    return c.json({ success: true, relationship: result }, 201);
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Seed relationships endpoint (admin only)
app.post("/v1/relationships/seed", authenticate, async (c: AppContext) => {
  try {
    // Check if user has admin permissions
    const user = c.get("user");
    if (!user?.permissions.includes("admin:*")) {
      return c.json({ error: "Admin permissions required" }, 403);
    }

    const db = createD1Client(c.env.DB as any);
    const { getSeedRelationships } = await import("./data/seed-relationships.js");
    const seedData = getSeedRelationships();

    let successCount = 0;
    let errorCount = 0;

    for (const relationship of seedData) {
      try {
        await db.createRelationship(relationship);
        successCount++;
      } catch (error) {
        console.error("Failed to seed relationship:", relationship, error);
        errorCount++;
      }
    }

    return c.json({
      success: true,
      message: `Seeded ${successCount} relationships, ${errorCount} failed`,
      seeded: successCount,
      failed: errorCount
    });
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Update relationship (authenticated)
app.patch("/v1/relationships/:id", authenticate, async (c: AppContext) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const db = createD1Client(c.env.DB as any);

    // Validate confidence if provided
    if (body.confidence && !['A', 'B', 'C'].includes(body.confidence)) {
      return c.json({ error: "Confidence must be A, B, or C" }, 400);
    }

    const updates: Partial<ModelRelationship> = {};
    if (body.relationship_type) updates.relationship_type = body.relationship_type;
    if (body.confidence) updates.confidence = body.confidence;
    if (body.evidence) updates.logical_derivation = body.evidence;

    const result = await db.updateRelationship(id, updates);

    return c.json({ success: true, relationship: result });
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get single relationship
app.get("/v1/relationships/:id", async (c: AppContext) => {
  try {
    const id = c.req.param("id");
    const db = createD1Client(c.env.DB as any);

    const result = await db.getRelationship(id);
    if (!result) {
      return c.json({ error: "Relationship not found" }, 404);
    }

    return c.json(result);
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// List relationships with filters
app.get("/v1/relationships", async (c: AppContext) => {
  try {
    const db = createD1Client(c.env.DB as any);
    const filters = {
      model: c.req.query("model"),
      type: c.req.query("type"),
      confidence: c.req.query("confidence"),
      status: c.req.query("status"),
      limit: c.req.query("limit") ? parseInt(c.req.query("limit")!) : undefined,
      offset: c.req.query("offset") ? parseInt(c.req.query("offset")!) : undefined,
    };

    const relationships = await db.getRelationships(filters);
    const total = relationships.length; // Note: This is approximate, should be improved

    return c.json({
      relationships,
      total,
      limit: filters.limit || 50,
      offset: filters.offset || 0,
    });
  } catch (error) {
    return c.json({ error: "Internal server error" }, 500);
  }
});

// List all models with optional transformation filter
app.get("/v1/models", authenticate, async (c: AppContext) => {
  const transformationFilter = c.req.query("transformation");

  let models = getAllModels();

  if (transformationFilter) {
    const upperFilter = transformationFilter.toUpperCase();
    if (!isTransformationType(upperFilter)) {
      return c.json({ error: "Invalid transformation filter" }, 400);
    }
    const result = getModelsByTransformation(upperFilter);
    if (!isOk(result)) {
      return c.json({ error: "Invalid transformation filter" }, 400);
    }
    models = result.value;
  }

  const enriched = models.map((m) => {
    const trans = Object.values(TRANSFORMATIONS).find((t) =>
      t.models.some((model) => model.code === m.code)
    );

    return {
      code: m.code,
      name: m.name,
      definition: m.definition,
      priority: m.priority,
      transformation: trans?.key ?? "UNKNOWN",
    };
  });

  return c.json({
    total: enriched.length,
    models: enriched,
  });
});

// Search models
app.get("/v1/search", authenticate, async (c: AppContext) => {
  const query = c.req.query("q");

  if (!query || query.length < 2) {
    return c.json({ error: "Query parameter 'q' must be at least 2 characters" }, 400);
  }

  const result = searchModels(query);
  if (!isOk(result)) {
    return c.json({ error: "Search failed" }, 500);
  }

  const enriched = result.value.map((m) => {
    const trans = Object.values(TRANSFORMATIONS).find((t) =>
      t.models.some((model) => model.code === m.code)
    );
    return {
      code: m.code,
      name: m.name,
      definition: m.definition,
      priority: m.priority,
      transformation: trans?.key ?? "UNKNOWN",
    };
  });

  return c.json({
    query,
    resultCount: enriched.length,
    results: enriched,
  });
});

// Get transformation details
app.get("/v1/transformations/:key", authenticate, async (c: AppContext) => {
  const key = c.req.param("key").toUpperCase();

  if (!isTransformationType(key)) {
    return c.json({ error: "Invalid transformation key" }, 400);
  }

  const result = getTransformationByKey(key);
  if (!isOk(result)) {
    return c.json({ error: "Transformation not found" }, 404);
  }

  const transformation = result.value;
  return c.json({
    key: transformation.key,
    name: transformation.name,
    description: transformation.description,
    modelCount: transformation.models.length,
    models: transformation.models,
  });
});

// List all transformations
app.get("/v1/transformations", authenticate, (c: AppContext) => {
  const transformations = Object.values(TRANSFORMATIONS).map((t) => ({
    key: t.key,
    name: t.name,
    description: t.description,
    modelCount: t.models.length,
  }));

  return c.json({
    total: transformations.length,
    transformations,
  });
});

// Get recommendations for a problem
app.post("/v1/recommend", authenticate, async (c: AppContext) => {
  const { problem } = await c.req.json();

  if (!problem || typeof problem !== "string" || problem.length < 10) {
    return c.json({ error: "Problem description must be at least 10 characters" }, 400);
  }

  const problemLower = problem.toLowerCase();

  const matchedPatterns = PROBLEM_PATTERNS.filter((p) => {
    const patternWords = p.pattern.toLowerCase().split(" ");
    return patternWords.some((word) => problemLower.includes(word));
  });

  const recommendations = matchedPatterns.length > 0 ? matchedPatterns : PROBLEM_PATTERNS;

  const enrichedRecommendations = recommendations.map((rec) => ({
    pattern: rec.pattern,
    transformations: rec.transformations.map((tKey) => {
      const t = TRANSFORMATIONS[tKey];
      return {
        key: t.key,
        name: t.name,
        description: t.description,
      };
    }),
    topModels: rec.topModels
      .map((code) => {
        const result = getModelByCode(code);
        if (!isOk(result)) {
          return null;
        }
        const model = result.value;
        return {
          code: model.code,
          name: model.name,
          definition: model.definition,
          priority: model.priority,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null),
  }));

  return c.json({
    problem,
    recommendationCount: enrichedRecommendations.length,
    recommendations: enrichedRecommendations,
  });
});

// Add relationships routes
app.route("/v1", relationshipsRoutes);

// Error handling
app.onError((err: Error, c: AppContext) => {
  console.error(`${err}`);
  return c.json({ error: "Internal server error" }, 500);
});

// 404 handler
app.notFound((c: AppContext) => {
  return c.json({ error: "Endpoint not found" }, 404);
});

export default app;
