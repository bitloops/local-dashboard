import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CommitTable } from './commits-table'
import type { CommitRow } from './commits-columns'
import type { Checkpoint } from '../types'

function makeCommitRow(overrides: Partial<CommitRow> = {}): CommitRow {
  const checkpoint: Checkpoint = {
    id: 'cp-1',
    firstPromptPreview: 'Do something',
    timestamp: '10:00 AM',
  }
  return {
    date: 'Mar 4',
    commit: 'a1b2c3d',
    checkpoints: 1,
    message: 'feat: add feature',
    author: 'Test Author',
    agent: 'claude-code',
    agents: ['claude-code'],
    checkpointList: [checkpoint],
    ...overrides,
  }
}

describe('CommitTable', () => {
  it('renders empty state when data is empty', () => {
    render(<CommitTable data={[]} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(
      screen.queryByRole('row', { name: /Mar 4/i }),
    ).not.toBeInTheDocument()
  })

  it('renders commit row with date, commit, message, author, and agent icon', () => {
    const data: CommitRow[] = [makeCommitRow()]
    render(<CommitTable data={data} />)
    expect(screen.getByText('Mar 4')).toBeInTheDocument()
    expect(screen.getByText('a1b2c3d')).toBeInTheDocument()
    expect(screen.getByText('feat: add feature')).toBeInTheDocument()
    expect(screen.getByText('Test Author')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'claude-code' })).toBeInTheDocument()
  })

  it('calls onCheckpointClick when a checkpoint is clicked', async () => {
    const checkpoint: Checkpoint = {
      id: 'cp-42',
      firstPromptPreview: 'Open me',
      timestamp: '11:00 AM',
    }
    const data: CommitRow[] = [
      makeCommitRow({
        checkpointList: [checkpoint],
        checkpoints: 1,
      }),
    ]
    const onCheckpointClick = vi.fn()
    render(<CommitTable data={data} onCheckpointClick={onCheckpointClick} />)
    const expandButton = screen.getByRole('button', {
      name: /expand row/i,
    })
    await userEvent.click(expandButton)
    const checkpointButton = screen.getByRole('button', { name: /Open me/i })
    await userEvent.click(checkpointButton)
    expect(onCheckpointClick).toHaveBeenCalledWith(checkpoint)
  })

  it('falls back to checkpoint id when no prompt preview exists', async () => {
    const checkpoint: Checkpoint = {
      id: 'cp-no-preview',
      timestamp: '11:00 AM',
    }
    const data: CommitRow[] = [
      makeCommitRow({
        checkpointList: [checkpoint],
        checkpoints: 1,
      }),
    ]

    render(<CommitTable data={data} />)
    await userEvent.click(screen.getByRole('button', { name: /expand row/i }))
    expect(
      screen.getByRole('button', { name: /Checkpoint cp-no-preview/i }),
    ).toBeInTheDocument()
  })
})
