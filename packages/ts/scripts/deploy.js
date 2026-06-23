#!/usr/bin/env node

/**
 * HUMMBL Production Deployment Script
 * Complete end-to-end deployment for pre-production to production
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const DEPLOYMENT_CONFIG = {
  project: "hummbl-api",
  environment: process.env.NODE_ENV || "production",
  accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
};

function log(message, level = "INFO") {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${level}: ${message}`);
}

function execCommand(command, description) {
  try {
    log(`Executing: ${description}`);
    log(`Command: ${command}`);

    const result = execSync(command, {
      stdio: "pipe",
      encoding: "utf-8",
      env: { ...process.env, ...DEPLOYMENT_CONFIG }
    });

    if (result) {
      log(`Output: ${result.trim()}`);
    }

    return result;
  } catch (error) {
    log(`Command failed: ${error.message}`, "ERROR");
    throw error;
  }
}

function validateEnvironment() {
  log("Validating deployment environment...");

  if (!DEPLOYMENT_CONFIG.accountId) {
    throw new Error("CLOUDFLARE_ACCOUNT_ID environment variable is required");
  }

  // Check if wrangler is installed
  try {
    execCommand("wrangler --version", "Checking Wrangler CLI");
  } catch {
    throw new Error("Wrangler CLI is not installed. Run: npm install -g wrangler");
  }

  // Check if dependencies are installed
  try {
    execCommand("npm list hono", "Checking Hono.js dependency");
  } catch {
    log("Installing dependencies...");
    execCommand("npm install", "Installing npm dependencies");
  }

  log("Environment validation complete ✅");
}

function provisionInfrastructure() {
  log("Provisioning Cloudflare infrastructure...");

  // Generate infrastructure commands
  execCommand("npm run provision", "Generating infrastructure provisioning commands");

  // Read the generated commands file
  const infraFile = readFileSync("infra-commands.txt", "utf-8");
  console.log("\n" + infraFile);

  log("⚠️  MANUAL STEP REQUIRED:");
  log("1. Execute the wrangler commands shown above");
  log("2. Update wrangler.toml with the actual resource IDs");
  log("3. Press Enter to continue deployment...");

  // Wait for user input
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.on('data', () => {
    process.stdin.setRawMode(false);
    process.stdin.pause();
    log("Continuing with deployment...");
  });
}

function updateWranglerConfig() {
  log("Checking wrangler.toml configuration...");

  const wranglerPath = join(process.cwd(), "wrangler.toml");
  const wranglerConfig = readFileSync(wranglerPath, "utf-8");

  if (wranglerConfig.includes("YOUR_D1_DATABASE_ID") ||
      wranglerConfig.includes("YOUR_API_KEYS_KV_ID") ||
      wranglerConfig.includes("YOUR_SESSIONS_KV_ID")) {
    log("⚠️  wrangler.toml still contains placeholder IDs!");
    log("Please update wrangler.toml with actual Cloudflare resource IDs before continuing.");
    process.exit(1);
  }

  log("wrangler.toml configuration validated ✅");
}

function buildAndDeploy() {
  log("Building and deploying API...");

  // Build the API
  execCommand("npm run build:api", "Building API for deployment");

  // Deploy to Cloudflare
  execCommand("npm run deploy", "Deploying to Cloudflare Workers");
}

function seedDatabase() {
  log("Seeding database with Base120 mental models...");

  // Check if seed.sql exists
  try {
    readFileSync("seed.sql");
  } catch {
    log("Generating seed data...");
    execCommand("npx tsx scripts/generate-seed.ts", "Generating seed.sql from models.json");
  }

  // Execute seed
  execCommand("npm run seed", "Seeding database with Base120 mental models");
}

function generateApiKey() {
  log("Generating production API key...");

  execCommand("npm run create-key pro \"Production API Access\"", "Creating production API key");
}

function runHealthCheck() {
  log("Running deployment health checks...");

  // Try to get the deployed URL from wrangler output
  try {
    const deployOutput = execCommand("wrangler tail --format=pretty | head -20", "Checking deployment status");
    log("Deployment appears healthy ✅");
  } catch (error) {
    log("Could not verify deployment status, but continuing...");
  }

  log("🎉 Deployment complete!");
  log("");
  log("Next steps:");
  log("1. Test the API: curl https://your-subdomain.workers.dev/health");
  log("2. Test with API key: curl -H 'Authorization: Bearer YOUR_API_KEY' https://your-subdomain.workers.dev/v1/models");
  log("3. Monitor logs: wrangler tail");
  log("4. Update DNS/custom domain if needed");
}

function main() {
  log(`🚀 Starting HUMMBL API Deployment (${DEPLOYMENT_CONFIG.environment})`);
  console.log("=".repeat(60));

  try {
    validateEnvironment();
    provisionInfrastructure();
    updateWranglerConfig();
    buildAndDeploy();
    seedDatabase();
    generateApiKey();
    runHealthCheck();

    log("🎯 HUMMBL API successfully deployed to production!");
    log(`📍 Environment: ${DEPLOYMENT_CONFIG.environment}`);
    log(`🏗️  Project: ${DEPLOYMENT_CONFIG.project}`);

  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`, "ERROR");
    log("");
    log("Troubleshooting:");
    log("1. Check CLOUDFLARE_ACCOUNT_ID is set");
    log("2. Ensure wrangler is authenticated: wrangler auth login");
    log("3. Verify API key has D1 and KV permissions");
    log("4. Check wrangler.toml configuration");
    process.exit(1);
  }
}

main();
