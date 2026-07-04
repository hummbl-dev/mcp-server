# Entitlement Resolver Design

## Principle

The entitlement resolver sits between auth (who are you?) and capability (what can you do?). It translates Stripe subscription state into tool-level permissions.

```
identity → customer → subscription → entitlement → tool policy
```

## Entitlement mapping

### Plan → tools

| Tool | Free | Pro | Team | Enterprise | Internal |
|------|------|-----|------|------------|----------|
| `get_model` | yes | yes | yes | yes | yes |
| `list_all_models` | yes | yes | yes | yes | yes |
| `search_models` | yes | yes | yes | yes | yes |
| `get_transformation` | yes | yes | yes | yes | yes |
| `search_problem_patterns` | yes | yes | yes | yes | yes |
| `get_methodology` | yes | yes | yes | yes | yes |
| `recommend_models` | limited (5/day) | yes | yes | yes | yes |
| `get_related_models` | no | yes | yes | yes | yes |
| `export_models` | no | yes | yes | yes | yes |
| `get_recommendation_history` | no | yes | yes | yes | yes |
| `add_relationship` | no | no | admin only | yes | yes |
| `audit_model_references` | no | no | admin only | yes | yes |
| `list_workflows` | no | no | yes | yes | yes |
| `start_workflow` | no | no | yes | yes | yes |
| `continue_workflow` | no | no | yes | yes | yes |
| `find_workflow_for_problem` | no | no | yes | yes | yes |

### Plan → rate limits

| Plan | Requests/minute | Requests/hour | Requests/day |
|------|----------------|---------------|--------------|
| Free | 10 | 100 | 500 |
| Pro | 60 | 1000 | 10000 |
| Team | 120 | 2000 | 20000 |
| Enterprise | custom | custom | custom |
| Internal | unlimited | unlimited | unlimited |

### Plan → features

| Feature | Free | Pro | Team | Enterprise |
|---------|------|-----|------|------------|
| Saved problem frames | no | yes | yes (shared) | yes |
| Export (markdown/JSON/PDF) | no | yes | yes | yes |
| Custom model packs | no | no | no | yes |
| Private ontology | no | no | no | yes |
| Team workspace | no | no | yes | yes |
| API access | no | yes | yes | yes |
| Priority support | no | no | no | yes |

## Resolver implementation

### Interface

```typescript
interface Entitlement {
  plan: "free" | "pro" | "team" | "enterprise" | "internal";
  allowedTools: string[];
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
  writePermissions: boolean;
  exportEnabled: boolean;
  dailyRecommendLimit?: number;
}

async function resolveEntitlement(
  userId: string,
  env: Env
): Promise<Entitlement> {
  // 1. Look up customer by user_id
  // 2. Look up active subscription
  // 3. Map subscription plan to entitlement
  // 4. Return entitlement or default to free
}
```

### Default (no subscription)

```typescript
const FREE_ENTITLEMENT: Entitlement = {
  plan: "free",
  allowedTools: [
    "get_model",
    "list_all_models",
    "search_models",
    "get_transformation",
    "search_problem_patterns",
    "get_methodology",
  ],
  rateLimitPerMinute: 10,
  rateLimitPerHour: 100,
  writePermissions: false,
  exportEnabled: false,
  dailyRecommendLimit: 5,
};
```

### Internal (Cloudflare Access)

The internal plane (`mcp.hummbl.io`) does not go through the entitlement resolver. It uses Cloudflare Access groups directly:
- `hummbl-mcp-write` → full profile
- `hummbl-mcp-admin` → admin profile
- default → read-only profile

The public plane (`mcp-public.hummbl.io`) goes through the entitlement resolver.

### Tool gating

Before executing any tool, the MCP server checks:

```typescript
async function checkEntitlement(
  toolName: string,
  userId: string,
  env: Env
): Promise<{ allowed: boolean; reason?: string }> {
  const entitlement = await resolveEntitlement(userId, env);

  if (!entitlement.allowedTools.includes(toolName)) {
    return {
      allowed: false,
      reason: `Tool '${toolName}' requires ${entitlement.plan === "free" ? "a paid plan" : "a higher tier"}. Upgrade at https://billing.hummbl.io.`,
    };
  }

  // Check rate limits
  const withinLimits = await checkRateLimit(userId, entitlement, env);
  if (!withinLimits) {
    return {
      allowed: false,
      reason: "Rate limit exceeded. Please upgrade your plan.",
    };
  }

  // Check daily limits (e.g., recommend_models for free tier)
  if (toolName === "recommend_models" && entitlement.dailyRecommendLimit) {
    const usageToday = await getDailyUsage(userId, "recommend_models", env);
    if (usageToday >= entitlement.dailyRecommendLimit) {
      return {
        allowed: false,
        reason: `Daily limit (${entitlement.dailyRecommendLimit}) reached for recommend_models. Upgrade to Pro for unlimited recommendations.`,
      };
    }
  }

  return { allowed: true };
}
```

### MCP integration

In `HummblPublicMcpAgent`, wrap tool execution:

```typescript
export class HummblPublicMcpAgent extends McpAgent {
  server = new McpServer({
    name: "hummbl-mcp-public",
    version: SERVER_VERSION,
  });

  async init() {
    const server = this.server;

    // Wrap each tool with entitlement check
    const originalRegisterTool = server.registerTool.bind(server);
    server.registerTool = (name, config, handler) => {
      return originalRegisterTool(name, config, async (args, extra) => {
        const userId = getUserIdFromSession(extra);
        const entitlement = await resolveEntitlement(userId, this.env);

        if (!entitlement.allowedTools.includes(name)) {
          return {
            content: [{
              type: "text",
              text: `This tool requires a paid plan. Upgrade at https://billing.hummbl.io.`,
            }],
            isError: true,
          };
        }

        return handler(args, extra);
      });
    };

    registerPublicModelTools(server);
    registerMethodologyTools(server);
  }
}
```

### REST facade integration

In `api.hummbl.io`, check entitlement before each endpoint:

```typescript
app.get("/v1/recommend", async (c) => {
  const userId = getUserIdFromAuth(c);
  const entitlement = await resolveEntitlement(userId, c.env);

  if (!entitlement.allowedTools.includes("recommend_models")) {
    return c.json({
      error: "upgrade_required",
      message: "Recommend models requires a Pro plan.",
      upgrade_url: "https://billing.hummbl.io",
    }, 403);
  }

  // ... handle request
});
```

## Rate limiting

### Implementation

Use Cloudflare Durable Object storage or KV for rate limit counters:

```typescript
async function checkRateLimit(
  userId: string,
  entitlement: Entitlement,
  env: Env
): Promise<boolean> {
  const now = Date.now();
  const minuteKey = `rate:${userId}:minute:${Math.floor(now / 60000)}`;
  const hourKey = `rate:${userId}:hour:${Math.floor(now / 3600000)}`;

  const minuteCount = await env.RATE_LIMITS.get(minKey) || 0;
  const hourCount = await env.RATE_LIMITS.get(hourKey) || 0;

  if (minuteCount >= entitlement.rateLimitPerMinute) return false;
  if (hourCount >= entitlement.rateLimitPerHour) return false;

  await env.RATE_LIMITS.put(minuteKey, minuteCount + 1, { expirationTtl: 120 });
  await env.RATE_LIMITS.put(hourKey, hourCount + 1, { expirationTtl: 7200 });

  return true;
}
```

## Subscription state transitions

```
free → checkout → trialing → active (pro/team)
active → payment_failed → past_due → grace_period → canceled → free
active → user_cancels → cancel_at_period_end → canceled → free
active → upgrade → active (new plan)
active → downgrade → active (new plan, at period end)
```

### Grace period

When `payment_failed`:
1. Mark subscription `past_due`
2. Keep entitlements active for 7 days (grace period)
3. After 7 days, downgrade to free
4. Send email notification

## References

- [Stripe Billing](https://stripe.com/billing)
- [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview)
- [Apps SDK Auth](https://developers.openai.com/apps-sdk/build/auth)
- [Stripe integration plan](./stripe-integration-plan.md)
