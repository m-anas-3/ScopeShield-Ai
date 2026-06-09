import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260609162000_stripe_billing.sql",
  ),
  "utf8",
).toLowerCase();

describe("Stripe billing migration", () => {
  it("adds idempotent billing records", () => {
    expect(migrationSql).toContain("create table if not exists public.credit_purchases");
    expect(migrationSql).toContain("stripe_checkout_session_id text not null unique");
    expect(migrationSql).toContain(
      "create table if not exists public.subscription_credit_grants",
    );
    expect(migrationSql).toContain("stripe_invoice_id text not null unique");
  });

  it("keeps credit mutation RPCs service-role only", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.admin_apply_credit_purchase",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) to service_role",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.admin_apply_subscription_credit_grant(uuid, text, text, text, text, integer, timestamptz) to service_role",
    );
    expect(migrationSql).not.toContain(
      "grant execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) to authenticated",
    );
  });
});
