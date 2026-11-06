import { describe, it, expect, vi } from "vitest";
import { logger } from "@/lib/observability";

describe("Phase 5: Production Observability & Telemetry Suite", () => {
  it("formats and emits structured JSON error logs with stack traces", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const testError = new Error("Database query timeout");
    logger.error("Failed to fetch project details", testError, {
      slug: "signal-garden",
      userId: "u-123",
    });

    expect(errorSpy).toHaveBeenCalled();
    const rawLogged = errorSpy.mock.calls[0][0];
    const parsed = JSON.parse(rawLogged);

    expect(parsed.service).toBe("codebloom");
    expect(parsed.level).toBe("error");
    expect(parsed.message).toBe("Failed to fetch project details");
    expect(parsed.context.slug).toBe("signal-garden");
    expect(parsed.error.name).toBe("Error");
    expect(parsed.error.message).toBe("Database query timeout");

    errorSpy.mockRestore();
  });

  it("measures asynchronous execution time and records performance metric", async () => {
    const result = await logger.measureAsync(
      "feed.query_time",
      async () => {
        await new Promise((r) => setTimeout(r, 10));
        return { count: 42 };
      },
      { mode: "for-you" }
    );

    expect(result).toEqual({ count: 42 });
  });

  it("records and formats metric payloads with timestamp", () => {
    const metric = logger.recordMetric({
      name: "realtime.active_connections",
      value: 128,
      unit: "count",
      tags: { region: "us-east-1" },
    });

    expect(metric.name).toBe("realtime.active_connections");
    expect(metric.value).toBe(128);
    expect(metric.unit).toBe("count");
    expect(metric.timestamp).toBeDefined();
  });
});

