/**
 * Prometheus-compatible metrics collection
 * For Phase 1D observability implementation
 */

interface MetricValue {
  value: number;
  labels?: Record<string, string>;
  timestamp?: number;
}

interface HistogramBucket {
  le: string;
  count: number;
}

interface HistogramData {
  sum: number;
  count: number;
  buckets: HistogramBucket[];
}

export class Counter {
  private values: MetricValue[] = [];

  constructor(
    public readonly _name: string,
    public readonly _help: string,
    public readonly _labels: string[] = []
  ) {}

  increment(labels?: Record<string, string>): void {
    this.values.push({
      value: 1,
      labels,
      timestamp: Date.now(),
    });
  }

  add(value: number, labels?: Record<string, string>): void {
    this.values.push({
      value,
      labels,
      timestamp: Date.now(),
    });
  }

  getValues(): MetricValue[] {
    return [...this.values];
  }

  reset(): void {
    this.values = [];
  }
}

export class Gauge {
  private value: number = 0;
  private labels?: Record<string, string>;

  constructor(
    public readonly _name: string,
    public readonly _help: string,
    public readonly _labelNames: string[] = []
  ) {}

  set(value: number, labels?: Record<string, string>): void {
    this.value = value;
    this.labels = labels;
  }

  increment(labels?: Record<string, string>): void {
    this.value += 1;
    this.labels = labels;
  }

  decrement(labels?: Record<string, string>): void {
    this.value -= 1;
    this.labels = labels;
  }

  getValue(): MetricValue {
    return {
      value: this.value,
      labels: this.labels,
      timestamp: Date.now(),
    };
  }

  reset(): void {
    this.value = 0;
    this.labels = undefined;
  }
}

export class Histogram {
  private data: HistogramData;
  private buckets: number[];

  constructor(
    public readonly _name: string,
    public readonly _help: string,
    public readonly _labelNames: string[] = [],
    buckets: number[] = [0.1, 0.5, 1, 2.5, 5, 10]
  ) {
    this.buckets = buckets;
    this.data = {
      sum: 0,
      count: 0,
      buckets: buckets
        .map((le) => ({ le: le.toString(), count: 0 }))
        .concat({ le: "+Inf", count: 0 }),
    };
  }

  observe(value: number, _labels?: Record<string, string>): void {
    this.data.sum += value;
    this.data.count += 1;

    // Update buckets - cumulative: each bucket counts observations <= its upper bound
    for (let i = 0; i < this.buckets.length; i++) {
      if (value <= this.buckets[i]) {
        // Increment this bucket and all higher buckets
        for (let j = i; j < this.data.buckets.length - 1; j++) {
          this.data.buckets[j].count += 1;
        }
        break;
      }
    }
    // +Inf bucket always gets incremented
    this.data.buckets[this.data.buckets.length - 1].count += 1;
  }

  getData(): HistogramData & { labels?: Record<string, string> } {
    return { ...this.data };
  }

  reset(): void {
    this.data = {
      sum: 0,
      count: 0,
      buckets: this.buckets
        .map((le) => ({ le: le.toString(), count: 0 }))
        .concat({ le: "+Inf", count: 0 }),
    };
  }
}

export class MetricsCollector {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  createCounter(name: string, help: string, labels: string[] = []): Counter {
    const counter = new Counter(name, help, labels);
    this.counters.set(name, counter);
    return counter;
  }

  createGauge(name: string, help: string, labels: string[] = []): Gauge {
    const gauge = new Gauge(name, help, labels);
    this.gauges.set(name, gauge);
    return gauge;
  }

  createHistogram(
    name: string,
    help: string,
    labels: string[] = [],
    buckets?: number[]
  ): Histogram {
    const histogram = new Histogram(name, help, labels, buckets);
    this.histograms.set(name, histogram);
    return histogram;
  }

  recordLatency(operation: string, duration: number, labels?: Record<string, string>): void {
    const histogram = this.histograms.get(`mcp_${operation}_duration_seconds`);
    if (histogram) {
      histogram.observe(duration / 1000, labels); // Convert to seconds
    }
  }

  incrementCounter(name: string, labels?: Record<string, string>): void {
    const counter = this.counters.get(name);
    if (counter) {
      counter.increment(labels);
    }
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const gauge = this.gauges.get(name);
    if (gauge) {
      gauge.set(value, labels);
    }
  }

  exportPrometheus(): string {
    let output = "";

    // Export counters
    for (const [name, counter] of this.counters) {
      output += `# HELP ${name} ${counter._help}\n`;
      output += `# TYPE ${name} counter\n`;
      const values = counter.getValues();
      for (const value of values) {
        const labels = value.labels
          ? `{${Object.entries(value.labels)
              .map(([k, v]) => `${k}="${v}"`)
              .join(",")}}`
          : "";
        output += `${name}${labels} ${value.value} ${value.timestamp}\n`;
      }
    }

    // Export gauges
    for (const [name, gauge] of this.gauges) {
      output += `# HELP ${name} ${gauge._help}\n`;
      output += `# TYPE ${name} gauge\n`;
      const value = gauge.getValue();
      const labels = value.labels
        ? `{${Object.entries(value.labels)
            .map(([k, v]) => `${k}="${v}"`)
            .join(",")}}`
        : "";
      output += `${name}${labels} ${value.value} ${value.timestamp}\n`;
    }

    // Export histograms
    for (const [name, histogram] of this.histograms) {
      output += `# HELP ${name} ${histogram._help}\n`;
      output += `# TYPE ${name} histogram\n`;
      const data = histogram.getData();
      for (const bucket of data.buckets) {
        output += `${name}_bucket{le="${bucket.le}"} ${bucket.count}\n`;
      }
      output += `${name}_count ${data.count}\n`;
      output += `${name}_sum ${data.sum}\n`;
    }

    return output;
  }

  reset(): void {
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const gauge of this.gauges.values()) {
      gauge.reset();
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
  }
}

// Global metrics instance
export const metrics = new MetricsCollector();

// Pre-defined metrics for MCP server
export const sessionCreateCounter = metrics.createCounter(
  "mcp_session_create_total",
  "Total number of session creations"
);

export const sessionCreateDuration = metrics.createHistogram(
  "mcp_session_create_duration_seconds",
  "Duration of session creation operations",
  ["result"],
  [0.1, 0.5, 1, 2.5, 5, 10]
);

export const sessionGetCounter = metrics.createCounter(
  "mcp_session_get_total",
  "Total number of session retrievals",
  ["result"]
);

export const sessionGetDuration = metrics.createHistogram(
  "mcp_session_get_duration_seconds",
  "Duration of session get operations",
  ["result"],
  [0.01, 0.05, 0.1, 0.5, 1, 2.5]
);

export const sessionUpdateCounter = metrics.createCounter(
  "mcp_session_update_total",
  "Total number of session updates",
  ["result"]
);

export const sessionEndCounter = metrics.createCounter(
  "mcp_session_end_total",
  "Total number of session endings"
);

export const cacheHitCounter = metrics.createCounter(
  "mcp_cache_hits_total",
  "Total number of cache hits",
  ["operation"]
);

export const cacheMissCounter = metrics.createCounter(
  "mcp_cache_misses_total",
  "Total number of cache misses",
  ["operation"]
);

export const activeSessionsGauge = metrics.createGauge(
  "mcp_active_sessions",
  "Number of currently active sessions"
);

export const d1WriteCounter = metrics.createCounter(
  "mcp_d1_writes_total",
  "Total number of D1 database writes",
  ["table", "result"]
);

export const d1ReadCounter = metrics.createCounter(
  "mcp_d1_reads_total",
  "Total number of D1 database reads",
  ["table", "result"]
);
