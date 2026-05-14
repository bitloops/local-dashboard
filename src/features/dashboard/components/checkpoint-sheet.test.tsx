import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  formatDateTime,
  prettyPrintJson,
  stripUserQueryTags,
} from './checkpoint-sheet-utils'
import { CheckpointSheet } from './checkpoint-sheet'
import type { Checkpoint } from '../types'

describe('formatDateTime', () => {
  it('formats valid ISO string to locale string', () => {
    const result = formatDateTime('2025-03-04T14:30:00.000Z')
    expect(new Date(result).getTime()).toBe(
      new Date('2025-03-04T14:30:00.000Z').getTime(),
    )
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
    const input =
      'First\n<user_query>\nQ1\n</user_query>\n\n<user_query>\nQ2\n</user_query>\nLast'
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

describe('CheckpointSheet (component)', () => {
  const defaultProps = {
    selectedCheckpoint: null as Checkpoint | null,
    checkpointDetail: null,
    checkpointDetailSource: 'idle' as const,
    userName: 'Test User',
    repoId: null as string | null,
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
      />,
    )
    expect(screen.getByText('Checkpoint cp-99')).toBeInTheDocument()
  })

  it('shows loading message when checkpointDetailSource is loading', () => {
    const checkpoint: Checkpoint = {
      id: 'cp-loading',
      prompt: 'Test',
      timestamp: '10:00 AM',
    }
    render(
      <CheckpointSheet
        {...defaultProps}
        selectedCheckpoint={checkpoint}
        checkpointDetailSource='loading'
      />,
    )
    expect(
      screen.getByText(/Loading chat data for this checkpoint/),
    ).toBeInTheDocument()
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
      />,
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
      filesTouched: [
        { filepath: 'src/App.tsx', additionsCount: 5, deletionsCount: 2 },
        { filepath: 'src/lib/utils.ts', additionsCount: 0, deletionsCount: 3 },
      ],
    }
    render(
      <CheckpointSheet
        {...defaultProps}
        selectedCheckpoint={checkpoint}
        checkpointDetailSource='api'
      />,
    )
    await userEvent.click(screen.getByRole('tab', { name: 'Details' }))
    expect(screen.getByText('Files Touched')).toBeInTheDocument()
    expect(screen.getByText('App.tsx')).toBeInTheDocument()
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('−2')).toBeInTheDocument()
    expect(screen.getByText('−3')).toBeInTheDocument()
  })

  it('renders canonical transcript entries for the active checkpoint session tab', async () => {
    const checkpoint: Checkpoint = {
      id: 'cp-2',
      prompt: 'Review checkpoint memory usage',
      timestamp: '10:00 AM',
      createdAt: '2025-03-04T10:00:00.000Z',
      agent: 'claude-code',
    }
    const checkpointDetail = {
      checkpoint_id: 'cp-2',
      strategy: 'default',
      branch: 'main',
      checkpoints_count: 1,
      files_touched: [],
      session_count: 2,
      token_usage: null,
      sessions: [
        {
          session_index: 0,
          session_id: 'sess-1',
          agent: 'claude-code',
          created_at: '2025-03-04T10:00:00.000Z',
          is_task: false,
          tool_use_id: 'tool-1',
          metadata_json: '{}',
          transcript_jsonl: '',
          prompts_text: 'First prompt',
          context_text: 'First context',
          transcript_entries: [
            {
              entry_id: 'e1',
              session_id: 'sess-1',
              turn_id: null,
              order: 0,
              timestamp: null,
              actor: 'USER' as const,
              variant: 'CHAT' as const,
              source: 'TRANSCRIPT' as const,
              text: 'first session text',
              tool_use_id: null,
              tool_kind: null,
              is_error: false,
            },
          ],
        },
        {
          session_index: 1,
          session_id: 'sess-2',
          agent: 'claude-code',
          created_at: '2025-03-04T10:02:00.000Z',
          is_task: false,
          tool_use_id: 'tool-2',
          metadata_json: '{}',
          transcript_jsonl: '',
          prompts_text: 'Second prompt',
          context_text: 'Second context',
          transcript_entries: [
            {
              entry_id: 'e2',
              session_id: 'sess-2',
              turn_id: null,
              order: 0,
              timestamp: null,
              actor: 'USER' as const,
              variant: 'CHAT' as const,
              source: 'TRANSCRIPT' as const,
              text: 'second session text',
              tool_use_id: null,
              tool_kind: null,
              is_error: false,
            },
          ],
        },
      ],
    }

    render(
      <CheckpointSheet
        {...defaultProps}
        selectedCheckpoint={checkpoint}
        checkpointDetail={checkpointDetail}
        checkpointDetailSource='api'
      />,
    )

    expect(screen.getByText('first session text')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('tab', { name: 'Session 2' }))

    expect(screen.getByText('second session text')).toBeInTheDocument()
  })
})
