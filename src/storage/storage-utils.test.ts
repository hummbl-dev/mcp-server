import { describe, it, expect, vi } from "vitest";
import { safeRedisCall, safeD1Call, parseJsonSafe } from "./storage-utils.js";
import { Logger } from "../observability/logger.js";

const createLogger = () => new Logger(1);

describe("storage utils", () => {
  it("returns fallback when Redis operation fails", async () => {
    const logger = createLogger();
    const warnSpy = vi.spyOn(logger, "warn");

    const result = await safeRedisCall(logger, {
      operation: "redis.test",
      context: { key: "sample" },
      fn: async () => {
        throw new Error("redis down");
      },
      fallbackValue: false,
    });

    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("rethrows when D1 operation fails", async () => {
    const logger = createLogger();
    const errorSpy = vi.spyOn(logger, "error");

    await expect(
      safeD1Call(logger, {
        operation: "d1.test",
        context: { query: "INSERT" },
        fn: async () => {
          throw new Error("d1 down");
        },
      })
    ).rejects.toThrow("d1 down");

    expect(errorSpy).toHaveBeenCalled();
  });

  it("parses JSON safely with fallback", () => {
    const logger = createLogger();
    const warnSpy = vi.spyOn(logger, "warn");

    const parsed = parseJsonSafe<{ value: number }>("{\"value\":42}", "payload", logger);
    expect(parsed).toEqual({ value: 42 });

    const fallback = parseJsonSafe("not json", "payload", logger, undefined, { value: 0 });
    expect(fallback).toEqual({ value: 0 });
    expect(warnSpy).toHaveBeenCalled();
  });
});
