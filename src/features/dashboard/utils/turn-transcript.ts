import type {
  DashboardInteractionEventDto,
  DashboardInteractionTurnDto,
} from '@/features/dashboard/api-types'
import {
  parseTranscriptEntries,
  type TranscriptMessage,
} from '@/features/dashboard/components/checkpoint-sheet-utils'

function getTurnEndPayload(
  rawEvents: DashboardInteractionEventDto[],
  turnId: string,
): Record<string, unknown> | null {
  const latest = rawEvents
    .filter((e) => e.turn_id === turnId && e.event_type === 'turn_end')
    .sort((a, b) => (a.event_time || '').localeCompare(b.event_time || ''))
    .at(-1)
  return (latest?.payload as Record<string, unknown> | null | undefined) ?? null
}

/** Parsed transcript lines from the latest turn_end payload for this turn_id (may be cumulative). */
export function getTurnTranscriptEntries(
  rawEvents: DashboardInteractionEventDto[],
  turn: Pick<DashboardInteractionTurnDto, 'turn_id'>,
): TranscriptMessage[] {
  const payload = getTurnEndPayload(rawEvents, turn.turn_id)
  const fragment =
    (payload?.transcript_fragment as string | undefined) ??
    (payload?.transcriptFragment as string | undefined) ??
    ''
  return fragment ? parseTranscriptEntries(fragment) : []
}

/**
 * Prefer the longest parsed fragment among turns — Bitloops often stores a cumulative transcript
 * on each turn_end; the longest snapshot is usually the full session transcript.
 */
export function getSessionTranscriptEntriesBestEffort(
  rawEvents: DashboardInteractionEventDto[],
  turns: DashboardInteractionTurnDto[],
): TranscriptMessage[] {
  let best: TranscriptMessage[] = []
  for (const turn of turns) {
    const entries = getTurnTranscriptEntries(rawEvents, turn)
    if (entries.length > best.length) {
      best = entries
    }
  }
  return best
}

/**
 * One "turn" = one user prompt and everything until the next user message (assistant/tool/etc.).
 */
export function partitionTranscriptEntriesByUserPrompt(
  entries: TranscriptMessage[],
): TranscriptMessage[][] {
  const userStarts: number[] = []
  for (let i = 0; i < entries.length; i++) {
    if (entries[i]!.actor === 'user') {
      userStarts.push(i)
    }
  }

  if (userStarts.length === 0) {
    return entries.length > 0 ? [entries] : []
  }

  const segments: TranscriptMessage[][] = []
  for (let s = 0; s < userStarts.length; s++) {
    const start = userStarts[s]!
    const end = s + 1 < userStarts.length ? userStarts[s + 1]! : entries.length
    segments.push(entries.slice(start, end))
  }
  return segments
}

/**
 * Transcript rows for the Turns timeline: zip user-prompt segments to turns ordered by turn_number.
 * When backend sends the same cumulative blob on every turn_end, we still derive one slice per round.
 */
export function buildTranscriptSectionsForTurns(
  rawEvents: DashboardInteractionEventDto[],
  turns: DashboardInteractionTurnDto[],
): Array<{ turn: DashboardInteractionTurnDto; entries: TranscriptMessage[] }> {
  const sorted = [...turns].sort((a, b) => a.turn_number - b.turn_number)
  const pool = getSessionTranscriptEntriesBestEffort(rawEvents, sorted)
  const segments = partitionTranscriptEntriesByUserPrompt(pool)

  return sorted.map((turn, idx) => ({
    turn,
    entries: idx < segments.length ? segments[idx]! : [],
  }))
}
