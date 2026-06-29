# PrevAI E2E Testing Infrastructure (TEST_INFRA.md)

This document outlines the testing philosophy, feature inventory, 4-tier test suite strategy, test runner technology choice, and execution formats for the PrevAI opaque-box E2E test suite.

---

## 1. Test Philosophy

PrevAI's E2E test suite follows an **opaque-box, requirement-driven approach**. The test suite treats the application as a black box:
- It interacts with the application through **public UI pages** and **exposed API endpoints**.
- It does **not** depend on internal frontend state (e.g., React Context, Query cache) or backend routing internals.
- All user-facing text, error messages, and actions must be verified in **Italian** to satisfy localization requirements.
- External dependencies (e.g., OpenAI/Gemini APIs, Stripe checkout webhooks, Meta WhatsApp API, and Resend email delivery) are isolated using deterministic sandboxes, mock endpoints, or webhook simulator payloads to ensure reproducibility and stability.

---

## 2. Core User-Facing Feature Inventory

We have mapped the user-facing capabilities of PrevAI into **9 distinct functional features**:

1. **Authentication & Onboarding (Auth)**: Registration, login, logout, session persistence (Better Auth), and mandatory onboarding redirection (requiring business details if profile name is empty).
2. **AI Quote Generation (AI Quotes)**: Creation of price quotes via Italian natural language prompt (`rawInput`), optional image inputs (up to 3 vision uploads), quote regeneration, AI-suggested line items, and upgrade to Professional "Capitolato" style.
3. **Manual Quote Editor (Manual Quotes)**: Creating quotes from scratch by inputting details, quantities, unit prices, adding/removing chapters, applying percentage discounts, adding payment conditions, duplicating quotes, and deletion.
4. **PDF Export & Delivery (PDF Export)**: Standard PDF generation (requires unlocked/paid state), Pro Capitolato PDF generation (requires Pro plan), direct-to-file download, and direct email delivery to the client.
5. **Business Profile Customization (Profile)**: Company configuration (name, VAT/Codice Fiscale, address, email, phone) and logo upload (PNG/JPG < 5MB).
6. **Price Catalog & Prezzario (Catalog)**: Creating, updating, and deleting catalog line items, auto-suggestions during quote edits, and automated bulk import of unique items from existing quotes.
7. **Document Intelligence & OCR (Documents)**: PDF/image document upload, trigger AI extraction of costs, and viewing aggregated cost intelligence summaries.
8. **WhatsApp Integration (WhatsApp)**: Linking a WhatsApp account via OTP verification, toggling the integration, monitoring usage, and sending quotes directly to client phone numbers.
9. **Client CRM & Directory (CRM)**: Automated grouping of clients using stable IDs (hashes of normalized client name/address), viewing quotes per client, search, and total-value aggregations.

---

## 3. 4-Tier Test Strategy

### Tier 1: Feature Coverage (>=5 tests per feature)
Verifies that the happy path for each core feature works exactly as expected.

- **Feature 1: Auth & Onboarding**
  1. Register a new user and verify successful registration.
  2. Log in with existing valid credentials.
  3. Verify session persistence on page reload.
  4. Complete onboarding form (business profile name) for a fresh account.
  5. Log out and verify session removal.
- **Feature 2: AI Quotes**
  1. Generate a quote from a basic text prompt (e.g., "Ristrutturazione bagno standard").
  2. Generate a quote using text prompt + 3 images (vision analysis).
  3. Regenerate an existing quote using custom instructions in-place.
  4. Suggest professional item descriptions for manual quote rows using AI.
  5. Upgrade an existing standard quote to Pro Capitolato style.
- **Feature 3: Manual Quotes**
  1. Create a manual quote with custom customer name, address, and 3 line items.
  2. Edit items, general description, and notes on an existing quote.
  3. Apply a 10% discount and verify subtotal, tax (IVA 22%), and final total calculation.
  4. Duplicate an existing quote (verifying client data is cleared and duplicated as a draft).
  5. Delete a quote and verify its disappearance from the dashboard list.
- **Feature 4: PDF Export**
  1. Generate draft standard PDF and verify the URL is returned.
  2. Generate a Pro Capitolato PDF for a Pro user.
  3. Download the PDF and verify it is a valid PDF byte structure.
  4. Email the quote PDF to a client's email.
  5. Verify that `pdfDownloadedAt` timestamp updates upon successful download.
- **Feature 5: Profile**
  1. View the business profile page showing default values.
  2. Update company details (VAT, address, contact numbers).
  3. Upload a company logo (PNG format, under 5MB).
  4. Verify that new quotes automatically snapshot current profile company settings.
  5. Delete company logo and verify fallback styling.
- **Feature 6: Catalog**
  1. Add a catalog item manually (description, U.M., unit price).
  2. Edit a catalog item's price.
  3. Delete a catalog item.
  4. Import unique items from existing quotes.
  5. Retrieve catalog autocomplete list in the quote editor.
- **Feature 7: Documents**
  1. Upload a PDF invoice document to Document Intelligence.
  2. List uploaded documents with status `uploaded`.
  3. Trigger AI extraction on an uploaded document and wait for status `processed`.
  4. View extracted line items for the document.
  5. Retrieve the aggregated price intelligence summary.
- **Feature 8: WhatsApp**
  1. Send connection OTP to a valid WhatsApp number.
  2. Input correct OTP code to link account and verify status is `connected`.
  3. Toggle WhatsApp integration on and off.
  4. Retrieve monthly WhatsApp usage.
  5. Send a quote share link to a client WhatsApp number.
- **Feature 9: CRM**
  1. List clients and check automatic aggregation from existing quotes.
  2. View quotes for a client using stable ID.
  3. Normalize client names ("Rossi Mario" vs "ROSSI MARIO") to verify single-client grouping.
  4. Verify CRM client total value updates after a new quote is unlocked.
  5. Search clients by name query.

---

### Tier 2: Boundary & Corner Cases (>=5 tests per feature)
Verifies resilience under invalid input, constraints, and error states.

- **Feature 1: Auth & Onboarding**
  1. Attempt login with an unregistered email (expects Italian error: "Credenziali non valide").
  2. Attempt registration with an already registered email.
  3. Access private `/dashboard` paths directly when logged out (expects redirect to `/sign-in`).
  4. Manually navigate away from `/onboarding` while company name is empty (expects redirect back to `/onboarding`).
  5. Try to log in with an empty email or password.
- **Feature 2: AI Quotes**
  1. Submit quote generation with an empty prompt (expects validation error in Italian).
  2. Upload 4 images instead of the maximum limit of 3 (expects error).
  3. Upload a non-image file (e.g., `.docx` or `.zip`) to quotes endpoint.
  4. Verify system stability when OpenAI API responds with a rate limit error (429) or is offline.
  5. Send a huge string (e.g., 20,000 characters) as rawInput prompt.
- **Feature 3: Manual Quotes**
  1. Create a quote with a negative unit price or quantity (expects schema rejection).
  2. Verify currency rounding precision when unit price has 4 decimals (e.g., 10.1234) and quantities are fractional.
  3. Try to access or modify another user's quote ID (expects 401/404).
  4. Verify Italian validation message when customer name is omitted in the edit form.
  5. Save a manual quote with 0 items (expects validation error).
- **Feature 4: PDF Export**
  1. Attempt to generate a clean PDF for a quote in `draft` status without payment/unlock (expects unauthorized/unlock prompt).
  2. Email a PDF using an invalid destination email format (expects bad request).
  3. Verify text-wrap layout safety for PDF generation when items contain extremely long description strings.
  4. Attempt to generate a Pro Capitolato PDF on a standard billing plan.
  5. Send email multiple times in 5 seconds to test email rate limiting.
- **Feature 5: Profile**
  1. Save a business profile with an invalid VAT number (Partita IVA) syntax.
  2. Upload a logo file larger than 5MB (expects Italian error: "File troppo grande").
  3. Verify companySnapshot immutability: changing logo/profile name does NOT alter logo/profile name stored on historically locked/unlocked quotes.
  4. Save business profile with an empty company name (expects validation error).
  5. Upload corrupted image file as logo.
- **Feature 6: Catalog**
  1. Import items from quotes when the user has no quotes (expects success empty array).
  2. Create a catalog item with negative unit price.
  3. Delete a catalog item referenced in a quote (quote items must remain intact).
  4. Create a catalog item with an extremely long description.
  5. Attempt catalog operations without a valid token.
- **Feature 7: Documents**
  1. Upload a corrupt PDF file (expects extraction failure).
  2. Upload a file exceeding the maximum document limit (e.g., 25MB).
  3. Delete a document that is actively processing.
  4. Trigger AI extraction on an already extracted document.
  5. View summary when there are zero documents in the database.
- **Feature 8: WhatsApp**
  1. Attempt OTP request with invalid country code phone format.
  2. Input incorrect OTP code (expects error: "Codice non valido").
  3. Send OTP repeatedly to test rate limits.
  4. Attempt to share a quote via WhatsApp when integration is toggled "off".
  5. Handle connection failures to Meta APIs gracefully.
- **Feature 9: CRM**
  1. Request quotes list for a non-existent client ID.
  2. Collision prevention: verify distinct grouping for "Mario Rossi S.r.l." and "Mario Rossi".
  3. Modify client name inside a draft quote and verify CRM list updates or splits client nodes.
  4. Retrieve client list containing over 500 records (pagination and query limit checks).
  5. Attempt to query CRM client list while unauthorized.

---

### Tier 3: Cross-Feature Combinations (Pairwise)
Tests how different parts of the application interact to complete complex state loops.

1. **Quote AI-to-Catalog Sync**:
   Create a quote via AI prompt -> Run Catalog Import -> Confirm that AI-generated items are successfully added to Catalog -> Create a manual quote and use autocomplete to select those imported catalog items.
2. **Onboarding Snapshots**:
   New User Signup -> Redirection to Onboarding -> Fill Business Profile and upload logo -> Create a Quote -> Verify company Snapshot inside the quote matches onboarding data -> Update logo in Profile -> Verify existing quote logo remains unchanged while a new quote gets the updated logo.
3. **Stripe Billing and Pro Upgrades**:
   Create AI quote -> Generate standard PDF (blocked: status draft) -> Trigger Stripe subscription webhook for Pro Plan -> Verify business profile status updates to `active` with plan `monthly_pro` -> Generate Pro Capitolato PDF successfully.
4. **WhatsApp Sharing and Quote Analytics**:
   Link WhatsApp account -> Create a manual quote -> Generate PDF -> Toggle WhatsApp integration -> Send quote PDF via WhatsApp link -> Check CRM client page to confirm quote status is updated.
5. **Document Extraction to Manual Quote Builder**:
   Upload invoice PDF to Documents -> Run AI Extraction -> Copy extracted cost items -> Navigate to Manual Quote Builder -> Create a quote and import/use those items.

---

### Tier 4: Real-World Application Scenarios (Workloads)
E2E user journeys simulating distinct real-world contractor use cases.

1. **Workload 1: "Nuovo Professionista Onboarding e Primo Preventivo"**
   - **User Flow**: Register a new contractor -> verify redirect to onboarding -> fill company name ("Impresa Edile Rossi") and details -> upload logo -> navigate to Dashboard -> click "Nuovo Preventivo AI" -> type "ristrutturazione bagno con sanitari sospesi" -> wait for AI quote generation -> verify company snapshot on draft -> preview items.
2. **Workload 2: "Abbonamento Pro e Computo Capitolato"**
   - **User Flow**: Log in as existing user on Standard plan -> navigate to Billing -> select Pro Plan -> trigger Stripe payment (simulated webhook) -> confirm plan state -> open draft quote -> click "Migliora a Capitolato Pro" -> wait for AI text expansion -> click "Genera PDF Capitolato" -> verify URL.
3. **Workload 3: "Catalog Migration & Batch Document Extraction"**
   - **User Flow**: Contractor logs in -> navigates to Documents -> uploads 3 separate subcontractor PDF invoices -> waits for AI extraction on all 3 -> navigates to Catalog -> clicks "Importa da preventivi" -> verifies catalog size increases by correct number of unique items.
4. **Workload 4: "Campagna Preventivi WhatsApp e CRM"**
   - **User Flow**: Connect WhatsApp with OTP -> create 3 manual quotes for client "Mario Rossi", "Luigi Bianchi", "Mario Rossi" (matching email) -> share quotes via WhatsApp -> view CRM Client page -> verify "Mario Rossi" is grouped into a single customer profile with 2 quotes, totaling the sum of both quotes.
5. **Workload 5: "Fine-tuning preventivi con Catalogo e Sconto"**
   - **User Flow**: Open Quote editor -> add 2 items from Price Catalog via autocomplete -> add custom item -> add general note -> apply 15% discount -> set tax to IVA 10% -> email quote PDF to client -> duplicate quote -> verify new quote has status draft and client details cleared.

---

## 4. Test Runner Technology Recommendation

We recommend **Playwright** as the E2E test runner.

### Why Playwright?
1. **Unified API and UI Runner**: Playwright has native support for both browser-based UI automation (`page.click`, `page.fill`) and direct server-side API requests (`request.post`, `request.get`). This allows us to write API checks and UI checks within the same framework.
2. **Zero-Configuration TypeScript**: Playwright supports TypeScript natively out of the box using `ts-node`/`tsx` internally. No external build steps or custom configurations are needed.
3. **Fast Execution & Parallelism**: Playwright runs tests in isolated browser contexts. This runs significantly faster than Cypress since contexts are lightweight and spun up in parallel across multiple CPU cores.
4. **Windows Compatibility**: Playwright runs reliably on Windows platforms without needing WSL, Docker, or external browser binaries (it installs local, isolated copies of Chromium, Firefox, and WebKit inside `%USERPROFILE%\AppData\Local\ms-playwright`).
5. **Robust Debugging Tools**:
   - **Trace Viewer**: Record screenshots, action histories, network waterfalls, and console logs per test step.
   - **Auto-Wait**: Eliminates brittle `page.waitForTimeout` sleeps. It checks if elements are actionable before interacting.

---

## 5. Test Format and Organization

### Directory Layout
We recommend co-locating the E2E test suite under a dedicated `e2e` workspace package:
```
c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\
├── artifacts/
│   ├── preventivo-ai/
│   └── api-server/
├── lib/
├── tests-e2e/               # Dedicated E2E workspace package
│   ├── package.json
│   ├── playwright.config.ts
│   ├── src/
│   │   ├── helpers/
│   │   │   ├── auth.ts      # Auth state seeders / helpers
│   │   │   ├── db.ts        # Fast DB cleaning and seeding
│   │   │   └── mock-apis.ts # OpenAI / Stripe webhook simulators
│   │   ├── tier1-coverage/
│   │   │   └── auth.spec.ts
│   │   ├── tier2-boundaries/
│   │   ├── tier3-combinations/
│   │   └── tier4-workloads/
```

### Sample Playwright Test Format
```typescript
import { test, expect } from '@playwright/test';
import { clearDatabase, seedUser } from '../helpers/db';

test.describe('Manual Quote Builder (Tier 1)', () => {
  let userToken: string;

  test.beforeEach(async ({ request }) => {
    await clearDatabase();
    const user = await seedUser({ email: 'test@prevai.it', companyName: 'Impresa Rossi' });
    userToken = user.token;
  });

  test('should calculate correct totals with 10% discount and 22% IVA', async ({ page }) => {
    // 1. Bypass Sign-In via cookie injection or UI flow
    await page.goto('/sign-in');
    await page.fill('input[type="email"]', 'test@prevai.it');
    await page.fill('input[type="password"]', 'PasswordSafe123!');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');

    // 2. Navigate to Manual Quote Builder
    await page.goto('/dashboard/new');
    await page.click('text=Preventivo Manuale');

    // 3. Fill client info
    await page.fill('[data-testid="client-name"]', 'Mario Rossi');
    await page.fill('[data-testid="client-address"]', 'Via Roma 10, Milano');

    // 4. Add items
    await page.click('[data-testid="add-item-btn"]');
    await page.fill('[data-testid="item-desc-0"]', 'Posa Pavimento');
    await page.fill('[data-testid="item-qty-0"]', '10');
    await page.fill('[data-testid="item-price-0"]', '50.00'); // Total 500

    // 5. Add discount
    await page.fill('[data-testid="discount-percent"]', '10'); // 10% of 500 = 50. Subtotal = 450

    // 6. Verify calculations (IVA 22% of 450 = 99. Total = 549)
    await expect(page.locator('[data-testid="subtotal-val"]')).toHaveText('450,00 €');
    await expect(page.locator('[data-testid="iva-val"]')).toHaveText('99,00 €');
    await expect(page.locator('[data-testid="total-val"]')).toHaveText('549,00 €');

    // 7. Save Quote
    await page.click('[data-testid="save-quote-btn"]');
    await expect(page).toHaveURL(/\/dashboard\/quotes\/.+/);
  });
});
```

---

## 6. Coverage & Quality Thresholds

To pass audit readiness, the test suite must adhere to these target gates:
1. **Opaque-box Verification**: All assertions check page responses, visual indicators, or database states. Mocks must not modify front-end component state directly.
2. **Localization Gate**: 100% of user-facing UI labels, placeholders, tooltips, alert messages, and validation messages in the tests must be verified to be in **Italian**.
3. **Database State Isolation**: Every test run must reset database states using truncate hooks in `beforeEach` to ensure tests are deterministic.
4. **No Thread Collisions**: Test runners must be configured with a clean, unique DB user schema or use serial runtime options when updating shared Stripe checkout mock counters.
