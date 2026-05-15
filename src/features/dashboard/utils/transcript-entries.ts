/**
 * Adapter between the canonical `DashboardTranscriptEntryDto` rows produced by
 * the backend and the legacy `TranscriptMessage` shape consumed by
 * `<ChatTranscript>` and friends.
 *
 * This is the dual-read seam for the transcript-normalization migration:
 *
 * 1. During migration, components prefer canonical entries from the backend
 *    when present (`turn.transcript_entries.length > 0`,
 *    `session_transcript_entries`, `checkpoint_session.transcript_entries`).
 * 2. When canonical entries are empty (older sessions, agents without a
 *    deriver, or the backend hasn't rolled out yet), components fall back to
 *    the existing JSONL parsers in `checkpoint-sheet-utils.ts` and
 *    `turn-transcript.ts`.
 * 3. Once parity is confirmed across all six agents the legacy parsers can
 *    delete and this file becomes the only path.
 *
 * Keep this module pure and dependency-free — it should not pull in raw-event
 * parsing or any agent-specific knowledge.
 */

import type { DashboardTranscriptEntryDto } from '@/features/dashboard/api-types'
import type { TranscriptMessage } from '@/features/dashboard/components/checkpoint-sheet-utils'

/**
 * Convert a single canonical entry into the legacy `TranscriptMessage` shape.
 *
 * Mapping:
 * - `actor: 'USER'`        → `actor: 'user'`
 * - `actor: 'ASSISTANT'`   → `actor: 'assistant'`
 * - `actor: 'SYSTEM'`      → `actor: 'assistant'` (legacy renderer has no
 *                            third actor; tool_use/tool_result entries are
 *                            historically attached to the assistant column)
 * - `variant`              → lower-cased verbatim
 * - `tool_use_id`/`tool_kind`/`is_error` propagate when present.
 */
export function toTranscriptMessage(
  entry: DashboardTranscriptEntryDto,
): TranscriptMessage {
  return {
    id: entry.entry_id,
    timestamp: entry.timestamp ?? '',
    actor: entry.actor === 'USER' ? 'user' : 'assistant',
    variant:
      entry.variant === 'CHAT'
        ? 'chat'
        : entry.variant === 'THINKING'
          ? 'thinking'
          : entry.variant === 'TOOL_USE'
            ? 'tool_use'
            : 'tool_result',
    text: entry.text,
    isError: entry.is_error || undefined,
    toolUseId: entry.tool_use_id ?? undefined,
  }
}

function compareTranscriptEntriesByStreamOrder(
  a: DashboardTranscriptEntryDto,
  b: DashboardTranscriptEntryDto,
): number {
  if (a.order !== b.order) {
    return a.order - b.order
  }
  return a.entry_id.localeCompare(b.entry_id)
}

/**
 * Convert a list of canonical entries to legacy messages.
 *
 * Entries are sorted by ascending `order`, then `entry_id`, so rendering stays
 * correct if the API returns rows out of sequence.
 *
 * Returns an empty array for empty input so callers can use length-based
 * branching for dual-read:
 *
 * ```ts
 * const messages = turn.transcript_entries.length > 0
 *   ? transcriptEntriesToMessages(turn.transcript_entries)
 *   : legacyParser(turn, rawEvents)
 * ```
 */
export function transcriptEntriesToMessages(
  entries: ReadonlyArray<DashboardTranscriptEntryDto>,
): TranscriptMessage[] {
  return [...entries]
    .sort(compareTranscriptEntriesByStreamOrder)
    .map(toTranscriptMessage)
}

/**
 * Filter canonical entries to those belonging to a specific turn.
 *
 * The backend already provides per-turn entries on
 * `DashboardInteractionTurnDto.transcript_entries`, but this helper is useful
 * when working with the session-wide `session_transcript_entries` stream and
 * needing a per-turn slice (e.g., a future "all entries, including pre-first-
 * user system content" rendering mode).
 */
export function filterEntriesForTurn(
  entries: ReadonlyArray<DashboardTranscriptEntryDto>,
  turnId: string,
): DashboardTranscriptEntryDto[] {
  return entries.filter((entry) => entry.turn_id === turnId)
}

/**
 * Helper for the most common dual-read pattern: prefer canonical, fall back
 * to a legacy producer.
 *
 * Components can write:
 *
 * ```ts
 * const messages = preferCanonical(
 *   turn.transcript_entries,
 *   () => buildLegacyMessagesForTurn(turn, rawEvents),
 * )
 * ```
 *
 * The fallback is invoked lazily, so callers don't pay the cost of legacy
 * parsing when canonical entries are present.
 */
export function preferCanonical(
  canonical: ReadonlyArray<DashboardTranscriptEntryDto>,
  legacyFallback: () => TranscriptMessage[],
): TranscriptMessage[] {
  if (canonical.length > 0) {
    return transcriptEntriesToMessages(canonical)
  }
  return legacyFallback()
}
