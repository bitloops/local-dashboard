import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Database,
  GitBranch,
  Info,
  ListChecks,
  RefreshCw,
  ScrollText,
  ServerCog,
  ShieldCheck,
} from 'lucide-react'
import type { DashboardRepositoryRecord } from '@/api/dashboard/client'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  fetchDebugRepositories,
  fetchRuntimeDebugSnapshot,
  filterDebugLogLines,
  subscribeRuntimeDebugEvents,
  validateDebugSync,
  type DebugValidateSyncResult,
  type DebugRuntimeEvent,
  type DebugLogLevelFilter,
  type DebugIssue,
  type DebugIssueSeverity,
  type RuntimeDebugSnapshot,
} from './api'

type DebugSection =
  | 'overview'
  | 'queues'
  | 'spool'
  | 'watcher'
  | 'repo'
  | 'logs'

const sections: Array<{
  id: DebugSection
  label: string
  icon: typeof Activity
}> = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'queues', label: 'Queues', icon: ListChecks },
  { id: 'spool', label: 'Spool', icon: Database },
  { id: 'watcher', label: 'Daemon', icon: ServerCog },
  { id: 'repo', label: 'Repo', icon: GitBranch },
  { id: 'logs', label: 'Logs', icon: ScrollText },
]

const issueSeverityStyles: Record<DebugIssueSeverity, string> = {
  critical: 'border-destructive/40 bg-destructive/10 text-destructive',
  warning:
    'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  info: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300',
}

const LIVE_REFRESH_DEBOUNCE_MS = 400
const ACTIVE_TASK_STATUSES = new Set(['queued', 'running'])

type LiveStatus = 'idle' | 'listening' | 'error'

type LiveState = {
  status: LiveStatus
  lastEvent: DebugRuntimeEvent | null
  error: string | null
}

type ValidationNotice = {
  tone: 'success' | 'error'
  message: string
}

const workplaneHelp = (
  <div className='space-y-2'>
    <p>
      Workplane is separate from the main task queue and producer spool. It
      covers deferred capability/mailbox work such as:
    </p>
    <ul className='list-disc space-y-1 pl-4'>
      <li>generating code summaries</li>
      <li>creating code, identity, and summary embeddings</li>
      <li>refreshing clone matches</li>
    </ul>
    <p>
      Blocked means queued enrichment work is waiting on a readiness
      prerequisite, such as an embedding runtime or text-generation slot.
    </p>
  </div>
)

export function Debug() {
  const [repositories, setRepositories] = useState<DashboardRepositoryRecord[]>(
    [],
  )
  const [selectedRepoId, setSelectedRepoId] = useState<string>('')
  const [snapshot, setSnapshot] = useState<RuntimeDebugSnapshot | null>(null)
  const [activeSection, setActiveSection] = useState<DebugSection>('overview')
  const [repoLoadError, setRepoLoadError] = useState<string | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [loadingRepos, setLoadingRepos] = useState(true)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [validationPending, setValidationPending] = useState(false)
  const [validationNotice, setValidationNotice] =
    useState<ValidationNotice | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [liveState, setLiveState] = useState<LiveState>({
    status: 'idle',
    lastEvent: null,
    error: null,
  })

  useEffect(() => {
    const controller = new AbortController()
    fetchDebugRepositories({ signal: controller.signal })
      .then((records) => {
        setRepositories(records)
        setRepoLoadError(null)
        const firstRepoId = records[0]?.repoId || ''
        if (firstRepoId) {
          setLoadingSnapshot(true)
        }
        setSelectedRepoId((current) => current || firstRepoId)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        console.error('Failed to load debug repositories', error)
        setRepoLoadError(errorMessage(error, 'Unable to load repositories.'))
        setRepositories([])
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingRepos(false)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedRepoId) {
      return
    }

    const controller = new AbortController()
    fetchRuntimeDebugSnapshot(selectedRepoId, { signal: controller.signal })
      .then((nextSnapshot) => {
        setSnapshot(nextSnapshot)
        setSnapshotError(null)
      })
      .catch((error: unknown) => {
        if (isAbortError(error)) return
        console.error('Failed to load runtime debug snapshot', error)
        setSnapshotError(errorMessage(error, 'Unable to load debug data.'))
        setSnapshot(null)
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingSnapshot(false)
        }
      })

    return () => controller.abort()
  }, [selectedRepoId, refreshToken])

  useEffect(() => {
    if (!selectedRepoId) {
      return
    }

    let refreshTimeout: number | undefined
    const unsubscribe = subscribeRuntimeDebugEvents(selectedRepoId, {
      onEvent: (event) => {
        setLiveState({ status: 'listening', lastEvent: event, error: null })
        if (refreshTimeout != null) {
          window.clearTimeout(refreshTimeout)
        }
        refreshTimeout = window.setTimeout(() => {
          setRefreshToken((value) => value + 1)
        }, LIVE_REFRESH_DEBOUNCE_MS)
      },
      onError: (error) => {
        console.error('Runtime debug live subscription failed', error)
        setLiveState((current) => ({
          ...current,
          status: 'error',
          error: errorMessage(error, 'Live updates unavailable.'),
        }))
      },
    })

    return () => {
      if (refreshTimeout != null) {
        window.clearTimeout(refreshTimeout)
      }
      unsubscribe()
    }
  }, [selectedRepoId])

  const selectedRepository = useMemo(
    () => repositories.find((repo) => repo.repoId === selectedRepoId) ?? null,
    [repositories, selectedRepoId],
  )
  const currentSnapshot = snapshot?.repoId === selectedRepoId ? snapshot : null
  const validateSyncActive = hasActiveValidateSyncTask(currentSnapshot)
  const activeIssueCount = currentSnapshot?.issues.length ?? 0
  const effectiveLiveState =
    selectedRepoId && liveState.status === 'idle'
      ? { ...liveState, status: 'listening' as const }
      : liveState

  const handleValidateSync = () => {
    if (!selectedRepoId) {
      return
    }

    setValidationPending(true)
    setValidationNotice(null)
    validateDebugSync(selectedRepoId)
      .then((result) => {
        setValidationNotice({
          tone: 'success',
          message: describeValidateSyncResult(result),
        })
        setLoadingSnapshot(true)
        setRefreshToken((value) => value + 1)
      })
      .catch((error: unknown) => {
        console.error('Failed to enqueue validate sync task', error)
        setValidationNotice({
          tone: 'error',
          message: errorMessage(error, 'Unable to enqueue validate sync.'),
        })
      })
      .finally(() => {
        setValidationPending(false)
      })
  }

  return (
    <main id='content' className='min-h-svh bg-background text-foreground'>
      <div className='mx-auto flex w-full max-w-[1480px] flex-col gap-5 px-5 py-8 md:px-8'>
        <header className='flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between'>
          <div className='min-w-0'>
            <h1 className='text-2xl font-semibold tracking-normal'>Debug</h1>
            <div className='mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
              <span>{selectedRepository?.identity ?? 'No repository'}</span>
              {currentSnapshot && (
                <>
                  <span className='text-border'>/</span>
                  <span>{currentSnapshot.repoState.branch}</span>
                  <span className='text-border'>/</span>
                  <span className='font-mono text-xs'>
                    {shortSha(currentSnapshot.repoState.headSha)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <label className='sr-only' htmlFor='debug-repo-select'>
              Repository
            </label>
            <select
              id='debug-repo-select'
              value={selectedRepoId}
              disabled={repositories.length === 0}
              onChange={(event) => {
                const nextRepoId = event.target.value
                setLoadingSnapshot(nextRepoId.length > 0)
                setValidationNotice(null)
                setLiveState({ status: 'idle', lastEvent: null, error: null })
                setSelectedRepoId(nextRepoId)
              }}
              className='h-9 min-w-[18rem] rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50'
            >
              {repositories.length === 0 ? (
                <option value=''>
                  {loadingRepos ? 'Loading repositories' : 'No repositories'}
                </option>
              ) : (
                repositories.map((repo) => (
                  <option key={repo.repoId} value={repo.repoId}>
                    {repo.identity}
                  </option>
                ))
              )}
            </select>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={handleValidateSync}
              disabled={
                !selectedRepoId || validationPending || validateSyncActive
              }
            >
              <ShieldCheck
                className={cn('size-4', validationPending && 'animate-pulse')}
              />
              {validationPending
                ? 'Queueing...'
                : validateSyncActive
                  ? 'Validation active'
                  : 'Validate sync'}
            </Button>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => {
                setLoadingSnapshot(true)
                setRefreshToken((value) => value + 1)
              }}
              disabled={!selectedRepoId || loadingSnapshot}
            >
              <RefreshCw
                className={cn('size-4', loadingSnapshot && 'animate-spin')}
              />
              Refresh
            </Button>
            <LiveStatusBadge liveState={effectiveLiveState} />
          </div>
        </header>

        {validationNotice && (
          <div
            role={validationNotice.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'rounded-md border px-3 py-2 text-sm',
              validationNotice.tone === 'error'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
            )}
          >
            {validationNotice.message}
          </div>
        )}

        {(repoLoadError || snapshotError) && (
          <div className='rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {repoLoadError ?? snapshotError}
          </div>
        )}

        <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
          <section className='min-w-0 space-y-5'>
            <HealthStrip
              snapshot={currentSnapshot}
              loading={loadingRepos || loadingSnapshot}
              issueCount={activeIssueCount}
            />

            <div className='grid gap-4 lg:grid-cols-[12rem_minmax(0,1fr)]'>
              <SubsystemNav
                activeSection={activeSection}
                onSelect={setActiveSection}
                snapshot={currentSnapshot}
              />
              <SubsystemPanel
                section={activeSection}
                snapshot={currentSnapshot}
                loading={loadingSnapshot}
              />
            </div>
          </section>

          <SupportingPanel
            snapshot={currentSnapshot}
            loading={loadingSnapshot}
          />
        </div>
      </div>
    </main>
  )
}

function LiveStatusBadge({ liveState }: { liveState: LiveState }) {
  const label =
    liveState.status === 'error'
      ? 'Live error'
      : liveState.status === 'listening'
        ? 'Live'
        : 'Live idle'
  const detail =
    liveState.status === 'error'
      ? liveState.error
      : liveState.lastEvent
        ? liveState.lastEvent.domain
        : liveState.status === 'listening'
          ? 'listening'
          : 'waiting'

  return (
    <div
      className={cn(
        'flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs text-muted-foreground',
        liveState.status === 'error'
          ? 'border-destructive/40 text-destructive'
          : 'border-border',
      )}
      aria-label={`${label}: ${detail ?? ''}`}
      title={detail ?? undefined}
    >
      <span
        className={cn(
          'size-2 rounded-full',
          liveState.status === 'error'
            ? 'bg-destructive'
            : liveState.status === 'listening'
              ? 'bg-emerald-500'
              : 'bg-muted-foreground/50',
        )}
        aria-hidden='true'
      />
      <span className='font-medium text-foreground'>Live</span>
      <span className='max-w-28 truncate'>{detail}</span>
    </div>
  )
}

function HealthStrip({
  snapshot,
  loading,
  issueCount,
}: {
  snapshot: RuntimeDebugSnapshot | null
  loading: boolean
  issueCount: number
}) {
  const activeTasks =
    (snapshot?.taskQueue.queuedTasks ?? 0) +
    (snapshot?.taskQueue.runningTasks ?? 0)
  const spoolJobs =
    (snapshot?.producerSpool.pendingCount ?? 0) +
    (snapshot?.producerSpool.runningCount ?? 0)
  const activeWorkplane =
    (snapshot?.workplane.pendingJobs ?? 0) +
    (snapshot?.workplane.runningJobs ?? 0)

  return (
    <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
      <MetricTile
        label='Issues'
        value={loading && !snapshot ? '...' : issueCount.toString()}
        tone={issueCount > 0 ? 'warning' : 'ok'}
      />
      <MetricTile
        label='Queue'
        value={loading && !snapshot ? '...' : activeTasks.toString()}
        detail={`${snapshot?.taskQueue.failedTasks ?? 0} failed`}
        tone={
          (snapshot?.taskQueue.failedTasks ?? 0) > 0 ? 'critical' : 'neutral'
        }
      />
      <MetricTile
        label='Spool'
        value={loading && !snapshot ? '...' : spoolJobs.toString()}
        detail={`${snapshot?.producerSpool.runningCount ?? 0} running`}
        tone={spoolJobs > 0 ? 'warning' : 'neutral'}
      />
      <MetricTile
        label='Workplane'
        value={loading && !snapshot ? '...' : activeWorkplane.toString()}
        detail={`${snapshot?.blockedMailboxes.length ?? 0} blocked`}
        helpLabel='About Workplane'
        help={workplaneHelp}
        tone={
          (snapshot?.blockedMailboxes.length ?? 0) > 0 ? 'warning' : 'neutral'
        }
      />
    </div>
  )
}

function MetricTile({
  label,
  value,
  detail,
  help,
  helpLabel,
  tone,
}: {
  label: string
  value: string
  detail?: string
  help?: ReactNode
  helpLabel?: string
  tone: 'ok' | 'neutral' | 'warning' | 'critical'
}) {
  return (
    <div className='rounded-md border border-border bg-card px-4 py-3'>
      <div className='flex items-center justify-between gap-3'>
        <div className='flex min-w-0 items-center gap-1.5'>
          <span className='text-xs font-medium text-muted-foreground'>
            {label}
          </span>
          {help && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type='button'
                  aria-label={helpLabel ?? `About ${label}`}
                  className='inline-flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                >
                  <Info className='size-3.5' aria-hidden='true' />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side='top'
                align='start'
                sideOffset={6}
                className='max-w-80 text-left leading-relaxed'
              >
                {help}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <span
          className={cn(
            'size-2 rounded-full',
            tone === 'ok' && 'bg-emerald-500',
            tone === 'neutral' && 'bg-muted-foreground/50',
            tone === 'warning' && 'bg-amber-500',
            tone === 'critical' && 'bg-destructive',
          )}
        />
      </div>
      <div className='mt-3 flex items-baseline gap-2'>
        <span className='font-mono text-2xl font-semibold'>{value}</span>
        {detail && (
          <span className='text-xs text-muted-foreground'>{detail}</span>
        )}
      </div>
    </div>
  )
}

function SubsystemNav({
  activeSection,
  onSelect,
  snapshot,
}: {
  activeSection: DebugSection
  onSelect: (section: DebugSection) => void
  snapshot: RuntimeDebugSnapshot | null
}) {
  return (
    <nav
      aria-label='Debug subsystems'
      className='flex gap-2 overflow-x-auto border-b border-border pb-2 lg:block lg:space-y-1 lg:overflow-visible lg:border-b-0 lg:pb-0'
    >
      {sections.map((section) => {
        const Icon = section.icon
        const count = subsystemCount(section.id, snapshot)
        return (
          <button
            key={section.id}
            type='button'
            onClick={() => onSelect(section.id)}
            className={cn(
              'flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm transition-colors hover:bg-accent hover:text-accent-foreground lg:w-full',
              activeSection === section.id
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground',
            )}
          >
            <Icon className='size-4' />
            <span className='min-w-0 flex-1 text-left'>{section.label}</span>
            {count != null && (
              <span className='rounded border border-border px-1.5 py-0.5 font-mono text-[11px]'>
                {count}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}

function SubsystemPanel({
  section,
  snapshot,
  loading,
}: {
  section: DebugSection
  snapshot: RuntimeDebugSnapshot | null
  loading: boolean
}) {
  if (!snapshot) {
    return (
      <div className='min-h-[26rem] rounded-md border border-border bg-card p-5'>
        <PanelHeading title='Runtime' loading={loading} />
        <div className='mt-10 text-sm text-muted-foreground'>
          {loading ? 'Loading debug snapshot...' : 'No debug snapshot loaded.'}
        </div>
      </div>
    )
  }

  return (
    <div className='min-h-[26rem] rounded-md border border-border bg-card p-5'>
      {section === 'overview' && <OverviewPanel snapshot={snapshot} />}
      {section === 'queues' && <QueuesPanel snapshot={snapshot} />}
      {section === 'spool' && <SpoolPanel snapshot={snapshot} />}
      {section === 'watcher' && <WatcherPanel snapshot={snapshot} />}
      {section === 'repo' && <RepoPanel snapshot={snapshot} />}
      {section === 'logs' && <LogsPanel snapshot={snapshot} />}
    </div>
  )
}

function OverviewPanel({ snapshot }: { snapshot: RuntimeDebugSnapshot }) {
  return (
    <div className='space-y-5'>
      <PanelHeading title='Cockpit' />
      <div className='grid gap-3 lg:grid-cols-3'>
        <StatusLine
          label='Task queue'
          value={`${snapshot.taskQueue.queuedTasks} queued, ${snapshot.taskQueue.runningTasks} running`}
          ok={
            snapshot.taskQueue.failedTasks === 0 && !snapshot.taskQueue.paused
          }
        />
        <StatusLine
          label='Producer spool'
          value={`${snapshot.producerSpool.pendingCount} pending, ${snapshot.producerSpool.runningCount} running`}
          ok={
            snapshot.producerSpool.pendingCount === 0 &&
            snapshot.producerSpool.runningCount === 0
          }
        />
        <StatusLine
          label='Watcher'
          value={
            snapshot.watcher.registered
              ? (snapshot.watcher.state ?? 'registered')
              : 'missing'
          }
          ok={snapshot.watcher.registered}
        />
      </div>
      <div className='grid gap-3 lg:grid-cols-2'>
        <KeyValueRows
          rows={[
            ['Repo branch', snapshot.repoState.branch],
            ['Head', shortSha(snapshot.repoState.headSha)],
            ['Git state', snapshot.repoState.mergeState],
            ['Staged paths', snapshot.repoState.stagedPaths.length.toString()],
          ]}
        />
        <KeyValueRows
          rows={[
            ['Queue action', snapshot.taskQueue.lastAction ?? 'none'],
            [
              'Consumer action',
              snapshot.currentStateConsumer.lastAction ?? 'none',
            ],
            [
              'Log file',
              snapshot.supportingLogs.available ? 'available' : 'missing',
            ],
            ['Log lines', snapshot.supportingLogs.lines.length.toString()],
          ]}
        />
      </div>
    </div>
  )
}

function QueuesPanel({ snapshot }: { snapshot: RuntimeDebugSnapshot }) {
  return (
    <div className='space-y-5'>
      <PanelHeading title='Queues' />
      <div className='grid gap-3 lg:grid-cols-4'>
        <MetricTile
          label='Queued'
          value={snapshot.taskQueue.queuedTasks.toString()}
          tone='neutral'
        />
        <MetricTile
          label='Running'
          value={snapshot.taskQueue.runningTasks.toString()}
          tone='neutral'
        />
        <MetricTile
          label='Failed'
          value={snapshot.taskQueue.failedTasks.toString()}
          tone={snapshot.taskQueue.failedTasks > 0 ? 'critical' : 'ok'}
        />
        <MetricTile
          label='Recent'
          value={snapshot.taskQueue.completedRecentTasks.toString()}
          tone='neutral'
        />
      </div>

      <div className='overflow-hidden rounded-md border border-border'>
        <table className='w-full text-sm'>
          <thead className='bg-muted/50 text-xs text-muted-foreground'>
            <tr>
              <th className='px-3 py-2 text-left font-medium'>Kind</th>
              <th className='px-3 py-2 text-right font-medium'>Queued</th>
              <th className='px-3 py-2 text-right font-medium'>Running</th>
              <th className='px-3 py-2 text-right font-medium'>Failed</th>
              <th className='px-3 py-2 text-right font-medium'>Recent</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.taskQueue.byKind.length === 0 ? (
              <tr>
                <td
                  className='px-3 py-6 text-center text-muted-foreground'
                  colSpan={5}
                >
                  No queue counts.
                </td>
              </tr>
            ) : (
              snapshot.taskQueue.byKind.map((kind) => (
                <tr key={kind.kind} className='border-t border-border'>
                  <td className='px-3 py-2'>{kind.kind}</td>
                  <td className='px-3 py-2 text-right font-mono'>
                    {kind.queuedTasks}
                  </td>
                  <td className='px-3 py-2 text-right font-mono'>
                    {kind.runningTasks}
                  </td>
                  <td className='px-3 py-2 text-right font-mono'>
                    {kind.failedTasks}
                  </td>
                  <td className='px-3 py-2 text-right font-mono'>
                    {kind.completedRecentTasks}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SpoolPanel({ snapshot }: { snapshot: RuntimeDebugSnapshot }) {
  return (
    <div className='space-y-5'>
      <PanelHeading title='Producer spool' />
      <div className='space-y-2'>
        {snapshot.producerSpool.jobs.length === 0 ? (
          <EmptyLine label='No producer spool jobs.' />
        ) : (
          snapshot.producerSpool.jobs.map((job) => (
            <div
              key={job.jobId}
              className='rounded-md border border-border p-3'
            >
              <div className='flex flex-wrap items-center justify-between gap-2'>
                <div className='min-w-0'>
                  <div className='font-mono text-sm'>{job.payloadKind}</div>
                  <div className='mt-1 text-xs text-muted-foreground'>
                    {job.source ?? 'unknown'} / {job.status}
                  </div>
                </div>
                <span className='rounded border border-border px-2 py-1 font-mono text-xs'>
                  {job.pathCount} paths
                </span>
              </div>
              {job.paths.length > 0 && (
                <div className='mt-3 flex flex-wrap gap-1.5'>
                  {job.paths.slice(0, 6).map((path) => (
                    <span
                      key={path}
                      className='rounded bg-muted px-2 py-1 font-mono text-[11px]'
                    >
                      {path}
                    </span>
                  ))}
                </div>
              )}
              {job.lastError && (
                <p className='mt-3 text-xs text-destructive'>{job.lastError}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function WatcherPanel({ snapshot }: { snapshot: RuntimeDebugSnapshot }) {
  return (
    <div className='space-y-5'>
      <PanelHeading title='Daemon' />
      <KeyValueRows
        rows={[
          ['Watcher registered', snapshot.watcher.registered ? 'yes' : 'no'],
          ['Watcher state', snapshot.watcher.state ?? 'unknown'],
          ['Watcher pid', snapshot.watcher.pid?.toString() ?? 'unknown'],
          ['Repo root', snapshot.watcher.repoRoot ?? 'unknown'],
          [
            'State consumer',
            snapshot.currentStateConsumer.persisted ? 'persisted' : 'memory',
          ],
          [
            'Consumer failures',
            snapshot.currentStateConsumer.failedRuns.toString(),
          ],
        ]}
      />
      <div className='grid gap-3 md:grid-cols-2'>
        {snapshot.workplane.pools.map((pool) => (
          <StatusLine
            key={pool.poolName}
            label={pool.displayName}
            value={`${pool.activeWorkers}/${pool.workerBudget} workers`}
            ok={pool.failedJobs === 0}
          />
        ))}
      </div>
    </div>
  )
}

function RepoPanel({ snapshot }: { snapshot: RuntimeDebugSnapshot }) {
  const rows: Array<[string, string]> = [
    ['Branch', snapshot.repoState.branch],
    ['Head', snapshot.repoState.headSha],
    ['Git state', snapshot.repoState.mergeState],
    ['Staged', snapshot.repoState.stagedPaths.join(', ') || 'none'],
    ['Unstaged', snapshot.repoState.unstagedPaths.join(', ') || 'none'],
    ['Untracked', snapshot.repoState.untrackedPaths.join(', ') || 'none'],
    ['Deleted', snapshot.repoState.deletedPaths.join(', ') || 'none'],
  ]

  return (
    <div className='space-y-5'>
      <PanelHeading title='Repository' />
      <KeyValueRows rows={rows} />
    </div>
  )
}

function LogsPanel({ snapshot }: { snapshot: RuntimeDebugSnapshot }) {
  const [levelFilter, setLevelFilter] = useState<DebugLogLevelFilter>('all')
  const filteredLines = filterDebugLogLines(
    snapshot.supportingLogs.lines,
    levelFilter,
  )
  const filters: DebugLogLevelFilter[] = [
    'all',
    'error',
    'warn',
    'info',
    'debug',
  ]

  return (
    <div className='space-y-5'>
      <PanelHeading title='Logs' />
      <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
        <div className='min-w-0 truncate text-xs text-muted-foreground'>
          {snapshot.supportingLogs.path}
        </div>
        <div className='flex shrink-0 flex-wrap gap-1'>
          {filters.map((filter) => (
            <button
              key={filter}
              type='button'
              onClick={() => setLevelFilter(filter)}
              className={cn(
                'h-7 rounded-md border px-2 font-mono text-[11px] uppercase transition-colors',
                levelFilter === filter
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>
      <div className='max-h-[28rem] overflow-auto rounded-md border border-border bg-background'>
        {filteredLines.length === 0 ? (
          <EmptyLine
            label={
              snapshot.supportingLogs.available
                ? 'No log lines for current filter.'
                : 'Log file is not available.'
            }
          />
        ) : (
          filteredLines.map((line, index) => (
            <div
              key={`${index}-${line.raw}`}
              className='border-b border-border px-3 py-2 font-mono text-xs last:border-b-0'
            >
              <span className='text-muted-foreground'>
                {line.level ?? 'raw'}
              </span>
              <span className='mx-2 text-border'>|</span>
              <span>{line.message ?? line.raw}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function SupportingPanel({
  snapshot,
  loading,
}: {
  snapshot: RuntimeDebugSnapshot | null
  loading: boolean
}) {
  const issues = snapshot?.issues ?? []
  return (
    <aside className='rounded-md border border-border bg-card p-4'>
      <div className='flex items-center justify-between gap-3'>
        <h2 className='text-sm font-semibold'>Supporting panel</h2>
        <span className='rounded border border-border px-2 py-1 font-mono text-xs'>
          {loading && !snapshot ? '...' : issues.length}
        </span>
      </div>
      <div className='mt-4 space-y-3'>
        {issues.length === 0 ? (
          <div className='flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground'>
            <CheckCircle2 className='size-4 text-emerald-500' />
            No derived issues.
          </div>
        ) : (
          issues.map((issue) => <IssueRow key={issue.id} issue={issue} />)
        )}
      </div>
    </aside>
  )
}

function IssueRow({ issue }: { issue: DebugIssue }) {
  return (
    <div
      className={cn(
        'rounded-md border p-3',
        issueSeverityStyles[issue.severity],
      )}
    >
      <div className='flex items-start gap-2'>
        <AlertTriangle className='mt-0.5 size-4 shrink-0' />
        <div className='min-w-0'>
          <div className='text-sm font-medium'>{issue.title}</div>
          <div className='mt-1 text-xs opacity-85'>{issue.detail}</div>
          <div className='mt-2 font-mono text-[11px] opacity-75'>
            {issue.subsystem}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatusLine({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok: boolean
}) {
  return (
    <div className='rounded-md border border-border px-3 py-2'>
      <div className='flex items-center gap-2'>
        {ok ? (
          <CheckCircle2 className='size-4 text-emerald-500' />
        ) : (
          <CircleDot className='size-4 text-amber-500' />
        )}
        <span className='text-sm font-medium'>{label}</span>
      </div>
      <div className='mt-2 truncate font-mono text-xs text-muted-foreground'>
        {value}
      </div>
    </div>
  )
}

function PanelHeading({
  title,
  loading,
}: {
  title: string
  loading?: boolean
}) {
  return (
    <div className='flex items-center justify-between gap-3'>
      <h2 className='text-base font-semibold'>{title}</h2>
      {loading && (
        <RefreshCw className='size-4 animate-spin text-muted-foreground' />
      )}
    </div>
  )
}

function KeyValueRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <dl className='overflow-hidden rounded-md border border-border'>
      {rows.map(([key, value]) => (
        <div
          key={key}
          className='grid grid-cols-[9rem_minmax(0,1fr)] border-b border-border px-3 py-2 text-sm last:border-b-0'
        >
          <dt className='text-muted-foreground'>{key}</dt>
          <dd className='min-w-0 truncate font-mono text-xs'>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function EmptyLine({ label }: { label: string }) {
  return (
    <div className='px-3 py-6 text-center text-sm text-muted-foreground'>
      {label}
    </div>
  )
}

function subsystemCount(
  section: DebugSection,
  snapshot: RuntimeDebugSnapshot | null,
): number | null {
  if (!snapshot) return null
  if (section === 'queues') {
    return snapshot.taskQueue.queuedTasks + snapshot.taskQueue.runningTasks
  }
  if (section === 'spool') {
    return (
      snapshot.producerSpool.pendingCount + snapshot.producerSpool.runningCount
    )
  }
  if (section === 'repo') {
    return (
      snapshot.repoState.stagedPaths.length +
      snapshot.repoState.unstagedPaths.length +
      snapshot.repoState.untrackedPaths.length
    )
  }
  if (section === 'logs') {
    return snapshot.supportingLogs.lines.length
  }
  return null
}

function shortSha(sha: string) {
  return sha.length > 12 ? sha.slice(0, 12) : sha
}

function hasActiveValidateSyncTask(snapshot: RuntimeDebugSnapshot | null) {
  if (!snapshot) return false
  return snapshot.taskQueue.currentRepoTasks.some((task) => {
    const kind = task.kind.toLowerCase()
    const status = task.status.toLowerCase()
    return (
      kind === 'sync' &&
      task.syncSpec?.mode === 'validate' &&
      ACTIVE_TASK_STATUSES.has(status)
    )
  })
}

function describeValidateSyncResult(result: DebugValidateSyncResult) {
  const shortTaskId =
    result.task.taskId.length > 22
      ? `${result.task.taskId.slice(0, 22)}...`
      : result.task.taskId

  return result.merged
    ? `Validate sync already active (${shortTaskId}).`
    : `Validate sync queued (${shortTaskId}).`
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}
