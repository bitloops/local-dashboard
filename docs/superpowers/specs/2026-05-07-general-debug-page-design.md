# General Debug Page Design

Date: 2026-05-07

## Context

The local dashboard currently focuses on interaction sessions, checkpoints, and the GraphQL query explorer. That works for session inspection, but it does not explain runtime failures across the CLI's operational machinery.

The CLI has several runtime domains that can fail independently or interact in confusing ways:

- A repo-scoped DevQL task queue with sync, ingest, embeddings bootstrap, and summary bootstrap tasks.
- Producer spools that convert hook/watcher work into queue tasks.
- Workplane and enrichment queues.
- Current-state consumer runs.
- Daemon process state, health, storage backends, repo bindings, and config targets.
- Watcher registration and repo-local runtime state.
- Logs, which are useful evidence but too noisy to be the primary navigation model.

The page should be general enough for future runtime issues, not only `CLI-1809`.

## Goals

- Provide a repo-scoped debug cockpit that answers "what is unhealthy right now?" first.
- Make the selected repo's daemon binding visible at all times.
- Let users drill into queues, spools, runtime, repo state, and config without switching tools.
- Keep logs as contextual evidence for a selected issue or subsystem, not as a full log viewer.
- Keep the first version read-only, except for a diagnostic sync validation action.
- Make it obvious when a signal is unavailable because the backend does not expose it yet.

## Non-Goals

- No destructive queue or daemon controls in the first version.
- No generic log viewer with arbitrary full-text search in the first version.
- No CLI-1809-only repro wizard.
- No replacement for Query Explorer.
- No new styling system; the page should use the dashboard's current dark, dense operational UI.

## Product Shape

Add a new `Debug` item in the sidebar under an `Operations` group.

The first screen has four vertical layers:

1. Repo selector and daemon binding banner.
2. Health cockpit cards.
3. Prioritized issue list.
4. Subsystem explorer with a supporting inspector/log panel.

The layout is repo-scoped by default. Daemon-wide details appear only as context for the selected repo.

## Visual Information Architecture

### Repo And Daemon Banner

Always show:

- Selected repo identity and repo root.
- Bound daemon URL, PID, mode, and config path.
- Storage backend status for relational, events, and blob stores.
- Last refreshed timestamp.

This avoids the common confusion where a repo is bound to a different daemon or config root than expected.

### Cockpit Cards

Use compact status cards for the highest-value health signals:

- Overall repo state.
- Queues.
- Spools.
- Runtime.
- Validation.
- Config.

Each card shows a status chip, two or three concrete metrics, and a click target that focuses the relevant subsystem tab.

### Prioritized Issues

The page should synthesize raw state into a small issue list. Examples:

- Validation drift after background settle.
- Producer spool has stale pending work.
- Queue contains failed tasks.
- Work is pending but no worker is active.
- Watcher missing while sync is enabled.
- Repo binding does not match the daemon serving the dashboard.
- Config says ingest is disabled but ingest tasks are present.

Each issue has severity, a concise title, one-line evidence, and a drilldown target.

### Subsystem Explorer

Tabs:

- `Queues`
- `Spools`
- `Runtime`
- `Repo state`
- `Config`

The right side of the explorer is an inspector. It shows selected-row details and a supporting log panel filtered by issue, task id, run id, path, repo id, or subsystem.

## Subsystem Detail

### Queues

Purpose: inspect queued, running, failed, and recent work.

Data already mostly exists through runtime/global GraphQL:

- DevQL task queue status.
- Current repo tasks.
- Task kind/source/status/spec/progress/result/error.
- Workplane pools and mailboxes.
- Current-state consumer queue status and current run.
- Embeddings readiness gate and blocked mailboxes.

Show:

- Lane summaries for DevQL, workplane, current-state consumer, and bootstrap work.
- Current repo task/run table.
- Status, attempts, queue position, source, age, progress, result summary, and error.
- Blocking context such as paused repo queue, readiness gate, or mailbox block reason.

### Spools

Purpose: explain whether producers created work and whether that work became queue tasks.

This needs new structured diagnostic exposure.

Show:

- Producer spool jobs by payload type and status.
- Dedupe key, attempts, available time, submitted time, updated time, last error.
- Payload summary for task, post-commit refresh, post-merge refresh, post-commit derivation, and pre-push sync.
- Conversion trail from spool job to task id when available.

Primary questions:

- Did a hook or watcher produce a spool job?
- Did that job become a queue task?
- Was work deduped in a way that hid a real state change?
- Is a job stale, retrying, or stuck running?

### Runtime

Purpose: inspect the selected repo's daemon and runtime readiness.

Partially exposed today.

Show:

- Daemon runtime state: URL, PID, mode, host, port, config root, binary fingerprint, updated time.
- Service metadata and service running state when present.
- Backend health: relational, events, blob.
- Init session status.
- Watcher registration/running state for the selected repo.

Watcher state likely needs more explicit exposure than the current runtime snapshot provides.

### Repo State

Purpose: show Git/worktree facts that explain whether producers should have run.

This needs new structured diagnostic exposure.

Show:

- Branch, HEAD, merge state, and repo root.
- Staged, unstaged, untracked, and deleted paths.
- Source paths after classification and exclusions.
- Last sync state/revision when available.
- Last validation summary.

Primary questions:

- Does Git have staged or dirty source changes?
- Did path classification exclude the file?
- Does expected validation state diverge from actual state?

### Config

Purpose: explain effective behavior from daemon and repo policy.

Mostly available through runtime config surfaces.

Show:

- Effective sync, ingest, watcher, backend, and exclusion settings.
- Config target paths and validation status.
- Repo-local daemon binding.
- Differences between daemon config and repo policy where relevant.

### Supporting Logs

Purpose: provide evidence for the selected issue or row.

Logs remain supporting context, not primary navigation.

Show:

- Filtered warning/error lines first.
- Structured JSON fields when present.
- Expandable neighboring lines for context.
- Source subsystem label where possible.

Log filtering should be driven by current selection: issue, task id, run id, repo id, path, or subsystem.

## Diagnostic Validate Action

The first version may include a `Run validate` button because validation is diagnostic rather than operational control.

Behavior:

- It runs sync validation for the selected repo.
- It displays the result in the Validation card and Repo State tab.
- It should show running, success, drift, and failure states.
- It should be visually separate from controls like pause, resume, retry, restart, or clear.

The page must describe validation as a diagnostic run that may take time and may use temporary scratch state.

## Data Surfaces

Use existing surfaces where possible:

- `/devql/runtime` for repo runtime snapshot, config targets, config snapshots, and runtime events.
- `/devql/global` for task queue and task progress where needed.
- `/devql/dashboard` for existing dashboard repo selection and dashboard shell data.

Add new diagnostic surfaces for:

- Producer spool status and recent jobs.
- Repo state summary, including Git status and classification/exclusion results.
- Watcher registration/running state if not already represented clearly enough.
- Contextual daemon log tail/filtering.
- Validation run trigger/result if no suitable existing dashboard-safe endpoint exists.

Prefer structured GraphQL objects over parsing CLI text output.

## Frontend Components

Proposed feature folder:

- `src/features/debug/debug-view.tsx`
- `src/features/debug/components/debug-repo-daemon-banner.tsx`
- `src/features/debug/components/debug-cockpit-card.tsx`
- `src/features/debug/components/debug-issue-list.tsx`
- `src/features/debug/components/debug-subsystem-tabs.tsx`
- `src/features/debug/components/debug-inspector.tsx`
- `src/features/debug/components/debug-supporting-logs.tsx`
- `src/features/debug/api/` for runtime/global/diagnostic GraphQL calls.

Use the existing dashboard layout, repo picker patterns, shadcn-style components, and table styling. Keep density high and avoid marketing-style presentation.

## Data Flow

1. User opens `Debug`.
2. The page resolves selected repo from existing dashboard repo selection behavior.
3. The page loads runtime snapshot for the repo.
4. The page loads queue details and diagnostic summaries in parallel.
5. A local issue synthesizer converts raw subsystem state into prioritized issues.
6. User clicks a cockpit card, issue, or table row.
7. The subsystem tab and inspector update.
8. Supporting logs are filtered from the selected context.
9. Runtime events can refresh affected panels without losing the current selection.

## Error And Empty States

- If daemon is stopped, show daemon binding/config information and explain that live runtime panels are unavailable.
- If a repo has no binding, show the missing binding as the top issue.
- If a backend surface is not implemented, show an "Unavailable" state instead of hiding the tab.
- If queues are empty and healthy, show zero-state summaries instead of blank tables.
- If logs are unavailable, keep the selected issue visible and show that no supporting logs could be loaded.
- If validation fails to run, show the command-level failure separately from validation drift.

## Testing

Frontend tests:

- Route renders and sidebar navigation includes `Debug`.
- Repo selection loads runtime data and updates panels.
- Cockpit card click focuses the correct tab.
- Issue click focuses the correct tab and inspector context.
- Empty, failed, unavailable, and healthy states render distinctly.
- Validate button renders as diagnostic action and handles running/success/drift/failure states.

Backend/API tests:

- Runtime snapshot remains available for current repo.
- New spool diagnostic query returns pending/running/failed jobs with payload summaries.
- New repo state query returns Git status and classification/exclusion summaries.
- Log filtering query returns bounded, contextual lines.
- Validation diagnostic run returns structured result without mutating canonical DevQL state.

Manual verification:

- Open dashboard at desktop and mobile widths.
- Confirm no text overlap in the dense cards/tables.
- Confirm long paths truncate or wrap predictably.
- Confirm the page remains usable when several diagnostics are unavailable.

## Acceptance Criteria

- A user can select a repo and immediately see whether the repo's runtime state needs attention.
- A user can identify whether the likely problem is queue, spool, runtime, repo state, config, or validation drift.
- A user can drill into the relevant subsystem without writing GraphQL manually.
- A user can see supporting logs for the selected issue without opening a separate log viewer.
- A user can run sync validation as a diagnostic action and inspect the result.
- The first implementation is read-only aside from diagnostic validation.
