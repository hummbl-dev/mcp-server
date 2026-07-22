# Stripe Integration Plan

## Principle

Stripe is the **commercial state** layer. It answers: "did they pay, what plan are they on?"

Stripe is **not** the auth system. OAuth/Cloudflare Access answers: "who are they, what are they allowed to access?"

```
identity (OAuth/Access) → customer (Stripe) → entitlement → capability (MCP/REST)
```

## Architecture

```
ChatGPT App / Custom GPT / Web App
        ↓
HUMMBL Auth (OAuth / Cloudflare Access)
        ↓
Entitlement Resolver
        ↓
Stripe Billing + Customer Portal
        ↓
MCP / REST capability plane
        ↓
Base120 / HUMMBL models / saved work
```

## Surfaces

| Surface | Purpose | Auth |
|---------|---------|------|
| `mcp.hummbl.io` | Internal/operator MCP, write-capable | Cloudflare Access |
| `mcp-public.hummbl.io` | User-facing MCP, entitlement-aware | OAuth |
| `api.hummbl.io` | REST/OpenAPI facade for Custom GPT + web/mobile | OAuth or API key |
| `billing.hummbl.io` | Stripe Checkout + Customer Portal | Stripe session |
| `app.hummbl.io` | User account, saved work, subscription state | OAuth |

## Stripe product model

### Tiers

| Tier | Price | Access | Limits |
|------|-------|--------|--------|
| Free | $0 | Public methodology, limited `recommend_models`, no saved work | Low rate limits |
| Pro | $19/mo | Full read + export, saved problem frames | Higher limits |
| Team | $49/mo/seat | Shared workspace, seats, team methodology history | Team-level limits |
| Enterprise / Founder OS | Custom | Admin controls, custom model packs, private ontology, support | Custom |

### Stripe products

```
prod_hummbl_free      — $0/mo
prod_hummbl_pro       — $19/mo
prod_hummbl_team      — $49/mo/seat
prod_hummbl_enterprise — custom pricing
```

### Stripe prices

```
price_hummbl_pro_monthly    — $19.00/month
price_hummbl_pro_yearly     — $190.00/year (2 months free)
price_hummbl_team_monthly   — $49.00/month/seat
price_hummbl_team_yearly    — $490.00/year/seat
```

## Endpoints

### Billing

| Method | Path | Description |
|--------|------|-------------|
| POST | `/billing/create-checkout-session` | Create Stripe Checkout session for a plan |
| POST | `/billing/create-portal-session` | Create Stripe Customer Portal session |
| POST | `/webhooks/stripe` | Stripe webhook endpoint |
| GET | `/me/entitlements` | Get current user's entitlements |
| GET | `/me/subscription` | Get current user's subscription status |

### Webhook events to handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update subscription, set entitlements |
| `customer.subscription.updated` | Update entitlements (plan change) |
| `customer.subscription.deleted` | Revoke entitlements |
| `invoice.payment_failed` | Mark subscription past_due, downgrade entitlements |
| `invoice.payment_succeeded` | Confirm subscription active |

## Implementation

### Worker: hummbl-billing

Deploy a separate Cloudflare Worker for Stripe webhooks and billing endpoints.

```toml
# wrangler.billing.toml
name = "hummbl-billing"
main = "dist/billing-server.js"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[routes]]
pattern = "billing.hummbl.io/*"
zone_name = "hummbl.io"

[vars]
ENVIRONMENT = "production"
STRIPE_SUCCESS_URL = "https://app.hummbl.io/account/billing/success"
STRIPE_CANCEL_URL = "https://app.hummbl.io/account/billing/cancel"

# Secrets:
# - STRIPE_SECRET_KEY
# - STRIPE_WEBHOOK_SECRET
# - STRIPE_PRICE_PRO_MONTHLY
# - STRIPE_PRICE_PRO_YEARLY
# - STRIPE_PRICE_TEAM_MONTHLY
# - STRIPE_PRICE_TEAM_YEARLY
```

### Entitlement storage

Store entitlement state in Cloudflare D1 (SQLite):

```sql
CREATE TABLE customers (
  user_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  email TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE subscriptions (
  stripe_subscription_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  stripe_customer_id TEXT NOT NULL,
  status TEXT NOT NULL,  -- active, trialing, past_due, canceled
  plan TEXT NOT NULL,    -- free, pro, team, enterprise
  current_period_end TEXT,
  cancel_at_period_end INTEGER DEFAULT 0,
  seats INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES customers(user_id)
);

CREATE TABLE entitlements (
  user_id TEXT PRIMARY KEY,
  plan TEXT NOT NULL,
  allowed_tools TEXT NOT NULL,  -- JSON array
  rate_limit_per_minute INTEGER NOT NULL,
  rate_limit_per_hour INTEGER NOT NULL,
  write_permissions INTEGER DEFAULT 0,
  export_enabled INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES customers(user_id)
);
```

### Webhook handler

```typescript
// src/billing/webhooks.ts
export async function handleStripeWebhook(
  request: Request,
  env: BillingEnv
): Promise<Response> {
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await request.text();
  const event = stripe.webhooks.constructEvent(
    body,
    sig,
    env.STRIPE_WEBHOOK_SECRET
  );

  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object, env);
      break;
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(event.data.object, env);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(event.data.object, env);
      break;
    case "invoice.payment_failed":
      await handlePaymentFailed(event.data.object, env);
      break;
    case "invoice.payment_succeeded":
      await handlePaymentSucceeded(event.data.object, env);
      break;
  }

  return new Response("OK", { status: 200 });
}
```

## Build sequence

### P0: Stripe product model

1. Create Stripe products and prices in Stripe Dashboard
2. Record price IDs as Worker secrets
3. No code needed yet — just get plan identity right

### P1: Entitlement table

1. Create D1 database with `customers`, `subscriptions`, `entitlements` tables
2. Define entitlement mapping (plan → allowed_tools, limits)
3. Create entitlement resolver function

### P2: Checkout + Portal

1. Deploy `hummbl-billing` Worker
2. Implement `/billing/create-checkout-session`
3. Implement `/billing/create-portal-session`
4. Implement `/webhooks/stripe`
5. Implement `/me/entitlements`
6. Create DNS: `billing.hummbl.io`
7. Test checkout flow end-to-end

### P3: Gate tools by entitlement

1. Add entitlement check to `mcp-public.hummbl.io` before tool execution
2. Add entitlement check to `api.hummbl.io` REST facade
3. Return 403 with upgrade prompt when user lacks entitlement

### P4: ChatGPT in-app checkout (future)

1. Implement Apps SDK `requestCheckout` flow
2. Handle `complete_checkout` tool callback
3. Map ChatGPT checkout to Stripe Checkout session

## Key cautions

- **Do not** let Stripe become the auth system
- **Do not** start with Stripe Connect (marketplace) — start with Billing
- **Do not** expose Stripe secret keys in client-side code
- **Do not** skip webhook signature verification
- **Do** use Stripe Customer Portal for self-service subscription management
- **Do** handle `payment_failed` gracefully (downgrade, don't hard-lock)
- **Do** idempotency keys for checkout sessions

## References

- [Stripe Billing](https://stripe.com/billing)
- [Stripe Customer Portal](https://docs.stripe.com/customer-management)
- [Stripe Connect](https://docs.stripe.com/connect) (future, not now)
- [Apps SDK Monetization](https://developers.openai.com/apps-sdk/build/monetization)
- [Apps SDK Auth](https://developers.openai.com/apps-sdk/build/auth)
- [Buy it in ChatGPT](https://openai.com/index/buy-it-in-chatgpt/)
