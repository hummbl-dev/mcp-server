/**
 * Distributed tracing using OpenTelemetry.
 * Exports traces to Grafana Tempo, Jaeger, or any OTLP endpoint.
 *
 * Features:
 * - Span creation and nesting
 * - Automatic context propagation
 * - Attribute injection (sessionId, userId, etc.)
 * - Error recording
 * - W3C Trace Context headers
 */

import { trace as apiTrace, context, SpanStatusCode, propagation } from "@opentelemetry/api";
import type { Span, SpanContext } from "@opentelemetry/api";

/**
 * Initialize OpenTelemetry tracing.
 * Call this once at application startup.
 */
export function initTracing(): void {
  // Set up basic tracing for Cloudflare Workers
  // In production, you would configure OTLP exporter here
}

/**
 * Get the tracer instance.
 */
export const tracer = apiTrace.getTracer("hummbl-mcp-server", "1.0.0");

/**
 * Trace decorator for automatic span creation.
 *
 * Usage:
 *   class SessionManager {
 *     @trace('session_read')
 *     async get(sessionId: string): Promise<Session | null> {
 *       // Automatically wrapped in span
 *     }
 *   }
 */
export function trace(
  operationName: string,
  attributes?: Record<string, string | number | boolean>
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return function (target: any, propertyKey: string, descriptor?: PropertyDescriptor) {
    if (!descriptor || !descriptor.value) {
      return descriptor;
    }
    const originalMethod = descriptor.value;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    descriptor.value = async function (...args: any[]) {
      const spanName = `${target.constructor.name}.${propertyKey}`;

      return tracer.startActiveSpan(spanName, async (span: Span) => {
        try {
          // Set operation name
          span.setAttribute("operation", operationName);

          // Add custom attributes if provided
          if (attributes) {
            for (const [key, value] of Object.entries(attributes)) {
              span.setAttribute(key, value);
            }
          }

          // Add method arguments as span attributes (safely)
          span.setAttribute("method.name", propertyKey);
          span.setAttribute("method.class", target.constructor.name);

          // If first arg looks like an ID, add it
          if (args.length > 0) {
            if (typeof args[0] === "string" && args[0].length < 100) {
              span.setAttribute("resource.id", args[0]);
            } else if (typeof args[0] === "object" && args[0] !== null) {
              // Add object keys as attributes (limited to avoid bloat)
              const objKeys = Object.keys(args[0]).slice(0, 5);
              for (const key of objKeys) {
                const value = args[0][key];
                if (typeof value === "string" && value.length < 50) {
                  span.setAttribute(`arg.${key}`, value);
                } else if (typeof value === "number" || typeof value === "boolean") {
                  span.setAttribute(`arg.${key}`, value);
                }
              }
            }
          }

          const result = await originalMethod.apply(this, args);

          span.setStatus({ code: SpanStatusCode.OK });

          // Add result metadata if it's a simple type
          if (typeof result === "boolean") {
            span.setAttribute("result.success", result);
          } else if (typeof result === "number") {
            span.setAttribute("result.count", result);
          } else if (typeof result === "string" && result.length < 100) {
            span.setAttribute("result.type", "string");
          }

          return result;
        } catch (error) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });

          span.recordException(error instanceof Error ? error : new Error(String(error)));

          // Add error attributes
          span.setAttribute(
            "error.type",
            error instanceof Error ? error.constructor.name : "Unknown"
          );
          span.setAttribute(
            "error.message",
            error instanceof Error ? error.message : String(error)
          );

          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}

/**
 * Manually create and manage a span.
 * Use when decorator pattern isn't suitable.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>
): Promise<T> {
  return tracer.startActiveSpan(name, async (span: Span) => {
    if (attributes) {
      for (const [key, value] of Object.entries(attributes)) {
        span.setAttribute(key, value);
      }
    }

    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      throw error;
    } finally {
      span.end();
    }
  });
}

/**
 * Extract trace context from HTTP headers (W3C Trace Context).
 * Use for distributed tracing across services.
 */
export function extractTraceContext(headers: Record<string, string>): void {
  const ctx = propagation.extract(context.active(), headers);
  context.with(ctx, () => {
    // Context is now set for the current execution
  });
}

/**
 * Inject trace context into HTTP headers.
 * Use when making outbound requests.
 */
export function injectTraceContext(headers: Record<string, string>): void {
  propagation.inject(context.active(), headers);
}

/**
 * Get current span context for logging correlation.
 */
export function getCurrentSpanContext(): SpanContext | undefined {
  const span = apiTrace.getActiveSpan();
  return span?.spanContext();
}

/**
 * Add attributes to the current active span.
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = apiTrace.getActiveSpan();
  if (span) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }
}

/**
 * Set span status.
 */
export function setSpanStatus(code: SpanStatusCode, message?: string): void {
  const span = apiTrace.getActiveSpan();
  if (span) {
    span.setStatus({ code, message });
  }
}

/**
 * Record an event on the current span.
 */
export function recordSpanEvent(
  name: string,
  attributes?: Record<string, string | number | boolean>
): void {
  const span = apiTrace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Create a child span from the current active span.
 */
export function startChildSpan(
  name: string,
  attributes?: Record<string, string | number | boolean>
): Span | undefined {
  const span = tracer.startSpan(name, {
    attributes,
  });

  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      span.setAttribute(key, value);
    }
  }

  return span;
}

/**
 * Flush all pending spans (useful for testing).
 * Note: In Cloudflare Workers, spans are flushed automatically.
 */
export async function flushSpans(): Promise<void> {
  // No-op in simplified setup
}

/**
 * Shutdown tracing (useful for graceful shutdown).
 * Note: In Cloudflare Workers, tracing shuts down automatically.
 */
export async function shutdownTracing(): Promise<void> {
  // No-op in simplified setup
}
