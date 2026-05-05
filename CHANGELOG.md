## [0.0.9]

### Added

- Live Code Atlas loading from the DevQL CodeCity GraphQL surface, including a typed `CodeCityWorldResult` query, repository resolution through the dashboard API, and a mapper from backend buildings, floors, zones, dependency arcs, render arcs, health signals, and architecture metadata into the existing renderer scene model.
- Code Atlas enrichment from the DevQL architecture graph, including C4 Systems, Containers, Components, Deployment Units, Entry Points, and Flow traversal metadata joined onto buildings.
- Architecture page with a 3D component-first view of Containers, Components, Deployment Units, Entry Points, flow-derived contract corridors, persistence read/write edges, and toggleable red direct module dependencies.
- Architecture component parent grouping, with path-derived parent frames, group search results, group inspector details, and row-aware component layout so flat component lists can be scanned hierarchically.
- Code Atlas data-source support for a live DevQL snapshot alongside the existing fixture catalogue, with the live source selected by default and `VITE_CODE_CITY_PROJECT_PATH` available for project-scoped CodeCity queries.
- Unit and Playwright coverage for the live CodeCity data shape, including backend-compatible world mapping, render-arc fallback behaviour, live-route network stubs, search, selection, overlay toggles, and canvas rendering.

### Changed

- Updated the Code Atlas page copy, badges, source catalogue, loader, and schema to describe live DevQL data rather than mock-only fixtures.
- Added Atlas inspector summaries and canvas markers for architecture graph containers, entry points, and flow arcs.
- Extended the renderer scene schema for backend arc visibility, source paths, labels, tooltips, single-boundary/unknown world layouts, event-driven/unclassified architecture patterns, and empty live worlds.
- Kept the Code Atlas public route export component-only so React refresh can validate the module boundary.

### Fixed

- Fixed Code Atlas arc visibility so backend world/medium zoom arcs can render without requiring a selected building, while selection-only arcs retain the existing focused behaviour.
- Fixed Code Atlas rendering and lint issues around floor stacking, camera focus dependencies, and React StrictMode live-load retries.
- Improved session compatibility and tool reporting for OpenCode

## [0.0.8]

### Added

- New sessions page containing explorer and list of sessions.

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
