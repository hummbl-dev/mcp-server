import { Logger } from "../observability/logger.js";

interface SafeCallOptions<T> {
  operation: string;
  fn: () => Promise<T>;
  context?: Record<string, unknown>;
  fallback?: () => T | Promise<T>;
  fallbackValue?: T;
  rethrow?: boolean;
  logLevel?: "warn" | "error";
  onError?: (error: unknown) => void;
  onSuccess?: (result: T) => void;
}

const hasFallbackValue = <T>(
  options: SafeCallOptions<T>
): options is SafeCallOptions<T> & {
  fallbackValue: T;
} => Object.prototype.hasOwnProperty.call(options, "fallbackValue");

async function executeSafeCall<T>(
  layer: "redis" | "d1",
  logger: Logger,
  options: SafeCallOptions<T>
): Promise<T> {
  const logLevel = options.logLevel ?? (layer === "d1" ? "error" : "warn");
  const shouldRethrow = options.rethrow ?? layer === "d1";

  try {
    const result = await options.fn();
    options.onSuccess?.(result);
    return result;
  } catch (error) {
    options.onError?.(error);
    const message = `${layer.toUpperCase()} error during ${options.operation}`;
    const context = {
      ...options.context,
      error: error instanceof Error ? error.message : String(error),
    };

    if (logLevel === "error") {
      logger.error(message, context, error as Error);
    } else {
      logger.warn(message, context);
    }

    if (shouldRethrow) {
      throw error;
    }

    if (options.fallback) {
      return await options.fallback();
    }

    if (hasFallbackValue(options)) {
      return options.fallbackValue;
    }

    return undefined as T;
  }
}

export async function safeRedisCall<T>(logger: Logger, options: SafeCallOptions<T>): Promise<T> {
  return executeSafeCall("redis", logger, {
    logLevel: "warn",
    rethrow: false,
    ...options,
  });
}

export async function safeD1Call<T>(logger: Logger, options: SafeCallOptions<T>): Promise<T> {
  return executeSafeCall("d1", logger, {
    logLevel: "error",
    rethrow: true,
    ...options,
  });
}

export function parseJsonSafe<T>(
  raw: string | null | undefined,
  description: string,
  logger: Logger,
  context?: Record<string, unknown>,
  fallback?: T
): T | undefined {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    logger.warn(`Failed to parse ${description}`, {
      ...context,
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback;
  }
}
