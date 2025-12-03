#!/usr/bin/env node

// HUMMBL CSV Relationship Import Script
// Bulk imports relationships from CSV for validation workflow

import { createD1Client } from "../storage/d1-client.js";
import {
  isRelationshipType,
  isDirection,
  isConfidence,
  isReviewStatus,
} from "../types/relationships.js";
import type { D1Database } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
}

interface CSVRelationship {
  id: string;
  model_a: string;
  model_b: string;
  relationship_type: string;
  direction: string;
  confidence: string;
  logical_derivation: string;
  has_literature_support?: string;
  literature_citation?: string;
  literature_url?: string;
  empirical_observation?: string;
  validated_by: string;
  validated_at: string;
  review_status?: string;
  notes?: string;
}

// Simple CSV parser (for basic CSV format)
function parseCSV(csvText: string): CSVRelationship[] {
  const lines = csvText.trim().split("\n");
  const headers = lines[0].split(",").map((h) => h.trim());

  const relationships: CSVRelationship[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    if (values.length !== headers.length) continue;

    const relationship: any = {};
    headers.forEach((header, index) => {
      const value = values[index];
      relationship[header] = value === "" ? undefined : value;
    });

    relationships.push(relationship as CSVRelationship);
  }

  return relationships;
}

async function importRelationshipsFromCSV(env: Env, csvText: string, dryRun = false) {
  const db = createD1Client(env.DB);
  const relationships = parseCSV(csvText);

  console.log(`📄 Parsed ${relationships.length} relationships from CSV`);

  if (dryRun) {
    console.log("🔍 DRY RUN - No data will be inserted");
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const relationship of relationships) {
    try {
      // Validate required fields
      if (
        !relationship.id ||
        !relationship.model_a ||
        !relationship.model_b ||
        !relationship.relationship_type ||
        !relationship.direction ||
        !relationship.logical_derivation ||
        !relationship.validated_by
      ) {
        throw new Error("Missing required fields");
      }

      // Validate enums
      if (!isRelationshipType(relationship.relationship_type)) {
        throw new Error(`Invalid relationship type: ${relationship.relationship_type}`);
      }

      if (!isDirection(relationship.direction)) {
        throw new Error(`Invalid direction: ${relationship.direction}`);
      }

      if (relationship.confidence && !isConfidence(relationship.confidence)) {
        throw new Error(`Invalid confidence: ${relationship.confidence}`);
      }

      if (relationship.review_status && !isReviewStatus(relationship.review_status)) {
        throw new Error(`Invalid review status: ${relationship.review_status}`);
      }

      if (!dryRun) {
        // Convert to RelationshipInput format
        const relationshipInput = {
          source_code: relationship.model_a.toUpperCase(),
          target_code: relationship.model_b.toUpperCase(),
          relationship_type: relationship.relationship_type,
          confidence: (relationship.confidence || "C") as "A" | "B" | "C",
          evidence: relationship.logical_derivation,
        };
        await db.createRelationship(relationshipInput);
      }

      successCount++;
      console.log(
        `✅ ${dryRun ? "Validated" : "Imported"} relationship ${relationship.id}: ${relationship.model_a} ${relationship.relationship_type} ${relationship.model_b}`
      );
    } catch (error) {
      errorCount++;
      const errorMsg = `❌ Failed to ${dryRun ? "validate" : "import"} relationship ${relationship.id}: ${error instanceof Error ? error.message : "Unknown error"}`;
      errors.push(errorMsg);
      console.error(errorMsg);
    }
  }

  console.log(`\n📊 Import complete:`);
  console.log(`   ✅ ${successCount} relationships ${dryRun ? "validated" : "imported"}`);
  console.log(`   ❌ ${errorCount} errors`);

  if (errors.length > 0) {
    console.log("\n🚨 Errors:");
    errors.forEach((error) => console.log(`   ${error}`));
  }

  return { successCount, errorCount, errors };
}

// CSV Template
export const CSV_TEMPLATE = `id,model_a,model_b,relationship_type,direction,confidence,logical_derivation,has_literature_support,literature_citation,literature_url,empirical_observation,validated_by,validated_at,review_status,notes
R011,DE2,SY2,enables,a→b,B,Systems Thinking requires understanding feedback loops and Second-Order Thinking provides the temporal depth needed to trace system behaviors over time.,1,"Senge, P. (1990). The Fifth Discipline","https://en.wikipedia.org/wiki/The_Fifth_Discipline",Complex system failures often stem from second-order effects that first-order thinking misses.,Reuben Bowlby,2025-11-28T00:00:00.000Z,draft,Initial import from validation exercise`;

export default { importRelationshipsFromCSV, CSV_TEMPLATE };

// For local development
if (import.meta.main) {
  console.log("🚀 HUMMBL CSV Relationship Importer");
  console.log("Usage: Read CSV from stdin and pipe to this script");
  console.log(
    "Example: cat relationships.csv | npx wrangler d1 execute <database> --file=./src/scripts/import-relationships-csv.ts"
  );
  console.log("\n📄 CSV Format template:");
  console.log(CSV_TEMPLATE);
}
