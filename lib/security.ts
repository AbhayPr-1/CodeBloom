/**
 * Security and defensive hardening utilities for CodeBloom.
 * Provides CSRF origin validation, rate-limiting, and input protection.
 */

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp.trim();
  return "127.0.0.1";
}

export function isOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const originUrl = new URL(origin);
    const hostHeader = request.headers.get("host");
    if (hostHeader && originUrl.host === hostHeader) return true;

    const requestUrl = new URL(request.url);
    if (originUrl.origin === requestUrl.origin) return true;

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      try {
        if (new URL(siteUrl).origin === originUrl.origin) return true;
      } catch {
        // Ignore malformed siteUrl
      }
    }

    if (process.env.NODE_ENV !== "production") {
      const isOriginLocal = originUrl.hostname === "localhost" || originUrl.hostname === "127.0.0.1";
      const isReqLocal = requestUrl.hostname === "localhost" || requestUrl.hostname === "127.0.0.1";
      if (isOriginLocal && isReqLocal) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();
let lastPrune = Date.now();

function pruneExpired(windowMs: number) {
  const now = Date.now();
  if (now - lastPrune < 30_000) return;
  lastPrune = now;
  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  pruneExpired(windowMs);

  let entry = rateLimitStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(key, entry);
  }

  entry.timestamps = entry.timestamps.filter((ts) => now - ts < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldest = entry.timestamps[0] || now;
    const retryAfterMs = Math.max(1000, windowMs - (now - oldest));
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  entry.timestamps.push(now);
  return {
    allowed: true,
    remaining: maxRequests - entry.timestamps.length,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimits(): void {
  rateLimitStore.clear();
}

