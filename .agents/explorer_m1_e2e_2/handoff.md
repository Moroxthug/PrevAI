# E2E Test Suite Design Handoff Report

This report summarizes the E2E test suite design findings and recommendation for Milestone 1 E2E.

---

## 1. Observation

During our investigation of the PrevAI codebase and specification, we observed the following concrete patterns, file routes, schemas, and configurations:

- **API Routes**: Evaluated in `lib/api-spec/openapi.yaml`. For example, lines 42-46:
  ```yaml
  /quotes:
    get:
      operationId: listQuotes
      tags: [quotes]
      summary: List all quotes for the authenticated user
  ```
  And lines 309-313:
  ```yaml
  /business-profile:
    get:
      operationId: getBusinessProfile
      tags: [business-profile]
      summary: Get the authenticated user's business profile
  ```

- **Client Routing**: Evaluated in `artifacts/preventivo-ai/src/App.tsx`. For example, lines 101-104:
  ```tsx
      {/* Dashboard (private, not indexed) */}
      <Route path="/dashboard" component={() => (
        <OnboardingGuard><DashboardLayout><DashSuspense><DashboardHome /></DashSuspense></DashboardLayout></OnboardingGuard>
      )} />
```

- **Authentication Wiring**: Managed via Better Auth on the backend in `artifacts/api-server/src/app.ts`, lines 37-43:
  ```typescript
  app.use((req, res, next): void => {
    if (req.url?.startsWith("/api/auth/") || req.url === "/api/auth") {
      void toNodeHandler(auth)(req, res);
      return;
    }
    next();
  });
  ```

- **Database Schemas & Quote Statuses**: Tracked in `lib/db/src/schema/quotes.ts`, lines 88-89:
  ```typescript
    status: text("status", { enum: ["draft", "unlocked", "pending_payment"] }).notNull().default("draft"),
    pdfUrl: text("pdf_url"),
  ```

- **Localization Requirements**: Expressed in the project-wide `ORIGINAL_REQUEST.md` (lines 31-33):
  ```markdown
  - Do NOT change any design or UI elements unless explicitly requested.
  - Ensure all user-facing strings, labels, placeholders, and error messages remain strictly in Italian (no English translations or placeholders).
  ```

- **Workspace Setup**: Confirmed that the monorepo is governed via pnpm in `pnpm-workspace.yaml` and contains two main applications (`artifacts/preventivo-ai`, `artifacts/api-server`) along with database libraries (`lib/db/src/schema/`).

---

## 2. Logic Chain

1. **Identifying Functional Scope**: By mapping the API paths from `openapi.yaml` (Observation: Quote, Business Profile, Payments, Storage, Catalog, WhatsApp, Clients, Documents endpoints) and the wouter views in `App.tsx` (Observation: Public pages, Sign-In/Up, Onboarding, and Dashboard private panels), we deduced 9 distinct, user-facing features that cover the full system boundary.
2. **Developing the 4-Tier Test Framework**:
   - **Tier 1 (Coverage)** verifies that the standard flows for all 9 features function successfully (e.g., standard login, quote generation, database snapshot checks).
   - **Tier 2 (Boundaries)** stresses those features under limits, negative constraints, and rate limits (e.g., negative quote unit values, uploading >3 files, 401/404 handling).
   - **Tier 3 (Cross-Feature combinations)** validates inter-feature state dynamics (e.g., generating an AI quote -> importing items to the catalog -> using them in a manual quote).
   - **Tier 4 (Workloads)** structures comprehensive user journeys simulating real-world contractor use-cases (e.g., "New user registration -> Onboarding -> First AI quote creation").
3. **Selecting the Testing Infrastructure**:
   - The test runner must execute reliably on Windows (Observation: User Information OS is Windows).
   - Playwright was selected because it provides native Windows-compiled headless browsers (stored in `%USERPROFILE%\AppData\Local\ms-playwright`), processes TS files natively without complex compilation setups, supports isolated parallelism via lightweight browser contexts, and handles both UI-driven browser tests and direct HTTP API requests.
4. **Validating Localization**:
   - E2E tests must verify user interactions in Italian as mandated by the localization constraint (Observation: `ORIGINAL_REQUEST.md`). Playwright page locators can explicitly assert text contents like button labels (e.g., `text="Preventivo Manuale"`) and validation errors (e.g., `"Credenziali non valide"`), ensuring localization remains intact.

---

## 3. Caveats

- **External Integrations Mocking**: The Stripe payment integration (`/api/payments/checkout` & webhook), WhatsApp Meta APIs (`/api/whatsapp/connect` & OTP webhook), and OpenAI/Gemini AI APIs are mockable but cannot be tested against production services in E2E environments without sandboxes. We assume that a mock API service/middleware or a database-seeding strategy is used to simulate these external callbacks (e.g. manually inserting webhook payloads to `/api/payments/webhook` inside tests).
- **Authentication Bypass**: In UI tests, logging in through the user interface for every test adds significant overhead. We assume E2E runners will use cookies/storage state injection (via Playwright's `storageState`) or bypass login using session seed scripts.

---

## 4. Conclusion

We conclude that a comprehensive, requirement-driven opaque-box E2E test suite can be implemented cleanly using **Playwright** under a newly created workspace directory (`tests-e2e`). The 4-tier strategy structured in `TEST_INFRA.md` completely covers the 9 core features, their edge cases, integration bounds, and real-world workloads, ensuring 100% compliance with the Italian localization constraints without changing frontend design or implementation.

---

## 5. Verification Method

To verify the test suite design and codebase readiness:
1. **Inspect Draft File**: Review `TEST_INFRA.md` in the working directory `c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\explorer_m1_e2e_2\` to inspect the exact test case specifications.
2. **Workspace compilation**: Run `pnpm run typecheck` from the monorepo root to verify that all current workspaces are compilation-error-free.
3. **Verify API Spec Mapping**: Check that every API path referenced in `TEST_INFRA.md` corresponds directly to an endpoint defined in `lib/api-spec/openapi.yaml`.
