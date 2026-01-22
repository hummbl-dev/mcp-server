# Copilot Instructions for HUMMBL MCP Server

This guide enables AI coding agents to be productive in the HUMMBL MCP Server codebase. It summarizes architecture, workflows, and conventions unique to this project.

## Big Picture Architecture
- **Purpose:** Implements the Model Context Protocol (MCP) for HUMMBL Base120 mental models.
- **Core Structure:**
  - `src/framework/base120.ts`: Contains the full Base120 mental models database.
  - `src/tools/models.ts`: Registers available tools for model access/search.
  - `src/resources/models.ts`: Resource endpoints for models and transformations.
  - `src/types/domain.ts`: Core type definitions for models, transformations, and requests.
  - `src/utils/result.ts`: Implements result pattern utilities for consistent error/success handling.
  - `src/server.ts`: Configures the MCP server and tool integration.
  - `src/index.ts`: Stdio entry point for CLI and desktop integration.
- **Data Flow:** Requests are routed through `server.ts` to tools/resources, which query the Base120 database and return results using the result pattern.

## Developer Workflows
- **Install dependencies:** `npm install`
- **Build:** `npm run build`
- **Run locally:** `npm run dev`
- **Type checking:** `npm run typecheck`
- **Test:** Uses [Vitest](https://vitest.dev/) for unit tests. Run with `npm test` or `npx vitest`.
- **Coverage:** Output in `coverage/` after tests.

## Project-Specific Conventions
- **Mental Model Codes:** Models are referenced by codes (e.g., `P1`, `IN2`).
- **Transformations:** Six types: P, IN, CO, DE, RE, SY. See `base120.ts` for details.
- **Result Pattern:** All tool/resource responses use a result object `{ success, error, data }` (see `utils/result.ts`).
- **Tool Registration:** New tools must be registered in `src/tools/models.ts` and exposed via `src/resources/models.ts`.
- **Resource URIs:** Use `hummbl://model/{code}` and `hummbl://transformation/{type}` for direct access.

## Integration Points
- **Claude Desktop:** Integrate by configuring the command/args in Claude Desktop config (see README).
- **External Access:** All model and transformation data is exposed via tools and resource endpoints.

## Patterns & Examples
- **Adding a Model:** Update `base120.ts` and ensure type coverage in `domain.ts`.
- **Registering a Tool:** Add to `tools/models.ts`, expose in `resources/models.ts`, and document in README.
- **Testing:** Place unit tests in `src/__tests__/` or next to implementation files (e.g., `history-manager.test.ts`).

## Key Files & Directories
- `src/framework/base120.ts` — Mental models database
- `src/tools/models.ts` — Tool registration
- `src/resources/models.ts` — Resource endpoints
- `src/types/domain.ts` — Type definitions
- `src/utils/result.ts` — Result pattern
- `src/__tests__/` — Unit tests

---
**Feedback:** If any section is unclear or missing, please specify so it can be improved for future AI agents.
