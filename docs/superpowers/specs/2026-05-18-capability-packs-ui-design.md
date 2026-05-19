# Capability Packs UI Design

## Summary

This design keeps capability-pack configuration inside
`/settings/configuration`, with cross-pack controls first and only real
config-backed pack editors below. The page must stop showing filler sections
such as `Inside this pack`, and it must not show pack cards that do not have
any exposed config fields yet.

Each visible pack card should feel self-contained: it shows the pack-owned
config plus the related inference profiles and runtimes it depends on. When
multiple packs reuse the same inference object, the first pack in page order
becomes the canonical editor and later packs render the same fields read-only.

The page still needs explicit backend blocker and handoff UX. The dashboard
must never fake backend support or pretend that a missing runtime contract is
already wired.

## Goals

- Keep the capability-pack UI inside `/settings/configuration`.
- Show cross-pack controls before pack-specific controls.
- Show only packs that have real exposed config.
- Make each visible pack card show what is actually configurable for that pack.
- Inline related inference profiles and runtimes inside the owning pack card.
- Avoid duplicate editing for shared inference objects.
- Preserve one shared draft, one review flow, and one `Save & Run` action.
- Keep backend blockers explicit.

## Non-goals

- Reintroduce a separate `/settings/capability-packs` primary route.
- Keep placeholder content such as `Inside this pack`.
- Show `Advanced config` when a pack has no exposed fields to render.
- Expose packs like `CodeCity` or `Test harness` before runtime config for them
  is actually available.
- Invent backend semantics in the dashboard repo.

## Route And Shell

- Primary route: `/settings/configuration`
- The capability-pack experience lives inside the existing `Configuration`
  page.
- `/settings/capability-packs` may remain as a legacy alias into
  `/settings/configuration`, but it is not a separate long-term surface.

## Page Structure

The page is arranged in this order:

1. `Configuration` header
2. `Capability Packs` section header
3. `Cross-pack` controls
4. Visible pack cards with real config
5. Review actions and review sheet
6. Lower advanced daemon-config area for unrelated config sections

## Cross-pack Controls

The first section contains simple toggles:

- `Start daemon on app startup`
- `Sync enabled`
- `Ingest enabled`
- `Observability enabled`

These stay visible at the top regardless of which packs are shown below.

## Visible Pack Rules

The capability-pack area only shows packs that have exposed config-backed
fields in the daemon/runtime snapshot or in directly related inference config.

Initial visible packs:

- `Architecture graph`
- `Context Guidance`
- `Semantic clones`
- `Knowledge pack`

Initial hidden packs when no exposed config is available:

- `CodeCity`
- `Test harness`

If a currently hidden pack later gains real exposed config, it should appear
as a normal pack card without needing a separate UI model.

## Pack Card Model

Each visible pack gets one card with:

- pack name
- short summary
- status badge
- dependency or reuse badges when relevant
- enable/disable control when the pack is directly togglable

The card should not show filler subsections. If there are no real fields to
render for a subsection, that subsection is omitted.

### Card Contents

Each visible pack card may contain up to three real layers:

1. Direct pack config
2. Related inference profiles
3. Related inference runtimes

### Direct Pack Config

These are fields that belong directly to the pack section itself, such as:

- `architecture.*`
- `architecture.inference.*`
- `context_guidance.*`
- `context_guidance.inference.*`
- `semantic_clones.*`
- `semantic_clones.inference.*`
- `knowledge.*`

These fields are rendered first inside the pack card.

### Related Inference Profiles

If a pack references a profile name under `inference.profiles.*`, the full
related profile block is rendered inline inside the same pack card.

Examples:

- `Architecture graph`
  - `fact_synthesis`
  - `role_adjudication`
  - related `inference.profiles.<name>` blocks
- `Context Guidance`
  - `guidance_generation`
  - related `inference.profiles.<name>` block
- `Semantic clones`
  - `summary_generation`
  - `code_embeddings`
  - `summary_embeddings`
  - related `inference.profiles.<name>` blocks

### Related Inference Runtimes

If a shown profile references a runtime under `inference.runtimes.*`, the full
runtime block is also rendered inline in that same pack card.

This includes fields such as:

- `command`
- `args`
- `startup_timeout_secs`
- `request_timeout_secs`

The purpose is that users can understand and edit a pack in one place rather
than jumping between unrelated config sections.

## No-Duplicate Editing Rule

Shared inference objects must appear everywhere they matter, but only one copy
is editable.

Rule:

- the first visible pack in page order that references a given shared profile
  or runtime becomes the canonical editor
- that first pack renders the shared inference block as editable
- later packs still render the full block inline, but read-only

Reused blocks should clearly indicate:

- that the config is shared
- which pack owns the editable version
- optionally which other packs reuse it

This keeps pack cards self-contained without creating conflicting editors.

## Config Mapping

### Cross-pack Area

The cross-pack area may include config-backed fields that conceptually belong
to workflow-wide behavior, such as:

- `runtime.local_dev`
- `telemetry.enabled`
- `dashboard.local_dashboard.tls`
- dashboard-owned toggles like start daemon, sync, ingest, and observability

### Architecture Graph Card

Show:

- `[architecture.inference].fact_synthesis`
- `[architecture.inference].role_adjudication`
- linked profiles from `[inference.profiles.*]`
- linked runtimes from `[inference.runtimes.*]`

### Context Guidance Card

Show:

- `[context_guidance.inference].guidance_generation`
- linked profile
- linked runtime

### Semantic Clones Card

Show pack-owned fields such as:

- `summary_mode`
- `embedding_mode`
- `ann_neighbors`
- `enrichment_workers`
- `[semantic_clones.inference]` bindings
- linked profiles
- linked runtimes

### Knowledge Pack Card

Show:

- `[knowledge.providers.github]`
- `[knowledge.providers.atlassian]`
- any other exposed `knowledge.*` fields present in the runtime snapshot

## Lower Advanced Daemon-Config Area

The existing runtime-config editor remains below the capability-pack workflow.
It is still useful for config that is real but not part of a pack card.

This lower area keeps sections such as:

- `stores`
- `logging`
- generic `runtime`
- generic `dashboard.bundle_dir`
- unrelated inference profiles or runtimes that are not referenced by the
  visible capability-pack cards

The capability-pack section is the primary narrative. The lower daemon-config
area is the fallback and completeness surface.

## Draft And Review Flow

The page still uses one shared draft.

- Cross-pack changes and pack-card changes all participate in the same draft.
- Nothing saves per card.
- `Review changes` opens one review sheet.
- `Save & Run` remains the only final apply action.

The review sheet should group changes as:

1. Cross-pack changes
2. Pack-level direct config changes
3. Shared inference profile/runtime changes
4. Backend plan or blocker output

## Backend Failure And Handoff UX

Backend failures remain first-class states.

The UI must still show:

- page-level blockers
- pack-level blockers
- action-level blockers
- a `Backend handoff needed` panel with route, operation, and user-impact
  details

The dashboard must not silently fall back to fake local-only persistence for
controls that are meant to represent backend-owned config.

## Expected Testing In This Repo

This design should drive tests for:

- cross-pack controls at the top
- only real config-backed packs being visible
- hidden packs with no exposed config
- pack cards rendering direct pack config
- pack cards rendering related inference profiles and runtimes inline
- shared inference rendered editable once and read-only elsewhere
- absence of filler sections like `Inside this pack`
- absence of empty `Advanced config` placeholders
- one shared draft and review flow
- canonical rendering inside `/settings/configuration`
- optional legacy alias handling for `/settings/capability-packs`

## Design Summary

The final UI is a capability-pack-first configuration surface inside
`/settings/configuration`:

- cross-pack controls first
- only real config-backed pack cards
- full inline visibility into pack config plus related inference
- no duplicate editing for shared inference
- lower advanced daemon-config access for unrelated sections
- one review flow
- explicit backend blocker and handoff UX
