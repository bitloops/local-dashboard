import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Debug } from './index'
import type { DebugRuntimeEvent, DebugTask, RuntimeDebugSnapshot } from './api'

const mocks = vi.hoisted(() => ({
  fetchDebugRepositories: vi.fn(),
  fetchRuntimeDebugSnapshot: vi.fn(),
  subscribeRuntimeDebugEvents: vi.fn(),
  validateDebugSync: vi.fn(),
}))

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>()
  return {
    ...actual,
    fetchDebugRepositories: mocks.fetchDebugRepositories,
    fetchRuntimeDebugSnapshot: mocks.fetchRuntimeDebugSnapshot,
    subscribeRuntimeDebugEvents: mocks.subscribeRuntimeDebugEvents,
    validateDebugSync: mocks.validateDebugSync,
  }
})

const idleSnapshot: RuntimeDebugSnapshot = {
  repoId: 'repo-1',
  taskQueue: {
    persisted: true,
    queuedTasks: 0,
    runningTasks: 0,
    failedTasks: 0,
    completedRecentTasks: 0,
    paused: false,
    pausedReason: null,
    lastAction: null,
    lastUpdatedUnix: 0,
    byKind: [],
    currentRepoTasks: [],
  },
  currentStateConsumer: {
    persisted: true,
    pendingRuns: 0,
    runningRuns: 0,
    failedRuns: 0,
    completedRecentRuns: 0,
    lastAction: null,
    lastUpdatedUnix: 0,
  },
  workplane: {
    pendingJobs: 0,
    runningJobs: 0,
    failedJobs: 0,
    completedRecentJobs: 0,
    pools: [],
    mailboxes: [],
  },
  blockedMailboxes: [],
  embeddingsReadinessGate: null,
  producerSpool: {
    pendingCount: 0,
    runningCount: 0,
    jobs: [],
  },
  repoState: {
    branch: 'main',
    headSha: 'abc123',
    mergeState: 'none',
    stagedPaths: [],
    unstagedPaths: [],
    untrackedPaths: [],
    deletedPaths: [],
  },
  watcher: {
    registered: true,
    repoRoot: '/repo',
    pid: 123,
    state: 'ready',
  },
  supportingLogs: {
    available: true,
    path: '/tmp/bitloops.log',
    lines: [],
  },
  issues: [],
}

function mockRepositoryLoad() {
  mocks.fetchDebugRepositories.mockResolvedValue([
    {
      repoId: 'repo-1',
      identity: 'github://bitloops/bitloops',
      name: 'bitloops',
      provider: 'github',
      organization: 'bitloops',
      defaultBranch: 'main',
    },
  ])
}

function validateSyncTask(overrides: Partial<DebugTask> = {}): DebugTask {
  return {
    taskId: 'sync-task-validate-1',
    kind: 'Sync',
    source: 'manual_cli',
    status: 'Queued',
    queuePosition: 1,
    tasksAhead: 0,
    error: null,
    syncSpec: {
      mode: 'validate',
      paths: [],
    },
    syncProgress: {
      phase: 'INITIALIZING',
      pathsCompleted: 0,
      pathsTotal: 0,
      pathsRemaining: 0,
    },
    syncResult: null,
    ...overrides,
  }
}

describe('Debug', () => {
  beforeEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    mocks.subscribeRuntimeDebugEvents.mockReturnValue(vi.fn())
    mocks.validateDebugSync.mockResolvedValue({
      merged: false,
      task: validateSyncTask(),
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('explains the Workplane metric on hover', async () => {
    mockRepositoryLoad()
    mocks.fetchRuntimeDebugSnapshot.mockResolvedValue(idleSnapshot)

    const user = userEvent.setup()
    render(<Debug />)

    await waitFor(() => {
      expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledWith(
        'repo-1',
        expect.any(Object),
      )
    })
    await user.hover(screen.getByRole('button', { name: 'About Workplane' }))

    expect(
      await screen.findAllByText(
        /separate from the main task queue and producer spool/i,
      ),
    ).not.toHaveLength(0)
    expect(screen.getAllByText(/generating code summaries/i)).not.toHaveLength(
      0,
    )
    expect(screen.getAllByText(/refreshing clone matches/i)).not.toHaveLength(0)
  })

  it('debounces runtime events before refetching the debug snapshot', async () => {
    mockRepositoryLoad()
    mocks.fetchRuntimeDebugSnapshot
      .mockResolvedValueOnce(idleSnapshot)
      .mockResolvedValueOnce({
        ...idleSnapshot,
        taskQueue: {
          ...idleSnapshot.taskQueue,
          queuedTasks: 1,
        },
      })

    let onRuntimeEvent: ((event: DebugRuntimeEvent) => void) | undefined
    mocks.subscribeRuntimeDebugEvents.mockImplementation(
      (_repoId, handlers) => {
        onRuntimeEvent = handlers.onEvent
        return vi.fn()
      },
    )

    render(<Debug />)

    await waitFor(() => {
      expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledTimes(1)
    })
    expect(mocks.subscribeRuntimeDebugEvents).toHaveBeenCalledWith(
      'repo-1',
      expect.objectContaining({
        onEvent: expect.any(Function),
        onError: expect.any(Function),
      }),
    )

    act(() => {
      onRuntimeEvent?.({
        domain: 'task_queue',
        repoId: 'repo-1',
        initSessionId: null,
        updatedAtUnix: 1700000000,
        taskId: 'task-1',
        runId: null,
        mailboxName: null,
      })
    })

    expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledTimes(1)
    await new Promise((resolve) => window.setTimeout(resolve, 450))
    await waitFor(() => {
      expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  it('queues validate sync from the debug header and refreshes the snapshot', async () => {
    mockRepositoryLoad()
    mocks.fetchRuntimeDebugSnapshot
      .mockResolvedValueOnce(idleSnapshot)
      .mockResolvedValueOnce({
        ...idleSnapshot,
        taskQueue: {
          ...idleSnapshot.taskQueue,
          queuedTasks: 1,
          currentRepoTasks: [validateSyncTask()],
        },
      })

    const user = userEvent.setup()
    render(<Debug />)

    await waitFor(() => {
      expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledTimes(1)
    })
    await user.click(screen.getByRole('button', { name: /validate sync/i }))

    expect(mocks.validateDebugSync).toHaveBeenCalledWith('repo-1')
    expect(await screen.findByText(/validate sync queued/i)).toBeVisible()
    await waitFor(() => {
      expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledTimes(2)
    })
  })

  it('reports when validate sync passes after the task completes', async () => {
    mockRepositoryLoad()
    mocks.fetchRuntimeDebugSnapshot
      .mockResolvedValueOnce(idleSnapshot)
      .mockResolvedValueOnce({
        ...idleSnapshot,
        taskQueue: {
          ...idleSnapshot.taskQueue,
          runningTasks: 1,
          currentRepoTasks: [
            validateSyncTask({
              status: 'Running',
              syncProgress: {
                phase: 'VALIDATING',
                pathsCompleted: 4,
                pathsTotal: 8,
                pathsRemaining: 4,
              },
            }),
          ],
        },
      })
      .mockResolvedValueOnce({
        ...idleSnapshot,
        taskQueue: {
          ...idleSnapshot.taskQueue,
          completedRecentTasks: 1,
          currentRepoTasks: [
            validateSyncTask({
              status: 'Completed',
              queuePosition: null,
              tasksAhead: null,
              syncResult: {
                success: true,
                mode: 'validate',
                parseErrors: 0,
                validation: {
                  valid: true,
                  expectedArtefacts: 10,
                  actualArtefacts: 10,
                  expectedEdges: 4,
                  actualEdges: 4,
                  missingArtefacts: 0,
                  staleArtefacts: 0,
                  mismatchedArtefacts: 0,
                  missingEdges: 0,
                  staleEdges: 0,
                  mismatchedEdges: 0,
                  filesWithDrift: [],
                },
              },
            }),
          ],
        },
      })

    let onRuntimeEvent: ((event: DebugRuntimeEvent) => void) | undefined
    mocks.subscribeRuntimeDebugEvents.mockImplementation(
      (_repoId, handlers) => {
        onRuntimeEvent = handlers.onEvent
        return vi.fn()
      },
    )

    const user = userEvent.setup()
    render(<Debug />)

    await waitFor(() => {
      expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledTimes(1)
    })
    await user.click(screen.getByRole('button', { name: /validate sync/i }))
    expect(await screen.findByText(/validate sync running/i)).toBeVisible()

    act(() => {
      onRuntimeEvent?.({
        domain: 'task_queue',
        repoId: 'repo-1',
        initSessionId: null,
        updatedAtUnix: 1700000001,
        taskId: 'sync-task-validate-1',
        runId: null,
        mailboxName: null,
      })
    })

    await new Promise((resolve) => window.setTimeout(resolve, 450))
    expect(await screen.findByText(/validate sync passed/i)).toBeVisible()
  })

  it('reports validation drift separately from task failure', async () => {
    mockRepositoryLoad()
    mocks.fetchRuntimeDebugSnapshot
      .mockResolvedValueOnce(idleSnapshot)
      .mockResolvedValueOnce({
        ...idleSnapshot,
        taskQueue: {
          ...idleSnapshot.taskQueue,
          completedRecentTasks: 1,
          currentRepoTasks: [
            validateSyncTask({
              status: 'Completed',
              queuePosition: null,
              tasksAhead: null,
              syncResult: {
                success: false,
                mode: 'validate',
                parseErrors: 0,
                validation: {
                  valid: false,
                  expectedArtefacts: 10,
                  actualArtefacts: 11,
                  expectedEdges: 4,
                  actualEdges: 4,
                  missingArtefacts: 0,
                  staleArtefacts: 1,
                  mismatchedArtefacts: 0,
                  missingEdges: 0,
                  staleEdges: 0,
                  mismatchedEdges: 0,
                  filesWithDrift: [
                    {
                      path: 'src/a.ts',
                      missingArtefacts: 0,
                      staleArtefacts: 1,
                      mismatchedArtefacts: 0,
                      missingEdges: 0,
                      staleEdges: 0,
                      mismatchedEdges: 0,
                    },
                  ],
                },
              },
            }),
          ],
        },
      })

    const user = userEvent.setup()
    render(<Debug />)

    await waitFor(() => {
      expect(mocks.fetchRuntimeDebugSnapshot).toHaveBeenCalledTimes(1)
    })
    await user.click(screen.getByRole('button', { name: /validate sync/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /validate sync found drift/i,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(/1 stale artefacts/i)
  })
})
