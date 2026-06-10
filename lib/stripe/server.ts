import "server-only";

import Stripe from "stripe";

import { requiredServerEnv } from "@/lib/env/server";

let stripe: Stripe | null = null;

export function getStripe() {
  const secretKey = requiredServerEnv("STRIPE_SECRET_KEY");

  stripe ??= new Stripe(secretKey);

  return stripe;
}

export function getStripeWebhookSecret() {
  return requiredServerEnv("STRIPE_WEBHOOK_SECRET");
}

export function getAppUrl() {
  return requiredServerEnv("NEXT_PUBLIC_APP_URL").replace(/\/$/, "");
}
