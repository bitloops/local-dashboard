import { useEffect, useMemo, useState } from 'react'
import {
  Boxes,
  Box,
  Cable,
  CircleCheck,
  Clock3,
  Database,
  FileSearch,
  GitBranch,
  GitCompare,
  History,
  Network,
  RadioTower,
  Route,
  Search,
  Server,
  TriangleAlert,
} from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useStore } from '@/store'
import type { DashboardRepositoryOption } from '@/features/dashboard/api-types'
import { fetchDashboardRepositories } from '@/features/dashboard/graphql/fetch-dashboard-data'
import { cn } from '@/lib/utils'
import {
  loadArchitectureScene,
  type LoadArchitectureSceneInput,
} from '../load-architecture-scene'
import type {
  ArchitectureNavigationContext,
  ArchitectureNavigationContextChange,
  ArchitectureSceneModel,
} from '../model'
import { ArchitectureCanvas } from './architecture-canvas'
import { ArchitectureHierarchyDemo } from './architecture-hierarchy-demo'
import { ArchitectureSystemHub } from './architecture-system-hub'

const architectureProjectPath =
  import.meta.env.VITE_CODE_CITY_PROJECT_PATH?.trim() || '.'
const repoAutoValue = '__architecture_repo_auto__'

type ArchitecturePageProps = {
  loadScene?: (
    input: LoadArchitectureSceneInput,
  ) => Promise<ArchitectureSceneModel>
}

type LoadState =
  | {
      status: 'loading'
      scene: null
      error: null
    }
  | {
      status: 'ready'
      scene: ArchitectureSceneModel
      error: null
    }
  | {
      status: 'error'
      scene: null
      error: string
    }

type StoredLoadState = LoadState & {
  loadKey: string
}

type ArchitectureExperienceMode = 'hub' | 'map' | 'hierarchy'

function resolveDashboardRepository(
  repoOptions: DashboardRepositoryOption[],
  selectedRepoId: string | null,
) {
  if (selectedRepoId == null) {
    return repoOptions[0] ?? null
  }

  return repoOptions.find((repo) => repo.repoId === selectedRepoId) ?? null
}

function loadingSceneState(): LoadState {
  return {
    status: 'loading',
    scene: null,
    error: null,
  }
}

function ToggleButton({
  active,
  label,
  onClick,
  testId,
}: {
  active: boolean
  label: string
  onClick: () => void
  testId?: string
}) {
  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      aria-pressed={active}
      data-testid={testId}
      className={cn(
        'rounded-full border-slate-200/80 bg-white/80 px-3 text-xs shadow-none dark:border-white/10 dark:bg-white/5',
        active
          ? 'border-slate-900/70 bg-slate-900 text-white hover:bg-slate-900/90 dark:border-white/50 dark:bg-white dark:text-slate-950'
          : 'text-slate-600 dark:text-slate-200',
      )}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes
  label: string
  value: number
}) {
  return (
    <div className='rounded-lg border border-slate-200/80 bg-white/75 p-3 dark:border-white/10 dark:bg-white/5'>
      <div className='flex items-center gap-2 text-xs text-muted-foreground'>
        <Icon className='size-4' />
        {label}
      </div>
      <p className='mt-2 text-2xl font-semibold tabular-nums'>{value}</p>
    </div>
  )
}

function shortSignature(value: string | null | undefined) {
  if (value == null || value.trim().length === 0) {
    return '<none>'
  }

  return value.slice(0, 12)
}

function formatContextTimestamp(value: string | null | undefined) {
  if (value == null || value.trim().length === 0) {
    return 'unknown'
  }

  return value
}

function contextStatusLabel(context: ArchitectureNavigationContext) {
  if (context.reviewState === 'unreviewed') {
    return 'Initial baseline'
  }

  return context.status === 'stale' ? 'Potentially stale' : 'Fresh'
}

function changeKindLabel(change: ArchitectureNavigationContextChange) {
  switch (change.changeKind) {
    case 'added':
      return 'Added'
    case 'removed':
      return 'Removed'
    case 'hash_changed':
      return 'Hash changed'
    default:
      return 'Changed'
  }
}

function ArchitectureContextSummary({
  context,
  onReview,
}: {
  context: ArchitectureNavigationContext | null | undefined
  onReview: () => void
}) {
  if (context == null) {
    return (
      <div
        data-testid='architecture-context-summary'
        className='flex flex-wrap items-center gap-3 rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5'
      >
        <Clock3 className='size-4 text-muted-foreground' />
        <span className='font-medium'>Architecture context unavailable</span>
      </div>
    )
  }

  const stale = context.status === 'stale'
  const unreviewed = context.reviewState === 'unreviewed'

  return (
    <div
      data-testid='architecture-context-summary'
      className={cn(
        'flex flex-col gap-3 rounded-lg border px-3 py-3 text-sm lg:flex-row lg:items-center lg:justify-between',
        stale || unreviewed
          ? 'border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100'
          : 'border-emerald-200 bg-emerald-50/80 text-emerald-950 dark:border-emerald-400/30 dark:bg-emerald-950/20 dark:text-emerald-100',
      )}
    >
      <div className='flex min-w-0 flex-wrap items-center gap-3'>
        {stale || unreviewed ? (
          <GitCompare className='size-4 shrink-0' />
        ) : (
          <CircleCheck className='size-4 shrink-0' />
        )}
        <span className='font-semibold'>{contextStatusLabel(context)}</span>
        <Badge variant='outline' className='bg-white/60 dark:bg-white/10'>
          {context.changeCount} changes
        </Badge>
        <span className='text-xs opacity-80'>
          current {shortSignature(context.currentSignature)}
        </span>
        <span className='text-xs opacity-80'>
          accepted {shortSignature(context.acceptedSignature)}
        </span>
      </div>
      <Button
        type='button'
        size='sm'
        variant='outline'
        data-testid='architecture-context-review-button'
        className='w-fit bg-white/75 dark:bg-white/10'
        onClick={onReview}
      >
        <FileSearch className='size-4' />
        {stale ? 'Review changes' : 'Review baseline'}
      </Button>
    </div>
  )
}

function ArchitectureContextReviewPanel({
  context,
  onSelectComponent,
}: {
  context: ArchitectureNavigationContext
  onSelectComponent: (id: string) => void
}) {
  const latestAcceptance = context.acceptanceHistory[0]
  const visibleChanges = context.changedPrimitives.slice(0, 8)

  return (
    <Card data-testid='architecture-context-review'>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <FileSearch className='size-5 text-cyan-500' />
          <CardTitle>Context review</CardTitle>
        </div>
        <CardDescription>{context.label}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm'>
          <span className='text-muted-foreground'>State</span>
          <span className='font-medium'>{contextStatusLabel(context)}</span>
          <span className='text-muted-foreground'>Current</span>
          <span className='font-mono text-xs'>
            {shortSignature(context.currentSignature)}
          </span>
          <span className='text-muted-foreground'>Accepted</span>
          <span className='font-mono text-xs'>
            {shortSignature(context.acceptedSignature)}
          </span>
          <span className='text-muted-foreground'>Snapshot</span>
          <span className='break-words text-xs font-medium'>
            {context.materialisedRef ?? 'not materialised'}
          </span>
        </div>

        {latestAcceptance != null && (
          <div className='rounded-lg border border-slate-200/80 bg-white/75 p-3 text-sm dark:border-white/10 dark:bg-white/5'>
            <div className='flex items-center gap-2 font-medium'>
              <History className='size-4 text-cyan-500' />
              Last accepted
            </div>
            <p className='mt-2 text-xs text-muted-foreground'>
              {formatContextTimestamp(latestAcceptance.acceptedAt)} by{' '}
              {latestAcceptance.source}
            </p>
          </div>
        )}

        {visibleChanges.length === 0 ? (
          <div className='rounded-lg border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-white/10'>
            No dependency changes are recorded for this view.
          </div>
        ) : (
          <div className='space-y-2'>
            <div className='text-xs font-medium uppercase text-muted-foreground'>
              Changed primitives
            </div>
            {visibleChanges.map((change) => {
              const targetComponentId = change.mappedComponentIds[0]

              return (
                <button
                  key={change.primitiveId}
                  type='button'
                  className='w-full rounded-lg border border-slate-200/80 bg-white/75 p-3 text-left transition hover:border-cyan-300 hover:bg-cyan-50/70 dark:border-white/10 dark:bg-white/5 dark:hover:border-cyan-400/40 dark:hover:bg-cyan-950/20'
                  onClick={() => {
                    if (targetComponentId != null) {
                      onSelectComponent(targetComponentId)
                    }
                  }}
                >
                  <div className='flex flex-wrap items-center gap-2'>
                    <Badge variant='outline'>{change.primitiveKind}</Badge>
                    <span className='text-xs text-muted-foreground'>
                      {changeKindLabel(change)}
                    </span>
                  </div>
                  <div className='mt-2 break-words text-sm font-medium'>
                    {change.label ?? change.primitiveId}
                  </div>
                  {change.path != null && (
                    <div className='mt-1 break-words text-xs text-muted-foreground'>
                      {change.path}
                    </div>
                  )}
                </button>
              )
            })}
            {context.changedPrimitives.length > visibleChanges.length && (
              <p className='text-xs text-muted-foreground'>
                {context.changedPrimitives.length - visibleChanges.length} more
                changed primitives
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function selectionDetails(
  scene: ArchitectureSceneModel,
  selectedId: string | null,
) {
  if (selectedId == null) {
    return null
  }

  const component = scene.components.find((item) => item.id === selectedId)
  if (component != null) {
    return {
      kind: 'Component',
      label: component.label,
      icon: Box,
      rows: [
        [
          'Container',
          scene.containers.find((item) => item.id === component.containerId)
            ?.label,
        ],
        ['Path', component.path],
        ['Files', component.filePaths.length.toString()],
        ['Contract out', component.contractOutCount.toString()],
        ['Contract in', component.contractInCount.toString()],
        ['Direct out', component.directOutCount.toString()],
        ['Direct in', component.directInCount.toString()],
        [
          'Persistence',
          `${component.readCount} reads / ${component.writeCount} writes`,
        ],
      ],
    }
  }

  const componentGroup = scene.componentGroups.find(
    (item) => item.id === selectedId,
  )
  if (componentGroup != null) {
    return {
      kind: 'Component group',
      label: componentGroup.label ?? componentGroup.path ?? 'Group',
      icon: GitBranch,
      rows: [
        [
          'Container',
          scene.containers.find(
            (item) => item.id === componentGroup.containerId,
          )?.label,
        ],
        ['Path', componentGroup.path],
        ['Components', componentGroup.componentIds.length.toString()],
      ],
    }
  }

  const contract = scene.contractConnections.find(
    (item) => item.id === selectedId,
  )
  if (contract != null) {
    return {
      kind: 'Contract corridor',
      label: contract.label,
      icon: Cable,
      rows: [
        [
          'From',
          scene.components.find((item) => item.id === contract.fromComponentId)
            ?.label,
        ],
        [
          'To',
          scene.components.find((item) => item.id === contract.toComponentId)
            ?.label,
        ],
        ['Flows', contract.flowIds.length.toString()],
        ['Entry points', contract.entryPointIds.length.toString()],
        ['Confidence', `${Math.round(contract.confidence * 100)}%`],
      ],
    }
  }

  const direct = scene.directConnections.find((item) => item.id === selectedId)
  if (direct != null) {
    return {
      kind: 'Direct dependency',
      label: direct.label,
      icon: TriangleAlert,
      rows: [
        [
          'From',
          scene.components.find((item) => item.id === direct.fromComponentId)
            ?.label,
        ],
        [
          'To',
          scene.components.find((item) => item.id === direct.toComponentId)
            ?.label,
        ],
        ['Dependencies', direct.dependencyCount.toString()],
        ['Source files', direct.sourcePaths.length.toString()],
        ['Target files', direct.targetPaths.length.toString()],
        ['Severity', direct.severity],
      ],
    }
  }

  const entryPoint = scene.entryPoints.find((item) => item.id === selectedId)
  if (entryPoint != null) {
    return {
      kind: 'Entry point',
      label: entryPoint.label,
      icon: RadioTower,
      rows: [
        ['Kind', entryPoint.entryKind],
        [
          'Container',
          scene.containers.find((item) => item.id === entryPoint.containerId)
            ?.label,
        ],
        [
          'Component',
          scene.components.find((item) => item.id === entryPoint.componentId)
            ?.label,
        ],
      ],
    }
  }

  const deploymentUnit = scene.deploymentUnits.find(
    (item) => item.id === selectedId,
  )
  if (deploymentUnit != null) {
    return {
      kind: 'Deployment unit',
      label: deploymentUnit.label,
      icon: Server,
      rows: [
        ['Kind', deploymentUnit.kind],
        [
          'Container',
          scene.containers.find(
            (item) => item.id === deploymentUnit.containerId,
          )?.label,
        ],
        [
          'Component',
          scene.components.find(
            (item) => item.id === deploymentUnit.componentId,
          )?.label,
        ],
      ],
    }
  }

  const persistence = scene.persistenceObjects.find(
    (item) => item.id === selectedId,
  )
  if (persistence != null) {
    return {
      kind: 'Persistence',
      label: persistence.label,
      icon: Database,
      rows: [
        ['Path', persistence.path],
        ['Readers', persistence.readByComponentIds.length.toString()],
        ['Writers', persistence.writtenByComponentIds.length.toString()],
      ],
    }
  }

  const dataConnection = scene.dataConnections.find(
    (item) => item.id === selectedId,
  )
  if (dataConnection != null) {
    return {
      kind:
        dataConnection.kind === 'read'
          ? 'Persistence read'
          : 'Persistence write',
      label: dataConnection.label,
      icon: Database,
      rows: [
        [
          'Component',
          scene.components.find(
            (item) => item.id === dataConnection.componentId,
          )?.label,
        ],
        [
          'Object',
          scene.persistenceObjects.find(
            (item) => item.id === dataConnection.persistenceObjectId,
          )?.label,
        ],
        ['Confidence', `${Math.round(dataConnection.confidence * 100)}%`],
      ],
    }
  }

  return null
}

function ArchitectureInspector({
  scene,
  selectedId,
  navigationContext,
}: {
  scene: ArchitectureSceneModel
  selectedId: string | null
  navigationContext?: ArchitectureNavigationContext | null
}) {
  const selected = selectionDetails(scene, selectedId)
  const SelectedIcon = selected?.icon
  const selectedContextChanges =
    selectedId == null
      ? []
      : (navigationContext?.changedPrimitives.filter((change) =>
          change.mappedComponentIds.includes(selectedId),
        ) ?? [])

  return (
    <Card data-testid='architecture-inspector'>
      <CardHeader>
        <div className='flex items-center gap-2'>
          <Network className='size-5 text-cyan-500' />
          <CardTitle>Architecture</CardTitle>
        </div>
        <CardDescription>{scene.repositoryLabel}</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='grid grid-cols-2 gap-3'>
          <Stat
            icon={GitBranch}
            label='Groups'
            value={scene.summary.componentGroupCount}
          />
          <Stat
            icon={Boxes}
            label='Components'
            value={scene.summary.componentCount}
          />
          <Stat
            icon={Cable}
            label='Contracts'
            value={scene.summary.contractConnectionCount}
          />
          <Stat
            icon={TriangleAlert}
            label='Direct'
            value={scene.summary.directConnectionCount}
          />
          <Stat
            icon={Database}
            label='Data'
            value={scene.summary.persistenceObjectCount}
          />
        </div>

        {selected == null ? (
          <div className='rounded-lg border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-white/10'>
            Select a component, corridor, direct dependency, entry point, or
            data object.
          </div>
        ) : (
          <div className='rounded-lg border border-slate-200/80 bg-white/75 p-4 dark:border-white/10 dark:bg-white/5'>
            <div className='flex items-center gap-2'>
              {SelectedIcon != null && (
                <SelectedIcon className='size-4 text-cyan-500' />
              )}
              <Badge variant='outline'>{selected.kind}</Badge>
            </div>
            <h3 className='mt-3 break-words text-lg font-semibold'>
              {selected.label}
            </h3>
            <dl className='mt-4 space-y-2 text-sm'>
              {selected.rows
                .filter(([, value]) => value != null && value !== '')
                .map(([label, value]) => (
                  <div key={label} className='grid grid-cols-[7rem_1fr] gap-3'>
                    <dt className='text-muted-foreground'>{label}</dt>
                    <dd className='break-words font-medium'>{value}</dd>
                  </div>
                ))}
            </dl>
            {selectedContextChanges.length > 0 && (
              <div className='mt-4 rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-sm dark:border-amber-400/30 dark:bg-amber-950/20'>
                <div className='font-medium text-amber-950 dark:text-amber-100'>
                  Context changes
                </div>
                <div className='mt-2 space-y-1 text-xs text-amber-900/80 dark:text-amber-100/80'>
                  {selectedContextChanges.slice(0, 4).map((change) => (
                    <div key={change.primitiveId}>
                      {changeKindLabel(change)} ·{' '}
                      {change.label ?? change.primitiveId}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function searchResults(scene: ArchitectureSceneModel, query: string) {
  const trimmed = query.trim().toLowerCase()
  if (trimmed.length === 0) {
    return []
  }

  return [
    ...scene.components.map((component) => ({
      id: component.id,
      label: component.label,
      type: 'Component',
      detail: component.path,
    })),
    ...scene.componentGroups.map((group) => ({
      id: group.id,
      label: group.label ?? group.path ?? 'Group',
      type: 'Group',
      detail: group.path,
    })),
    ...scene.contractConnections.map((connection) => ({
      id: connection.id,
      label: connection.label,
      type: 'Contract',
      detail: `${scene.components.find((item) => item.id === connection.fromComponentId)?.label ?? '?'} -> ${scene.components.find((item) => item.id === connection.toComponentId)?.label ?? '?'}`,
    })),
    ...scene.directConnections.map((connection) => ({
      id: connection.id,
      label: 'Direct dependency',
      type: 'Direct',
      detail: `${scene.components.find((item) => item.id === connection.fromComponentId)?.label ?? '?'} -> ${scene.components.find((item) => item.id === connection.toComponentId)?.label ?? '?'}`,
    })),
    ...scene.persistenceObjects.map((persistence) => ({
      id: persistence.id,
      label: persistence.label,
      type: 'Persistence',
      detail: persistence.path,
    })),
  ]
    .filter((item) =>
      `${item.label} ${item.type} ${item.detail ?? ''}`
        .toLowerCase()
        .includes(trimmed),
    )
    .slice(0, 8)
}

export function ArchitecturePage({
  loadScene = loadArchitectureScene,
}: ArchitecturePageProps) {
  const repoOptions = useStore((state) => state.repoOptions)
  const selectedDashboardRepoId = useStore((state) => state.selectedRepoId)
  const setDashboardRepoOptions = useStore((state) => state.setRepoOptions)
  const setSelectedDashboardRepoId = useStore(
    (state) => state.setSelectedRepoId,
  )
  const [repoLoadState, setRepoLoadState] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [repoLoadError, setRepoLoadError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showLabels, setShowLabels] = useState(true)
  const [showContracts, setShowContracts] = useState(true)
  const [showDirectConnections, setShowDirectConnections] = useState(true)
  const [showEntryPoints, setShowEntryPoints] = useState(true)
  const [showDeployments, setShowDeployments] = useState(true)
  const [showPersistence, setShowPersistence] = useState(true)
  const [showDataConnections, setShowDataConnections] = useState(true)
  const [contextReviewOpen, setContextReviewOpen] = useState(false)
  const [experienceMode, setExperienceMode] =
    useState<ArchitectureExperienceMode>('hub')
  const selectedDashboardRepo = useMemo(
    () => resolveDashboardRepository(repoOptions, selectedDashboardRepoId),
    [repoOptions, selectedDashboardRepoId],
  )
  const selectedDashboardRepoOptionExists =
    selectedDashboardRepoId == null ||
    repoOptions.some((repo) => repo.repoId === selectedDashboardRepoId)
  const repoSelectValue = selectedDashboardRepoOptionExists
    ? (selectedDashboardRepoId ?? repoAutoValue)
    : repoAutoValue
  const loadKey = `${selectedDashboardRepo?.repoId ?? 'none'}:${architectureProjectPath}:${retryToken}`
  const [storedSceneState, setStoredSceneState] = useState<StoredLoadState>({
    ...loadingSceneState(),
    loadKey,
  })
  const sceneState =
    storedSceneState.loadKey === loadKey
      ? storedSceneState
      : loadingSceneState()
  const results =
    sceneState.scene == null ? [] : searchResults(sceneState.scene, searchQuery)
  const navigationContext = sceneState.scene?.navigationContext ?? null

  useEffect(() => {
    let cancelled = false

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setRepoLoadState('loading')
      setRepoLoadError(null)
    })

    fetchDashboardRepositories()
      .then((repositories) => {
        if (cancelled) {
          return
        }

        setDashboardRepoOptions(repositories)
        setRepoLoadState('ready')
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setRepoLoadState('error')
        setRepoLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load repositories.',
        )
      })

    return () => {
      cancelled = true
    }
  }, [setDashboardRepoOptions])

  useEffect(() => {
    let cancelled = false

    if (selectedDashboardRepo == null) {
      if (repoLoadState === 'ready') {
        queueMicrotask(() => {
          if (cancelled) {
            return
          }

          setStoredSceneState({
            loadKey,
            status: 'error',
            scene: null,
            error: 'No repository is available from the dashboard API.',
          })
        })
      }
      return () => {
        cancelled = true
      }
    }

    const abortController = new AbortController()

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setSelectedId(null)
      setContextReviewOpen(false)
      setStoredSceneState({
        ...loadingSceneState(),
        loadKey,
      })
    })

    loadScene({
      repository: selectedDashboardRepo,
      projectPath: architectureProjectPath,
      signal: abortController.signal,
    })
      .then((scene) => {
        if (cancelled) {
          return
        }

        setStoredSceneState({
          loadKey,
          status: 'ready',
          scene,
          error: null,
        })
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }

        setStoredSceneState({
          loadKey,
          status: 'error',
          scene: null,
          error:
            error instanceof Error
              ? error.message
              : 'Could not load architecture.',
        })
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [loadKey, loadScene, repoLoadState, selectedDashboardRepo])

  return (
    <>
      <Header fixed>
        <div className='flex min-w-0 flex-1 items-center justify-between gap-3'>
          <div className='min-w-0'>
            <h1 className='truncate text-lg font-semibold'>Architecture</h1>
            <p className='truncate text-xs text-muted-foreground'>
              Components, contracts, entry points, deployments, and data access.
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <ThemeSwitch />
          </div>
        </div>
      </Header>

      <Main fluid className='space-y-5'>
        <Card className='border-slate-200/80 bg-white/88 dark:border-white/10 dark:bg-slate-950/80'>
          <CardContent className='flex flex-col gap-4 px-5 py-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between'>
            <div className='flex flex-1 flex-col gap-3 md:flex-row md:items-center'>
              <div className='min-w-[16rem]'>
                <Select
                  value={repoSelectValue}
                  onValueChange={(value) => {
                    setSelectedDashboardRepoId(
                      value === repoAutoValue ? null : value,
                    )
                  }}
                >
                  <SelectTrigger data-testid='architecture-repo-select'>
                    <SelectValue
                      placeholder={
                        repoLoadState === 'loading'
                          ? 'Loading repositories...'
                          : 'Select repository'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedDashboardRepo != null && (
                      <SelectItem value={repoAutoValue}>
                        Auto ({selectedDashboardRepo.identity})
                      </SelectItem>
                    )}
                    {repoOptions.map((repo) => (
                      <SelectItem key={repo.repoId} value={repo.repoId}>
                        {repo.identity}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className='relative min-w-0 flex-1'>
                <Search className='pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                <Input
                  value={searchQuery}
                  data-testid='architecture-search-input'
                  className='pl-9'
                  placeholder='Search architecture'
                  onChange={(event) => setSearchQuery(event.target.value)}
                />
                {results.length > 0 && (
                  <div className='absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-white/10 dark:bg-slate-950'>
                    {results.map((result) => (
                      <button
                        key={result.id}
                        type='button'
                        className='flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-white/8'
                        onClick={() => {
                          setSelectedId(result.id)
                          setSearchQuery('')
                        }}
                      >
                        <span className='min-w-0'>
                          <span className='block truncate font-medium'>
                            {result.label}
                          </span>
                          <span className='block truncate text-xs text-muted-foreground'>
                            {result.detail}
                          </span>
                        </span>
                        <Badge variant='outline'>{result.type}</Badge>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className='flex flex-wrap items-center gap-2'>
              <ToggleButton
                active={experienceMode === 'hub'}
                label='System hub'
                testId='architecture-mode-hub'
                onClick={() => setExperienceMode('hub')}
              />
              <ToggleButton
                active={experienceMode === 'map'}
                label='Map'
                testId='architecture-mode-map'
                onClick={() => setExperienceMode('map')}
              />
              <ToggleButton
                active={experienceMode === 'hierarchy'}
                label='Hierarchy demo'
                testId='architecture-mode-hierarchy'
                onClick={() => setExperienceMode('hierarchy')}
              />
              {experienceMode === 'map' && (
                <>
                  <ToggleButton
                    active={showLabels}
                    label='Labels'
                    testId='architecture-toggle-labels'
                    onClick={() => setShowLabels((value) => !value)}
                  />
                  <ToggleButton
                    active={showContracts}
                    label='Contracts'
                    testId='architecture-toggle-contracts'
                    onClick={() => setShowContracts((value) => !value)}
                  />
                  <ToggleButton
                    active={showDirectConnections}
                    label='Direct connections'
                    testId='architecture-toggle-direct-connections'
                    onClick={() => setShowDirectConnections((value) => !value)}
                  />
                  <ToggleButton
                    active={showEntryPoints}
                    label='Entry points'
                    testId='architecture-toggle-entry-points'
                    onClick={() => setShowEntryPoints((value) => !value)}
                  />
                  <ToggleButton
                    active={showDeployments}
                    label='Deployments'
                    testId='architecture-toggle-deployments'
                    onClick={() => setShowDeployments((value) => !value)}
                  />
                  <ToggleButton
                    active={showPersistence}
                    label='Persistence'
                    testId='architecture-toggle-persistence'
                    onClick={() => setShowPersistence((value) => !value)}
                  />
                  <ToggleButton
                    active={showDataConnections}
                    label='Reads/writes'
                    testId='architecture-toggle-data-connections'
                    onClick={() => setShowDataConnections((value) => !value)}
                  />
                </>
              )}
            </div>
            {sceneState.status === 'ready' && experienceMode !== 'hub' && (
              <div className='w-full lg:basis-full'>
                <ArchitectureContextSummary
                  context={navigationContext}
                  onReview={() => setContextReviewOpen((value) => !value)}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {repoLoadError != null && (
          <Card className='border-amber-200 bg-amber-50/80 dark:border-amber-400/30 dark:bg-amber-950/25'>
            <CardContent className='px-5 py-4 text-sm text-amber-900 dark:text-amber-100'>
              {repoLoadError}
            </CardContent>
          </Card>
        )}

        {sceneState.status === 'ready' && experienceMode === 'hub' ? (
          <ArchitectureSystemHub scene={sceneState.scene} />
        ) : sceneState.status === 'ready' && experienceMode === 'hierarchy' ? (
          <ArchitectureHierarchyDemo scene={sceneState.scene} />
        ) : (
          <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]'>
            <div className='min-w-0'>
              {sceneState.status === 'loading' && (
                <Card className='overflow-hidden border-slate-200/80 bg-white/88 dark:border-white/10 dark:bg-slate-950/80'>
                  <CardContent className='space-y-3 px-6 py-6'>
                    <Skeleton className='h-7 w-56' />
                    <Skeleton className='h-[70svh] min-h-[560px] w-full rounded-[1.25rem]' />
                  </CardContent>
                </Card>
              )}

              {sceneState.status === 'error' && (
                <Card className='border-red-200 bg-red-50/80 dark:border-red-400/30 dark:bg-red-950/25'>
                  <CardHeader>
                    <CardTitle>Could not load Architecture</CardTitle>
                    <CardDescription>{sceneState.error}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      type='button'
                      onClick={() => setRetryToken((value) => value + 1)}
                    >
                      Try again
                    </Button>
                  </CardContent>
                </Card>
              )}

              {sceneState.status === 'ready' && (
                <ArchitectureCanvas
                  scene={sceneState.scene}
                  selectedId={selectedId}
                  showLabels={showLabels}
                  showContracts={showContracts}
                  showDirectConnections={showDirectConnections}
                  showEntryPoints={showEntryPoints}
                  showDeployments={showDeployments}
                  showPersistence={showPersistence}
                  showDataConnections={showDataConnections}
                  onSelect={setSelectedId}
                />
              )}
            </div>

            <div className='space-y-5 xl:sticky xl:top-20 xl:self-start'>
              {sceneState.status === 'ready' ? (
                <>
                  {contextReviewOpen && navigationContext != null && (
                    <ArchitectureContextReviewPanel
                      context={navigationContext}
                      onSelectComponent={(id) => {
                        setSelectedId(id)
                      }}
                    />
                  )}
                  <ArchitectureInspector
                    scene={sceneState.scene}
                    selectedId={selectedId}
                    navigationContext={navigationContext}
                  />
                  <Card>
                    <CardHeader>
                      <div className='flex items-center gap-2'>
                        <GitBranch className='size-5 text-cyan-500' />
                        <CardTitle>Legend</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className='space-y-3 text-sm'>
                      <div className='flex items-center gap-3'>
                        <span className='h-0.5 w-10 bg-emerald-300' />
                        <span>Contract corridor</span>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className='h-0.5 w-10 bg-red-500' />
                        <span>Direct dependency</span>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className='h-0.5 w-10 bg-blue-500' />
                        <span>Persistence read</span>
                      </div>
                      <div className='flex items-center gap-3'>
                        <span className='h-0.5 w-10 bg-amber-400' />
                        <span>Persistence write</span>
                      </div>
                      <div className='flex items-center gap-3'>
                        <Route className='size-4 text-amber-400' />
                        <span>Entry point</span>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className='space-y-3 p-5'>
                    <Skeleton className='h-6 w-40' />
                    <Skeleton className='h-24 w-full' />
                    <Skeleton className='h-24 w-full' />
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </Main>
    </>
  )
}
