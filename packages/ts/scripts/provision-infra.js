#!/usr/bin/env node

/**
 * HUMMBL Infrastructure Provisioning Script
 * Generates single-command block for Cloudflare Workers deployment
 *
 * Usage: node scripts/provision-infra.js
 */

import { execSync } from "child_process";
import { randomBytes } from "crypto";

const PROJECT_NAME = "hummbl-api";
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || "YOUR_ACCOUNT_ID";

function generateId(prefix = "") {
  const bytes = randomBytes(8);
  return `${prefix}${bytes.toString("hex").slice(0, 16)}`;
}

function generateWranglerCommands() {
  const d1Id = generateId("d1_");
  const kvApiKeysId = generateId("kv_api_");
  const kvSessionsId = generateId("kv_sessions_");

  console.log("🚀 HUMMBL Infrastructure Provisioning Commands");
  console.log("=".repeat(50));
  console.log("");

  console.log("# 1. Create D1 Database");
  console.log(`wrangler d1 create ${PROJECT_NAME} --account-id=${ACCOUNT_ID}`);
  console.log("");

  console.log("# 2. Create KV Namespaces");
  console.log(`wrangler kv:namespace create "API_KEYS" --account-id=${ACCOUNT_ID}`);
  console.log(`wrangler kv:namespace create "SESSIONS" --account-id=${ACCOUNT_ID}`);
  console.log("");

  console.log("# 3. Update wrangler.toml with generated IDs");
  console.log("# Replace the placeholder IDs below with the actual IDs from the commands above:");
  console.log("");
  console.log("```toml");
  console.log("# wrangler.toml");
  console.log("name = \"hummbl-api\"");
  console.log("main = \"dist/index.js\"");
  console.log("compatibility_date = \"2024-01-01\"");
  console.log("");
  console.log("[[d1_databases]]");
  console.log(`database_name = "${PROJECT_NAME}"`);
  console.log("# Replace with actual D1 ID from step 1");
  console.log(`database_id = "${d1Id}"`);
  console.log("");
  console.log("[[kv_namespaces]]");
  console.log("binding = \"API_KEYS\"");
  console.log("# Replace with actual KV ID from step 2");
  console.log(`id = "${kvApiKeysId}"`);
  console.log("");
  console.log("[[kv_namespaces]]");
  console.log("binding = \"SESSIONS\"");
  console.log("# Replace with actual KV ID from step 2");
  console.log(`id = "${kvSessionsId}"`);
  console.log("```");
  console.log("");

  console.log("# 4. Deploy and seed database");
  console.log(`wrangler deploy`);
  console.log(`wrangler d1 execute ${PROJECT_NAME} --file=schema.sql`);
  console.log(`wrangler d1 execute ${PROJECT_NAME} --file=seed.sql`);
  console.log("");

  console.log("# 5. Verify deployment");
  console.log(`curl https://hummbl-api.your-subdomain.workers.dev/health`);
  console.log("");

  console.log("📝 Generated Resource IDs (save these for wrangler.toml):");
  console.log(`D1 Database ID: ${d1Id}`);
  console.log(`API Keys KV ID: ${kvApiKeysId}`);
  console.log(`Sessions KV ID: ${kvSessionsId}`);
  console.log("");

  console.log("⚠️  Important Notes:");
  console.log("- Replace YOUR_ACCOUNT_ID with your actual Cloudflare account ID");
  console.log("- Run commands in order (1→2→3→4→5)");
  console.log("- Update wrangler.toml with actual IDs from Cloudflare");
  console.log("- Ensure CLOUDFLARE_API_TOKEN has D1 and KV permissions");
  console.log("- Database seeding may take several minutes for 120 models");
  console.log("");

  return {
    d1Id,
    kvApiKeysId,
    kvSessionsId,
  };
}

function validateWrangler() {
  try {
    execSync("wrangler --version", { stdio: "pipe" });
    console.log("✅ Wrangler CLI detected");
    return true;
  } catch {
    console.log("⚠️  Wrangler CLI not found. Install with: npm install -g wrangler");
    return false;
  }
}

function main() {
  console.log("🔧 HUMMBL Infrastructure Provisioning Script");
  console.log("============================================");
  console.log("");

  const hasWrangler = validateWrangler();

  if (!hasWrangler) {
    console.log("❌ Please install Wrangler CLI first, then rerun this script.");
    process.exit(1);
  }

  if (ACCOUNT_ID === "YOUR_ACCOUNT_ID") {
    console.log("⚠️  CLOUDFLARE_ACCOUNT_ID not set. Replace YOUR_ACCOUNT_ID in commands below.");
    console.log("");
  }

  console.log("📋 Copy and execute these commands in your terminal:");
  console.log("");

  const ids = generateWranglerCommands();

  console.log("💾 Resource IDs saved to clipboard (if supported)");
  try {
    // Try to copy to clipboard on macOS
    const clipboardData = `D1: ${ids.d1Id}\nAPI_KEYS: ${ids.kvApiKeysId}\nSESSIONS: ${ids.kvSessionsId}`;
    execSync(`echo "${clipboardData}" | pbcopy`, { stdio: "pipe" });
    console.log("✅ IDs copied to clipboard");
  } catch {
    // Clipboard not available, just continue
  }

  console.log("");
  console.log("🎯 Next Steps:");
  console.log("1. Execute the wrangler commands above");
  console.log("2. Update wrangler.toml with actual Cloudflare IDs");
  console.log("3. Run: wrangler deploy && wrangler d1 execute hummbl-api --file=schema.sql");
  console.log("4. Run: wrangler d1 execute hummbl-api --file=seed.sql");
  console.log("5. Test: curl https://hummbl-api.your-subdomain.workers.dev/health");
}

main();
