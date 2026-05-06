# PreventivoAI

A SaaS web app for Italian freelancers/craftsmen to describe a job in natural language, get an AI-generated professional quote (preventivo), preview it with watermark, and unlock PDF download via Stripe payment.

## Run & Operate

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

**Required env vars:** `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PRIVATE_OBJECT_DIR`, `PUBLIC_OBJECT_SEARCH_PATHS`, `STRIPE_SECRET_KEY` (optional), `STRIPE_WEBHOOK_SECRET` (optional), `RESEND_API_KEY` (optional — needed for subscription emails from no-reply@prevai.it)

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifact: `preventivo-ai`, path `/`)
- **API framework**: Express 5 (artifact: `api-server`, path `/api`)
- **Database**: PostgreSQL + Drizzle ORM (`lib/db`)
- **Auth**: Clerk (`@clerk/express` backend, `@clerk/react` frontend)
- **AI**: OpenAI via Replit AI Integrations (`lib/integrations-openai-ai-server`)
- **Payments**: Stripe
- **Object Storage**: Replit Object Storage via GCS presigned URLs
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec`)
- **Build**: esbuild (CJS bundle for API server)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/db/src/schema/` — Drizzle DB schema (quotes, business-profiles)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/objectStorage.ts` — GCS presigned URL helper
- `artifacts/api-server/src/lib/objectAcl.ts` — ACL / serving helper
- `artifacts/api-server/src/routes/storage.ts` — `/api/storage` router
- `artifacts/preventivo-ai/src/pages/` — React pages (home, dashboard/*, sign-in, sign-up, seo/*)
- `artifacts/preventivo-ai/src/components/layout/` — PublicLayout, DashboardLayout

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks + Zod validators
- Clerk auth proxy only activated in production (`import.meta.env.PROD`); dev uses Clerk CDN directly
- Backend uses `getAuth(req)` from `@clerk/express` to extract `userId` from JWT
- AI prompt returns structured JSON only; server parses it and maps to DB schema
- PDF generation returns HTML string; browser opens it in a new window and triggers `window.print()`
- Plans are defined statically in `payments.ts` (no DB table needed)
- Logo upload uses a two-step presigned URL flow: client requests URL → PUTs file directly to GCS → saves serving URL `/api/storage/objects/...` in business_profiles
- `companySnapshot` is captured at quote creation time (snapshot of profile at that moment), so PDF always reflects the correct company data even if the profile later changes
- Subscription state stored in `business_profiles` (`subscriptionPlan`, `subscriptionStatus`, `stripeCustomerId`); set by webhook on `checkout.session.completed` (mode=subscription); cleared on `customer.subscription.deleted`
- Quote auto-unlock: on quote detail load, if `subscriptionStatus === "active"`, frontend calls `POST /api/payments/unlock-quote` which unlocks without payment; saves `unlockedWithPlan` on the quote
- PDF watermark is plan-aware: `monthly_starter` and `oneshot_watermark` keep watermark + PrevAI logo (inline SVG) even when unlocked; `monthly_pro` and `oneshot_clean` get user logo + no watermark
- Quote editing locked after first PDF download (`pdfDownloadedAt` timestamp column); `POST /api/quotes/:id/regenerate` re-runs AI on an existing quote (blocked after download too)
- Upgrade flow: `POST /api/payments/portal` creates a Stripe Customer Portal session for Starter→Pro upgrade; Stripe handles proration
- Email notification: on subscription activation, webhook calls Resend API (`artifacts/api-server/src/lib/email.ts`) to send welcome+receipt HTML email from `no-reply@prevai.it`; silently skips if `RESEND_API_KEY` is unset
- Logo upload hidden for Starter users (profile page shows upgrade CTA instead)

## Product

- Landing page with hero, benefits, demo quote preview, pricing plans
- Auth via Clerk (sign-in/sign-up pages)
- Dashboard: stats overview, recent quotes, create/list/view quotes
- AI quote generation: 3-section form (company preview, client data, work description) → OpenAI generates structured JSON → saved as draft
- Quote creation captures clientData (nome, indirizzo, CF, P.IVA, citta, CAP, provincia) and companySnapshot at time of creation
- Quote detail: rendered invoice-style preview with watermark if locked, inline client editing
- Paywall modal: 4 pricing plans (2 monthly subscriptions, 2 one-shot), Stripe checkout
- Business profile settings: company name, VAT, address, phone, email, logo upload (SVG/PNG/JPG via Object Storage)
- SEO landing pages for: imbianchino, elettricista, idraulico, ristrutturazione, edilizia

## User preferences

_Populate as you build_

## Gotchas

- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any OpenAPI spec change
- `pnpm --filter @workspace/db run push` required after schema changes (dev only — use migrations in prod)
- Clerk proxy middleware (`clerkProxyMiddleware`) skips in development, only active in production
- Do NOT run `pnpm dev` at workspace root — use workflow restart instead
- Object Storage serving URL format: `/api/storage/objects/<uuid>` (objectPath from presigned URL response)

## Pointers

- `.local/skills/pnpm-workspace/` — workspace conventions and patterns
- `.local/skills/clerk-auth/` — Clerk auth setup and configuration
- `.local/skills/react-vite/` — React+Vite frontend guidelines
- `.local/skills/object-storage/` — Object Storage (GCS presigned URL) patterns
