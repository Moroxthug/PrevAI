# Handoff Report — Explorer 3

## 1. Observation

### Source Code Paths and Configurations
- **Database Schema**: Evaluated `lib/db/src/schema/` containing schemas for:
  - Quotes: `lib/db/src/schema/quotes.ts` (defining `quotesTable` with fields like `items`, `capitoli`, `status`, `sconto`, and `pdfUrl`)
  - WhatsApp: `lib/db/src/schema/whatsapp.ts` (defining `whatsappConnectionsTable`, `whatsappOtpTable`, and `whatsappSessionsTable`)
- **Backend Routing**: Inspected `artifacts/api-server/src/routes/index.ts` where routers are mounted at lines 15–24:
  ```typescript
  router.use(healthRouter);
  router.use(quotesRouter);
  router.use(businessProfileRouter);
  router.use(paymentsRouter);
  router.use(storageRouter);
  router.use(adminRouter);
  router.use(catalogRouter);
  router.use(whatsappRouter);
  router.use(clientsRouter);
  router.use(documentsRouter);
  ```
- **Frontend Routing**: Inspected `artifacts/preventivo-ai/src/App.tsx` utilizing `wouter` router at lines 83–162, including paths:
  - Public routes: `/` (home), `/whatsapp`, `/chi-siamo`, `/contatti`, `/privacy`, `/termini`
  - Auth routes: `/sign-in`, `/sign-up`, `/onboarding`
  - Dashboard routes (guarded): `/dashboard`, `/dashboard/new`, `/dashboard/quotes`, `/dashboard/quotes/:id`, `/dashboard/catalog`, `/dashboard/clients`, `/dashboard/documents`, `/dashboard/billing`
- **Authentication**: Evaluated `better-auth` integration in `artifacts/api-server/src/lib/auth.ts` and `artifacts/preventivo-ai/src/lib/auth-client.ts`.
- **WhatsApp Webhook Bot**: Evaluated `artifacts/api-server/src/routes/whatsapp.ts` which implements verification hooks (`GET /whatsapp/webhook`), incoming message ingestion (`POST /whatsapp/webhook`), session states (`awaiting_template_selection`, `awaiting_client_choice`, etc.), and intent classification.
- **Testing State**: Searched the entire workspace for existing test files (e.g. `*.test.*` or `*.spec.*`) and found 0 testing modules.

---

## 2. Logic Chain

1. **Test Infrastructure Selection**:
   - The project is a monorepo workspace managed via `pnpm` workspaces (Observation: root `pnpm-workspace.yaml`).
   - The frontend is React + Vite (`artifacts/preventivo-ai`), and the backend is an Express 5 server (`artifacts/api-server`).
   - For a local Windows environment without complex third-party software installations, **Playwright Test** (`@playwright/test`) is selected. Playwright runs tests in native TypeScript (no need for a separate bundler or Selenium setup), manages headless chromium/firefox binaries internally, and supports API-level assertions alongside front-end user actions.
   
2. **Feature Inventory (N = 10)**:
   - By mapping backend routes (Observation: `index.ts` routers) and frontend pages (Observation: `App.tsx` paths), the system is divided into **10 core user-facing features**:
     1. User Authentication & Session Management
     2. Onboarding & Business Profile Settings
     3. AI-Assisted Quote Generation (Web Interface)
     4. Manual Quote Builder & Editor (Web Interface)
     5. Quote Actions, Versioning & Post-Processing
     6. Price Catalog Management
     7. Clients Directory & Insights
     8. Document Storage & Price Intelligence
     9. WhatsApp Conversational Chatbot Flow
     10. Billing, Payments & PDF Delivery
   - This mapping allows systematic 4-tier E2E testing targeting all core modules.

3. **4-Tier E2E Test Suite Structure**:
   - **Tier 1 (Feature Coverage)**: Validates standard functionality (>=5 test cases per feature = 50 total). Ensures the happy paths work.
   - **Tier 2 (Boundary & Corner Cases)**: Validates input limits, validation failures, size limits, negative rates, unauthorized operations, and token expirations (>=5 test cases per feature = 50 total). Ensures security and stability.
   - **Tier 3 (Cross-Feature Pairwise)**: Verifies integrations (e.g., creating catalog items and inserting them in a quote, or starting a quote via WhatsApp and updating it on the web dashboard).
   - **Tier 4 (Real-World Scenarios)**: Designs 5 workload flows representing deep, end-to-end user journeys (Complete Artisan Web Journey, WhatsApp Mobile Contractor Journey, Price Intelligence Workflow, Proposal Negotiation Workflow, Admin Troubleshooting Workflow).

4. **Localization Rule Compliance**:
   - The user request requires strictly Italian user-facing copy (Observation: `ORIGINAL_REQUEST.md`).
   - E2E tests will enforce this by asserting that form validation messages, confirmation notices, email body stubs, and page headings do not leak default English templates.

---

## 3. Caveats

- **Mock Dependencies**: The E2E tests assume that third-party integrations (Stripe gateway, OpenAI, Meta Graph API, Resend) are fully mocked. Direct execution against production APIs is out of scope.
- **Database Provisioning**: The test runner is assumed to run on the local database (configured via `DATABASE_URL`), resetting and seeding test profiles between runs to remain hermetic.
- **WhatsApp Webhook Simulation**: Since we cannot trigger actual Meta incoming messages in test runs, the E2E suite simulates messages by directly posting to `/api/whatsapp/webhook` with formatted JSON payloads.

---

## 4. Conclusion

We have analyzed the PrevAI codebase and designed a comprehensive opaque-box E2E test suite. All findings, feature maps, test architectures, and implementation recommendations have been documented in the proposed `TEST_INFRA.md` located at:
`c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\explorer_m1_e2e_3\proposed_TEST_INFRA.md`

We recommend adopting **Playwright Test** within a new monorepo workspace package `artifacts/e2e-tests` to maintain a clean layout separation while having direct workspace access to the backend API types and schema fixtures.

---

## 5. Verification Method

To verify the test design specifications:
1. View the proposed specification file: `c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\explorer_m1_e2e_3\proposed_TEST_INFRA.md`.
2. Confirm the 10 features cover all backend routers mapped in `artifacts/api-server/src/routes/index.ts`.
3. Confirm that the 4-tier E2E testing strategy meets all task instructions (Feature Coverage >= 5, Boundary Cases >= 5, Pairwise combinations, and >=5 real-world workloads).
