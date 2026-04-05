/**
 * HUMMBL API Authentication Utilities
 * Handles API key validation, rate limiting, and KV-based authentication
 */

import type { ApiKeyInfo, ApiKeyTier, AuthResult } from "../types/domain.js";
import type { KVNamespace } from "@cloudflare/workers-types";

/**
 * Rate limits by tier
 */
const TIER_LIMITS = {
  free: {
    requestsPerHour: 100,
    requestsPerDay: 1000,
  },
  pro: {
    requestsPerHour: 1000,
    requestsPerDay: 10000,
  },
  enterprise: {
    requestsPerHour: 10000,
    requestsPerDay: 100000,
  },
} as const;

/**
 * Permissions by tier
 */
const TIER_PERMISSIONS = {
  free: ["read:health", "read:models", "read:transformations"],
  pro: ["read:health", "read:models", "read:transformations", "read:search", "read:recommend"],
  enterprise: [
    "read:health",
    "read:models",
    "read:transformations",
    "read:search",
    "read:recommend",
    "admin:*",
  ],
} as const;

/**
 * Validate API key format
 */
export function isValidApiKeyFormat(key: string): boolean {
  return typeof key === "string" && key.startsWith("hummbl_") && key.length > 7;
}

/**
 * Generate a new API key
 */
export function generateApiKey(tier: ApiKeyTier, name: string): ApiKeyInfo {
  const id =
    crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const key = `hummbl_${crypto?.randomUUID?.().replace(/-/g, "").substring(0, 16) || Math.random().toString(36).substr(2, 16)}`;

  return {
    id,
    key,
    tier,
    name,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    rateLimit: TIER_LIMITS[tier],
    permissions: TIER_PERMISSIONS[tier],
    isActive: true,
  };
}

/**
 * Validate API key against KV store
 */
export async function validateApiKey(kv: KVNamespace, apiKey: string): Promise<AuthResult> {
  try {
    if (!isValidApiKeyFormat(apiKey)) {
      return {
        ok: false,
        error: {
          type: "INVALID_FORMAT",
          message: "API key must start with 'hummbl_' and be properly formatted",
        },
      };
    }

    const keyData = await kv.get(apiKey);
    if (!keyData) {
      return {
        ok: false,
        error: {
          type: "KEY_NOT_FOUND",
          message: "API key not found",
        },
      };
    }

    const keyInfo: ApiKeyInfo = JSON.parse(keyData);

    if (!keyInfo.isActive) {
      return {
        ok: false,
        error: {
          type: "KEY_INACTIVE",
          message: "API key is inactive",
        },
      };
    }

    // Rate limiting check using fixed-window counters in KV
    const rateLimitResult = await checkRateLimit(kv, keyInfo);
    if (!rateLimitResult.ok) {
      return rateLimitResult;
    }

    return {
      ok: true,
      value: keyInfo,
    };
  } catch (error) {
    console.error("API key validation error:", error);
    return {
      ok: false,
      error: {
        type: "INTERNAL_ERROR",
        message: "Authentication service error",
      },
    };
  }
}

/**
 * Check and increment rate limit counters for an API key.
 *
 * Uses fixed-window counters stored in KV with TTL:
 *   rl:{key}:h:{hourBucket}  (expires after 1h)
 *   rl:{key}:d:{dayBucket}   (expires after 24h)
 *
 * Returns an AuthResult: ok=true when the request is allowed, ok=false with
 * RATE_LIMIT_EXCEEDED otherwise.
 */
export async function checkRateLimit(kv: KVNamespace, keyInfo: ApiKeyInfo): Promise<AuthResult> {
  const now = Date.now();
  const hourBucket = Math.floor(now / 3_600_000);
  const dayBucket = Math.floor(now / 86_400_000);
  const hourKey = `rl:${keyInfo.key}:h:${hourBucket}`;
  const dayKey = `rl:${keyInfo.key}:d:${dayBucket}`;

  const [hourRaw, dayRaw] = await Promise.all([kv.get(hourKey), kv.get(dayKey)]);
  const hourCount = hourRaw ? parseInt(hourRaw, 10) || 0 : 0;
  const dayCount = dayRaw ? parseInt(dayRaw, 10) || 0 : 0;

  if (hourCount >= keyInfo.rateLimit.requestsPerHour) {
    return {
      ok: false,
      error: {
        type: "RATE_LIMIT_EXCEEDED",
        message: `Hourly rate limit exceeded (${keyInfo.rateLimit.requestsPerHour} requests/hour)`,
      },
    };
  }

  if (dayCount >= keyInfo.rateLimit.requestsPerDay) {
    return {
      ok: false,
      error: {
        type: "RATE_LIMIT_EXCEEDED",
        message: `Daily rate limit exceeded (${keyInfo.rateLimit.requestsPerDay} requests/day)`,
      },
    };
  }

  // Increment counters with TTL. Fire-and-forget on writes to keep latency low.
  await Promise.all([
    kv.put(hourKey, String(hourCount + 1), { expirationTtl: 3600 }),
    kv.put(dayKey, String(dayCount + 1), { expirationTtl: 86400 }),
  ]);

  return { ok: true, value: keyInfo };
}

/**
 * Store API key in KV store
 */
export async function storeApiKey(kv: KVNamespace, keyInfo: ApiKeyInfo): Promise<boolean> {
  try {
    await kv.put(keyInfo.key, JSON.stringify(keyInfo));
    return true;
  } catch (error) {
    console.error("Failed to store API key:", error);
    return false;
  }
}

/**
 * List all API keys (admin function)
 */
export async function listApiKeys(kv: KVNamespace): Promise<ApiKeyInfo[]> {
  try {
    const keys = await kv.list({ prefix: "hummbl_" });
    const keyInfos: ApiKeyInfo[] = [];

    for (const key of keys.keys) {
      const data = await kv.get(key.name);
      if (data) {
        keyInfos.push(JSON.parse(data));
      }
    }

    return keyInfos;
  } catch (error) {
    console.error("Failed to list API keys:", error);
    return [];
  }
}
