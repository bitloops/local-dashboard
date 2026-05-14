# Canonical Transcript Normalization for Dashboard Sessions

|                  |                                      |
| ---------------- | ------------------------------------ |
| **Status**       | Proposed                             |
| **Backend repo** | `bitloops`                           |
| **Frontend**     | `local-dashboard`                    |
| **Audience**     | Dashboard + Agent platform engineers |
| **Last updated** | 2026-05-13                           |

## TL;DR

The dashboard renders transcripts using a single, Claude-shaped parser running in the browser. Codex, OpenCode, and Copilot transcripts do not match that shape, so they fail this parser and the UI falls back to prompts, empty tool traces, or empty transcripts.

The fix is to move transcript normalization into `bitloops`, behind the existing agent adapter pattern, and expose canonical `TranscriptEntry` rows through the dashboard API. The dashboard becomes a pure renderer of those entries.

The work is mostly a migration: tool-call pairing by `toolUseId` and prompt fallback already exist in the frontend and move to the backend, then the frontend parsers delete.

## Problem

There are two transcript rendering entry points in the dashboard, both of which parse JSONL in the browser:

1. **Session sidebar, Turns tab, Tool-use tab.** `src/features/dashboard/utils/turn-transcript.ts` reads `rawEvents.payload.transcript_fragment` for each `turn_end` event and parses it as JSONL.
2. **Checkpoint sheet.** `src/features/dashboard/components/checkpoint-sheet.tsx:198` parses `activeCheckpointSession.transcript_jsonl` directly.

Both paths use one shared parser, `parseTranscriptEntries` in `checkpoint-sheet-utils.ts`, that hard-codes a Claude-shaped schema: `type` plus `message.content[]` with `text` / `thinking` / `tool_use` / `tool_result` blocks. There is no agent-kind branching anywhere in the transcript path. Only `agent-icon.tsx` switches on agent slug, and that is for picking an icon.

The practical effect: when a non-Claude session is opened, the Claude-only parser extracts little or nothing, and the UI silently falls back to per-turn `prompt` strings or empty tool traces.

This is the wrong place to absorb the difference. Agent format divergence belongs in `bitloops`, behind the adapter pattern that already absorbs every other per-agent concern.

## Decision

Add a canonical `TranscriptEntry` model to `bitloops`. Each agent adapter implements normalization. The dashboard renders canonical entries directly and the frontend transcript parsers delete.

This is additive. Raw `rawEvents`, `transcript_fragment`, and `transcript_jsonl` fields remain for debug and export.

## API contract

### New types

```graphql
enum DashboardTranscriptActor {
  USER
  ASSISTANT
  SYSTEM
}

enum DashboardTranscriptVariant {
  CHAT
  THINKING
  TOOL_USE
  TOOL_RESULT
}

enum DashboardTranscriptSource {
  TRANSCRIPT
  PROMPT_FALLBACK
}

type DashboardTranscriptEntry {
  entryId: String!
  sessionId: String!
  turnId: String
  order: Int!
  timestamp: String
  actor: DashboardTranscriptActor!
  variant: DashboardTranscriptVariant!
  source: DashboardTranscriptSource!
  text: String!
  toolUseId: String
  toolKind: String
  isError: Boolean!
}
```

### Extended types

Names differ by layer. Both layers need updates.

| Concern               | Backend (Rust, `bitloops/src/api/dashboard_types.rs`)                | Frontend (TS, `local-dashboard`)                                                       |
| --------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Per-turn entries      | `DashboardInteractionTurn.transcript_entries` (line 315)             | `DashboardInteractionTurnNode.transcriptEntries` (`graphql/types.ts:176`)              |
| Whole-session entries | `DashboardInteractionSessionDetail.session_transcript_entries` (337) | Inner field of `DashboardInteractionSessionDetailQueryData` (`graphql/types.ts:235`)   |
| Checkpoint entries    | `DashboardCheckpointSessionDetail.transcript_entries` (141)          | `DashboardCheckpointSessionDetailDto.transcript_entries` (`api-types.ts:74`), REST DTO |

> The checkpoint path is REST, not GraphQL, on the frontend. The backend GraphQL type `DashboardCheckpointSessionDetail` exists at `bitloops/src/api/dashboard_types.rs:141`, but the dashboard consumes it as `DashboardCheckpointSessionDetailDto` via `DashboardCheckpointDetailResponse` (`api-types.ts:87`). Both the GraphQL/Rust schema and the REST serializer plus the frontend mapper need the new field, or the dashboard will not receive it.

## Normalization rules

| Source content              | actor       | variant       |
| --------------------------- | ----------- | ------------- |
| User prompt or message      | `USER`      | `CHAT`        |
| Assistant reply text        | `ASSISTANT` | `CHAT`        |
| Assistant reasoning content | `ASSISTANT` | `THINKING`    |
| Tool invocation             | `SYSTEM`    | `TOOL_USE`    |
| Tool output                 | `SYSTEM`    | `TOOL_RESULT` |

Other field rules:

- `text` is display-ready. `TOOL_USE` text is `Tool: <toolKind>` followed by a normalized input summary; `TOOL_RESULT` text is the output or a summarized structured output.
- `toolUseId` is taken from the source transcript when present and generated deterministically when missing. See [Tool use id generation](#tool-use-id-generation) below.
- `source` is `TRANSCRIPT` for entries derived from transcript content and `PROMPT_FALLBACK` for entries synthesized from `turn.prompt` when a turn has no transcript slice.
- `isError` is true when the tool result indicates an error in the source format.

> Claude `THINKING` entries are net-new work. The current `TranscriptToolEventDeriver` impl for Claude (`bitloops/src/adapters/agents/claude_code/transcript/tool_events.rs`) does not parse thinking blocks today.

### Tool use id generation

When the source transcript provides a correlation id (Claude, Codex `response_item.id`, OpenCode `callID`), use it verbatim — that string becomes the `toolUseId` on both the `TOOL_USE` and the corresponding `TOOL_RESULT` entry.

When the source does not provide one (Copilot, Gemini, future Cursor work, and edge cases where Claude/Codex transcripts are missing ids), generate it deterministically as:

```
derived:<session_id>:<turn_scope>:<tool_call_index>
```

Where:

- `<session_id>` is the session id.
- `<turn_scope>` is the `turn_id` when the deriver is running in a per-turn slice, or the literal string `session` when running over the whole session transcript before segmentation.
- `<tool_call_index>` is a zero-based monotonic counter scoped to `(session_id, turn_scope)`, incremented each time the deriver emits a `TOOL_USE` entry. It is **not** scoped per `toolKind`, so the third tool call in a turn is always `:2` regardless of which tool ran.

Pairing rule: when the deriver emits a `TOOL_RESULT` from a source that lacks an explicit correlation, it pairs the result with the most recent emitted `TOOL_USE` in the same scope that has not yet been paired, and reuses that id. If no unpaired `TOOL_USE` exists in scope, the deriver emits the `TOOL_RESULT` with a freshly generated id of the same shape (`derived:…:<next_index>`) and `isError = true`. This makes orphan results visible rather than dropped.

Properties:

- Deterministic: re-deriving the same transcript yields the same ids on every read, so the frontend can cache safely.
- Debuggable: the `derived:` prefix makes generated ids distinguishable from source-supplied ones at a glance.
- Stable across the dual-read migration: as long as derivation order is preserved, ids remain consistent.

## Backend design

### Trait

Add a sibling trait to `TranscriptToolEventDeriver`:

```rust
pub trait TranscriptEntryDeriver: Agent {
    fn derive_transcript_entries(
        &self,
        session_id: &str,
        turn_id: Option<&str>,
        transcript: &str,
    ) -> Result<Vec<TranscriptEntry>>;
}
```

It lives beside `TranscriptToolEventDeriver` at `bitloops/src/adapters/agents.rs:266`, routed through the adapter via a new `as_transcript_entry_deriver()` accessor at `agents.rs:184`. Existing per-agent tool-event derivation is untouched.

### Domain model

A host-level `TranscriptEntry` with fields `entry_id`, `session_id`, `turn_id`, `order`, `timestamp`, `actor`, `variant`, `source`, `text`, `tool_use_id`, `tool_kind`, `is_error`. Lives in `bitloops/src/host/interactions/` next to `InteractionTurn`. No GraphQL dependency.

### Per-agent implementation

Six agents are registered in `bitloops/src/adapters/agents/adapters/builtin.rs`. All six need a `TranscriptEntryDeriver`. Existing coverage varies a lot.

| Agent    | Module                        | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude   | `claude_code/transcript/`     | `TranscriptToolEventDeriver` exists. Thinking-block handling is new.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Codex    | `codex/transcript.rs`         | Tool-event deriver exists for `response_item` function calls and `event_msg`/`exec_command_end`. User and assistant message mapping (`user_message`, `agent_message`) is **net-new** code.                                                                                                                                                                                                                                                                                                                                                                                                                |
| OpenCode | `open_code/transcript.rs`     | Tool-event deriver exists. Top-level `role=user`/`role=assistant` and `parts` entries already understood.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Copilot  | `copilot/transcript.rs`       | **No `TranscriptToolEventDeriver` impl today.** Entry deriver is first transcript-to-event code for Copilot. Event constants: `user.message`, `assistant.message`, `tool.execution_complete`. No separate tool-request event.                                                                                                                                                                                                                                                                                                                                                                             |
| Gemini   | `gemini/transcript.rs`        | **No `TranscriptToolEventDeriver` impl today**, but a full parsed model exists (`GeminiTranscript { messages: Vec<GeminiMessage> }`). Note: format is a JSON document `{"messages": [...]}`, not JSONL like the others. `type: "user"` / `type: "gemini"`, content is a string or `[{text}]` parts, `toolCalls` lives on assistant messages. No separate tool-result event — `TOOL_RESULT` entries must be synthesized from the tool call's terminal `status`.                                                                                                                                            |
| Cursor   | (wraps host-level extractors) | **No transcript parser exists**, but the host already runs `extract_prompts_from_transcript_bytes` and `extract_summary_from_transcript_bytes` (`host/checkpoints/transcript/metadata.rs:176-224`) over Cursor's bytes via three role-schema probes. The Cursor `TranscriptEntryDeriver` wraps those extractors: user content → `USER/CHAT`, assistant content → `ASSISTANT/CHAT`. No new parser. Tool calls and tool results are **not** surfaced in V1 — Cursor's on-disk format is undocumented and no team-owned fixtures exist. Conversational parity with other agents; tool-trace parity deferred. |

### Session transcript: source of truth

For `interactionSession`, derive `session_transcript_entries` from the full session transcript file.

Fallback order:

1. Read the full transcript at `SessionMetadataSnapshot.transcript_path` (`bitloops/src/host/runtime_store/types.rs:176`) and run the adapter's `TranscriptEntryDeriver` over it.
2. If the file is unavailable, concatenate `InteractionTurn.transcript_fragment` slices in turn order and run the deriver over the result. Fragments stay internal; the dashboard never receives them.
3. If neither is available, return an empty list and rely on per-turn prompt fallback.

### Turn segmentation

Prefer offset-based segmentation. `InteractionTurn` already carries `transcript_offset_start` and `transcript_offset_end` (`bitloops/src/host/interactions/types.rs:71-73`). Slice the canonical entry list using those offsets. Deterministic, no edge cases.

When offsets are missing (older recordings, or an agent that does not record them), fall back to content-based segmentation:

- Sort turns by `turn_number`, then `started_at`, then `turn_id`.
- Partition entries into segments starting at each `USER/CHAT` boundary.
- Pre-first-user noise prepends to the first turn segment.
- Segment count equal to turn count: assign by index.
- Fewer segments than turns: assign by index, synthesize `PROMPT_FALLBACK` for the rest.
- More segments than turns: assign by index, merge overflow into the last turn.

Any turn that still receives zero entries gets one `USER/CHAT` entry synthesized from `turn.prompt` with `source = PROMPT_FALLBACK`.

### Checkpoint detail

In `bitloops/src/api/dashboard_service/checkpoint.rs:114`, after reading `content.transcript` into `transcript_jsonl`, run the same adapter's `TranscriptEntryDeriver` and populate `transcript_entries`. `transcript_jsonl` stays in the response for debug and export.

## Frontend changes

This is a deletion-heavy migration.

### Render canonical fields

- **Turns tab** (`turns-timeline.tsx`) renders `turn.transcriptEntries`.
- **Tool-use tab** (`session-tool-use-list.tsx`) renders `sessionTranscriptEntries`.
- **Session sidebar** (`session-detail-sidebar.tsx`) renders the new fields. Stop calling `getTranscriptFragment` from `rawEvents.payload`.
- **Checkpoint sheet** (`checkpoint-sheet.tsx:198`) renders `activeCheckpointSession.transcriptEntries`. Stop parsing `transcript_jsonl`.

### Delete

After parity is confirmed in tests:

- `src/features/dashboard/utils/turn-transcript.ts` (parser and prompt fallback)
- The Claude-shaped parser in `src/features/dashboard/components/checkpoint-sheet-utils.ts` (`parseTranscriptEntries`, `readToolUseId`, related helpers)
- The transcript-fragment lookup path; `rawEvents` stays only for debug

### Reuse

The existing tool call/result pairing in `src/features/dashboard/utils/session-tool-use-display.ts:67-114` (`groupTranscriptToolTraces`) keeps working as-is. It already pairs by `toolUseId` first and falls back to positional. Once entries arrive pre-normalized with stable `toolUseId`s, the positional fallback should fire less, but the join code itself does not change.

The prompt-fallback synthesis in `turn-transcript.ts:87-104` deletes. The backend now does this and the entry carries `source = PROMPT_FALLBACK`.

## Migration order

1. Land `TranscriptEntryDeriver` trait, domain model, and all four agent impls. No consumer yet.
2. Add canonical fields to GraphQL schema and REST DTO. Backend tests pass.
3. Ship dashboard reading the new fields, falling back to existing parsers when the field is empty. Dual-read period.
4. Confirm parity on representative sessions across all four agents.
5. Delete frontend parsers and the fallback. `rawEvents` and `transcript_jsonl` stay.

## Test plan

### Backend unit

- Per-agent transcript normalization:
  - Claude, including thinking blocks (new in entry deriver).
  - Codex, including user and assistant messages (new).
  - OpenCode.
  - Copilot (entire path new; no prior tool-event deriver).
  - Gemini, including string-vs-parts content normalization and synthesized `TOOL_RESULT` entries from terminal tool-call status. Note JSON-document input shape, not JSONL.
  - Cursor: deriver wraps existing host-level extractors and emits `USER/CHAT` and `ASSISTANT/CHAT` only. Tool traces are intentionally absent in V1.
- Offset-based turn segmentation with valid offsets.
- Content-based segmentation: segment count equal to, less than, and greater than turn count.
- Prompt fallback when transcript data is missing entirely.
- Session-transcript fallback chain: file present, file missing with fragments, both missing.

### Backend integration

- `interactionSession` returns `sessionTranscriptEntries` and `turns[*].transcriptEntries`.
- Checkpoint REST endpoint returns `transcript_entries`.
- `toolUseId` survives normalization and pairs correctly across all four agents.

### Frontend

- Turns tab renders normalized entries for every in-scope agent (Claude, Codex, OpenCode, Copilot, Gemini, and Cursor if in scope).
- Tool-use tab pairs tool call and result rows correctly using canonical `toolUseId`, including Gemini's synthesized results.
- Checkpoint detail renders canonical entries without parsing JSONL.
- Codex sessions no longer fall back to prompt-only when transcript exists.
- OpenCode, Copilot, and Gemini sessions render non-empty transcripts.
- Cursor sessions render canonical `USER/CHAT` and `ASSISTANT/CHAT` entries from the existing host-level extractors. Tool-use tab is empty for Cursor sessions (expected V1 limitation, not a regression).

## Non-goals

- Replacing raw transcript storage.
- Removing `rawEvents` or `transcript_jsonl`.
- Changing checkpoint capture semantics.
- Reworking token usage aggregation.

## Assumptions

- `bitloops` remains the single source of truth for transcript semantics.
- Agent-specific transcript differences are absorbed in agent adapters, not in the dashboard.
- `toolUseId` is the canonical join key for tool call and result rendering; positional pairing is fallback only.
- Display-ready text in `TranscriptEntry.text` is sufficient for the dashboard. Reconstructing raw structured tool payloads is out of scope for this change.

## Open questions

- **Gemini tool-result synthesis.** Gemini does not emit separate tool-result events; only `status` on the call. The deriver will need to synthesize `TOOL_RESULT` entries from terminal status. Acceptable display text format needs design review — likely `Tool completed` / `Tool failed` plus any error message attached to the call.
- Should `transcript_jsonl` eventually move behind a debug flag, or stay always-on for export? Not blocking this work; flag for a follow-up.
- For Copilot, Gemini, and (eventually) Cursor, since none have a current `TranscriptToolEventDeriver`, should we backfill that trait too, or only implement `TranscriptEntryDeriver`? Either is fine, but doing both reduces drift.

## Follow-up work (not blocking V1)

- **Cursor tool-trace parity.** Capture real Cursor session transcripts, document the on-disk schema, and extend the Cursor `TranscriptEntryDeriver` to emit `TOOL_USE` / `TOOL_RESULT` entries. Until this lands, Cursor's Tool-use tab is empty by design.
- **Hook-derived tool events.** Some agents (notably Cursor with `before-shell-execution` / `after-shell-execution`) emit tool activity as separate hook events rather than transcript content. Normalizing those into the canonical entry stream — or into a sibling event stream — is a separate orthogonal track and out of scope here.
