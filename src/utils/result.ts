/**
 * Result Pattern Utilities
 * Helper functions for working with Result<T,E> types
 */

import { type DomainError, Result, ok, err } from "../types/domain.js";

/**
 * Maps a Result's success value through a transformation function.
 */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  if (result.ok) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * Chains Result operations together (flatMap/bind).
 */
export function chainResult<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> {
  if (result.ok) {
    return fn(result.value);
  }
  return result;
}

/**
 * Unwraps a Result, throwing if error.
 */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}

/**
 * Unwraps a Result with a default value if error.
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  return result.ok ? result.value : defaultValue;
}

/**
 * Wraps a potentially throwing function in a Result.
 */
export function tryCatch<T>(fn: () => T): Result<T, DomainError> {
  try {
    return ok(fn());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({ type: "Internal", message });
  }
}

/**
 * Wraps an async function in a Result.
 */
export async function tryCatchAsync<T>(fn: () => Promise<T>): Promise<Result<T, DomainError>> {
  try {
    const value = await fn();
    return ok(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return err({ type: "Internal", message });
  }
}
