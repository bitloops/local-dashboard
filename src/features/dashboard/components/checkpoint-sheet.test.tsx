import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CheckpointSheet,
  formatDateTime,
  prettyPrintJson,
  parseTranscriptEntries,
} from './checkpoint-sheet'
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
  it('parses JSONL and extracts role and content', () => {
    const jsonl = '{"role":"user","content":"Hi"}\n{"role":"assistant","content":"Hello"}'
    const entries = parseTranscriptEntries(jsonl)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ role: 'user', content: 'Hi' })
    expect(entries[1]).toEqual({ role: 'assistant', content: 'Hello' })
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

  it('shows checkpoint title and prompt when a checkpoint is selected', () => {
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
    expect(screen.getByText('Implement the feature')).toBeInTheDocument()
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

  it('shows Files Touched with git-diff style additions/deletions when filesTouched is provided', () => {
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
    expect(screen.getByText('Files Touched')).toBeInTheDocument()
    expect(screen.getByText('App.tsx')).toBeInTheDocument()
    expect(screen.getByText('utils.ts')).toBeInTheDocument()
    expect(screen.getByText('+5')).toBeInTheDocument()
    expect(screen.getByText('−2')).toBeInTheDocument()
    expect(screen.getByText('−3')).toBeInTheDocument()
  })
})
