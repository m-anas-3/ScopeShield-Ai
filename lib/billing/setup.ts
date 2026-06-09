export const BILLING_MIGRATION_FILE =
  "supabase/migrations/20260609162000_stripe_billing.sql";

export const BILLING_SCHEMA_MISSING_MESSAGE = `Billing database schema is missing. Apply ${BILLING_MIGRATION_FILE} to Supabase.`;

export function isMissingBillingSchemaError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = (error as { code?: unknown }).code;

  return code === "42703" || code === "42P01" || code === "42883";
}

export function stripeSetupIssues() {
  const issues: string[] = [];

  if (!process.env.STRIPE_SECRET_KEY) {
    issues.push("Add STRIPE_SECRET_KEY to .env.local.");
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    issues.push("Add STRIPE_WEBHOOK_SECRET to .env.local.");
  }

  return issues;
}
