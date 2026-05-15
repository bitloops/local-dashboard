import type { DashboardTranscriptEntryDto } from '@/features/dashboard/api-types'
import { describe, expect, it } from 'vitest'
import { transcriptEntriesToMessages } from './transcript-entries'

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

describe('transcriptEntriesToMessages', () => {
  it('sorts by order then entry_id when the API returns rows out of sequence', () => {
    const messages = transcriptEntriesToMessages([
      makeEntry({ entry_id: 'b', order: 1, text: 'second' }),
      makeEntry({ entry_id: 'a', order: 0, text: 'first' }),
      makeEntry({ entry_id: 'c', order: 2, text: 'third' }),
    ])
    expect(messages.map((m) => m.text)).toEqual(['first', 'second', 'third'])
  })

  it('uses entry_id as a stable tie-breaker when order matches', () => {
    const messages = transcriptEntriesToMessages([
      makeEntry({ entry_id: 'z-same', order: 0, text: 'z' }),
      makeEntry({ entry_id: 'a-same', order: 0, text: 'a' }),
    ])
    expect(messages.map((m) => m.text)).toEqual(['a', 'z'])
  })

  it('maps USER actor to the "user" renderer actor', () => {
    const messages = transcriptEntriesToMessages([
      makeEntry({ entry_id: 'u', order: 0, text: 'hello', actor: 'USER' }),
    ])
    expect(messages[0]!.actor).toBe('user')
  })

  it('maps ASSISTANT and SYSTEM actors to the "assistant" renderer actor', () => {
    // The renderer-side `TranscriptMessage` shape only has two actor values
    // (user / assistant). Anything that isn't USER is folded into assistant
    // so SYSTEM tool entries still render on the assistant side.
    const messages = transcriptEntriesToMessages([
      makeEntry({
        entry_id: 'a',
        order: 0,
        text: 'answer',
        actor: 'ASSISTANT',
      }),
      makeEntry({
        entry_id: 's',
        order: 1,
        text: 'system',
        actor: 'SYSTEM',
      }),
    ])
    expect(messages.map((m) => m.actor)).toEqual(['assistant', 'assistant'])
  })

  it('maps each canonical variant to its lowercase renderer counterpart', () => {
    const messages = transcriptEntriesToMessages([
      makeEntry({ entry_id: 'c', order: 0, text: 't', variant: 'CHAT' }),
      makeEntry({
        entry_id: 't',
        order: 1,
        text: 't',
        variant: 'THINKING',
        actor: 'ASSISTANT',
      }),
      makeEntry({
        entry_id: 'tu',
        order: 2,
        text: 't',
        variant: 'TOOL_USE',
        actor: 'SYSTEM',
        tool_use_id: 'tu-1',
      }),
      makeEntry({
        entry_id: 'tr',
        order: 3,
        text: 't',
        variant: 'TOOL_RESULT',
        actor: 'SYSTEM',
        tool_use_id: 'tu-1',
      }),
    ])
    expect(messages.map((m) => m.variant)).toEqual([
      'chat',
      'thinking',
      'tool_use',
      'tool_result',
    ])
  })

  it('propagates is_error and tool_use_id from TOOL_RESULT entries', () => {
    // Errored tool results need their is_error flag preserved so the
    // ChatTranscript can style them differently, and tool_use_id needs to
    // carry through so the result can be linked back to its matching call.
    const messages = transcriptEntriesToMessages([
      makeEntry({
        entry_id: 'tu',
        order: 0,
        text: 'Tool: read_file',
        variant: 'TOOL_USE',
        actor: 'SYSTEM',
        tool_use_id: 'tu-1',
        tool_kind: 'read_file',
      }),
      makeEntry({
        entry_id: 'tr',
        order: 1,
        text: 'File not found',
        variant: 'TOOL_RESULT',
        actor: 'SYSTEM',
        tool_use_id: 'tu-1',
        tool_kind: 'read_file',
        is_error: true,
      }),
    ])
    expect(messages[0]!.toolUseId).toBe('tu-1')
    expect(messages[0]!.isError).toBeUndefined()
    expect(messages[1]!.toolUseId).toBe('tu-1')
    expect(messages[1]!.isError).toBe(true)
  })

  it('uses an empty string when timestamp is null on the entry', () => {
    // Renderer-side `timestamp` is a string; null timestamps must map to ''
    // rather than leaking null through to the renderer.
    const messages = transcriptEntriesToMessages([
      makeEntry({
        entry_id: 'no-ts',
        order: 0,
        text: 'no timestamp',
        timestamp: null,
      }),
    ])
    expect(messages[0]!.timestamp).toBe('')
  })
})
