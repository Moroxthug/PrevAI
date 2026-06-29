# Handoff Report — E2E Testing Strategy

## 1. Observation
During the read-only exploration of the PrevAI codebase and requirements, the following details were observed:

- **Repository Workspace Setup**:
  The root `package.json` specifies workspace dependencies using `pnpm`:
  ```json
  "private": true,
  "devDependencies": {
    "typescript": "~5.9.2"
  }
  ```
  And `pnpm-workspace.yaml` maps the packages:
  ```yaml
  packages:
    - artifacts/*
    - lib/*
    - lib/integrations/*
    - scripts
  ```

- **Functional Routes & API Specifications**:
  `lib/api-spec/openapi.yaml` defines 9 core tags of REST endpoints:
  - `health`: `/healthz` (line 29)
  - `quotes`: `/quotes` (line 42), `/quotes/stats` (line 74), `/quotes/manual` (line 87), `/quotes/suggest-item-description` (line 106), `/quotes/{id}` (line 125), `/quotes/{id}/generate-pdf` (line 180), `/quotes/{id}/send-pdf-email` (line 199), `/quotes/{id}/duplicate` (line 227), `/quotes/{id}/regenerate` (line 246), `/quotes/{id}/upgrade-to-capitolato` (line 271), `/quotes/{id}/generate-pdf-pro` (line 290)
  - `business-profile`: `/business-profile` (line 309), `/business-profile/logo` (line 339)
  - `payments`: `/payments/checkout` (line 386), `/payments/webhook` (line 405), `/payments/verify/{quoteId}` (line 414), `/payments/plans` (line 433), `/payments/subscription` (line 448), `/payments/unlock-quote` (line 461), `/payments/trial-status` (line 480), `/payments/portal` (line 493)
  - `storage`: `/storage/uploads/request-url` (line 364)
  - `catalog`: `/catalog` (line 506), `/catalog/import-from-quotes` (line 757), `/catalog/{id}` (line 770)
  - `whatsapp`: `/whatsapp/status` (line 538), `/whatsapp/connect` (line 551), `/whatsapp/verify` (line 570), `/whatsapp/disconnect` (line 589), `/whatsapp/usage` (line 602), `/whatsapp/toggle` (line 615)
  - `documents`: `/documents` (line 634), `/documents/upload` (line 649), `/documents/price-summary` (line 674), `/documents/{id}/extract` (line 687), `/documents/{id}` (line 706)
  - `clients`: `/clients` (line 721), `/clients/{id}/quotes` (line 736)

- **Frontend Navigation & Redirection Rules**:
  `artifacts/preventivo-ai/src/App.tsx` contains the wouter routes and onboarding guard (lines 50-76):
  ```typescript
  function OnboardingGuard({ children }: { children: React.ReactNode }) {
    const { userId, isLoaded } = useAuth();
    const [location, setLocation] = useLocation();
    const { data: profile, isLoading } = useGetBusinessProfile({
      query: { queryKey: getGetBusinessProfileQueryKey(), enabled: isLoaded && !!userId, retry: false }
    });

    const skipped = isLoaded && !!userId && isOnboardingSkipped(userId);

    const shouldRedirect =
      isLoaded &&
      !isLoading &&
      !!userId &&
      !skipped &&
      location !== "/onboarding" &&
      profile !== undefined &&
      profile.companyName === "";

    useEffect(() => {
      if (shouldRedirect) {
        setLocation("/onboarding");
      }
    }, [shouldRedirect, setLocation]);

    if (shouldRedirect) return null;
    return <>{children}</>;
  }
  ```

- **Backend Validations and AI Bypasses**:
  `artifacts/api-server/src/routes/quotes.ts` contains:
  - Trial Auto-Unlock (lines 1124-1146):
    ```typescript
    let effectiveStatus = quote.status;
    if (quote.status === "draft" && profile?.subscriptionStatus !== "active") {
      const trial = getTrialStatus(profile ?? null);
      if (trial.isTrialActive) {
        effectiveStatus = "unlocked";
        // updates database trialDownloadsUsed and quote status
    ```
  - Document Parser Bypass (lines 399-426) where structured, tabular, or numbered computer formats skip AI completions entirely:
    ```typescript
    const isStructured = isComputoMetrico(fullText);
    if (isStructured) { ... }
    const isTabular = docTexts.length > 0 && isTabularComputoMetrico(docTexts.join("\n"));
    ...
    const isNumbered = docTexts.length > 0 && isNumberedComputoMetrico(docJoined);
    ```
  - Verification check on file types in `quotes.ts` (lines 49-56):
    ```typescript
    const ALLOWED_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    const ALLOWED_DOC_MIMES = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];
    ```

---

## 2. Logic Chain
Based on the observations:
1. **WORKSPACES & TS**: The application is a TypeScript monorepo structured via `pnpm workspaces`. This means the test runner configuration must support workspaces and compile TypeScript natively without requiring build steps.
2. **ONBOARDING REDIRECTS**: The presence of `OnboardingGuard` implies any test trying to interact with the `/dashboard` routes as a fresh user will be auto-redirected to `/onboarding`. E2E tests must either fill the onboarding form first or pre-populate the database user profile metadata to skip this.
3. **MOCK STRIPE WEBHOOKS**: Stripe checkout flows (Feature 10) trigger external Stripe checkout redirects. Since E2E testing must be local, opaque-box, and run without complex external configurations, the test infrastructure must simulate payment success by directly POSTing simulated webhook payloads to `/api/payments/webhook` with appropriate event types and metadata (quote ID, plan ID, user ID).
4. **ITALIAN LOCALIZATION VALIDATION**: To satisfy the localization requirement (R5: "strictly Italian"), E2E tests should include visual assertions or text scanner loops that check for standard English strings ("Save", "Log out", "Submit", "Delete", "Add") to detect translation leaks.
5. **DETERMINISTIC BYPASS CHECKS**: Because PDF text extraction has deterministic parser bypasses in `quotes.ts` (demolitions, builders), the tests must verify that uploading structured files correctly bypasses AI cost queries and processes deterministically.

---

## 3. Caveats
- **External Stripe UI**: Tests cannot verify the live Stripe payment portal UI because network rules prevent hitting external sites. We assume Stripe checkout functionality is fully simulated via webhook payloads.
- **AI Completion Mocks**: Since OpenAI endpoints are used for quote generation, E2E tests running locally on Windows will require valid OpenAI key environment variables unless the AI calls are mocked at the server level, or deterministic documents are uploaded to trigger the bypass path.
- **WhatsApp Webhook Spoofing**: Checking Meta WhatsApp callbacks requires sending payloads with valid signature headers (`x-hub-signature-256`) matching `WHATSAPP_APP_SECRET`.

---

## 4. Conclusion
We recommend establishing a **Playwright-based E2E TypeScript framework** co-located in `e2e-tests/` in the root workspace. Playwright provides:
- Single-runner for UI and API tests.
- Shared storage state configuration (saves cookies in a JSON file after login to bypass auth overhead in subsequent tests).
- Native execution on Windows local environments.

The detailed 4-tier E2E test suite plan has been successfully written to `TEST_INFRA.md`. This plan covers functional coverage (Tier 1), boundary/corner cases (Tier 2), full pairwise combinations of 11 features (Tier 3), and complex real-world workflows (Tier 4).

---

## 5. Verification Method
To verify the testing specification and design:
1. Check that `TEST_INFRA.md` exists in `.agents/explorer_m1_e2e_1/TEST_INFRA.md` and contains the 11 features, Tiers 1-4, and the technology choices.
2. Run `pnpm run typecheck` to verify codebase compilation is functional:
   `pnpm run typecheck`
3. Confirm that all endpoints listed in `TEST_INFRA.md` match the routes mapped in `lib/api-spec/openapi.yaml`.
