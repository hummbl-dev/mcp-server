# 🚀 HUMMBL API - Production Deployment Guide

## Pre-Production Status ✅

The HUMMBL REST API is **ready for production deployment**.
All components have been implemented and tested:

- ✅ **Database Schema**: Complete with 120 mental models
- ✅ **Seed Data**: Generated from enriched JSON (schema v1.1)
- ✅ **REST API**: Hono.js-based with full MCP tool functionality
- ✅ **Infrastructure Scripts**: Automated provisioning for Cloudflare
- ✅ **Authentication**: API key system with tiered access
- ✅ **Deployment Pipeline**: End-to-end deployment automation

## Quick Deploy (Recommended)

### One-Command Deployment

```bash
# Set your Cloudflare account ID
export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"

# Ship it! 🚀
npm run ship
```

This runs the complete deployment pipeline:

1. Environment validation
2. Infrastructure provisioning guidance
3. Configuration validation
4. API build and deployment
5. Database seeding
6. API key generation
7. Health checks

## Manual Deployment Steps

If you prefer step-by-step control:

### 1. Environment Setup

```bash
# Install dependencies
npm install

# Set your Cloudflare account ID
export CLOUDFLARE_ACCOUNT_ID="your-account-id-here"

# Authenticate with Cloudflare
wrangler auth login
```

### 2. Provision Infrastructure

```bash
# Generate provisioning commands
npm run provision

# Execute the displayed wrangler commands manually
wrangler d1 create hummbl-api --account-id=YOUR_ACCOUNT_ID
wrangler kv:namespace create "API_KEYS" --account-id=YOUR_ACCOUNT_ID
wrangler kv:namespace create "SESSIONS" --account-id=YOUR_ACCOUNT_ID
```

### 3. Configure wrangler.toml

Update `wrangler.toml` with the actual resource IDs from step 2:

```toml
[[d1_databases]]
database_name = "hummbl-api"
database_id = "d1_abc123..."  # ← Replace with actual ID

[[kv_namespaces]]
binding = "API_KEYS"
id = "kv_api_xyz789..."  # ← Replace with actual ID

[[kv_namespaces]]
binding = "SESSIONS"
id = "kv_sessions_def456..."  # ← Replace with actual ID
```

### 4. Deploy API

```bash
# Build and deploy
npm run deploy
```

### 5. Seed Database

```bash
# Generate seed data (if not already done)
npx tsx scripts/generate-seed.ts

# Seed the database
npm run seed
```

### 6. Generate API Keys

```bash
# Create production API key
npm run create-key pro "Production Access"
```

## API Endpoints

### Health Check

```bash
curl https://your-subdomain.workers.dev/health
```

### Get Specific Model

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-subdomain.workers.dev/v1/models/P1
```

### List All Models

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://your-subdomain.workers.dev/v1/models
```

### Search Models

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  "https://your-subdomain.workers.dev/v1/search?q=first+principles"
```

### Get Recommendations

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"problem": "My team is stuck on a complex technical decision"}' \
  https://your-subdomain.workers.dev/v1/recommend
```

## API Key Tiers

- **Free**: 1,000 requests/hour, 60 RPM
- **Pro**: 10,000 requests/hour, 600 RPM
- **Enterprise**: Unlimited requests, 6,000 RPM

## Development

```bash
# Local development
npm run dev:api

# Build for production
npm run build:api

# Type checking
npm run typecheck

# Testing
npm run test
```

## Monitoring & Maintenance

```bash
# View logs
wrangler tail

# Check deployment status
wrangler deployments list

# Update API
npm run deploy

# Add new API keys
npm run create-key enterprise "New Enterprise Client"
```

## Environment Variables

Required for deployment:

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID

Optional:

- `NODE_ENV`: Environment name (defaults to "production")

## Troubleshooting

### Common Issues

1. **"CLOUDFLARE_ACCOUNT_ID not set"**
   - Get your account ID from Cloudflare Dashboard → Account → Account ID
   - Set: `export CLOUDFLARE_ACCOUNT_ID="your-id"`

2. **"wrangler auth login" required**
   - Run: `wrangler auth login`
   - Ensure your API token has D1 and KV permissions

3. **Database seeding fails**
   - Check D1 database ID in wrangler.toml
   - Verify database exists: `wrangler d1 list`

4. **API returns 401 Unauthorized**
   - Check API key format (should start with "hummbl_")
   - Verify key was created with correct tier

### Logs & Debugging

```bash
# Real-time logs
wrangler tail

# Deployment logs
wrangler deployments list --latest

# Database inspection
wrangler d1 execute hummbl-api --command="SELECT COUNT(*) FROM mental_models"
```

## Security Notes

- API keys are validated but not stored (stateless authentication)
- Database contains enriched mental model data
- All requests are logged via Cloudflare
- Rate limiting is enforced per API key tier

---

🎯 **The HUMMBL API is now ready for production use!**

Next steps after deployment:

1. Test all endpoints
2. Set up monitoring/alerts
3. Configure custom domain (optional)
4. Document for API consumers
5. Plan for scaling and maintenance
