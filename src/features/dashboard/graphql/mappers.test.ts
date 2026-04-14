import { describe, expect, it } from 'vitest'
import {
  mapDashboardAgents,
  mapDashboardBranches,
  mapDashboardCheckpointDetail,
  mapDashboardCommitRows,
  mapDashboardRepositories,
  mapDashboardUsers,
} from './mappers'
import type {
  DashboardAgentsQueryData,
  DashboardBranchesQueryData,
  DashboardCheckpointDetailQueryData,
  DashboardCommitsQueryData,
  DashboardRepositoriesQueryData,
  DashboardUsersQueryData,
} from './types'

function checkpointNode(checkpointId: string, agents: string[] = ['codex']) {
  return {
    checkpointId,
    strategy: 'default',
    branch: 'main',
    checkpointsCount: 1,
    filesTouched: [],
    sessionCount: 1,
    tokenUsage: null,
    sessionId: `session-${checkpointId}`,
    agents,
    firstPromptPreview: `Prompt ${checkpointId}`,
    createdAt: '2025-01-01T00:00:00.000Z',
    isTask: false,
    toolUseId: `tool-${checkpointId}`,
  }
}

describe('mapDashboardRepositories', () => {
  it('maps repository records', () => {
    const data: DashboardRepositoriesQueryData = {
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
    }

    expect(mapDashboardRepositories(data)).toEqual([
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

describe('mapDashboardBranches', () => {
  it('maps branch name and checkpoint count', () => {
    const data: DashboardBranchesQueryData = {
      branches: [
        { branch: 'main', checkpointCommits: 12 },
        { branch: 'feature/x', checkpointCommits: 0 },
      ],
    }

    expect(mapDashboardBranches(data)).toEqual([
      { branch: 'main', checkpoint_commits: 12 },
      { branch: 'feature/x', checkpoint_commits: 0 },
    ])
  })

  it('passes branch names through unchanged (trimming is done in use-dashboard-data)', () => {
    const data: DashboardBranchesQueryData = {
      branches: [{ branch: '  main  ', checkpointCommits: 3 }],
    }

    expect(mapDashboardBranches(data)).toEqual([
      { branch: '  main  ', checkpoint_commits: 3 },
    ])
  })
})

describe('mapDashboardUsers / mapDashboardAgents', () => {
  it('maps user records', () => {
    const data: DashboardUsersQueryData = {
      users: [{ key: 'a@b.com', name: 'Alice', email: 'a@b.com' }],
    }

    expect(mapDashboardUsers(data)).toEqual([
      { key: 'a@b.com', name: 'Alice', email: 'a@b.com' },
    ])
  })

  it('maps agent records', () => {
    const data: DashboardAgentsQueryData = {
      agents: [{ key: 'claude-code' }],
    }

    expect(mapDashboardAgents(data)).toEqual([{ key: 'claude-code' }])
  })
})

describe('mapDashboardCommitRows', () => {
  it('maps all checkpoints from the new checkpoints field', () => {
    const data: DashboardCommitsQueryData = {
      commits: [
        {
          commit: {
            sha: 'aaa',
            parents: [],
            authorName: 'Alice',
            authorEmail: 'alice@example.com',
            timestamp: 1_735_689_600,
            message: 'msg',
            filesTouched: [],
          },
          checkpoint: checkpointNode('fallback'),
          checkpoints: [
            checkpointNode('cp-1', ['codex']),
            checkpointNode('cp-2', ['claude-code']),
          ],
        },
      ],
    }

    const commitRows = mapDashboardCommitRows(data)

    expect(commitRows).toHaveLength(1)
    expect(commitRows[0]?.checkpoint.checkpoint_id).toBe('cp-1')
    expect(commitRows[0]?.checkpoints?.map((checkpoint) => checkpoint.checkpoint_id)).toEqual([
      'cp-1',
      'cp-2',
    ])
  })

  it('falls back to the singular checkpoint field when checkpoints is empty', () => {
    const data: DashboardCommitsQueryData = {
      commits: [
        {
          commit: {
            sha: 'aaa',
            parents: [],
            authorName: 'Alice',
            authorEmail: 'alice@example.com',
            timestamp: 1_735_689_600,
            message: 'msg',
            filesTouched: [],
          },
          checkpoint: checkpointNode('cp-fallback'),
          checkpoints: [],
        },
      ],
    }

    const commitRows = mapDashboardCommitRows(data)

    expect(commitRows[0]?.checkpoint.checkpoint_id).toBe('cp-fallback')
    expect(commitRows[0]?.checkpoints?.map((checkpoint) => checkpoint.checkpoint_id)).toEqual([
      'cp-fallback',
    ])
  })
})

describe('mapDashboardCheckpointDetail', () => {
  it('maps checkpoint detail sessions and token usage', () => {
    const data: DashboardCheckpointDetailQueryData = {
      checkpoint: {
        checkpointId: 'cp-1',
        strategy: 'default',
        branch: 'main',
        checkpointsCount: 2,
        filesTouched: [],
        sessionCount: 1,
        tokenUsage: {
          inputTokens: 5,
          outputTokens: 7,
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
    }

    expect(mapDashboardCheckpointDetail(data)).toEqual({
      checkpoint_id: 'cp-1',
      strategy: 'default',
      branch: 'main',
      checkpoints_count: 2,
      files_touched: [],
      session_count: 1,
      token_usage: {
        input_tokens: 5,
        output_tokens: 7,
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
})
