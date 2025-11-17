/**
 * Structured JSON logger with correlation IDs for request tracing.
 *
 * Features:
 * - JSON output format (machine-parseable)
 * - Correlation ID injection (track requests across components)
 * - Async context propagation (AsyncLocalStorage)
 * - Timer decorator (auto-log latency)
 * - Error traceback extraction
 * - Log sampling (reduce volume in production)
 *
 * Usage:
 *   const logger = new Logger('session-manager');
 *
 *   logger.withCorrelation('req_abc123', async () => {
 *     logger.info('session_created', { sessionId: 'abc', userId: 'reuben' });
 *   });
 *
 * Output:
 *   {
 *     "timestamp": "2025-11-17T12:00:00.000Z",
 *     "level": "INFO",
 *     "logger": "session-manager",
 *     "message": "session_created",
 *     "correlationId": "req_abc123",
 *     "sessionId": "abc",
 *     "userId": "reuben"
 *   }
 */

import { AsyncLocalStorage } from 'async_hooks';

// Context storage for correlation IDs (propagates through async calls)
const correlationContext = new AsyncLocalStorage<string>();

export type LogLevel = 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  logger: string;
  message: string;
  correlationId?: string;
  [key: string]: unknown;
}

export class Logger {
  private name: string;
  private sampleRate: number;

  /**
   * @param name - Logger name (e.g., 'session-manager', 'history-manager')
   * @param sampleRate - Fraction of logs to emit (0.0-1.0). Use 0.1 for 10% sampling.
   */
  constructor(name: string, sampleRate = 1.0) {
    this.name = name;
    this.sampleRate = sampleRate;
  }

  /**
   * Execute function with correlation ID in context.
   * ID propagates to all nested async calls automatically.
   */
  async withCorrelation<T>(
    correlationId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    return correlationContext.run(correlationId, fn);
  }

  /**
   * Generate new correlation ID and execute function.
   */
  async withNewCorrelation<T>(fn: () => Promise<T>): Promise<T> {
    const correlationId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    return this.withCorrelation(correlationId, fn);
  }

  /**
   * Get current correlation ID from async context.
   */
  private getCorrelationId(): string | undefined {
    return correlationContext.getStore();
  }

  /**
   * Check if this log should be sampled (emitted).
   */
  private shouldSample(): boolean {
    return Math.random() < this.sampleRate;
  }

  /**
   * Core logging function - formats and emits log entry.
   */
  private log(level: LogLevel, message: string, metadata: Record<string, unknown>): void {
    // Sample check
    if (!this.shouldSample()) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message,
      correlationId: this.getCorrelationId(),
      ...metadata
    };

    // Output as JSON
    console.log(JSON.stringify(entry));
  }

  debug(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('DEBUG', message, metadata);
  }

  info(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('INFO', message, metadata);
  }

  warning(message: string, metadata: Record<string, unknown> = {}): void {
    this.log('WARNING', message, metadata);
  }

  error(
    message: string,
    error?: Error,
    metadata: Record<string, unknown> = {}
  ): void {
    const errorMetadata = error ? {
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack?.split('\n').slice(0, 5).join('\n') // First 5 lines
    } : {};

    this.log('ERROR', message, { ...metadata, ...errorMetadata });
  }

  critical(
    message: string,
    error?: Error,
    metadata: Record<string, unknown> = {}
  ): void {
    const errorMetadata = error ? {
      errorType: error.name,
      errorMessage: error.message,
      errorStack: error.stack // Full stack for critical
    } : {};

    this.log('CRITICAL', message, { ...metadata, ...errorMetadata });
  }

  /**
   * Timer decorator - automatically logs operation latency.
   *
   * Usage:
   *   await logger.timer('session_read', async () => {
   *     return await sessionManager.get(sessionId);
   *   });
   *
   * Logs:
   *   { "message": "session_read", "latencyMs": 12.3, "success": true }
   */
  async timer<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata: Record<string, unknown> = {}
  ): Promise<T> {
    const startTime = Date.now();
    let success = true;
    let error: Error | undefined;

    try {
      const result = await fn();
      return result;
    } catch (e) {
      success = false;
      error = e instanceof Error ? e : new Error(String(e));
      throw e;
    } finally {
      const latencyMs = Date.now() - startTime;

      if (success) {
        this.info(operation, {
          latencyMs,
          success: true,
          ...metadata
        });
      } else {
        this.error(operation, error, {
          latencyMs,
          success: false,
          ...metadata
        });
      }
    }
  }
}

/**
 * Create a child logger with additional context.
 *
 * Usage:
 *   const baseLogger = new Logger('api');
 *   const sessionLogger = baseLogger.child({ sessionId: 'abc123' });
 *   sessionLogger.info('operation'); // Includes sessionId in every log
 */
Logger.prototype.child = function(
  context: Record<string, unknown>
): Logger {
  const childLogger = new Logger(this.name, this.sampleRate);

  // Override log method to include context
  const originalLog = childLogger['log'].bind(childLogger);
  childLogger['log'] = function(
    level: LogLevel,
    message: string,
    metadata: Record<string, unknown>
  ) {
    originalLog(level, message, { ...context, ...metadata });
  };

  return childLogger;
};