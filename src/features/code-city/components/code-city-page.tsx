import { startTransition, useEffect, useMemo, useState } from 'react'
import { Boxes, Camera, Database, MapPinned, Search } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { useStore } from '@/store'
import type { DashboardRepositoryOption } from '@/features/dashboard/api-types'
import { fetchDashboardRepositories } from '@/features/dashboard/graphql/fetch-dashboard-data'
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
import { cn } from '@/lib/utils'
import { codeCityDatasetOptions } from '../fixtures'
import {
  loadCodeCityScene,
  type LoadCodeCitySceneInput,
} from '../load-code-city-scene'
import { scheduleIdleTask } from '../idle'
import type { CodeCitySceneModel } from '../schema'
import {
  createBuildingCameraFocus,
  getBuildingById,
  getCodeCitySearchResults,
  getCodeCityZoomTier,
  getSceneSummary,
  resolveCodeCityCameraPreset,
} from '../scene-utils'
import { isLiveCodeCityDataset } from '../sources'
import { CodeCityCanvas } from './code-city-canvas'
import { CodeCityInspector } from './code-city-inspector'
import { useCodeCityStore } from '../store'

const codeCityProjectPath =
  import.meta.env.VITE_CODE_CITY_PROJECT_PATH?.trim() || '.'
const repoAutoValue = '__code_city_repo_auto__'
const COARSE_CODE_CITY_BUILDING_LIMIT = 220

type LoadState =
  | {
      status: 'loading'
      scene: null
      error: null
    }
  | {
      status: 'ready'
      scene: CodeCitySceneModel
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

type CodeCityPageProps = {
  loadScene?: (input: LoadCodeCitySceneInput) => Promise<CodeCitySceneModel>
}

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

export function CodeCityPage({
  loadScene = loadCodeCityScene,
}: CodeCityPageProps) {
  const datasetId = useCodeCityStore((state) => state.datasetId)
  const searchQuery = useCodeCityStore((state) => state.searchQuery)
  const selectedBuildingId = useCodeCityStore(
    (state) => state.selectedBuildingId,
  )
  const activePresetId = useCodeCityStore((state) => state.activePresetId)
  const showLabels = useCodeCityStore((state) => state.showLabels)
  const showTests = useCodeCityStore((state) => state.showTests)
  const showProps = useCodeCityStore((state) => state.showProps)
  const showOverlays = useCodeCityStore((state) => state.showOverlays)
  const zoomDistance = useCodeCityStore((state) => state.zoomDistance)
  const cameraFocus = useCodeCityStore((state) => state.cameraFocus)
  const setDatasetId = useCodeCityStore((state) => state.setDatasetId)
  const setSearchQuery = useCodeCityStore((state) => state.setSearchQuery)
  const focusBuilding = useCodeCityStore((state) => state.focusBuilding)
  const focusPreset = useCodeCityStore((state) => state.focusPreset)
  const setActivePresetId = useCodeCityStore((state) => state.setActivePresetId)
  const setSelectedBuildingId = useCodeCityStore(
    (state) => state.setSelectedBuildingId,
  )
  const toggleLayer = useCodeCityStore((state) => state.toggleLayer)
  const setZoomDistance = useCodeCityStore((state) => state.setZoomDistance)
  const setCameraFocus = useCodeCityStore((state) => state.setCameraFocus)
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
  const liveDataset = isLiveCodeCityDataset(datasetId)
  const resolvedRepoId = selectedDashboardRepo?.repoId ?? null
  const sceneRepoId = liveDataset ? resolvedRepoId : selectedDashboardRepoId
  const awaitingLiveRepository =
    liveDataset &&
    resolvedRepoId == null &&
    repoLoadState !== 'ready' &&
    repoLoadState !== 'error'
  const liveRepositoryError =
    liveDataset && resolvedRepoId == null && repoLoadState === 'ready'
      ? 'No repository is available from the dashboard API.'
      : liveDataset && resolvedRepoId == null && repoLoadState === 'error'
        ? (repoLoadError ?? 'Could not load repositories.')
        : null
  const [retryToken, setRetryToken] = useState(0)
  const loadKey = `${datasetId}:${sceneRepoId ?? 'auto'}:${codeCityProjectPath}:${retryToken}`
  const [storedDetailLoadState, setDetailLoadState] = useState<{
    loadKey: string
    status: 'idle' | 'loading' | 'ready' | 'error'
  }>({
    loadKey,
    status: 'idle',
  })
  const detailLoadState =
    storedDetailLoadState.loadKey === loadKey
      ? storedDetailLoadState.status
      : 'idle'
  const [storedSceneState, setStoredSceneState] = useState<StoredLoadState>({
    ...loadingSceneState(),
    loadKey,
  })
  const sceneState =
    storedSceneState.loadKey === loadKey
      ? storedSceneState
      : loadingSceneState()

  useEffect(() => {
    let cancelled = false
    const abortController = new AbortController()

    queueMicrotask(() => {
      if (cancelled) {
        return
      }

      setRepoLoadState('loading')
      setRepoLoadError(null)
    })

    void fetchDashboardRepositories({ signal: abortController.signal })
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
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        setDashboardRepoOptions([])
        setRepoLoadState('error')
        setRepoLoadError(
          error instanceof Error
            ? error.message
            : 'Could not load repositories.',
        )
      })

    return () => {
      cancelled = true
      abortController.abort()
    }
  }, [setDashboardRepoOptions])

  useEffect(() => {
    if (selectedDashboardRepoId == null || repoOptions.length === 0) {
      return
    }
    if (repoOptions.some((repo) => repo.repoId === selectedDashboardRepoId)) {
      return
    }

    setSelectedDashboardRepoId(null)
  }, [repoOptions, selectedDashboardRepoId, setSelectedDashboardRepoId])

  useEffect(() => {
    let cancelled = false
    const setStoredSceneStateDeferred = (state: StoredLoadState) => {
      queueMicrotask(() => {
        if (cancelled) {
          return
        }

        setStoredSceneState(state)
      })
    }

    if (awaitingLiveRepository) {
      setStoredSceneStateDeferred({
        ...loadingSceneState(),
        loadKey,
      })
      return () => {
        cancelled = true
      }
    }

    if (liveRepositoryError != null) {
      setStoredSceneStateDeferred({
        status: 'error',
        scene: null,
        error: liveRepositoryError,
        loadKey,
      })
      return () => {
        cancelled = true
      }
    }

    const initialAbortController = new AbortController()
    const detailAbortController = new AbortController()
    let cancelDetailSchedule: (() => void) | null = null

    const baseInput = {
      datasetId,
      repoId: sceneRepoId,
      projectPath: codeCityProjectPath,
    }

    const loadFullScene = () => {
      if (cancelled || !liveDataset) {
        return
      }

      setDetailLoadState({
        loadKey,
        status: 'loading',
      })

      void loadScene({
        ...baseInput,
        signal: detailAbortController.signal,
      })
        .then((scene) => {
          if (cancelled) {
            return
          }

          startTransition(() => {
            setStoredSceneState({
              status: 'ready',
              scene,
              error: null,
              loadKey,
            })
            setDetailLoadState({
              loadKey,
              status: 'ready',
            })
          })
        })
        .catch((error: unknown) => {
          if (cancelled) {
            return
          }
          if (error instanceof Error && error.name === 'AbortError') {
            return
          }

          setDetailLoadState({
            loadKey,
            status: 'error',
          })
        })
    }

    void loadScene({
      ...baseInput,
      first: liveDataset ? COARSE_CODE_CITY_BUILDING_LIMIT : undefined,
      signal: initialAbortController.signal,
    })
      .then((scene) => {
        if (cancelled) {
          return
        }

        setStoredSceneState({
          status: 'ready',
          scene,
          error: null,
          loadKey,
        })

        const defaultPreset = resolveCodeCityCameraPreset(scene, null)
        if (defaultPreset != null) {
          focusPreset(scene, defaultPreset.id)
        }

        if (liveDataset) {
          cancelDetailSchedule = scheduleIdleTask(loadFullScene, 350)
        }
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return
        }
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }

        setStoredSceneState({
          status: 'error',
          scene: null,
          error:
            error instanceof Error
              ? error.message
              : 'Could not load the Code Atlas scene.',
          loadKey,
        })
      })

    return () => {
      cancelled = true
      initialAbortController.abort()
      detailAbortController.abort()
      cancelDetailSchedule?.()
    }
  }, [
    awaitingLiveRepository,
    datasetId,
    focusPreset,
    liveDataset,
    liveRepositoryError,
    loadKey,
    loadScene,
    sceneRepoId,
  ])

  const scene = sceneState.scene
  const searchResults = useMemo(() => {
    if (scene == null) {
      return []
    }

    return getCodeCitySearchResults(scene, searchQuery, {
      includeTests: showTests,
      limit: 5,
    })
  }, [scene, searchQuery, showTests])

  const selectedBuilding = useMemo(
    () => (scene == null ? null : getBuildingById(scene, selectedBuildingId)),
    [scene, selectedBuildingId],
  )
  const sceneSummary = useMemo(
    () => (scene == null ? null : getSceneSummary(scene)),
    [scene],
  )
  const zoomTier = useMemo(
    () => (scene == null ? 'world' : getCodeCityZoomTier(zoomDistance, scene)),
    [scene, zoomDistance],
  )
  const sourceBadgeLabel = isLiveCodeCityDataset(datasetId)
    ? 'Live DevQL'
    : 'Fixture'
  const sourceSummary =
    scene?.source.repo ??
    selectedDashboardRepo?.identity ??
    'current repository'

  const handleRepoSelect = (value: string) => {
    setSelectedDashboardRepoId(value === repoAutoValue ? null : value)
  }

  const handleSearchResultClick = (buildingId: string) => {
    if (scene == null) {
      return
    }

    focusBuilding(scene, buildingId, { focusCamera: true })
  }

  const handleSceneSelection = (buildingId: string | null) => {
    if (scene == null) {
      setSelectedBuildingId(buildingId)
      return
    }

    if (buildingId == null) {
      setSelectedBuildingId(null)
      return
    }

    focusBuilding(scene, buildingId)
  }

  const handleSceneInspection = (buildingId: string) => {
    if (scene == null) {
      return
    }

    focusBuilding(scene, buildingId, {
      focusCamera: true,
      cameraMode: 'facade',
    })
  }

  const handleCameraControlStart = () => {
    setActivePresetId(null)
    setCameraFocus(null)
  }

  const retryLoad = () => {
    setRetryToken((value) => value + 1)
  }

  return (
    <>
      <Header className='pe-8'>
        <div className='ms-auto flex items-center gap-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main fluid>
        <div className='mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between'>
          <div>
            <div className='flex items-center gap-3'>
              <h1 className='text-2xl font-bold tracking-tight'>Code Atlas</h1>
              <Badge
                variant='outline'
                data-testid='code-city-source-badge'
                className='rounded-full border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/35 dark:bg-emerald-950/25 dark:text-emerald-200'
              >
                {sourceBadgeLabel}
              </Badge>
            </div>
            <p className='mt-2 max-w-3xl text-sm text-muted-foreground'>
              Explore the current DevQL CodeCity snapshot: building geometry,
              dependency arcs, health signals, and architecture diagnostics.
            </p>
          </div>

          <div className='flex items-center gap-2 text-xs text-muted-foreground'>
            <Database className='size-4' />
            <span>{sourceSummary}</span>
            {detailLoadState === 'loading' && (
              <Badge variant='outline' className='rounded-full'>
                Streaming detail
              </Badge>
            )}
          </div>
        </div>

        <div className='grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_22rem]'>
          <div className='space-y-4'>
            <Card className='border-slate-200/80 bg-white/88 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)] backdrop-blur dark:border-white/10 dark:bg-slate-950/80'>
              <CardHeader className='pb-4'>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <MapPinned className='size-4 text-muted-foreground' />
                  Scene controls
                </CardTitle>
                <CardDescription>
                  Choose the live graph or a fixture, fly to preset viewpoints,
                  and toggle analysis layers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className='grid gap-3 md:grid-cols-2 2xl:grid-cols-[minmax(0,15rem)_minmax(0,14rem)_minmax(0,14rem)_minmax(0,1fr)]'>
                  <div className='space-y-1.5'>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                      Repository
                    </p>
                    <Select
                      value={repoSelectValue}
                      onValueChange={handleRepoSelect}
                      disabled={repoOptions.length === 0}
                    >
                      <SelectTrigger
                        data-testid='code-city-repo-select'
                        className='w-full'
                      >
                        <SelectValue placeholder='Repository' />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={repoAutoValue}>
                          {repoOptions[0]?.identity
                            ? `Auto (${repoOptions[0].identity})`
                            : 'Auto (first available)'}
                        </SelectItem>
                        {repoOptions.map((repo) => (
                          <SelectItem key={repo.repoId} value={repo.repoId}>
                            {repo.identity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {repoLoadError != null && (
                      <p className='text-xs text-destructive'>
                        {repoLoadError}
                      </p>
                    )}
                  </div>

                  <div className='space-y-1.5'>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                      Dataset
                    </p>
                    <Select value={datasetId} onValueChange={setDatasetId}>
                      <SelectTrigger
                        data-testid='code-city-dataset-select'
                        className='w-full'
                      >
                        <SelectValue placeholder='Choose dataset' />
                      </SelectTrigger>
                      <SelectContent>
                        {codeCityDatasetOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>
                            {option.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-1.5'>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                      Preset
                    </p>
                    <Select
                      value={
                        activePresetId ?? scene?.cameraPresets[0]?.id ?? ''
                      }
                      onValueChange={(value) => {
                        if (scene == null) {
                          return
                        }

                        focusPreset(scene, value)
                      }}
                      disabled={scene == null}
                    >
                      <SelectTrigger
                        data-testid='code-city-preset-select'
                        className='w-full'
                      >
                        <SelectValue placeholder='Choose preset' />
                      </SelectTrigger>
                      <SelectContent>
                        {(scene?.cameraPresets ?? []).map((preset) => (
                          <SelectItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className='space-y-1.5 md:col-span-2 2xl:col-span-1'>
                    <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                      Search buildings
                    </p>
                    <div className='relative'>
                      <Search className='pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground' />
                      <Input
                        data-testid='code-city-search-input'
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder='Search file or district names'
                        className='ps-9'
                      />
                    </div>
                    {searchResults.length > 0 && (
                      <div
                        className='rounded-2xl border border-slate-200/80 bg-slate-50/85 p-2 dark:border-white/10 dark:bg-slate-900/35'
                        data-testid='code-city-search-results'
                      >
                        <div className='grid gap-2'>
                          {searchResults.map((result) => (
                            <button
                              type='button'
                              key={result.building.id}
                              className='flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-start transition hover:bg-white dark:hover:bg-white/8'
                              onClick={() =>
                                handleSearchResultClick(result.building.id)
                              }
                            >
                              <div>
                                <p className='text-sm font-medium'>
                                  {result.building.label}
                                </p>
                                <p className='text-xs text-muted-foreground'>
                                  {result.building.filePath}
                                </p>
                              </div>
                              <Badge variant='outline'>
                                {result.matchReason}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className='mt-4 flex flex-wrap items-center gap-2'>
                  <ToggleButton
                    active={showLabels}
                    label='Labels'
                    testId='code-city-toggle-labels'
                    onClick={() => toggleLayer('labels')}
                  />
                  <ToggleButton
                    active={showTests}
                    label='Tests'
                    testId='code-city-toggle-tests'
                    onClick={() => toggleLayer('tests')}
                  />
                  <ToggleButton
                    active={showProps}
                    label='Props'
                    testId='code-city-toggle-props'
                    onClick={() => toggleLayer('props')}
                  />
                  <ToggleButton
                    active={showOverlays}
                    label='Overlays'
                    testId='code-city-toggle-overlays'
                    onClick={() => toggleLayer('overlays')}
                  />
                  {selectedBuilding != null && (
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='rounded-full text-xs text-muted-foreground'
                      onClick={() =>
                        setCameraFocus(
                          createBuildingCameraFocus(selectedBuilding),
                        )
                      }
                    >
                      <Camera className='me-2 size-4' />
                      Reframe selection
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {sceneState.status === 'loading' && (
              <Card className='overflow-hidden border-slate-200/80 bg-white/88 dark:border-white/10 dark:bg-slate-950/80'>
                <CardContent className='space-y-3 px-6 py-6'>
                  <Skeleton className='h-7 w-52' />
                  <Skeleton className='h-[68svh] min-h-[520px] w-full rounded-[1.25rem]' />
                </CardContent>
              </Card>
            )}

            {sceneState.status === 'error' && (
              <Card className='border-red-200 bg-red-50/80 dark:border-red-400/30 dark:bg-red-950/25'>
                <CardHeader>
                  <CardTitle>Could not load Code Atlas</CardTitle>
                  <CardDescription>{sceneState.error}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button type='button' onClick={retryLoad}>
                    Try again
                  </Button>
                </CardContent>
              </Card>
            )}

            {sceneState.status === 'ready' &&
              scene != null &&
              scene.boundaries.length === 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>No Code Atlas data available</CardTitle>
                    <CardDescription>
                      The selected source contains no boundaries to render.
                    </CardDescription>
                  </CardHeader>
                </Card>
              )}

            {sceneState.status === 'ready' &&
              scene != null &&
              scene.boundaries.length > 0 && (
                <CodeCityCanvas
                  scene={scene}
                  selectedBuildingId={selectedBuildingId}
                  showLabels={showLabels}
                  showTests={showTests}
                  showProps={showProps}
                  showOverlays={showOverlays}
                  cameraFocus={cameraFocus}
                  zoomDistance={zoomDistance}
                  onSelectBuilding={handleSceneSelection}
                  onInspectBuilding={handleSceneInspection}
                  onCameraControlStart={handleCameraControlStart}
                  onZoomDistanceChange={setZoomDistance}
                />
              )}
          </div>

          <div className='space-y-4 xl:sticky xl:top-6 xl:self-start'>
            {scene != null && sceneSummary != null ? (
              <CodeCityInspector
                scene={scene}
                selectedBuilding={selectedBuilding}
                sceneSummary={sceneSummary}
                zoomTier={zoomTier}
              />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Inspector</CardTitle>
                  <CardDescription>
                    Load CodeCity data to inspect the city.
                  </CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                  <Skeleton className='h-28 w-full rounded-2xl' />
                  <Skeleton className='h-52 w-full rounded-2xl' />
                </CardContent>
              </Card>
            )}

            <Card className='border-slate-200/80 bg-white/88 dark:border-white/10 dark:bg-slate-950/80'>
              <CardHeader>
                <CardTitle className='flex items-center gap-2 text-base'>
                  <Boxes className='size-4 text-muted-foreground' />
                  Data sources
                </CardTitle>
                <CardDescription>
                  Live DevQL data is used by default; fixtures remain available
                  for renderer checks.
                </CardDescription>
              </CardHeader>
              <CardContent className='space-y-3'>
                {codeCityDatasetOptions.map((option) => (
                  <div
                    key={option.id}
                    className={cn(
                      'rounded-2xl border p-3 transition',
                      option.id === datasetId
                        ? 'border-slate-900/70 bg-slate-900 text-white dark:border-white/40 dark:bg-white dark:text-slate-950'
                        : 'border-slate-200/80 bg-slate-50/80 dark:border-white/10 dark:bg-white/5',
                    )}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div>
                        <p className='text-sm font-semibold'>{option.title}</p>
                        <p
                          className={cn(
                            'mt-1 text-xs',
                            option.id === datasetId
                              ? 'text-white/80 dark:text-slate-700'
                              : 'text-muted-foreground',
                          )}
                        >
                          {option.summary}
                        </p>
                      </div>
                      <Badge
                        variant='outline'
                        className={cn(
                          option.id === datasetId
                            ? 'border-white/40 text-white dark:border-slate-300 dark:text-slate-700'
                            : '',
                        )}
                      >
                        {option.worldLayout}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </Main>
    </>
  )
}
