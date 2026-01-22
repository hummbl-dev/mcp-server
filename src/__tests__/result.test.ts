/**
 * Unit tests for Result utility pattern
 */

import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, type DomainError, Result } from "../types/domain.js";

describe("Result Pattern", () => {
  describe("ok", () => {
    it("should create success result", () => {
      const result = ok(42);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(42);
      }
    });

    it("should work with objects", () => {
      const data = { name: "test" };
      const result = ok(data);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toEqual(data);
      }
    });

    it("should work with null", () => {
      const result = ok(null);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });

  describe("err", () => {
    it("should create error result", () => {
      const error: DomainError = { type: "Internal", message: "test error" };
      const result = err<DomainError>(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(error);
      }
    });

    it("should work with string errors", () => {
      const error: DomainError = { type: "Unknown", message: "error message" };
      const result = err<DomainError>(error);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error).toEqual(error);
      }
    });
  });

  describe("isOk", () => {
    it("should return true for success result", () => {
      const result: Result<number> = ok(42);
      expect(isOk(result)).toBe(true);
    });

    it("should return false for error result", () => {
      const result: Result<number> = err<DomainError>({ type: "Internal", message: "test" });
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
      const result: Result<number> = err<DomainError>({ type: "Internal", message: "test" });
      expect(isErr(result)).toBe(true);
    });

    it("should return false for success result", () => {
      const result: Result<number> = ok(42);
      expect(isErr(result)).toBe(false);
    });

    it("should narrow type correctly", () => {
      const result: Result<number> = err<DomainError>({ type: "Internal", message: "test" });
      if (isErr(result)) {
        const error: DomainError = result.error;
        if (error.type === "Internal") {
          expect(error.message).toBe("test");
        } else {
          throw new Error("Expected Internal error type for this test");
        }
      }
    });
  });
});
