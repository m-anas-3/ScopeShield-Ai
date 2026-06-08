# ScopeShield AI

Production MVP foundation for ScopeShield AI, a Next.js 14 App Router app that helps freelancers organize agreed project scope before AI-powered scope creep checks are added in Part 2.

## Files Created

- `.env.example` - Documents required environment variables for Supabase, OpenAI Part 2, and app URL.
- `.eslintrc.json` - Next.js 14 ESLint rules for core web vitals and TypeScript.
- `components.json` - shadcn/ui configuration pointing at Tailwind v3 config and app CSS.
- `middleware.ts` - Root middleware entry that refreshes Supabase sessions and protects dashboard routes.
- `next.config.mjs` - Next.js 14-compatible app configuration.
- `package.json` - App scripts and dependencies for Next 14, Tailwind v3, Supabase, shadcn/ui, RHF, Zod, and Sonner.
- `postcss.config.mjs` - Tailwind v3 and Autoprefixer PostCSS setup.
- `tailwind.config.ts` - Tailwind v3 theme, content paths, app colors, and animation plugin.
- `tsconfig.json` - Strict TypeScript configuration for the App Router project.
- `types/index.ts` - Shared Profile, Project, ScopeCheck, plan, risk, and AI result types.
- `supabase/migrations/20260606133952_extensions_and_tables.sql` - Creates extensions and the Part 1/Part 2 database tables.
- `supabase/migrations/20260606134002_triggers.sql` - Creates profile and `updated_at` trigger functions.
- `supabase/migrations/20260606134007_rls_policies.sql` - Enables RLS and creates per-user access policies.
- `lib/utils.ts` - Shared class merging, date formatting, and currency formatting helpers.
- `lib/actions/auth.ts` - Server actions for login, signup, and sign out.
- `lib/actions/projects.ts` - Server action for validated project creation.
- `lib/supabase/client.ts` - Browser-only Supabase client factory.
- `lib/supabase/server.ts` - Server Component and Server Action Supabase client factory.
- `lib/supabase/middleware.ts` - Supabase middleware session refresh and route guard logic.
- `lib/validations/auth.ts` - Zod schema for email/password auth forms.
- `lib/validations/project.ts` - Zod schema for project creation form validation.
- `app/layout.tsx` - Root metadata, global styles, and Sonner toaster.
- `app/page.tsx` - Landing page composition.
- `app/loading.tsx` - Landing/root loading skeleton.
- `app/(auth)/layout.tsx` - Centered auth page layout.
- `app/(auth)/login/page.tsx` - Login page.
- `app/(auth)/login/loading.tsx` - Login skeleton.
- `app/(auth)/signup/page.tsx` - Signup page.
- `app/(auth)/signup/loading.tsx` - Signup skeleton.
- `app/(dashboard)/layout.tsx` - Protected dashboard shell with sidebar, topbar, and profile/credits.
- `app/(dashboard)/loading.tsx` - Authenticated shell loading skeleton.
- `app/(dashboard)/dashboard/page.tsx` - Dashboard stats and recent checks shell.
- `app/(dashboard)/dashboard/loading.tsx` - Dashboard page skeleton.
- `app/(dashboard)/projects/page.tsx` - Projects grid and empty state.
- `app/(dashboard)/projects/loading.tsx` - Projects page skeleton.
- `app/(dashboard)/projects/new/page.tsx` - New project page.
- `app/(dashboard)/projects/new/loading.tsx` - New project skeleton.
- `app/(dashboard)/projects/[id]/page.tsx` - Project detail, scope document, and checks shell.
- `app/(dashboard)/projects/[id]/loading.tsx` - Project detail skeleton.
- `app/(dashboard)/usage/page.tsx` - Credits, plan, progress, and usage shell.
- `app/(dashboard)/usage/loading.tsx` - Usage page skeleton.
- `components/landing/Hero.tsx` - Landing hero with primary CTAs.
- `components/landing/Features.tsx` - Three feature cards.
- `components/landing/HowItWorks.tsx` - Three-step workflow section.
- `components/landing/PricingCTA.tsx` - Free and Pro pricing CTA section.
- `components/dashboard/Sidebar.tsx` - Dashboard navigation.
- `components/dashboard/TopBar.tsx` - Mobile menu, new project action, credits badge, and account menu.
- `components/dashboard/StatsCards.tsx` - Reusable dashboard stat cards.
- `components/projects/ProjectCard.tsx` - Project summary card.
- `components/projects/ProjectForm.tsx` - React Hook Form and Zod project creation form.
- `components/shared/AuthForm.tsx` - Reusable login/signup form using server actions.
- `components/shared/CreditBadge.tsx` - Credits display badge.
- `components/shared/EmptyState.tsx` - Reusable centered empty state with optional CTA.
- `components/ui/*` - shadcn/ui primitives requested for Part 1.

## Supabase SQL Steps

1. Create a Supabase project.
2. In Authentication settings, keep Email provider enabled. Add `http://localhost:3000/dashboard` as a local redirect URL.
3. Open SQL Editor.
4. Apply migrations in timestamp order:
   - `supabase/migrations/20260606133952_extensions_and_tables.sql`
   - `supabase/migrations/20260606134002_triggers.sql`
   - `supabase/migrations/20260606134007_rls_policies.sql`
5. Confirm tables exist under `public` and RLS is enabled for all four tables.
6. Sign up through the app and confirm a row is created in `public.profiles`.

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project API URL.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key used with RLS for auth and user-owned data.
- `SUPABASE_SERVICE_ROLE_KEY` - Reserved for privileged server work in Part 2. Never expose it client-side.
- `OPENAI_API_KEY` - Reserved for Part 2 AI analysis. Not used in Part 1.
- `NEXT_PUBLIC_APP_URL` - App base URL for auth redirects. Use `http://localhost:3000` locally.

## Local Run Commands

```bash
cd scopeshield
cp .env.example .env.local
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## Verification Checklist

- Landing page loads at `/` with hero, CTAs, features, how it works, pricing, and footer.
- `/signup` creates a Supabase email/password account.
- `/login` signs in and redirects to `/dashboard`.
- Protected routes redirect signed-out users to `/login`.
- `/dashboard` shows real DB counts and current credits.
- `/projects` shows an empty state before project creation.
- `/projects/new` validates required fields, saves a project, shows Sonner toast, and redirects to `/projects/[id]`.
- `/projects/[id]` displays project scope, status badge, terms, and checks empty state.
- `/usage` shows plan badge, credits balance, progress bar, and usage log shell.
- `npm run lint`, `npx tsc --noEmit`, and `npm run build` pass.

## Part 2 Connection Points

- Add `/projects/[id]/check` request form.
- Add OpenAI analysis server action or route handler.
- Insert rows into `scope_checks`.
- Add credit deduction and `usage_logs` writes in one server-side flow.
- Add `/checks/[id]` result page.
- Surface recent checks on dashboard and project detail.
- Enforce insufficient-credit handling before analysis.
