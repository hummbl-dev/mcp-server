/**
 * HUMMBL API Authentication Utilities
 * Handles API key validation, rate limiting, and KV-based authentication
 */

import type { ApiKeyInfo, ApiKeyTier, AuthResult } from "../types/domain.js";

// Cloudflare Workers types
declare const KVNamespace: any;

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
  enterprise: ["read:health", "read:models", "read:transformations", "read:search", "read:recommend", "admin:*"],
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
  const id = crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
export async function validateApiKey(
  kv: KVNamespace,
  apiKey: string
): Promise<AuthResult> {
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

    // TODO: Implement rate limiting check using usage tracking
    // For now, just return success

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
