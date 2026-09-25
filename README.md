# Duty Management App

A duty scheduling, leave management, and calendar platform — built initially for a Police department, architected so other duty "profiles" (Medical, Education, Government, Other) can be added later without a redesign.

See [`docs/PLAN.md`](docs/PLAN.md) for the full phased build plan (schema, RLS policies, and rationale for every phase).

## Stack

Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, Storage, Row Level Security) + Tailwind CSS + shadcn/ui + React Hook Form + Zod + FullCalendar. No separate backend — Next.js Server Actions/Route Handlers talk to Supabase directly.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Environment variables** — copy `.env.example` to `.env.local` and fill in your Supabase project's values (Project Settings → API in the Supabase dashboard):
   ```bash
   cp .env.example .env.local
   ```
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to expose to the browser.
   - `SUPABASE_SERVICE_ROLE_KEY` — **server-only secret**. Never prefix with `NEXT_PUBLIC_`, never import `src/lib/supabase/admin.ts` from a `"use client"` file (CI enforces this).
   - `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` — only needed to link the Supabase CLI to the hosted project.

3. **Link and migrate the database**
   ```bash
   npm run db:link
   npm run db:push
   npm run types:generate
   ```

4. **Run the dev server**
   ```bash
   npm run dev
   ```

## First-time production setup: creating the Super Admin

There is no signup path to `SUPER_ADMIN` in the app — by design, no one can self-promote. The first Super Admin is created once, out-of-band, by running:

```bash
npm run bootstrap:admin -- --email you@department.gov --password '...' --name "Your Name"
```

This script refuses to run if a Super Admin already exists. Run it once against the real Supabase project before go-live, then never again.

## Testing

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest unit tests (permission helpers, Zod schemas)
npm run test:e2e    # Playwright end-to-end flows
npm run db:lint     # Supabase/Postgres migration lint
```

CI (`.github/workflows/ci.yml`) runs all of the above on every push and pull request, plus a check that the service-role client is never imported from client-side code.
