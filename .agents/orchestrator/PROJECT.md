# Project: PrevAI Codebase Audit, Clean-up, and Architectural Analysis

## Architecture
- **Monorepo**: Managed using pnpm workspaces.
- **Frontend**: React + Vite (located in `artifacts/preventivo-ai`).
- **Backend/API**: Express 5 server (located in `artifacts/api-server`).
- **Database**: PostgreSQL with Drizzle ORM (located in `lib/db`).
- **Auth**: Better Auth integration.
- **API Client**: Orval codegen mapping OpenAPI spec (`lib/api-spec/openapi.yaml`) to React Query hooks.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: Exploration & Codebase Audit | Scan `preventivo-ai`, `api-server` and shared libraries for syntax, type, and linting errors. Check Drizzle ORM setup, API integrations, and env vars. Create audit checklist. | None | IN_PROGRESS |
| 2 | M2: Mobile Package Removal | Delete `artifacts/preventivo-mobile` directory and all workspace configurations/references to it. | None | IN_PROGRESS |
| 3 | M3: Typecheck & Compilation Repair | Resolve all critical TypeScript compilation errors, linter issues, and module resolution issues in `preventivo-ai` and `api-server`. Ensure `pnpm run typecheck` passes successfully. | M1, M2 | PLANNED |
| 4 | M4: Final Report & Validation | Compile final Markdown report summarizing architectural maps, identified and fixed errors, integration statuses, and verifying localization constraints (strictly Italian). | M3 | PLANNED |

## Interface Contracts
### API-Server ↔ Preventivo-AI
- Defined via OpenAPI spec in `lib/api-spec/openapi.yaml`.
- Client-side code generated using Orval in `lib/api-client-react/src/generated/`.

### API-Server ↔ Database
- Configured via Drizzle ORM in `lib/db/src/schema/`.
