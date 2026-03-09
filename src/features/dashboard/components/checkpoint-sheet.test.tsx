import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  formatDateTime,
  prettyPrintJson,
  parseTranscriptEntries,
  stripUserQueryTags,
} from './checkpoint-sheet-utils'
import { CheckpointSheet } from './checkpoint-sheet'
import type { Checkpoint } from '../data/mock-commit-data'

describe('formatDateTime', () => {
  it('formats valid ISO string to locale string', () => {
    const result = formatDateTime('2025-03-04T14:30:00.000Z')
    expect(new Date(result).getTime()).toBe(new Date('2025-03-04T14:30:00.000Z').getTime())
  })

  it('returns original value for invalid date string', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('stripUserQueryTags', () => {
  it('removes only <user_query> and </user_query> tags, leaves spacing unchanged', () => {
    const input = '  <user_query>\n  What is 2+2?\n  </user_query>  '
    expect(stripUserQueryTags(input)).toBe('  \n  What is 2+2?\n    ')
  })

  it('is case-insensitive', () => {
    expect(stripUserQueryTags('<USER_QUERY>Hi</USER_QUERY>')).toBe('Hi')
    expect(stripUserQueryTags('<User_Query>Bye</User_Query>')).toBe('Bye')
  })

  it('removes multiple tag pairs and leaves content and spacing', () => {
    const input = 'First\n<user_query>\nQ1\n</user_query>\n\n<user_query>\nQ2\n</user_query>\nLast'
    expect(stripUserQueryTags(input)).toBe('First\n\nQ1\n\n\n\nQ2\n\nLast')
  })

  it('returns empty string unchanged for whitespace-only input', () => {
    expect(stripUserQueryTags('   ')).toBe('   ')
  })

  it('returns original when no tags present', () => {
    const input = 'Just some text'
    expect(stripUserQueryTags(input)).toBe(input)
  })
})

describe('prettyPrintJson', () => {
  it('formats valid JSON with indentation', () => {
    const result = prettyPrintJson('{"a":1}')
    expect(JSON.parse(result)).toEqual({ a: 1 })
  })

  it('returns original value when parse fails', () => {
    expect(prettyPrintJson('not json')).toBe('not json')
  })
})

describe('parseTranscriptEntries', () => {
  it('parses user string content as user chat and strips user_query tags', () => {
    const jsonl = JSON.stringify({
      type: 'user',
      message: { content: '<user_query>\nWhat is 2+2?\n</user_query>' },
      timestamp: '2025-03-04T10:00:03.000Z',
    })
    const entries = parseTranscriptEntries(jsonl)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({
      actor: 'user',
      variant: 'chat',
      text: '\nWhat is 2+2?\n',
    })
  })

  it('parses user array of tool_result as assistant tool_result messages', () => {
    const jsonl = JSON.stringify({
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', content: 'total 32', is_error: false },
          { type: 'tool_result', content: 'Error', is_error: true },
        ],
      },
      timestamp: '2025-03-04T10:00:04.000Z',
      uuid: 'u1',
    })
    const entries = parseTranscriptEntries(jsonl)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      actor: 'assistant',
      variant: 'tool_result',
      text: 'total 32',
      isError: false,
    })
    expect(entries[1]).toMatchObject({
      actor: 'assistant',
      variant: 'tool_result',
      text: 'Error',
      isError: true,
    })
  })

  it('parses assistant content blocks as thinking, chat, and tool_use', () => {
    const jsonl = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: 'The user is asking...' },
          { type: 'text', text: 'I need to find the code first.' },
          { type: 'tool_use', name: 'Glob', input: { pattern: '**/*.js' } },
        ],
      },
      timestamp: '2025-03-04T10:00:05.000Z',
      uuid: 'a1',
    })
    const entries = parseTranscriptEntries(jsonl)
    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({
      actor: 'assistant',
      variant: 'thinking',
      text: 'Thinking: The user is asking...',
    })
    expect(entries[1]).toMatchObject({
      actor: 'assistant',
      variant: 'chat',
      text: 'I need to find the code first.',
    })
    expect(entries[2]).toMatchObject({
      actor: 'assistant',
      variant: 'tool_use',
      text: 'Tool: Glob\n{\n  "pattern": "**/*.js"\n}',
    })
  })

  it('sorts messages by timestamp then id', () => {
    const jsonl = [
      JSON.stringify({
        type: 'user',
        message: { content: 'Last' },
        timestamp: '2025-03-04T10:00:10.000Z',
        uuid: 'u2',
      }),
      JSON.stringify({
        type: 'user',
        message: { content: 'First' },
        timestamp: '2025-03-04T10:00:00.000Z',
        uuid: 'u1',
      }),
    ].join('\n')
    const entries = parseTranscriptEntries(jsonl)
    expect(entries).toHaveLength(2)
    expect(entries[0].text).toBe('First')
    expect(entries[1].text).toBe('Last')
  })

  it('skips malformed lines', () => {
    const jsonl = '{"type":"user","message":{"content":"Hi"}}\nnot json\n{"type":"progress","data":{"hookEvent":"x"}}'
    const entries = parseTranscriptEntries(jsonl)
    expect(entries).toHaveLength(1)
  })
})

describe('CheckpointSheet (component)', () => {
  const defaultProps = {
    selectedCheckpoint: null as Checkpoint | null,
    checkpointDetail: null,
    checkpointDetailSource: 'idle' as const,
    userName: 'Test User',
    onClose: vi.fn(),
  }

  it('does not show checkpoint title when selectedCheckpoint is null', () => {
    render(<CheckpointSheet {...defaultProps} />)
    expect(screen.queryByText(/Checkpoint cp-/)).not.toBeInTheDocument()
  })

  it('shows checkpoint title when a checkpoint is selected', () => {
    const checkpoint: Checkpoint = {
      id: 'cp-99',
      prompt: 'Implement the feature',
      timestamp: '10:00 AM',
      createdAt: '2025-03-04T10:00:00.000Z',
      agent: 'claude-code',
    }
    render(
      <CheckpointSheet
        {...defaultProps}
        selectedCheckpoint={checkpoint}
        checkpointDetailSource='api'
      />
    )
    expect(screen.getByText('Checkpoint cp-99')).toBeInTheDocument()
  })

  it('calls onClose when sheet is closed', async () => {
    const checkpoint: Checkpoint = {
      id: 'cp-1',
      prompt: 'Test',
      timestamp: '10:00 AM',
    }
    const onClose = vi.fn()
    render(
      <CheckpointSheet
        {...defaultProps}
        selectedCheckpoint={checkpoint}
        onClose={onClose}
        checkpointDetailSource='api'
      />
    )
    const closeButton = screen.getByRole('button', { name: /close/i })
    await userEvent.click(closeButton)
    expect(onClose).toHaveBeenCalled()
  })

  it('shows Files Touched with git-diff style additions/deletions when filesTouched is provided', async () => {
    const checkpoint: Checkpoint = {
      id: 'cp-1',
      prompt: 'Fix bug',
      timestamp: '10:00 AM',
      filesTouched: {
        'src/App.tsx': { additionsCount: 5, deletionsCount: 2 },
        'src/lib/utils.ts': { additionsCount: 0, deletionsCount: 3 },
      },
    }
    render(
      <CheckpointSheet
        {...defaultProps}
        selectedCheckpoint={checkpoint}
        checkpointDetailSource='api'
      />
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Summary' }))
    expect(screen.getByText('Files Touched')).toBeInTheDocument()
    expect(screen.getByText('App.tsx')).toBeInTheDocument()
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('−2')).toBeInTheDocument()
    expect(screen.getByText('−3')).toBeInTheDocument()
  })
})
