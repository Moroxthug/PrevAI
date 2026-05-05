# PreventivoAI

A SaaS web app for Italian freelancers/craftsmen to describe a job in natural language, get an AI-generated professional quote (preventivo), preview it with watermark, and unlock PDF download via Stripe payment.

## Run & Operate

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

**Required env vars:** `DATABASE_URL`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `VITE_CLERK_PUBLISHABLE_KEY`, `SESSION_SECRET`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `STRIPE_SECRET_KEY` (optional), `STRIPE_WEBHOOK_SECRET` (optional)

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
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec in `lib/api-spec`)
- **Build**: esbuild (CJS bundle for API server)

## Where things live

- `lib/api-spec/openapi.yaml` — source of truth for API contract
- `lib/api-client-react/src/generated/` — generated React Query hooks (do not edit)
- `lib/api-zod/src/generated/` — generated Zod schemas (do not edit)
- `lib/db/src/schema/` — Drizzle DB schema (quotes, business-profiles)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/preventivo-ai/src/pages/` — React pages (home, dashboard/*, sign-in, sign-up, seo/*)
- `artifacts/preventivo-ai/src/components/layout/` — PublicLayout, DashboardLayout

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed React Query hooks + Zod validators
- Clerk auth proxy only activated in production (`import.meta.env.PROD`); dev uses Clerk CDN directly
- Backend uses `getAuth(req)` from `@clerk/express` to extract `userId` from JWT
- AI prompt returns structured JSON only; server parses it and maps to DB schema
- PDF generation returns HTML string; browser opens it in a new window and triggers `window.print()`
- Plans are defined statically in `payments.ts` (no DB table needed)

## Product

- Landing page with hero, benefits, demo quote preview, pricing plans
- Auth via Clerk (sign-in/sign-up pages)
- Dashboard: stats overview, recent quotes, create/list/view quotes
- AI quote generation: user inputs natural language → OpenAI generates structured JSON → saved as draft
- Quote detail: rendered invoice-style preview with watermark if locked, inline client editing
- Paywall modal: 4 pricing plans (2 monthly subscriptions, 2 one-shot), Stripe checkout
- Business profile settings (company name, VAT, address, phone, email)
- SEO landing pages for: imbianchino, elettricista, idraulico, ristrutturazione, edilizia

## User preferences

_Populate as you build_

## Gotchas

- `pnpm --filter @workspace/api-spec run codegen` must be re-run after any OpenAPI spec change
- `pnpm --filter @workspace/db run push` required after schema changes (dev only — use migrations in prod)
- Clerk proxy middleware (`clerkProxyMiddleware`) skips in development, only active in production
- Do NOT run `pnpm dev` at workspace root — use workflow restart instead

## Pointers

- `.local/skills/pnpm-workspace/` — workspace conventions and patterns
- `.local/skills/clerk-auth/` — Clerk auth setup and configuration
- `.local/skills/react-vite/` — React+Vite frontend guidelines
