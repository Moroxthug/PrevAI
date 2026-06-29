# TEST_INFRA.md — E2E Testing Framework Specification

## 1. Test Philosophy
The PrevAI End-to-End (E2E) testing suite is designed around the **opaque-box, requirement-driven testing** paradigm. 
- **Opaque-Box**: Tests interact with the application strictly from the perspective of an end-user or external client. The internal implementation details (e.g., database queries, Drizzle schemas, Better Auth configurations) are treated as hidden, and all assertions are based on user-visible behavior (UI elements, redirects, visual elements) and public API contracts.
- **Requirement-Driven**: Test cases are directly mapped to the functional specifications of the platform.
- **Italian Localization Compliance**: A key requirement of PrevAI is that all user-facing content (errors, labels, placeholders, PDF outputs) remains strictly in Italian. The test suite will proactively validate localization by asserting that text matches Italian translations and no English placeholders are present.

---

## 2. Feature Inventory
We identify **11 core user-facing features** of PrevAI to structure the test suite:

1. **Authentication & Session Management**: Sign up, sign in, sign out, password reset.
2. **User Onboarding Flow**: First-time profile creation, wouter-based routing guard rails.
3. **Business Profile & Brand Identity**: Profile details (VAT, address), company logo upload.
4. **AI-Assisted Quote Generator**: Free-text prompt interpretation, target budget scaling, template layouts (Standard/Professional/Elegant), visual analysis of drawings/notes.
5. **Manual Quote Builder UI**: Chapters construction, voice-per-voce manual items, tax rate calculations, discounts.
6. **Quote Workspace & AI Enhancements**: Edit items, AI suggestions for line item descriptions, AI-powered professional upgrade to Capitolato, AI regeneration, duplicate quote.
7. **Pricing Catalog Management**: Create/Edit/Delete catalog items, bulk importing items from existing quotes.
8. **Client Directory CRM**: Name-based client aggregation, client historical quotes lookup.
9. **Smart Document Upload & Price Intelligence**: File upload (PDF/DOCX/XLSX), AI extraction status tracking, aggregated price dashboard, document deletion.
10. **Billing, Subscription & Stripe Checkout**: active plans listing, Stripe redirect checkout session, Stripe billing customer portal access, subscription status, quote unlocking, trial tracking.
11. **WhatsApp Business Integration**: OTP-based connection, verify OTP, toggle status, disconnect, usage tracking.

---

## 3. Test Runner Technology Choice
We recommend **Playwright (TypeScript)** as the E2E test runner.
### Rationale:
1. **Single Unified Runner**: Playwright natively supports both browser UI automation and REST API request testing. This is crucial for opaque-box testing where some tests verify UI workflows while others verify HTTP API contracts directly.
2. **TypeScript Support Out-of-the-Box**: Playwright compiles TypeScript files directly without the need for complex ts-node/tsx configuration.
3. **Windows Compatibility**: It runs smoothly on Windows local environments without external dependencies, downloading lightweight browser binaries dynamically.
4. **State Sharing (Authentication)**: Playwright allows logging in once and saving the authenticated state (cookies/session storage) as a JSON file, which can be loaded in parallel tests to drastically reduce run times.
5. **Excellent Tooling**: Includes Playwright Codegen (for recording tests), Trace Viewer (for debugging failures visually), and built-in assertions with auto-retries.

---

## 4. Test Format
Tests will be written in TypeScript matching Playwright's default spec format.
### Directory Structure:
```text
c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\
├── e2e-tests/
│   ├── config/
│   │   └── playwright.config.ts        # Playwright configurations
│   ├── helpers/
│   │   ├── auth.helper.ts             # Auth utilities
│   │   ├── api.client.ts              # Custom REST client for API testing
│   │   └── mock-stripe.helper.ts      # Helper for sending Stripe webhook events
│   ├── specs/
│   │   ├── T1_feature_coverage.spec.ts # Tier 1 Tests (Feature Coverage)
│   │   ├── T2_boundaries.spec.ts       # Tier 2 Tests (Boundary & Corner Cases)
│   │   ├── T3_pairwise.spec.ts         # Tier 3 Tests (Cross-Feature Pairwise)
│   │   └── T4_workloads.spec.ts        # Tier 4 Tests (Real-World Workloads)
│   └── state/
│       └── auth-state.json            # Persisted login session state
```

---

## 5. Coverage Thresholds
We establish three main dimensions of coverage:
1. **Functional Coverage**: 100% of the 11 core features verified under Tier 1.
2. **API Schema Validation**: All API responses in test suites verified against the OpenAPI specification using custom Zod validators generated from `lib/api-zod`.
3. **Localization Check**: Every test that asserts page text must verify that the language is Italian and scan for common English substrings (e.g. "Save", "Cancel", "Submit", "Delete") to prevent regressions.

---

## 6. Tier-by-Tier E2E Test Suite Design

### Tier 1: Feature Coverage (5 tests per feature, 55 total)
#### Feature 1: Authentication & Session Management
- **T1.1.1 (Register User)**: Fill sign-up form, submit, verify welcome email database hook triggers.
- **T1.1.2 (Sign In)**: Enter valid credentials, submit, assert redirection to `/dashboard` or `/onboarding`.
- **T1.1.3 (Session Persistence)**: Reload page, assert dashboard state remains logged in.
- **T1.1.4 (Sign Out)**: Click log-out button, verify redirection to `/sign-in` and session clearing.
- **T1.1.5 (Reset Password Request)**: Submit registered email for password reset, verify success message in Italian.

#### Feature 2: Business Profile & Brand Identity
- **T1.2.1 (Retrieve Profile)**: Get profile fields, verify fields match DB contents.
- **T1.2.2 (Update Profile Details)**: Modify company name, VAT, address, phone, email, submit; verify persistence.
- **T1.2.3 (Upload PNG Logo)**: Upload valid PNG logo, verify public URL is returned.
- **T1.2.4 (Upload SVG Logo)**: Upload valid SVG logo, verify it is correctly displayed.
- **T1.2.5 (Display Profile UI)**: Verify company name and logo appear in the dashboard sidebar/header.

#### Feature 3: Onboarding Flow & Guard Rails
- **T1.3.1 (Redirect New User)**: Register a new user, navigate to `/dashboard`, assert auto-redirect to `/onboarding`.
- **T1.3.2 (Complete Onboarding)**: Fill company name, submit, verify redirect to `/dashboard`.
- **T1.3.3 (Skip Onboarding)**: Attempt onboarding skip if option is present, verify redirection.
- **T1.3.4 (Direct Bypass)**: Onboarded user signs in, verify they access `/dashboard` without seeing onboarding.
- **T1.3.5 (Onboarded Block)**: Try to navigate to `/onboarding` as an onboarded user, verify redirect to `/dashboard`.

#### Feature 4: AI-Assisted Quote Generator
- **T1.4.1 (AI Generation Text)**: Submit simple project text, verify structured quote generation.
- **T1.4.2 (AI Template Selection)**: Choose "Arosio" professional layout, verify template metadata is set.
- **T1.4.3 (AI Target Budget)**: Specify target price of €4000, verify output total is close.
- **T1.4.4 (AI Photo Attachment)**: Attach photo of site, verify AI analyzes image details.
- **T1.4.5 (AI Unparseable Gibraltar Rejection)**: Submit gibberish, verify Italian error response.

#### Feature 5: Manual Quote Builder UI
- **T1.5.1 (Add Chapter)**: Add manual chapter, verify it renders in the document tree.
- **T1.5.2 (Insert Row Item)**: Insert description, quantity, unit price, verify row calculations.
- **T1.5.3 (Modify VAT Rate)**: Change tax rate (e.g. 10%), verify VAT value updates.
- **T1.5.4 (Add Discount)**: Apply percentage discount, verify totals update.
- **T1.5.5 (Save Manual Quote)**: Click save, verify quote appears in the dashboard listing.

#### Feature 6: Quote Workspace & AI Enhancements
- **T1.6.1 (AI Line Suggestion)**: Trigger suggestion for "posa piastrelle", verify professional description.
- **T1.6.2 (Upgrade to Capitolato)**: Click upgrade to capitolato, verify expanded technical language.
- **T1.6.3 (Duplicate Quote)**: Click duplicate, verify new draft created with clean metadata.
- **T1.6.4 (Regenerate Quote)**: Click regenerate with new prompt, verify content updates.
- **T1.6.5 (Delete Quote)**: Click delete, verify quote is removed from lists.

#### Feature 7: Pricing Catalog Management
- **T1.7.1 (List Catalog)**: Visit catalog page, verify list of catalog items matches GET `/api/catalog`.
- **T1.7.2 (Add Catalog Item)**: Save new item, verify it is listed.
- **T1.7.3 (Update Catalog Item)**: Edit unit price, verify update is saved.
- **T1.7.4 (Delete Catalog Item)**: Delete catalog item, verify it disappears from view.
- **T1.7.5 (Import from Quotes)**: Run import from quotes, verify past quote items are synced.

#### Feature 8: Client Directory CRM
- **T1.8.1 (List Clients)**: Visit CRM page, verify unique clients list.
- **T1.8.2 (Get Client Details)**: Click client name, verify profile information.
- **T1.8.3 (Client Quote History)**: Verify quotes list for specific client stable ID.
- **T1.8.4 (CRM Sidebar Stats)**: Verify client aggregations (total spent, quote count).
- **T1.8.5 (Dropdown Selection)**: Select saved client in new quote page, verify form auto-fills.

#### Feature 9: Smart Document Upload & Price Intelligence
- **T1.9.1 (Document Upload)**: Upload invoice PDF, verify upload status is "pending".
- **T1.9.2 (List Documents)**: Check uploaded documents dashboard, verify entry exists.
- **T1.9.3 (Extract Prices)**: Trigger AI extraction, verify status changes to "done".
- **T1.9.4 (Price Summary View)**: Open summary tab, verify average price calculations.
- **T1.9.5 (Delete Document)**: Click delete, verify document and price records are removed.

#### Feature 10: Billing, Subscription & Stripe Checkout
- **T1.10.1 (List Plans)**: Visit subscription tab, verify pricing plans cards.
- **T1.10.2 (Stripe Checkout Session)**: Click upgrade, verify redirect to Stripe checkout URL.
- **T1.10.3 (Unlock Quote)**: Unlock single quote, verify payment status changes.
- **T1.10.4 (Trial Countdown)**: Verify dashboard shows trial days and quote counts.
- **T1.10.5 (Stripe Customer Portal)**: Click manage subscription, verify portal redirect.

#### Feature 11: WhatsApp Business Integration
- **T1.11.1 (Status Check)**: Visit settings, verify status is "disconnesso".
- **T1.11.2 (Connect Number)**: Submit phone number, verify OTP prompt is shown.
- **T1.11.3 (Verify OTP)**: Enter valid OTP, verify connection success.
- **T1.11.4 (Toggle Status)**: Switch integration off/on, verify status in DB.
- **T1.11.5 (Disconnect)**: Click disconnect, verify status is reset.

---

### Tier 2: Boundary & Corner Cases (5 tests per feature, 55 total)
#### Feature 1: Authentication & Session Management
- **T2.1.1 (Duplicate Email Register)**: Attempt registration with existing email, verify 400 error in Italian.
- **T2.1.2 (Weak Password)**: Register with 4-character password, verify client/server validation errors.
- **T2.1.3 (Invalid Credentials Sign In)**: Log in with wrong password, verify 401 Unauthorized in Italian.
- **T2.1.4 (Unregistered Email Reset)**: Verify password reset for unregistered email returns standard Italian message (prevents scanning).
- **T2.1.5 (Expired Session Token)**: Attempt API access with expired session token, verify 401 and redirection.

#### Feature 2: Business Profile & Brand Identity
- **T2.2.1 (Logo Size Limit)**: Upload 3MB file, verify server rejects (2MB limit).
- **T2.2.2 (Logo Invalid Format)**: Upload a .exe file, verify 400 error.
- **T2.2.3 (Invalid VAT Format)**: Save Vat as "1234", verify validation error.
- **T2.2.4 (Invalid Business Email)**: Save email without domain, verify format validation.
- **T2.2.5 (Rapid Logo Re-uploads)**: Rapidly trigger logo uploads, verify no file leakage.

#### Feature 3: Onboarding Flow & Guard Rails
- **T2.3.1 (Empty Company Name)**: Submit onboarding form with spaces only, verify rejection.
- **T2.3.2 (Direct Dashboard URL Access)**: Attempt URL navigation to private dashboard subroutes (e.g. `/dashboard/catalog`), verify onboarding redirect.
- **T2.3.3 (Interrupt Mid-Onboarding)**: Navigate away mid-onboarding, sign in again, verify onboarding is still enforced.
- **T2.3.4 (Extreme Character Inputs)**: Input 2000-character company name, verify database/ui handling.
- **T2.3.5 (Database Outage Handling)**: Simulate profile query failure, verify UI displays error block in Italian.

#### Feature 4: AI-Assisted Quote Generator
- **T2.4.1 (Quota Monthly Lock)**: Try generating quote after exceeding quota, verify 429 and Italian upgrade prompt.
- **T2.4.2 (Max Image Limit)**: Upload 4 images (limit is 3), verify warning.
- **T2.4.3 (AI Image Refusal)**: Upload black image, verify AI returns 422 image refusal error.
- **T2.4.4 (Extreme Target Budgets)**: Request target total of €0.01 or €100M, verify response validation.
- **T2.4.5 (Italian Language Enforcement)**: Send request with English instructions, verify generated quote remains strictly in Italian.

#### Feature 5: Manual Quote Builder UI
- **T2.5.1 (Negative Price Rejection)**: Attempt to input negative price, verify rejection.
- **T2.5.2 (Tax Rates Extremes)**: Attempt to set 200% VAT, verify rejection.
- **T2.5.3 (Decimal Rounding Corner)**: Input price of €1.0003 and qty 3, verify mathematical rounding to two decimals.
- **T2.5.4 (Save Empty Chapters)**: Try saving manual quote with empty chapters, verify validation error.
- **T2.5.5 (Server Calculations Override)**: Send modified total via API call, verify server overrides with correct math.

#### Feature 6: Quote Workspace & AI Enhancements
- **T2.6.1 (Upgrade Non-Pro user)**: Try upgrading to capitolato as Starter user, verify 403 error.
- **T2.6.2 (Locked Status Post-Download)**: Try updating quote after `pdfDownloadedAt` is set, verify 400 LOCKED.
- **T2.6.3 (Mismatched Capitolato Array)**: Send fake chapters array during capitolato upgrade, verify validation mismatch.
- **T2.6.4 (Regenerate Locked Quote)**: Try to regenerate a quote after download, verify 409 error.
- **T2.6.5 (AI Suggestion Blank Input)**: POST suggestion with empty strings, verify 400 error.

#### Feature 7: Pricing Catalog Management
- **T2.7.1 (Duplicate Catalog Entry)**: Try creating duplicate item in same category, verify handling.
- **T2.7.2 (Negative Price Catalog)**: Save catalog item with negative value, verify rejection.
- **T2.7.3 (Catalog Injection Consistency)**: Input item in catalog, verify exact match is injected during AI quote creation.
- **T2.7.4 (Sync Empty Quotes)**: Run import with zero quotes in DB, verify safe exit.
- **T2.7.5 (SQL Injection Inputs)**: Put SQL command characters in category names, verify sanitization.

#### Feature 8: Client Directory CRM
- **T2.8.1 (Client Name Specials)**: Save quote for "Mario Rossi (Milano) #1", verify CRM stable ID generated.
- **T2.8.2 (Case Insensitivity)**: Add quotes for "MARIO ROSSI" and "mario rossi", verify they sync to same CRM card.
- **T2.8.3 (Whitespace Trimming)**: Verify client names with extra spaces are normalized.
- **T2.8.4 (Empty Client Quotes)**: Verify quote with no client does not create empty entry in CRM.
- **T2.8.5 (Non-Existent Client MD5)**: Search for non-existent client ID, verify 404 or empty list.

#### Feature 9: Smart Document Upload & Price Intelligence
- **T2.9.1 (Invalid Document Format)**: Upload MP3 file, verify 400 error.
- **T2.9.2 (Price Intel Threshold)**: Verify price intel context not injected in AI prompt if processed docs < 3.
- **T2.9.3 (Garbage Document Content)**: Upload corrupt PDF, verify status changes to "failed" without server crash.
- **T2.9.4 (Double Extraction POST)**: Rapidly call extraction twice for same ID, verify lock/throttling.
- **T2.9.5 (Unauthorized Document Access)**: User B attempts to access User A's document, verify 403.

#### Feature 10: Billing, Subscription & Stripe Checkout
- **T2.10.1 (Watermark on Trial Expiry)**: Verify watermark is forced on generated PDFs after 14-day trial.
- **T2.10.2 (Mock Webhook Invalid Signature)**: Post webhook event with invalid header signature, verify rejection.
- **T2.10.3 (Stripe Plan Mapping)**: Post mock webhook with unknown price ID, verify fallback handling.
- **T2.10.4 (Unlock Non-Existent Quote)**: Post checkout metadata for invalid quote ID, verify safety handler.
- **T2.10.5 (Stripe Refund webhook sync)**: Send mock subscription cancelled webhook, verify user downgraded to free.

#### Feature 11: WhatsApp Business Integration
- **T2.11.1 (Invalid Number Connection)**: Try connecting number with alphabetical chars, verify rejection.
- **T2.11.2 (Invalid OTP Code)**: Verify with wrong OTP, verify connection remains blocked.
- **T2.11.3 (Expired OTP Verification)**: Wait past OTP expiry, verify rejection.
- **T2.11.4 (Webhook HMAC signature reject)**: Send webhook message without valid x-hub-signature-256, verify 403.
- **T2.11.5 (Usage cap enforcement)**: Attempt sending message once monthly limits reached, verify limit enforcement.

---

### Tier 3: Cross-Feature Combinations (Pairwise, 55 pairs)
With 11 features, there are exactly $\frac{11 \times 10}{2} = 55$ pairwise combinations. Below is the list of pairwise interaction scenarios that cover all 55 combinations:

1. **F1 + F2 (Auth + Profile)**: Register a user and immediately verify that GET to `/api/business-profile` returns empty profile defaults for the new user.
2. **F1 + F3 (Auth + Onboarding)**: Register a user and verify wouter guard forces redirection to onboarding during active session creation.
3. **F1 + F4 (Auth + AI Quote)**: Attempt to generate an AI quote without logging in; verify request is rejected with 401.
4. **F1 + F5 (Auth + Manual Quote)**: Attempt to save a manual quote without a session cookie; verify 401 rejection.
5. **F1 + F6 (Auth + Quote Editor)**: Attempt to suggest a line description or upgrade to Capitolato anonymously; verify 401 rejection.
6. **F1 + F7 (Auth + Catalog)**: Request catalog lists without authentication; verify 401 redirect.
7. **F1 + F8 (Auth + CRM)**: Request client database anonymously; verify 401 error.
8. **F1 + F9 (Auth + Docs)**: Upload document without credentials; verify 400/401 validation.
9. **F1 + F10 (Auth + Billing)**: Fetch subscription plans without user session; verify 401.
10. **F1 + F11 (Auth + WhatsApp)**: Try to check WhatsApp status without auth; verify 401.
11. **F2 + F3 (Profile + Onboarding)**: Complete onboarding; verify business profile DB table is populated with the onboarded company name.
12. **F2 + F4 (Profile + AI Quote)**: Generate an AI quote; verify that the company details snapshot on the quote matches the current business profile.
13. **F2 + F5 (Profile + Manual Quote)**: Create a manual quote; verify that company info is snapshot-saved to prevent editing sync issues later.
14. **F2 + F6 (Profile + Quote Editor)**: Change company logo in profile; verify that existing quotes with historical downloads (locked status) preserve their old logo.
15. **F2 + F7 (Profile + Catalog)**: Update business profile; verify that the price catalog remains unaffected.
16. **F2 + F8 (Profile + CRM)**: Update profile email/VAT; verify client aggregation lists remain distinct.
17. **F2 + F9 (Profile + Docs)**: Upload document; verify object storage uses separate user subfolders matching business profile IDs.
18. **F2 + F10 (Profile + Billing)**: Check trial status on business profile table; verify trial start date is initiated upon profile creation.
19. **F2 + F11 (Profile + WhatsApp)**: Connect WhatsApp; verify business profile settings reflect WhatsApp link state.
20. **F3 + F4 (Onboarding + AI Quote)**: Try to POST to `/api/quotes` before onboarding; verify wouter routing blocks user until onboarding complete.
21. **F3 + F5 (Onboarding + Manual Quote)**: Try creating a manual quote while unonboarded; verify block.
22. **F3 + F6 (Onboarding + Quote Editor)**: Request AI suggestions before onboarding; verify routing guard redirect.
23. **F3 + F7 (Onboarding + Catalog)**: Access catalog routes while unonboarded; verify wouter redirect to onboarding.
24. **F3 + F8 (Onboarding + CRM)**: Try to access client aggregate CRM before completing onboarding; verify redirect.
25. **F3 + F9 (Onboarding + Docs)**: Try to upload extraction documents before onboarding; verify redirect.
26. **F3 + F10 (Onboarding + Billing)**: Verify that unonboarded users are directed to onboarding first rather than billing plans.
27. **F3 + F11 (Onboarding + WhatsApp)**: Try setting up WhatsApp while onboarding is incomplete; verify guard blocks.
28. **F4 + F5 (AI Quote + Manual Quote)**: Switch tabs in the quote creator; verify that client data form contents are retained across tabs.
29. **F4 + F6 (AI Quote + Quote Editor)**: Generate quote via AI; immediately duplicate it, verify child quote references same layout template.
30. **F4 + F7 (AI Quote + Catalog)**: Save "Voce Specifica" in catalog; run AI generator, verify that the catalog item price takes precedence.
31. **F4 + F8 (AI Quote + CRM)**: Generate AI quote with client form; verify client name aggregates into CRM lists.
32. **F4 + F9 (AI Quote + Docs)**: Upload PDF via documents page, process it; generate AI quote, verify document text is injected into prompt.
33. **F4 + F10 (AI Quote + Billing)**: Verify that generating an AI quote decrement's the free trial download quota.
34. **F4 + F11 (AI Quote + WhatsApp)**: Generate an AI quote; verify it triggers a WhatsApp notification if WhatsApp status is active.
35. **F5 + F6 (Manual Quote + Quote Editor)**: Create manual quote; click AI suggestions for line item descriptions, verify details fill.
36. **F5 + F7 (Manual Quote + Catalog)**: Add line item in manual editor; verify dropdown offers autocomplete suggestions from the catalog.
37. **F5 + F8 (Manual Quote + CRM)**: Enter client details in manual builder; verify client card is added to CRM directory.
38. **F5 + F9 (Manual Quote + Docs)**: Extracted document data; use it to populate rows in the manual quote builder.
39. **F5 + F10 (Manual Quote + Billing)**: Create manual quote; download PDF on trial user, verify trial counter increases.
40. **F5 + F11 (Manual Quote + WhatsApp)**: Connect WhatsApp; send manual quote link to client via WhatsApp.
41. **F6 + F7 (Quote Editor + Catalog)**: Update catalog item; verify that pre-existing quotes remain unchanged to maintain historical records.
42. **F6 + F8 (Quote Editor + CRM)**: Modify client details in editor; verify CRM contact updates accordingly.
43. **F6 + F9 (Quote Editor + Docs)**: Regenerate quote using text extracted from documents; verify new items are integrated.
44. **F6 + F10 (Quote Editor + Billing)**: Attempt to upgrade a quote to Capitolato (requires Pro); check if billing checks correctly block/allow.
45. **F6 + F11 (Quote Editor + WhatsApp)**: Upgrade quote to Capitolato; verify message sent via WhatsApp to client with updated format.
46. **F7 + F8 (Catalog + CRM)**: Import items from a quote; verify items are linked to the catalog without disrupting CRM client list.
47. **F7 + F9 (Catalog + Docs)**: Upload invoice document; verify extracted items can be directly added to the catalog database.
48. **F7 + F10 (Catalog + Billing)**: Verify that catalog size limits or items importing is bounded based on active subscription plan tier.
49. **F7 + F11 (Catalog + WhatsApp)**: Trigger price quote search from WhatsApp integration using catalog keywords.
50. **F8 + F9 (CRM + Docs)**: Extract invoice; verify client name in invoice automatically links quote to CRM contact.
51. **F8 + F10 (CRM + Billing)**: Open client record; verify stats show billing values (e.g. total quote values unlocked).
52. **F8 + F11 (CRM + WhatsApp)**: Open client page; click WhatsApp icon to initiate direct chat connection.
53. **F9 + F10 (Docs + Billing)**: Try triggering AI document extraction; verify active plan determines extraction features or file count.
54. **F9 + F11 (Docs + WhatsApp)**: Upload extraction document; notify user on WhatsApp once document extraction changes status to "done".
55. **F10 + F11 (Billing + WhatsApp)**: Verify that Pro/Elite tiers allow unlimited WhatsApp integration alerts whereas free tier is limited.

---

### Tier 4: Real-World Application Scenarios (5 workloads)

#### Workload 1: New Contractor Onboarding, Brand Setup, and First Quote Delivery
- **Persona**: Newly registered electrician contractor.
- **Workflow**:
  1. Register a new account (`sign-up`).
  2. Forced redirect to onboarding, fill profile (Company: "Volt & Co.", Partita IVA).
  3. Navigate to profile page, upload company logo.
  4. Access catalog, create two custom price items: "Punto Luce Elettrico" (€55) and "Quadro Elettrico Standard" (€450).
  5. Go to dashboard, create manual quote: select standard template, select new client "Gino Rossi", select the catalog items (10x Punto Luce, 1x Quadro), apply 5% discount.
  6. Generate PDF, download it (asserting trial downloads used becomes 1).
  7. Send PDF via email to Gino Rossi.
  8. Assert all actions occur strictly in Italian.

#### Workload 2: The Document Price Intelligence to AI Quote Conversion
- **Persona**: Mason specialized in renovations who has existing PDF bills/estimates.
- **Workflow**:
  1. Log in.
  2. Navigate to documents upload page.
  3. Upload three separate invoice files (demolition bill, plaster bill, tile invoice).
  4. Trigger extraction on all three; wait for status "done" on all.
  5. Open "Price Intelligence" dashboard, verify average rates are extracted.
  6. Go to "New Quote" and select AI Generator.
  7. Input prompt: "Rifacimento bagno completo, inclusa demolizione e intonaco".
  8. Verify AI references the price intelligence table (uses extracted average rates for demolitions/intonaci).
  9. Assert quote contains accurate chapters matching the historical price data.

#### Workload 3: Single Quote Payment Unlock & Document Upgrade Flow
- **Persona**: Free user who wants to unlock a detailed professional estimate.
- **Workflow**:
  1. Log in, write an AI quote using Arosio (Professional) template.
  2. Toast message shows "Pro Required". User falls back to standard template and generates the quote.
  3. Try to generate clean PDF; gets redirected to payment page due to trial expiration.
  4. Click payment, trigger mock checkout completed webhook for that quote ID.
  5. Return to workspace; verify quote status is "unlocked".
  6. Generate PDF; verify no "BOZZA NON VALIDA" watermark is present.
  7. Upgrade subscription to Pro tier via Stripe webhook.
  8. Return to same quote, change template to Arosio, upgrade to Capitolato, verify technical text.

#### Workload 4: The CRM Aggregate Analysis and WhatsApp Customer Follow-up
- **Persona**: Contractor checking monthly performance.
- **Workflow**:
  1. Log in, create three quotes for client "Impresa Bianchi S.r.l." across different dates.
  2. Go to CRM page, select "Impresa Bianchi S.r.l." from client directory.
  3. Verify CRM lists all three quotes, calculates total value correctly, and displays stable ID.
  4. Go to settings, connect WhatsApp account with OTP.
  5. Open client detail page, verify client contact details now show WhatsApp connection action.
  6. Send quote PDF download link to Impresa Bianchi via WhatsApp webhook integration.

#### Workload 5: Mass Data Import, Catalog Building, and Template Formatting Audit
- **Persona**: Established contractor migrating from spreadsheet lists.
- **Workflow**:
  1. Log in.
  2. Upload excel spreadsheet (`XLSX`) containing a list of past project prices.
  3. Trigger document extraction.
  4. Click "Import from Quotes/Documents" on catalog page.
  5. Confirm import; verify catalog now contains 20+ items.
  6. Create manual quote, select "Elegant" template (requires Pro subscription, mock billing webhook).
  7. Add items from the newly imported catalog.
  8. Generate HTML representation, check that table styles match elegant formatting (no Nr column, compact layouts).
