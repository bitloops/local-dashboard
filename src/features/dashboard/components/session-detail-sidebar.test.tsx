import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SessionDetailSidebar } from './session-detail-sidebar'
import type {
  DashboardInteractionSessionDetailResponse,
  DashboardInteractionSessionDto,
  DashboardInteractionToolUseDto,
  DashboardTranscriptEntryDto,
} from '../api-types'
import { fetchDashboardInteractionSessionDetail } from '../graphql/fetch-dashboard-data'

vi.mock('../graphql/fetch-dashboard-data', () => ({
  fetchDashboardInteractionSessionDetail: vi.fn(),
}))

const mockFetchDashboardInteractionSessionDetail = vi.mocked(
  fetchDashboardInteractionSessionDetail,
)

const baseSummary: DashboardInteractionSessionDto = {
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
    summary: baseSummary,
    turns: [],
    raw_events: [],
    session_transcript_entries: [],
    ...overrides,
  }
}

function toolUse(
  overrides: Partial<DashboardInteractionToolUseDto> = {},
): DashboardInteractionToolUseDto {
  return {
    tool_invocation_id: 'inv-1',
    tool_use_id: 'tu-1',
    session_id: 'sess-1',
    turn_id: null,
    tool_kind: 'Read',
    task_description: null,
    input_summary: null,
    output_summary: null,
    source: null,
    command: null,
    command_binary: null,
    command_argv: [],
    transcript_path: null,
    started_at: null,
    ended_at: null,
    ...overrides,
  }
}

function transcriptEntry(
  overrides: Partial<DashboardTranscriptEntryDto> = {},
): DashboardTranscriptEntryDto {
  return {
    entry_id: 'entry-1',
    session_id: 'sess-1',
    turn_id: null,
    order: 0,
    timestamp: null,
    actor: 'ASSISTANT',
    variant: 'TOOL_USE',
    source: 'TRANSCRIPT',
    text: 'Tool: Read\n/foo/bar.ts',
    tool_use_id: 'tu-x',
    tool_kind: 'Read',
    is_error: false,
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

  it('shows a spinner while the detail request is in flight', async () => {
    const request = deferred<DashboardInteractionSessionDetailResponse>()
    mockFetchDashboardInteractionSessionDetail.mockReturnValueOnce(
      request.promise,
    )

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    // Spinner visible, no tabs rendered yet — the sidebar shows nothing
    // resembling content until the detail response arrives.
    expect(
      screen.getByRole('status', { name: 'Loading session' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('tab', { name: 'Details' })).toBeNull()

    request.resolve(makeInteractionDetail())

    await waitFor(() => {
      expect(
        screen.queryByRole('status', { name: 'Loading session' }),
      ).toBeNull()
    })
    expect(screen.getByRole('tab', { name: 'Details' })).toBeInTheDocument()
  })

  it('shows the provider model slug instead of the full account path once the detail loads', async () => {
    mockFetchDashboardInteractionSessionDetail.mockResolvedValue(
      makeInteractionDetail(),
    )

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    expect(await screen.findByText('kimi-k2p6')).toBeInTheDocument()
    expect(
      screen.queryByText('accounts/fireworks/models/kimi-k2p6'),
    ).not.toBeInTheDocument()
  })

  it('fetches the session detail eagerly when a session is selected and does not refetch on tab switch', async () => {
    const user = userEvent.setup()

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    // Detail fetch fires on mount.
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

    // Switching tabs after the detail resolves must not trigger another
    // fetch — the loaded detail is shared across all three tabs.
    await user.click(await screen.findByRole('tab', { name: 'Turns' }))
    await user.click(screen.getByRole('tab', { name: 'Tool use' }))
    await user.click(screen.getByRole('tab', { name: 'Details' }))
    expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(1)
  })

  it('aborts the previous detail request when the selected session changes', async () => {
    const neverSettles = new Promise<DashboardInteractionSessionDetailResponse>(
      () => {},
    )
    mockFetchDashboardInteractionSessionDetail
      .mockImplementationOnce(() => neverSettles)
      .mockResolvedValueOnce(
        makeInteractionDetail({
          summary: { ...baseSummary, session_id: 'sess-2' },
        }),
      )

    const { rerender } = render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

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

  it('masks token usage for Cursor sessions even when token_usage is populated', async () => {
    // Cursor does not expose reliable token counts; the dashboard should
    // suppress whatever the backend recorded and surface a clear "no info"
    // message instead of rendering the chart or count.
    mockFetchDashboardInteractionSessionDetail.mockResolvedValue(
      makeInteractionDetail({
        summary: {
          ...baseSummary,
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
        },
      }),
    )

    render(
      <SessionDetailSidebar
        sessionId='cursor-sess'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    expect(await screen.findByText('Token Usage')).toBeInTheDocument()
    expect(
      screen.getByText('No token information available.'),
    ).toBeInTheDocument()
    // The populated token numbers must not leak into the UI.
    expect(screen.queryByText(/1234/)).not.toBeInTheDocument()
    expect(screen.queryByText(/5678/)).not.toBeInTheDocument()
  })

  it('renders the Tool calls header tile from the detail summary tool_uses array', async () => {
    // The header reads from the same derivation as the Tool use tab
    // (`buildSessionToolUseDisplayItems`). With a populated tool_uses array
    // on the detail summary, the count is just the array length.
    mockFetchDashboardInteractionSessionDetail.mockResolvedValue(
      makeInteractionDetail({
        summary: {
          ...baseSummary,
          tool_uses: [
            toolUse({ tool_invocation_id: 'inv-1', tool_use_id: 'tu-1' }),
            toolUse({
              tool_invocation_id: 'inv-2',
              tool_use_id: 'tu-2',
              tool_kind: 'Edit',
            }),
            toolUse({
              tool_invocation_id: 'inv-3',
              tool_use_id: 'tu-3',
              tool_kind: 'Bash',
            }),
          ],
        },
      }),
    )

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    await waitFor(() => {
      const tile = screen.getByText('Tool calls').parentElement
      expect(tile!.textContent).toContain('3')
    })
  })

  it('renders Tool calls count from the transcript fallback when summary.tool_uses is empty', async () => {
    // Regression: some sessions arrive with an empty `summary.tool_uses`
    // array but a populated `session_transcript_entries` stream containing
    // TOOL_USE entries. The Tool use tab renders the list via
    // `buildSessionToolUseDisplayItems`, which falls back to the transcript
    // traces when `tools.length === 0`. The header tile reads from the same
    // logic so the two cannot disagree.
    mockFetchDashboardInteractionSessionDetail.mockResolvedValue(
      makeInteractionDetail({
        summary: { ...baseSummary, tool_uses: [] },
        session_transcript_entries: [
          transcriptEntry({
            entry_id: 'entry-1',
            order: 0,
            variant: 'TOOL_USE',
            tool_use_id: 'tu-x',
          }),
          transcriptEntry({
            entry_id: 'entry-2',
            order: 1,
            actor: 'USER',
            variant: 'TOOL_RESULT',
            text: 'ok',
            tool_use_id: 'tu-x',
          }),
          transcriptEntry({
            entry_id: 'entry-3',
            order: 2,
            variant: 'TOOL_USE',
            tool_use_id: 'tu-y',
            tool_kind: 'Bash',
            text: 'Tool: Bash\nls',
          }),
        ],
      }),
    )

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    // Two TOOL_USE entries in the transcript → header count of 2 even though
    // summary.tool_uses is empty.
    await waitFor(() => {
      const tile = screen.getByText('Tool calls').parentElement
      expect(tile!.textContent).toContain('2')
    })
  })

  it('shows the Tool calls count for Cursor sessions (only token counts are suppressed)', async () => {
    // Cursor's tool-use list is real data — it's what populates the Tool use
    // tab. Only the *token counts* are unreliable for Cursor, so the
    // suppression in the token-usage block must not bleed into the header
    // Tool calls tile.
    mockFetchDashboardInteractionSessionDetail.mockResolvedValue(
      makeInteractionDetail({
        summary: {
          ...baseSummary,
          agent_type: 'cursor',
          tool_uses: [
            toolUse({ tool_invocation_id: 'inv-1', tool_use_id: 'tu-1' }),
            toolUse({
              tool_invocation_id: 'inv-2',
              tool_use_id: 'tu-2',
              tool_kind: 'Edit',
            }),
          ],
        },
      }),
    )

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    await waitFor(() => {
      const tile = screen.getByText('Tool calls').parentElement
      expect(tile!.textContent).toContain('2')
    })
  })

  it('does not show the previous session content while the next session is loading', async () => {
    // Regression: when the user picks sess-2 after sess-1 finished loading,
    // the sidebar must clear sess-1's tabs immediately and show the
    // spinner — never paint a frame where sess-1's content is visible
    // under the new sessionId. The reset effect clears interactionDetail
    // synchronously (no startTransition) for exactly this reason.
    mockFetchDashboardInteractionSessionDetail.mockResolvedValueOnce(
      makeInteractionDetail({
        summary: {
          ...baseSummary,
          session_id: 'sess-1',
          first_prompt: 'first session unique prompt',
        },
      }),
    )
    const sess2Request = deferred<DashboardInteractionSessionDetailResponse>()
    mockFetchDashboardInteractionSessionDetail.mockReturnValueOnce(
      sess2Request.promise,
    )

    const { rerender } = render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    // Wait for the sess-1 detail to land and its content to render.
    expect(
      await screen.findByText('first session unique prompt'),
    ).toBeInTheDocument()

    // Switch to sess-2 while its detail is still in flight.
    rerender(
      <SessionDetailSidebar
        sessionId='sess-2'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    // sess-1 content must not be visible anymore; the spinner is showing.
    expect(screen.queryByText('first session unique prompt')).toBeNull()
    expect(
      screen.getByRole('status', { name: 'Loading session' }),
    ).toBeInTheDocument()

    // Resolve sess-2 and confirm we see its content.
    sess2Request.resolve(
      makeInteractionDetail({
        summary: {
          ...baseSummary,
          session_id: 'sess-2',
          first_prompt: 'second session unique prompt',
        },
      }),
    )
    expect(
      await screen.findByText('second session unique prompt'),
    ).toBeInTheDocument()
  })

  it('refetches when refreshToken changes for the same session', async () => {
    mockFetchDashboardInteractionSessionDetail.mockResolvedValue(
      makeInteractionDetail(),
    )

    const { rerender } = render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
        refreshToken={0}
      />,
    )

    await waitFor(() => {
      expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(
        1,
      )
    })

    rerender(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
        refreshToken={1}
      />,
    )

    await waitFor(() => {
      expect(mockFetchDashboardInteractionSessionDetail).toHaveBeenCalledTimes(
        2,
      )
    })
  })

  it('surfaces a load error when the detail request fails', async () => {
    mockFetchDashboardInteractionSessionDetail.mockRejectedValueOnce(
      new Error('boom'),
    )

    render(
      <SessionDetailSidebar
        sessionId='sess-1'
        repoId='repo-1'
        userName='Test User'
      />,
    )

    expect(await screen.findByText('boom')).toBeInTheDocument()
    // No tabs rendered on error.
    expect(screen.queryByRole('tab', { name: 'Details' })).toBeNull()
  })
})
