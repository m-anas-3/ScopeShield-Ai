# ScopeShield AI

ScopeShield AI is a Next.js 14 App Router MVP for freelancers and agencies to save agreed project scope, lock it into searchable scope clauses, and run AI-powered scope creep checks against new client requests.

## Current Features

- Landing page with auth CTAs and product sections.
- Supabase email/password auth with protected dashboard routes.
- Project create, edit, detail, and scope-locking flows.
- Scope chunking plus OpenAI embeddings stored in Supabase `vector`.
- AI scope analysis with retrieved locked-scope evidence.
- Credit deduction, server-side refunds on analysis failure, and usage logs.
- Stripe Checkout for one-time credit packs.
- Stripe webhooks for credit fulfillment.
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
- `STRIPE_SECRET_KEY` - Stripe secret key for server-side Checkout and webhook handling.
- `STRIPE_WEBHOOK_SECRET` - Stripe webhook signing secret for `/api/stripe/webhook`.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key, reserved for future client-side Stripe.js usage.
- `STRIPE_CREDITS_80_PRICE_ID` - Stripe one-time Price ID for the 80-credit pack.
- `STRIPE_CREDITS_200_PRICE_ID` - Stripe one-time Price ID for the 200-credit pack.

Do not expose `SUPABASE_SERVICE_ROLE_KEY` or `STRIPE_SECRET_KEY` in client components or browser code.

Stripe price env vars must be full IDs from Stripe, such as `price_1ABC...`. Do not enter a dollar amount like `9`, `9.99`, or `900`, and do not invent shortened IDs like `price_9`.

## Database Setup

Apply migrations in timestamp order:

1. `supabase/migrations/20260606133952_extensions_and_tables.sql`
2. `supabase/migrations/20260606134002_triggers.sql`
3. `supabase/migrations/20260606134007_rls_policies.sql`
4. `supabase/migrations/20260608120000_rag_locking_and_credit_rpc.sql`
5. `supabase/migrations/20260608123000_fix_credit_rpc_ambiguous_columns.sql`
6. `supabase/migrations/20260609150000_harden_credit_refunds.sql`
7. `supabase/migrations/20260609162000_stripe_billing.sql`
8. `supabase/migrations/20260609183000_harden_stripe_event_idempotency.sql`

The credit hardening migration revokes direct authenticated access to `refund_credits` and adds `admin_refund_credits`, which is executable only by `service_role`.

The Stripe billing migration adds Stripe profile fields, purchase/grant tables, webhook event records, and service-role-only RPCs. The app currently uses the credit purchase flow only.

## Local Commands

```bash
npm install
npm run dev
```

Local Stripe webhook forwarding must run in a second terminal while testing
Checkout:

```bash
npm run stripe:listen
```

If `npm run dev` starts on another port, forward to that exact port:

```bash
STRIPE_FORWARD_TO=localhost:3001/api/stripe/webhook npm run stripe:listen
```

Keep that process running during the Stripe Checkout test. The app should log
`[stripe.webhook] POST received` and then `credit_purchase.apply.success` when
Stripe forwards a paid credit Checkout event to `/api/stripe/webhook`.

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
11. In Stripe test mode, buy a credit pack from `/usage`.
12. Confirm `/api/stripe/webhook` verifies the event and inserts a `credit_purchases` row.
13. Confirm credits increase only after the webhook succeeds.

## Security Notes

- User data access is protected by RLS policies on profiles, projects, scope checks, usage logs, and scope chunks.
- Locked scopes cannot be edited or unlocked by normal project updates.
- Credit refunds are server initiated through the service-role admin client.
- Stripe credit grants are server initiated through service-role-only RPCs.
- Stripe webhook signatures are verified before billing fulfillment.
- AI instructions are sent as a system message; project/client text is treated as untrusted data.

## Test Coverage

Current focused tests cover:

- Analysis prompt trust-boundary behavior.
- Scope chunking and zero-value commercial terms.
- Credit refund migration permissions.
- Stripe billing catalog and migration permissions.
