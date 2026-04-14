## [Unreleased]

### Added

### Changed

### Fixed

## [0.0.6] - 2026-04-14

### Added

- A dashboard-specific transport layer under `src/api/dashboard/` for `/devql/dashboard` GraphQL requests and `/devql/dashboard/blobs/{repoId}/{blobSha}` blob fetches.
- Local dashboard domain types and mappers for repositories, branches, users, agents, commit rows, checkpoint detail, token usage, and file diffs.
- Targeted unit, hook, integration, and blob-preview tests covering repo identity to `repoId` resolution, Unix-second date filters, offset pagination, and checkpoint detail loading from the dashboard API.

### Changed

- Migrated dashboard reads from the removed `/api` routes to `/devql/dashboard`, while keeping Query Explorer query execution and SDL loading on `/devql/global`.
- Refactored dashboard state to select repositories by `repoId`, keep Query Explorer variables synced with repository identity, and load users and agents only after an effective branch exists.
- Replaced cursor-style commit paging with offset pagination and switched commit mapping to consume the new `checkpoints[]` payload from dashboard commit rows.
- Updated the Vite proxy, docs, and environment examples to describe `/devql/dashboard` for dashboard traffic and `/devql/global` for Query Explorer traffic.
- Removed the generated OpenAPI REST client, its codegen script, and the related TypeScript project references from the frontend.
- Updated CI actions

### Fixed

- Query Explorer blob preview now resolves the selected repository identity to a `repoId` before fetching blobs and returns a clear error when the repository cannot be resolved.
- Checkpoint detail now loads through the dashboard GraphQL query instead of the retired REST endpoint.
- Commit row mapping now counts all checkpoints already present in a single dashboard commit row instead of collapsing them to one.
- Package vunerabilities

## [0.0.5] - 2026-04-13

### Added

- Query Explorer blob preview support for `blobSha` results, plus follow-on UI improvements around the preview flow.

### Changed

- Shipped a small polish release on top of the `0.0.4` DevQL transport work.

### Fixed

- Corrected the pinned `pnpm` version so local and CI installs stay aligned.

## [0.0.4] - 2026-04-01

### Added

- Schema-driven Query Explorer features, including SDL-backed autocomplete, a variables editor, JSON result viewing, persisted run history, and request sequencing.
- Reverse pagination in the dashboard commit list, plus broader unit and integration test coverage.

### Changed

- Moved the dashboard and Query Explorer transport onto the DevQL GraphQL surface, centred on `/devql/global`, and upgraded the app to Vite 8.
- Refined internal architecture around shared store usage, history handling, and explorer state management.

### Fixed

- History persistence when the “do not save history” mode is enabled.
- Checkpoint detail loading against the updated endpoint, alongside assorted lint, formatting, documentation, and security fixes.

## [0.0.3] - 2026-03-12

### Added

- The three-panel Query Explorer layout.
- Agent support for Codex and Copilot in the dashboard and explorer views.

### Changed

- Refreshed bundle metadata and tidied supporting refactors ahead of the next release line.

## [0.0.2] - 2026-03-11

### Added

- A Query Explorer mode toggle directly in the dashboard.
- Richer checkpoint detail views, including session and summary modes, per-session tabs, chronological checkpoint graphs, and improved transcript formatting.

### Changed

- Improved commit-list interactivity, agent presentation, and the files-touched view in checkpoint details.

### Fixed

- Date filter behaviour and related UI rough edges in the dashboard interaction flow.

## [0.0.1] - 2026-03-09

### Added

- The first full dashboard UI, including commit and checkpoint browsing, a resizable checkpoint sidebar, token-usage visualisation, syntax-highlighted detail views, and git diff/file-touch details.
- Initial API integration and the first pass of unit, component, integration, and end-to-end test coverage.

### Changed

- Polished the shipped UI with local fonts, Bitloops branding assets, row transitions, and a redesigned checkpoint sidebar.

### Fixed

- Early build, lint, and row-collapse issues uncovered during the initial integration pass.

## [0.0.0] - 2026-03-04

### Added

- The initial Vite-based dashboard scaffold.
- Release workflow support, a deployment runbook, and initial bundle version tracking.
