import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260609150000_harden_credit_refunds.sql",
  ),
  "utf8",
).toLowerCase();

describe("credit refund migration", () => {
  it("revokes browser-callable refund access", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.refund_credits(integer) from public",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.refund_credits(integer) from anon",
    );
    expect(migrationSql).toContain(
      "revoke execute on function public.refund_credits(integer) from authenticated",
    );
  });

  it("grants admin refunds only to the service role", () => {
    expect(migrationSql).toContain(
      "revoke execute on function public.admin_refund_credits(uuid, integer) from authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.admin_refund_credits(uuid, integer) to service_role",
    );
    expect(migrationSql).not.toContain(
      "grant execute on function public.admin_refund_credits(uuid, integer) to authenticated",
    );
  });
});
