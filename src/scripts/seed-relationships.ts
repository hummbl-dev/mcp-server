#!/usr/bin/env node

// HUMMBL Relationship Seeding Script
// Imports initial validated relationships into D1 database

import { createD1Client, DuplicateRelationshipError } from "../storage/d1-client.js";
import { seedRelationships } from "../db/seed-relationships.js";
import type { D1Database } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
}

async function seedRelationshipsData(env: Env) {
  const db = createD1Client(env.DB);

  console.log(`🌱 Starting fresh with ${seedRelationships.length} relationships...`);

  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const relationship of seedRelationships) {
    try {
      // Convert to RelationshipInput format
      const relationshipInput = {
        source_code: relationship.model_a,
        target_code: relationship.model_b,
        relationship_type: relationship.relationship_type,
        confidence: (relationship.confidence === "U" ? "C" : relationship.confidence) as
          "A" | "B" | "C",
        evidence: relationship.logical_derivation,
      };
      const result = await db.createRelationship(relationshipInput);

      successCount++;
      console.log(
        `✅ Created relationship ${result.id}: ${relationship.model_a} ${relationship.relationship_type} ${relationship.model_b}`
      );
    } catch (error) {
      if (error instanceof DuplicateRelationshipError) {
        skippedCount++;
        console.log(
          `⏭️  Skipped duplicate relationship: ${relationship.model_a} ${relationship.relationship_type} ${relationship.model_b}`
        );
      } else {
        errorCount++;
        console.error(`❌ Error creating relationship ${relationship.id}:`, error);
      }
    }
  }

  console.log(`\n📊 Seeding complete:`);
  console.log(`   ✅ ${successCount} relationships created`);
  console.log(`   ⏭️  ${skippedCount} duplicates skipped`);
  console.log(`   ❌ ${errorCount} errors`);

  if (errorCount === 0 && successCount === 0 && skippedCount > 0) {
    console.log(`🎯 All relationships already exist!`);
  } else if (errorCount === 0) {
    console.log(`🎉 Seeding completed successfully!`);
  }
}

export default seedRelationshipsData;

// For local development testing
if (import.meta.main) {
  console.log("🚀 HUMMBL Relationship Seeder");
  console.log(
    "Usage: npx wrangler d1 execute <database> --file=./src/scripts/seed-relationships.ts"
  );
  console.log("Or run directly with Wrangler environment");
}
