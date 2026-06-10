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

const ledgerMigrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260609192000_credit_ledger_and_analysis_idempotency.sql",
  ),
  "utf8",
).toLowerCase();

describe("Stripe billing migration", () => {
  it("adds idempotent credit purchase records", () => {
    expect(migrationSql).toContain("create table if not exists public.credit_purchases");
    expect(migrationSql).toContain("stripe_checkout_session_id text not null unique");
  });

  it("keeps credit purchase mutation RPC service-role only", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.admin_apply_credit_purchase",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) to service_role",
    );
    expect(migrationSql).not.toContain(
      "grant execute on function public.admin_apply_credit_purchase(uuid, text, text, text, integer, integer, text) to authenticated",
    );
  });

  it("adds an auditable credit ledger with RLS", () => {
    expect(ledgerMigrationSql).toContain(
      "create table if not exists public.credit_ledger_entries",
    );
    expect(ledgerMigrationSql).toContain(
      "credit_ledger_entries_idempotency_key_unique",
    );
    expect(ledgerMigrationSql).toContain(
      "alter table public.credit_ledger_entries enable row level security",
    );
    expect(ledgerMigrationSql).toContain(
      'create policy "credit_ledger_entries: select own"',
    );
    expect(ledgerMigrationSql).toContain(
      "revoke insert, update, delete on public.credit_ledger_entries from authenticated",
    );
  });

  it("records credit mutations from purchase, subscription, refund, and consumption RPCs", () => {
    expect(ledgerMigrationSql).toContain("'purchase'");
    expect(ledgerMigrationSql).toContain("'subscription'");
    expect(ledgerMigrationSql).toContain("'refund'");
    expect(ledgerMigrationSql).toContain("'scope_check'");
    expect(ledgerMigrationSql).toContain("insert into public.credit_ledger_entries");
    expect(ledgerMigrationSql).toContain(
      "credits_balance = p.credits_balance + p_credits",
    );
    expect(ledgerMigrationSql).not.toContain(
      "credits_balance = greatest(p.credits_balance, p_credits)",
    );
  });

  it("adds analysis request idempotency records", () => {
    expect(ledgerMigrationSql).toContain(
      "create table if not exists public.analysis_requests",
    );
    expect(ledgerMigrationSql).toContain(
      "unique (user_id, idempotency_key)",
    );
    expect(ledgerMigrationSql).toContain(
      "alter table public.analysis_requests enable row level security",
    );
    expect(ledgerMigrationSql).toContain(
      "revoke insert, update, delete on public.analysis_requests from authenticated",
    );
  });
});
