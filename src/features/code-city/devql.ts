import {
  fetchDashboardRepositoriesCached,
  type DashboardRepositoryRecord,
} from '@/api/dashboard/client'
import { GraphQLRequestError } from '@/api/graphql/errors'
import { requestGraphQL } from '@/api/graphql/client'
import type {
  CodeCityArc,
  CodeCityBoundary,
  CodeCityBuilding,
  CodeCityCameraPreset,
  CodeCityDistrict,
  CodeCityFloor,
  CodeCityLegend,
  CodeCityMetricsSummary,
  CodeCityPlot,
  CodeCitySceneModel,
  CodeCitySharedLibrary,
  CodeCityVector3,
  CodeCityZone,
} from './schema'
import { codeCitySceneModelSchema } from './schema'
import { CODE_CITY_LIVE_DATASET_ID } from './sources'
import { codeCityBuildingIdForPath, slugifyCodeCityValue } from './ids'
import {
  addInferredWorkspaceComponents,
  createArchitectureFlowArcs,
  enrichBuildingsWithArchitecture,
  fetchAtlasArchitectureGraph,
  mapDevqlArchitectureGraphToSceneArchitecture,
  type DevqlArchitectureContainer,
  type DevqlArchitectureFlow,
  type DevqlArchitectureGraphNode,
  type DevqlArchitectureSystem,
} from './architecture-graph'

export { codeCityBuildingIdForPath } from './ids'

const HEALTHY = '#22A66A'
const MODERATE = '#D5D957'
const HIGH_RISK = '#E0444E'
const NO_DATA = '#8C96A3'
const VIOLATION = '#D63E4A'
const CROSS_BOUNDARY = '#E07832'
const DEPENDENCY = '#52F6FF'
const DEFAULT_PROJECT_PATH = '.'
const DEFAULT_BUILDING_LIMIT = 750
const MAX_LIVE_DISTRICT_DEPTH = 4
const LIVE_BOUNDARY_PLOT_PADDING = 3
const LIVE_DISTRICT_PLOT_PADDING = 0.45
const LIVE_DISTRICT_CONTENT_INSET = 0.7
const LIVE_DISTRICT_ITEM_GAP = 1.05
const LIVE_ROOT_DISTRICT_GAP = 1.85
const LIVE_ZONE_GAP = 4.2
const LIVE_BUILDING_RENDER_MIN_MARGIN = 0.64
const LIVE_BUILDING_RENDER_MARKER_SCALE = 1.34

export type DevqlCodeCitySeverity = 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO'

type DevqlCodeCityPattern =
  | 'LAYERED'
  | 'HEXAGONAL'
  | 'MODULAR'
  | 'EVENT_DRIVEN'
  | 'PIPE_AND_FILTER'
  | 'BALL_OF_MUD'
  | 'UNCLASSIFIED'

type DevqlCodeCityTopology =
  | 'SINGLE_BOUNDARY'
  | 'STAR'
  | 'LAYERED'
  | 'FEDERATED'
  | 'TANGLED'
  | 'UNKNOWN'

type DevqlCodeCityArcKind =
  | 'DEPENDENCY'
  | 'VIOLATION'
  | 'CROSS_BOUNDARY'
  | 'CYCLE'
  | 'BRIDGE'

type DevqlCodeCityArcVisibility =
  | 'HIDDEN_BY_DEFAULT'
  | 'VISIBLE_ON_SELECTION'
  | 'VISIBLE_AT_MEDIUM_ZOOM'
  | 'VISIBLE_AT_WORLD_ZOOM'
  | 'ALWAYS_VISIBLE'

type DevqlCodeCitySummary = {
  fileCount: number
  artefactCount: number
  dependencyCount: number
  boundaryCount: number
  macroEdgeCount: number
  includedFileCount: number
  excludedFileCount: number
  unhealthyFloorCount: number
  insufficientHealthDataCount: number
  coverageAvailable: boolean
  gitHistoryAvailable: boolean
  violationCount: number
  highSeverityViolationCount: number
  visibleArcCount: number
  crossBoundaryArcCount: number
  maxImportance: number
  maxHeight: number
}

type DevqlCodeCityHealthOverview = {
  status: string
  analysisWindowMonths: number
  generatedAt: string | null
  confidence: number
  missingSignals: string[]
  coverageAvailable: boolean
  gitHistoryAvailable: boolean
}

type DevqlCodeCityViolationSummary = {
  total: number
  high: number
  medium: number
  low: number
  info: number
}

type DevqlCodeCityBoundary = {
  id: string
  name: string
  rootPath: string
  kind: 'EXPLICIT' | 'RUNTIME' | 'IMPLICIT' | 'GROUP' | 'ROOT_FALLBACK'
  parentBoundaryId?: string | null
  source?:
    | 'MANIFEST'
    | 'WORKSPACE_MANIFEST'
    | 'ENTRY_POINT'
    | 'COMMUNITY_DETECTION'
    | 'HIERARCHY'
    | 'FALLBACK'
  fileCount: number
  sharedLibrary: boolean
  atomic: boolean
  architecture: {
    primaryPattern: DevqlCodeCityPattern
    primaryScore: number
    secondaryPattern: DevqlCodeCityPattern | null
    mudScore: number
    modularity: number
  } | null
  violationSummary: DevqlCodeCityViolationSummary
  diagnostics: DevqlCodeCityDiagnostic[]
}

type DevqlCodeCityBoundaryLayout = {
  boundaryId: string
  strategy: string
  zoneCount: number
  width: number
  depth: number
  x: number
  z: number
}

type DevqlCodeCityFloor = {
  artefactId: string | null
  symbolId: string | null
  name: string
  canonicalKind: string | null
  languageKind: string | null
  startLine: number
  endLine: number
  loc: number
  floorIndex: number
  floorHeight: number
  healthRisk: number | null
  colour: string
  healthStatus: string
  healthConfidence: number
  healthMetrics: {
    churn: number
    complexity: number
    bugCount: number
    coverage: number | null
    authorConcentration: number
  }
  healthEvidence: {
    missingSignals: string[]
  }
}

type DevqlCodeCityBuilding = {
  path: string
  language: string
  boundaryId: string
  zone: string
  inferredZone: string | null
  conventionZone: string | null
  architectureRole: string | null
  importance: {
    score: number
    blastRadius: number
    weightedFanIn: number
    articulationScore: number
    normalizedBlastRadius: number
    normalizedWeightedFanIn: number
    normalizedArticulationScore: number
  }
  size: {
    loc: number
    artefactCount: number
    totalHeight: number
  }
  geometry: {
    x: number
    y: number
    z: number
    width: number
    depth: number
    sideLength: number
    footprintArea: number
    height: number
  }
  healthRisk: number | null
  healthStatus: string
  healthConfidence: number
  colour: string
  healthSummary: {
    floorCount: number
    highRiskFloorCount: number
    insufficientDataFloorCount: number
    averageRisk: number | null
    maxRisk: number | null
    missingSignals: string[]
  }
  diagnosticBadges: Array<{
    kind: string
    severity: DevqlCodeCitySeverity
    count: number
    tooltip: string
  }>
  floors: DevqlCodeCityFloor[]
}

type DevqlCodeCityRenderArc = {
  id: string
  kind: DevqlCodeCityArcKind
  visibility: DevqlCodeCityArcVisibility
  severity: DevqlCodeCitySeverity | null
  fromPath: string | null
  toPath: string | null
  fromBoundaryId: string | null
  toBoundaryId: string | null
  weight: number
  label: string | null
  tooltip: string | null
}

type DevqlCodeCityDependencyArc = {
  fromPath: string
  toPath: string
  edgeCount: number
  arcKind: string
  severity: string | null
}

type DevqlCodeCityDiagnostic = {
  code: string
  severity: string
  message: string
  path: string | null
  boundaryId: string | null
}

type DevqlCodeCityWorld = {
  capability: string
  stage: string
  status: string
  repoId: string
  commitSha: string | null
  configFingerprint: string
  summary: DevqlCodeCitySummary
  health: DevqlCodeCityHealthOverview
  layout: {
    layoutKind: string
    width: number
    depth: number
    gap: number
  }
  boundaries: DevqlCodeCityBoundary[]
  boundaryLayouts: DevqlCodeCityBoundaryLayout[]
  macroGraph: {
    topology: DevqlCodeCityTopology
    boundaryCount: number
    edgeCount: number
  } | null
  buildings: DevqlCodeCityBuilding[]
  arcs: DevqlCodeCityRenderArc[]
  dependencyArcs: DevqlCodeCityDependencyArc[]
  diagnostics: DevqlCodeCityDiagnostic[]
}

type DevqlCodeCityWorldQueryData = {
  repo: {
    project: {
      path: string
      codeCityWorld: DevqlCodeCityWorld
    }
  }
}

type DevqlCodeCityWorldVariables = {
  repo: string
  projectPath: string
  first: number
}

export type LoadDevqlCodeCitySceneInput = {
  repoId?: string | null
  projectPath?: string
  first?: number
  signal?: AbortSignal
}

export type MapDevqlCodeCityWorldOptions = {
  repository: Pick<
    DashboardRepositoryRecord,
    'repoId' | 'identity' | 'name' | 'organization'
  >
  projectPath?: string
  generatedAt?: string
  architecture?: {
    systems: DevqlArchitectureSystem[]
    containers: DevqlArchitectureContainer[]
    graphNodes: DevqlArchitectureGraphNode[]
    flows: DevqlArchitectureFlow[]
  }
}

export const CODE_CITY_WORLD_QUERY = `
  query CodeCityWorld($repo: String!, $projectPath: String!, $first: Int!) {
    repo(name: $repo) {
      project(path: $projectPath) {
        path
        codeCityWorld(
          first: $first
          includeDependencyArcs: true
          includeBoundaries: true
          includeArchitecture: true
          includeMacroEdges: true
          includeZoneDiagnostics: true
          includeHealth: true
        ) {
          capability
          stage
          status
          repoId
          commitSha
          configFingerprint
          summary {
            fileCount
            artefactCount
            dependencyCount
            boundaryCount
            macroEdgeCount
            includedFileCount
            excludedFileCount
            unhealthyFloorCount
            insufficientHealthDataCount
            coverageAvailable
            gitHistoryAvailable
            violationCount
            highSeverityViolationCount
            visibleArcCount
            crossBoundaryArcCount
            maxImportance
            maxHeight
          }
          health {
            status
            analysisWindowMonths
            generatedAt
            confidence
            missingSignals
            coverageAvailable
            gitHistoryAvailable
          }
          layout {
            layoutKind
            width
            depth
            gap
          }
          boundaries {
            id
            name
            rootPath
            kind
            parentBoundaryId
            source
            fileCount
            sharedLibrary
            atomic
            architecture {
              primaryPattern
              primaryScore
              secondaryPattern
              mudScore
              modularity
            }
            violationSummary {
              total
              high
              medium
              low
              info
            }
            diagnostics {
              code
              severity
              message
              path
              boundaryId
            }
          }
          boundaryLayouts {
            boundaryId
            strategy
            zoneCount
            width
            depth
            x
            z
          }
          macroGraph {
            topology
            boundaryCount
            edgeCount
          }
          buildings {
            path
            language
            boundaryId
            zone
            inferredZone
            conventionZone
            architectureRole
            importance {
              score
              blastRadius
              weightedFanIn
              articulationScore
              normalizedBlastRadius
              normalizedWeightedFanIn
              normalizedArticulationScore
            }
            size {
              loc
              artefactCount
              totalHeight
            }
            geometry {
              x
              y
              z
              width
              depth
              sideLength
              footprintArea
              height
            }
            healthRisk
            healthStatus
            healthConfidence
            colour
            healthSummary {
              floorCount
              highRiskFloorCount
              insufficientDataFloorCount
              averageRisk
              maxRisk
              missingSignals
            }
            diagnosticBadges {
              kind
              severity
              count
              tooltip
            }
            floors {
              artefactId
              symbolId
              name
              canonicalKind
              languageKind
              startLine
              endLine
              loc
              floorIndex
              floorHeight
              healthRisk
              colour
              healthStatus
              healthConfidence
              healthMetrics {
                churn
                complexity
                bugCount
                coverage
                authorConcentration
              }
              healthEvidence {
                missingSignals
              }
            }
          }
          arcs {
            id
            kind
            visibility
            severity
            fromPath
            toPath
            fromBoundaryId
            toBoundaryId
            weight
            label
            tooltip
          }
          dependencyArcs {
            fromPath
            toPath
            edgeCount
            arcKind
            severity
          }
          diagnostics {
            code
            severity
            message
            path
            boundaryId
          }
        }
      }
    }
  }
`

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function clamp01(value: number | null | undefined) {
  return clamp(value ?? 0, 0, 1)
}

function safePositive(value: number, fallback: number) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function safeHexColour(value: string | null | undefined, fallback: string) {
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/u.test(value ?? '')
    ? (value as string)
    : fallback
}

function slugify(value: string) {
  return slugifyCodeCityValue(value)
}

function fileLabel(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path
}

function enumLabel(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ')
}

function toWorldLayout(
  topology: DevqlCodeCityTopology | undefined,
): CodeCitySceneModel['worldLayout'] {
  switch (topology) {
    case 'SINGLE_BOUNDARY':
      return 'single-boundary'
    case 'STAR':
      return 'star/shared-kernel'
    case 'LAYERED':
      return 'layered'
    case 'FEDERATED':
      return 'federated'
    case 'TANGLED':
      return 'tangled'
    case 'UNKNOWN':
    case undefined:
      return 'unknown'
  }
}

function toBoundaryArchitecture(
  pattern: DevqlCodeCityPattern | undefined,
  sharedLibrary: boolean,
): CodeCityBoundary['architecture'] {
  if (sharedLibrary) {
    return 'shared-library'
  }

  switch (pattern) {
    case 'HEXAGONAL':
      return 'hexagonal'
    case 'LAYERED':
      return 'layered'
    case 'MODULAR':
      return 'modular'
    case 'EVENT_DRIVEN':
      return 'event-driven'
    case 'PIPE_AND_FILTER':
      return 'pipe-and-filter'
    case 'BALL_OF_MUD':
      return 'ball-of-mud'
    case 'UNCLASSIFIED':
    case undefined:
      return 'unclassified'
  }
}

function toTopologyRole(
  boundary: DevqlCodeCityBoundary,
  topology: DevqlCodeCityTopology | undefined,
): CodeCityBoundary['topologyRole'] {
  if (boundary.sharedLibrary) {
    return 'shared'
  }

  if (boundary.architecture?.primaryPattern === 'LAYERED') {
    return 'layer'
  }

  switch (topology) {
    case 'SINGLE_BOUNDARY':
      return 'centre'
    case 'STAR':
      return 'spoke'
    case 'TANGLED':
      return 'tangled-cluster'
    case 'LAYERED':
      return 'layer'
    case 'FEDERATED':
    case 'UNKNOWN':
    case undefined:
      return 'peer'
  }
}

function toBoundaryKind(
  boundary: DevqlCodeCityBoundary,
  boundaryRole: CodeCityBoundary['boundaryRole'] = 'leaf',
): CodeCityBoundary['kind'] {
  if (boundaryRole === 'group') {
    return 'group'
  }

  if (boundary.sharedLibrary) {
    return 'shared-kernel'
  }

  if (boundary.kind === 'IMPLICIT') {
    return 'library'
  }

  if (boundary.kind === 'RUNTIME') {
    return 'tooling'
  }

  return boundary.rootPath === '.' ? 'application' : 'service'
}

type BoundaryHierarchy = {
  childIdsByParent: Map<string, string[]>
  depthByBoundary: Map<string, number>
}

function buildBoundaryHierarchy(
  boundaries: DevqlCodeCityBoundary[],
): BoundaryHierarchy {
  const childIdsByParent = new Map<string, string[]>()
  const byId = new Map(boundaries.map((boundary) => [boundary.id, boundary]))

  for (const boundary of boundaries) {
    if (boundary.parentBoundaryId == null) {
      continue
    }
    childIdsByParent.set(boundary.parentBoundaryId, [
      ...(childIdsByParent.get(boundary.parentBoundaryId) ?? []),
      boundary.id,
    ])
  }

  const depthByBoundary = new Map<string, number>()
  const resolveDepth = (
    boundary: DevqlCodeCityBoundary,
    seen = new Set<string>(),
  ): number => {
    const existing = depthByBoundary.get(boundary.id)
    if (existing != null) {
      return existing
    }
    if (boundary.parentBoundaryId == null || seen.has(boundary.id)) {
      depthByBoundary.set(boundary.id, 0)
      return 0
    }

    const parent = byId.get(boundary.parentBoundaryId)
    if (parent == null) {
      depthByBoundary.set(boundary.id, 0)
      return 0
    }

    seen.add(boundary.id)
    const depth = resolveDepth(parent, seen) + 1
    depthByBoundary.set(boundary.id, depth)
    return depth
  }

  for (const boundary of boundaries) {
    resolveDepth(boundary)
  }

  return {
    childIdsByParent,
    depthByBoundary,
  }
}

function boundaryRoleFor(
  boundary: DevqlCodeCityBoundary,
  hierarchy: BoundaryHierarchy,
): CodeCityBoundary['boundaryRole'] {
  return boundary.kind === 'GROUP' ||
    boundary.source === 'HIERARCHY' ||
    (hierarchy.childIdsByParent.get(boundary.id)?.length ?? 0) > 0
    ? 'group'
    : 'leaf'
}

function toZoneType(zone: string): CodeCityZone['zoneType'] {
  const normalised = zone.trim().toLowerCase()
  if (normalised.includes('core')) {
    return 'core'
  }
  if (normalised.includes('application')) {
    return 'application'
  }
  if (normalised.includes('port')) {
    return 'ports'
  }
  if (normalised.includes('periphery') || normalised.includes('infra')) {
    return 'periphery'
  }
  if (normalised.includes('edge') || normalised.includes('adapter')) {
    return 'edge'
  }
  if (normalised.includes('shared')) {
    return 'shared'
  }
  if (normalised.includes('test') || normalised.includes('spec')) {
    return 'test'
  }
  if (normalised.includes('stage')) {
    return 'stage'
  }
  if (normalised.includes('chaos') || normalised.includes('mud')) {
    return 'chaos'
  }
  return 'module'
}

function toZoneAgreement(
  building: DevqlCodeCityBuilding,
): CodeCityBuilding['zoneAgreement'] {
  const actual = building.zone.trim().toLowerCase()
  const inferred = building.inferredZone?.trim().toLowerCase()
  const convention = building.conventionZone?.trim().toLowerCase()

  if (inferred != null && inferred !== '' && inferred !== actual) {
    return 'violation'
  }

  if (convention != null && convention !== '' && convention !== actual) {
    return 'warning'
  }

  return 'aligned'
}

function toSeverity(
  severity: DevqlCodeCitySeverity | string | null | undefined,
): CodeCityArc['severity'] {
  switch (severity) {
    case 'HIGH':
    case 'high':
      return 'high'
    case 'MEDIUM':
    case 'medium':
      return 'medium'
    case 'LOW':
    case 'INFO':
    case 'low':
    case 'info':
    default:
      return 'low'
  }
}

function toArcType(
  kind: DevqlCodeCityArcKind | string,
): CodeCityArc['arcType'] {
  if (kind === 'VIOLATION' || kind === 'CYCLE') {
    return 'violation'
  }

  if (kind === 'CROSS_BOUNDARY' || kind === 'BRIDGE') {
    return 'cross-boundary'
  }

  return 'dependency'
}

function toArcVisibility(
  visibility: DevqlCodeCityArcVisibility,
): NonNullable<CodeCityArc['visibility']> {
  switch (visibility) {
    case 'HIDDEN_BY_DEFAULT':
      return 'hidden-by-default'
    case 'VISIBLE_ON_SELECTION':
      return 'visible-on-selection'
    case 'VISIBLE_AT_MEDIUM_ZOOM':
      return 'visible-at-medium-zoom'
    case 'VISIBLE_AT_WORLD_ZOOM':
      return 'visible-at-world-zoom'
    case 'ALWAYS_VISIBLE':
      return 'always-visible'
  }
}

function visibleAtZoom(
  visibility: NonNullable<CodeCityArc['visibility']>,
): CodeCityArc['visibleAtZoom'] {
  switch (visibility) {
    case 'hidden-by-default':
    case 'visible-on-selection':
      return { min: 0, max: 180 }
    case 'visible-at-medium-zoom':
      return { min: 45, max: 210 }
    case 'visible-at-world-zoom':
      return { min: 110, max: 340 }
    case 'always-visible':
      return { min: 0, max: 340 }
  }
}

function normaliseArcStrength(weight: number, maxWeight: number) {
  if (maxWeight <= 0) {
    return 0.35
  }

  return clamp(Math.log1p(Math.max(0, weight)) / Math.log1p(maxWeight), 0.12, 1)
}

function isTestPath(path: string) {
  return /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[cm]?[jt]sx?$/iu.test(
    path,
  )
}

function aggregateCoverage(floors: DevqlCodeCityFloor[]) {
  const coverage = floors
    .map((floor) => floor.healthMetrics.coverage)
    .filter((value): value is number => value != null)

  if (coverage.length === 0) {
    return null
  }

  return coverage.reduce((sum, value) => sum + value, 0) / coverage.length
}

function aggregateMetrics(
  building: DevqlCodeCityBuilding,
): CodeCityMetricsSummary {
  const floors = building.floors
  const floorCount = Math.max(1, floors.length)
  const sum = (selector: (floor: DevqlCodeCityFloor) => number) =>
    floors.reduce((total, floor) => total + selector(floor), 0)

  return {
    blastRadius: clamp01(building.importance.normalizedBlastRadius),
    weightedFanIn: clamp01(building.importance.normalizedWeightedFanIn),
    articulationScore: clamp01(building.importance.normalizedArticulationScore),
    loc: Math.max(0, Math.round(building.size.loc)),
    artefactCount: Math.max(0, Math.round(building.size.artefactCount)),
    churn: Number(
      (sum((floor) => floor.healthMetrics.churn) / floorCount).toFixed(1),
    ),
    complexity: Number(
      (sum((floor) => floor.healthMetrics.complexity) / floorCount).toFixed(1),
    ),
    bugCount: Math.round(sum((floor) => floor.healthMetrics.bugCount)),
    coverage: aggregateCoverage(floors),
    authorConcentration: clamp01(
      sum((floor) => floor.healthMetrics.authorConcentration) / floorCount,
    ),
  }
}

function visualBuildingHeight(
  building: DevqlCodeCityBuilding,
  maxSourceHeight: number,
) {
  const sourceHeight = Math.max(
    building.size.totalHeight,
    building.geometry.height,
  )
  if (maxSourceHeight <= 0) {
    return 4
  }

  return Number((2.2 + (sourceHeight / maxSourceHeight) * 24).toFixed(2))
}

function mapFloors(
  building: DevqlCodeCityBuilding,
  visualHeight: number,
): CodeCityFloor[] {
  const floors = [...building.floors].sort(
    (left, right) => left.floorIndex - right.floorIndex,
  )
  const sourceHeight = floors.reduce(
    (total, floor) => total + safePositive(floor.floorHeight, 1),
    0,
  )
  const fallbackHeight = visualHeight / Math.max(1, floors.length)

  if (floors.length === 0) {
    return [
      {
        id: `${codeCityBuildingIdForPath(building.path)}::file`,
        artefactName: fileLabel(building.path),
        artefactKind: 'file',
        loc: Math.max(0, building.size.loc),
        height: Math.max(0.6, visualHeight),
        colour: safeHexColour(building.colour, NO_DATA),
        healthRisk: clamp01(building.healthRisk),
        insufficientData: building.healthSummary.missingSignals.length > 0,
      },
    ]
  }

  return floors.map((floor) => {
    const floorHeight =
      sourceHeight > 0
        ? (safePositive(floor.floorHeight, fallbackHeight) / sourceHeight) *
          visualHeight
        : fallbackHeight
    const missingSignals =
      floor.healthEvidence.missingSignals.length > 0 ||
      floor.healthStatus === 'partial' ||
      floor.healthStatus === 'unknown'

    return {
      id:
        floor.artefactId ??
        floor.symbolId ??
        `${codeCityBuildingIdForPath(building.path)}::floor:${floor.floorIndex}`,
      artefactName: floor.name,
      artefactKind:
        floor.canonicalKind ??
        floor.languageKind ??
        building.architectureRole ??
        'artefact',
      loc: Math.max(0, floor.loc),
      height: Math.max(0.6, floorHeight),
      colour: safeHexColour(floor.colour, missingSignals ? NO_DATA : HEALTHY),
      healthRisk: clamp01(floor.healthRisk),
      insufficientData: missingSignals,
    }
  })
}

function mapBuilding(
  building: DevqlCodeCityBuilding,
  maxSourceHeight: number,
): CodeCityBuilding {
  const width = safePositive(building.geometry.width, 1)
  const depth = safePositive(building.geometry.depth, 1)
  const height = visualBuildingHeight(building, maxSourceHeight)
  const floors = mapFloors(building, height)

  return {
    nodeType: 'building',
    id: codeCityBuildingIdForPath(building.path),
    filePath: building.path,
    label: fileLabel(building.path),
    importance: clamp01(building.importance.score),
    healthRisk: clamp01(building.healthRisk ?? building.healthSummary.maxRisk),
    height,
    footprint: safePositive(building.geometry.footprintArea, width * depth),
    plot: {
      x: building.geometry.x,
      y: building.geometry.y,
      z: building.geometry.z,
      width,
      depth,
      rotation: 0,
    },
    zoneAgreement: toZoneAgreement(building),
    isTest: isTestPath(building.path) || toZoneType(building.zone) === 'test',
    floors,
    incomingArcIds: [],
    outgoingArcIds: [],
    metricsSummary: aggregateMetrics(building),
    architecture: {
      nodeIds: [],
      containerIds: [],
      componentIds: [],
      entryPoints: [],
      traversedByFlowIds: [],
    },
  }
}

function boundsForPlots(
  plots: CodeCityPlot[],
  options?: {
    padding?: number
    minWidth?: number
    minDepth?: number
  },
) {
  const padding = options?.padding ?? LIVE_BOUNDARY_PLOT_PADDING
  const minWidth = options?.minWidth ?? 8
  const minDepth = options?.minDepth ?? 8

  if (plots.length === 0) {
    return {
      x: 0,
      z: 0,
      width: minWidth,
      depth: minDepth,
    }
  }

  const minX = Math.min(...plots.map((plot) => plot.x))
  const minZ = Math.min(...plots.map((plot) => plot.z))
  const maxX = Math.max(...plots.map((plot) => plot.x + plot.width))
  const maxZ = Math.max(...plots.map((plot) => plot.z + plot.depth))

  return {
    x: minX - padding,
    z: minZ - padding,
    width: Math.max(minWidth, maxX - minX + padding * 2),
    depth: Math.max(minDepth, maxZ - minZ + padding * 2),
  }
}

function plotForBounds(bounds: {
  x: number
  z: number
  width: number
  depth: number
}): CodeCityPlot {
  return {
    x: bounds.x,
    y: 0,
    z: bounds.z,
    width: bounds.width,
    depth: bounds.depth,
    rotation: 0,
  }
}

function centreForBounds(bounds: {
  x: number
  z: number
  width: number
  depth: number
}): CodeCityVector3 {
  return {
    x: bounds.x + bounds.width / 2,
    y: 0,
    z: bounds.z + bounds.depth / 2,
  }
}

function translateDistrict(
  district: CodeCityDistrict,
  deltaX: number,
  deltaZ: number,
): CodeCityDistrict {
  return {
    ...district,
    plot: {
      ...district.plot,
      x: district.plot.x + deltaX,
      z: district.plot.z + deltaZ,
    },
    children: district.children.map((child) => {
      if (child.nodeType === 'district') {
        return translateDistrict(child, deltaX, deltaZ)
      }

      return {
        ...child,
        plot: {
          ...child.plot,
          x: child.plot.x + deltaX,
          z: child.plot.z + deltaZ,
        },
      }
    }),
  }
}

type LiveFolderNode = {
  segment: string
  path: string
  depth: number
  children: Map<string, LiveFolderNode>
  buildings: CodeCityBuilding[]
}

type CodeCityRectBounds = ReturnType<typeof boundsForPlots>

type PackedLayoutItem<T> = {
  item: T
  width: number
  depth: number
}

type PackedLayoutPlacement<T> = {
  item: T
  x: number
  z: number
}

type MeasuredFolderLayout = {
  node: LiveFolderNode
  width: number
  depth: number
  placements: Array<
    PackedLayoutPlacement<
      | {
          kind: 'district'
          layout: MeasuredFolderLayout
        }
      | {
          kind: 'building'
          building: CodeCityBuilding
          marginX: number
          marginZ: number
        }
    >
  >
}

function relativePathForBoundary(filePath: string, boundaryRootPath: string) {
  if (boundaryRootPath === '.' || boundaryRootPath.trim().length === 0) {
    return filePath
  }

  if (filePath === boundaryRootPath) {
    return ''
  }

  const prefix = `${boundaryRootPath}/`
  return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath
}

function folderSegmentsForBuilding(
  boundary: DevqlCodeCityBoundary,
  building: CodeCityBuilding,
) {
  const relativePath = relativePathForBoundary(
    building.filePath,
    boundary.rootPath,
  )
  const segments = relativePath.split('/').filter(Boolean)
  const folderSegments = segments.slice(0, -1)

  if (folderSegments.length === 0) {
    return ['root files']
  }

  return folderSegments.slice(0, MAX_LIVE_DISTRICT_DEPTH)
}

function childFolderPath(parentPath: string, segment: string) {
  if (parentPath.length === 0 || parentPath === '.') {
    return segment
  }

  return `${parentPath}/${segment}`
}

function createFolderNode(
  segment: string,
  path: string,
  depth: number,
): LiveFolderNode {
  return {
    segment,
    path,
    depth,
    children: new Map(),
    buildings: [],
  }
}

function insertBuildingIntoFolderTree(
  roots: Map<string, LiveFolderNode>,
  boundary: DevqlCodeCityBoundary,
  building: CodeCityBuilding,
) {
  const segments = folderSegmentsForBuilding(boundary, building)
  let siblings = roots
  let current: LiveFolderNode | undefined
  let currentPath = ''

  for (const [depth, segment] of segments.entries()) {
    currentPath = childFolderPath(currentPath, segment)
    const existing = siblings.get(segment)
    const node = existing ?? createFolderNode(segment, currentPath, depth)
    siblings.set(segment, node)
    current = node
    siblings = node.children
  }

  current?.buildings.push(building)
}

function packLayoutItems<T>(items: PackedLayoutItem<T>[], gap: number) {
  if (items.length === 0) {
    return {
      width: 1,
      depth: 1,
      placements: [] as PackedLayoutPlacement<T>[],
    }
  }

  const totalArea = items.reduce(
    (total, item) => total + (item.width + gap) * (item.depth + gap),
    0,
  )
  const widest = Math.max(...items.map((item) => item.width))
  const targetWidth = Math.max(widest, Math.sqrt(totalArea) * 1.45)
  const placements: PackedLayoutPlacement<T>[] = []
  let cursorX = 0
  let cursorZ = 0
  let rowDepth = 0
  let maxX = 0

  for (const item of items) {
    if (cursorX > 0 && cursorX + item.width > targetWidth) {
      cursorX = 0
      cursorZ += rowDepth + gap
      rowDepth = 0
    }

    placements.push({
      item: item.item,
      x: cursorX,
      z: cursorZ,
    })
    cursorX += item.width + gap
    rowDepth = Math.max(rowDepth, item.depth)
    maxX = Math.max(maxX, cursorX - gap)
  }

  return {
    width: Math.max(1, maxX),
    depth: Math.max(1, cursorZ + rowDepth),
    placements,
  }
}

function buildingRenderSlot(building: CodeCityBuilding) {
  const markerDiameter =
    Math.max(building.plot.width, building.plot.depth) *
    LIVE_BUILDING_RENDER_MARKER_SCALE
  const marginX = Math.max(
    LIVE_BUILDING_RENDER_MIN_MARGIN,
    (markerDiameter - building.plot.width) / 2,
  )
  const marginZ = Math.max(
    LIVE_BUILDING_RENDER_MIN_MARGIN,
    (markerDiameter - building.plot.depth) / 2,
  )

  return {
    marginX,
    marginZ,
    width: building.plot.width + marginX * 2,
    depth: building.plot.depth + marginZ * 2,
  }
}

function measureFolderNode(node: LiveFolderNode): MeasuredFolderLayout {
  const childLayouts = Array.from(node.children.values())
    .sort((left, right) => left.segment.localeCompare(right.segment))
    .map(measureFolderNode)
  const buildings = [...node.buildings].sort((left, right) =>
    left.filePath.localeCompare(right.filePath),
  )
  const items: Array<
    PackedLayoutItem<
      | {
          kind: 'district'
          layout: MeasuredFolderLayout
        }
      | {
          kind: 'building'
          building: CodeCityBuilding
          marginX: number
          marginZ: number
        }
    >
  > = [
    ...childLayouts.map((layout) => ({
      item: {
        kind: 'district' as const,
        layout,
      },
      width: layout.width,
      depth: layout.depth,
    })),
    ...buildings.map((building) => {
      const slot = buildingRenderSlot(building)

      return {
        item: {
          kind: 'building' as const,
          building,
          marginX: slot.marginX,
          marginZ: slot.marginZ,
        },
        width: slot.width,
        depth: slot.depth,
      }
    }),
  ]
  const packed = packLayoutItems(items, LIVE_DISTRICT_ITEM_GAP)

  return {
    node,
    width: packed.width + LIVE_DISTRICT_CONTENT_INSET * 2,
    depth: packed.depth + LIVE_DISTRICT_CONTENT_INSET * 2,
    placements: packed.placements,
  }
}

function placeMeasuredFolderLayout(
  boundary: DevqlCodeCityBoundary,
  zoneName: string,
  layout: MeasuredFolderLayout,
  x: number,
  z: number,
): CodeCityDistrict {
  const children: CodeCityDistrict['children'] = []
  const contentX = x + LIVE_DISTRICT_CONTENT_INSET
  const contentZ = z + LIVE_DISTRICT_CONTENT_INSET
  const path =
    boundary.rootPath === '.'
      ? layout.node.path
      : `${boundary.rootPath}/${layout.node.path}`

  for (const placement of layout.placements) {
    const itemX = contentX + placement.x
    const itemZ = contentZ + placement.z

    if (placement.item.kind === 'district') {
      children.push(
        placeMeasuredFolderLayout(
          boundary,
          zoneName,
          placement.item.layout,
          itemX,
          itemZ,
        ),
      )
      continue
    }

    children.push({
      ...placement.item.building,
      plot: {
        ...placement.item.building.plot,
        x: itemX + placement.item.marginX,
        y: 0,
        z: itemZ + placement.item.marginZ,
      },
    })
  }

  return {
    nodeType: 'district',
    id: `${boundary.id}:district:${slugify(zoneName)}:${slugify(path)}`,
    path,
    label: layout.node.segment,
    plot: {
      x,
      y: 0,
      z,
      width: layout.width,
      depth: layout.depth,
      rotation: 0,
    },
    depth: layout.node.depth,
    children,
  }
}

function boundsForDistricts(districts: CodeCityDistrict[]) {
  return boundsForPlots(
    districts.map((district) => district.plot),
    {
      padding: LIVE_DISTRICT_PLOT_PADDING,
      minWidth: 1,
      minDepth: 1,
    },
  )
}

function districtsForZone(
  boundary: DevqlCodeCityBoundary,
  zoneName: string,
  buildings: CodeCityBuilding[],
  fallbackBounds: CodeCityRectBounds,
): {
  districts: CodeCityDistrict[]
  bounds: CodeCityRectBounds
} {
  if (buildings.length === 0) {
    const districts: CodeCityDistrict[] = [
      {
        nodeType: 'district',
        id: `${boundary.id}:district:${slugify(zoneName) || 'zone'}:empty`,
        path: boundary.rootPath,
        label: enumLabel(zoneName),
        plot: {
          x: fallbackBounds.x,
          y: 0,
          z: fallbackBounds.z,
          width: fallbackBounds.width,
          depth: fallbackBounds.depth,
          rotation: 0,
        },
        depth: 0,
        children: [],
      },
    ]
    return {
      districts,
      bounds: fallbackBounds,
    }
  }

  const roots = new Map<string, LiveFolderNode>()
  buildings.forEach((building) => {
    insertBuildingIntoFolderTree(roots, boundary, building)
  })

  const rootLayouts = Array.from(roots.values())
    .sort((left, right) => left.segment.localeCompare(right.segment))
    .map(measureFolderNode)
  const packedRoots = packLayoutItems(
    rootLayouts.map((layout) => ({
      item: layout,
      width: layout.width,
      depth: layout.depth,
    })),
    LIVE_ROOT_DISTRICT_GAP,
  )
  const originX =
    fallbackBounds.x +
    Math.max(0, (fallbackBounds.width - packedRoots.width) / 2)
  const originZ =
    fallbackBounds.z +
    Math.max(0, (fallbackBounds.depth - packedRoots.depth) / 2)
  const districts = packedRoots.placements.map((placement) =>
    placeMeasuredFolderLayout(
      boundary,
      zoneName,
      placement.item,
      originX + placement.x,
      originZ + placement.z,
    ),
  )

  return {
    districts,
    bounds: boundsForDistricts(districts),
  }
}

function sharedLibraryConfig(
  boundary: DevqlCodeCityBoundary,
  macroTopology: DevqlCodeCityTopology | undefined,
): CodeCitySharedLibrary {
  return {
    isSharedLibrary: boundary.sharedLibrary,
    renderMode: boundary.sharedLibrary ? 'plaza' : 'district',
    serves:
      boundary.sharedLibrary && macroTopology === 'STAR'
        ? ['star topology']
        : [],
  }
}

function mapBoundary(
  boundary: DevqlCodeCityBoundary,
  layout: DevqlCodeCityBoundaryLayout | undefined,
  buildings: CodeCityBuilding[],
  sourceBuildingsByPath: Map<string, DevqlCodeCityBuilding>,
  macroTopology: DevqlCodeCityTopology | undefined,
  hierarchy: BoundaryHierarchy,
): CodeCityBoundary {
  const boundaryRole = boundaryRoleFor(boundary, hierarchy)
  const hierarchyDepth = hierarchy.depthByBoundary.get(boundary.id) ?? 0
  const plots = buildings.map((building) => building.plot)
  const fallbackBounds = boundsForPlots(plots)
  const sourceBoundaryBounds =
    layout == null
      ? fallbackBounds
      : {
          x: layout.x,
          z: layout.z,
          width: safePositive(layout.width, fallbackBounds.width),
          depth: safePositive(layout.depth, fallbackBounds.depth),
        }
  const zonesByName = new Map<string, CodeCityBuilding[]>()

  if (boundaryRole === 'group') {
    const centre = centreForBounds(sourceBoundaryBounds)
    const depthLift = Math.max(0, 2 - hierarchyDepth) * 0.22

    return {
      id: boundary.id,
      name: boundary.name || boundary.rootPath,
      parentBoundaryId: boundary.parentBoundaryId ?? null,
      boundaryRole,
      hierarchyDepth,
      kind: toBoundaryKind(boundary, boundaryRole),
      architecture: toBoundaryArchitecture(
        boundary.architecture?.primaryPattern,
        boundary.sharedLibrary,
      ),
      topologyRole: 'peer',
      labelAnchor: {
        x: centre.x,
        y: 2.25 + depthLift,
        z: sourceBoundaryBounds.z - 2.2,
      },
      ground: {
        kind: 'roundedRect',
        centre,
        width: sourceBoundaryBounds.width,
        depth: sourceBoundaryBounds.depth,
        height: 0.12,
        waterInset: 1.6,
        tint: '#1D4E68',
      },
      zones: [],
      sharedLibrary: {
        isSharedLibrary: false,
        renderMode: 'district',
        serves: [],
      },
    }
  }

  for (const building of buildings) {
    const sourceBuilding = sourceBuildingsByPath.get(building.filePath)
    const zoneName = sourceBuilding?.zone ?? 'module'
    const key = String(zoneName)
    zonesByName.set(key, [...(zonesByName.get(key) ?? []), building])
  }

  if (zonesByName.size === 0) {
    zonesByName.set('module', [])
  }

  const zoneLayouts = Array.from(zonesByName.entries()).map(
    ([zoneName, zoneBuildings], index) => {
      const sourceZoneBounds = boundsForPlots(
        zoneBuildings.length > 0
          ? zoneBuildings.map((building) => building.plot)
          : [
              {
                x: sourceBoundaryBounds.x,
                y: 0,
                z: sourceBoundaryBounds.z,
                width: sourceBoundaryBounds.width,
                depth: sourceBoundaryBounds.depth,
                rotation: 0,
              },
            ],
      )
      const localZoneBounds = {
        x: 0,
        z: 0,
        width: sourceZoneBounds.width,
        depth: sourceZoneBounds.depth,
      }
      const districtLayout = districtsForZone(
        boundary,
        zoneName,
        zoneBuildings,
        localZoneBounds,
      )

      return {
        index,
        zoneName,
        districtLayout,
        bounds: districtLayout.bounds,
      }
    },
  )
  const packedZones = packLayoutItems(
    zoneLayouts.map((zoneLayout) => ({
      item: zoneLayout,
      width: zoneLayout.bounds.width,
      depth: zoneLayout.bounds.depth,
    })),
    LIVE_ZONE_GAP,
  )
  const zoneOriginX =
    sourceBoundaryBounds.x +
    Math.max(0, (sourceBoundaryBounds.width - packedZones.width) / 2)
  const zoneOriginZ =
    sourceBoundaryBounds.z +
    Math.max(0, (sourceBoundaryBounds.depth - packedZones.depth) / 2)
  const zones: CodeCityZone[] = packedZones.placements.map((placement) => {
    const zoneBounds = {
      x: zoneOriginX + placement.x,
      z: zoneOriginZ + placement.z,
      width: placement.item.bounds.width,
      depth: placement.item.bounds.depth,
    }
    const deltaX = zoneBounds.x - placement.item.bounds.x
    const deltaZ = zoneBounds.z - placement.item.bounds.z
    const zoneCentre = centreForBounds(zoneBounds)

    return {
      id: `${boundary.id}:zone:${
        slugify(placement.item.zoneName) || placement.item.index
      }`,
      name: enumLabel(placement.item.zoneName),
      zoneType: toZoneType(placement.item.zoneName),
      layoutKind: 'strip',
      elevation: 0.34 + placement.item.index * 0.03,
      shape: {
        kind: 'strip',
        centre: zoneCentre,
        width: zoneBounds.width,
        depth: zoneBounds.depth,
        rotation: 0,
      },
      districts: placement.item.districtLayout.districts.map((district) =>
        translateDistrict(district, deltaX, deltaZ),
      ),
    }
  })
  const bounds = boundsForPlots(
    zones.map((zone) => {
      const width = safePositive(zone.shape.width ?? 0, 1)
      const depth = safePositive(zone.shape.depth ?? 0, 1)

      return plotForBounds({
        x: zone.shape.centre.x - width / 2,
        z: zone.shape.centre.z - depth / 2,
        width,
        depth,
      })
    }),
    {
      minWidth: sourceBoundaryBounds.width,
      minDepth: sourceBoundaryBounds.depth,
    },
  )
  const centre = centreForBounds(bounds)

  return {
    id: boundary.id,
    name: boundary.name || boundary.rootPath,
    parentBoundaryId: boundary.parentBoundaryId ?? null,
    boundaryRole,
    hierarchyDepth,
    kind: toBoundaryKind(boundary, boundaryRole),
    architecture: toBoundaryArchitecture(
      boundary.architecture?.primaryPattern,
      boundary.sharedLibrary,
    ),
    topologyRole: toTopologyRole(boundary, macroTopology),
    labelAnchor: {
      x: centre.x,
      y: 4.6,
      z: bounds.z - 3.2,
    },
    ground: {
      kind: 'roundedRect',
      centre,
      width: bounds.width,
      depth: bounds.depth,
      height: 0.42,
      waterInset: 2.2,
      tint: boundary.sharedLibrary ? '#332B57' : '#103451',
    },
    zones,
    sharedLibrary: sharedLibraryConfig(boundary, macroTopology),
  }
}

function mapRenderArc(
  arc: DevqlCodeCityRenderArc,
  buildingIdsByPath: Map<string, string>,
  maxWeight: number,
): CodeCityArc | null {
  if (arc.fromPath == null || arc.toPath == null) {
    return null
  }

  const fromId = buildingIdsByPath.get(arc.fromPath)
  const toId = buildingIdsByPath.get(arc.toPath)
  if (fromId == null || toId == null) {
    return null
  }

  const visibility = toArcVisibility(arc.visibility)

  return {
    id: arc.id,
    fromId,
    toId,
    arcType: toArcType(arc.kind),
    visibility,
    strength: normaliseArcStrength(arc.weight, maxWeight),
    severity: toSeverity(arc.severity),
    fromPath: arc.fromPath,
    toPath: arc.toPath,
    label: arc.label ?? undefined,
    tooltip: arc.tooltip ?? undefined,
    visibleAtZoom: visibleAtZoom(visibility),
  }
}

function mapDependencyArc(
  arc: DevqlCodeCityDependencyArc,
  buildingIdsByPath: Map<string, string>,
  maxWeight: number,
): CodeCityArc | null {
  const fromId = buildingIdsByPath.get(arc.fromPath)
  const toId = buildingIdsByPath.get(arc.toPath)
  if (fromId == null || toId == null) {
    return null
  }

  return {
    id: `dependency:${slugify(arc.fromPath)}:${slugify(arc.toPath)}`,
    fromId,
    toId,
    arcType: arc.arcKind === 'cross-boundary' ? 'cross-boundary' : 'dependency',
    visibility:
      arc.arcKind === 'cross-boundary'
        ? 'visible-at-world-zoom'
        : 'visible-on-selection',
    strength: normaliseArcStrength(arc.edgeCount, maxWeight),
    severity: toSeverity(arc.severity),
    fromPath: arc.fromPath,
    toPath: arc.toPath,
    visibleAtZoom:
      arc.arcKind === 'cross-boundary'
        ? { min: 110, max: 340 }
        : { min: 0, max: 180 },
  }
}

function attachArcIndexes(
  buildings: CodeCityBuilding[],
  arcs: CodeCityArc[],
): CodeCityBuilding[] {
  const byId = new Map(buildings.map((building) => [building.id, building]))
  for (const arc of arcs) {
    byId.get(arc.fromId)?.outgoingArcIds.push(arc.id)
    byId.get(arc.toId)?.incomingArcIds.push(arc.id)
  }
  return buildings
}

function collectBoundaryBuildings(boundaries: CodeCityBoundary[]) {
  const buildings: CodeCityBuilding[] = []
  const visitDistrict = (district: CodeCityDistrict) => {
    for (const child of district.children) {
      if (child.nodeType === 'building') {
        buildings.push(child)
        continue
      }

      visitDistrict(child)
    }
  }

  for (const boundary of boundaries) {
    for (const zone of boundary.zones) {
      for (const district of zone.districts) {
        visitDistrict(district)
      }
    }
  }

  return buildings
}

function defaultLegend(): CodeCityLegend {
  return {
    healthStops: [
      { label: 'Healthy', value: 0, colour: HEALTHY },
      { label: 'Moderate', value: 0.5, colour: MODERATE },
      { label: 'High risk', value: 1, colour: HIGH_RISK },
    ],
    mappings: [
      {
        dimension: 'Footprint',
        metric: 'Importance',
        description: 'Larger plots represent greater dependency influence.',
      },
      {
        dimension: 'Height',
        metric: 'Size and artefacts',
        description: 'Taller buildings contain more code and artefact floors.',
      },
      {
        dimension: 'Arc colour',
        metric: 'Dependency evidence',
        description:
          'Cyan arcs are dependencies; orange and red arcs indicate boundary and rule pressure.',
      },
    ],
    arcColours: {
      dependency: DEPENDENCY,
      violation: VIOLATION,
      crossBoundary: CROSS_BOUNDARY,
    },
  }
}

function createCameraPresets(
  sceneTitle: string,
  buildings: CodeCityBuilding[],
): CodeCityCameraPreset[] {
  const bounds = boundsForPlots(buildings.map((building) => building.plot))
  const centre = centreForBounds(bounds)
  const longestSide = Math.max(bounds.width, bounds.depth, 24)
  const tallest = Math.max(6, ...buildings.map((building) => building.height))
  const highRisk = [...buildings].sort(
    (left, right) => right.healthRisk - left.healthRisk,
  )[0]
  const highRiskCentre =
    highRisk != null
      ? {
          x: highRisk.plot.x + highRisk.plot.width / 2,
          y: highRisk.height / 2,
          z: highRisk.plot.z + highRisk.plot.depth / 2,
        }
      : centre

  return [
    {
      id: 'world-view',
      label: 'World view',
      description: `Overview of ${sceneTitle}.`,
      position: {
        x: centre.x + longestSide * 0.75,
        y: Math.max(80, tallest * 4.2, longestSide * 0.72),
        z: centre.z + longestSide * 0.95,
      },
      target: {
        x: centre.x,
        y: tallest * 0.25,
        z: centre.z,
      },
    },
    {
      id: 'dependency-view',
      label: 'Dependency view',
      description: 'Trace selected dependencies across the city.',
      position: {
        x: centre.x + longestSide * 0.35,
        y: Math.max(45, tallest * 3.2),
        z: centre.z - longestSide * 0.85,
      },
      target: {
        x: centre.x,
        y: tallest * 0.3,
        z: centre.z,
      },
    },
    {
      id: 'risk-view',
      label: 'Risk view',
      description: 'Focus the highest-risk building in the current graph.',
      position: {
        x: highRiskCentre.x + 18,
        y: Math.max(18, tallest * 1.8),
        z: highRiskCentre.z + 22,
      },
      target: highRiskCentre,
    },
  ]
}

function defaultConfig(
  world: DevqlCodeCityWorld,
): CodeCitySceneModel['config'] {
  return {
    analysisWindowMonths: world.health.analysisWindowMonths,
    buildingPadding: Math.max(0.25, world.layout.gap / 2),
    availableToggles: [
      'labels',
      'tests',
      'base',
      'zones',
      'folders',
      'buildings',
      'floors',
      'props',
      'overlays',
    ],
    labelDistances: {
      boundary: 225,
      zone: 160,
      district: 118,
      building: 76,
      detail: 42,
    },
    colours: {
      healthy: HEALTHY,
      moderate: MODERATE,
      highRisk: HIGH_RISK,
      noData: NO_DATA,
      violationArc: VIOLATION,
      crossBoundaryArcLow: '#6F8798',
      crossBoundaryArcHigh: CROSS_BOUNDARY,
    },
  }
}

function resolveRepository(
  repositories: DashboardRepositoryRecord[],
  repoId: string | null | undefined,
) {
  if (repoId != null) {
    return (
      repositories.find((repository) => repository.repoId === repoId) ?? null
    )
  }

  return repositories[0] ?? null
}

export function mapDevqlCodeCityWorldToScene(
  world: DevqlCodeCityWorld,
  options: MapDevqlCodeCityWorldOptions,
): CodeCitySceneModel {
  const maxSourceHeight = Math.max(
    world.summary.maxHeight,
    ...world.buildings.map((building) =>
      Math.max(building.size.totalHeight, building.geometry.height),
    ),
    1,
  )
  const baseBuildings = world.buildings.map((building) =>
    mapBuilding(building, maxSourceHeight),
  )
  const architecture = addInferredWorkspaceComponents(
    mapDevqlArchitectureGraphToSceneArchitecture({
      systems: options.architecture?.systems ?? [],
      containers: options.architecture?.containers ?? [],
      flows: options.architecture?.flows ?? [],
      repositoryId: options.repository.repoId,
    }),
    baseBuildings,
  )
  const buildings = enrichBuildingsWithArchitecture(
    baseBuildings,
    architecture,
    options.architecture?.graphNodes ?? [],
  )
  const buildingIdsByPath = new Map(
    buildings.map((building) => [building.filePath, building.id]),
  )
  const maxArcWeight = Math.max(
    ...world.arcs.map((arc) => arc.weight),
    ...world.dependencyArcs.map((arc) => arc.edgeCount),
    1,
  )
  const renderArcs = world.arcs
    .map((arc) => mapRenderArc(arc, buildingIdsByPath, maxArcWeight))
    .filter((arc): arc is CodeCityArc => arc != null)
  const fallbackArcs =
    renderArcs.length > 0
      ? []
      : world.dependencyArcs
          .map((arc) => mapDependencyArc(arc, buildingIdsByPath, maxArcWeight))
          .filter((arc): arc is CodeCityArc => arc != null)
  const architectureArcs = createArchitectureFlowArcs(architecture, buildings)
  const arcs = [...renderArcs, ...fallbackArcs, ...architectureArcs]
  const indexedBuildings = attachArcIndexes(buildings, arcs)
  const buildingsByBoundary = new Map<string, CodeCityBuilding[]>()
  const sourceBuildingsByPath = new Map(
    world.buildings.map((building) => [building.path, building]),
  )
  const layoutsByBoundary = new Map(
    world.boundaryLayouts.map((layout) => [layout.boundaryId, layout]),
  )
  const macroTopology = world.macroGraph?.topology
  const boundaryHierarchy = buildBoundaryHierarchy(world.boundaries)

  for (const building of indexedBuildings) {
    const source = world.buildings.find(
      (candidate) => candidate.path === building.filePath,
    )
    if (source == null) {
      continue
    }
    buildingsByBoundary.set(source.boundaryId, [
      ...(buildingsByBoundary.get(source.boundaryId) ?? []),
      building,
    ])
  }

  const boundaries = world.boundaries.map((boundary) =>
    mapBoundary(
      boundary,
      layoutsByBoundary.get(boundary.id),
      buildingsByBoundary.get(boundary.id) ?? [],
      sourceBuildingsByPath,
      macroTopology,
      boundaryHierarchy,
    ),
  )
  const positionedBuildings = collectBoundaryBuildings(boundaries)
  const sceneTitle =
    options.projectPath != null && options.projectPath !== DEFAULT_PROJECT_PATH
      ? `${options.repository.identity} / ${options.projectPath}`
      : options.repository.identity

  return codeCitySceneModelSchema.parse({
    id: `${CODE_CITY_LIVE_DATASET_ID}:${options.repository.repoId}:${world.configFingerprint}`,
    title: `Code Atlas: ${sceneTitle}`,
    mode: 'live',
    worldLayout: toWorldLayout(macroTopology),
    source: {
      kind: 'live',
      datasetId: CODE_CITY_LIVE_DATASET_ID,
      description: `Live DevQL CodeCity snapshot from ${options.repository.identity}${
        world.commitSha != null ? ` at ${world.commitSha.slice(0, 12)}` : ''
      }.`,
      repo: options.repository.identity,
      analysisWindowMonths: world.health.analysisWindowMonths,
    },
    generatedAt:
      world.health.generatedAt ??
      options.generatedAt ??
      new Date().toISOString(),
    cameraPresets: createCameraPresets(sceneTitle, positionedBuildings),
    boundaries,
    arcs,
    crossBoundaryArcs: arcs.filter((arc) => arc.arcType === 'cross-boundary'),
    architecture,
    legend: defaultLegend(),
    config: defaultConfig(world),
  })
}

export async function fetchDevqlCodeCityScene({
  repoId,
  projectPath = DEFAULT_PROJECT_PATH,
  first = DEFAULT_BUILDING_LIMIT,
  signal,
}: LoadDevqlCodeCitySceneInput = {}): Promise<CodeCitySceneModel> {
  const repositories = await fetchDashboardRepositoriesCached()
  const repository = resolveRepository(repositories, repoId)

  if (repository == null) {
    throw new GraphQLRequestError(
      'No repository is available from the dashboard API.',
    )
  }

  const response = await requestGraphQL<
    DevqlCodeCityWorldQueryData,
    DevqlCodeCityWorldVariables
  >(
    CODE_CITY_WORLD_QUERY,
    {
      repo: repository.name,
      projectPath,
      first,
    },
    { signal },
  )

  if (response.errors?.length) {
    throw new GraphQLRequestError(response.errors[0]!.message, {
      graphQLErrors: response.errors,
    })
  }

  const world = response.data?.repo.project.codeCityWorld
  if (world == null) {
    throw new GraphQLRequestError('CodeCity world was not returned by DevQL.')
  }

  const project = response.data?.repo.project
  if (project == null) {
    throw new GraphQLRequestError('CodeCity project was not returned by DevQL.')
  }

  const architecture = await fetchAtlasArchitectureGraph({
    repo: repository.name,
    projectPath,
    first: Math.min(first, 100),
    signal,
  })
  return mapDevqlCodeCityWorldToScene(world, {
    repository,
    projectPath,
    architecture: {
      systems: architecture.systems,
      containers: architecture.containers,
      graphNodes: architecture.graphNodes,
      flows: architecture.flows,
    },
  })
}
