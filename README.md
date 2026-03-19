# Bitloops Local Dashboard

A local-first dashboard UI for the Bitloops CLI. It provides real-time visibility into commits, branches and agents used, alongside an interactive GraphQL query explorer for exploring code intelligence data.

## Prerequisites

- **Node.js** `>= 20.19` or `>= 22.12` (required by Vite 8)
- A running Bitloops CLI backend at `http://bitloops.local:5667`.

## Getting Started

```bash
# Install dependencies
pnpm install

# Start the dev server (opens http://localhost:5173)
pnpm dev
```

## Scripts

| Command                 | Description                                             |
| ----------------------- | ------------------------------------------------------- |
| `pnpm dev`              | Start Vite dev server                                   |
| `pnpm build`            | TypeScript check + production build                     |
| `pnpm bundle`           | Build and copy output to `~/.bitloops/dashboard/bundle` |
| `pnpm preview`          | Preview the production build locally                    |
| `pnpm lint`             | Run ESLint                                              |
| `pnpm format`           | Format all files with Prettier                          |
| `pnpm format:check`     | Check formatting without writing                        |
| `pnpm test`             | Run all Vitest tests once                               |
| `pnpm test:watch`       | Run Vitest in watch mode                                |
| `pnpm test:unit`        | Unit tests only (excludes `tests/integration/`)         |
| `pnpm test:integration` | Integration tests only                                  |
| `pnpm test:e2e`         | Playwright end-to-end tests                             |
| `pnpm test:e2e:headed`  | E2E tests in a visible browser                          |
| `pnpm test:e2e:ui`      | E2E tests with Playwright's interactive UI              |
| `pnpm test:e2e:debug`   | E2E tests in debug mode                                 |
| `pnpm test:e2e:install` | Install Chromium for Playwright                         |
| `pnpm open-api-codegen` | Regenerate the OpenAPI client from the backend          |

## Environment

Variables

All variables have sensible defaults; no `.env` file is required for local development against the standard CLI backend.

## Query Explorer

The query explorer provides an interactive GraphQL editor with schema-driven autocomplete. It offers context-aware suggestions for fields, arguments, variables, and types. Queries are executed and results are displayed in a JSON viewer. A run history panel persists recent queries in localStorage.

```bash

```
