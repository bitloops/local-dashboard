# Bitloops Local Dashboard

A local-first web UI for the [Bitloops](https://bitloops.com) CLI. Use it to see activity across commits, branches, and agents, and to run ad hoc queries in a GraphQL explorer backed by your local Bitloops backend.

## Prerequisites

- **Node.js** `>= 20.19` or `>= 22.12` (required by Vite 8)
- **pnpm** (this repo uses pnpm; CI uses pnpm 9)
- A reachable Bitloops CLI HTTP API. By default the dev server proxies `/devql/dashboard` and `/devql/global` to `http://127.0.0.1:5667` (see [Environment](#environment)).

## Setup

```bash
pnpm install
```

Copy optional env defaults if you want to customize behavior:

```bash
cp .env.example .env
```

## Running the app

```bash
pnpm dev
```

Open the URL shown in the terminal (typically [http://localhost:5173](http://localhost:5173)). Dashboard requests from the browser go to `/devql/dashboard/...` and Query Explorer requests go to `/devql/global/...` on the same origin; Vite forwards both to the backend you configure with `VITE_API_PROXY_TARGET`.

## Production build and preview

```bash
pnpm build    # TypeScript check + Vite production build → dist/
pnpm preview  # Serve the production build locally
```

## Install into the CLI bundle path

To replace the dashboard files the CLI reads from `~/.bitloops/dashboard/bundle`:

```bash
pnpm bundle
```

This runs a production build and moves `dist` to `~/.bitloops/dashboard/bundle`.

## Scripts

| Command                | Description                                                   |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm dev`             | Start the Vite dev server                                     |
| `pnpm build`           | TypeScript project build + production bundle to `dist/`       |
| `pnpm preview`         | Preview the production build                                  |
| `pnpm bundle`          | Build and install output under `~/.bitloops/dashboard/bundle` |
| `pnpm lint`            | Run ESLint                                                    |
| `pnpm format`          | Format with Prettier                                          |
| `pnpm format:check`    | Check formatting without writing files                        |
| `pnpm test`            | Run all Vitest unit and integration tests once                |
| `pnpm test:coverage`   | Run Vitest with coverage and enforce configured thresholds    |
| `pnpm test:watch`      | Run Vitest in watch mode                                      |
| `pnpm test:e2e`        | Playwright end-to-end tests (headless)                        |
| `pnpm test:e2e:headed` | E2E tests in a visible browser                                |
| `pnpm test:e2e:ui`     | E2E tests with Playwright's interactive UI                    |

## Environment

You do not need a `.env` file for typical local use if your API is already at the default proxy target.

| Variable                    | Purpose                                                                                                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_PROXY_TARGET`     | Origin for the dev-server `/devql/dashboard` and `/devql/global` proxies (default `http://127.0.0.1:5667`). Use `https://...` if your API is TLS-terminated. |
| `VITE_QUERY_HISTORY_TTL_MS` | Max age (ms) for persisted query-explorer run history in the browser (default 30 days).                                                                           |

See [.env.example](.env.example) for commented templates.

## Query explorer

The query explorer is a **read-only DevQL workspace** for exploring your Bitloops code-intelligence data. The editor speaks **GraphQL syntax**: you write operations with `query`, fields, arguments and variables and the UI uses your live schema (`GET /devql/global/sdl`) for autocomplete and validation of that syntax.

**What it is not:** this is not a full GraphQL client. **Only queries are supported** for execution against `POST /devql/global`. **Mutations and subscriptions are not supported**—the backend and explorer are built for ad hoc reads, not for changing server state or streaming updates. If you paste a mutation or subscription document, it may parse as valid GraphQL text, but it is outside what the explorer and API are meant to run.

Results render in a JSON viewer. Recent runs are stored in the browser (subject to `VITE_QUERY_HISTORY_TTL_MS`).

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).
