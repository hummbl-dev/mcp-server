#!/usr/bin/env tsx

/**
 * HUMMBL API Key Management Script
 * Generate and manage API keys with tiered access
 */

import { generateApiKey } from "../src/auth/api-keys.js";
import type { ApiKeyTier } from "../src/types/domain.js";
import { writeFileSync } from "fs";
import { join } from "path";

function printUsage() {
  console.log(`
HUMMBL API Key Management

Usage:
  npm run create-key [tier] [name]

Tiers:
  free        - 100 requests/hour, 1000/day (read-only)
  pro         - 1000 requests/hour, 10000/day (read + search)
  enterprise  - 10000 requests/hour, 100000/day (full access)

Examples:
  npm run create-key free "My App"
  npm run create-key pro "Production API"
  npm run create-key enterprise "Enterprise Client"

Note: This script generates keys and saves them to JSON files.
Use the generated key with Bearer authentication in API requests.
To deploy to KV: wrangler kv:key put API_KEYS --local [key] [json-data]
  `);
}

function saveApiKeyToFile(keyInfo: any): void {
  const filename = `api-key-${keyInfo.tier}-${keyInfo.id.substring(0, 8)}.json`;
  const filepath = join(process.cwd(), filename);

  writeFileSync(filepath, JSON.stringify(keyInfo, null, 2), "utf-8");
  console.log(`✅ API Key saved to: ${filename}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printUsage();
    return;
  }

  if (args.length < 2) {
    console.error("Error: Please provide both tier and name");
    printUsage();
    process.exit(1);
  }

  const [tierArg, ...nameParts] = args;
  const name = nameParts.join(" ");

  const validTiers: ApiKeyTier[] = ["free", "pro", "enterprise"];
  if (!validTiers.includes(tierArg as ApiKeyTier)) {
    console.error(`Error: Invalid tier "${tierArg}". Must be one of: ${validTiers.join(", ")}`);
    process.exit(1);
  }

  const tier = tierArg as ApiKeyTier;

  // Generate the API key
  const keyInfo = generateApiKey(tier, name);

  console.log("🔑 HUMMBL API Key Generated");
  console.log("=".repeat(50));
  console.log(`Name: ${keyInfo.name}`);
  console.log(`Tier: ${keyInfo.tier.toUpperCase()}`);
  console.log(`Key: ${keyInfo.key}`);
  console.log(`Rate Limit: ${keyInfo.rateLimit.requestsPerHour}/hour, ${keyInfo.rateLimit.requestsPerDay}/day`);
  console.log(`Permissions: ${keyInfo.permissions.join(", ")}`);
  console.log("=".repeat(50));

  // Save to file
  saveApiKeyToFile(keyInfo);

  console.log("\n📋 Usage Instructions:");
  console.log(`curl -H "Authorization: Bearer ${keyInfo.key}" https://api.hummbl.io/health`);
  console.log(`curl -H "Authorization: Bearer ${keyInfo.key}" https://api.hummbl.io/v1/models`);

  console.log("\n⚠️  To activate this key in production:");
  console.log("1. Upload the JSON file to your KV namespace");
  console.log("2. Or use wrangler to set it directly:");
  console.log(`wrangler kv:key put "${keyInfo.key}" --namespace-id=YOUR_NAMESPACE_ID`);
  console.log(`Value: ${JSON.stringify(keyInfo)}`);

  console.log("\n💡 Test locally:");
  console.log(`wrangler kv:key put "${keyInfo.key}" --local`);
  console.log(`Value: ${JSON.stringify(keyInfo)}`);
}

main().catch(console.error);
