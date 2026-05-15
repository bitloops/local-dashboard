import type {
  DashboardInteractionTurnDto,
  DashboardTranscriptEntryDto,
} from '@/features/dashboard/api-types'
import { type TranscriptMessage } from '@/features/dashboard/components/checkpoint-sheet-utils'
import {
  filterEntriesForTurn,
  transcriptEntriesToMessages,
} from '@/features/dashboard/utils/transcript-entries'

export type TurnTranscriptSection = {
  turn: DashboardInteractionTurnDto
  entries: TranscriptMessage[]
}

export type SessionTranscriptAnalysis = {
  sessionEntries: TranscriptMessage[]
  sections: TurnTranscriptSection[]
}

/**
 * Transcript rows for the Turns timeline: one section per turn, ordered by
 * `turn_number`. Entries come exclusively from canonical
 * `DashboardTranscriptEntryDto` rows produced by the backend.
 *
 * Prefers per-turn `transcript_entries` when present, then falls back to
 * filtering the session-wide stream by `turn_id`. Turns with no canonical
 * entries get an empty `entries` array — the Turns tab renders them with the
 * "No transcript fragment available for this turn." placeholder.
 */
export function buildTranscriptSectionsForTurns(
  turns: DashboardInteractionTurnDto[],
  sessionTranscriptEntries?: DashboardTranscriptEntryDto[],
): TurnTranscriptSection[] {
  return buildSessionTranscriptAnalysis(turns, sessionTranscriptEntries)
    .sections
}

/**
 * Group canonical transcript entries into a session-wide stream plus per-turn
 * sections.
 *
 * Resolution order for each turn's section:
 * 1. `turn.transcript_entries` when non-empty.
 * 2. Filter `sessionTranscriptEntries` by `turn_id`.
 * 3. Empty array.
 *
 * The session-wide `sessionEntries` is the converted `sessionTranscriptEntries`
 * when provided, otherwise the flattened per-turn sections.
 */
export function buildSessionTranscriptAnalysis(
  turns: DashboardInteractionTurnDto[],
  sessionTranscriptEntries?: DashboardTranscriptEntryDto[],
): SessionTranscriptAnalysis {
  const sessionEntries = sessionTranscriptEntries ?? []
  // Sort by turn_number, then started_at, then turn_id. Some agents (notably
  // Copilot) don't populate turn_number reliably, so a stable secondary key on
  // started_at keeps turns in chronological order regardless of backend row
  // order.
  const sortedTurns = [...turns].sort((a, b) => {
    if (a.turn_number !== b.turn_number) {
      return a.turn_number - b.turn_number
    }
    const startCmp = (a.started_at || '').localeCompare(b.started_at || '')
    if (startCmp !== 0) {
      return startCmp
    }
    return a.turn_id.localeCompare(b.turn_id)
  })

  const sections: TurnTranscriptSection[] = sortedTurns.map((turn) => {
    const perTurn = turn.transcript_entries ?? []
    if (perTurn.length > 0) {
      return { turn, entries: transcriptEntriesToMessages(perTurn) }
    }
    if (sessionEntries.length > 0) {
      const filtered = filterEntriesForTurn(sessionEntries, turn.turn_id)
      if (filtered.length > 0) {
        return { turn, entries: transcriptEntriesToMessages(filtered) }
      }
    }
    return { turn, entries: [] }
  })

  const sessionMessages =
    sessionEntries.length > 0
      ? transcriptEntriesToMessages(sessionEntries)
      : sections.flatMap((section) => section.entries)

  return {
    sessionEntries: sessionMessages,
    sections,
  }
}
