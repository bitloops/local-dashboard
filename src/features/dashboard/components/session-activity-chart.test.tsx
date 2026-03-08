import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import { CommitCheckpointChart } from './session-activity-chart'
import type { CommitData } from '../data/mock-commit-data'

function makeCommitData(overrides: Partial<CommitData> = {}): CommitData {
  return {
    date: 'Mar 4',
    commit: 'a1b2c3d',
    checkpoints: 3,
    message: 'feat: add feature',
    agent: 'claude-code',
    checkpointList: [],
    ...overrides,
  }
}

describe('CommitCheckpointChart', () => {
  it('renders chart container with empty data', () => {
    const { container } = render(<CommitCheckpointChart data={[]} />)
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })

  it('renders chart container with data', () => {
    const data: CommitData[] = [makeCommitData()]
    const { container } = render(<CommitCheckpointChart data={data} />)
    expect(container.querySelector('.recharts-responsive-container')).toBeInTheDocument()
  })
})
