# PreventivoAI

A SaaS web app for Italian freelancers/craftsmen to describe a job in natural language, get an AI-generated professional quote (preventivo), preview it clean (no watermark), and unlock PDF download via Stripe payment.

## Run & Operate

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

**Required env vars:** `DATABASE_URL`, `SESSION_SECRET` (also used as `BETTER_AUTH_SECRET` fallback), `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `ADMIN_EMAIL` (admin access — `bchysfmel@gmail.com`), `RESEND_API_KEY` (optional — needed for subscription emails from no-reply@prevai.it)

**Optional:** `BETTER_AUTH_SECRET` (overrides SESSION_SECRET for auth signing), `BETTER_AUTH_URL` (overrides base URL derivation from REPLIT_DOMAINS)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifact: `preventivo-ai`, path `/`)
- **API framework**: Express 5 (artifact: `api-server`, path `/api`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: Better Auth (`better-auth` backend + `better-auth/react` frontend) — self-hosted, session cookies, Resend emails
- **AI**: OpenAI via Replit AI Integrations (`lib/integrations-openai-ai-server`)
- **Payments**: Stripe
- **Object Storage**: Replit Object Storage via GCS presigned URLs
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec`)
- **Build**: esbuild (CJS bundle for API server); `kysely` marked as external (Better Auth peer dep)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/db/src/schema/` — Drizzle DB schema (quotes, business-profiles, catalog, **auth tables**)
- `lib/db/src/schema/auth.ts` — Better Auth tables (auth_user, auth_session, auth_account, auth_verification)
- `artifacts/api-server/src/lib/auth.ts` — Better Auth instance (Drizzle adapter + Resend email)
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — `requireAuth` middleware + `getUserId`/`getUserEmail` helpers
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/preventivo-ai/src/lib/auth-client.ts` — Better Auth React client
- `artifacts/preventivo-ai/src/hooks/use-auth.ts` — custom `useAuth()` hook (wraps Better Auth session)
- `artifacts/preventivo-ai/src/pages/` — React pages (home, dashboard/*, sign-in, sign-up, seo/*, onboarding)
- `artifacts/preventivo-ai/src/components/layout/` — PublicLayout, DashboardLayout (collapsible sidebar)
- `artifacts/preventivo-ai/src/pages/dashboard/settings.tsx` — unified Impostazioni page (Account + Piano tabs)

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks + Zod validators
- **Auth**: Better Auth (self-hosted) replaces Clerk. Sessions stored in `auth_session` table. Session cookie (same-origin, `credentials: "include"`), no Bearer tokens.
- Better Auth handler mounted via raw Express `app.use` middleware (before `express.json()`) to avoid Express 5 wildcard syntax issues. Base path: `/api/auth`.
- `requireAuth` middleware reads session from cookie via `auth.api.getSession`; sets `res.locals.userId` / `res.locals.userEmail`.
- `getUserId(res)` reads from `res.locals.userId`; throws 401 if absent.
- AI prompt returns structured JSON only; server parses it and maps to DB schema
- PDF generation returns HTML string; browser opens it in a new window and triggers `window.print()`
- Plans are defined statically in `payments.ts` (no DB table needed)
- `companySnapshot` is captured at quote creation time; PDF always reflects data at creation time
- Subscription state stored in `business_profiles`; set by webhook on `checkout.session.completed`
- Quote auto-unlock: on quote detail load, if `subscriptionStatus === "active"`, frontend calls `POST /api/payments/unlock-quote`
- PDF watermark is plan-aware (backend logic unchanged); frontend always shows clean preview — paywall only triggers on download
- Quote editing locked after first PDF download (`pdfDownloadedAt`); regenerate also blocked after download
- Onboarding guard (`OnboardingGuard` in App.tsx): if user has no `companyName` on first login, redirected to `/onboarding`
- Sidebar collapsed state persisted in `localStorage` key `sidebar-collapsed`

## Product

- Landing page with hero, benefits, demo quote preview, pricing plans
- Auth via Better Auth (custom sign-in/sign-up forms at `/sign-in`, `/sign-up`; password reset via email)
- **Onboarding**: `/onboarding` — collects company name, logo, P.IVA, address, phone, email before first quote
- **Collapsible sidebar**: Dashboard / Preventivi / Analytics / Listino (Pro only) / Impostazioni / Account Aziendale
- Dashboard: stats overview, recent quotes
- **New quote page**: ChatGPT-style large textarea, photo upload inline, example chips, collapsible client data panel
- Quote detail: always-clean preview (no watermark, company logo), all sections editable (capitoli, client data, condizioni), paywall only on "Scarica PDF" click
- Paywall modal: 4 pricing plans (2 monthly subscriptions, 2 one-shot), Stripe checkout
- **Unified settings page** `/dashboard/settings`: tabs "Account Aziendale" (profile + logo) and "Piano & Fatturazione" (billing)
- Analytics placeholder at `/dashboard/analytics`
- SEO landing pages for: imbianchino, elettricista, idraulico, ristrutturazione, edilizia

## User preferences

- Admin email: `bchysfmel@gmail.com` — access `/admin` while logged in with this account
- Stripe account: `acct_1TTwBIEKcNcM20o5` (bchysf@gmail.com) — env vars take priority over Replit integration connector

## Google Search Console — come completare la verifica

Il meta tag di verifica è già in `artifacts/preventivo-ai/index.html` come placeholder.
Per completare la verifica e indicizzare la sitemap, segui questi passi:

1. Vai su [Google Search Console](https://search.google.com/search-console) e accedi con l'account Google del sito.
2. Clicca "Aggiungi proprietà" → scegli "Prefisso URL" → inserisci `https://www.prevai.it`.
3. Scegli il metodo **"Tag HTML"**. Google ti mostrerà un tag del tipo:
   `<meta name="google-site-verification" content="CODICE_UNIVOCO" />`
4. Copia il valore del campo `content` e comunicalo all'agente, che sostituirà `PLACEHOLDER` nel file `index.html` e rigenererà i prerendered con `pnpm --filter @workspace/preventivo-ai run build`.
5. Torna su Search Console, clicca "Verifica" — il tag sarà presente nel sito live.
6. Nella sezione **"Sitemap"**, inserisci `https://www.prevai.it/sitemap.xml` e clicca "Invia".

**File rilevanti:**
- `artifacts/preventivo-ai/index.html` — contiene il meta tag (riga `google-site-verification`)
- `artifacts/preventivo-ai/public/robots.txt` — già include `Sitemap: https://www.prevai.it/sitemap.xml`
- `artifacts/preventivo-ai/public/sitemap.xml` — generato automaticamente al build (1105 URL)

## Gotchas

- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any OpenAPI spec change
- `pnpm --filter @workspace/db run push` required after schema changes (dev only — use migrations in prod)
- `kysely` is a peer dep of better-auth's drizzle adapter — must be installed in `api-server` and marked as `external` in `build.mjs` to avoid esbuild bundling conflicts
- Better Auth session requires `credentials: "include"` on all fetch calls to `/api/*`
- Do NOT run `pnpm dev` at workspace root — use workflow restart instead
- Object Storage serving URL format: `/api/storage/objects/<uuid>` (objectPath from presigned URL response)
- Legacy routes `/dashboard/profile` and `/dashboard/billing` still accessible but not in sidebar; use `/dashboard/settings` instead

## Pointers

- `.local/skills/pnpm-workspace/` — workspace conventions and patterns
- `.local/skills/react-vite/` — React+Vite frontend guidelines
- `.local/skills/object-storage/` — Object Storage (GCS presigned URL) patterns
