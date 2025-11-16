/**
 * Input sanitization utilities for HUMMBL MCP Server
 * Protects against injection attacks and validates user input
 */

/**
 * Maximum allowed length for problem descriptions
 */
const MAX_PROBLEM_LENGTH = 5000;

/**
 * Maximum allowed length for search queries
 */
const MAX_QUERY_LENGTH = 500;

/**
 * Patterns that indicate potential malicious content
 */
const SUSPICIOUS_PATTERNS = [
  /<script[^>]*>.*?<\/script>/gi, // Script tags
  /javascript:/gi, // JavaScript protocol
  /on\w+\s*=/gi, // Event handlers
  /<iframe[^>]*>/gi, // Iframes
  /<object[^>]*>/gi, // Object tags
  /<embed[^>]*>/gi, // Embed tags
];

/**
 * Sanitize user-provided text input
 * Removes potentially dangerous content while preserving legitimate text
 */
export function sanitizeText(input: string, maxLength: number = MAX_PROBLEM_LENGTH): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  // Trim whitespace
  let sanitized = input.trim();

  // Enforce length limits
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // Remove suspicious patterns
  for (const pattern of SUSPICIOUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Remove null bytes and control characters (except newlines, tabs, carriage returns)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized;
}

/**
 * Sanitize problem description with stricter validation
 */
export function sanitizeProblemDescription(problem: string): string {
  const sanitized = sanitizeText(problem, MAX_PROBLEM_LENGTH);

  // Problem descriptions must have minimum length
  if (sanitized.length < 10) {
    throw new Error("Problem description must be at least 10 characters");
  }

  return sanitized;
}

/**
 * Sanitize search query with appropriate limits
 */
export function sanitizeQuery(query: string): string {
  const sanitized = sanitizeText(query, MAX_QUERY_LENGTH);

  // Queries must have minimum length
  if (sanitized.length < 2) {
    throw new Error("Query must be at least 2 characters");
  }

  return sanitized;
}

/**
 * Validate model code format
 * Only allows codes matching the pattern [P|IN|CO|DE|RE|SY][1-20]
 */
export function validateModelCode(code: string): string {
  if (!code || typeof code !== "string") {
    throw new Error("Model code is required");
  }

  const normalized = code.toUpperCase().trim();
  const pattern = /^(P|IN|CO|DE|RE|SY)([1-9]|1[0-9]|20)$/;

  if (!pattern.test(normalized)) {
    throw new Error(
      `Invalid model code format: '${code}'. Expected format: [P|IN|CO|DE|RE|SY][1-20]`
    );
  }

  return normalized;
}

/**
 * Validate transformation key
 * Only allows: P, IN, CO, DE, RE, SY
 */
export function validateTransformationKey(key: string): string {
  if (!key || typeof key !== "string") {
    throw new Error("Transformation key is required");
  }

  const normalized = key.toUpperCase().trim();
  const validKeys = ["P", "IN", "CO", "DE", "RE", "SY"];

  if (!validKeys.includes(normalized)) {
    throw new Error(
      `Invalid transformation key: '${key}'. Valid keys: ${validKeys.join(", ")}`
    );
  }

  return normalized;
}

/**
 * Rate limiting helper - tracks request counts per time window
 */
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private windowMs: number;
  private maxRequests: number;

  constructor(windowMs: number = 60000, maxRequests: number = 100) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request should be allowed
   */
  public allow(identifier: string): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(identifier) || [];

    // Remove old timestamps outside the window
    const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);

    if (validTimestamps.length >= this.maxRequests) {
      return false;
    }

    // Add current timestamp
    validTimestamps.push(now);
    this.requests.set(identifier, validTimestamps);

    return true;
  }

  /**
   * Get remaining requests in current window
   */
  public remaining(identifier: string): number {
    const now = Date.now();
    const timestamps = this.requests.get(identifier) || [];
    const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);
    return Math.max(0, this.maxRequests - validTimestamps.length);
  }

  /**
   * Clear rate limit for identifier
   */
  public clear(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Clean up old entries (call periodically)
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [identifier, timestamps] of this.requests.entries()) {
      const validTimestamps = timestamps.filter((ts) => now - ts < this.windowMs);
      if (validTimestamps.length === 0) {
        this.requests.delete(identifier);
      } else {
        this.requests.set(identifier, validTimestamps);
      }
    }
  }
}

/**
 * Global rate limiter instance
 * 100 requests per minute per tool
 */
export const rateLimiter = new RateLimiter(60000, 100);
