# Worker Task Context: E2E Test Suite Implementation

## Objective
Implement the comprehensive opaque-box E2E test suite for PrevAI as designed in `proposed_TEST_INFRA.md` and publish `TEST_READY.md`.

## Working Directory
`c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\worker_m1_e2e`

## Inputs
- c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\sub_orch_e2e\proposed_TEST_INFRA.md
- c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\ORIGINAL_REQUEST.md
- c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\orchestrator\PROJECT.md
- c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\sub_orch_e2e\SCOPE.md

## Task Instructions
1. **Publish TEST_INFRA.md**: Copy the contents of `c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\sub_orch_e2e\proposed_TEST_INFRA.md` and write it to `c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\TEST_INFRA.md` (project root).
2. **Initialize E2E Workspace**:
   - Create the directory `artifacts/e2e-tests` with a `package.json` matching the monorepo workspace configurations.
   - Configure Playwright in `playwright.config.ts`. Set target base URL (e.g. `http://localhost:5173` or similar dev server port).
   - Configure dependencies: `@playwright/test`, `tsx`, `typescript`, `@types/node`.
3. **Implement E2E Mocks & Database Helpers**:
   - Write DB clean/seed helpers to reset the PostgreSQL database before each spec run using drizzle-orm or node-postgres (check `lib/db` for schema usage).
   - Write API mocks or webhook simulators (e.g. for Stripe webhook payments, WhatsApp Meta messages, and OpenAI responses) to keep tests hermetic.
4. **Implement E2E Specs (Tiers 1-4)**:
   - Implement the test cases outlined in `TEST_INFRA.md`.
   - Organize them under `src/specs/` or similar.
   - Ensure all user-facing copy asserts are strictly in Italian.
5. **Run and Verify**:
   - Run the frontend and api-server (or mock server if needed) and run the E2E tests using `@playwright/test`.
   - Verify that all implemented tests pass successfully.
6. **Publish TEST_READY.md**:
   - Write `TEST_READY.md` at the project root outlining the runner command, tier coverage statistics, and feature checklist as required.
7. **Report back**: Write your final implementation details to `handoff.md` in your working directory and send a message back.

## MANDATORY INTEGRITY WARNING
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## 2026-06-28T21:44:18Z
You are Worker 1 (archetype: teamwork_preview_worker).
Your working directory is: c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\worker_m1_e2e
Your task is defined in: c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\worker_m1_e2e\ORIGINAL_REQUEST.md
Please read c:\Users\Admin\Downloads\PrevAI (2)\PrevAI\.agents\sub_orch_e2e\proposed_TEST_INFRA.md and implement the E2E test runner and specs under artifacts/e2e-tests. Set up Playwright, database utilities, and mocking utilities. Ensure all E2E test specs (Tiers 1-4) are implemented.
Ensure all tests run successfully and all user-facing copy remains strictly in Italian. Publish TEST_INFRA.md and TEST_READY.md in the project root.
Create your BRIEFING.md and progress.md, and write your final handoff report to handoff.md in your working directory and send a message back when completed.

MANDATORY INTEGRITY WARNING: DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A Forensic Auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

