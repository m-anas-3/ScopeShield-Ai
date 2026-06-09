import { describe, expect, it, vi } from "vitest";

describe("Stripe product catalog", () => {
  it("maps configured Stripe prices to credit packs and subscription plans", async () => {
    vi.resetModules();
    vi.stubEnv("STRIPE_CREDITS_80_PRICE_ID", "price_12345678a");
    vi.stubEnv("STRIPE_CREDITS_200_PRICE_ID", "price_12345678b");
    vi.stubEnv("STRIPE_PRO_PRICE_ID", "price_12345678c");
    vi.stubEnv("STRIPE_AGENCY_PRICE_ID", "price_12345678d");

    const {
      getCreditPackByPriceId,
      getSubscriptionPlanByPriceId,
      publicBillingOptions,
    } = await import("../lib/stripe/products");

    expect(getCreditPackByPriceId("price_12345678a")?.credits).toBe(80);
    expect(getCreditPackByPriceId("price_12345678b")?.credits).toBe(200);
    expect(getSubscriptionPlanByPriceId("price_12345678c")?.key).toBe("pro");
    expect(getSubscriptionPlanByPriceId("price_12345678d")?.credits).toBe(1000);
    expect(publicBillingOptions().creditPacks.every((pack) => pack.enabled)).toBe(
      true,
    );
  });

  it("rejects numeric literal prices before Checkout", async () => {
    vi.resetModules();
    vi.stubEnv("STRIPE_CREDITS_80_PRICE_ID", "900");

    const { getCreditPack, priceSetupError, publicBillingOptions } =
      await import("../lib/stripe/products");
    const creditPack = getCreditPack("credits_80");

    expect(creditPack).not.toBeNull();
    expect(priceSetupError(creditPack!)).toContain("starts with price_");
    expect(publicBillingOptions().creditPacks[0]?.enabled).toBe(false);
    expect(publicBillingOptions().creditPacks[0]?.setupError).toContain(
      "not a numeric amount",
    );
  });

  it("rejects shortened fake price ids", async () => {
    vi.resetModules();
    vi.stubEnv("STRIPE_CREDITS_80_PRICE_ID", "price_9");

    const { getCreditPack, priceSetupError, publicBillingOptions } =
      await import("../lib/stripe/products");
    const creditPack = getCreditPack("credits_80");

    expect(creditPack).not.toBeNull();
    expect(priceSetupError(creditPack!)).toContain("shortened value");
    expect(publicBillingOptions().creditPacks[0]?.enabled).toBe(false);
  });
});
