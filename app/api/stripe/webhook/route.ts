import { NextResponse } from "next/server";
import type Stripe from "stripe";

import {
  BILLING_SCHEMA_MISSING_MESSAGE,
  isMissingBillingSchemaError,
} from "@/lib/billing/setup";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCreditPackByPriceId } from "@/lib/stripe/products";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";

export const runtime = "nodejs";

const REQUIRED_CREDIT_METADATA = [
  "user_id",
  "checkout_type",
  "price_id",
  "credits",
] as const;

const REQUIRED_SUBSCRIPTION_METADATA = [
  "user_id",
  "plan",
  "price_id",
  "credits",
] as const;

function toRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function stripeId(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const record = toRecord(value);
  const id = record?.id;

  return typeof id === "string" ? id : null;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function supabaseErrorCode(error: unknown) {
  const code = toRecord(error)?.code;

  return typeof code === "string" ? code : null;
}

function supabaseErrorMessage(context: string, error: unknown) {
  if (isMissingBillingSchemaError(error)) {
    return BILLING_SCHEMA_MISSING_MESSAGE;
  }

  const message = toRecord(error)?.message;

  return `${context}: ${typeof message === "string" ? message : "unknown error"}`;
}

function assertNoSupabaseError(context: string, error: unknown) {
  if (error) {
    throw new Error(supabaseErrorMessage(context, error));
  }
}

function logWebhookStage(stage: string, context: Record<string, unknown>) {
  console.log(`[stripe.webhook] ${stage}`, context);
}

function eventObjectId(event: Stripe.Event) {
  return stripeId(event.data.object);
}

function objectMetadata(value: unknown) {
  const metadata = toRecord(toRecord(value)?.metadata);
  const result: Record<string, string> = {};

  if (!metadata) {
    return result;
  }

  for (const [key, item] of Object.entries(metadata)) {
    if (typeof item === "string" && item.length > 0) {
      result[key] = item;
    }
  }

  return result;
}

function parseCredits(value: string) {
  if (!/^\d+$/.test(value)) {
    return null;
  }

  const credits = Number(value);

  return Number.isSafeInteger(credits) && credits > 0 ? credits : null;
}

function requiredCreditMetadata(session: Stripe.Checkout.Session) {
  const metadata = objectMetadata(session);
  const missing = REQUIRED_CREDIT_METADATA.filter((key) => !metadata[key]);

  if (missing.length > 0) {
    throw new Error(`Missing credit checkout metadata: ${missing.join(", ")}.`);
  }

  if (metadata.checkout_type !== "credits") {
    throw new Error("Unexpected checkout_type metadata for credit checkout.");
  }

  const credits = parseCredits(metadata.credits);

  if (!credits) {
    throw new Error("Invalid credit checkout credits metadata.");
  }

  return {
    userId: metadata.user_id,
    priceId: metadata.price_id,
    credits,
  };
}

function assertCreditAmountMatches(actual: number, expected: number) {
  if (actual !== expected) {
    throw new Error(
      `Credit purchase credits metadata (${actual}) does not match configured credits (${expected}).`,
    );
  }
}

function invoiceLinePeriodEnd(invoice: Stripe.Invoice) {
  const lines = toRecord(invoice)?.lines;
  const data = toRecord(lines)?.data;
  const firstLine = Array.isArray(data) ? toRecord(data[0]) : null;
  const period = toRecord(firstLine?.period);
  const end = period?.end;

  return typeof end === "number" ? new Date(end * 1000).toISOString() : null;
}

function requiredSubscriptionMetadata(invoice: Stripe.Invoice) {
  const metadata = objectMetadata(invoice);

  if (Object.keys(metadata).length === 0) {
    return null;
  }

  const hasSubscriptionSignal =
    metadata.checkout_type === "subscription" ||
    metadata.type === "subscription" ||
    Boolean(metadata.credits || metadata.plan || metadata.price_id);

  if (!hasSubscriptionSignal) {
    return null;
  }

  if (
    metadata.checkout_type &&
    metadata.checkout_type !== "subscription" &&
    metadata.type !== "subscription"
  ) {
    return null;
  }

  const missing = REQUIRED_SUBSCRIPTION_METADATA.filter((key) => !metadata[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing subscription invoice metadata: ${missing.join(", ")}.`,
    );
  }

  if (metadata.plan !== "pro" && metadata.plan !== "agency") {
    throw new Error("Invalid subscription plan metadata.");
  }

  const credits = parseCredits(metadata.credits);

  if (!credits) {
    throw new Error("Invalid subscription credits metadata.");
  }

  const subscriptionId = stripeId(toRecord(invoice)?.subscription);

  if (!subscriptionId) {
    throw new Error("Missing subscription id on paid invoice.");
  }

  return {
    userId: metadata.user_id,
    plan: metadata.plan as "pro" | "agency",
    priceId: metadata.price_id,
    credits,
    subscriptionId,
    periodEnd: invoiceLinePeriodEnd(invoice),
  };
}

async function applyCreditPurchase(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    logWebhookStage("credit_purchase.skipped_unpaid", {
      checkoutSessionId: session.id,
      paymentStatus: session.payment_status,
    });
    return;
  }

  const metadata = requiredCreditMetadata(session);
  const pack = getCreditPackByPriceId(metadata.priceId);

  if (!pack) {
    throw new Error(
      `Unknown credit price id: ${metadata.priceId}. Check STRIPE_CREDITS_*_PRICE_ID and Stripe test/live mode.`,
    );
  }

  assertCreditAmountMatches(metadata.credits, pack.credits);
  logWebhookStage("credit_purchase.apply.start", {
    checkoutSessionId: session.id,
    userId: metadata.userId,
    priceId: metadata.priceId,
    credits: pack.credits,
  });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_apply_credit_purchase", {
    p_user_id: metadata.userId,
    p_checkout_session_id: session.id,
    p_payment_intent_id: stripeId(session.payment_intent),
    p_price_id: metadata.priceId,
    p_credits: pack.credits,
    p_amount_cents: session.amount_total,
    p_currency: session.currency,
  });

  assertNoSupabaseError("Credit purchase apply failed", error);
  logWebhookStage("credit_purchase.apply.success", {
    checkoutSessionId: session.id,
    userId: metadata.userId,
    credits: pack.credits,
    balance: data,
  });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode !== "payment") {
    logWebhookStage("checkout_session.ignored_non_payment", {
      checkoutSessionId: session.id,
      mode: session.mode,
    });
    return;
  }

  await applyCreditPurchase(session);
}

async function applySubscriptionCreditGrant(invoice: Stripe.Invoice) {
  const metadata = requiredSubscriptionMetadata(invoice);

  if (!metadata) {
    logWebhookStage("subscription_credit.ignored_invoice", {
      invoiceId: invoice.id,
    });
    return;
  }

  logWebhookStage("subscription_credit.apply.start", {
    invoiceId: invoice.id,
    userId: metadata.userId,
    subscriptionId: metadata.subscriptionId,
    priceId: metadata.priceId,
    credits: metadata.credits,
    plan: metadata.plan,
  });

  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "admin_apply_subscription_credit_grant",
    {
      p_user_id: metadata.userId,
      p_invoice_id: invoice.id,
      p_subscription_id: metadata.subscriptionId,
      p_price_id: metadata.priceId,
      p_plan: metadata.plan,
      p_credits: metadata.credits,
      p_period_end: metadata.periodEnd,
    },
  );

  assertNoSupabaseError("Subscription credit grant failed", error);
  logWebhookStage("subscription_credit.apply.success", {
    invoiceId: invoice.id,
    userId: metadata.userId,
    credits: metadata.credits,
    balance: data,
  });
}

async function claimStripeEvent(event: Stripe.Event) {
  const admin = createAdminClient();
  const payload = JSON.parse(JSON.stringify(event.data.object));
  const { error } = await admin.from("stripe_events").insert({
    id: event.id,
    type: event.type,
    livemode: event.livemode,
    payload,
    processed_at: null,
  });

  if (!error) {
    return { shouldProcess: true, duplicate: false };
  }

  if (isMissingBillingSchemaError(error)) {
    throw new Error(BILLING_SCHEMA_MISSING_MESSAGE);
  }

  if (supabaseErrorCode(error) !== "23505") {
    throw new Error(supabaseErrorMessage("Stripe event claim failed", error));
  }

  const { data, error: lookupError } = await admin
    .from("stripe_events")
    .select("processed_at")
    .eq("id", event.id)
    .single();

  assertNoSupabaseError("Stripe event duplicate lookup failed", lookupError);

  if (data?.processed_at) {
    logWebhookStage("event.duplicate_processed", {
      eventId: event.id,
      type: event.type,
      objectId: eventObjectId(event),
    });
    return { shouldProcess: false, duplicate: true };
  }

  logWebhookStage("event.duplicate_retry", {
    eventId: event.id,
    type: event.type,
    objectId: eventObjectId(event),
  });
  return { shouldProcess: true, duplicate: true };
}

async function markStripeEventProcessed(event: Stripe.Event) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString() })
    .eq("id", event.id);

  assertNoSupabaseError("Stripe event processed update failed", error);
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    case "invoice.paid":
    case "invoice.payment_succeeded":
      await applySubscriptionCreditGrant(event.data.object as Stripe.Invoice);
      break;
    default:
      logWebhookStage("event.ignored", {
        eventId: event.id,
        type: event.type,
        objectId: eventObjectId(event),
      });
      break;
  }
}

export async function POST(request: Request) {
  console.log("[stripe.webhook] POST received");
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    console.log("[stripe.webhook] missing stripe-signature header");
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    const stripe = getStripe();
    const webhookSecret = getStripeWebhookSecret();

    event = stripe.webhooks.constructEvent(
      await request.text(),
      signature,
      webhookSecret,
    );
  } catch (error) {
    const message = errorMessage(error);

    if (
      message.includes("STRIPE_SECRET_KEY") ||
      message.includes("STRIPE_WEBHOOK_SECRET")
    ) {
      console.error("[stripe.webhook] configuration failed", { error: message });
      return NextResponse.json(
        { error: "Stripe webhook is not configured." },
        { status: 503 },
      );
    }

    console.error("[stripe.webhook] signature verification failed", {
      error: message,
    });
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    logWebhookStage("event.received", {
      eventId: event.id,
      type: event.type,
      livemode: event.livemode,
      objectId: eventObjectId(event),
    });
    const claim = await claimStripeEvent(event);

    if (!claim.shouldProcess) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await handleStripeEvent(event);
    await markStripeEventProcessed(event);
    logWebhookStage("event.processed", {
      eventId: event.id,
      type: event.type,
      objectId: eventObjectId(event),
      duplicateRetry: claim.duplicate,
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[stripe.webhook] processing failed", {
      eventId: event.id,
      type: event.type,
      objectId: eventObjectId(event),
      error: errorMessage(error),
    });
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
