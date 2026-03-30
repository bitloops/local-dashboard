import { describe, expect, it } from 'vitest'
import {
  mapDashboardBranches,
  mapDashboardCommitRows,
  mapRepoAgentStrings,
  mapRepoUserStrings,
} from './mappers'
import type {
  DashboardBranchesQueryData,
  DashboardCommitsQueryData,
} from './types'

function commitEdge(overrides: {
  sha: string
  authorEmail: string
  checkpointAgents: string[][]
}) {
  return {
    node: {
      sha: overrides.sha,
      parents: [] as string[],
      authorName: 'Author',
      authorEmail: overrides.authorEmail,
      commitMessage: 'msg',
      committedAt: '2025-01-01T00:00:00.000Z',
      filesChanged: [] as string[],
      checkpoints: {
        edges: overrides.checkpointAgents.map((agents) => ({
          node: {
            id: `${overrides.sha}-cp`,
            branch: 'main',
            agent: agents[0] ?? null,
            strategy: '',
            filesTouched: [] as string[],
            checkpointsCount: 1,
            sessionCount: 1,
            sessionId: 's',
            agents,
            firstPromptPreview: '',
            createdAt: '',
            isTask: false,
            toolUseId: '',
            tokenUsage: null,
          },
        })),
      },
    },
  }
}

describe('mapDashboardBranches', () => {
  it('returns [] when repo is null', () => {
    const data: DashboardBranchesQueryData = { repo: null }
    expect(mapDashboardBranches(data)).toEqual([])
  })

  it('returns [] when branches is missing', () => {
    const data = { repo: {} } as DashboardBranchesQueryData
    expect(mapDashboardBranches(data)).toEqual([])
  })

  it('maps branch name and checkpoint count', () => {
    const data: DashboardBranchesQueryData = {
      repo: {
        branches: [
          { name: 'main', checkpointCount: 12 },
          { name: 'feature/x', checkpointCount: 0 },
        ],
      },
    }

    expect(mapDashboardBranches(data)).toEqual([
      { branch: 'main', checkpoint_commits: 12 },
      { branch: 'feature/x', checkpoint_commits: 0 },
    ])
  })

  it('passes branch names through unchanged (trimming is done in use-dashboard-data)', () => {
    const data: DashboardBranchesQueryData = {
      repo: {
        branches: [{ name: '  main  ', checkpointCount: 3 }],
      },
    }

    expect(mapDashboardBranches(data)).toEqual([
      { branch: '  main  ', checkpoint_commits: 3 },
    ])
  })
})

describe('mapRepoUserStrings / mapRepoAgentStrings', () => {
  it('maps user keys and dedupes', () => {
    const users = mapRepoUserStrings(['a@b.com', 'Alice', 'a@b.com'])
    expect(users.map((u) => u.key).sort()).toEqual(['a@b.com', 'alice'])
  })

  it('maps agent keys and dedupes', () => {
    const agents = mapRepoAgentStrings(['Claude Code', 'claude-code'])
    expect(agents.map((a) => a.key)).toEqual(['claude-code'])
  })
})

describe('mapDashboardCommitRows', () => {
  it('with userFilterFromServer, does not drop commits when payload still lists multiple authors', () => {
    const data: DashboardCommitsQueryData = {
      repo: {
        commits: {
          edges: [
            commitEdge({
              sha: 'aaa',
              authorEmail: 'alice@example.com',
              checkpointAgents: [['codex']],
            }),
            commitEdge({
              sha: 'bbb',
              authorEmail: 'bob@example.com',
              checkpointAgents: [['claude-code']],
            }),
          ],
        },
      },
    }

    const commitRows = mapDashboardCommitRows(data, {
      user: 'alice@example.com',
      agent: null,
      userFilterFromServer: true,
    })

    expect(commitRows).toHaveLength(2)
  })

  it('filters rows by agent when set', () => {
    const data: DashboardCommitsQueryData = {
      repo: {
        commits: {
          edges: [
            commitEdge({
              sha: 'aaa',
              authorEmail: 'alice@example.com',
              checkpointAgents: [['codex']],
            }),
            commitEdge({
              sha: 'bbb',
              authorEmail: 'bob@example.com',
              checkpointAgents: [['claude-code']],
            }),
          ],
        },
      },
    }

    const commitRows = mapDashboardCommitRows(data, {
      user: null,
      agent: 'claude-code',
    })

    expect(commitRows.map((r) => r.commit.sha)).toEqual(['bbb'])
  })
})
