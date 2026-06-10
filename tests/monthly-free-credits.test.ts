import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const baseSchemaSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260606133952_extensions_and_tables.sql",
  ),
  "utf8",
).toLowerCase();

const monthlyMigrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260609190000_monthly_free_credits.sql",
  ),
  "utf8",
).toLowerCase();

const profileHardeningMigrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260609191000_harden_profile_credit_fields.sql",
  ),
  "utf8",
).toLowerCase();

type RpcResult = {
  data: unknown;
  error: unknown;
};

async function loadMonthlyCreditsModule(rpcResult: RpcResult) {
  vi.resetModules();

  const admin = {
    rpc: vi.fn(() => Promise.resolve(rpcResult)),
  };

  vi.doMock("@/lib/supabase/admin", () => ({
    createAdminClient: () => admin,
  }));

  const credits = await import("../lib/credits/monthly");

  return { credits, admin };
}

describe("signup starter credits", () => {
  it("creates profiles with 30 starter credits", () => {
    expect(baseSchemaSql).toContain(
      "credits_balance  integer not null default 30",
    );
    expect(monthlyMigrationSql).toContain(
      "alter column credits_balance set default 30",
    );
    expect(monthlyMigrationSql).toContain(
      "insert into public.profiles (id, full_name, avatar_url, credits_balance)",
    );
    expect(monthlyMigrationSql).toContain("30");
  });
});

describe("monthly free credit migration", () => {
  it("adds an idempotent monthly grant ledger", () => {
    expect(monthlyMigrationSql).toContain(
      "create table if not exists public.monthly_credit_grants",
    );
    expect(monthlyMigrationSql).toContain("grant_month date not null");
    expect(monthlyMigrationSql).toContain(
      "credits_granted integer not null check (credits_granted > 0)",
    );
    expect(monthlyMigrationSql).toContain("unique (user_id, grant_month)");
  });

  it("adds monthly credits without resetting the balance", () => {
    expect(monthlyMigrationSql).toContain(
      "on conflict (user_id, grant_month) do nothing",
    );
    expect(monthlyMigrationSql).toContain(
      "set credits_balance = p.credits_balance + 10",
    );
    expect(monthlyMigrationSql).not.toContain("set credits_balance = 10");
    expect(monthlyMigrationSql).not.toContain("greatest(p.credits_balance");
  });

  it("keeps starter credits as the signup-month grant", () => {
    expect(monthlyMigrationSql).toContain(
      "the 30 starter credits cover the signup month",
    );
    expect(monthlyMigrationSql).toContain(
      "v_created_at >= (v_grant_month::timestamp at time zone 'utc')",
    );
  });

  it("keeps monthly grant mutation service-role only", () => {
    expect(monthlyMigrationSql).not.toContain("v_plan");
    expect(monthlyMigrationSql).not.toContain("p.plan");
    expect(monthlyMigrationSql).toContain(
      "revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from public",
    );
    expect(monthlyMigrationSql).toContain(
      "revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from anon",
    );
    expect(monthlyMigrationSql).toContain(
      "revoke execute on function public.admin_grant_monthly_free_credits(uuid, date) from authenticated",
    );
    expect(monthlyMigrationSql).toContain(
      "grant execute on function public.admin_grant_monthly_free_credits(uuid, date) to service_role",
    );
    expect(monthlyMigrationSql).not.toContain(
      "grant execute on function public.admin_grant_monthly_free_credits(uuid, date) to authenticated",
    );
  });

  it("allows users to read but not mutate grant rows through RLS", () => {
    expect(monthlyMigrationSql).toContain(
      "alter table public.monthly_credit_grants enable row level security",
    );
    expect(monthlyMigrationSql).toContain(
      'create policy "monthly_credit_grants: select own"',
    );
    expect(monthlyMigrationSql).toContain("for select");
    expect(monthlyMigrationSql).not.toContain("for insert");
    expect(monthlyMigrationSql).not.toContain("for delete");
  });

  it("prevents authenticated clients from updating profile credit fields directly", () => {
    expect(profileHardeningMigrationSql).toContain(
      'create policy "profiles: select own"',
    );
    expect(profileHardeningMigrationSql).toContain(
      "revoke update on public.profiles from public",
    );
    expect(profileHardeningMigrationSql).toContain(
      "revoke update on public.profiles from anon",
    );
    expect(profileHardeningMigrationSql).toContain(
      "revoke update on public.profiles from authenticated",
    );
    expect(profileHardeningMigrationSql).toContain(
      "grant update (full_name, avatar_url) on public.profiles to authenticated",
    );
    expect(profileHardeningMigrationSql).not.toContain(
      "grant update (credits_balance",
    );
  });
});

describe("monthly free credit helper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("calls the service-role monthly grant RPC", async () => {
    const { credits, admin } = await loadMonthlyCreditsModule({
      data: 40,
      error: null,
    });

    const balance = await credits.grantMonthlyFreeCredits("user_123");

    expect(credits.STARTER_CREDITS).toBe(30);
    expect(credits.MONTHLY_FREE_CREDITS).toBe(10);
    expect(balance).toBe(40);
    expect(admin.rpc).toHaveBeenCalledWith(
      "admin_grant_monthly_free_credits",
      { p_user_id: "user_123" },
    );
  });

  it("does not throw when the grant RPC fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { credits } = await loadMonthlyCreditsModule({
      data: null,
      error: { message: "missing function" },
    });

    await expect(
      credits.grantMonthlyFreeCredits("user_123"),
    ).resolves.toBeNull();
  });
});
