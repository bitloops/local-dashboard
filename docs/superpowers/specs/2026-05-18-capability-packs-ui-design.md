# Capability Packs UI Design

## Summary

This design restores a dedicated capability-pack configuration surface inside
the existing `Configuration` settings route at `/settings/configuration`. The
page focuses on UI behavior in the dashboard repo only: cross-pack controls
first, then one visible card per capability pack, one shared draft, one review
sheet, and one `Save & Run` action.

The page must never silently replace backend-backed behavior with local-only
state. If the runtime contract is unavailable or incomplete, the UI surfaces
that explicitly and prepares a clean handoff for a backend-focused agent.

## Goals

- Present all capability-pack options in the dashboard UI.
- Keep cross-pack controls visible above pack-specific settings.
- Keep disabled packs visible, but collapsed by default.
- Preserve a richer guided configuration flow for packs that have a defined
  guided setup model.
- Provide an `Advanced config` subsection for packs that do not yet have a
  guided spec.
- Use one shared draft, one review flow, and one `Save & Run` action.
- Treat backend contract failures as visible product states.

## Non-goals

- Implement or redesign the backend runtime schema in this repo.
- Persist capability-pack settings only in `localStorage` as a long-term model.
- Save pack settings independently per card.
- Hide disabled packs from the page.
- Infer backend dependency, plan, or runtime compatibility logic in the
  frontend.

## Route And Shell

- Primary route: `/settings/configuration`
- The capability-pack surface lives inside the existing Settings shell as part
  of the `Configuration` page rather than as a separate route.
- The capability-pack section can still use a dedicated `Capability Packs`
  heading within the `Configuration` page.
- If a legacy `/settings/capability-packs` route is still present during
  transition, it should redirect or alias into `/settings/configuration`
  instead of remaining a separate long-term surface.

## Page Structure

The page is arranged from global controls to specific pack details:

1. Header
2. Cross-pack settings
3. Capability-pack list
4. Sticky review bar
5. Review sheet

### Header

The capability-pack section header includes:

- `Capability Packs` title inside the broader `Configuration` page
- one-paragraph summary describing that the page configures Bitloops capability
  packs and their related setup
- page-level status badges such as:
  - `Draft changes`
  - `Backend unavailable`
  - `Needs reload`
  - `Ready to save`

### Cross-pack Settings

The first editable section contains toggles that affect multiple packs or the
general workflow:

- `Start daemon on app startup`
- `Sync enabled`
- `Ingest enabled`
- `Observability enabled`

These controls are shown as simple enabled/disabled toggles in the dashboard
UI. The meaning of `Observability` should match the existing Bitloops CLI
concept; the dashboard does not expand it into a separate mini-form.

### Capability-pack List

Below cross-pack settings, the page shows one visible card per capability pack.
This includes packs that are disabled, dependency-selected, experimental, or
currently blocked by missing backend data.

### Sticky Review Bar

The page keeps a single shared draft across all controls. A sticky footer or
bottom action area exposes:

- `Review changes`
- `Reset draft`
- `Save & Run`

No card saves independently.

### Review Sheet

The review sheet is the final checkpoint before apply. It must be large enough
to show cross-pack changes, pack-specific changes, backend plan output, and
blocking errors without forcing users into multiple subdialogs.

## Pack Card Model

Each pack uses one always-visible card.

### Collapsed State

When collapsed, a card shows:

- enable/disable toggle
- pack name
- short description
- readiness/status badge
- dependency summary
- `Explicit` or `Dependency-selected` badge
- `Experimental` badge where relevant

### Expansion Behavior

- Disabled packs remain visible but collapsed by default.
- Enabling a pack expands it automatically the first time.
- Re-disabling a pack collapses it again.
- Draft values inside the card remain in memory until the user resets the page
  draft.
- Dependency-selected packs can still expand, but their toggle becomes
  read-only when the backend reports that disabling them is blocked.

### Expanded Layout

An expanded pack shows three possible layers:

1. Overview
2. Guided settings
3. Advanced config

#### Overview

The overview area contains:

- readiness summary
- dependency explanation
- warnings
- blockers
- backend ownership or dependency-selection explanation when relevant

#### Guided Settings

Guided settings are shown only for packs with defined guided setup behavior.
They use curated controls rather than raw config-field listings.

Initial guided packs:

- `context_guidance`
  - guided controls for `guidance_generation`
- `architecture_graph`
  - guided controls for `fact_synthesis`
  - guided controls for `role_adjudication`

The UI may expose related runtime choices, probe state, or review output, but
the frontend does not invent planner logic on its own.

#### Advanced Config

Packs without a guided spec still expose an `Advanced config` subsection inside
their card. This subsection is the fallback for related raw fields or advanced
editing, rather than pretending that the pack has a full guided form when the
contract does not define one yet.

Initial packs in this mode include:

- `knowledge`
- `semantic_clones`
- `test_harness`
- `codecity`
- any other daemon-reported pack without a guided schema

## Guided Versus Advanced Boundaries

The page distinguishes between:

- guided, high-signal controls that users are expected to use first
- advanced fields that exist for completeness or unsupported packs

Rules:

- Guided packs can still include `Advanced config` as a secondary subsection.
- Advanced-only packs do not pretend to have guided settings.
- The page should not flatten all pack fields into one generic form.
- The page should not remove advanced access simply because a guided section
  exists.

## Draft Model

The full page uses one draft model.

- Cross-pack toggles and pack-card edits all contribute to the same draft.
- Leaving the page with unsaved changes should warn the user.
- Backend failures during review or apply must preserve the draft.
- `Reset draft` clears all draft state, not just the most recently changed
  section.

The UI must not silently downgrade backend-backed settings into local-only fake
state for equivalent controls.

## Review And Save Flow

### Review Entry

- `Review changes` opens the review sheet.
- `Save & Run` should route through the same review step if review has not yet
  been confirmed.

### Review Sheet Sections

The review sheet shows:

1. Cross-pack changes
   - start daemon on app startup
   - sync enabled
   - ingest enabled
   - observability enabled
2. Pack enablement changes
   - explicitly enabled packs
   - explicitly disabled packs
   - dependency-selected packs
   - disable actions blocked by dependencies
3. Pack-specific changes
   - guided pack choices
   - advanced field changes grouped under the owning pack
4. Backend plan results
   - config targets that will change
   - restart/reload requirements
   - created or reused runtime resources
   - follow-up work
   - validation warnings
5. Blockers
   - anything that prevents apply

### Save & Run

- The page exposes exactly one final apply action: `Save & Run`.
- Nothing is saved immediately when a toggle changes.
- After apply begins, the page should continue to render progress and resulting
  readiness states.
- The page should distinguish between:
  - config applied successfully and background work still running
  - apply blocked before config was saved

## Backend Failure And Handoff UX

Backend failures are first-class states.

### Failure Types

1. Page-level blockers
   - missing catalog query
   - missing plan/apply operation
   - repo resolution failure
2. Pack-level blockers
   - one pack cannot load settings or advanced fields
3. Action-level blockers
   - review or apply failed

### Blocker Content

Every blocker should include:

- human-readable summary
- exact failing operation or missing field
- impact scope:
  - page-wide
  - pack-only
  - action-only
- whether unaffected editing can continue
- next action for the user

### Handoff Panel

When a failure is clearly backend-owned, the page shows a `Backend handoff
needed` panel with copyable details:

- route: `/settings/configuration`
- repo context if available
- pack id if applicable
- failing query/mutation/subscription or missing field
- raw error message
- user impact summary
- timestamp

Available actions may include:

- `Retry`
- `Reload page state`
- `Continue editing unaffected packs`
- `Open advanced config`
- `Copy backend handoff`

## Expected Testing In This Repo

The UI design should drive test coverage in this dashboard repo for:

- page structure with cross-pack controls first
- disabled packs visible but collapsed
- enabled packs expanding automatically
- guided vs advanced pack rendering
- page-level, pack-level, and action-level blocker rendering
- one shared draft across cross-pack and pack-specific settings
- review-sheet grouping and blocker behavior
- canonical rendering inside `/settings/configuration`
- optional legacy redirect handling from `/settings/capability-packs`

## Backend Dependency Assumptions

This repo does not define the authoritative runtime contract. The UI is
expected to integrate with backend-owned capability-pack operations when
available, but the design intentionally keeps backend semantics outside the
frontend.

Assumed backend responsibilities include:

- daemon-reported capability-pack catalog
- dependency reasoning
- readiness state transitions
- plan/apply behavior
- runtime probing
- restart/reload requirements
- follow-up job orchestration

If these responsibilities are missing or partially implemented, the dashboard
must surface that rather than inventing fake success states.

## Design Summary

The final UI is a dedicated `Capability Packs` section within
`/settings/configuration`, with:

- cross-pack toggles at the top
- one always-visible card per pack
- richer guided settings where defined
- `Advanced config` fallback where guided setup does not exist
- one review sheet
- one `Save & Run` flow
- explicit backend blocker and handoff UX

This keeps the dashboard honest about backend state while still giving users a
complete, structured capability-pack interface in this repo.
