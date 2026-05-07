import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  requestRuntimeGraphQL,
  subscribeRuntimeGraphQL,
} from '@/api/runtime/client'
import {
  fetchRuntimeDebugSnapshot,
  filterDebugLogLines,
  subscribeRuntimeDebugEvents,
  validateDebugSync,
} from './api'

vi.mock('@/api/runtime/client', () => ({
  requestRuntimeGraphQL: vi.fn(),
  subscribeRuntimeGraphQL: vi.fn(),
}))

const mockRequestRuntimeGraphQL = vi.mocked(requestRuntimeGraphQL)
const mockSubscribeRuntimeGraphQL = vi.mocked(subscribeRuntimeGraphQL)

describe('fetchRuntimeDebugSnapshot', () => {
  beforeEach(() => {
    mockRequestRuntimeGraphQL.mockReset()
    mockSubscribeRuntimeGraphQL.mockReset()
  })

  it('loads runtime and debug snapshots for the selected repo', async () => {
    mockRequestRuntimeGraphQL.mockResolvedValue({
      data: {
        runtimeSnapshot: {
          repoId: 'repo-1',
          taskQueue: {
            persisted: true,
            queuedTasks: 1,
            runningTasks: 1,
            failedTasks: 0,
            completedRecentTasks: 4,
            paused: false,
            pausedReason: null,
            lastAction: 'queued watcher sync',
            lastUpdatedUnix: 1700000000,
            byKind: [
              {
                kind: 'Sync',
                queuedTasks: 1,
                runningTasks: 1,
                failedTasks: 0,
                completedRecentTasks: 2,
              },
            ],
            currentRepoTasks: [],
          },
          currentStateConsumer: {
            persisted: true,
            pendingRuns: 0,
            runningRuns: 0,
            failedRuns: 0,
            completedRecentRuns: 1,
            lastAction: null,
            lastUpdatedUnix: 1700000000,
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
        },
        runtimeDebugSnapshot: {
          repoId: 'repo-1',
          producerSpool: {
            pendingCount: 2,
            runningCount: 0,
            jobs: [
              {
                jobId: 'job-1',
                status: 'pending',
                payloadKind: 'post_merge_refresh',
                source: 'post_merge',
                dedupeKey: 'post_merge:abc',
                attempts: 0,
                availableAtUnix: 1700000000,
                submittedAtUnix: 1700000000,
                updatedAtUnix: 1700000000,
                lastError: null,
                pathCount: 1,
                paths: ['src/lib.rs'],
                commitSha: null,
                headSha: 'abc',
              },
            ],
          },
          repoState: {
            branch: 'main',
            headSha: 'abc',
            mergeState: 'none',
            stagedPaths: ['src/lib.rs'],
            unstagedPaths: [],
            untrackedPaths: [],
            deletedPaths: [],
          },
          watcher: {
            registered: false,
            repoRoot: null,
            pid: null,
            state: null,
          },
          supportingLogs: {
            available: true,
            path: '/tmp/bitloops.log',
            lines: [],
          },
        },
      },
    })
    const signal = new AbortController().signal

    const snapshot = await fetchRuntimeDebugSnapshot('repo-1', { signal })

    expect(mockRequestRuntimeGraphQL).toHaveBeenCalledWith(
      expect.stringContaining('runtimeDebugSnapshot'),
      { repoId: 'repo-1' },
      { signal },
    )
    expect(snapshot.repoId).toBe('repo-1')
    expect(snapshot.taskQueue.queuedTasks).toBe(1)
    expect(snapshot.producerSpool.pendingCount).toBe(2)
    expect(snapshot.issues.map((issue) => issue.id)).toEqual([
      'producer-spool-pending',
      'watcher-unregistered',
      'repo-has-staged-paths',
    ])
  })
})

describe('subscribeRuntimeDebugEvents', () => {
  beforeEach(() => {
    mockSubscribeRuntimeGraphQL.mockReset()
  })

  it('subscribes to runtime events for the selected repo', () => {
    const unsubscribe = vi.fn()
    const onEvent = vi.fn()
    const onError = vi.fn()
    mockSubscribeRuntimeGraphQL.mockReturnValue(unsubscribe)

    const result = subscribeRuntimeDebugEvents('repo-1', { onEvent, onError })

    expect(mockSubscribeRuntimeGraphQL).toHaveBeenCalledWith(
      expect.stringContaining('runtimeEvents'),
      { repoId: 'repo-1' },
      expect.objectContaining({
        onData: expect.any(Function),
        onError,
      }),
    )

    const handlers = mockSubscribeRuntimeGraphQL.mock.calls[0]?.[2]
    handlers?.onData({
      runtimeEvents: {
        domain: 'task_queue',
        repoId: 'repo-1',
        initSessionId: null,
        updatedAtUnix: 1700000000,
        taskId: 'task-1',
        runId: null,
        mailboxName: null,
      },
    })

    expect(onEvent).toHaveBeenCalledWith({
      domain: 'task_queue',
      repoId: 'repo-1',
      initSessionId: null,
      updatedAtUnix: 1700000000,
      taskId: 'task-1',
      runId: null,
      mailboxName: null,
    })
    expect(result).toBe(unsubscribe)
  })
})

describe('validateDebugSync', () => {
  beforeEach(() => {
    mockRequestRuntimeGraphQL.mockReset()
  })

  it('enqueues a validate sync task for the selected repo', async () => {
    mockRequestRuntimeGraphQL.mockResolvedValue({
      data: {
        validateSync: {
          merged: false,
          task: {
            taskId: 'sync-task-1',
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
          },
        },
      },
    })
    const signal = new AbortController().signal

    const result = await validateDebugSync('repo-1', { signal })

    expect(mockRequestRuntimeGraphQL).toHaveBeenCalledWith(
      expect.stringContaining('validateSync'),
      { repoId: 'repo-1' },
      { signal },
    )
    expect(result.task.taskId).toBe('sync-task-1')
    expect(result.task.syncSpec?.mode).toBe('validate')
    expect(result.merged).toBe(false)
  })
})

describe('filterDebugLogLines', () => {
  it('filters daemon log lines by normalized level', () => {
    const lines = [
      { level: 'INFO', message: 'started', raw: 'info', timestampUnix: null },
      { level: 'WARN', message: 'locked', raw: 'warn', timestampUnix: null },
      { level: 'ERROR', message: 'failed', raw: 'error', timestampUnix: null },
      { level: null, message: 'raw', raw: 'raw', timestampUnix: null },
    ]

    expect(filterDebugLogLines(lines, 'all')).toHaveLength(4)
    expect(filterDebugLogLines(lines, 'warn').map((line) => line.raw)).toEqual([
      'warn',
    ])
    expect(filterDebugLogLines(lines, 'error').map((line) => line.raw)).toEqual(
      ['error'],
    )
    expect(filterDebugLogLines(lines, 'debug')).toHaveLength(0)
  })
})
