import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SessionDetailSidebar } from './session-detail-sidebar'
import type { DashboardInteractionSessionDto } from '../api-types'

vi.mock('../graphql/fetch-dashboard-data', () => ({
  fetchDashboardInteractionSessionDetail: vi.fn(),
}))

const sessionSummary: DashboardInteractionSessionDto = {
  session_id: 'sess-1',
  branch: 'main',
  actor: null,
  agent_type: 'opencode',
  model: 'accounts/fireworks/models/kimi-k2p6',
  first_prompt: 'Inspect model label formatting',
  started_at: '2025-05-08T10:00:00.000Z',
  ended_at: null,
  last_event_at: null,
  turn_count: 2,
  checkpoint_count: 0,
  token_usage: null,
  file_paths: [],
  tool_uses: [],
  linked_checkpoints: [],
  latest_commit_author: null,
}

describe('SessionDetailSidebar', () => {
  it('shows the provider model slug instead of the full account path', () => {
    render(
      <SessionDetailSidebar
        sessionId={null}
        sessionSummary={sessionSummary}
        repoId={null}
        userName='Test User'
      />,
    )

    expect(screen.getByText('kimi-k2p6')).toBeInTheDocument()
    expect(
      screen.queryByText('accounts/fireworks/models/kimi-k2p6'),
    ).not.toBeInTheDocument()
  })
})
