import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionDetailSidebar } from './session-detail-sidebar'
import type {
  DashboardInteractionSessionDetailResponse,
  DashboardInteractionSessionDto,
} from '../api-types'
import { fetchDashboardInteractionSessionDetail } from '../graphql/fetch-dashboard-data'

vi.mock('../graphql/fetch-dashboard-data', () => ({
  fetchDashboardInteractionSessionDetail: vi.fn(),
}))

const mockFetchDashboardInteractionSessionDetail = vi.mocked(
  fetchDashboardInteractionSessionDetail,
)

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

function makeInteractionDetail(
  overrides: Partial<DashboardInteractionSessionDetailResponse> = {},
): DashboardInteractionSessionDetailResponse {
  return {
    summary: sessionSummary,
    turns: [],
    raw_events: [],
    session_transcript_entries: [],
    ...overrides,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('SessionDetailSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchDashboardInteractionSessionDetail.mockResolvedValue(
      makeInteractionDetail(),
    )
  })

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

  it('defers heavy session detail loading until a heavy tab is opened', async () => {
    const user = userEvent.setup()

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        sessionSummary={sessionSummary}
        repoId='repo-1'
        userName='Test User'
      />,
    )

    expect(mockFetchDashboardInteractionSessionDetail).not.toHaveBeenCalled()

    await user.click(screen.getByRole('tab', { name: 'Turns' }))

    await waitFor(() => {
      expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(
        1,
      )
    })
    expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledWith(
      { repoId: 'repo-1', sessionId: 'sess-1' },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )

    await user.click(screen.getByRole('tab', { name: 'Tool use' }))

    expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(1)
  })

  it('aborts the previous heavy-detail request when the selected session changes', async () => {
    const user = userEvent.setup()
    const neverSettles = new Promise<DashboardInteractionSessionDetailResponse>(
      () => {},
    )
    mockFetchDashboardInteractionSessionDetail
      .mockImplementationOnce(() => neverSettles)
      .mockResolvedValueOnce(
        makeInteractionDetail({
          summary: { ...sessionSummary, session_id: 'sess-2' },
        }),
      )

    const { rerender } = render(
      <SessionDetailSidebar
        sessionId='sess-1'
        sessionSummary={sessionSummary}
        repoId='repo-1'
        userName='Test User'
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Turns' }))

    await waitFor(() => {
      expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(
        1,
      )
    })

    const firstSignal = mockFetchDashboardInteractionSessionDetail.mock
      .calls[0]?.[1]?.signal as AbortSignal | undefined

    rerender(
      <SessionDetailSidebar
        sessionId='sess-2'
        sessionSummary={{ ...sessionSummary, session_id: 'sess-2' }}
        repoId='repo-1'
        userName='Test User'
      />,
    )

    await waitFor(() => {
      expect(firstSignal?.aborted).toBe(true)
      expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(
        2,
      )
    })

    expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenLastCalledWith(
      { repoId: 'repo-1', sessionId: 'sess-2' },
      expect.objectContaining({
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('masks token usage for Cursor sessions even when token_usage is populated', () => {
    // Cursor does not expose reliable token counts; the dashboard should
    // suppress whatever the backend recorded and surface a clear "no info"
    // message instead of rendering the chart or count.
    const cursorSummary: DashboardInteractionSessionDto = {
      ...sessionSummary,
      session_id: 'cursor-sess',
      agent_type: 'cursor',
      model: null,
      token_usage: {
        input_tokens: 1234,
        output_tokens: 5678,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        api_call_count: 1,
      },
    }

    render(
      <SessionDetailSidebar
        sessionId={null}
        sessionSummary={cursorSummary}
        repoId={null}
        userName='Test User'
      />,
    )

    expect(screen.getByText('Token Usage')).toBeInTheDocument()
    expect(
      screen.getByText('No token information available.'),
    ).toBeInTheDocument()
    // The populated token numbers must not leak into the UI.
    expect(screen.queryByText(/1234/)).not.toBeInTheDocument()
    expect(screen.queryByText(/5678/)).not.toBeInTheDocument()
  })

  it('keeps the heavy-detail request alive long enough to render the loaded turns view', async () => {
    const user = userEvent.setup()
    const request = deferred<DashboardInteractionSessionDetailResponse>()
    mockFetchDashboardInteractionSessionDetail.mockReturnValueOnce(
      request.promise,
    )

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        sessionSummary={sessionSummary}
        repoId='repo-1'
        userName='Test User'
      />,
    )

    await user.click(screen.getByRole('tab', { name: 'Turns' }))

    await waitFor(() => {
      expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(
        1,
      )
    })

    const signal = mockFetchDashboardInteractionSessionDetail.mock.calls[0]?.[1]
      ?.signal as AbortSignal | undefined

    expect(signal?.aborted).toBe(false)

    await act(async () => {
      request.resolve(makeInteractionDetail())
      await request.promise
    })

    await waitFor(() => {
      expect(screen.getByText('No turns.')).toBeInTheDocument()
    })
  })
})
