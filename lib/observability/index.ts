export type LogLevel = "info" | "warn" | "error" | "debug";

export interface LogPayload {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface MetricPayload {
  name: string;
  value: number;
  unit: "ms" | "count" | "bytes" | "score";
  tags?: Record<string, string>;
  timestamp: string;
}

class ObservabilityManager {
  private environment: string;

  constructor() {
    this.environment = process.env.NODE_ENV || "development";
  }

  private emit(payload: LogPayload) {
    const formatted = JSON.stringify({
      service: "codebloom",
      env: this.environment,
      ...payload,
    });

    if (payload.level === "error") {
      console.error(formatted);
    } else if (payload.level === "warn") {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  public info(message: string, context?: Record<string, unknown>) {
    this.emit({
      level: "info",
      message,
      timestamp: new Date().toISOString(),
      context,
    });
  }

  public warn(message: string, context?: Record<string, unknown>) {
    this.emit({
      level: "warn",
      message,
      timestamp: new Date().toISOString(),
      context,
    });
  }

  public error(message: string, error?: unknown, context?: Record<string, unknown>) {
    let errPayload: LogPayload["error"];
    if (error instanceof Error) {
      errPayload = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (typeof error === "string") {
      errPayload = {
        name: "Error",
        message: error,
      };
    }

    this.emit({
      level: "error",
      message,
      timestamp: new Date().toISOString(),
      context,
      error: errPayload,
    });
  }

  public recordMetric(metric: Omit<MetricPayload, "timestamp">) {
    const payload: MetricPayload = {
      ...metric,
      timestamp: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== "test") {
      console.log(JSON.stringify({ service: "codebloom-metrics", ...payload }));
    }
    return payload;
  }

  public async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    tags?: Record<string, string>
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = performance.now() - start;
      this.recordMetric({
        name,
        value: Math.round(duration * 100) / 100,
        unit: "ms",
        tags,
      });
    }
  }
}

export const logger = new ObservabilityManager();

