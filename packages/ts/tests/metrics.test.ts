/**
 * Tests for Prometheus-compatible metrics collection
 */

import { MetricsCollector, Counter, Gauge, Histogram } from '../src/observability/metrics.js';

describe('MetricsCollector', () => {
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
  });

  test('creates and increments counters', () => {
    const counter = metrics.createCounter('test_counter', 'A test counter');

    counter.increment();
    counter.increment({ method: 'GET' });
    counter.add(5, { status: '200' });

    const values = counter.getValues();
    expect(values).toHaveLength(3);
    expect(values[0].value).toBe(1);
    expect(values[1].value).toBe(1);
    expect(values[1].labels).toEqual({ method: 'GET' });
    expect(values[2].value).toBe(5);
    expect(values[2].labels).toEqual({ status: '200' });
  });

  test('creates and sets gauges', () => {
    const gauge = metrics.createGauge('test_gauge', 'A test gauge');

    gauge.set(10);
    expect(gauge.getValue().value).toBe(10);

    gauge.increment({ type: 'active' });
    expect(gauge.getValue().value).toBe(11);
    expect(gauge.getValue().labels).toEqual({ type: 'active' });

    gauge.decrement();
    expect(gauge.getValue().value).toBe(10);
  });

  test('creates and observes histograms', () => {
    const histogram = metrics.createHistogram('test_histogram', 'A test histogram');

    histogram.observe(0.1);
    histogram.observe(0.5);
    histogram.observe(2.5);

    const data = histogram.getData();
    expect(data.count).toBe(3);
    expect(data.sum).toBe(3.1);
    expect(data.buckets[0].count).toBe(1); // 0.1
    expect(data.buckets[1].count).toBe(2); // 0.5
    expect(data.buckets[3].count).toBe(3); // 2.5
  });

  test('exports Prometheus format', () => {
    const counter = metrics.createCounter('http_requests_total', 'Total HTTP requests');
    const gauge = metrics.createGauge('active_connections', 'Active connections');
    const histogram = metrics.createHistogram('request_duration_seconds', 'Request duration');

    counter.increment({ method: 'GET', status: '200' });
    gauge.set(5);
    histogram.observe(0.25);

    const prometheusOutput = metrics.exportPrometheus();

    expect(prometheusOutput).toContain('# HELP http_requests_total Total HTTP requests');
    expect(prometheusOutput).toContain('# TYPE http_requests_total counter');
    expect(prometheusOutput).toContain('http_requests_total{method="GET",status="200"} 1');

    expect(prometheusOutput).toContain('# HELP active_connections Active connections');
    expect(prometheusOutput).toContain('# TYPE active_connections gauge');
    expect(prometheusOutput).toContain('active_connections 5');

    expect(prometheusOutput).toContain('# HELP request_duration_seconds Request duration');
    expect(prometheusOutput).toContain('# TYPE request_duration_seconds histogram');
    expect(prometheusOutput).toContain('request_duration_seconds_count 1');
    expect(prometheusOutput).toContain('request_duration_seconds_sum 0.25');
  });

  test('recordLatency updates histogram', () => {
    const histogram = metrics.createHistogram('mcp_operation_duration_seconds', 'Operation duration');

    metrics.recordLatency('operation', 250); // 250ms = 0.25s

    const data = histogram.getData();
    expect(data.count).toBe(1);
    expect(data.sum).toBe(0.25);
  });

  test('incrementCounter and setGauge convenience methods', () => {
    const counter = metrics.createCounter('test_counter', 'Test counter');
    const gauge = metrics.createGauge('test_gauge', 'Test gauge');

    metrics.incrementCounter('test_counter', { type: 'test' });
    metrics.setGauge('test_gauge', 42);

    const counterValues = counter.getValues();
    expect(counterValues[0].value).toBe(1);
    expect(counterValues[0].labels).toEqual({ type: 'test' });

    expect(gauge.getValue().value).toBe(42);
  });

  test('reset clears all metrics', () => {
    const counter = metrics.createCounter('test_counter', 'Test counter');
    const gauge = metrics.createGauge('test_gauge', 'Test gauge');
    const histogram = metrics.createHistogram('test_histogram', 'Test histogram');

    counter.increment();
    gauge.set(10);
    histogram.observe(1.0);

    metrics.reset();

    expect(counter.getValues()).toHaveLength(0);
    expect(gauge.getValue().value).toBe(0);
    expect(histogram.getData().count).toBe(0);
  });
});

describe('Pre-defined metrics', () => {
  test('session metrics are properly initialized', async () => {
    // Import the pre-defined metrics
    const { sessionCreateCounter, sessionCreateDuration, activeSessionsGauge } = await import('../src/observability/metrics.js');

    expect(sessionCreateCounter).toBeDefined();
    expect(sessionCreateDuration).toBeDefined();
    expect(activeSessionsGauge).toBeDefined();

    // Test that they can be used
    sessionCreateCounter.increment({ result: 'success' });
    sessionCreateDuration.observe(0.1, { result: 'success' });
    activeSessionsGauge.set(5);

    expect(sessionCreateCounter.getValues()).toHaveLength(1);
    expect(activeSessionsGauge.getValue().value).toBe(5);
  });
});