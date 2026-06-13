# Remote MCP Deployment Guide

This guide covers deploying the HUMMBL MCP server as a remote MCP with OAuth 2.0 authentication for submission to the Anthropic MCP Directory.

## Prerequisites

### GitHub OAuth App Setup

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Configure the app:
   - **Application name**: HUMMBL MCP Server
   - **Homepage URL**: `https://hummbl.io`
   - **Application description**: Model Context Protocol server for HUMMBL Base120 mental models
   - **Authorization callback URL**: `https://your-domain.com/auth/callback`
4. Click "Register application"
5. Generate a new client secret
6. Note down:
   - **Client ID**
   - **Client Secret**

### Environment Variables

The following environment variables must be configured:

```bash
# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=https://your-domain.com/auth/callback

# Session Security
SESSION_SECRET=your_random_session_secret_at_least_32_chars

# Server Configuration
PORT=3000
NODE_ENV=production

# Optional: HUMMBL API Key for recommend_models tool
HUMMBL_API_KEY=your_hummbl_api_key
```

### Anthropic IP Allowlisting

Anthropic's cloud infrastructure connects to your server from specific IP ranges. You must allowlist these IPs in your firewall:

**Current Anthropic IP ranges** (check [Anthropic documentation](https://docs.anthropic.com) for current ranges):

```
# Example - always verify current ranges from Anthropic docs
# Add these to your firewall allowlist
```

## Deployment Options

### Option 1: Self-Host on Anvil (Recommended for Initial Deployment)

Self-hosting on Anvil alongside Gitea provides full control, zero additional cost, and fits your existing infrastructure.

**Anvil Specs**: AMD Ryzen 7 5800X (8C/16T), 32GB RAM, RTX 3080 Ti, home network connection

**Realistic Capacity**: 50-200 concurrent users, 1,000-5,000 daily active users

1. **Navigate to project directory**:
   ```bash
   cd C:/Users/Owner/PROJECTS/mcp-server
   ```

2. **Install dependencies**:
   ```bash
   npm install
   npm run build
   ```

3. **Configure environment variables**:
   Create `.env` file:
   ```bash
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_REDIRECT_URI=https://anvil.tail0ff7b3.ts.net/auth/callback
   SESSION_SECRET=your_random_session_secret_at_least_32_chars
   PORT=3000
   NODE_ENV=production
   ```

4. **Set up Windows Service** (for auto-start):
   Using NSSM (Non-Sucking Service Manager):
   ```bash
   # Download NSSM from https://nssm.cc/download
   nssm install HUMMBL-MCP "C:\Program Files\nodejs\node.exe" "C:\Users\Owner\PROJECTS\cp-server\dist\http-server.js"
   nssm set HUMMBL-MCP AppDirectory "C:\Users\Owner\PROJECTS\mcp-server"
   nssm set HUMMBL-MCP Environment "GITHUB_CLIENT_ID=your_client_id|GITHUB_CLIENT_SECRET=your_secret|..."
   nssm start HUMMBL-MCP
   ```

5. **Configure Tailscale Serve** (for HTTPS):
   Since you already use Tailscale for Gitea:
   ```bash
   tailscale serve 3000
   tailscale serve https
   ```

6. **Update GitHub OAuth redirect URI**:
   Set to: `https://anvil.tail0ff7b3.ts.net/auth/callback`

### Option 2: Railway (Cloud Alternative)

Railway supports long-running processes better than serverless platforms like Vercel.

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Create new project**:
   ```bash
   railway login
   railway init
   ```

3. **Add environment variables** in Railway dashboard

4. **Deploy**:
   ```bash
   railway up
   ```

### Option 3: DigitalOcean Droplet (Full Control)

For when you need dedicated cloud infrastructure.

1. **Create droplet** with Node.js (Ubuntu 22.04)

2. **SSH into droplet**:
   ```bash
   ssh root@your-droplet-ip
   ```

3. **Install dependencies**:
   ```bash
   apt update
   apt install -y nodejs npm
   ```

4. **Clone repository**:
   ```bash
   git clone https://github.com/hummbl-dev/mcp-server.git
   cd mcp-server
   npm install
   npm run build
   ```

5. **Configure environment variables**:
   ```bash
   nano .env
   # Add your environment variables
   ```

6. **Install PM2** for process management:
   ```bash
   npm install -g pm2
   ```

7. **Start server with PM2**:
   ```bash
   pm2 start dist/http-server.js --name hummbl-mcp
   pm2 save
   pm2 startup
   ```

8. **Configure firewall** (UFW):
   ```bash
   ufw allow 22/tcp    # SSH
   ufw allow 80/tcp    # HTTP
   ufw allow 443/tcp   # HTTPS
   ufw enable
   ```

9. **Set up SSL with Let's Encrypt**:
   ```bash
   apt install certbot python3-certbot-nginx
   certbot certonly --standalone -d your-domain.com
   ```

### Option 4: Vercel (Not Recommended for MCP)

Vercel is serverless-first and has limitations for MCP servers:
- **Serverless function timeouts** (10-60 seconds) break SSE connections
- **Cold starts** cause connection drops for long-lived streams
- **Not optimized** for persistent SSE connections

Only use Vercel if you understand these limitations and can work around them.

## Network Configuration

### DNS Configuration

1. **Add A record** pointing to your server IP:
   ```
   A    @    your-server-ip
   ```

2. **Add CNAME** if using CDN:
   ```
   CNAME www    your-cdn-provider.com
   ```

### SSL/TLS Configuration

All production deployments must use HTTPS. Most platforms (Vercel, Railway) provide automatic SSL.

For manual deployments, use Let's Encrypt:
```bash
certbot certonly --standalone -d your-domain.com
```

## Capacity Limits and Scaling Protections

### Self-Hosted Capacity (Anvil)

**Hardware Limits**:
- CPU: 8 cores / 16 threads
- RAM: 32 GB
- Network: Home connection (100-1000 Mbps uplink)
- Single point of failure

**Realistic Capacity**:
- **Concurrent users**: 50-200 max (depending on tool complexity)
- **Daily active users**: 1,000-5,000 (with good caching)
- **Request rate**: 10-50 requests/second sustainable

**What Happens at Scale**:
If 100,000 users tried to access simultaneously:
- Connection limits would be exceeded immediately
- RAM would be exhausted by session storage
- Network would saturate
- CPU would thermal throttle
- Server would crash within seconds

### Built-in Scaling Protections

Add these protections to `src/http-server.ts`:

```typescript
import rateLimit from 'express-rate-limit';

// Rate limiting per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: { error: 'Too many requests from this IP' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Connection limit (prevent overload)
const MAX_CONCURRENT = 200;
let activeConnections = 0;

const connectionLimiter = (req: any, res: any, next: any) => {
  if (activeConnections >= MAX_CONCURRENT) {
    return res.status(503).json({
      error: 'Server at capacity',
      message: 'Try again later',
      capacity: MAX_CONCURRENT
    });
  }
  activeConnections++;
  res.on('close', () => {
    activeConnections--;
  });
  next();
};

// Apply middleware
app.use(limiter);
app.use(connectionLimiter);
```

### Scaling Strategy

**Phase 1: Self-Hosted (0-1k users)**
- Deploy on Anvil
- Monitor CPU/RAM/network usage
- Set alerts at 70% thresholds
- Rate limiting: 100 req/min per session
- Connection limit: 200 concurrent

**Phase 2: Multi-Server (1k-10k users)**
- Add second server (nodezero?)
- Configure load balancer (nginx/HAProxy)
- Add Redis for session storage
- Migrate from SQLite to PostgreSQL
- Geographic distribution if needed

**Phase 3: Cloud Migration (10k-100k users)**
- Migrate to Railway or DigitalOcean managed services
- Implement auto-scaling
- Add CDN (Cloudflare)
- Professional monitoring (Prometheus/Grafana)
- 24/7 operations support

### Monitoring Thresholds

Set up alerts for:
- CPU > 80% for 5 minutes
- RAM > 80% for 5 minutes
- Network bandwidth > 80% capacity
- Active connections > 150 (75% of limit)
- Error rate > 5%
- Response time > 2 seconds (p95)

### Graceful Degradation

When approaching capacity limits:
1. **Rate limit new connections**: Return 503 with retry-after header
2. **Prioritize authenticated users**: Queue unauthenticated requests
3. **Cache aggressively**: Reduce database load
4. **Disable non-critical features**: Temporarily disable heavy tools
5. **Failover to read-only**: If write capacity is exhausted

## Testing Deployment

### 1. Health Check
```bash
curl https://your-domain.com/health
```

Expected response:
```json
{
  "status": "healthy",
  "version": "1.2.0",
  "transport": "http/sse",
  "authentication": "oauth2",
  "timestamp": "2026-05-27T10:30:00.000Z"
}
```

### 2. OAuth Flow Test
```bash
curl https://your-domain.com/auth/login
```

Expected response:
```json
{
  "authUrl": "https://github.com/login/oauth/authorize?...",
  "state": "abc123..."
}
```

### 3. SSE Connection Test
```bash
curl -H "Authorization: Bearer YOUR_SESSION_ID" \
  https://your-domain.com/sse
```

### 4. Tool Invocation Test
Use Claude Desktop or MCP client to connect to:
```
https://your-domain.com/sse
```

With authorization header:
```
Authorization: Bearer YOUR_SESSION_ID
```

## Monitoring and Logging

### Application Logs
- **Vercel**: View in dashboard → Logs
- **Railway**: View in dashboard → Logs
- **DigitalOcean**: `pm2 logs hummbl-mcp`
- **Cloudflare**: `wrangler tail`

### Health Monitoring
Set up uptime monitoring (e.g., UptimeRobot, Pingdom) for:
- `/health` endpoint
- SSL certificate expiry
- Response time monitoring

## Security Best Practices

1. **Never commit secrets** to repository
2. **Use environment variables** for all sensitive data
3. **Enable HTTPS only** in production
4. **Keep dependencies updated**: `npm audit fix`
5. **Monitor for vulnerabilities**: `npm audit`
6. **Rate limiting**: Implement application-level rate limiting (100 req/min per IP)
7. **Connection limits**: Enforce maximum concurrent connections (200 for self-hosted)
8. **Session security**: Use secure random session secrets
9. **CORS**: Restrict CORS origins in production if needed
10. **Capacity monitoring**: Set alerts for CPU/RAM/network thresholds
11. **Graceful degradation**: Implement failover mechanisms at capacity limits

## Troubleshooting

### OAuth Callback Fails
- Verify GitHub OAuth app redirect URI matches exactly
- Check environment variables are set correctly
- Review server logs for error messages

### SSE Connection Drops
- Check firewall allows Anthropic IP ranges
- Verify SSL certificate is valid
- Monitor server logs for connection errors

### Tools Not Working
- Verify session is valid (24-hour expiry)
- Check authorization header format: `Bearer SESSION_ID`
- Review server logs for authentication errors

### Build Failures
- Ensure Node.js version >= 20.0.0
- Run `npm install` to update dependencies
- Check TypeScript compilation: `npm run typecheck`

## Production Checklist

Before submitting to Anthropic MCP Directory:

- [ ] Server deployed to public URL with HTTPS
- [ ] Health check endpoint accessible
- [ ] OAuth flow working end-to-end
- [ ] SSE endpoint accessible with authentication
- [ ] All 13 tools functional
- [ ] Tool annotations present (readOnlyHint/destructiveHint)
- [ ] Privacy policy published at https://hummbl.io/privacy
- [ ] Anthropic IP ranges allowlisted in firewall
- [ ] SSL certificate valid and not expiring soon
- [ ] Environment variables configured securely
- [ ] Monitoring and logging configured
- [ ] Error handling and graceful degradation
- [ ] Rate limiting configured (100 req/min per IP)
- [ ] Connection limits enforced (200 concurrent for self-hosted)
- [ ] Capacity monitoring alerts configured (CPU/RAM/network at 70%)
- [ ] Documentation updated with deployment instructions
- [ ] Scaling strategy documented (Phase 1/2/3 plan)
- [ ] Load testing completed (verify capacity limits)

## Support

For deployment issues:
- GitHub Issues: https://github.com/hummbl-dev/mcp-server/issues
- Email: reuben@hummbl.io
- Documentation: https://github.com/hummbl-dev/mcp-server#readme
