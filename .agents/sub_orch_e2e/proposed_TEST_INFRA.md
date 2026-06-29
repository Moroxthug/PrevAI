# PrevAI E2E Testing Infrastructure (TEST_INFRA.md)

## 1. Test Philosophy
The PrevAI End-to-End (E2E) test suite adopts an **opaque-box, requirement-driven testing** approach.
- **Opaque-Box**: Tests interact with the application through its user interface (via browser automation) and exposed API endpoints. They do not depend on internal frontend state or backend implementation details.
- **Requirement-Driven**: Test cases are systematically derived from the core requirements in `ORIGINAL_REQUEST.md`.
- **Strict Italian Localization**: All user-facing text, page headings, button labels, validation messages, and PDF outputs must be verified to be strictly in Italian. The test suite proactively asserts this constraint.
- **Isolation of Third-Party Dependencies**: External services (Stripe billing, WhatsApp Meta API, OpenAI text generation, Resend email) are mocked or simulated using local handlers to ensure fast, deterministic, and hermetic execution.

---

## 2. Core User-Facing Feature Inventory
We identify **11 core user-facing features** of PrevAI to structure the test suite:

1. **Authentication & Session Management**: User registration, login, logout, password reset request, and session persistence (Better Auth).
2. **User Onboarding Flow**: Redirection of new users with empty company names to onboarding, and wouter-based routing guard rails.
3. **Business Profile & Brand Identity**: Profile detail configuration (company name, Partita IVA, address) and company logo upload (PNG/JPG < 5MB).
4. **AI-Assisted Quote Generator**: Generation of quotes via natural language prompts, target budget scaling, template layouts (Standard/Professional/Elegant), and visual analysis of drawings/notes.
5. **Manual Quote Builder UI**: Construction of custom chapters, line-by-line manual items, tax rate (IVA) calculations, and percentage discounts.
6. **Quote Workspace & AI Enhancements**: Item descriptions, AI suggestions, AI-powered Professional "Capitolato" upgrade, AI regeneration, duplication, and deletion of quotes.
7. **Price Catalog & Prezzario**: Creation, updating, deletion of catalog items, autocomplete suggestions during quote edits, and automated bulk import from existing quotes.
8. **Client Directory CRM**: Stable ID client grouping (normalized name/address hashes), quote tracking per client, search, and total-value aggregations.
9. **Smart Document Upload & Price Intelligence**: Uploading subcontractor invoices (PDF/DOCX/XLSX), tracking AI extraction status, viewing extracted costs, and accessing the price intelligence summary.
10. **Billing, Subscription & Stripe Checkout**: List plans, redirecting checkout sessions, customer portal access, subscription status, trial day tracking, and quote unlocking.
11. **WhatsApp Business Integration**: OTP-based linking of WhatsApp numbers, connection status tracking, toggling integration, usage metrics, and sending quotes.

---

## 3. Test Runner Technology Choice
We use **Playwright (TypeScript)** as our E2E test runner.
- **Unified Testing**: Native support for browser UI automation and direct REST API request assertion.
- **TypeScript Out-of-the-Box**: Playwright runs TypeScript tests directly without requiring extra build or transpile steps.
- **State Storage**: Saves cookies/auth state in a JSON file after login to bypass auth steps in subsequent tests.
- **Windows Local Execution**: Runs reliably on Windows local environments with dynamically downloaded lightweight browser binaries.

---

## 4. Test Directory Layout
We establish a dedicated workspace package under `artifacts/e2e-tests`:
```text
c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\
├── artifacts/
│   ├── e2e-tests/
│   │   ├── package.json
│   │   ├── playwright.config.ts
│   │   ├── src/
│   │   │   ├── helpers/
│   │   │   │   ├── db.ts               # Database cleaners and seeders
│   │   │   │   └── mocks.ts            # Mocks for Stripe, WhatsApp, and OpenAI
│   │   │   ├── specs/
│   │   │   │   ├── tier1_coverage.spec.ts
│   │   │   │   ├── tier2_boundaries.spec.ts
│   │   │   │   ├── tier3_pairwise.spec.ts
│   │   │   │   └── tier4_workloads.spec.ts
```

---

## 5. Coverage and Quality Thresholds
1. **Functional Coverage**: 100% of the 11 core features verified under Tier 1.
2. **Minimum Test Counts**:
   - **Tier 1 (Feature Coverage)**: 5 tests per feature = 55 test cases.
   - **Tier 2 (Boundary & Corner Cases)**: 5 tests per feature = 55 test cases.
   - **Tier 3 (Cross-Feature Combinations)**: 11 tests covering major feature interactions.
   - **Tier 4 (Real-World Application Scenarios)**: 5 deep multi-step user workloads.
   - **Total minimum**: 126 test cases.
3. **Localization Gate**: 100% of user-facing UI labels, placeholders, and error messages checked by tests must match Italian translations, scanning for English leaks (e.g. "Save", "Cancel", "Submit").
4. **Database State Isolation**: The database is cleared and seeded before each spec run to ensure test independence.

---

## 6. Tier-by-Tier E2E Test Suite Design

### Tier 1: Feature Coverage (5 tests per feature, 55 total)
- **Feature 1: Auth & Session**
  1. Register a new user and verify successful registration.
  2. Log in with existing valid credentials.
  3. Verify session persistence on page reload.
  4. Complete onboarding form (business profile name) for a fresh account.
  5. Log out and verify session removal.
- **Feature 2: Onboarding Flow**
  1. Redirect new user with empty profile name to `/onboarding`.
  2. Block access to dashboard subroutes for un-onboarded users.
  3. Allow onboarded user to directly access dashboard.
  4. Redirect onboarded user away from onboarding page to dashboard.
  5. Complete onboarding and verify profile table reflects details.
- **Feature 3: Profile & Brand**
  1. Update business details (Partita IVA, address, phone).
  2. Upload valid PNG logo.
  3. Upload valid SVG logo.
  4. Verify company details appear in quotes.
  5. Delete company logo and verify fallback.
- **Feature 4: AI Quotes**
  1. Generate quote from basic text prompt.
  2. Generate quote with text prompt + 3 images.
  3. Regenerate quote with custom instructions.
  4. Suggest professional item descriptions for line items using AI.
  5. Upgrade quote to Pro Capitolato.
- **Feature 5: Manual Quotes**
  1. Create a manual quote with custom customer name, address, and 3 line items.
  2. Edit items, general description, and notes on an existing quote.
  3. Apply a 10% discount and verify subtotal, IVA (22%), and final total calculation.
  4. Duplicate an existing quote (clearing client data, marking as draft).
  5. Delete a quote and verify its removal from lists.
- **Feature 6: Quote Workspace & AI**
  1. Generate draft standard PDF and verify the URL.
  2. Generate a Pro Capitolato PDF for a Pro user.
  3. Download the PDF and verify it is a valid PDF byte structure.
  4. Email the quote PDF to a client's email.
  5. Verify that `pdfDownloadedAt` timestamp updates upon successful download.
- **Feature 7: Catalog**
  1. Add catalog item manually.
  2. Edit catalog item price.
  3. Delete catalog item.
  4. Import unique items from existing quotes.
  5. Retrieve catalog autocomplete list in the quote editor.
- **Feature 8: CRM**
  1. List clients and check automatic aggregation.
  2. View quotes for a client using stable ID.
  3. Normalize client names ("Rossi Mario" vs "ROSSI MARIO") to verify single-client grouping.
  4. Verify CRM client total value updates after a new quote is unlocked.
  5. Search clients by name query.
- **Feature 9: Documents**
  1. Upload PDF invoice document to Document Intelligence.
  2. List uploaded documents.
  3. Trigger AI extraction on an uploaded document and wait for status `processed`.
  4. View extracted line items.
  5. Retrieve the aggregated price intelligence summary.
- **Feature 10: Billing**
  1. List plans.
  2. Redirect to Stripe checkout URL.
  3. Unlock quote.
  4. Trial day tracking.
  5. Redirect to Stripe customer portal.
- **Feature 11: WhatsApp**
  1. Request OTP for WhatsApp verification.
  2. Input OTP and link number.
  3. Toggle WhatsApp integration on and off.
  4. Retrieve monthly WhatsApp usage.
  5. Share quote link via WhatsApp connection.

### Tier 2: Boundary & Corner Cases (5 tests per feature, 55 total)
- **Feature 1: Auth & Session**
  1. Attempt login with an unregistered email (expects error in Italian: "Credenziali non valide").
  2. Attempt registration with an already registered email.
  3. Access private `/dashboard` paths directly when logged out (expects redirect to `/sign-in`).
  4. Manually navigate away from `/onboarding` while company name is empty (expects redirect back).
  5. Try to log in with an empty email or password.
- **Feature 2: Onboarding Flow**
  1. Submit onboarding form with spaces only (expects validation error).
  2. Attempt URL navigation to private dashboard subroutes (e.g. `/dashboard/catalog`) before onboarding (expects onboarding redirect).
  3. Interrupt onboarding mid-flow, sign in again, verify onboarding is still enforced.
  4. Input extreme character lengths (2000+ characters) in company name.
  5. Simulate database outage during onboarding query (expects elegant error page in Italian).
- **Feature 3: Profile & Brand**
  1. Save business profile with an invalid VAT number (Partita IVA) syntax.
  2. Upload a logo file larger than 5MB (expects Italian error: "File troppo grande").
  3. Verify companySnapshot immutability: changing logo/profile name does NOT alter logo/profile name stored on historically locked/unlocked quotes.
  4. Save business profile with an empty company name (expects validation error).
  5. Upload corrupted image file as logo.
- **Feature 4: AI Quotes**
  1. Submit quote generation with an empty prompt (expects validation error in Italian).
  2. Upload 4 images instead of the maximum limit of 3 (expects error).
  3. Upload a non-image file (e.g. `.zip`) to quotes endpoint.
  4. Verify system stability when OpenAI API responds with a rate limit error (429) or is offline.
  5. Send a huge string (e.g. 20,000 characters) as rawInput prompt.
- **Feature 5: Manual Quotes**
  1. Create a quote with a negative unit price or quantity (expects schema rejection).
  2. Verify currency rounding precision when unit price has 4 decimals (e.g. 10.1234) and quantities are fractional.
  3. Try to access or modify another user's quote ID (expects 401/404).
  4. Verify Italian validation message when customer name is omitted in the edit form.
  5. Save a manual quote with 0 items (expects validation error).
- **Feature 6: Quote Workspace & AI**
  1. Attempt to generate a clean PDF for a quote in `draft` status without payment/unlock (expects unauthorized/unlock prompt).
  2. Email a PDF using an invalid destination email format (expects bad request).
  3. Verify text-wrap layout safety for PDF generation when items contain extremely long description strings.
  4. Attempt to generate a Pro Capitolato PDF on a standard billing plan.
  5. Send email multiple times in 5 seconds to test email rate limiting.
- **Feature 7: Catalog**
  1. Import items from quotes when the user has no quotes (expects success empty array).
  2. Create a catalog item with negative unit price.
  3. Delete a catalog item referenced in a quote (quote items must remain intact).
  4. Create a catalog item with an extremely long description.
  5. Attempt catalog operations without a valid token.
- **Feature 8: CRM**
  1. Request quotes list for a non-existent client ID.
  2. Collision prevention: verify distinct grouping for "Mario Rossi S.r.l." and "Mario Rossi".
  3. Modify client name inside a draft quote and verify CRM list updates or splits client nodes.
  4. Retrieve client list containing over 500 records (pagination and query limit checks).
  5. Attempt to query CRM client list while unauthorized.
- **Feature 9: Documents**
  1. Upload a corrupt PDF file (expects extraction failure).
  2. Upload a file exceeding the maximum document limit (e.g. 25MB).
  3. Delete a document that is actively processing.
  4. Trigger AI extraction on an already extracted document.
  5. View summary when there are zero documents in the database.
- **Feature 10: Billing**
  1. Verify watermark is forced on generated PDFs after 14-day trial.
  2. Post webhook event with invalid header signature (expects rejection).
  3. Post mock webhook with unknown price ID.
  4. Post checkout metadata for invalid quote ID.
  5. Send mock subscription cancelled webhook, verify user downgraded to free.
- **Feature 11: WhatsApp**
  1. Attempt OTP request with invalid country code phone format.
  2. Input incorrect OTP code (expects error: "Codice non valido").
  3. Send OTP repeatedly to test rate limits.
  4. Attempt to share a quote via WhatsApp when integration is toggled "off".
  5. Handle connection failures to Meta APIs gracefully.

### Tier 3: Cross-Feature Combinations (11 tests covering major interactions)
1. **Quote AI-to-Catalog Sync (F4 + F7)**: Generate AI quote -> Run Catalog Import -> Confirm items added to Catalog -> Create manual quote and use autocomplete to select those catalog items.
2. **Onboarding Snapshots (F2 + F3 + F5)**: New User Signup -> Onboarding -> Fill Business Profile -> Create Quote -> Verify company details match onboarding data.
3. **Stripe Billing and Pro Upgrades (F6 + F10)**: Create AI quote -> Generate standard PDF (blocked: status draft) -> Trigger Stripe subscription webhook for Pro Plan -> Verify profile status updates -> Generate Pro Capitolato PDF successfully.
4. **WhatsApp Sharing and Quote Analytics (F11 + F5)**: Link WhatsApp account -> Create manual quote -> Generate PDF -> Toggle WhatsApp -> Send quote PDF via WhatsApp link -> Check CRM client page to confirm quote status.
5. **Document Extraction to Manual Quote Builder (F9 + F5)**: Upload invoice PDF -> Run AI Extraction -> Navigate to Manual Quote Builder -> Create quote using extracted cost items.
6. **Auth-CRM Isolation (F1 + F8)**: Register User A and User B -> User A creates quotes -> Verify User B cannot view User A's client lists or quotes.
7. **Logo Upload & Quote Snapshot (F3 + F6)**: Upload logo -> Create quote -> Verify quote logo URL is saved -> Update logo in profile -> Verify existing quote logo remains unchanged.
8. **Catalog Deletion Safety (F7 + F6)**: Add catalog item -> Insert catalog item into manual quote -> Delete catalog item from catalog -> Verify quote remains unchanged.
9. **Document Price Summary & AI Generation (F9 + F4)**: Upload 3 invoices -> Trigger extraction -> Generate AI quote -> Verify AI suggestions incorporate extracted price averages.
10. **Trial Countdown & Unlock (F10 + F6)**: Reach trial download limit -> Attempt PDF generation (blocked) -> Unlock quote via payment -> PDF generation permitted.
11. **WhatsApp Disconnection Cleanup (F11 + F8)**: Link WhatsApp -> Send WhatsApp link -> Disconnect WhatsApp -> Verify WhatsApp share option is disabled in CRM and Quotes pages.

### Tier 4: Real-World Application Scenarios (5 workloads)
1. **Workload 1: "Nuovo Professionista Onboarding e Primo Preventivo"**
   Register contractor -> redirect to onboarding -> fill profile -> upload logo -> navigate to Dashboard -> click "Nuovo Preventivo AI" -> input text prompt -> wait for AI quote generation -> verify company snapshot on draft.
2. **Workload 2: "Abbonamento Pro e Computo Capitolato"**
   Log in -> navigate to Billing -> select Pro Plan -> trigger Stripe payment (simulated webhook) -> confirm plan state -> open draft quote -> click "Migliora a Capitolato Pro" -> wait for AI text expansion -> click "Genera PDF Capitolato" -> verify URL.
3. **Workload 3: "Catalog Migration & Batch Document Extraction"**
   Contractor logs in -> navigates to Documents -> uploads 3 separate subcontractor PDF invoices -> waits for AI extraction on all 3 -> navigates to Catalog -> clicks "Importa da preventivi" -> verifies catalog size increases by correct number of unique items.
4. **Workload 4: "Campagna Preventivi WhatsApp e CRM"**
   Connect WhatsApp with OTP -> create 3 manual quotes for client "Mario Rossi", "Luigi Bianchi", "Mario Rossi" -> share quotes via WhatsApp -> view CRM Client page -> verify "Mario Rossi" is grouped into a single customer profile with 2 quotes, totaling the sum of both quotes.
5. **Workload 5: "Fine-tuning preventivi con Catalogo e Sconto"**
   Open Quote editor -> add 2 items from Price Catalog via autocomplete -> add custom item -> add general note -> apply 15% discount -> set tax to IVA 10% -> email quote PDF to client -> duplicate quote -> verify new quote has status draft and client details cleared.
