import { afterEach, describe, expect, it, vi } from "vitest";

import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
  resetRateLimitStore,
} from "../lib/security/rate-limit";

describe("rate limiting", () => {
  afterEach(() => {
    resetRateLimitStore();
    vi.restoreAllMocks();
  });

  it("allows requests within the window and rejects excess attempts", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const first = checkRateLimit({
      key: "user:user_123",
      limit: 2,
      windowMs: 60_000,
      route: "api.analyze",
      now: 1_000,
    });
    const second = checkRateLimit({
      key: "user:user_123",
      limit: 2,
      windowMs: 60_000,
      route: "api.analyze",
      now: 2_000,
    });
    const third = checkRateLimit({
      key: "user:user_123",
      limit: 2,
      windowMs: 60_000,
      route: "api.analyze",
      now: 3_000,
    });

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);

    const response = rateLimitResponse(third);
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("58");
    expect(body.error).toContain("Too many requests");
  });

  it("extracts the first forwarded IP as the unauthenticated fallback key", () => {
    const request = new Request("http://localhost/api/analyze", {
      headers: {
        "x-forwarded-for": "203.0.113.10, 10.0.0.1",
      },
    });

    expect(getClientIp(request)).toBe("203.0.113.10");
  });
});
