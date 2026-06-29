# PrevAI Codebase Audit Report

## 1. Monorepo Structure & Directory Map

PrevAI is configured as a monorepo managed via `pnpm` workspaces (defined in `pnpm-workspace.yaml`).

### Root Workspace Structure
* **`package.json`**: Main workspace configuration. Defines build and typecheck scripts.
* **`tsconfig.json` & `tsconfig.base.json`**: Root TypeScript configurations setting compiler rules and project references.
* **`pnpm-workspace.yaml`**: Configures the following package paths:
  * `artifacts/*`
  * `lib/*`
  * `lib/integrations/*`
  * `scripts`

### Packages under `artifacts/` (Applications)
1. **`artifacts/preventivo-ai/`**: React frontend application (using Vite, Tailwind CSS, Radix UI, and Wouter).
2. **`artifacts/api-server/`**: Express API backend. Handles authentication, database queries, Stripe payments, WhatsApp integration, and PDF generation.
3. **`artifacts/mockup-sandbox/`**: Sandboxed environment for front-end mockup testing.
4. **`artifacts/prevai-demo-video/`**: Simple app displaying a video demonstration/walkthrough.

*Note: There is no mobile package (e.g. `preventivo-mobile`) in this workspace. However, there are responsive hooks (`use-mobile.tsx`) and mobile baseline images located inside the frontend app.*

### Packages under `lib/` (Shared Libraries & Integrations)
1. **`lib/api-spec/`**: Houses the OpenAPI spec (`openapi.yaml`) and Orval configuration (`orval.config.ts`) for code generation.
2. **`lib/api-client-react/`**: Auto-generated React Query hooks and custom fetching utility (`custom-fetch.ts`).
3. **`lib/api-zod/`**: Auto-generated Zod schemas from the OpenAPI spec, used in the backend for validating incoming requests.
4. **`lib/db/`**: Handles database connection (using pg pool) and Drizzle ORM schemas.
5. **`lib/integrations-openai-ai-react/`**: React hooks for voice/audio recording, playback, and utility functions for the frontend.
6. **`lib/integrations-openai-ai-server/`**: Server-side OpenAI integrations (handles chat completions, image processing buffers, and batch tasks).
7. **`lib/integrations/openai_ai_integrations/`**: Incomplete or legacy OpenAI integration module (lacks configuration files).

---

## 2. Module Resolution, Compilation, & Linting Issues

During the audit, three major integration/resolution anomalies were identified:

### A. The `"zod/v4"` Compilation Bug
* **Observation**: Inside all schema definition files in `lib/db/src/schema/` (e.g. `quotes.ts`, `business-profiles.ts`, `catalog.ts`, `whatsapp.ts`, `documents.ts`, `conversations.ts`, `messages.ts`), the import statement resolves from a non-existent package:
  ```typescript
  import { z } from "zod/v4";
  ```
* **Logic Chain**: The dependencies defined in `lib/db/package.json` and the root `pnpm-workspace.yaml` catalog only reference the standard package `"zod": "^3.25.76"`. No package aliases or compiler paths mapping `zod/v4` exist. As a result, compiling `lib/db` or checking types fails due to unresolved module errors.
* **Impact**: Unbuildable database package without manual resolution or rewriting.

### B. Missing Dependency Declaration in `preventivo-ai`
* **Observation**: The frontend workspace `artifacts/preventivo-ai/tsconfig.json` lists project references to the OpenAI audio integration:
  ```json
  "references": [
    { "path": "../../lib/api-client-react" },
    { "path": "../../lib/integrations-openai-ai-react" }
  ]
  ```
* **Logic Chain**: However, in `artifacts/preventivo-ai/package.json`, `@workspace/integrations-openai-ai-react` is not listed under `dependencies` or `devDependencies`.
* **Impact**: Can lead to module resolution issues under strict package isolation environments.

### C. Workspace Package Layout Violation
* **Observation**: The directory `lib/integrations/openai_ai_integrations/` is registered in `pnpm-workspace.yaml` (under `lib/integrations/*`), but it lacks a `package.json` or `tsconfig.json`.
* **Logic Chain**: It contains client/server directories with batch processing utilities (`utils.ts`) that are duplicates or variants of those in `lib/integrations-openai-ai-server/src/batch/`.
* **Impact**: Workspace toolchains (like pnpm or lerna) will complain or throw warning events about missing package definitions.

---

## 3. Database Integration (PostgreSQL + Drizzle ORM)

### Setup
* The database package (`@workspace/db`) utilizes `drizzle-orm/node-postgres` along with the `pg` client to connect to PostgreSQL.
* Connection pool is instantiated in `lib/db/src/index.ts` via the `DATABASE_URL` environment variable.
* **Migration Strategy**: The project relies on Drizzle Kit push mode:
  ```json
  "push": "drizzle-kit push --config ./drizzle.config.ts"
  ```
  No SQL migrations exist within `lib/db/migrations/`, indicating that schema changes are synchronized directly to the target database in development/production.

### Schema Definitions
* **`quotesTable`** (`quotes.ts`): Stores quote calculations, client snapshots, structural chapters (`QuoteChapter[]`), total IVA calculations, and status flags.
* **`businessProfilesTable`** (`business-profiles.ts`): Keeps business branding details (logo, contact details) and Stripe subscription metrics.
* **`authUsersTable` / `authSessionsTable` / etc.** (`auth.ts`): Standard Better-Auth database schemas.
* **`whatsappConnectionsTable` / `whatsappSessionsTable`** (`whatsapp.ts`): State tracking for AI WhatsApp chat flows.
* **`uploadedDocumentsTable` / `priceIntelligenceTable`** (`documents.ts`): Handles uploaded invoices/computo metrics and extracted prices for AI comparison.
* **`conversations` / `messages`** (`conversations.ts`, `messages.ts`): Database structures to save general chatbot dialogues.

### Bug: Missing Export for Conversations/Messages (Schema Visibility)
* **Observation**: `lib/db/src/schema/index.ts` exports quotes, business-profiles, settings, catalog, auth, whatsapp, and documents.
* **Logic Chain**: It does *not* re-export `./conversations` or `./messages`.
* **Impact**: Other packages importing `@workspace/db` or `@workspace/db/schema` cannot import `conversations` or `messages` schemas directly, blocking access to the chat tables.

---

## 4. API Client Generation & Spec Setup

* **Source Specification**: `lib/api-spec/openapi.yaml` contains the OpenAPI specification.
* **Generation Engine**: Orval (`v8.5.2`) acts as the code generator (executed via `pnpm run codegen` in the `api-spec` directory).
* **Configured Targets** in `lib/api-spec/orval.config.ts`:
  1. **`api-client-react`**: Generates React Query hooks (`@tanstack/react-query`) split across multiple files in `lib/api-client-react/src/generated/`. It resolves queries using a custom fetch mutator (`custom-fetch.ts`) to handle Bearer authentication tokens and endpoint configurations.
  2. **`zod`**: Generates Zod validation schemas into `lib/api-zod/src/generated/api/api.ts` representing requests and responses. The backend uses these models to guarantee API payload validation.

---

## 5. Italian Localization Constraint Audit

The project operates under a strict localization constraint requiring all user-facing elements to display in Italian.

### Findings & Compliance
* **Frontend UI (Compliant)**: All text elements, labels, place-holders, toast notifications, buttons, and landing sections in the React views (`artifacts/preventivo-ai/src/`) are hardcoded directly in Italian.
* **Document Engine (Compliant)**: The generated invoice/computo metrico PDF layout in the backend (`api-server/src/routes/quotes.ts`) formats all summary values and descriptions in Italian (e.g. `"TOTALE IMPONIBILE"`, `"SCONTO"`).
* **AI Prompts (Compliant)**: Generative prompts (`AI_PROMPT` in `quotes.ts` and `EXTRACTION_PROMPT` in `documents.ts`) are completely written in Italian, ensuring the AI model yields Italian text structure for computed items.

### localization Violations (English/Non-Italian Strings in API Responses)
The Express backend controllers (`api-server`) consistently return standard error responses and validation responses in English instead of Italian. This violates the localization rule for user-facing API responses.
Specific locations:
1. **Fallback server errors** (`api-server/src/app.ts` and routes):
   ```json
   { "error": "Internal server error" }
   ```
2. **Business Profile routes** (`api-server/src/routes/business-profile.ts`):
   ```json
   { "error": "Invalid request" }
   { "error": "No file uploaded. Send the file in the 'logo' field." }
   { "error": "Invalid file type. Allowed types: SVG, PNG, JPEG" }
   { "error": "File too large. Maximum size: 2 MB" }
   { "error": "Failed to upload logo" }
   ```
3. **Stripe & WhatsApp Webhooks** (`api-server/src/app.ts`):
   ```json
   { "error": "Missing stripe-signature header" }
   { "error": "Webhook secret not configured" }
   { "error": "Webhook signature error: ..." }
   { "error": "Forbidden" }
   { "error": "Invalid JSON" }
   ```
4. **Document routes** (`api-server/src/routes/documents.ts`):
   ```json
   { "error": "No file provided" }
   ```

---

## 6. Actionable Checklist & Clean-up Plan

To fix module compilation, structure compliance, and the localization requirements, the following steps are required:

| Task ID | Component | Description / Action | Priority |
|---|---|---|---|
| **TS-01** | `lib/db` | Replace all instances of `import { z } from "zod/v4"` with `import { z } from "zod"` in `lib/db/src/schema/*.ts`. | **Critical** (Blocks build) |
| **TS-02** | `lib/db` | Add exports for `conversations` and `messages` schemas in `lib/db/src/schema/index.ts`. | **High** |
| **TS-03** | `preventivo-ai` | Declare `"@workspace/integrations-openai-ai-react": "workspace:*"` in `package.json` dependencies of the React frontend. | **Medium** |
| **CL-01** | monorepo | Clean up `lib/integrations/openai_ai_integrations` directory or remove it completely to avoid warnings about missing configs. | **Low** |
| **IT-01** | `api-server` | Translate Express middleware/controller error responses to Italian: <br>- `"Internal server error"` &rarr; `"Errore interno del server"` <br>- `"Invalid request"` &rarr; `"Richiesta non valida"` <br>- `"No file uploaded..."` &rarr; `"Nessun file caricato. Invia il file nel campo 'logo'."` <br>- `"Invalid file type..."` &rarr; `"Formato file non valido. Formati supportati: SVG, PNG, JPEG"` <br>- `"File too large..."` &rarr; `"File troppo grande. Dimensione massima consentita: 2 MB"` <br>- `"Failed to upload logo"` &rarr; `"Caricamento del logo fallito"` <br>- `"No file provided"` &rarr; `"Nessun file fornito"` | **High** (Violates constraint) |
