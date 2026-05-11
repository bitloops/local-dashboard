import { useMemo } from 'react'
import {
  AlertTriangle,
  Building2,
  Compass,
  Layers3,
  Route,
  TestTube2,
  Waypoints,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CodeCityBuilding, CodeCitySceneModel } from '../schema'
import type { CodeCitySceneSummary, CodeCityZoomTier } from '../scene-utils'

type CodeCityInspectorProps = {
  scene: CodeCitySceneModel
  selectedBuilding: CodeCityBuilding | null
  sceneSummary: CodeCitySceneSummary
  zoomTier: CodeCityZoomTier
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatCoverage(value: number | null) {
  if (value == null) {
    return 'No data'
  }

  return formatPercent(value)
}

function RiskBadge({ risk }: { risk: number }) {
  const label = risk >= 0.7 ? 'High risk' : risk >= 0.45 ? 'Watch' : 'Healthy'
  const classes =
    risk >= 0.7
      ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-400/35 dark:bg-red-950/25 dark:text-red-200'
      : risk >= 0.45
        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/35 dark:bg-amber-950/25 dark:text-amber-200'
        : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-400/35 dark:bg-sky-950/25 dark:text-sky-200'

  return (
    <Badge variant='outline' className={classes}>
      {label}
    </Badge>
  )
}

function SummaryChip({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className='rounded-xl border border-slate-200/80 bg-white/80 p-3 dark:border-white/10 dark:bg-white/5'>
      <p className='text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground'>
        {label}
      </p>
      <p className='mt-1 text-lg font-semibold text-foreground'>{value}</p>
    </div>
  )
}

function formatArchitectureKind(value: string | null | undefined) {
  if (value == null || value.trim().length === 0) {
    return 'Unknown'
  }

  return value
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .toLowerCase()
    .replace(/^\w/u, (match) => match.toUpperCase())
}

function BuildingArchitectureOverview({
  scene,
  building,
}: {
  scene: CodeCitySceneModel
  building: CodeCityBuilding
}) {
  const containers = scene.architecture.containers.filter((container) =>
    building.architecture.containerIds.includes(container.id),
  )
  const components = containers.flatMap((container) =>
    container.components.filter((component) =>
      building.architecture.componentIds.includes(component.id),
    ),
  )
  const flows = scene.architecture.flows.filter((flow) =>
    building.architecture.traversedByFlowIds.includes(flow.id),
  )
  const hasArchitecture =
    containers.length > 0 ||
    components.length > 0 ||
    building.architecture.entryPoints.length > 0 ||
    flows.length > 0

  return (
    <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
      <div className='flex items-center justify-between gap-3'>
        <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
          Architecture graph
        </p>
        <Badge variant='outline'>
          {building.architecture.entryPoints.length} entry points
        </Badge>
      </div>

      {hasArchitecture ? (
        <div className='mt-3 grid gap-3'>
          {containers.map((container) => (
            <div
              key={container.id}
              className='rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'
            >
              <div className='flex items-center justify-between gap-3'>
                <p className='text-sm font-semibold'>{container.label}</p>
                <Badge variant='outline'>
                  {formatArchitectureKind(container.kind)}
                </Badge>
              </div>
              <p className='mt-1 break-all text-xs text-muted-foreground'>
                {container.path ?? container.key ?? container.id}
              </p>
            </div>
          ))}

          {components.slice(0, 4).map((component) => (
            <div
              key={component.id}
              className='flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'
            >
              <div>
                <p className='text-sm font-semibold'>{component.label}</p>
                <p className='break-all text-xs text-muted-foreground'>
                  {component.path ?? component.id}
                </p>
              </div>
              <Badge variant='outline'>Component</Badge>
            </div>
          ))}

          {building.architecture.entryPoints.map((entryPoint) => (
            <div
              key={entryPoint.id}
              className='flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/75 p-3 text-emerald-900 dark:border-emerald-400/30 dark:bg-emerald-950/20 dark:text-emerald-100'
            >
              <Waypoints className='size-4 shrink-0' />
              <div>
                <p className='text-sm font-semibold'>{entryPoint.label}</p>
                <p className='text-xs opacity-80'>
                  {formatArchitectureKind(entryPoint.entryKind)} ·{' '}
                  {formatPercent(entryPoint.confidence)}
                </p>
              </div>
            </div>
          ))}

          {flows.slice(0, 4).map((flow) => (
            <div
              key={flow.id}
              className='flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50/75 p-3 text-sky-900 dark:border-sky-400/30 dark:bg-sky-950/20 dark:text-sky-100'
            >
              <Route className='size-4 shrink-0' />
              <div>
                <p className='text-sm font-semibold'>{flow.label}</p>
                <p className='text-xs opacity-80'>
                  From {flow.entryPoint.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className='mt-3 text-sm text-muted-foreground'>
          No architecture graph links are attached to this building yet.
        </p>
      )}
    </div>
  )
}

function BuildingOverview({
  scene,
  building,
}: {
  scene: CodeCitySceneModel
  building: CodeCityBuilding
}) {
  const metrics = building.metricsSummary

  return (
    <div className='space-y-4'>
      <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
              Selected building
            </p>
            <h3 className='mt-2 text-lg font-semibold'>{building.label}</h3>
            <p className='mt-1 break-all text-sm text-muted-foreground'>
              {building.filePath}
            </p>
          </div>
          <RiskBadge risk={building.healthRisk} />
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-2'>
          <SummaryChip
            label='Importance'
            value={formatPercent(building.importance)}
          />
          <SummaryChip
            label='Health risk'
            value={formatPercent(building.healthRisk)}
          />
          <SummaryChip
            label='Height'
            value={`${building.height.toFixed(1)}u`}
          />
          <SummaryChip
            label='Footprint'
            value={`${building.footprint.toFixed(1)}u²`}
          />
        </div>
      </div>

      <BuildingArchitectureOverview scene={scene} building={building} />

      <div className='grid gap-4 md:grid-cols-2'>
        <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
          <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
            Signals
          </p>
          <dl className='mt-3 space-y-2 text-sm'>
            <div className='flex items-center justify-between gap-3'>
              <dt>Blast radius</dt>
              <dd>{formatPercent(metrics.blastRadius)}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>Weighted fan-in</dt>
              <dd>{formatPercent(metrics.weightedFanIn)}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>Articulation score</dt>
              <dd>{formatPercent(metrics.articulationScore)}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>LoC</dt>
              <dd>{metrics.loc}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>Artefacts</dt>
              <dd>{metrics.artefactCount}</dd>
            </div>
          </dl>
        </div>

        <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
          <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
            Change risk
          </p>
          <dl className='mt-3 space-y-2 text-sm'>
            <div className='flex items-center justify-between gap-3'>
              <dt>Churn</dt>
              <dd>{metrics.churn}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>Complexity</dt>
              <dd>{metrics.complexity}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>Bug fixes</dt>
              <dd>{metrics.bugCount}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>Coverage</dt>
              <dd>{formatCoverage(metrics.coverage)}</dd>
            </div>
            <div className='flex items-center justify-between gap-3'>
              <dt>Author concentration</dt>
              <dd>{formatPercent(metrics.authorConcentration)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
            Floors
          </p>
          <Badge variant='outline'>{building.floors.length} floors</Badge>
        </div>

        <ScrollArea className='mt-3 h-64 pe-4'>
          <div className='space-y-3'>
            {building.floors.map((floor) => (
              <div
                key={floor.id}
                className='rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'
              >
                <div className='flex items-center justify-between gap-3'>
                  <p className='text-sm font-semibold'>{floor.artefactName}</p>
                  <Badge variant='outline'>{floor.artefactKind}</Badge>
                </div>
                <div className='mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground'>
                  <span>{floor.loc} LoC</span>
                  <span>{floor.height.toFixed(1)}u</span>
                  <span>
                    {floor.insufficientData
                      ? 'Insufficient data'
                      : formatPercent(floor.healthRisk)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function SceneOverview({
  scene,
  sceneSummary,
  zoomTier,
}: {
  scene: CodeCitySceneModel
  sceneSummary: CodeCitySceneSummary
  zoomTier: CodeCityZoomTier
}) {
  const architectureSummary = useMemo(() => {
    const counts = new Map<string, number>()
    for (const boundary of scene.boundaries) {
      if (boundary.boundaryRole === 'group') {
        continue
      }

      counts.set(
        boundary.architecture,
        (counts.get(boundary.architecture) ?? 0) + 1,
      )
    }

    return Array.from(counts.entries())
      .map(([label, count]) => `${label} (${count})`)
      .join(', ')
  }, [scene.boundaries])

  return (
    <div className='space-y-4'>
      <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
        <div className='flex items-start justify-between gap-3'>
          <div>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
              Guided analysis
            </p>
            <h3 className='mt-2 text-lg font-semibold'>{scene.title}</h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              {scene.source.description}
            </p>
          </div>
          <Badge variant='outline'>{scene.worldLayout}</Badge>
        </div>

        <div className='mt-4 grid gap-3 sm:grid-cols-2'>
          <SummaryChip label='Boundaries' value={sceneSummary.boundaryCount} />
          <SummaryChip label='Buildings' value={sceneSummary.buildingCount} />
          <SummaryChip
            label='Containers'
            value={sceneSummary.architectureContainerCount}
          />
          <SummaryChip
            label='Components'
            value={sceneSummary.architectureComponentCount}
          />
          <SummaryChip
            label='Entry points'
            value={sceneSummary.architectureEntryPointCount}
          />
        </div>
      </div>

      <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
        <div className='flex items-center justify-between gap-3'>
          <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
            C4 projection
          </p>
          <Badge variant='outline'>
            {sceneSummary.architectureSystemCount} systems
          </Badge>
        </div>
        <div className='mt-3 grid gap-3'>
          {scene.architecture.systems.slice(0, 4).map((system) => (
            <div
              key={system.id}
              className='rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'
            >
              <div className='flex items-center justify-between gap-3'>
                <p className='text-sm font-semibold'>{system.label}</p>
                <Badge variant='outline'>{system.containerIds.length}</Badge>
              </div>
              <p className='mt-1 break-all text-xs text-muted-foreground'>
                {system.key}
              </p>
            </div>
          ))}
          {scene.architecture.containers.slice(0, 5).map((container) => (
            <div
              key={container.id}
              className='flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'
            >
              <div>
                <p className='text-sm font-semibold'>{container.label}</p>
                <p className='text-xs text-muted-foreground'>
                  {container.components.length} components ·{' '}
                  {container.entryPoints.length} entry points ·{' '}
                  {container.deploymentUnits.length} deployment units
                </p>
                {container.components.length > 0 && (
                  <p className='mt-1 break-all text-xs text-muted-foreground'>
                    {container.components
                      .slice(0, 3)
                      .map((component) => component.label)
                      .join(' · ')}
                  </p>
                )}
              </div>
              <Badge variant='outline'>
                {formatArchitectureKind(container.kind)}
              </Badge>
            </div>
          ))}
          {scene.architecture.containers.length === 0 && (
            <p className='text-sm text-muted-foreground'>
              Sync has not materialised containers for this repository yet.
            </p>
          )}
        </div>
      </div>

      <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
        <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
          Current analysis layer
        </p>
        <div className='mt-3 grid gap-3'>
          <div className='flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'>
            <Compass className='size-4 text-muted-foreground' />
            <div>
              <p className='text-sm font-semibold capitalize'>{zoomTier}</p>
              <p className='text-xs text-muted-foreground'>
                Labels and overlays adapt to this camera tier.
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'>
            <Layers3 className='size-4 text-muted-foreground' />
            <div>
              <p className='text-sm font-semibold'>Architectures</p>
              <p className='text-xs text-muted-foreground'>
                {architectureSummary}
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'>
            <Building2 className='size-4 text-muted-foreground' />
            <div>
              <p className='text-sm font-semibold'>Shared plazas</p>
              <p className='text-xs text-muted-foreground'>
                {sceneSummary.sharedBoundaryCount} shared-library boundaries in
                view.
              </p>
            </div>
          </div>
          <div className='flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'>
            <TestTube2 className='size-4 text-muted-foreground' />
            <div>
              <p className='text-sm font-semibold'>Shadow districts</p>
              <p className='text-xs text-muted-foreground'>
                Test code sits in muted, sunken zones beside production
                boundaries.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CodeCityInspector({
  scene,
  selectedBuilding,
  sceneSummary,
  zoomTier,
}: CodeCityInspectorProps) {
  return (
    <Card
      data-testid='code-city-inspector'
      className='border-slate-200/80 bg-white/90 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.4)] backdrop-blur dark:border-white/10 dark:bg-slate-950/80'
    >
      <CardHeader>
        <CardTitle>Inspector</CardTitle>
        <CardDescription>
          Read the selected building or the current dataset at a glance.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue='inspector'>
          <TabsList className='grid w-full grid-cols-2'>
            <TabsTrigger value='inspector'>Inspector</TabsTrigger>
            <TabsTrigger value='legend'>Legend</TabsTrigger>
          </TabsList>
          <TabsContent value='inspector' className='mt-4'>
            {selectedBuilding ? (
              <BuildingOverview scene={scene} building={selectedBuilding} />
            ) : (
              <SceneOverview
                scene={scene}
                sceneSummary={sceneSummary}
                zoomTier={zoomTier}
              />
            )}
          </TabsContent>
          <TabsContent value='legend' className='mt-4'>
            <div className='space-y-4'>
              <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
                <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                  Visual mappings
                </p>
                <div className='mt-3 space-y-3'>
                  {scene.legend.mappings.map((mapping) => (
                    <div
                      key={mapping.dimension}
                      className='rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'
                    >
                      <div className='flex items-center justify-between gap-3'>
                        <p className='text-sm font-semibold'>
                          {mapping.dimension}
                        </p>
                        <Badge variant='outline'>{mapping.metric}</Badge>
                      </div>
                      <p className='mt-1 text-xs text-muted-foreground'>
                        {mapping.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
                <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                  Health palette
                </p>
                <div className='mt-3 grid gap-3'>
                  {scene.legend.healthStops.map((stop) => (
                    <div
                      key={stop.label}
                      className='flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/75 p-3 dark:border-white/10 dark:bg-slate-900/35'
                    >
                      <div className='flex items-center gap-3'>
                        <span
                          className='size-4 rounded-full border border-black/10'
                          style={{ backgroundColor: stop.colour }}
                        />
                        <p className='text-sm font-medium'>{stop.label}</p>
                      </div>
                      <span className='text-xs text-muted-foreground'>
                        {formatPercent(stop.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className='rounded-2xl border border-slate-200/80 bg-white/85 p-4 dark:border-white/10 dark:bg-white/5'>
                <div className='flex items-center gap-3'>
                  <AlertTriangle className='size-4 text-red-600 dark:text-red-300' />
                  <div>
                    <p className='text-sm font-semibold'>Violation arcs</p>
                    <p className='text-xs text-muted-foreground'>
                      Persistent red arcs show architectural rule breaks across
                      zones.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
