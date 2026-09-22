# Inventario variabili d'ambiente — produzione

**Rilevato:** 2026-09-21 (fase V2-0) con `vercel env ls production` sul progetto Vercel `prevai` (team `youssefbouchtaoui-4103s-projects`). **Solo nomi, mai valori.**

## Variabili presenti su Vercel (Production)

| Nome | Ambienti | Usata da | Note |
|---|---|---|---|
| `DATABASE_URL` | Production | `@workspace/db`, api-server | Supabase Postgres via pooler `aws-0-eu-west-1` (regione UE → decisione D7 ✅) |
| `SUPABASE_URL` | Production | storage PDF/loghi | |
| `SUPABASE_SERVICE_ROLE_KEY` | Production | storage PDF/loghi | segreto server-only |
| `BETTER_AUTH_SECRET` | Production | auth (better-auth) | |
| `PREVAI_BASE_URL` | Production | link email, sitemap, PDF | |
| `GROQ_API_KEY` | Prod, Preview, Dev | `@workspace/integrations-openai-ai-server` | **unico provider AI attivo**: il client riscrive `gpt-4o`/`gpt-4o-mini` → modelli Groq (gpt-oss, qwen3.6 per immagini) |
| `STRIPE_SECRET_KEY` | Prod, Preview, Dev | checkout, webhook | |
| `STRIPE_PUBLISHABLE_KEY` | Prod, Preview, Dev | frontend | valore in chiaro (pk_live) |
| `STRIPE_WEBHOOK_SECRET` | Prod, Preview, Dev | webhook Stripe | |
| `RESEND_API_KEY` | Prod, Preview, Dev | email transazionali | |
| `RESEND_WEBHOOK_SECRET` | Preview, Production | webhook Resend | |
| `ADMIN_EMAIL` | Prod, Preview, Dev | notifiche admin, support | |
| `NODE_ENV` | Production | | `production` |

## Variabili lette dal codice ma NON impostate in produzione

Opzionali o legacy; segnalate per completezza (fonte: grep `process.env.*` in `artifacts/`, `lib/`, `scripts/`).

| Nome | Stato | Note |
|---|---|---|
| `OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_API_KEY`, `AI_INTEGRATIONS_OPENAI_BASE_URL`, `AI_MODEL` | non necessarie | fallback se manca `GROQ_API_KEY` |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_VERIFY_TOKEN` | assenti → integrazione WhatsApp inattiva | da decidere in V2-4 |
| `POSTHOG_KEY`, `POSTHOG_HOST`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` | assenti → analytics disattivate in prod | presenti solo nel `.env` locale |
| `GSC_SITE_URL`, `GSC_SERVICE_ACCOUNT_KEY` | assenti | Search Console (script SEO) |
| `SUPABASE_PUBLIC_BUCKET`, `SUPABASE_PRIVATE_BUCKET` | assenti → default nel codice | |
| `TRUSTED_ORIGINS`, `BETTER_AUTH_URL`, `SESSION_SECRET`, `LOG_LEVEL`, `PORT`, `BASE_PATH` | assenti → default | |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS` | solo `scripts/migrate.mjs` (legacy Replit) | |
| `CLERK_SECRET_KEY` | residuo QuoteAI, non usato | da rimuovere in V2-2 |
| `VERCEL_URL`, `VERCEL_PROJECT_PRODUCTION_URL` | iniettate da Vercel | |
| `OPENAPI_SDI_BASE_URL`, `OPENAPI_SDI_SANDBOX_URL`, `OPENAPI_SDI_CODICE_DESTINATARIO` | assenti → default nel codice (`https://sdi.openapi.it`, `https://test.sdi.openapi.it`, `JKKZDGR`) | A-1: servono solo se il proprio contratto Openapi usa host o codice destinatario diversi. **Il token API non è una env**: sta cifrato in `sdi_settings` per impresa (RUNBOOKS §6) |

## File locali

- `.env` — sviluppo locale (contiene anche PostHog). **Non committato.**
- `.env.production` — pull da Vercel (`vercel env pull`). **Non committato.**

Per la v2 (QuoteAI port) le variabili aggiuntive richieste vanno elencate in `PREVAI-V2-PLAN.md` e aggiunte qui quando impostate.


---

# Riferimento QuoteAI (base importata in V2-1, 2026-09-21)

> Sezione ereditata dal repo QuoteAI e rigenerata a ogni fase con `pnpm env:inventory` (V2-4: senza le variabili QuickBooks/Wave/Financeit/Flinks/Google LSA). Le parti sopra questa riga riguardano la produzione PrevAI; le variabili nuove vanno impostate su Vercel in V2-5.

### Environment inventory

Generated 2026-09-22 by `pnpm env:inventory` — 81 variables read by the code, 90 in the manifest (Vercel side not checked).

Kinds: **required** (boot/core flows) · **recommended** (launch expectation, degraded without) · **feature** (integration reports "not configured") · **deferred** (partner access pending, intentionally unset) · legacy / build / platform / local.

### required

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `ADMIN_EMAIL` | ? |  | comma list; /api/admin/* access and default recipient of ops alerts | api-server/src/lib/ops.ts, api-server/src/routes/admin.ts |  |
| `BETTER_AUTH_SECRET` | ? |  | session signing; rotating it logs everyone out | api-server/src/invoices/service.ts, api-server/src/lib/auth.ts, api-server/src/routes/calendar.ts (+3) |  |
| `BETTER_AUTH_URL` | ? |  | https://quoteai.ca — auth callback base | api-server/src/lib/auth.ts |  |
| `CRON_SECRET` | ? |  | Vercel Cron bearer for /api/cron/tick; nothing scheduled runs without it | api-server/src/routes/cron.ts |  |
| `DATABASE_URL` | ? |  | Supabase Postgres via the session pooler (aws-0-us-west-2.pooler.supabase.com:5432) | api-server/scripts/backup.ts, api-server/scripts/rotate-token-key.ts, lib/db/src/index.ts (+1) |  |
| `GROQ_API_KEY` | ? |  | the AI provider in production (OpenAI-compatible); without any AI key every AI feature takes its fallback | lib/integrations-openai-ai-server/src/client.ts |  |
| `PREVAI_BASE_URL` | ? |  | public origin used in emails/PDF links | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `RESEND_API_KEY` | ? |  | every transactional email (auth, quotes, invoices, ops alerts) | api-server/src/lib/auth.ts, api-server/src/lib/email.ts, api-server/src/lib/emailUtils.ts (+4) |  |
| `STRIPE_CONNECT_WEBHOOK_SECRET` | ? |  | POST /api/payments/connect/webhook signature (Phase 14 invoices paid by card) | api-server/src/app.ts |  |
| `STRIPE_PUBLISHABLE_KEY` | ? |  | returned to the client for Checkout | api-server/src/stripeClient.ts |  |
| `STRIPE_SECRET_KEY` | ? |  | subscriptions + Connect | api-server/src/stripeClient.ts |  |
| `STRIPE_WEBHOOK_SECRET` | ? |  | POST /api/payments/webhook signature | api-server/src/app.ts |  |
| `SUPABASE_PRIVATE_BUCKET` | ? |  | private-assets (signed URLs) | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `SUPABASE_PUBLIC_BUCKET` | ? |  | public-assets | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `SUPABASE_SERVICE_ROLE_KEY` | ? |  | Storage service key — server only, never in the client | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `SUPABASE_URL` | ? |  | Storage (logos, PDFs, photos) | api-server/src/lib/objectStorage.ts, api-server/scripts/backup.ts |  |
| `TOKEN_ENCRYPTION_KEY` | ? |  | AES-256-GCM key for OAuth tokens at rest — see RUNBOOKS → rotate TOKEN_ENCRYPTION_KEY | api-server/src/lib/crypto.ts |  |
| `TRUSTED_ORIGINS` | ? |  | comma list of origins allowed by CORS + better-auth | api-server/src/lib/auth.ts |  |

### recommended

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `CRON_HEARTBEAT_URL` | ? |  | dead-man switch pinged after each successful tick (Healthchecks.io / Better Stack / Cronitor) | api-server/src/lib/ops.ts |  |
| `CRON_STALE_AFTER_HOURS` | ? |  | default 25 (daily schedule + 1 h grace); set 2 if the cron moves to hourly | api-server/src/lib/ops.ts |  |
| `OPS_ALERT_EMAIL` | ? |  | where cron/automation alerts go; falls back to ADMIN_EMAIL | api-server/src/lib/ops.ts |  |
| `POSTHOG_HOST` | ? |  | defaults to https://eu.i.posthog.com | api-server/src/lib/telemetry.ts |  |
| `POSTHOG_KEY` | ? |  | server telemetry; unset = no product analytics | api-server/src/lib/telemetry.ts |  |
| `RESEND_WEBHOOK_SECRET` | ? |  | POST /api/webhooks/resend — without it bounce/complaint events are rejected (500) and email_events stays empty | api-server/src/app.ts |  |
| `SENTRY_DSN` | ? |  | API error tracking; unset = errors only in Vercel logs | api-server/src/lib/errorTracking.ts |  |
| `VITE_POSTHOG_HOST` | ? |  | defaults to https://eu.i.posthog.com | preventivo-ai/src/lib/analytics.ts |  |
| `VITE_POSTHOG_KEY` | ? |  | browser analytics (loaded on first interaction) | preventivo-ai/src/App.tsx, preventivo-ai/src/lib/analytics.ts |  |
| `VITE_SENTRY_DSN` | ? |  | browser error tracking (same DSN is fine) | preventivo-ai/src/lib/error-tracking.ts |  |

### feature

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `AI_MODEL` | ? | AI | model override; Groq rewrites gpt-4o* names itself | api-server/src/contracts/service.ts, api-server/src/incentives/verification.ts, api-server/src/jobs/setup.ts (+1) |  |
| `GMAIL_SEND_CLIENT_ID` | ? | Gmail send | Phase 20 — OAuth app registration pending (growth-platform-plan) | api-server/src/lib/gmailSendClient.ts |  |
| `GMAIL_SEND_CLIENT_SECRET` | ? | Gmail send |  | api-server/src/lib/gmailSendClient.ts |  |
| `GMAIL_SEND_REDIRECT_URI` | ? | Gmail send |  | api-server/src/lib/gmailSendClient.ts |  |
| `GOOGLE_CALENDAR_CLIENT_ID` | ? | Google Calendar | Phase 12 | api-server/src/lib/googleCalendarClient.ts |  |
| `GOOGLE_CALENDAR_CLIENT_SECRET` | ? | Google Calendar |  | api-server/src/lib/googleCalendarClient.ts |  |
| `GOOGLE_CALENDAR_REDIRECT_URI` | ? | Google Calendar |  | api-server/src/lib/googleCalendarClient.ts |  |
| `GSC_SERVICE_ACCOUNT_KEY` | ? | Search Console (admin) | admin SEO panel only | api-server/src/routes/admin.ts |  |
| `GSC_SITE_URL` | ? | Search Console (admin) |  | api-server/src/routes/admin.ts |  |
| `META_APP_ID` | ? | Meta Lead Ads | Phase 28 | api-server/src/lib/metaLeadAdsClient.ts, api-server/src/routes/meta-lead-ads.ts |  |
| `META_APP_SECRET` | ? | Meta Lead Ads |  | api-server/src/app.ts, api-server/src/lib/metaLeadAdsClient.ts, api-server/src/routes/meta-lead-ads.ts |  |
| `META_LEADGEN_VERIFY_TOKEN` | ? | Meta Lead Ads |  | api-server/src/routes/meta-lead-ads.ts |  |
| `META_REDIRECT_URI` | ? | Meta Lead Ads |  | api-server/src/lib/metaLeadAdsClient.ts |  |
| `WHATSAPP_ACCESS_TOKEN` | ? | WhatsApp | Phase 9 — Meta app + template approval pending | api-server/src/routes/whatsapp.ts |  |
| `WHATSAPP_APP_SECRET` | ? | WhatsApp | webhook signature; the webhook 500s without it (safe: nothing is accepted) | api-server/src/app.ts |  |
| `WHATSAPP_BUSINESS_NUMBER` | ? | WhatsApp |  | api-server/src/routes/whatsapp.ts |  |
| `WHATSAPP_LEAD_FOLLOWUP_TEMPLATE` | ? | WhatsApp | approved template names | api-server/src/automations/leadFollowup.ts, api-server/src/routes/leads.ts |  |
| `WHATSAPP_PHONE_NUMBER_ID` | ? | WhatsApp |  | api-server/src/routes/whatsapp.ts |  |
| `WHATSAPP_PHOTO_SHARE_TEMPLATE` | ? | WhatsApp |  | api-server/src/routes/jobs.ts |  |
| `WHATSAPP_REVIEW_REQUEST_TEMPLATE` | ? | WhatsApp |  | api-server/src/automations/jobReviewRequest.ts |  |
| `WHATSAPP_VERIFY_TOKEN` | ? | WhatsApp |  | api-server/src/routes/whatsapp.ts |  |

### deferred

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `OUTLOOK_CALENDAR_CLIENT_ID` | ? |  | Phase 16 — Entra app registration not done | api-server/src/lib/outlookCalendarClient.ts |  |
| `OUTLOOK_CALENDAR_CLIENT_SECRET` | ? |  |  | api-server/src/lib/outlookCalendarClient.ts |  |
| `OUTLOOK_CALENDAR_REDIRECT_URI` | ? |  |  | api-server/src/lib/outlookCalendarClient.ts |  |

### legacy

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `AI_INTEGRATIONS_OPENAI_API_KEY` | ? |  | Replit-era alias; e2e uses it to point AI at a closed port | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | ? |  | Replit-era alias | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `INVOICE_LINK_SECRET` | ? |  | HMAC for public invoice links; falls back to BETTER_AUTH_SECRET (set in prod) — only needed to rotate invoice links independently of sessions | api-server/src/invoices/service.ts |  |
| `OPENAI_API_KEY` | ? |  | alias of the AI key; GROQ_API_KEY wins | lib/integrations-openai-ai-server/src/audio/client.ts, lib/integrations-openai-ai-server/src/client.ts, lib/integrations-openai-ai-server/src/image/client.ts |  |
| `SESSION_SECRET` | ? |  | read by lib/auth for the pre-better-auth cookie; kept set, harmless | api-server/src/invoices/service.ts, api-server/src/lib/auth.ts |  |
| `admin_email` | ? |  | lowercase alias of ADMIN_EMAIL | api-server/src/routes/admin.ts |  |
| `posthog_host` | ? |  | lowercase alias of POSTHOG_HOST | api-server/src/lib/telemetry.ts |  |
| `posthog_key` | ? |  | lowercase alias of POSTHOG_KEY | api-server/src/lib/telemetry.ts |  |

### build

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `SENTRY_AUTH_TOKEN` | ? |  | build-time only: source map inject + upload (scripts/sentry-sourcemaps.mjs) | preventivo-ai/vite.config.ts |  |
| `SENTRY_ENVIRONMENT` | ? |  | optional override; defaults to VERCEL_ENV | api-server/src/lib/errorTracking.ts |  |
| `SENTRY_ORG` | ? |  | with SENTRY_AUTH_TOKEN |  |  |
| `SENTRY_PROJECT` | ? |  | with SENTRY_AUTH_TOKEN |  |  |
| `SENTRY_RELEASE` | ? |  | optional override; defaults to VERCEL_GIT_COMMIT_SHA | api-server/src/lib/errorTracking.ts, preventivo-ai/vite.config.ts, scripts/sentry-sourcemaps.mjs |  |
| `VITE_SENTRY_ENVIRONMENT` | ? |  | optional override for the browser side | preventivo-ai/src/lib/error-tracking.ts |  |

### platform

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `NODE_ENV` | ? |  | vercel.json sets production | api-server/src/app.ts, api-server/src/lib/errorTracking.ts, api-server/src/lib/logger.ts (+1) |  |
| `VERCEL_ENV` | ? |  |  | api-server/src/lib/errorTracking.ts |  |
| `VERCEL_GIT_COMMIT_SHA` | ? |  | becomes the Sentry release | api-server/src/lib/errorTracking.ts, preventivo-ai/vite.config.ts, scripts/sentry-sourcemaps.mjs |  |
| `VERCEL_PROJECT_PRODUCTION_URL` | ? |  |  | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `VERCEL_REGION` | ? |  |  | api-server/src/lib/errorTracking.ts |  |
| `VERCEL_SKIP_TYPECHECK` | ? |  | vercel.json |  |  |
| `VERCEL_URL` | ? |  |  | api-server/src/lib/auth.ts, api-server/src/lib/baseUrl.ts |  |
| `VITE_RELEASE` | ? |  | injected by vite.config.ts from VERCEL_GIT_COMMIT_SHA | preventivo-ai/src/lib/error-tracking.ts, preventivo-ai/vite.config.ts |  |

### local

| Variable | Vercel | Feature | Note | Read by | Problem |
|---|---|---|---|---|---|
| `API_PROXY_TARGET` | ? |  | server/serve.mjs proxy (Lighthouse QA) | preventivo-ai/vite.config.ts, preventivo-ai/server/serve.mjs |  |
| `BACKUP_DATABASE_URL` | ? |  | GitHub Actions secret: the nightly backup source |  |  |
| `BACKUP_PASSPHRASE` | ? |  | ops:backup encryption (also a GitHub Actions secret for the nightly backup) | api-server/scripts/backup.ts, api-server/scripts/restore.ts |  |
| `BASE_PATH` | ? |  | vite base override | preventivo-ai/vite.config.ts |  |
| `E2E_DEBUG` | ? |  | e2e harness |  |  |
| `E2E_NO_PURGE` | ? |  | e2e harness |  |  |
| `E2E_REAL_AI` | ? |  | e2e harness |  |  |
| `INCENTIVES_SOURCE_FETCH` | ? |  | V2-4: "off" disattiva le richieste ai siti ufficiali nella verifica del catalogo incentivi (suite e2e) | api-server/src/incentives/verification.ts |  |
| `LOG_LEVEL` | ? |  | pino level; default info | api-server/src/lib/logger.ts |  |
| `PORT` | ? |  | local server only | api-server/src/index.ts, preventivo-ai/vite.config.ts, preventivo-ai/server/serve.mjs |  |
| `PRERENDER_SAMPLE` | ? |  | validate-prerender sample size | preventivo-ai/scripts/validate-prerender.ts |  |
| `QA_CHROME_PATH` | ? |  | qa:visual / qa:lighthouse |  |  |
| `RESTORE_DATABASE_URL` | ? |  | ops:restore target (or --target) | api-server/scripts/restore.ts |  |
| `RESTORE_SUPABASE_SERVICE_ROLE_KEY` | ? |  |  | api-server/scripts/restore.ts |  |
| `RESTORE_SUPABASE_URL` | ? |  | ops:restore --storage target project | api-server/scripts/restore.ts |  |
| `WALKTHROUGH_FRONTEND` | ? |  | walkthrough script |  |  |

### Summary

No problems.
