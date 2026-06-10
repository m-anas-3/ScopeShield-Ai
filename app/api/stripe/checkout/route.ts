import { NextResponse } from "next/server";
import { z } from "zod";

import {
  BILLING_SCHEMA_MISSING_MESSAGE,
  isMissingBillingSchemaError,
  stripeSetupIssues,
} from "@/lib/billing/setup";
import {
  EnvConfigurationError,
  envSetupMessage,
  optionalPositiveIntegerEnv,
} from "@/lib/env/server";
import { logError, logInfo } from "@/lib/logging/server";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "@/lib/security/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertConfiguredPrice, getCreditPack } from "@/lib/stripe/products";
import { getAppUrl, getStripe } from "@/lib/stripe/server";

const checkoutRequestSchema = z.object({
  checkoutType: z.literal("credits"),
  itemKey: z.string().min(1),
});

const RATE_LIMIT_WINDOW_MS = 60_000;

interface StripePriceConfig {
  label: string;
  priceId: string;
  envName: string;
}

function isStripeMissingResourceError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const record = error as {
    code?: unknown;
    message?: unknown;
    type?: unknown;
  };

  return (
    record.code === "resource_missing" ||
    (typeof record.message === "string" &&
      record.message.toLowerCase().includes("no such price"))
  );
}

async function assertStripePriceReady(
  stripe: ReturnType<typeof getStripe>,
  priceConfig: StripePriceConfig,
  expectedMode: "payment",
) {
  assertConfiguredPrice(priceConfig);

  try {
    const price = await stripe.prices.retrieve(priceConfig.priceId);

    if (!price.active) {
      throw new Error(
        `${priceConfig.envName} points to an archived Stripe Price. Use an active Price ID.`,
      );
    }

    if (expectedMode === "payment" && price.recurring) {
      throw new Error(
        `${priceConfig.envName} points to a recurring Price. Use a one-time Price for credit packs.`,
      );
    }
  } catch (error) {
    if (isStripeMissingResourceError(error)) {
      throw new Error(
        `${priceConfig.envName} points to ${priceConfig.priceId}, but Stripe could not find that Price. Copy the full Price ID from the same Stripe test/live mode as STRIPE_SECRET_KEY.`,
      );
    }

    throw error;
  }
}

async function getOrCreateStripeCustomer(userId: string, email?: string) {
  const admin = createAdminClient();
  const stripe = getStripe();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    if (isMissingBillingSchemaError(profileError)) {
      throw new Error(BILLING_SCHEMA_MISSING_MESSAGE);
    }

    throw new Error("Billing profile not found.");
  }

  if (profile.stripe_customer_id) {
    return profile.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email,
    metadata: {
      user_id: userId,
    },
  });

  const { error: updateError } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId);

  if (updateError) {
    throw new Error(`Stripe customer save failed: ${updateError.message}`);
  }

  return customer.id;
}

export async function POST(request: Request) {
  try {
    logInfo("stripe.checkout.requested");
    const setupIssues = stripeSetupIssues();

    if (setupIssues.length > 0) {
      logInfo("stripe.checkout.setup_blocked", { issues: setupIssues });
      return NextResponse.json(
        { error: setupIssues.join(" ") },
        { status: 503 },
      );
    }

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      const ipResult = checkRateLimit({
        key: `ip:${getClientIp(request)}`,
        limit: optionalPositiveIntegerEnv("RATE_LIMIT_CHECKOUT_IP_PER_MINUTE", 30),
        windowMs: RATE_LIMIT_WINDOW_MS,
        route: "api.stripe.checkout",
      });

      if (!ipResult.allowed) {
        return rateLimitResponse(ipResult);
      }

      logInfo("stripe.checkout.unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rateLimit = checkRateLimit({
      key: `user:${user.id}`,
      limit: optionalPositiveIntegerEnv("RATE_LIMIT_CHECKOUT_PER_MINUTE", 10),
      windowMs: RATE_LIMIT_WINDOW_MS,
      route: "api.stripe.checkout",
    });

    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit);
    }

    const parsed = checkoutRequestSchema.safeParse(await request.json());

    if (!parsed.success) {
      logInfo("stripe.checkout.invalid_request", {
        userId: user.id,
      });
      return NextResponse.json({ error: "Invalid checkout request" }, { status: 400 });
    }

    logInfo("stripe.checkout.parsed", {
      userId: user.id,
      checkoutType: parsed.data.checkoutType,
      itemKey: parsed.data.itemKey,
    });

    const stripe = getStripe();
    const appUrl = getAppUrl();
    const customerId = await getOrCreateStripeCustomer(
      user.id,
      user.email ?? undefined,
    );

    const pack = getCreditPack(parsed.data.itemKey);

    if (!pack) {
      return NextResponse.json(
        { error: "Credit pack is not configured." },
        { status: 500 },
      );
    }

    await assertStripePriceReady(stripe, pack, "payment");

    const metadata = {
      user_id: user.id,
      checkout_type: "credits",
      item_key: pack.key,
      price_id: pack.priceId,
      credits: String(pack.credits),
    };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      client_reference_id: user.id,
      line_items: [{ price: pack.priceId, quantity: 1 }],
      success_url: `${appUrl}/usage?checkout=success`,
      cancel_url: `${appUrl}/usage?checkout=cancelled`,
      allow_promotion_codes: true,
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    logInfo("stripe.checkout.session_created", {
      userId: user.id,
      checkoutSessionId: session.id,
      checkoutType: metadata.checkout_type,
      priceId: metadata.price_id,
      credits: metadata.credits,
      mode: session.mode,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    logError("stripe.checkout.failed", { error: error instanceof Error ? error.message : String(error) });
    const message = error instanceof Error ? error.message : null;

    if (error instanceof EnvConfigurationError) {
      return NextResponse.json(
        { error: envSetupMessage(error) },
        { status: 503 },
      );
    }

    if (message === BILLING_SCHEMA_MISSING_MESSAGE) {
      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json(
      { error: message ?? "Unable to start checkout." },
      { status: 500 },
    );
  }
}
