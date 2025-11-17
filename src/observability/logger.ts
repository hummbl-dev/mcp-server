/**
 * Structured logging with correlation IDs and sampling
 * For Phase 1D observability implementation
 */

// AsyncLocalStorage is not available in Cloudflare Workers, so we'll use a simple context stack
class SimpleAsyncLocalStorage<T> {
  private store: T | undefined;

  run<R>(store: T, fn: () => R): R {
    const previous = this.store;
    this.store = store;
    try {
      return fn();
    } finally {
      this.store = previous;
    }
  }

  getStore(): T | undefined {
    return this.store;
  }
}

interface LogContext {
  correlationId?: string;
  userId?: string;
  sessionId?: string;
  operation?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  message: string;
  correlationId?: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private als = new SimpleAsyncLocalStorage<LogContext>();
  private sampleRate: number;
  private parentContext?: LogContext;

  constructor(sampleRate: number = 1.0) {
    this.sampleRate = sampleRate;
  }

  private shouldLog(): boolean {
    return Math.random() < this.sampleRate;
  }

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private writeLog(entry: LogEntry): void {
    if (!this.shouldLog()) return;

    const formatted = this.formatLog(entry);
    switch (entry.level) {
      case "error":
        console.error(formatted);
        break;
      case "warn":
        console.warn(formatted);
        break;
      case "debug":
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  private getCurrentContext(): LogContext {
    const alsContext = this.als.getStore();
    if (alsContext) {
      return { ...this.parentContext, ...alsContext };
    }
    return this.parentContext || {};
  }

  withCorrelation<T>(correlationId: string, fn: () => T): T;
  withCorrelation<T>(correlationId: string, context: Partial<LogContext>, fn: () => T): T;
  withCorrelation<T>(
    correlationId: string,
    contextOrFn: Partial<LogContext> | (() => T),
    fn?: () => T
  ): T {
    const context = typeof contextOrFn === "function" ? {} : contextOrFn;
    const callback = typeof contextOrFn === "function" ? contextOrFn : fn!;

    context.correlationId = correlationId;
    const currentContext = this.getCurrentContext();
    const newContext = { ...currentContext, ...context };

    return this.als.run(newContext, callback);
  }

  timer<T>(operation: string, fn: () => T): T;
  timer<T>(operation: string, context: Partial<LogContext>, fn: () => T): T;
  timer<T>(operation: string, contextOrFn: Partial<LogContext> | (() => T), fn?: () => T): T {
    const context = typeof contextOrFn === "function" ? {} : contextOrFn;
    const callback = typeof contextOrFn === "function" ? contextOrFn : fn!;

    const startTime = Date.now();
    const currentContext = this.getCurrentContext();
    const timerContext = { ...currentContext, ...context, operation };

    this.als.run(timerContext, () => {
      this.info(`Starting operation: ${operation}`);
    });

    try {
      const result = this.als.run(timerContext, callback);
      const duration = Date.now() - startTime;
      this.als.run(timerContext, () => {
        this.info(`Completed operation: ${operation}`, { duration });
      });
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.als.run(timerContext, () => {
        this.error(`Failed operation: ${operation}`, { duration }, error as Error);
      });
      throw error;
    }
  }

  debug(message: string, context?: Partial<LogContext>): void {
    const currentContext = this.getCurrentContext();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "debug",
      message,
      correlationId: currentContext.correlationId,
      context: { ...currentContext, ...context },
    };
    this.writeLog(entry);
  }

  info(message: string, context?: Partial<LogContext>): void {
    const currentContext = this.getCurrentContext();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      correlationId: currentContext.correlationId,
      context: { ...currentContext, ...context },
    };
    this.writeLog(entry);
  }

  warn(message: string, context?: Partial<LogContext>): void {
    const currentContext = this.getCurrentContext();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "warn",
      message,
      correlationId: currentContext.correlationId,
      context: { ...currentContext, ...context },
    };
    this.writeLog(entry);
  }

  error(message: string, context?: Partial<LogContext>, error?: Error): void {
    const currentContext = this.getCurrentContext();
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: "error",
      message,
      correlationId: currentContext.correlationId,
      context: { ...currentContext, ...context },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    };
    this.writeLog(entry);
  }

  child(context: Partial<LogContext>): Logger {
    const childLogger = new Logger(this.sampleRate);
    // For simplicity in Cloudflare Workers, just return a logger that will inherit context when used
    // In a real implementation, we'd share the ALS instance
    childLogger.parentContext = { ...this.getCurrentContext(), ...context };
    return childLogger;
  }
}
