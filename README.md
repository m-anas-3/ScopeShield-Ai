# ScopeShield AI

ScopeShield AI is a Next.js 14 App Router MVP for freelancers and agencies to save agreed project scope, lock it into searchable scope clauses, and run AI-powered scope creep checks against new client requests.

## Current Features

- Landing page with auth CTAs and product sections.
- Supabase email/password auth with protected dashboard routes.
- Project create, edit, detail, and scope-locking flows.
- Scope chunking plus OpenAI embeddings stored in Supabase `vector`.
- AI scope analysis with retrieved locked-scope evidence.
- Credit deduction, server-side refunds on analysis failure, and usage logs.
- Result pages with status, risk, hours, matched clauses, suggested action, professional reply, and change request summary.
- Dashboard and usage pages for project counts, recent checks, and credits.

## Environment Variables

Create `.env.local` from `.env.example` and fill the required values:

```bash
cp .env.example .env.local
```

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project API URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key used with RLS.
- `SUPABASE_SERVICE_ROLE_KEY` - Server-only key used for trusted admin operations such as credit refunds.
- `OPENAI_API_KEY` - OpenAI key for embeddings and analysis.
- `OPENAI_ANALYSIS_MODEL` - Analysis model, default `gpt-4o-mini`.
- `OPENAI_EMBEDDING_MODEL` - Embedding model, default `text-embedding-3-small`.
- `OPENAI_TIMEOUT_MS` - OpenAI request timeout, default `45000`.
- `DATABASE_URL` - Used by Supabase CLI database commands.
- `NEXT_PUBLIC_APP_URL` - App base URL, for example `http://localhost:3000`.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` in client components or browser code.

## Database Setup

Apply migrations in timestamp order:

1. `supabase/migrations/20260606133952_extensions_and_tables.sql`
2. `supabase/migrations/20260606134002_triggers.sql`
3. `supabase/migrations/20260606134007_rls_policies.sql`
4. `supabase/migrations/20260608120000_rag_locking_and_credit_rpc.sql`
5. `supabase/migrations/20260608123000_fix_credit_rpc_ambiguous_columns.sql`
6. `supabase/migrations/20260609150000_harden_credit_refunds.sql`

The final migration revokes direct authenticated access to `refund_credits` and adds `admin_refund_credits`, which is executable only by `service_role`.

## Local Commands

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Database commands:

```bash
npm run db:push
npm run db:reset
npm run db:diff
```

## Manual Verification

1. Sign up through `/signup` and confirm a profile row is created.
2. Create a project at `/projects/new`.
3. Open the project detail page and lock the scope.
4. Confirm scope chunks are created and the project shows as locked.
5. Run a scope check from `/projects/[id]/check`.
6. Confirm credits decrease by 8 only after analysis starts.
7. Confirm a result row appears in `scope_checks`.
8. Confirm a `usage_logs` row is created.
9. Confirm the result page shows matched clauses and copyable reply text.
10. Confirm signed-out users are redirected from dashboard routes to `/login`.

## Security Notes

- User data access is protected by RLS policies on profiles, projects, scope checks, usage logs, and scope chunks.
- Locked scopes cannot be edited or unlocked by normal project updates.
- Credit refunds are server initiated through the service-role admin client.
- AI instructions are sent as a system message; project/client text is treated as untrusted data.

## Test Coverage

Current focused tests cover:

- Analysis prompt trust-boundary behavior.
- Scope chunking and zero-value commercial terms.
- Credit refund migration permissions.
