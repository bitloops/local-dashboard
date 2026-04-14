import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestDashboardGraphQL } from '@/api/dashboard/client'
import {
  COMMITS_PAGE_SIZE,
  fetchDashboardCommitsPage,
  fetchDashboardCheckpointDetail,
  fetchDashboardRepositories,
} from './fetch-dashboard-data'

vi.mock('@/api/dashboard/client', () => ({
  requestDashboardGraphQL: vi.fn(),
}))

const mockRequestDashboardGraphQL = vi.mocked(requestDashboardGraphQL)

function commitRow(sha: string, checkpointId = `cp-${sha}`) {
  return {
    commit: {
      sha,
      parents: [] as string[],
      authorName: 'Dev',
      authorEmail: 'dev@example.com',
      timestamp: 1_735_689_600,
      message: `message-${sha}`,
      filesTouched: [],
    },
    checkpoint: {
      checkpointId,
      strategy: 'default',
      branch: 'main',
      checkpointsCount: 1,
      filesTouched: [],
      sessionCount: 1,
      tokenUsage: null,
      sessionId: `session-${checkpointId}`,
      agents: ['claude-code'],
      firstPromptPreview: 'Prompt preview',
      createdAt: '2025-01-01T00:00:00.000Z',
      isTask: false,
      toolUseId: `tool-${checkpointId}`,
    },
    checkpoints: [
      {
        checkpointId,
        strategy: 'default',
        branch: 'main',
        checkpointsCount: 1,
        filesTouched: [],
        sessionCount: 1,
        tokenUsage: null,
        sessionId: `session-${checkpointId}`,
        agents: ['claude-code'],
        firstPromptPreview: 'Prompt preview',
        createdAt: '2025-01-01T00:00:00.000Z',
        isTask: false,
        toolUseId: `tool-${checkpointId}`,
      },
    ],
  }
}

describe('fetchDashboardCommitsPage', () => {
  beforeEach(() => {
    mockRequestDashboardGraphQL.mockReset()
  })

  it('requests offset pagination and slices the extra row used for hasNextPage', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: {
        commits: Array.from({ length: COMMITS_PAGE_SIZE + 1 }, (_, index) =>
          commitRow(`sha-${index}`),
        ),
      },
    })

    const data = await fetchDashboardCommitsPage({
      repoId: 'repo-1',
      branch: 'main',
      from: '1735689600',
      to: '1735775999',
      user: 'dev@example.com',
      agent: 'claude-code',
      offset: COMMITS_PAGE_SIZE,
    })

    expect(mockRequestDashboardGraphQL).toHaveBeenCalledTimes(1)
    expect(mockRequestDashboardGraphQL.mock.calls[0]?.[1]).toMatchObject({
      repoId: 'repo-1',
      branch: 'main',
      from: '1735689600',
      to: '1735775999',
      user: 'dev@example.com',
      agent: 'claude-code',
      limit: COMMITS_PAGE_SIZE + 1,
      offset: COMMITS_PAGE_SIZE,
    })
    expect(data.rows).toHaveLength(COMMITS_PAGE_SIZE)
    expect(data.rows[0]?.commit.sha).toBe('sha-0')
    expect(data.hasNextPage).toBe(true)
  })

  it('throws when GraphQL returns errors', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      errors: [{ message: 'bad' }],
      data: { commits: [] },
    })

    await expect(
      fetchDashboardCommitsPage({
        repoId: 'repo-1',
        branch: 'main',
        from: null,
        to: null,
        user: null,
        agent: null,
        offset: 0,
      }),
    ).rejects.toThrow('bad')
  })
})

describe('fetchDashboardRepositories', () => {
  beforeEach(() => {
    mockRequestDashboardGraphQL.mockReset()
  })

  it('maps repository records to dashboard repository options', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: {
        repositories: [
          {
            repoId: 'repo-1',
            identity: 'acme/demo',
            name: 'demo',
            provider: 'github',
            organization: 'acme',
            defaultBranch: 'main',
          },
        ],
      },
    })

    await expect(fetchDashboardRepositories()).resolves.toEqual([
      {
        repoId: 'repo-1',
        identity: 'acme/demo',
        name: 'demo',
        provider: 'github',
        organization: 'acme',
        defaultBranch: 'main',
      },
    ])
  })
})

describe('fetchDashboardCheckpointDetail', () => {
  beforeEach(() => {
    mockRequestDashboardGraphQL.mockReset()
  })

  it('maps checkpoint detail from the dashboard query', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: {
        checkpoint: {
          checkpointId: 'cp-1',
          strategy: 'default',
          branch: 'main',
          checkpointsCount: 2,
          filesTouched: [],
          sessionCount: 1,
          tokenUsage: {
            inputTokens: 12,
            outputTokens: 6,
            cacheCreationTokens: 1,
            cacheReadTokens: 2,
            apiCallCount: 1,
          },
          sessions: [
            {
              sessionIndex: 0,
              sessionId: 'session-1',
              agent: 'claude-code',
              createdAt: '2025-01-01T00:00:00.000Z',
              isTask: false,
              toolUseId: 'tool-1',
              metadataJson: '{}',
              transcriptJsonl: '',
              promptsText: '',
              contextText: '',
            },
          ],
        },
      },
    })

    await expect(
      fetchDashboardCheckpointDetail({
        repoId: 'repo-1',
        checkpointId: 'cp-1',
      }),
    ).resolves.toEqual({
      checkpoint_id: 'cp-1',
      strategy: 'default',
      branch: 'main',
      checkpoints_count: 2,
      files_touched: [],
      session_count: 1,
      token_usage: {
        input_tokens: 12,
        output_tokens: 6,
        cache_creation_tokens: 1,
        cache_read_tokens: 2,
        api_call_count: 1,
      },
      sessions: [
        {
          session_index: 0,
          session_id: 'session-1',
          agent: 'claude-code',
          created_at: '2025-01-01T00:00:00.000Z',
          is_task: false,
          tool_use_id: 'tool-1',
          metadata_json: '{}',
          transcript_jsonl: '',
          prompts_text: '',
          context_text: '',
        },
      ],
    })
  })

  it('throws when the checkpoint payload is missing', async () => {
    mockRequestDashboardGraphQL.mockResolvedValue({
      data: {
        checkpoint: null,
      },
    })

    await expect(
      fetchDashboardCheckpointDetail({
        repoId: 'repo-1',
        checkpointId: 'cp-1',
      }),
    ).rejects.toThrow('Checkpoint detail was not returned.')
  })
})
