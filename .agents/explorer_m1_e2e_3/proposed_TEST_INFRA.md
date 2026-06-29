# Test Infrastructure Specifications (TEST_INFRA.md)

This document outlines the test philosophy, feature inventory, test architecture, and coverage thresholds for the PrevAI opaque-box End-to-End (E2E) test suite.

---

## 1. Test Philosophy

### Opaque-Box & Requirement-Driven
The testing strategy is designed to validate the user-facing functionality of the PrevAI application. It focuses on the behavioral responses of the system under test (SUT) from the user's perspective, without depending on internal implementation details (such as whether components are React/Vite, Express, or specific Drizzle ORM layouts).

### Isolation & Hermetic Testing
To ensure tests are deterministic, fast, and repeatable locally, all external integrations are simulated/mocked:
1. **OpenAI / AI Integration**: Intercept calls to AI providers (GPT-4o, GPT-4o-transcribe, GPT-4o vision) to return mock, structured JSON or text outputs.
2. **Stripe Payments**: Intercept outbound Stripe checkout requests and mock Stripe webhook calls to simulate payment capture, subscription activations, portal redirects, and cancellations.
3. **WhatsApp (Meta Graph API)**: Intercept outgoing messaging calls (`graph.facebook.com`) and mock incoming webhook triggers (`POST /api/whatsapp/webhook`).
4. **Resend Email Service**: Intercept outgoing emails and verify delivery/payloads programmatically.
5. **GCS / S3 Object Storage**: Mock storage uploads and presigned URL generations to run locally without hitting Google Cloud Platform.

### Strictly Italian Localization Verification
As a core design constraint, all user-facing strings must remain in Italian. The E2E tests include assertions to verify that page titles, placeholders, error notifications, and email layouts are written in Italian, catching any accidental leak of English translation fragments.

---

## 2. Feature Inventory

We have mapped the user-facing functionalities of PrevAI into **10 core features**:

### F1: User Authentication & Session Management
- **Description**: Validates Sign Up, Sign In, session persistence (Better Auth), route protection, and logout.
- **Backend Enpoints**: `/api/auth/*`
- **DB Schema Tables**: `users`, `sessions`, `accounts`, `verifications`
- **Dependencies**: Resend (email verification), Better Auth cookies.

### F2: Onboarding & Business Profile Settings
- **Description**: Ensures new users complete the onboarding questionnaire and manages business profile data, including logo uploads.
- **Backend Endpoints**: `GET /api/business-profile`, `PUT /api/business-profile`, `POST /api/business-profile/logo`
- **DB Schema Tables**: `business_profiles`
- **Dependencies**: Storage (logo file upload), Auth session.

### F3: AI-Assisted Quote Generation (Web Interface)
- **Description**: Generates automated, structured construction quotes from text prompts, uploaded files (PDF, DOCX, XLSX), or photos.
- **Backend Endpoints**: `POST /api/quotes` (multipart/form-data)
- **DB Schema Tables**: `quotes`, `quote_attachments`
- **Dependencies**: OpenAI API (parsing & pricing), Storage (file storage).

### F4: Manual Quote Builder & Editor (Web Interface)
- **Description**: Creation and inline modifications of client details, items, chapters, discounts, payment plans, and PDF layouts manually.
- **Backend Endpoints**: `POST /api/quotes/manual`, `PUT /api/quotes/{id}`
- **DB Schema Tables**: `quotes`
- **Dependencies**: Auth session.

### F5: Quote Actions, Versioning & Post-Processing
- **Description**: Functions to duplicate, delete, request AI item description suggestions, or run AI corrections/capitolato upgrades on existing quotes.
- **Backend Endpoints**: `POST /api/quotes/{id}/duplicate`, `DELETE /api/quotes/{id}`, `POST /api/quotes/suggest-item-description`, `POST /api/quotes/{id}/regenerate`, `POST /api/quotes/{id}/upgrade-to-capitolato`
- **DB Schema Tables**: `quotes`, `quote_attachments`
- **Dependencies**: OpenAI API, Auth session.

### F6: Price Catalog Management
- **Description**: Personal price list builder used to search and auto-complete item costs inside the quote editor.
- **Backend Endpoints**: `GET /api/catalog`, `POST /api/catalog`
- **DB Schema Tables**: `price_catalog_items`
- **Dependencies**: Auth session.

### F7: Clients Directory & Insights
- **Description**: Consolidates customer contacts dynamically from quotes, displaying quotes lists and historical revenue sums.
- **Backend Endpoints**: `GET /api/clients`, `GET /api/clients/{id}/quotes`
- **DB Schema Tables**: `quotes` (client details extracted from quote metadata)
- **Dependencies**: Auth session.

### F8: Document Storage & Price Intelligence
- **Description**: Scans contractor documents to compile a dashboard showing minimum, maximum, and average task rates in the market.
- **Backend Endpoints**: `GET /api/documents`, `POST /api/documents/upload`, `POST /api/documents/{id}/extract`, `GET /api/documents/price-summary`, `DELETE /api/documents/{id}`
- **DB Schema Tables**: `uploaded_documents`, `price_intelligence`
- **Dependencies**: OpenAI API, Storage.

### F9: WhatsApp Conversational Chatbot Flow
- **Description**: Connecting phone numbers via OTP and generating/modifying quotes in an interactive chatbot conversation.
- **Backend Endpoints**: `GET /api/whatsapp/status`, `POST /api/whatsapp/connect`, `POST /api/whatsapp/verify`, `DELETE /api/whatsapp/disconnect`, `PATCH /api/whatsapp/toggle`, `POST /api/whatsapp/webhook`
- **DB Schema Tables**: `whatsapp_connections`, `whatsapp_otp`, `whatsapp_sessions`
- **Dependencies**: Meta Graph API, OpenAI API (transcription & completion), Storage (document buffer uploads).

### F10: Billing, Payments & PDF Delivery
- **Description**: Unlocking PDFs for download (trial vs subscription), Stripe billing sessions, portal redirections, and email PDF dispatch.
- **Backend Endpoints**: `GET /api/payments/plans`, `GET /api/payments/subscription`, `POST /api/payments/checkout`, `POST /api/payments/unlock-quote`, `POST /api/quotes/{id}/generate-pdf`, `POST /api/quotes/{id}/send-pdf-email`, `/api/payments/webhook`
- **DB Schema Tables**: `quotes`, `business_profiles`
- **Dependencies**: Stripe API, Resend, PDFMake generator.

---

## 3. Test Architecture & Directory Layout

To keep the codebase clean and modular, the E2E test suite is located in a dedicated monorepo workspace package under the `artifacts` directory:

```
artifacts/e2e-tests/
├── package.json               # Defines dependencies, E2E scripts, and workspaces config
├── playwright.config.ts       # Playwright global settings, timeouts, base URLs, and state sharing
├── tsconfig.json              # TypeScript compilation rules for test files
└── src/
    ├── mocks/                 # Interceptors and stubs for third-party endpoints
    │   ├── openai.mock.ts     # Mocks chat completions, image OCR, and audio transcription
    │   ├── stripe.mock.ts     # Intercepts session creation, simulates payment webhooks
    │   ├── whatsapp.mock.ts   # Intercepts outbound WhatsApp messages
    │   └── resend.mock.ts     # Intercepts mail transmissions, stores locally for inspection
    ├── fixtures/              # Test environment setups and state sharing
    │   ├── db-helper.ts       # Database connectivity (drizzle + pg) to clear/seed tables
    │   ├── auth-helper.ts     # Programmatic session generation to bypass UI login flows
    │   └── page-fixtures.ts   # Extends default Playwright test fixture with custom helpers
    └── specs/
        ├── tier1_features/    # Basic feature validation suites (50 tests total)
        ├── tier2_boundaries/  # Validation of error flows, boundary limits (50 tests total)
        ├── tier3_pairwise/    # Integrated pairwise feature combinations
        └── tier4_scenarios/   # End-to-end multi-step real-world workloads
```

---

## 4. Coverage Thresholds

| Test Tier | Scope | Target Test Cases | Success Metrics |
|---|---|---|---|
| **Tier 1** | Feature Coverage | >= 5 tests per feature (50 total) | 100% pass, strict Italian locale assertions |
| **Tier 2** | Boundaries & Corner Cases | >= 5 tests per feature (50 total) | Graceful error pages/modals in Italian, DB cleanups |
| **Tier 3** | Cross-Feature Pairwise | All core logical integration paths | Smooth state propagation between modules |
| **Tier 4** | Real-World Workloads | 5 end-to-end user journeys | Zero manual interventions, complete data flow |

---

## 5. Executable Test Runner Recommendation

For a lightweight, clean, and reliable local installation on Windows, the recommended stack is:

1. **Test Runner**: **Playwright Test** (`@playwright/test`)
   - **Why**: Native TypeScript execution, built-in headless browser management (no global driver installations), parallel execution, and powerful network interception (`page.route`) which enables direct mocking of Stripe, OpenAI, and Meta Graph API within the test threads.
2. **Execution Command**:
   - `pnpm install` (monorepo root)
   - `pnpm --filter @workspace/e2e-tests exec playwright install chromium` (installs headless chromium binary locally)
   - `pnpm --filter @workspace/e2e-tests run test:e2e` (runs the full suite)
3. **Database Control**:
   - Playwright setup hooks connect to PostgreSQL via `@workspace/db` using the `DATABASE_URL` env variable to truncate tables and seed mocks between test suites, maintaining test hermeticity.
