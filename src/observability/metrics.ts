/**
 * Metrics collection using Prometheus client format.
 * Exports metrics for Grafana/Cloudflare Analytics scraping.
 *
 * Usage:
 *   // Histogram (latency)
 *   await metrics.recordLatency(sessionReadLatency, async () => {
 *     return await sessionManager.get(sessionId);
 *   });
 *
 *   // Counter (errors, cache hits)
 *   metrics.increment(cacheHits, { cache: 'redis' });
 *
 *   // Gauge (active sessions)
 *   metrics.set(activeSessions, 42);
 */

// Histogram for latency tracking
export interface Histogram {
  name: string;
  help: string;
  buckets: number[];
  observations: Map<string, number[]>; // label hash -> values
}

// Counter for totals (errors, hits, commands)
export interface Counter {
  name: string;
  help: string;
  labelNames: string[];
  values: Map<string, number>; // label hash -> count
}

// Gauge for current values (active sessions)
export interface Gauge {
  name: string;
  help: string;
  labelNames: string[];
  values: Map<string, number>; // label hash -> value
}

export class MetricsCollector {
  private histograms: Map<string, Histogram> = new Map();
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();

  /**
   * Create histogram metric for latency tracking.
   */
  histogram(
    name: string,
    help: string,
    buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]
  ): Histogram {
    if (this.histograms.has(name)) {
      return this.histograms.get(name)!;
    }

    const histogram: Histogram = {
      name,
      help,
      buckets: [...buckets].sort((a, b) => a - b), // Ensure sorted
      observations: new Map()
    };

    this.histograms.set(name, histogram);
    return histogram;
  }

  /**
   * Create counter metric for totals.
   */
  counter(name: string, help: string, labelNames: string[] = []): Counter {
    if (this.counters.has(name)) {
      return this.counters.get(name)!;
    }

    const counter: Counter = {
      name,
      help,
      labelNames,
      values: new Map()
    };

    this.counters.set(name, counter);
    return counter;
  }

  /**
   * Create gauge metric for current values.
   */
  gauge(name: string, help: string, labelNames: string[] = []): Gauge {
    if (this.gauges.has(name)) {
      return this.gauges.get(name)!;
    }

    const gauge: Gauge = {
      name,
      help,
      labelNames,
      values: new Map()
    };

    this.gauges.set(name, gauge);
    return gauge;
  }

  /**
   * Record histogram observation with timing.
   */
  async recordLatency<T>(
    histogram: Histogram,
    fn: () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const startTime = Date.now();

    try {
      return await fn();
    } finally {
      const latencyMs = Date.now() - startTime;
      this.observeHistogram(histogram, latencyMs, labels);
    }
  }

  /**
   * Manually observe histogram value.
   */
  observeHistogram(
    histogram: Histogram,
    value: number,
    labels: Record<string, string> = {}
  ): void {
    const labelKey = this.serializeLabels(labels);
    const observations = histogram.observations.get(labelKey) || [];
    observations.push(value);
    histogram.observations.set(labelKey, observations);
  }

  /**
   * Increment counter.
   */
  increment(
    counter: Counter,
    labels: Record<string, string> = {},
    amount = 1
  ): void {
    const labelKey = this.serializeLabels(labels);
    const current = counter.values.get(labelKey) || 0;
    counter.values.set(labelKey, current + amount);
  }

  /**
   * Set gauge value.
   */
  set(gauge: Gauge, value: number, labels: Record<string, string> = {}): void {
    const labelKey = this.serializeLabels(labels);
    gauge.values.set(labelKey, value);
  }

  /**
   * Serialize labels to stable key.
   */
  private serializeLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(pairs);
  }

  /**
   * Export metrics in Prometheus format.
   */
  export(): string {
    const lines: string[] = [];

    // Export histograms
    for (const histogram of this.histograms.values()) {
      lines.push(`# HELP ${histogram.name} ${histogram.help}`);
      lines.push(`# TYPE ${histogram.name} histogram`);

      for (const [labelKey, observations] of histogram.observations) {
        const labels = this.deserializeLabels(labelKey);
        const labelStr = this.formatLabels(labels);

        // Calculate buckets
        let cumulativeCount = 0;
        for (const bucket of histogram.buckets) {
          const count = observations.filter(v => v <= bucket).length;
          cumulativeCount = count;
          lines.push(`${histogram.name}_bucket{${labelStr}le="${bucket}"} ${count}`);
        }

        // +Inf bucket
        lines.push(`${histogram.name}_bucket{${labelStr}le="+Inf"} ${observations.length}`);

        // Count and sum
        const sum = observations.reduce((a, b) => a + b, 0);
        lines.push(`${histogram.name}_count{${labelStr}} ${observations.length}`);
        lines.push(`${histogram.name}_sum{${labelStr}} ${sum}`);
      }
    }

    // Export counters
    for (const counter of this.counters.values()) {
      lines.push(`# HELP ${counter.name} ${counter.help}`);
      lines.push(`# TYPE ${counter.name} counter`);

      for (const [labelKey, value] of counter.values) {
        const labels = this.deserializeLabels(labelKey);
        const labelStr = this.formatLabels(labels);
        lines.push(`${counter.name}{${labelStr}} ${value}`);
      }
    }

    // Export gauges
    for (const gauge of this.gauges.values()) {
      lines.push(`# HELP ${gauge.name} ${gauge.help}`);
      lines.push(`# TYPE ${gauge.name} gauge`);

      for (const [labelKey, value] of gauge.values) {
        const labels = this.deserializeLabels(labelKey);
        const labelStr = this.formatLabels(labels);
        lines.push(`${gauge.name}{${labelStr}} ${value}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  private deserializeLabels(key: string): Record<string, string> {
    const pairs = JSON.parse(key) as [string, string][];
    return Object.fromEntries(pairs);
  }

  private formatLabels(labels: Record<string, string>): string {
    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return pairs.length > 0 ? pairs.join(',') + ',' : '';
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

// Pre-defined metrics
export const sessionReadLatency = metrics.histogram(
  'session_read_latency_ms',
  'Session read latency in milliseconds'
);

export const sessionWriteLatency = metrics.histogram(
  'session_write_latency_ms',
  'Session write latency in milliseconds'
);

export const historyReadLatency = metrics.histogram(
  'history_read_latency_ms',
  'History read latency in milliseconds'
);

export const sessionErrors = metrics.counter(
  'session_errors_total',
  'Total session operation errors',
  ['operation', 'error_type']
);

export const cacheHits = metrics.counter(
  'cache_hits_total',
  'Total cache hits',
  ['cache']
);

export const cacheMisses = metrics.counter(
  'cache_misses_total',
  'Total cache misses',
  ['cache']
);

export const redisCommands = metrics.counter(
  'redis_commands_total',
  'Total Redis commands executed',
  ['command']
);

export const d1RowsRead = metrics.counter(
  'd1_rows_read_total',
  'Total D1 rows read'
);

export const d1RowsWritten = metrics.counter(
  'd1_rows_written_total',
  'Total D1 rows written'
);

export const activeSessions = metrics.gauge(
  'active_sessions_total',
  'Current active sessions'
);