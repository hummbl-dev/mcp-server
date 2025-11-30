#!/usr/bin/env node

// HUMMBL Relationship Seeding Script
// Imports initial validated relationships into D1 database

import { createD1Client } from "../storage/d1-client.js";
import { seedRelationships } from "../db/seed-relationships.js";

interface Env {
  DB: D1Database;
}

async function seedRelationshipsData(env: Env) {
  const db = createD1Client(env.DB);

  console.log(`🌱 Starting fresh with ${seedRelationships.length} relationships...`);

  let successCount = 0;
  let errorCount = 0;

  for (const relationship of seedRelationships) {
    try {
      const result = await db.createRelationship({
        id: relationship.id,
        model_a: relationship.model_a,
        model_b: relationship.model_b,
        relationship_type: relationship.relationship_type,
        direction: relationship.direction,
        confidence: relationship.confidence,
        logical_derivation: relationship.logical_derivation,
        has_literature_support: relationship.literature_support?.has_support ? 1 : 0,
        literature_citation: relationship.literature_support?.citation,
        literature_url: relationship.literature_support?.url,
        empirical_observation: relationship.empirical_observation,
        validated_by: relationship.validated_by,
        validated_at: relationship.validated_at,
        review_status: relationship.review_status,
        notes: relationship.notes,
      });

      if (result.ok) {
        successCount++;
        console.log(`✅ Created relationship ${relationship.id}: ${relationship.model_a} ${relationship.relationship_type} ${relationship.model_b}`);
      } else {
        errorCount++;
        console.error(`❌ Failed to create relationship ${relationship.id}: ${result.error}`);
      }
    } catch (error) {
      errorCount++;
      console.error(`❌ Error creating relationship ${relationship.id}:`, error);
    }
  }

  console.log(`\n📊 Seeding complete:`);
  console.log(`   ✅ ${successCount} relationships created`);
  console.log(`   ❌ ${errorCount} errors`);

  if (errorCount === 0 && successCount === 0) {
    console.log(`🎯 Ready for relationship validation workflow!`);
    console.log(`   Use API endpoints to add verified relationships.`);
  } else if (errorCount === 0) {
    console.log(`🎉 All relationships seeded successfully!`);
  }
}

export default seedRelationshipsData;

// For local development testing
if (import.meta.main) {
  console.log("🚀 HUMMBL Relationship Seeder");
  console.log("Usage: npx wrangler d1 execute <database> --file=./src/scripts/seed-relationships.ts");
  console.log("Or run directly with Wrangler environment");
}
