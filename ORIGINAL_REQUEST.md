# Original User Request

## Initial Request — 2026-06-28T19:32:00Z

<USER_REQUEST>
# Teamwork Project Prompt — Draft

Scan, audit, and clean up the `PrevAI` codebase. Identify code errors, analyze architecture/structure, check backend integrations, and remove the mobile application package.

Working directory: c:/Users/Admin/Downloads/PrevAI (2)/PrevAI

Integrity mode: development

## Requirements

### R1. Remove Mobile Application Package [DELETE]
- Delete the `artifacts/preventivo-mobile` directory and any configuration files referencing it (e.g. workspace setups, build files) to keep only browser (PC and phone) and backend components.

### R2. Code Error Audit
- Scan `artifacts/preventivo-ai` and `artifacts/api-server` for syntax, logic, and runtime errors.
- Locate typescript errors, linter issues, and missing dependencies.

### R3. Structural & Architectural Analysis
- Analyze and map the repository's component hierarchy, state management, routes, and overall structure.
- Produce a clear architectural summary.

### R4. Backend Integrations Analysis
- Check all API integrations, database configurations (Drizzle ORM), third-party services, and environment variables.
- Detail what is working/correctly integrated and what is missing or incomplete.

### R5. Localization and Design Constraints
- Do NOT change any design or UI elements unless explicitly requested.
- Ensure all user-facing strings, labels, placeholders, and error messages remain strictly in Italian (no English translations or placeholders).

## Acceptance Criteria

### Cleanup & Verification
- [ ] The `artifacts/preventivo-mobile` directory is completely deleted.
- [ ] The remaining codebase (`preventivo-ai`, `api-server`, `lib`, etc.) compiles without critical TypeScript or module resolution errors.

### Final Audit Report
- [ ] A detailed Markdown report is created listing:
  - Identified code/configuration errors and how to fix them.
  - An architectural overview of the components.
  - A comprehensive breakdown of backend integrations (status, missing keys/setup, improvements).
- [ ] The report verifies that all user-facing website content remains in Italian and no designs were modified.
</USER_REQUEST>
