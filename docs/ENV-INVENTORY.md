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

## File locali

- `.env` — sviluppo locale (contiene anche PostHog). **Non committato.**
- `.env.production` — pull da Vercel (`vercel env pull`). **Non committato.**

Per la v2 (QuoteAI port) le variabili aggiuntive richieste vanno elencate in `PREVAI-V2-PLAN.md` e aggiunte qui quando impostate.
