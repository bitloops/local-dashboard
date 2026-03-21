# Migrate to Vite 8

Aligned with the Cursor plan **Migrate to Vite 8** (`migrate_to_vite_8_fed26d0b`).

## Current state (post-migration)

| Package                | Version                        |
| ---------------------- | ------------------------------ |
| `vite`                 | ^8.0.1                         |
| `@vitejs/plugin-react` | ^6.0.1                         |
| `vitest`               | ^4.1.0                         |
| `@tailwindcss/vite`    | ^4.1.18 (peer includes Vite 8) |

- [vite.config.ts](../vite.config.ts): `react()` + `tailwindcss()`, `worker.format: 'es'`, `optimizeDeps.include`, `@` alias, `/api` proxy — no `build.rollupOptions` / `rolldownOptions` yet.
- [vitest.config.ts](../vitest.config.ts): same plugins + alias as Vite config; no `as any` cast.

## Vite 8 notes (from migration guide)

| Area           | Impact                                                                                                           |
| -------------- | ---------------------------------------------------------------------------------------------------------------- |
| Bundler        | Rolldown replaces dual esbuild + Rollup                                                                          |
| Node           | **20.19+** or **22.12+** — [.nvmrc](../.nvmrc) `22`, CI `NODE_VERSION: 22`, [README](../README.md) prerequisites |
| Dep pre-bundle | `optimizeDeps.esbuildOptions` deprecated; use `optimizeDeps.rolldownOptions` if you customize pre-bundle         |
| Config renames | `build.rollupOptions` → `build.rolldownOptions` when you add Rollup-specific build options                       |

## Completed checklist

1. **Node** — `.nvmrc` + README + CI on Node 22.
2. **Bump packages** — vite ^8, vitest ^4, @vitejs/plugin-react ^6.
3. **Vitest 4** — [query-client.test.ts](../src/features/query-explorer/query-client.test.ts): `BitloopsCli` mock uses a `function` constructor for `new BitloopsCli()`.
4. **Validate** — run locally: `pnpm install`, `pnpm test`, `pnpm build`, `pnpm dev` / `pnpm preview` as needed; CI runs format, lint, test, e2e, build.

## Optional follow-ups

- `resolve.tsconfigPaths: true` in `vite.config.ts` (aliases from tsconfig; small perf cost).
- Tune `optimizeDeps` via `rolldownOptions` if pre-bundle issues appear.

## Rollback

Revert `package.json` + `pnpm-lock.yaml` and test fixes.
