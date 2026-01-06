/**
 * Tests for structured logging with correlation IDs
 */

import { Logger } from '../src/observability/logger.js';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('Logger', () => {
  let logger: Logger;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let consoleWarnSpy: any;

  beforeEach(() => {
    logger = new Logger(1.0); // 100% sampling for tests
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  test('logs info messages with JSON structure', () => {
    logger.info('Test message', { key: 'value' });

    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"level":"info"')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message":"Test message"')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"key":"value"')
    );
  });

  test('logs error messages with error details', () => {
    const error = new Error('Test error');
    logger.error('Error occurred', { code: 500 }, error);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"level":"error"')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message":"Error occurred"')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"name":"Error"')
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message":"Test error"')
    );
  });

  test('withCorrelation sets correlation ID in context', () => {
    const correlationId = 'test-correlation-123';

    logger.withCorrelation(correlationId, () => {
      logger.info('Inside correlation context');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(`"correlationId":"${correlationId}"`)
      );
    });
  });

  test('timer decorator logs operation timing', () => {
    const result = logger.timer('test.operation', () => {
      // Simulate some work
      for (let i = 0; i < 1000; i++) {}
      return 'result';
    });

    expect(result).toBe('result');
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message":"Starting operation: test.operation"')
    );
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message":"Completed operation: test.operation"')
    );
  });

  test('timer decorator logs errors', () => {
    expect(() => {
      logger.timer('test.operation', () => {
        throw new Error('Operation failed');
      });
    }).toThrow('Operation failed');

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('"message":"Failed operation: test.operation"')
    );
  });

  test('sampling rate controls log output', () => {
    const sampledLogger = new Logger(0.0); // 0% sampling

    sampledLogger.info('This should not be logged');

    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  test('child logger inherits context', () => {
    logger.withCorrelation('parent-correlation', { userId: 'user123' }, () => {
      const childLogger = logger.child({ sessionId: 'session456' });

      childLogger.info('Child message');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"correlationId":"parent-correlation"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"userId":"user123"')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('"sessionId":"session456"')
      );
    });
  });
});