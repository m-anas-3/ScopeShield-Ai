import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    "supabase/migrations/20260611110000_change_requests.sql",
  ),
  "utf8",
).toLowerCase();

describe("change request migration", () => {
  it("adds the owned change request model with statuses and share tokens", () => {
    expect(migrationSql).toContain(
      "create table if not exists public.change_requests",
    );
    expect(migrationSql).toContain(
      "status in ('draft', 'sent', 'approved', 'rejected', 'paid')",
    );
    expect(migrationSql).toContain(
      "public_share_token text not null default encode(gen_random_bytes(24), 'hex')",
    );
    expect(migrationSql).toContain(
      "change_requests_public_share_token_unique",
    );
    expect(migrationSql).toContain("change_requests_hours_range_check");
    expect(migrationSql).toContain("change_requests_scope_check_unique");
  });

  it("enforces project/check ownership and owner-only RLS", () => {
    expect(migrationSql).toContain(
      "alter table public.change_requests enable row level security",
    );
    expect(migrationSql).toContain(
      'create policy "change_requests: select own"',
    );
    expect(migrationSql).toContain("auth.uid() = user_id");
    expect(migrationSql).toContain(
      "constraint change_requests_project_owner_fk",
    );
    expect(migrationSql).toContain(
      "create or replace function public.validate_change_request_links()",
    );
    expect(migrationSql).toContain(
      "revoke insert, update, delete on public.change_requests from authenticated",
    );
  });

  it("exposes public approval through narrow token RPCs only", () => {
    expect(migrationSql).toContain(
      "create or replace function public.get_shared_change_request(p_token text)",
    );
    expect(migrationSql).toContain(
      "create or replace function public.respond_to_shared_change_request",
    );
    expect(migrationSql).toContain(
      "where cr.public_share_token = p_token",
    );
    expect(migrationSql).toContain("and cr.status = 'sent'");
    expect(migrationSql).toContain(
      "grant execute on function public.get_shared_change_request(text) to anon, authenticated",
    );
    expect(migrationSql).toContain(
      "grant execute on function public.respond_to_shared_change_request(text, text, text) to anon, authenticated",
    );
  });

  it("does not leak owner identifiers through the shared view RPC", () => {
    const sharedFunction = migrationSql.slice(
      migrationSql.indexOf(
        "create or replace function public.get_shared_change_request",
      ),
      migrationSql.indexOf(
        "create or replace function public.respond_to_shared_change_request",
      ),
    );
    const returnAndSelectList = sharedFunction.slice(
      0,
      sharedFunction.indexOf("from public.change_requests as cr"),
    );

    expect(returnAndSelectList).not.toContain("cr.user_id");
    expect(returnAndSelectList).not.toContain("public_share_token");
  });
});
