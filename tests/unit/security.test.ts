import { describe, expect, it, beforeEach } from "vitest";
import { checkRateLimit, getClientIp, isOriginAllowed, resetRateLimits } from "@/lib/security";

describe("Security hardening", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  describe("isOriginAllowed", () => {
    it("allows requests when origin matches the request URL origin", () => {
      const req = new Request("http://localhost:3000/api/social", {
        headers: { origin: "http://localhost:3000" },
      });
      expect(isOriginAllowed(req)).toBe(true);
    });

    it("allows requests with no origin header (same-origin / native clients)", () => {
      const req = new Request("http://localhost:3000/api/social");
      expect(isOriginAllowed(req)).toBe(true);
    });

    it("rejects untrusted external cross-origin requests", () => {
      const req = new Request("http://localhost:3000/api/social", {
        headers: { origin: "https://evil-attacker.example" },
      });
      expect(isOriginAllowed(req)).toBe(false);
    });

    it("rejects malformed origin headers", () => {
      const req = new Request("http://localhost:3000/api/social", {
        headers: { origin: "not an absolute url" },
      });
      expect(isOriginAllowed(req)).toBe(false);
    });
  });

  describe("getClientIp", () => {
    it("extracts the first IP from x-forwarded-for header", () => {
      const req = new Request("http://localhost:3000", {
        headers: { "x-forwarded-for": "203.0.113.195, 70.41.3.18, 150.172.238.178" },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("extracts x-real-ip if x-forwarded-for is missing", () => {
      const req = new Request("http://localhost:3000", {
        headers: { "x-real-ip": "198.51.100.42" },
      });
      expect(getClientIp(req)).toBe("198.51.100.42");
    });

    it("falls back to 127.0.0.1 if no proxy headers are present", () => {
      const req = new Request("http://localhost:3000");
      expect(getClientIp(req)).toBe("127.0.0.1");
    });
  });

  describe("checkRateLimit", () => {
    it("permits requests within the threshold", () => {
      const result = checkRateLimit("test-key", 3, 10_000);
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it("blocks requests that exceed the rate limit", () => {
      checkRateLimit("flood-ip", 2, 5_000);
      checkRateLimit("flood-ip", 2, 5_000);
      const blocked = checkRateLimit("flood-ip", 2, 5_000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
      expect(blocked.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    });
  });
});

