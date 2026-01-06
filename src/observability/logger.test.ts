import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Logger } from "./logger.js";

describe("Logger", () => {
  const spies: Array<ReturnType<typeof vi.spyOn>> = [];

  beforeEach(() => {
    spies.push(vi.spyOn(console, "log").mockImplementation(() => {}));
    spies.push(vi.spyOn(console, "debug").mockImplementation(() => {}));
    spies.push(vi.spyOn(console, "warn").mockImplementation(() => {}));
    spies.push(vi.spyOn(console, "error").mockImplementation(() => {}));
  });

  afterEach(() => {
    spies.splice(0).forEach((spy) => spy.mockRestore());
  });

  it("exposes parent context through getCurrentContext", () => {
    const logger = new Logger(1);
    logger.withCorrelation("parent-123", { requestId: "parent-123" }, () => {
      const ctx = (logger as any).getCurrentContext();
      expect(ctx.requestId).toBe("parent-123");
    });
  });

  it("merges context via withCorrelation", () => {
    const logger = new Logger(1);
    logger.withCorrelation("corr-1", { custom: "value" }, () => {
      const ctx = (logger as any).getCurrentContext();
      expect(ctx.custom).toBe("value");
      expect(ctx.correlationId).toBe("corr-1");
    });
  });

  it("propagates parent context to child logger", () => {
    const logger = new Logger(1);
    logger.withCorrelation("parent", { userId: "user-123" }, () => {
      const child = logger.child({ sessionId: "session-456" });
      child.info("child log");
      const ctx = (child as any).getCurrentContext();
      expect(ctx.userId).toBe("user-123");
      expect(ctx.sessionId).toBe("session-456");
      expect(ctx.correlationId).toBe("parent");
    });
  });

  it("logs each level with sampling forced", () => {
    const logger = new Logger(1);
    logger.debug("debug log");
    logger.info("info log");
    logger.warn("warn log");
    logger.error("error log", { extra: true }, new Error("boom"));

    expect(console.debug).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("records timer success", () => {
    const logger = new Logger(1);

    const result = logger.timer("demo.op", { operationDetail: "test" }, () => "done");

    expect(result).toBe("done");
    expect(console.log).toHaveBeenCalled();
  });

  it("records timer failure", () => {
    const logger = new Logger(1);

    expect(() =>
      logger.timer("demo.fail", () => {
        throw new Error("boom");
      })
    ).toThrow("boom");

    expect(console.error).toHaveBeenCalled();
  });

  it("respects sampling (shouldLog false)", () => {
    const logger = new Logger(0); // 0% sampling
    logger.info("skipped");
    expect(console.log).not.toHaveBeenCalled();
  });
});
