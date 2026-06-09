import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCreditPackByPriceId,
  getSubscriptionPlanByPriceId,
  type SubscriptionPlanKey,
} from "@/lib/stripe/products";
import { getStripe, getStripeWebhookSecret } from "@/lib/stripe/server";

export const runtime = "nodejs";

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

function metadataValue(value: unknown, key: string) {
  const metadata = toRecord(toRecord(value)?.metadata);
  const item = metadata?.[key];

  return typeof item === "string" && item.length > 0 ? item : null;
}

function unixSecondsToIso(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value * 1000).toISOString()
    : null;
}

function firstInvoicePriceId(invoice: Stripe.Invoice) {
  const lines = toRecord(invoice)?.lines;
  const data = toRecord(lines)?.data;

  if (!Array.isArray(data)) {
    return null;
  }

  for (const line of data) {
    const lineRecord = toRecord(line);
    const legacyPriceId = stripeId(lineRecord?.price);
    const pricing = toRecord(lineRecord?.pricing);
    const priceDetails = toRecord(pricing?.price_details);
    const currentPriceId = priceDetails?.price;

    if (legacyPriceId) {
      return legacyPriceId;
    }

    if (typeof currentPriceId === "string") {
      return currentPriceId;
    }
  }

  return null;
}

function firstInvoicePeriodEnd(invoice: Stripe.Invoice) {
  const lines = toRecord(invoice)?.lines;
  const data = toRecord(lines)?.data;

  if (!Array.isArray(data)) {
    return null;
  }

  for (const line of data) {
    const periodEnd = toRecord(toRecord(line)?.period)?.end;
    const iso = unixSecondsToIso(periodEnd);

    if (iso) {
      return iso;
    }
  }

  return null;
}

function subscriptionPriceId(subscription: Stripe.Subscription) {
  const data = toRecord(toRecord(subscription)?.items)?.data;

  if (!Array.isArray(data)) {
    return null;
  }

  const firstItem = toRecord(data[0]);

  return stripeId(firstItem?.price);
}

function subscriptionPeriodEnd(subscription: Stripe.Subscription) {
  return unixSecondsToIso(toRecord(subscription)?.current_period_end);
}

function subscriptionCustomerId(subscription: Stripe.Subscription) {
  return stripeId(toRecord(subscription)?.customer);
}

async function profileIdForStripeCustomer(customerId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (error || !data) {
    return null;
  }

  return data.id;
}

async function applyCreditPurchase(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    return;
  }

  const userId =
    metadataValue(session, "user_id") ??
    (typeof session.client_reference_id === "string"
      ? session.client_reference_id
      : null);
  const priceId = metadataValue(session, "price_id");

  if (!userId || !priceId) {
    throw new Error("Missing credit checkout metadata.");
  }

  const pack = getCreditPackByPriceId(priceId);

  if (!pack) {
    throw new Error(`Unknown credit price id: ${priceId}`);
  }

  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_apply_credit_purchase", {
    p_user_id: userId,
    p_checkout_session_id: session.id,
    p_payment_intent_id: stripeId(session.payment_intent),
    p_price_id: priceId,
    p_credits: pack.credits,
    p_amount_cents: session.amount_total,
    p_currency: session.currency,
  });

  if (error) {
    throw new Error(`Credit purchase apply failed: ${error.message}`);
  }
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const customerId = subscriptionCustomerId(subscription);
  const priceId = subscriptionPriceId(subscription);
  const userId =
    metadataValue(subscription, "user_id") ??
    (customerId ? await profileIdForStripeCustomer(customerId) : null);

  if (!userId || !customerId) {
    throw new Error("Subscription is missing user or customer metadata.");
  }

  const plan = priceId ? getSubscriptionPlanByPriceId(priceId) : null;
  const activeLikeStatuses = new Set(["active", "trialing", "past_due"]);
  const nextPlan =
    plan && activeLikeStatuses.has(subscription.status) ? plan.key : "free";
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      plan: nextPlan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscription.id,
      stripe_subscription_price_id: priceId,
      subscription_status: subscription.status,
      subscription_current_period_end: subscriptionPeriodEnd(subscription),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Subscription sync failed: ${error.message}`);
  }
}

async function applySubscriptionInvoice(invoice: Stripe.Invoice) {
  const invoiceId = invoice.id;
  const invoiceRecord = toRecord(invoice);
  const customerId = stripeId(invoiceRecord?.customer);
  const parent = toRecord(invoiceRecord?.parent);
  const subscriptionDetails = toRecord(parent?.subscription_details);
  const subscriptionId =
    stripeId(invoiceRecord?.subscription) ??
    stripeId(subscriptionDetails?.subscription);

  if (!invoiceId || !subscriptionId) {
    return;
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const priceId =
    firstInvoicePriceId(invoice) ?? subscriptionPriceId(subscription);

  if (!priceId) {
    throw new Error("Subscription invoice is missing a price id.");
  }

  const plan = getSubscriptionPlanByPriceId(priceId);

  if (!plan) {
    return;
  }

  const userId =
    metadataValue(invoice, "user_id") ??
    metadataValue(subscription, "user_id") ??
    (customerId ? await profileIdForStripeCustomer(customerId) : null);

  if (!userId) {
    throw new Error("Subscription invoice is missing user metadata.");
  }

  const periodEnd =
    firstInvoicePeriodEnd(invoice) ?? subscriptionPeriodEnd(subscription);
  const admin = createAdminClient();
  const { error } = await admin.rpc("admin_apply_subscription_credit_grant", {
    p_user_id: userId,
    p_invoice_id: invoiceId,
    p_subscription_id: subscriptionId,
    p_price_id: priceId,
    p_plan: plan.key as SubscriptionPlanKey,
    p_credits: plan.credits,
    p_period_end: periodEnd,
  });

  if (error) {
    throw new Error(`Subscription credit grant failed: ${error.message}`);
  }

  await syncSubscription(subscription);
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  if (session.mode === "payment") {
    await applyCreditPurchase(session);
    return;
  }

  if (session.mode === "subscription") {
    const subscriptionId = stripeId(session.subscription);

    if (subscriptionId) {
      await syncSubscription(await getStripe().subscriptions.retrieve(subscriptionId));
    }
  }
}

async function recordStripeEvent(event: Stripe.Event) {
  const admin = createAdminClient();
  const payload = JSON.parse(JSON.stringify(event.data.object));
  const { error } = await admin.from("stripe_events").upsert(
    {
      id: event.id,
      type: event.type,
      livemode: event.livemode,
      payload,
    },
    { onConflict: "id" },
  );

  if (error) {
    throw new Error(`Stripe event record failed: ${error.message}`);
  }
}

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await handleCheckoutCompleted(
        event.data.object as Stripe.Checkout.Session,
      );
      break;
    case "invoice.paid":
      await applySubscriptionInvoice(event.data.object as Stripe.Invoice);
      break;
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    default:
      break;
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing Stripe signature." },
      { status: 400 },
    );
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      await request.text(),
      signature,
      getStripeWebhookSecret(),
    );
  } catch (error) {
    console.error("Stripe webhook signature verification failed", error);
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 },
    );
  }

  try {
    await handleStripeEvent(event);
    await recordStripeEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed", error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 },
    );
  }
}
