import type {
  DashboardInteractionEventDto,
  DashboardInteractionTurnDto,
} from '@/features/dashboard/api-types'
import {
  formatPromptForDisplay,
  parseTranscriptEntries,
  type TranscriptMessage,
} from '@/features/dashboard/components/checkpoint-sheet-utils'

export type TurnTranscriptSection = {
  turn: DashboardInteractionTurnDto
  entries: TranscriptMessage[]
}

export type SessionTranscriptAnalysis = {
  sessionEntries: TranscriptMessage[]
  sections: TurnTranscriptSection[]
}

function getTranscriptFragment(
  payload: Record<string, unknown> | null | undefined,
): string {
  return (
    (payload?.transcript_fragment as string | undefined) ??
    (payload?.transcriptFragment as string | undefined) ??
    ''
  )
}

function indexLatestTurnEndPayloads(
  rawEvents: DashboardInteractionEventDto[],
): Map<string, Record<string, unknown> | null> {
  const latestByTurnId = new Map<string, DashboardInteractionEventDto>()

  for (const event of rawEvents) {
    if (event.event_type !== 'turn_end' || !event.turn_id) {
      continue
    }

    const existing = latestByTurnId.get(event.turn_id)
    if (
      existing == null ||
      (existing.event_time || '').localeCompare(event.event_time || '') <= 0
    ) {
      latestByTurnId.set(event.turn_id, event)
    }
  }

  return new Map(
    [...latestByTurnId.entries()].map(([turnId, event]) => [
      turnId,
      (event.payload as Record<string, unknown> | null | undefined) ?? null,
    ]),
  )
}

function getCachedTurnTranscriptEntries(
  turnId: string,
  latestPayloadsByTurnId: Map<string, Record<string, unknown> | null>,
  parsedByTurnId: Map<string, TranscriptMessage[]>,
): TranscriptMessage[] {
  const cached = parsedByTurnId.get(turnId)
  if (cached) {
    return cached
  }

  const fragment = getTranscriptFragment(latestPayloadsByTurnId.get(turnId))
  const parsed = fragment ? parseTranscriptEntries(fragment) : []
  parsedByTurnId.set(turnId, parsed)
  return parsed
}

/** Parsed transcript lines from the latest turn_end payload for this turn_id (may be cumulative). */
export function getTurnTranscriptEntries(
  rawEvents: DashboardInteractionEventDto[],
  turn: Pick<DashboardInteractionTurnDto, 'turn_id'>,
): TranscriptMessage[] {
  const latestPayloadsByTurnId = indexLatestTurnEndPayloads(rawEvents)
  return getCachedTurnTranscriptEntries(
    turn.turn_id,
    latestPayloadsByTurnId,
    new Map<string, TranscriptMessage[]>(),
  )
}

function buildPromptFallbackEntries(
  turn: Pick<DashboardInteractionTurnDto, 'turn_id' | 'prompt' | 'started_at'>,
): TranscriptMessage[] {
  const text = formatPromptForDisplay(turn.prompt)
  if (!text) {
    return []
  }

  return [
    {
      id: `prompt-${turn.turn_id}`,
      timestamp: turn.started_at,
      actor: 'user',
      variant: 'chat',
      text,
    },
  ]
}

function getSingleSegmentTurnTranscriptEntries(
  latestPayloadsByTurnId: Map<string, Record<string, unknown> | null>,
  parsedByTurnId: Map<string, TranscriptMessage[]>,
  turn: Pick<DashboardInteractionTurnDto, 'turn_id'>,
): TranscriptMessage[] {
  const entries = getCachedTurnTranscriptEntries(
    turn.turn_id,
    latestPayloadsByTurnId,
    parsedByTurnId,
  )
  if (entries.length === 0) {
    return []
  }

  const segments = partitionTranscriptEntriesByUserPrompt(entries)
  return segments.length === 1 ? segments[0]! : []
}

function resolveTranscriptEntriesForTurn(
  latestPayloadsByTurnId: Map<string, Record<string, unknown> | null>,
  parsedByTurnId: Map<string, TranscriptMessage[]>,
  turn: Pick<DashboardInteractionTurnDto, 'turn_id' | 'prompt' | 'started_at'>,
  sessionSegments: TranscriptMessage[][],
  segmentIndex: number,
): TranscriptMessage[] {
  const sessionSegment =
    segmentIndex < sessionSegments.length ? sessionSegments[segmentIndex]! : []
  if (sessionSegment.length > 0) {
    return sessionSegment
  }

  const turnFragmentSegment = getSingleSegmentTurnTranscriptEntries(
    latestPayloadsByTurnId,
    parsedByTurnId,
    turn,
  )
  if (turnFragmentSegment.length > 0) {
    return turnFragmentSegment
  }

  const promptFallback = buildPromptFallbackEntries(turn)
  if (promptFallback.length > 0) {
    return promptFallback
  }

  return []
}

/**
 * Prefer the longest parsed fragment among turns — Bitloops often stores a cumulative transcript
 * on each turn_end; the longest snapshot is usually the full session transcript.
 */
export function getSessionTranscriptEntriesBestEffort(
  rawEvents: DashboardInteractionEventDto[],
  turns: DashboardInteractionTurnDto[],
): TranscriptMessage[] {
  const latestPayloadsByTurnId = indexLatestTurnEndPayloads(rawEvents)
  const parsedByTurnId = new Map<string, TranscriptMessage[]>()
  let best: TranscriptMessage[] = []
  for (const turn of turns) {
    const entries = getCachedTurnTranscriptEntries(
      turn.turn_id,
      latestPayloadsByTurnId,
      parsedByTurnId,
    )
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
): TurnTranscriptSection[] {
  return buildSessionTranscriptAnalysis(rawEvents, turns).sections
}

export function buildSessionTranscriptAnalysis(
  rawEvents: DashboardInteractionEventDto[],
  turns: DashboardInteractionTurnDto[],
): SessionTranscriptAnalysis {
  const sorted = [...turns].sort((a, b) => a.turn_number - b.turn_number)
  const latestPayloadsByTurnId = indexLatestTurnEndPayloads(rawEvents)
  const parsedByTurnId = new Map<string, TranscriptMessage[]>()

  let sessionEntries: TranscriptMessage[] = []
  for (const turn of sorted) {
    const entries = getCachedTurnTranscriptEntries(
      turn.turn_id,
      latestPayloadsByTurnId,
      parsedByTurnId,
    )
    if (entries.length > sessionEntries.length) {
      sessionEntries = entries
    }
  }

  const segments = partitionTranscriptEntriesByUserPrompt(sessionEntries)

  return {
    sessionEntries,
    sections: sorted.map((turn, idx) => ({
      turn,
      entries: resolveTranscriptEntriesForTurn(
        latestPayloadsByTurnId,
        parsedByTurnId,
        turn,
        segments,
        idx,
      ),
    })),
  }
}
