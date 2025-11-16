/**
 * Unit tests for Result utility pattern
 */

import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, Result } from "../types/domain.js";

describe("Result Pattern", () => {
  describe("ok", () => {
    it("should create success result", () => {
      const result = ok(42);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe(42);
      }
    });

    it("should work with objects", () => {
      const data = { name: "test" };
      const result = ok(data);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toEqual(data);
      }
    });

    it("should work with null", () => {
      const result = ok(null);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("err", () => {
    it("should create error result", () => {
      const error = new Error("test error");
      const result = err(error);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe(error);
      }
    });

    it("should work with string errors", () => {
      const result = err("error message");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe("error message");
      }
    });
  });

  describe("isOk", () => {
    it("should return true for success result", () => {
      const result: Result<number> = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it("should return false for error result", () => {
      const result: Result<number> = err(new Error("test"));
      expect(isOk(result)).toBe(false);
    });

    it("should narrow type correctly", () => {
      const result: Result<number> = ok(42);
      if (isOk(result)) {
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });
  });

  describe("isErr", () => {
    it("should return true for error result", () => {
      const result: Result<number> = err(new Error("test"));
      expect(isErr(result)).toBe(true);
    });

    it("should return false for success result", () => {
      const result: Result<number> = ok(42);
      expect(isErr(result)).toBe(false);
    });

    it("should narrow type correctly", () => {
      const result: Result<number> = err(new Error("test"));
      if (isErr(result)) {
        const error: Error = result.error;
        expect(error.message).toBe("test");
      }
    });
  });
});
