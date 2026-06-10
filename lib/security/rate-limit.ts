import { NextResponse } from "next/server";

import { logWarn } from "@/lib/logging/server";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
  route: string;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const buckets = new Map<string, RateLimitEntry>();

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "unknown"
  );
}

export function checkRateLimit(options: RateLimitOptions): RateLimitResult {
  const now = options.now ?? Date.now();
  const key = `${options.route}:${options.key}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + options.windowMs;
    buckets.set(key, { count: 1, resetAt });

    return {
      allowed: true,
      limit: options.limit,
      remaining: Math.max(options.limit - 1, 0),
      resetAt,
      retryAfterSeconds: Math.ceil((resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  const remaining = Math.max(options.limit - existing.count, 0);
  const retryAfterSeconds = Math.ceil((existing.resetAt - now) / 1000);
  const allowed = existing.count <= options.limit;

  if (!allowed) {
    logWarn("rate_limit.rejected", {
      route: options.route,
      key: options.key,
      limit: options.limit,
      retryAfterSeconds,
    });
  }

  return {
    allowed,
    limit: options.limit,
    remaining,
    resetAt: existing.resetAt,
    retryAfterSeconds,
  };
}

export function rateLimitResponse(result: RateLimitResult) {
  return NextResponse.json(
    {
      error: "Too many requests. Please wait a moment and try again.",
      retry_after_seconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}

export function resetRateLimitStore() {
  buckets.clear();
}
