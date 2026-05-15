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
})
