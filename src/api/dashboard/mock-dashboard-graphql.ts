import type { GraphQLResponseEnvelope } from '@/api/graphql/types'
import type {
  DashboardCheckpointNode,
  DashboardCommitFileDiffNode,
  DashboardInteractionSessionNode,
  DashboardInteractionTurnNode,
  DashboardTokenUsageNode,
} from '@/features/dashboard/graphql/types'

const MOCK_TOKEN_USAGE_FULL: DashboardTokenUsageNode = {
  inputTokens: 12_400,
  outputTokens: 8_200,
  cacheCreationTokens: 1_200,
  cacheReadTokens: 6_100,
  apiCallCount: 28,
}

function mockCommitFilesTouched(): DashboardCommitFileDiffNode[] {
  return [
    {
      filepath: 'src/api/dashboard/client.ts',
      additionsCount: 42,
      deletionsCount: 6,
      changeKind: 'modified',
      copiedFromPath: null,
      copiedFromBlobSha: null,
    },
    {
      filepath: 'src/api/dashboard/mock-dashboard-graphql.ts',
      additionsCount: 310,
      deletionsCount: 0,
      changeKind: 'added',
      copiedFromPath: null,
      copiedFromBlobSha: null,
    },
    {
      filepath: 'src/legacy-config.ts',
      additionsCount: 0,
      deletionsCount: 88,
      changeKind: 'deleted',
      copiedFromPath: null,
      copiedFromBlobSha: null,
    },
    {
      filepath: 'src/features/dashboard/types.ts',
      additionsCount: 14,
      deletionsCount: 14,
      changeKind: 'renamed',
      copiedFromPath: 'src/features/dashboard/types-old.ts',
      copiedFromBlobSha: 'deadbeef00000000000000000000000000000001',
    },
  ]
}

function mockCheckpointSessionsDetail() {
  return [
    {
      sessionIndex: 0,
      sessionId: 'mock-session-1',
      agent: 'claude-code',
      createdAt: '2025-01-15T14:30:00.000Z',
      isTask: false,
      toolUseId: 'tool-use-primary',
      metadataJson: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        temperature: 0,
        stopReason: 'end_turn',
      }),
      transcriptJsonl: [
        JSON.stringify({ role: 'user', text: 'Add dashboard API mocks.' }),
        JSON.stringify({
          role: 'assistant',
          text: 'I will add mock-dashboard-graphql.ts and gate it with VITE_DASHBOARD_API_MOCK.',
        }),
      ].join('\n'),
      promptsText:
        'System: You are a coding agent.\n\nUser: Populate checkpoint mock with full filesTouched and tokenUsage.',
      contextText:
        'Repository: demo/local-dashboard\nBranch: main\nWorking tree: clean\nOpen files: client.ts, mock-dashboard-graphql.ts',
    },
    {
      sessionIndex: 1,
      sessionId: 'mock-session-2',
      agent: 'claude-code',
      createdAt: '2025-01-15T15:05:30.000Z',
      isTask: true,
      toolUseId: 'tool-use-subtask',
      metadataJson: JSON.stringify({
        task: true,
        parentSessionId: 'mock-session-1',
      }),
      transcriptJsonl: JSON.stringify({
        role: 'user',
        text: 'Follow-up: align sessionCount with number of sessions below.',
      }),
      promptsText: 'Subtask: verify checkpoint detail sessions array renders in the sheet.',
      contextText:
        'Inherits repo context from session 0; focused on DashboardCheckpointDetail mapping.',
    },
  ]
}

export function isDashboardApiMockEnabled(): boolean {
  return import.meta.env.VITE_DASHBOARD_API_MOCK === 'true'
}

function parseOperationName(query: string): string | null {
  const match = query.match(/\b(?:query|mutation)\s+(\w+)/)
  return match?.[1] ?? null
}

function mockCheckpoint(
  checkpointId: string,
  overrides: Partial<DashboardCheckpointNode> = {},
): DashboardCheckpointNode {
  return {
    checkpointId,
    strategy: 'default',
    branch: 'main',
    checkpointsCount: 2,
    filesTouched: mockCommitFilesTouched(),
    sessionCount: 2,
    tokenUsage: MOCK_TOKEN_USAGE_FULL,
    sessionId:
      checkpointId === 'cp-mock-2' ? 'mock-session-2' : 'mock-session-1',
    agents: ['claude-code', 'cursor-agent'],
    firstPromptPreview:
      checkpointId === 'cp-mock-2'
        ? 'Second checkpoint: refine types and mappers.'
        : 'Primary checkpoint: wire dashboard GraphQL mocks for local dev.',
    createdAt:
      checkpointId === 'cp-mock-2'
        ? '2025-01-15T15:02:00.000Z'
        : '2025-01-15T14:30:00.000Z',
    isTask: checkpointId === 'cp-mock-2',
    toolUseId: `tool-${checkpointId}`,
    ...overrides,
  }
}

function mockInteractionSession(
  sessionId: string,
): DashboardInteractionSessionNode {
  return {
    sessionId,
    branch: 'main',
    actor: {
      id: 'actor-1',
      name: 'Local Dev',
      email: 'dev@example.com',
      source: 'mock',
    },
    agentType: 'claude-code',
    model: 'claude-3-5-sonnet-20241022',
    firstPrompt: 'Add turns to the dashboard (mock data)',
    startedAt: '2025-01-15T14:30:00.000Z',
    endedAt: null,
    lastEventAt: '2025-01-15T14:35:00.000Z',
    turnCount: 2,
    checkpointCount: 1,
    tokenUsage: {
      inputTokens: 1200,
      outputTokens: 800,
      cacheCreationTokens: 400,
      cacheReadTokens: 2100,
      apiCallCount: 4,
    },
    filePaths: ['src/features/dashboard/dashboard-view.tsx'],
    toolUses: [
      {
        toolUseId: 'tu-session-1',
        sessionId,
        turnId: null,
        toolKind: 'glob',
        taskDescription: 'Find dashboard files',
        subagentId: null,
        transcriptPath: null,
        startedAt: '2025-01-15T14:30:05.000Z',
        endedAt: '2025-01-15T14:30:06.000Z',
      },
    ],
    linkedCheckpoints: [
      {
        checkpointId: 'cp-mock-1',
        commitSha: 'aaaaaaa000000000000000000000000000000000',
        name: 'Local Dev',
        email: 'dev@example.com',
        committedAt: '2025-01-15T14:25:00.000Z',
      },
    ],
    latestCommitAuthor: {
      checkpointId: 'cp-mock-1',
      commitSha: 'aaaaaaa000000000000000000000000000000000',
      name: 'Local Dev',
      email: 'dev@example.com',
      committedAt: '2025-01-15T14:25:00.000Z',
    },
  }
}

function mockTranscriptFragmentTurn1(): string {
  return [
    JSON.stringify({
      type: 'user',
      timestamp: '2025-01-15T14:30:00.500Z',
      uuid: 'mock-tf-u1',
      message: { content: 'Wire mock data for the dashboard in dev.' },
    }),
    JSON.stringify({
      type: 'assistant',
      timestamp: '2025-01-15T14:30:01.200Z',
      uuid: 'mock-tf-a1',
      message: [
        {
          type: 'thinking',
          thinking: 'Plan: add mock module and gate with VITE_DASHBOARD_API_MOCK.',
        },
        {
          type: 'text',
          text: 'I will add mock-dashboard-graphql.ts and wire requestDashboardGraphQL.',
        },
      ],
    }),
  ].join('\n')
}

function mockTranscriptFragmentTurn2(): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp: '2025-01-15T14:31:45.000Z',
    uuid: 'mock-tf-a2',
    message: [
      {
        type: 'tool_use',
        name: 'apply_patch',
        input: { path: 'src/api/dashboard/mock-dashboard-graphql.ts' },
      },
      {
        type: 'text',
        text: 'Added mock GraphQL responses for session detail and expanded turn payloads.',
      },
    ],
  })
}

function mockTurnsForSession(sessionId: string): DashboardInteractionTurnNode[] {
  const t1 = `${sessionId}-t1`
  const t2 = `${sessionId}-t2`
  return [
    {
      turnId: t1,
      sessionId,
      branch: 'main',
      turnNumber: 1,
      prompt: 'Wire mock data for the dashboard in dev.',
      summary: 'User asked to wire dev mocks; assistant planned file changes.',
      agentType: 'claude-code',
      model: 'claude-3-5-sonnet-20241022',
      startedAt: '2025-01-15T14:30:00.000Z',
      endedAt: '2025-01-15T14:30:45.000Z',
      tokenUsage: {
        inputTokens: 4200,
        outputTokens: 980,
        cacheCreationTokens: 1200,
        cacheReadTokens: 3400,
        apiCallCount: 6,
      },
      filesModified: [
        'src/api/dashboard/client.ts',
        'src/vite-env.d.ts',
      ],
      checkpointId: 'cp-mock-1',
      toolUses: [
        {
          toolUseId: 'tu-t1-read',
          sessionId,
          turnId: t1,
          toolKind: 'read_file',
          taskDescription: 'Read client.ts for requestDashboardGraphQL',
          subagentId: null,
          transcriptPath: '/tmp/tu-t1-read.jsonl',
          startedAt: '2025-01-15T14:30:08.000Z',
          endedAt: '2025-01-15T14:30:09.500Z',
        },
        {
          toolUseId: 'tu-t1-edit',
          sessionId,
          turnId: t1,
          toolKind: 'str_replace',
          taskDescription: 'Insert mock branch in requestDashboardGraphQL',
          subagentId: null,
          transcriptPath: '/tmp/tu-t1-edit.jsonl',
          startedAt: '2025-01-15T14:30:10.000Z',
          endedAt: '2025-01-15T14:30:22.000Z',
        },
      ],
    },
    {
      turnId: t2,
      sessionId,
      branch: 'main',
      turnNumber: 2,
      prompt: null,
      summary: 'Added mock GraphQL responses for session detail.',
      agentType: 'claude-code',
      model: 'claude-3-5-sonnet-20241022',
      startedAt: '2025-01-15T14:31:00.000Z',
      endedAt: '2025-01-15T14:32:00.000Z',
      tokenUsage: {
        inputTokens: 2100,
        outputTokens: 1500,
        cacheCreationTokens: 0,
        cacheReadTokens: 8000,
        apiCallCount: 5,
      },
      filesModified: [
        'src/api/dashboard/mock-dashboard-graphql.ts',
        'src/features/dashboard/graphql/operations.ts',
      ],
      checkpointId: null,
      toolUses: [
        {
          toolUseId: 'tu-t2-sub',
          sessionId,
          turnId: t2,
          toolKind: 'task',
          taskDescription: 'Subagent: verify operations.ts actor removal',
          subagentId: 'subagent-mock-1',
          transcriptPath: '/tmp/sub-1.jsonl',
          startedAt: '2025-01-15T14:31:05.000Z',
          endedAt: '2025-01-15T14:31:40.000Z',
        },
        {
          toolUseId: 'tu-t2-glob',
          sessionId,
          turnId: t2,
          toolKind: 'glob',
          taskDescription: 'List src/features/dashboard/**/*.tsx',
          subagentId: null,
          transcriptPath: null,
          startedAt: '2025-01-15T14:31:41.000Z',
          endedAt: '2025-01-15T14:31:42.000Z',
        },
      ],
    },
  ]
}

function mockRawEventsForSession(sessionId: string) {
  const t1 = `${sessionId}-t1`
  const t2 = `${sessionId}-t2`
  return [
    {
      eventId: 'ev-turn1-end',
      sessionId,
      turnId: t1,
      eventType: 'turn_end',
      eventTime: '2025-01-15T14:30:45.000Z',
      agentType: 'claude-code',
      model: 'claude-3-5-sonnet-20241022',
      toolUseId: null,
      toolKind: null,
      taskDescription: null,
      subagentId: null,
      payload: {
        transcript_fragment: mockTranscriptFragmentTurn1(),
        usage: { input: 4200, output: 980 },
      },
    },
    {
      eventId: 'ev-turn2-end',
      sessionId,
      turnId: t2,
      eventType: 'turn_end',
      eventTime: '2025-01-15T14:32:00.000Z',
      agentType: 'claude-code',
      model: 'claude-3-5-sonnet-20241022',
      toolUseId: null,
      toolKind: null,
      taskDescription: null,
      subagentId: null,
      payload: {
        transcript_fragment: mockTranscriptFragmentTurn2(),
      },
    },
  ]
}

export function getMockDashboardGraphQLResponse<TData>(
  query: string,
  variables: Record<string, unknown> | undefined,
): GraphQLResponseEnvelope<TData> {
  const op = parseOperationName(query)
  const vars = variables ?? {}

  switch (op) {
    case 'DashboardRepositories':
      return {
        data: {
          repositories: [
            {
              repoId: 'mock-repo-1',
              identity: 'demo/local-dashboard',
              name: 'local-dashboard',
              provider: 'github',
              organization: 'demo',
              defaultBranch: 'main',
            },
          ],
        } as TData,
      }

    case 'DashboardBranches':
      return {
        data: {
          branches: [{ branch: 'main', checkpointCommits: 12 }],
        } as TData,
      }

    case 'DashboardUsers':
      return {
        data: {
          users: [
            {
              key: 'dev@example.com',
              name: 'Local Dev',
              email: 'dev@example.com',
            },
          ],
        } as TData,
      }

    case 'DashboardAgents':
      return {
        data: {
          agents: [{ key: 'claude-code' }],
        } as TData,
      }

    case 'DashboardCommits': {
      const cp1 = mockCheckpoint('cp-mock-1')
      const cp2 = mockCheckpoint('cp-mock-2')
      return {
        data: {
          commits: [
            {
              commit: {
                sha: 'aaaaaaa000000000000000000000000000000000',
                parents: ['bbbbbbb000000000000000000000000000000000'],
                authorName: 'Local Dev',
                authorEmail: 'dev@example.com',
                timestamp: 1_736_951_400,
                message: 'feat(dashboard): mock API for local dev',
                filesTouched: mockCommitFilesTouched(),
              },
              checkpoint: cp1,
              checkpoints: [cp1, cp2],
            },
          ],
        } as TData,
      }
    }

    case 'DashboardCheckpointDetail': {
      const checkpointId = String(vars.checkpointId ?? 'cp-mock-1')
      return {
        data: {
          checkpoint: {
            checkpointId,
            strategy: 'default',
            branch: 'main',
            checkpointsCount: 2,
            filesTouched: mockCommitFilesTouched(),
            sessionCount: 2,
            tokenUsage: MOCK_TOKEN_USAGE_FULL,
            sessions: mockCheckpointSessionsDetail(),
          },
        } as TData,
      }
    }

    case 'DashboardInteractionSessions': {
      return {
        data: {
          interactionSessions: [mockInteractionSession('mock-session-1')],
        } as TData,
      }
    }

    case 'DashboardInteractionSessionDetail': {
      const sessionId = String(vars.sessionId ?? 'mock-session-1')
      const summary = mockInteractionSession(sessionId)
      return {
        data: {
          interactionSession: {
            summary,
            turns: mockTurnsForSession(sessionId),
            rawEvents: mockRawEventsForSession(sessionId),
          },
        } as TData,
      }
    }

    default:
      return {
        errors: [
          {
            message: `[dashboard mock] Unhandled GraphQL operation: ${op ?? '(unknown)'}`,
          },
        ],
      }
  }
}
