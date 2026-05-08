import type {
  DashboardInteractionEventDto,
  DashboardInteractionTurnDto,
} from '@/features/dashboard/api-types'
import { parseTranscriptEntries } from '@/features/dashboard/components/checkpoint-sheet-utils'
import { describe, expect, it } from 'vitest'
import {
  buildTranscriptSectionsForTurns,
  getTurnTranscriptEntries,
  partitionTranscriptEntriesByUserPrompt,
} from './turn-transcript'

function userLine(text: string, uuid: string, timestamp: string) {
  return JSON.stringify({
    type: 'user',
    timestamp,
    uuid,
    message: { content: text },
  })
}

function assistantTextLine(text: string, uuid: string, timestamp: string) {
  return JSON.stringify({
    type: 'assistant',
    timestamp,
    uuid,
    message: {
      content: [{ type: 'text', text }],
    },
  })
}

function makeTurn(
  overrides: Partial<DashboardInteractionTurnDto> & {
    turn_id: string
    session_id?: string
    turn_number: number
  },
): DashboardInteractionTurnDto {
  const { turn_id, session_id, turn_number, ...rest } = overrides

  return {
    turn_id,
    session_id: session_id ?? 's1',
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
    ...rest,
  }
}

function makeTurnEndEvent(
  turnId: string,
  eventId: string,
  transcriptFragment: string,
): DashboardInteractionEventDto {
  return {
    event_id: eventId,
    session_id: 's1',
    turn_id: turnId,
    event_type: 'turn_end',
    event_time: '2026-01-01T00:00:05Z',
    agent_type: 'a',
    model: null,
    tool_use_id: null,
    tool_kind: null,
    task_description: null,
    subagent_id: null,
    payload: { transcript_fragment: transcriptFragment },
  }
}

describe('getTurnTranscriptEntries', () => {
  it('uses the latest turn_end transcript fragment', () => {
    const rawEvents: DashboardInteractionEventDto[] = [
      {
        event_id: 'e1',
        session_id: 's1',
        turn_id: 't1',
        event_type: 'turn_end',
        event_time: '2026-01-01T00:00:00Z',
        agent_type: 'a',
        model: null,
        tool_use_id: null,
        tool_kind: null,
        task_description: null,
        subagent_id: null,
        payload: { transcript_fragment: JSON.stringify({ bad: true }) },
      },
      {
        event_id: 'e2',
        session_id: 's1',
        turn_id: 't1',
        event_type: 'turn_end',
        event_time: '2026-01-01T00:00:01Z',
        agent_type: 'a',
        model: null,
        tool_use_id: null,
        tool_kind: null,
        task_description: null,
        subagent_id: null,
        payload: {
          transcript_fragment: [
            JSON.stringify({
              type: 'user',
              timestamp: '2026-01-01T00:00:00Z',
              uuid: 'u1',
              message: { content: 'hi' },
            }),
          ].join('\n'),
        },
      },
    ]

    const entries = getTurnTranscriptEntries(rawEvents, {
      turn_id: 't1',
    })
    expect(entries).toHaveLength(1)
    expect(entries[0]!.actor).toBe('user')
    expect(entries[0]!.text).toContain('hi')
  })
})

describe('partitionTranscriptEntriesByUserPrompt', () => {
  it('splits on each user message', () => {
    const poolJsonl = [
      userLine('first', 'u1', '2026-01-01T00:00:01Z'),
      assistantTextLine('r1', 'a1', '2026-01-01T00:00:02Z'),
      userLine('second', 'u2', '2026-01-01T00:00:03Z'),
      assistantTextLine('r2', 'a2', '2026-01-01T00:00:04Z'),
    ].join('\n')

    const entries = parseTranscriptEntries(poolJsonl)
    const segments = partitionTranscriptEntriesByUserPrompt(entries)
    expect(segments).toHaveLength(2)
    expect(segments[0]!.some((m) => m.text.includes('first'))).toBe(true)
    expect(segments[0]!.some((m) => m.text.includes('r1'))).toBe(true)
    expect(segments[1]!.some((m) => m.text.includes('second'))).toBe(true)
    expect(segments[1]!.some((m) => m.text.includes('r2'))).toBe(true)
  })
})

describe('buildTranscriptSectionsForTurns', () => {
  it('maps cumulative fragment to one slice per turn', () => {
    const cumulative = [
      userLine('first prompt', 'u1', '2026-01-01T00:00:01Z'),
      assistantTextLine('answer one', 'a1', '2026-01-01T00:00:02Z'),
      userLine('second prompt', 'u2', '2026-01-01T00:00:03Z'),
      assistantTextLine('answer two', 'a2', '2026-01-01T00:00:04Z'),
    ].join('\n')

    const turns: DashboardInteractionTurnDto[] = [
      {
        turn_id: 'turn-a',
        session_id: 's1',
        turn_number: 1,
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
      },
      {
        turn_id: 'turn-b',
        session_id: 's1',
        turn_number: 2,
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
      },
    ]

    const rawEvents: DashboardInteractionEventDto[] = [
      {
        event_id: 'e1',
        session_id: 's1',
        turn_id: 'turn-a',
        event_type: 'turn_end',
        event_time: '2026-01-01T00:00:05Z',
        agent_type: 'a',
        model: null,
        tool_use_id: null,
        tool_kind: null,
        task_description: null,
        subagent_id: null,
        payload: { transcript_fragment: cumulative },
      },
      {
        event_id: 'e2',
        session_id: 's1',
        turn_id: 'turn-b',
        event_type: 'turn_end',
        event_time: '2026-01-01T00:00:06Z',
        agent_type: 'a',
        model: null,
        tool_use_id: null,
        tool_kind: null,
        task_description: null,
        subagent_id: null,
        payload: { transcript_fragment: cumulative },
      },
    ]

    const sections = buildTranscriptSectionsForTurns(rawEvents, turns)
    expect(sections).toHaveLength(2)
    const t1 = sections.find((s) => s.turn.turn_id === 'turn-a')!
    const t2 = sections.find((s) => s.turn.turn_id === 'turn-b')!
    expect(t1.entries.some((m) => m.text.includes('first'))).toBe(true)
    expect(t1.entries.some((m) => m.text.includes('answer one'))).toBe(true)
    expect(t1.entries.some((m) => m.text.includes('second'))).toBe(false)
    expect(t2.entries.some((m) => m.text.includes('second'))).toBe(true)
    expect(t2.entries.some((m) => m.text.includes('answer two'))).toBe(true)
    expect(t2.entries.some((m) => m.text.includes('first'))).toBe(false)
  })

  it('falls back to the formatted turn prompt when no usable transcript exists', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        prompt: '  <user_query>\nshow my turn\n</user_query>  ',
      }),
    ]

    const sections = buildTranscriptSectionsForTurns([], turns)

    expect(sections).toHaveLength(1)
    expect(sections[0]!.entries).toEqual([
      expect.objectContaining({
        id: 'prompt-turn-a',
        timestamp: '2026-01-01T00:00:00Z',
        actor: 'user',
        variant: 'chat',
        text: 'show my turn',
      }),
    ])
  })

  it('falls back to the turn prompt when the cumulative transcript covers only earlier turns', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        prompt: 'first prompt fallback',
      }),
      makeTurn({
        turn_id: 'turn-b',
        turn_number: 2,
        prompt: 'second prompt fallback',
      }),
    ]

    const rawEvents = [
      makeTurnEndEvent(
        'turn-a',
        'e1',
        [
          userLine('first real prompt', 'u1', '2026-01-01T00:00:01Z'),
          assistantTextLine('answer one', 'a1', '2026-01-01T00:00:02Z'),
          assistantTextLine('answer one extra', 'a1b', '2026-01-01T00:00:02Z'),
          assistantTextLine(
            'answer one extra two',
            'a1c',
            '2026-01-01T00:00:02Z',
          ),
        ].join('\n'),
      ),
    ]

    const sections = buildTranscriptSectionsForTurns(rawEvents, turns)

    expect(
      sections[0]!.entries.some((m) => m.text.includes('first real prompt')),
    ).toBe(true)
    expect(sections[1]!.entries).toEqual([
      expect.objectContaining({
        id: 'prompt-turn-b',
        text: 'second prompt fallback',
      }),
    ])
  })

  it('uses a turn-specific fragment when it contains exactly one user segment', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        prompt: 'first prompt fallback',
      }),
      makeTurn({
        turn_id: 'turn-b',
        turn_number: 2,
        prompt: 'second prompt fallback',
      }),
    ]

    const rawEvents = [
      makeTurnEndEvent(
        'turn-a',
        'e1',
        [
          userLine('first real prompt', 'u1', '2026-01-01T00:00:01Z'),
          assistantTextLine('answer one', 'a1', '2026-01-01T00:00:02Z'),
          assistantTextLine('answer one extra', 'a1b', '2026-01-01T00:00:02Z'),
          assistantTextLine(
            'answer one extra two',
            'a1c',
            '2026-01-01T00:00:02Z',
          ),
        ].join('\n'),
      ),
      makeTurnEndEvent(
        'turn-b',
        'e2',
        [
          userLine('second real prompt', 'u2', '2026-01-01T00:00:03Z'),
          assistantTextLine('answer two', 'a2', '2026-01-01T00:00:04Z'),
        ].join('\n'),
      ),
    ]

    const sections = buildTranscriptSectionsForTurns(rawEvents, turns)

    expect(
      sections[1]!.entries.some((m) => m.text.includes('second real prompt')),
    ).toBe(true)
    expect(
      sections[1]!.entries.some((m) =>
        m.text.includes('second prompt fallback'),
      ),
    ).toBe(false)
  })

  it('ignores ambiguous turn-specific fragments and falls back to the prompt', () => {
    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        prompt: 'first prompt fallback',
      }),
      makeTurn({
        turn_id: 'turn-b',
        turn_number: 2,
        prompt: 'second prompt fallback',
      }),
    ]

    const rawEvents = [
      makeTurnEndEvent(
        'turn-a',
        'e1',
        [
          userLine('first real prompt', 'u1', '2026-01-01T00:00:01Z'),
          assistantTextLine('answer one', 'a1', '2026-01-01T00:00:02Z'),
          assistantTextLine('answer one extra', 'a1b', '2026-01-01T00:00:02Z'),
          assistantTextLine(
            'answer one extra two',
            'a1c',
            '2026-01-01T00:00:02Z',
          ),
        ].join('\n'),
      ),
      makeTurnEndEvent(
        'turn-b',
        'e2',
        [
          userLine('ambiguous one', 'u2', '2026-01-01T00:00:03Z'),
          assistantTextLine('answer two', 'a2', '2026-01-01T00:00:04Z'),
          userLine('ambiguous two', 'u3', '2026-01-01T00:00:05Z'),
        ].join('\n'),
      ),
    ]

    const sections = buildTranscriptSectionsForTurns(rawEvents, turns)

    expect(sections[1]!.entries).toEqual([
      expect.objectContaining({
        id: 'prompt-turn-b',
        text: 'second prompt fallback',
      }),
    ])
  })

  it('prefers real cumulative transcript slices over the prompt fallback', () => {
    const cumulative = [
      userLine('first prompt', 'u1', '2026-01-01T00:00:01Z'),
      assistantTextLine('answer one', 'a1', '2026-01-01T00:00:02Z'),
      userLine('second prompt', 'u2', '2026-01-01T00:00:03Z'),
      assistantTextLine('answer two', 'a2', '2026-01-01T00:00:04Z'),
    ].join('\n')

    const turns = [
      makeTurn({
        turn_id: 'turn-a',
        turn_number: 1,
        prompt: 'prompt fallback one',
      }),
      makeTurn({
        turn_id: 'turn-b',
        turn_number: 2,
        prompt: 'prompt fallback two',
      }),
    ]

    const rawEvents = [
      makeTurnEndEvent('turn-a', 'e1', cumulative),
      makeTurnEndEvent('turn-b', 'e2', cumulative),
    ]

    const sections = buildTranscriptSectionsForTurns(rawEvents, turns)

    expect(
      sections[0]!.entries.some((m) => m.text.includes('first prompt')),
    ).toBe(true)
    expect(
      sections[0]!.entries.some((m) => m.text.includes('prompt fallback one')),
    ).toBe(false)
    expect(
      sections[1]!.entries.some((m) => m.text.includes('second prompt')),
    ).toBe(true)
    expect(
      sections[1]!.entries.some((m) => m.text.includes('prompt fallback two')),
    ).toBe(false)
  })
})
