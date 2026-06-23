/**
 * Unit tests for input sanitization
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import {
  sanitizeText,
  sanitizeProblemDescription,
  sanitizeQuery,
  validateModelCode,
  validateTransformationKey,
  rateLimiter,
} from "../utils/sanitize.js";

describe("Input Sanitization", () => {
  describe("sanitizeText", () => {
    it("should remove script tags", () => {
      const input = "Hello <script>alert('xss')</script> world";
      const result = sanitizeText(input);
      expect(result).not.toContain("<script>");
      expect(result).toContain("Hello");
      expect(result).toContain("world");
    });

    it("should remove javascript protocol", () => {
      const input = "Click javascript:alert('xss') here";
      const result = sanitizeText(input);
      expect(result).not.toContain("javascript:");
    });

    it("should remove event handlers", () => {
      const input = "<div onclick=\"alert('xss')\">Test</div>";
      const result = sanitizeText(input);
      expect(result).not.toContain("onclick=");
    });

    it("should enforce length limits", () => {
      const input = "a".repeat(10000);
      const result = sanitizeText(input, 100);
      expect(result.length).toBe(100);
    });

    it("should preserve legitimate text", () => {
      const input = "This is a normal problem description with numbers 123";
      const result = sanitizeText(input);
      expect(result).toBe(input);
    });

    it("should trim whitespace", () => {
      const input = "  spaces around  ";
      const result = sanitizeText(input);
      expect(result).toBe("spaces around");
    });

    it("should handle empty input", () => {
      expect(sanitizeText("")).toBe("");
      expect(sanitizeText(null as any)).toBe("");
      expect(sanitizeText(undefined as any)).toBe("");
    });
  });

  describe("sanitizeProblemDescription", () => {
    it("should accept valid problem descriptions", () => {
      const input = "Our startup is growing rapidly but systems are breaking";
      const result = sanitizeProblemDescription(input);
      expect(result).toBe(input);
    });

    it("should reject too short descriptions", () => {
      expect(() => sanitizeProblemDescription("short")).toThrow();
    });

    it("should sanitize and validate", () => {
      const input = "Long problem <script>alert('xss')</script> description here";
      const result = sanitizeProblemDescription(input);
      expect(result).not.toContain("<script>");
      expect(result.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe("sanitizeQuery", () => {
    it("should accept valid queries", () => {
      const input = "decision making";
      const result = sanitizeQuery(input);
      expect(result).toBe(input);
    });

    it("should reject too short queries", () => {
      expect(() => sanitizeQuery("a")).toThrow();
    });

    it("should enforce query length limits", () => {
      const input = "a".repeat(1000);
      const result = sanitizeQuery(input);
      expect(result.length).toBeLessThanOrEqual(500);
    });
  });

  describe("validateModelCode", () => {
    it("should accept valid codes", () => {
      const validCodes = ["P1", "IN5", "CO10", "DE15", "RE20", "SY3"];
      validCodes.forEach((code) => {
        expect(validateModelCode(code)).toBe(code);
      });
    });

    it("should normalize to uppercase", () => {
      expect(validateModelCode("p1")).toBe("P1");
      expect(validateModelCode("in5")).toBe("IN5");
    });

    it("should reject invalid formats", () => {
      expect(() => validateModelCode("INVALID")).toThrow();
      expect(() => validateModelCode("P0")).toThrow();
      expect(() => validateModelCode("P21")).toThrow();
      expect(() => validateModelCode("XX1")).toThrow();
    });

    it("should reject empty or null", () => {
      expect(() => validateModelCode("")).toThrow();
      expect(() => validateModelCode(null as any)).toThrow();
    });
  });

  describe("validateTransformationKey", () => {
    it("should accept valid keys", () => {
      const validKeys = ["P", "IN", "CO", "DE", "RE", "SY"];
      validKeys.forEach((key) => {
        expect(validateTransformationKey(key)).toBe(key);
      });
    });

    it("should normalize to uppercase", () => {
      expect(validateTransformationKey("p")).toBe("P");
      expect(validateTransformationKey("in")).toBe("IN");
    });

    it("should reject invalid keys", () => {
      expect(() => validateTransformationKey("INVALID")).toThrow();
      expect(() => validateTransformationKey("XX")).toThrow();
    });

    it("should reject empty or null", () => {
      expect(() => validateTransformationKey("")).toThrow();
      expect(() => validateTransformationKey(null as any)).toThrow();
    });
  });

  describe("RateLimiter", () => {
    afterEach(() => {
      rateLimiter.clear("limit-test-user");
      rateLimiter.clear("cleanup-test-user");
      vi.useRealTimers();
    });

    it("should allow requests within limit", () => {
      rateLimiter.clear("test-user-1");
      expect(rateLimiter.allow("test-user-1")).toBe(true);
      expect(rateLimiter.allow("test-user-1")).toBe(true);
    });

    it("should track remaining requests", () => {
      rateLimiter.clear("test-user-2");
      const initial = rateLimiter.remaining("test-user-2");
      rateLimiter.allow("test-user-2");
      const after = rateLimiter.remaining("test-user-2");
      expect(after).toBe(initial - 1);
    });

    it("should clear rate limits", () => {
      rateLimiter.clear("test-user-3");
      rateLimiter.allow("test-user-3");
      expect(rateLimiter.remaining("test-user-3")).toBeLessThan(100);
      rateLimiter.clear("test-user-3");
      expect(rateLimiter.remaining("test-user-3")).toBe(100);
    });

    it("should reject when exceeding max requests", () => {
      rateLimiter.clear("limit-test-user");
      for (let i = 0; i < 100; i += 1) {
        expect(rateLimiter.allow("limit-test-user")).toBe(true);
      }
      expect(rateLimiter.allow("limit-test-user")).toBe(false);
    });

    it("should clean up expired timestamps", () => {
      vi.useFakeTimers();
      const now = Date.now();
      rateLimiter.clear("cleanup-test-user");
      vi.setSystemTime(now);

      for (let i = 0; i < 5; i += 1) {
        expect(rateLimiter.allow("cleanup-test-user")).toBe(true);
      }

      vi.advanceTimersByTime(60001); // Advance beyond window
      rateLimiter.cleanup();

      expect(rateLimiter.remaining("cleanup-test-user")).toBe(100);
    });
  });
});
