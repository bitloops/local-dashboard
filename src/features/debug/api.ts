import {
  fetchDashboardRepositoriesCached,
  type DashboardRepositoryRecord,
} from '@/api/dashboard/client'
import {
  requestRuntimeGraphQL,
  subscribeRuntimeGraphQL,
} from '@/api/runtime/client'
import type { GraphQLRequestOptions } from '@/api/graphql/types'

export type DebugIssueSeverity = 'critical' | 'warning' | 'info'
export type DebugLogLevelFilter = 'all' | 'error' | 'warn' | 'info' | 'debug'

export type DebugIssue = {
  id: string
  severity: DebugIssueSeverity
  title: string
  detail: string
  subsystem: string
}

export type DebugTaskKindCounts = {
  kind: string
  queuedTasks: number
  runningTasks: number
  failedTasks: number
  completedRecentTasks: number
}

export type DebugTask = {
  taskId: string
  kind: string
  source: string
  status: string
  queuePosition: number | null
  tasksAhead: number | null
  error: string | null
  syncSpec: {
    mode: string
    paths: string[]
  } | null
  syncProgress: {
    phase: string
    pathsCompleted: number
    pathsTotal: number
    pathsRemaining: number
  } | null
}

export type DebugTaskQueue = {
  persisted: boolean
  queuedTasks: number
  runningTasks: number
  failedTasks: number
  completedRecentTasks: number
  paused: boolean
  pausedReason: string | null
  lastAction: string | null
  lastUpdatedUnix: number
  byKind: DebugTaskKindCounts[]
  currentRepoTasks: DebugTask[]
}

export type DebugCurrentStateConsumer = {
  persisted: boolean
  pendingRuns: number
  runningRuns: number
  failedRuns: number
  completedRecentRuns: number
  lastAction: string | null
  lastUpdatedUnix: number
}

export type DebugWorkplanePool = {
  poolName: string
  displayName: string
  workerBudget: number
  activeWorkers: number
  pendingJobs: number
  runningJobs: number
  failedJobs: number
  completedRecentJobs: number
}

export type DebugWorkplaneMailbox = {
  mailboxName: string
  displayName: string
  pendingJobs: number
  runningJobs: number
  failedJobs: number
  completedRecentJobs: number
  blockedReason: string | null
}

export type DebugBlockedMailbox = {
  mailboxName: string
  displayName: string
  reason: string
}

export type DebugRuntimeSnapshot = {
  repoId: string
  taskQueue: DebugTaskQueue
  currentStateConsumer: DebugCurrentStateConsumer
  workplane: {
    pendingJobs: number
    runningJobs: number
    failedJobs: number
    completedRecentJobs: number
    pools: DebugWorkplanePool[]
    mailboxes: DebugWorkplaneMailbox[]
  }
  blockedMailboxes: DebugBlockedMailbox[]
  embeddingsReadinessGate: {
    blocked: boolean
    readiness: string | null
    reason: string | null
    activeTaskId: string | null
  } | null
}

export type DebugProducerSpoolJob = {
  jobId: string
  status: string
  payloadKind: string
  source: string | null
  dedupeKey: string | null
  attempts: number
  availableAtUnix: number
  submittedAtUnix: number
  updatedAtUnix: number
  lastError: string | null
  pathCount: number
  paths: string[]
  commitSha: string | null
  headSha: string | null
}

export type DebugProducerSpool = {
  pendingCount: number
  runningCount: number
  jobs: DebugProducerSpoolJob[]
}

export type DebugRepoState = {
  branch: string
  headSha: string
  mergeState: string
  stagedPaths: string[]
  unstagedPaths: string[]
  untrackedPaths: string[]
  deletedPaths: string[]
}

export type DebugWatcherState = {
  registered: boolean
  repoRoot: string | null
  pid: number | null
  state: string | null
}

export type DebugLogLine = {
  level: string | null
  message: string | null
  raw: string
  timestampUnix: number | null
}

export type DebugSupportingLogs = {
  available: boolean
  path: string
  lines: DebugLogLine[]
}

export type RuntimeDebugSnapshot = DebugRuntimeSnapshot & {
  producerSpool: DebugProducerSpool
  repoState: DebugRepoState
  watcher: DebugWatcherState
  supportingLogs: DebugSupportingLogs
  issues: DebugIssue[]
}

export type DebugRuntimeEvent = {
  domain: string
  repoId: string
  initSessionId: string | null
  updatedAtUnix: number
  taskId: string | null
  runId: string | null
  mailboxName: string | null
}

type RuntimeDebugSnapshotQueryData = {
  runtimeSnapshot: DebugRuntimeSnapshot
  runtimeDebugSnapshot: {
    repoId: string
    producerSpool: DebugProducerSpool
    repoState: DebugRepoState
    watcher: DebugWatcherState
    supportingLogs: DebugSupportingLogs
  }
}

type RuntimeDebugEventsSubscriptionData = {
  runtimeEvents: DebugRuntimeEvent | null
}

export type DebugValidateSyncResult = {
  task: DebugTask
  merged: boolean
}

type RuntimeValidateSyncMutationData = {
  validateSync: DebugValidateSyncResult | null
}

const RUNTIME_DEBUG_SNAPSHOT_QUERY = `
  query RuntimeDebugSnapshot($repoId: String!) {
    runtimeSnapshot(repoId: $repoId) {
      repoId
      taskQueue {
        persisted
        queuedTasks
        runningTasks
        failedTasks
        completedRecentTasks
        paused
        pausedReason
        lastAction
        lastUpdatedUnix
        byKind {
          kind
          queuedTasks
          runningTasks
          failedTasks
          completedRecentTasks
        }
        currentRepoTasks {
          taskId
          kind
          source
          status
          queuePosition
          tasksAhead
          error
          syncSpec {
            mode
            paths
          }
          syncProgress {
            phase
            pathsCompleted
            pathsTotal
            pathsRemaining
          }
        }
      }
      currentStateConsumer {
        persisted
        pendingRuns
        runningRuns
        failedRuns
        completedRecentRuns
        lastAction
        lastUpdatedUnix
      }
      workplane {
        pendingJobs
        runningJobs
        failedJobs
        completedRecentJobs
        pools {
          poolName
          displayName
          workerBudget
          activeWorkers
          pendingJobs
          runningJobs
          failedJobs
          completedRecentJobs
        }
        mailboxes {
          mailboxName
          displayName
          pendingJobs
          runningJobs
          failedJobs
          completedRecentJobs
          blockedReason
        }
      }
      blockedMailboxes {
        mailboxName
        displayName
        reason
      }
      embeddingsReadinessGate {
        blocked
        readiness
        reason
        activeTaskId
      }
    }
    runtimeDebugSnapshot(repoId: $repoId) {
      repoId
      producerSpool {
        pendingCount
        runningCount
        jobs {
          jobId
          status
          payloadKind
          source
          dedupeKey
          attempts
          availableAtUnix
          submittedAtUnix
          updatedAtUnix
          lastError
          pathCount
          paths
          commitSha
          headSha
        }
      }
      repoState {
        branch
        headSha
        mergeState
        stagedPaths
        unstagedPaths
        untrackedPaths
        deletedPaths
      }
      watcher {
        registered
        repoRoot
        pid
        state
      }
      supportingLogs {
        available
        path
        lines {
          level
          message
          raw
          timestampUnix
        }
      }
    }
  }
`

const RUNTIME_DEBUG_EVENTS_SUBSCRIPTION = `
  subscription RuntimeDebugEvents($repoId: String!) {
    runtimeEvents(repoId: $repoId) {
      domain
      repoId
      initSessionId
      updatedAtUnix
      taskId
      runId
      mailboxName
    }
  }
`

const VALIDATE_SYNC_MUTATION = `
  mutation DebugValidateSync($repoId: String!) {
    validateSync(repoId: $repoId) {
      merged
      task {
        taskId
        kind
        source
        status
        queuePosition
        tasksAhead
        error
        syncSpec {
          mode
          paths
        }
        syncProgress {
          phase
          pathsCompleted
          pathsTotal
          pathsRemaining
        }
      }
    }
  }
`

export function fetchDebugRepositories(
  options?: GraphQLRequestOptions,
): Promise<DashboardRepositoryRecord[]> {
  return fetchDashboardRepositoriesCached(options)
}

export async function fetchRuntimeDebugSnapshot(
  repoId: string,
  options?: GraphQLRequestOptions,
): Promise<RuntimeDebugSnapshot> {
  const response = await requestRuntimeGraphQL<
    RuntimeDebugSnapshotQueryData,
    { repoId: string }
  >(RUNTIME_DEBUG_SNAPSHOT_QUERY, { repoId }, options)
  const runtimeSnapshot = response.data?.runtimeSnapshot
  const debugSnapshot = response.data?.runtimeDebugSnapshot

  if (!runtimeSnapshot || !debugSnapshot) {
    throw new Error('Runtime debug snapshot response was empty.')
  }

  return {
    ...runtimeSnapshot,
    producerSpool: debugSnapshot.producerSpool,
    repoState: debugSnapshot.repoState,
    watcher: debugSnapshot.watcher,
    supportingLogs: debugSnapshot.supportingLogs,
    issues: deriveDebugIssues(runtimeSnapshot, debugSnapshot),
  }
}

export async function validateDebugSync(
  repoId: string,
  options?: GraphQLRequestOptions,
): Promise<DebugValidateSyncResult> {
  const response = await requestRuntimeGraphQL<
    RuntimeValidateSyncMutationData,
    { repoId: string }
  >(VALIDATE_SYNC_MUTATION, { repoId }, options)
  if (response.errors?.length) {
    throw new Error(response.errors[0].message)
  }
  const result = response.data?.validateSync

  if (!result) {
    throw new Error('Validate sync response was empty.')
  }

  return result
}

export function subscribeRuntimeDebugEvents(
  repoId: string,
  handlers: {
    onEvent: (event: DebugRuntimeEvent) => void
    onError?: (error: unknown) => void
  },
): () => void {
  return subscribeRuntimeGraphQL<
    RuntimeDebugEventsSubscriptionData,
    { repoId: string }
  >(
    RUNTIME_DEBUG_EVENTS_SUBSCRIPTION,
    { repoId },
    {
      onData: (data) => {
        if (data.runtimeEvents == null) {
          handlers.onError?.(
            new Error('Runtime event was not returned from the subscription.'),
          )
          return
        }
        handlers.onEvent(data.runtimeEvents)
      },
      onError: handlers.onError,
    },
  )
}

export function filterDebugLogLines(
  lines: DebugLogLine[],
  levelFilter: DebugLogLevelFilter,
): DebugLogLine[] {
  if (levelFilter === 'all') {
    return lines
  }

  return lines.filter((line) => {
    const level = line.level?.toLowerCase()
    if (!level) return false
    if (levelFilter === 'warn') {
      return level === 'warn' || level === 'warning'
    }
    return level === levelFilter
  })
}

function deriveDebugIssues(
  runtimeSnapshot: DebugRuntimeSnapshot,
  debugSnapshot: RuntimeDebugSnapshotQueryData['runtimeDebugSnapshot'],
): DebugIssue[] {
  const issues: DebugIssue[] = []
  const { taskQueue, workplane, blockedMailboxes, embeddingsReadinessGate } =
    runtimeSnapshot
  const { producerSpool, repoState, watcher, supportingLogs } = debugSnapshot

  if (taskQueue.failedTasks > 0) {
    issues.push({
      id: 'task-queue-failed',
      severity: 'critical',
      subsystem: 'Task queue',
      title: 'Task queue has failed tasks',
      detail: `${taskQueue.failedTasks} failed task${taskQueue.failedTasks === 1 ? '' : 's'} need inspection.`,
    })
  }

  if (taskQueue.paused) {
    issues.push({
      id: 'task-queue-paused',
      severity: 'warning',
      subsystem: 'Task queue',
      title: 'Task queue is paused',
      detail: taskQueue.pausedReason ?? 'Queue processing is currently paused.',
    })
  }

  if (producerSpool.pendingCount > 0) {
    issues.push({
      id: 'producer-spool-pending',
      severity: 'warning',
      subsystem: 'Producer spool',
      title: 'Producer spool has pending jobs',
      detail: `${producerSpool.pendingCount} pending producer job${producerSpool.pendingCount === 1 ? '' : 's'} waiting to be claimed.`,
    })
  }

  if (!watcher.registered) {
    issues.push({
      id: 'watcher-unregistered',
      severity: 'warning',
      subsystem: 'Watcher',
      title: 'Watcher is not registered',
      detail:
        'No current repo watcher registration was found for this repository.',
    })
  }

  if (blockedMailboxes.length > 0) {
    issues.push({
      id: 'mailboxes-blocked',
      severity: 'warning',
      subsystem: 'Workplane',
      title: 'Workplane has blocked mailboxes',
      detail: `${blockedMailboxes.length} mailbox${blockedMailboxes.length === 1 ? '' : 'es'} are blocked.`,
    })
  }

  if (workplane.failedJobs > 0) {
    issues.push({
      id: 'workplane-failed',
      severity: 'critical',
      subsystem: 'Workplane',
      title: 'Workplane has failed jobs',
      detail: `${workplane.failedJobs} failed workplane job${workplane.failedJobs === 1 ? '' : 's'} need inspection.`,
    })
  }

  if (embeddingsReadinessGate?.blocked) {
    issues.push({
      id: 'embeddings-gate-blocked',
      severity: 'warning',
      subsystem: 'Embeddings',
      title: 'Embeddings readiness gate is blocked',
      detail:
        embeddingsReadinessGate.reason ??
        embeddingsReadinessGate.readiness ??
        'Embeddings are not ready.',
    })
  }

  if (repoState.mergeState !== 'none') {
    issues.push({
      id: 'repo-merge-state',
      severity: 'warning',
      subsystem: 'Repository',
      title: 'Repository has an active git operation',
      detail: `Git operation state is ${repoState.mergeState}.`,
    })
  }

  if (repoState.stagedPaths.length > 0) {
    issues.push({
      id: 'repo-has-staged-paths',
      severity: 'info',
      subsystem: 'Repository',
      title: 'Repository has staged paths',
      detail: `${repoState.stagedPaths.length} staged path${repoState.stagedPaths.length === 1 ? '' : 's'} visible to diagnostics.`,
    })
  }

  const recentErrors = supportingLogs.lines.filter((line) =>
    line.level?.toLowerCase().includes('error'),
  )
  if (recentErrors.length > 0) {
    issues.push({
      id: 'logs-have-errors',
      severity: 'warning',
      subsystem: 'Logs',
      title: 'Recent daemon logs include errors',
      detail: `${recentErrors.length} recent log line${recentErrors.length === 1 ? '' : 's'} have error level.`,
    })
  }

  return issues
}
