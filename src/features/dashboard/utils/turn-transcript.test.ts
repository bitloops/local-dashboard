import type {
  DashboardInteractionTurnDto,
  DashboardTranscriptEntryDto,
} from '@/features/dashboard/api-types'
import { describe, expect, it } from 'vitest'
import {
  buildSessionTranscriptAnalysis,
  buildTranscriptSectionsForTurns,
} from './turn-transcript'

function makeTurn(
  overrides: Partial<DashboardInteractionTurnDto> & {
    turn_id: string
    turn_number: number
  },
): DashboardInteractionTurnDto {
  const { turn_id, turn_number, ...rest } = overrides
  return {
    turn_id,
    session_id: 's1',
    turn_number,
    branch: null,
    actor: null,
    prompt: null,
    summary: null,
    agent_type: 'agent',
    model: null,
    started_at: '2026-01-01T00:00:00Z',
    ended_at: null,
    token_usage: null,
    files_modified: [],
    checkpoint_id: null,
    tool_uses: [],
    transcript_entries: [],
    ...rest,
  }
}

function makeEntry(
  overrides: Partial<DashboardTranscriptEntryDto> & {
    entry_id: string
    order: number
    text: string
  },
): DashboardTranscriptEntryDto {
  return {
    session_id: 's1',
    turn_id: null,
    timestamp: null,
    actor: 'USER',
    variant: 'CHAT',
    source: 'TRANSCRIPT',
    tool_use_id: null,
    tool_kind: null,
    is_error: false,
    ...overrides,
  }
}

describe('buildSessionTranscriptAnalysis', () => {
  it('uses per-turn transcript_entries when provided', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        transcript_entries: [
          makeEntry({
            entry_id: 'e1',
            order: 0,
            turn_id: 'turn-a',
            actor: 'USER',
            text: 'first prompt',
          }),
          makeEntry({
            entry_id: 'e2',
            order: 1,
            turn_id: 'turn-a',
            actor: 'ASSISTANT',
            text: 'answer one',
          }),
        ],
      }),
      makeTurn({
        turn_id: 'turn-b',
        turn_number: 2,
        transcript_entries: [
          makeEntry({
            entry_id: 'e3',
            order: 0,
            turn_id: 'turn-b',
            actor: 'USER',
            text: 'second prompt',
          }),
        ],
      }),
    ]

    const result = buildSessionTranscriptAnalysis(turns)

    expect(result.sections).toHaveLength(2)
    expect(result.sections[0]!.turn.turn_id).toBe('turn-a')
    expect(result.sections[0]!.entries.map((m) => m.text)).toEqual([
      'first prompt',
      'answer one',
    ])
    expect(result.sections[1]!.entries.map((m) => m.text)).toEqual([
      'second prompt',
    ])
  })

  it('filters session entries by turn_id when per-turn is empty', () => {
    const turns = [
      makeTurn({ turn_id: 'turn-a', turn_number: 1 }),
      makeTurn({ turn_id: 'turn-b', turn_number: 2 }),
    ]
    const sessionEntries: DashboardTranscriptEntryDto[] = [
      makeEntry({
        entry_id: 's1',
        order: 0,
        turn_id: 'turn-a',
        text: 'session entry for a',
      }),
      makeEntry({
        entry_id: 's2',
        order: 1,
        turn_id: 'turn-b',
        text: 'session entry for b',
      }),
    ]

    const result = buildSessionTranscriptAnalysis(turns, sessionEntries)

    expect(result.sections[0]!.entries.map((m) => m.text)).toEqual([
      'session entry for a',
    ])
    expect(result.sections[1]!.entries.map((m) => m.text)).toEqual([
      'session entry for b',
    ])
  })

  it('returns the converted session stream as sessionEntries when provided', () => {
    const turns = [makeTurn({ turn_id: 'turn-a', turn_number: 1 })]
    const sessionEntries: DashboardTranscriptEntryDto[] = [
      makeEntry({
        entry_id: 's1',
        order: 0,
        turn_id: 'turn-a',
        text: 'hello',
      }),
      makeEntry({
        entry_id: 's2',
        order: 1,
        turn_id: null,
        actor: 'SYSTEM',
        variant: 'CHAT',
        text: 'preamble',
      }),
    ]

    const result = buildSessionTranscriptAnalysis(turns, sessionEntries)

    expect(result.sessionEntries.map((m) => m.text)).toEqual([
      'hello',
      'preamble',
    ])
  })

  it('sorts turns by turn_number before building sections', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-b',
        turn_number: 2,
        transcript_entries: [
          makeEntry({ entry_id: 'b1', order: 0, text: 'second' }),
        ],
      }),
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        transcript_entries: [
          makeEntry({ entry_id: 'a1', order: 0, text: 'first' }),
        ],
      }),
    ]

    const result = buildSessionTranscriptAnalysis(turns)
    expect(result.sections.map((s) => s.turn.turn_id)).toEqual([
      'turn-a',
      'turn-b',
    ])
  })

  it('returns empty entries for turns without canonical data', () => {
    const turns = [makeTurn({ turn_id: 'turn-a', turn_number: 1 })]
    const result = buildSessionTranscriptAnalysis(turns)
    expect(result.sections[0]!.entries).toEqual([])
    expect(result.sessionEntries).toEqual([])
  })

  it('maps SYSTEM actor to assistant in the legacy renderer shape', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        transcript_entries: [
          makeEntry({
            entry_id: 't1',
            order: 0,
            actor: 'SYSTEM',
            variant: 'TOOL_USE',
            tool_use_id: 'call_1',
            tool_kind: 'bash',
            text: 'Tool: bash',
          }),
        ],
      }),
    ]

    const result = buildSessionTranscriptAnalysis(turns)
    expect(result.sections[0]!.entries[0]!.actor).toBe('assistant')
    expect(result.sections[0]!.entries[0]!.variant).toBe('tool_use')
    expect(result.sections[0]!.entries[0]!.toolUseId).toBe('call_1')
  })
})

describe('buildTranscriptSectionsForTurns', () => {
  it('delegates to buildSessionTranscriptAnalysis and returns sections', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        transcript_entries: [
          makeEntry({ entry_id: 'e1', order: 0, text: 'hello' }),
        ],
      }),
    ]
    const sections = buildTranscriptSectionsForTurns(turns)
    expect(sections).toHaveLength(1)
    expect(sections[0]!.entries[0]!.text).toBe('hello')
  })
})
