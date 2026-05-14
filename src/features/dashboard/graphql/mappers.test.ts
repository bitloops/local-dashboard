import { describe, expect, it } from 'vitest'
import {
  mapDashboardAgents,
  mapDashboardBranches,
  mapDashboardCheckpointDetail,
  mapDashboardCommitRows,
  mapDashboardInteractionSessionDetail,
  mapDashboardInteractionSessions,
  mapDashboardInteractionUpdate,
  mapDashboardRepositories,
  mapDashboardUsers,
} from './mappers'
import type {
  DashboardAgentsQueryData,
  DashboardBranchesQueryData,
  DashboardCheckpointDetailQueryData,
  DashboardCommitsQueryData,
  DashboardInteractionSessionDetailQueryData,
  DashboardInteractionSessionNode,
  DashboardInteractionSessionsQueryData,
  DashboardInteractionToolUseNode,
  DashboardInteractionUpdateNode,
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

function interactionToolUse(
  overrides: Partial<DashboardInteractionToolUseNode> = {},
): DashboardInteractionToolUseNode {
  return {
    toolInvocationId: 'invocation-1',
    toolUseId: 'tool-1',
    sessionId: 'session-1',
    turnId: 'turn-1',
    toolKind: 'shell',
    taskDescription: 'Run tests',
    inputSummary: 'pnpm test',
    outputSummary: 'passed',
    source: 'codex',
    command: 'pnpm test',
    commandBinary: 'pnpm',
    commandArgv: ['test'],
    transcriptPath: '/tmp/session.jsonl',
    startedAt: '2025-01-01T00:00:00.000Z',
    endedAt: '2025-01-01T00:01:00.000Z',
    ...overrides,
  }
}

function interactionSession(
  overrides: Partial<DashboardInteractionSessionNode> = {},
): DashboardInteractionSessionNode {
  return {
    sessionId: 'session-1',
    branch: 'main',
    actor: {
      id: 'actor-1',
      name: 'Alice',
      email: 'alice@example.com',
      source: 'git',
    },
    agentType: 'codex',
    model: 'gpt-5',
    firstPrompt: 'Fix failing tests',
    startedAt: '2025-01-01T00:00:00.000Z',
    endedAt: '2025-01-01T00:10:00.000Z',
    lastEventAt: '2025-01-01T00:09:00.000Z',
    turnCount: 2,
    checkpointCount: 1,
    tokenUsage: {
      inputTokens: 100,
      outputTokens: 50,
      cacheCreationTokens: 10,
      cacheReadTokens: 5,
      apiCallCount: 2,
    },
    filePaths: ['src/App.tsx'],
    toolUses: [interactionToolUse()],
    linkedCheckpoints: [
      {
        checkpointId: 'checkpoint-1',
        commitSha: 'abc123',
        name: 'Alice',
        email: 'alice@example.com',
        committedAt: '2025-01-01T00:11:00.000Z',
      },
    ],
    latestCommitAuthor: {
      checkpointId: 'checkpoint-2',
      commitSha: 'def456',
      name: 'Bob',
      email: 'bob@example.com',
      committedAt: '2025-01-01T00:12:00.000Z',
    },
    ...overrides,
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
    expect(
      commitRows[0]?.checkpoints?.map((checkpoint) => checkpoint.checkpoint_id),
    ).toEqual(['cp-1', 'cp-2'])
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
    expect(
      commitRows[0]?.checkpoints?.map((checkpoint) => checkpoint.checkpoint_id),
    ).toEqual(['cp-fallback'])
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
          transcript_entries: [],
        },
      ],
    })
  })
})

describe('mapDashboardInteractionUpdate', () => {
  it('maps interaction update snapshots', () => {
    const data: DashboardInteractionUpdateNode = {
      repoId: 'repo-1',
      sessionCount: 4,
      turnCount: 7,
      latestSessionId: 'session-4',
      latestSessionUpdatedAt: '2025-01-01T00:00:00.000Z',
      latestTurnId: 'turn-7',
      latestTurnUpdatedAt: '2025-01-01T00:01:00.000Z',
    }

    expect(mapDashboardInteractionUpdate(data)).toEqual({
      repo_id: 'repo-1',
      session_count: 4,
      turn_count: 7,
      latest_session_id: 'session-4',
      latest_session_updated_at: '2025-01-01T00:00:00.000Z',
      latest_turn_id: 'turn-7',
      latest_turn_updated_at: '2025-01-01T00:01:00.000Z',
    })
  })
})

describe('mapDashboardInteractionSessions', () => {
  it('maps interaction sessions with actors, tool uses, checkpoints, and token usage', () => {
    const data: DashboardInteractionSessionsQueryData = {
      interactionSessions: [interactionSession()],
    }

    expect(mapDashboardInteractionSessions(data)).toEqual([
      {
        session_id: 'session-1',
        branch: 'main',
        actor: {
          id: 'actor-1',
          name: 'Alice',
          email: 'alice@example.com',
          source: 'git',
        },
        agent_type: 'codex',
        model: 'gpt-5',
        first_prompt: 'Fix failing tests',
        started_at: '2025-01-01T00:00:00.000Z',
        ended_at: '2025-01-01T00:10:00.000Z',
        last_event_at: '2025-01-01T00:09:00.000Z',
        turn_count: 2,
        checkpoint_count: 1,
        token_usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_tokens: 10,
          cache_read_tokens: 5,
          api_call_count: 2,
        },
        file_paths: ['src/App.tsx'],
        tool_uses: [
          {
            tool_invocation_id: 'invocation-1',
            tool_use_id: 'tool-1',
            session_id: 'session-1',
            turn_id: 'turn-1',
            tool_kind: 'shell',
            task_description: 'Run tests',
            input_summary: 'pnpm test',
            output_summary: 'passed',
            source: 'codex',
            command: 'pnpm test',
            command_binary: 'pnpm',
            command_argv: ['test'],
            transcript_path: '/tmp/session.jsonl',
            started_at: '2025-01-01T00:00:00.000Z',
            ended_at: '2025-01-01T00:01:00.000Z',
          },
        ],
        linked_checkpoints: [
          {
            checkpoint_id: 'checkpoint-1',
            commit_sha: 'abc123',
            name: 'Alice',
            email: 'alice@example.com',
            committed_at: '2025-01-01T00:11:00.000Z',
          },
        ],
        latest_commit_author: {
          checkpoint_id: 'checkpoint-2',
          commit_sha: 'def456',
          name: 'Bob',
          email: 'bob@example.com',
          committed_at: '2025-01-01T00:12:00.000Z',
        },
      },
    ])
  })

  it('normalises absent interaction session optional fields', () => {
    const data: DashboardInteractionSessionsQueryData = {
      interactionSessions: [
        interactionSession({
          branch: null,
          actor: {},
          model: null,
          firstPrompt: null,
          endedAt: null,
          lastEventAt: null,
          tokenUsage: null,
          filePaths: [],
          toolUses: [
            interactionToolUse({
              toolInvocationId: '',
              turnId: null,
              toolKind: null,
              taskDescription: null,
              inputSummary: null,
              outputSummary: null,
              source: null,
              command: null,
              commandBinary: null,
              commandArgv: null,
              transcriptPath: null,
              startedAt: null,
              endedAt: null,
            }),
          ],
          linkedCheckpoints: [
            {
              checkpointId: 'checkpoint-empty',
              commitSha: 'abc123',
              name: null,
              email: null,
              committedAt: null,
            },
          ],
          latestCommitAuthor: null,
        }),
      ],
    }

    const [session] = mapDashboardInteractionSessions(data)

    expect(session).toMatchObject({
      branch: null,
      actor: null,
      model: null,
      first_prompt: null,
      ended_at: null,
      last_event_at: null,
      token_usage: null,
      file_paths: [],
      latest_commit_author: null,
    })
    expect(session?.tool_uses[0]).toMatchObject({
      tool_invocation_id: '',
      turn_id: null,
      tool_kind: null,
      command_argv: [],
      transcript_path: null,
      started_at: null,
      ended_at: null,
    })
    expect(session?.linked_checkpoints[0]).toMatchObject({
      checkpoint_id: 'checkpoint-empty',
      name: null,
      email: null,
      committed_at: null,
    })
  })
})

describe('mapDashboardInteractionSessionDetail', () => {
  it('maps interaction session detail turns and raw events', () => {
    const data: DashboardInteractionSessionDetailQueryData = {
      interactionSession: {
        summary: interactionSession(),
        turns: [
          {
            turnId: 'turn-1',
            sessionId: 'session-1',
            branch: 'main',
            actor: {
              id: 'actor-1',
              name: null,
              email: 'alice@example.com',
              source: 'git',
            },
            turnNumber: 1,
            prompt: 'Run tests',
            summary: 'Tests passed',
            agentType: 'codex',
            model: 'gpt-5',
            startedAt: '2025-01-01T00:00:00.000Z',
            endedAt: null,
            tokenUsage: null,
            filesModified: ['src/App.tsx'],
            checkpointId: null,
            toolUses: [interactionToolUse()],
          },
        ],
        rawEvents: [
          {
            eventId: 'event-1',
            sessionId: 'session-1',
            turnId: null,
            eventType: 'tool_use',
            eventTime: '2025-01-01T00:00:30.000Z',
            agentType: 'codex',
            model: null,
            toolUseId: null,
            toolKind: null,
            taskDescription: null,
            subagentId: null,
            payload: { status: 'ok' },
          },
        ],
      },
    }

    expect(mapDashboardInteractionSessionDetail(data)).toMatchObject({
      summary: {
        session_id: 'session-1',
      },
      turns: [
        {
          turn_id: 'turn-1',
          actor: {
            id: 'actor-1',
            name: null,
            email: 'alice@example.com',
            source: 'git',
          },
          prompt: 'Run tests',
          summary: 'Tests passed',
          token_usage: null,
          checkpoint_id: null,
          files_modified: ['src/App.tsx'],
        },
      ],
      raw_events: [
        {
          event_id: 'event-1',
          turn_id: null,
          model: null,
          tool_use_id: null,
          tool_kind: null,
          task_description: null,
          subagent_id: null,
          payload: { status: 'ok' },
        },
      ],
    })
  })

  it('returns null when interaction session detail is absent', () => {
    expect(
      mapDashboardInteractionSessionDetail({ interactionSession: null }),
    ).toBeNull()
  })
})
