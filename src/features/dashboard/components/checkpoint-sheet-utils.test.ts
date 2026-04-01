import { describe, expect, it } from 'vitest'
import {
  parseTranscriptEntries,
  stripUserQueryTags,
} from './checkpoint-sheet-utils'

describe('stripUserQueryTags', () => {
  it('removes user_query tags and keeps inner spacing', () => {
    expect(stripUserQueryTags('<user_query>\nhello there\n</user_query>')).toBe(
      '\nhello there\n',
    )
  })
})

describe('parseTranscriptEntries', () => {
  it('parses cursor-style role/content transcript lines', () => {
    const jsonl = [
      JSON.stringify({
        role: 'user',
        message: {
          content: [
            {
              type: 'text',
              text: '<user_query>\nshow me dashboard data\n</user_query>',
            },
          ],
        },
      }),
      JSON.stringify({
        role: 'assistant',
        message: {
          content: [
            {
              type: 'text',
              text: 'Fetching dashboard data now.',
            },
          ],
        },
      }),
    ].join('\n')

    expect(parseTranscriptEntries(jsonl)).toEqual([
      {
        id: 'msg-0-0',
        timestamp: '',
        actor: 'user',
        variant: 'chat',
        text: '\nshow me dashboard data\n',
      },
      {
        id: 'msg-1-0',
        timestamp: '',
        actor: 'assistant',
        variant: 'chat',
        text: 'Fetching dashboard data now.',
      },
    ])
  })
})
