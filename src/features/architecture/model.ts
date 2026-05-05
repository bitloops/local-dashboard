import type {
  CodeCityArc,
  CodeCityArchitectureContainer,
  CodeCityArchitectureFlow,
  CodeCityArchitectureNode,
  CodeCityBuilding,
  CodeCitySceneModel,
} from '@/features/code-city/schema'
import { getSceneBuildings } from '@/features/code-city/scene-utils'
import type {
  DevqlArchitectureGraphEdge,
  DevqlArchitectureGraphNode,
} from '@/features/code-city/architecture-graph'

export type ArchitectureVector3 = {
  x: number
  y: number
  z: number
}

export type ArchitectureSceneBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  centre: ArchitectureVector3
  width: number
  depth: number
}

export type ArchitectureComponentNode = {
  id: string
  label: string
  path: string | null
  kind: string | null
  containerId: string
  confidence: number
  asserted: boolean
  computed: boolean
  position: ArchitectureVector3
  width: number
  depth: number
  height: number
  colour: string
  buildingIds: string[]
  filePaths: string[]
  entryPointIds: string[]
  deploymentUnitIds: string[]
  contractInCount: number
  contractOutCount: number
  directInCount: number
  directOutCount: number
  readCount: number
  writeCount: number
}

export type ArchitectureComponentGroupNode = {
  id: string
  label: string | null
  path: string | null
  containerId: string
  hierarchyDepth: number
  position: ArchitectureVector3
  width: number
  depth: number
  componentIds: string[]
}

export type ArchitectureContainerNode = {
  id: string
  label: string
  key: string | null
  kind: string | null
  path: string | null
  position: ArchitectureVector3
  width: number
  depth: number
  componentIds: string[]
  entryPointIds: string[]
  deploymentUnitIds: string[]
}

export type ArchitectureEntryPointNode = {
  id: string
  label: string
  entryKind: string | null
  containerId: string
  componentId: string | null
  position: ArchitectureVector3
}

export type ArchitectureDeploymentUnitNode = {
  id: string
  label: string
  kind: string | null
  containerId: string
  componentId: string | null
  position: ArchitectureVector3
}

export type ArchitecturePersistenceNode = {
  id: string
  label: string
  path: string | null
  position: ArchitectureVector3
  readByComponentIds: string[]
  writtenByComponentIds: string[]
}

export type ArchitectureContractConnection = {
  id: string
  kind: 'contract'
  fromComponentId: string
  toComponentId: string
  label: string
  flowIds: string[]
  entryPointIds: string[]
  confidence: number
  strength: number
}

export type ArchitectureDirectConnection = {
  id: string
  kind: 'direct'
  fromComponentId: string
  toComponentId: string
  label: string
  dependencyCount: number
  sourcePaths: string[]
  targetPaths: string[]
  strength: number
  severity: CodeCityArc['severity']
}

export type ArchitectureDataConnection = {
  id: string
  kind: 'read' | 'write'
  componentId: string
  persistenceObjectId: string
  label: string
  confidence: number
}

export type ArchitectureNavigationContextStatus = 'fresh' | 'stale'

export type ArchitectureNavigationContextReviewState = 'accepted' | 'unreviewed'

export type ArchitectureNavigationContextAcceptance = {
  acceptanceId: string
  source: string
  reason: string | null
  acceptedAt: string
  materialisedRef: string | null
}

export type ArchitectureNavigationContextChange = {
  primitiveId: string
  primitiveKind: string
  label: string | null
  path: string | null
  sourceKind: string | null
  changeKind: 'added' | 'removed' | 'hash_changed' | 'changed'
  previousHash: string | null
  currentHash: string | null
  mappedComponentIds: string[]
}

export type ArchitectureNavigationContext = {
  viewId: string
  viewKind: string
  label: string
  status: ArchitectureNavigationContextStatus
  reviewState: ArchitectureNavigationContextReviewState
  acceptedSignature: string
  currentSignature: string
  materialisedRef: string | null
  updatedAt: string
  changeCount: number
  changedPrimitiveIds: string[]
  changedPrimitives: ArchitectureNavigationContextChange[]
  changedByPath: Record<string, string[]>
  changedByComponentId: Record<string, string[]>
  acceptanceHistory: ArchitectureNavigationContextAcceptance[]
}

export type ArchitectureSceneModel = {
  id: string
  title: string
  repositoryLabel: string
  containers: ArchitectureContainerNode[]
  componentGroups: ArchitectureComponentGroupNode[]
  components: ArchitectureComponentNode[]
  entryPoints: ArchitectureEntryPointNode[]
  deploymentUnits: ArchitectureDeploymentUnitNode[]
  persistenceObjects: ArchitecturePersistenceNode[]
  contractConnections: ArchitectureContractConnection[]
  directConnections: ArchitectureDirectConnection[]
  dataConnections: ArchitectureDataConnection[]
  navigationContext?: ArchitectureNavigationContext | null
  bounds: ArchitectureSceneBounds
  summary: {
    containerCount: number
    componentGroupCount: number
    componentCount: number
    contractConnectionCount: number
    directConnectionCount: number
    persistenceObjectCount: number
    readWriteConnectionCount: number
  }
}

export type BuildArchitectureSceneInput = {
  codeCityScene: CodeCitySceneModel
  repositoryLabel?: string
  graphNodes?: DevqlArchitectureGraphNode[]
  graphEdges?: DevqlArchitectureGraphEdge[]
  navigationContext?: ArchitectureNavigationContext | null
}

type ComponentSeed = {
  id: string
  label: string
  path: string | null
  kind: string | null
  containerId: string
  confidence: number
  asserted: boolean
  computed: boolean
}

type MutableComponent = ArchitectureComponentNode & {
  loc: number
  risk: number
}

type ComponentPlacement = {
  column: number
  row: number
}

const COMPONENT_COLOURS = [
  '#52F6FF',
  '#50FFC2',
  '#7AA2FF',
  '#F1D36B',
  '#D885FF',
  '#FF8A5B',
  '#8AF7FF',
  '#A6FF8A',
]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function slugify(value: string) {
  return value
    .trim()
    .replaceAll(/[^\w/.-]+/gu, '-')
    .replaceAll('/', '--')
    .replaceAll('.', '-')
    .replaceAll('_', '-')
    .replaceAll(/-+/gu, '-')
    .replaceAll(/^-|-$/gu, '')
    .toLowerCase()
}

function normalisePath(path: string | null | undefined) {
  const trimmed = path?.trim()

  if (trimmed == null || trimmed.length === 0 || trimmed === '.') {
    return null
  }

  return trimmed.replace(/\/+$/u, '')
}

function pathInRoot(path: string, root: string | null | undefined) {
  const normalisedRoot = normalisePath(root)
  if (normalisedRoot == null) {
    return true
  }

  return path === normalisedRoot || path.startsWith(`${normalisedRoot}/`)
}

function stringProperty(value: unknown, key: string) {
  if (typeof value !== 'object' || value == null || !(key in value)) {
    return null
  }

  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' && field.trim().length > 0 ? field : null
}

function titleFromPathRoot(root: string) {
  const segments = root.split('/').filter(Boolean)
  return segments.at(-1) ?? root
}

function pathSegments(path: string | null | undefined) {
  const normalised = normalisePath(path)
  if (normalised == null) {
    return []
  }

  return normalised.split('/').filter(Boolean)
}

function parentGroupPath(path: string | null | undefined) {
  const segments = pathSegments(path)
  if (segments.length < 2) {
    return null
  }

  return segments.slice(0, -1).join('/')
}

function componentGroupAncestors(path: string | null | undefined) {
  const segments = pathSegments(path)

  return segments.slice(0, -1).map((_, index) => ({
    key: segments.slice(0, index + 1).join('/'),
    label: null,
    path: segments.slice(0, index + 1).join('/'),
    hierarchyDepth: index,
  }))
}

function componentGroupSortKey(component: ComponentSeed) {
  const parentPath = parentGroupPath(component.path)

  return `${parentPath ?? 'zz'}:${normalisePath(component.path) ?? component.label}`
}

function flowPathSequence(flow: CodeCityArchitectureFlow) {
  const stepPaths = (flow.steps ?? []).flatMap((step) => step.paths)
  const orderedPaths = stepPaths.length > 0 ? stepPaths : flow.traversedPaths

  return unique(
    [flow.entryPoint.path, ...orderedPaths].filter(
      (path): path is string => path != null,
    ),
  )
}

function componentFlowSequenceIndex(
  component: ComponentSeed,
  flows: CodeCityArchitectureFlow[],
) {
  const componentPath = normalisePath(component.path)
  let best = Number.MAX_SAFE_INTEGER
  if (componentPath == null) {
    return best
  }

  flows.forEach((flow, flowIndex) => {
    flowPathSequence(flow).forEach((path, pathIndex) => {
      if (!pathInRoot(path, componentPath)) {
        return
      }

      best = Math.min(best, flowIndex * 10_000 + pathIndex)
    })
  })

  return best
}

function inferComponentRoot(path: string) {
  const segments = path.split('/').filter(Boolean)
  const [scope, name] = segments

  if (scope == null) {
    return 'application'
  }

  if (name == null) {
    return scope
  }

  if (
    scope === 'crates' ||
    scope === 'apps' ||
    scope === 'packages' ||
    scope === 'libs' ||
    scope === 'services'
  ) {
    return `${scope}/${name}`
  }

  if (scope === 'src') {
    return `${scope}/${name}`
  }

  return scope
}

function componentKind(node: CodeCityArchitectureNode) {
  return (
    stringProperty(node.properties, 'component_kind') ??
    stringProperty(node.properties, 'workspace_package_kind')
  )
}

function fallbackContainer(
  scene: CodeCitySceneModel,
): CodeCityArchitectureContainer {
  return {
    id: 'architecture-container:application',
    key: 'application',
    kind: 'application',
    label: 'Application',
    path: null,
    repositoryId: scene.source.repo,
    systemKeys: [],
    entryPoints: [],
    deploymentUnits: [],
    components: [],
  }
}

function belongsToContainer(
  building: CodeCityBuilding,
  container: CodeCityArchitectureContainer,
  containerCount: number,
) {
  return (
    building.architecture.containerIds.includes(container.id) ||
    pathInRoot(building.filePath, container.path) ||
    container.components.some((component) =>
      pathInRoot(building.filePath, component.path),
    ) ||
    containerCount === 1
  )
}

function componentSeedFromNode(
  container: CodeCityArchitectureContainer,
  component: CodeCityArchitectureNode,
): ComponentSeed {
  return {
    id: component.id,
    label: component.label,
    path: normalisePath(component.path),
    kind: componentKind(component),
    containerId: container.id,
    confidence: component.confidence,
    asserted: component.asserted,
    computed: component.computed,
  }
}

function createFallbackComponentSeeds(
  container: CodeCityArchitectureContainer,
  buildings: CodeCityBuilding[],
) {
  const roots = new Map<string, string>()

  for (const building of buildings) {
    const root = inferComponentRoot(building.filePath)
    roots.set(root, titleFromPathRoot(root))
  }

  if (roots.size === 0) {
    roots.set(container.path ?? 'application', container.label)
  }

  return Array.from(roots.entries()).map(
    ([root, label]): ComponentSeed => ({
      id: `architecture-component:${container.id}:${slugify(root)}`,
      label,
      path: root === 'application' ? null : root,
      kind: 'inferred_module',
      containerId: container.id,
      confidence: 0.36,
      asserted: false,
      computed: true,
    }),
  )
}

function sortComponentSeeds(
  componentSeeds: ComponentSeed[],
  flows: CodeCityArchitectureFlow[],
) {
  return [...componentSeeds].sort(
    (left, right) =>
      componentFlowSequenceIndex(left, flows) -
        componentFlowSequenceIndex(right, flows) ||
      componentGroupSortKey(left).localeCompare(componentGroupSortKey(right)),
  )
}

function seedComponents(
  containers: CodeCityArchitectureContainer[],
  buildings: CodeCityBuilding[],
  flows: CodeCityArchitectureFlow[],
) {
  const seeds: ComponentSeed[] = []

  for (const container of containers) {
    const declaredSeeds = container.components.map((component) =>
      componentSeedFromNode(container, component),
    )

    if (declaredSeeds.length > 0) {
      seeds.push(...sortComponentSeeds(declaredSeeds, flows))
      continue
    }

    const containerBuildings = buildings.filter((building) =>
      belongsToContainer(building, container, containers.length),
    )
    seeds.push(
      ...sortComponentSeeds(
        createFallbackComponentSeeds(container, containerBuildings),
        flows,
      ),
    )
  }

  return seeds
}

function componentOwnsBuilding(
  component: ComponentSeed,
  building: CodeCityBuilding,
) {
  return (
    building.architecture.componentIds.includes(component.id) ||
    pathInRoot(building.filePath, component.path)
  )
}

function chooseComponentForBuilding(
  building: CodeCityBuilding,
  components: ComponentSeed[],
) {
  const explicit = components.find((component) =>
    building.architecture.componentIds.includes(component.id),
  )

  if (explicit != null) {
    return explicit
  }

  const pathMatched = components
    .filter((component) => componentOwnsBuilding(component, building))
    .sort(
      (left, right) =>
        (normalisePath(right.path)?.length ?? 0) -
        (normalisePath(left.path)?.length ?? 0),
    )[0]

  return pathMatched ?? components[0] ?? null
}

function gridSize(count: number) {
  const columns = Math.max(1, Math.ceil(Math.sqrt(count)))
  const rows = Math.max(1, Math.ceil(count / columns))
  return { columns, rows }
}

function groupKeyForSeed(component: ComponentSeed) {
  return parentGroupPath(component.path) ?? `ungrouped:${component.id}`
}

function groupedSeedsForLayout(componentSeeds: ComponentSeed[]) {
  const groups: ComponentSeed[][] = []
  let currentKey: string | null = null

  for (const seed of componentSeeds) {
    const key = groupKeyForSeed(seed)
    const current = groups.at(-1)
    if (currentKey !== key || current == null) {
      groups.push([seed])
      currentKey = key
    } else {
      current.push(seed)
    }
  }

  return groups
}

function layoutComponentGrid(componentSeeds: ComponentSeed[]) {
  const groups = groupedSeedsForLayout(componentSeeds)
  const maxGroupSize = Math.max(1, ...groups.map((group) => group.length))
  const baseGrid = gridSize(componentSeeds.length)
  const columns = Math.max(baseGrid.columns, Math.min(maxGroupSize, 8))
  const placementsByComponentId = new Map<string, ComponentPlacement>()
  let column = 0
  let row = 0

  for (const group of groups) {
    if (
      group.length > 1 &&
      group.length <= columns &&
      column > 0 &&
      column + group.length > columns
    ) {
      row += 1
      column = 0
    }

    for (const seed of group) {
      if (column >= columns) {
        row += 1
        column = 0
      }

      placementsByComponentId.set(seed.id, { column, row })
      column += 1
    }
  }

  return {
    columns,
    rows: Math.max(1, row + 1),
    placementsByComponentId,
  }
}

function layoutContainers(
  containers: CodeCityArchitectureContainer[],
  componentSeeds: ComponentSeed[],
) {
  const containerLayouts = containers.map((container) => {
    const containerComponentSeeds = componentSeeds.filter(
      (component) => component.containerId === container.id,
    )
    const grid = layoutComponentGrid(containerComponentSeeds)

    return {
      container,
      componentColumns: grid.columns,
      componentRows: grid.rows,
      placementsByComponentId: grid.placementsByComponentId,
      width: Math.max(18, grid.columns * 9 + 7),
      depth: Math.max(16, grid.rows * 7 + 9),
    }
  })
  const { columns } = gridSize(containerLayouts.length)
  const maxWidth = Math.max(24, ...containerLayouts.map((item) => item.width))
  const maxDepth = Math.max(20, ...containerLayouts.map((item) => item.depth))

  return containerLayouts.map((layout, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    return {
      ...layout,
      position: {
        x: (column - (columns - 1) / 2) * (maxWidth + 18),
        y: 0,
        z:
          (row - Math.floor((containerLayouts.length - 1) / columns) / 2) *
          (maxDepth + 18),
      },
    }
  })
}

function componentHeight(buildings: CodeCityBuilding[]) {
  const loc = buildings.reduce(
    (total, building) => total + building.metricsSummary.loc,
    0,
  )
  return clamp(3.2 + Math.log10(Math.max(1, loc)) * 2.8, 3.2, 13)
}

function componentFootprint(buildings: CodeCityBuilding[]) {
  const fileCount = Math.max(1, buildings.length)
  const scale = clamp(1 + Math.sqrt(fileCount) * 0.22, 1, 2.2)
  return {
    width: 3.9 * scale,
    depth: 3.2 * scale,
  }
}

function createComponents(
  containers: CodeCityArchitectureContainer[],
  componentSeeds: ComponentSeed[],
  buildings: CodeCityBuilding[],
) {
  const layouts = layoutContainers(containers, componentSeeds)
  const layoutByContainerId = new Map(
    layouts.map((layout) => [layout.container.id, layout]),
  )
  const buildingsByComponentId = new Map<string, CodeCityBuilding[]>()

  for (const building of buildings) {
    const component = chooseComponentForBuilding(building, componentSeeds)
    if (component == null) {
      continue
    }

    buildingsByComponentId.set(component.id, [
      ...(buildingsByComponentId.get(component.id) ?? []),
      building,
    ])
  }

  const components = componentSeeds.map((seed, index): MutableComponent => {
    const layout = layoutByContainerId.get(seed.containerId)
    const placement = layout?.placementsByComponentId.get(seed.id)
    const column = placement?.column ?? 0
    const row = placement?.row ?? 0
    const componentBuildings = buildingsByComponentId.get(seed.id) ?? []
    const footprint = componentFootprint(componentBuildings)
    const filePaths = unique(
      componentBuildings.map((building) => building.filePath).sort(),
    )
    const loc = componentBuildings.reduce(
      (total, building) => total + building.metricsSummary.loc,
      0,
    )
    const risk =
      componentBuildings.length === 0
        ? 0
        : componentBuildings.reduce(
            (total, building) => total + building.healthRisk,
            0,
          ) / componentBuildings.length

    return {
      id: seed.id,
      label: seed.label,
      path: seed.path,
      kind: seed.kind,
      containerId: seed.containerId,
      confidence: seed.confidence,
      asserted: seed.asserted,
      computed: seed.computed,
      position: {
        x:
          (layout?.position.x ?? 0) -
          (layout?.width ?? 0) / 2 +
          5.5 +
          column * 9,
        y: 0,
        z: (layout?.position.z ?? 0) - (layout?.depth ?? 0) / 2 + 6 + row * 7,
      },
      width: footprint.width,
      depth: footprint.depth,
      height: componentHeight(componentBuildings),
      colour: COMPONENT_COLOURS[index % COMPONENT_COLOURS.length] ?? '#52F6FF',
      buildingIds: componentBuildings.map((building) => building.id),
      filePaths,
      entryPointIds: [],
      deploymentUnitIds: [],
      contractInCount: 0,
      contractOutCount: 0,
      directInCount: 0,
      directOutCount: 0,
      readCount: 0,
      writeCount: 0,
      loc,
      risk,
    }
  })

  return { components, layouts }
}

function closestComponentForPath(
  path: string | null | undefined,
  components: ArchitectureComponentNode[],
  containerId?: string,
) {
  if (path == null) {
    return null
  }

  return components
    .filter(
      (component) =>
        (containerId == null || component.containerId === containerId) &&
        pathInRoot(path, component.path),
    )
    .sort(
      (left, right) =>
        (normalisePath(right.path)?.length ?? 0) -
        (normalisePath(left.path)?.length ?? 0),
    )[0]
}

function createContainers(
  layouts: ReturnType<typeof layoutContainers>,
  components: MutableComponent[],
): ArchitectureContainerNode[] {
  return layouts.map(({ container, position, width, depth }) => {
    const componentIds = components
      .filter((component) => component.containerId === container.id)
      .map((component) => component.id)

    return {
      id: container.id,
      label: container.label,
      key: container.key ?? null,
      kind: container.kind ?? null,
      path: container.path ?? null,
      position,
      width,
      depth,
      componentIds,
      entryPointIds: container.entryPoints.map((entryPoint) => entryPoint.id),
      deploymentUnitIds: container.deploymentUnits.map(
        (deploymentUnit) => deploymentUnit.id,
      ),
    }
  })
}

function createComponentGroups(
  components: ArchitectureComponentNode[],
): ArchitectureComponentGroupNode[] {
  const groupsByKey = new Map<
    string,
    {
      key: string
      label: string | null
      path: string | null
      containerId: string
      hierarchyDepth: number
      components: ArchitectureComponentNode[]
    }
  >()

  for (const component of components) {
    const candidates = componentGroupAncestors(component.path)

    for (const candidate of candidates) {
      const key = `${component.containerId}:${candidate.key}`
      const existing = groupsByKey.get(key)
      if (existing == null) {
        groupsByKey.set(key, {
          key,
          label: candidate.label,
          path: candidate.path,
          containerId: component.containerId,
          hierarchyDepth: candidate.hierarchyDepth,
          components: [component],
        })
      } else {
        existing.components.push(component)
      }
    }
  }

  return Array.from(groupsByKey.values())
    .filter((group) => group.components.length > 1)
    .sort(
      (left, right) =>
        left.containerId.localeCompare(right.containerId) ||
        left.hierarchyDepth - right.hierarchyDepth ||
        (left.path ?? '').localeCompare(right.path ?? ''),
    )
    .map((group): ArchitectureComponentGroupNode => {
      const paddingX = 2.4
      const paddingZ = 2.1
      const minX =
        Math.min(
          ...group.components.map(
            (component) => component.position.x - component.width / 2,
          ),
        ) - paddingX
      const maxX =
        Math.max(
          ...group.components.map(
            (component) => component.position.x + component.width / 2,
          ),
        ) + paddingX
      const minZ =
        Math.min(
          ...group.components.map(
            (component) => component.position.z - component.depth / 2,
          ),
        ) - paddingZ
      const maxZ =
        Math.max(
          ...group.components.map(
            (component) => component.position.z + component.depth / 2,
          ),
        ) + paddingZ

      return {
        id: `architecture-component-group:${slugify(group.key)}`,
        label: group.label,
        path: group.path,
        containerId: group.containerId,
        hierarchyDepth: group.hierarchyDepth,
        position: {
          x: minX + (maxX - minX) / 2,
          y: 0,
          z: minZ + (maxZ - minZ) / 2,
        },
        width: Math.max(6, maxX - minX),
        depth: Math.max(5.4, maxZ - minZ),
        componentIds: group.components.map((component) => component.id),
      }
    })
}

function distributeAlongEdge(
  count: number,
  index: number,
  centre: ArchitectureVector3,
  width: number,
  z: number,
) {
  const step = width / Math.max(2, count + 1)
  return {
    x: centre.x - width / 2 + step * (index + 1),
    y: 0.4,
    z,
  }
}

function createEntryPointsAndDeployments(
  containers: CodeCityArchitectureContainer[],
  containerNodes: ArchitectureContainerNode[],
  components: MutableComponent[],
) {
  const containerNodeById = new Map(
    containerNodes.map((container) => [container.id, container]),
  )
  const entryPoints: ArchitectureEntryPointNode[] = []
  const deploymentUnits: ArchitectureDeploymentUnitNode[] = []

  for (const container of containers) {
    const containerNode = containerNodeById.get(container.id)
    if (containerNode == null) {
      continue
    }

    container.entryPoints.forEach((entryPoint, index) => {
      const component = closestComponentForPath(
        entryPoint.path,
        components,
        container.id,
      )
      if (component != null) {
        component.entryPointIds.push(entryPoint.id)
      }
      entryPoints.push({
        id: entryPoint.id,
        label: entryPoint.label,
        entryKind: entryPoint.entryKind ?? null,
        containerId: container.id,
        componentId: component?.id ?? null,
        position: distributeAlongEdge(
          container.entryPoints.length,
          index,
          containerNode.position,
          containerNode.width,
          containerNode.position.z - containerNode.depth / 2 - 3.2,
        ),
      })
    })

    container.deploymentUnits.forEach((deploymentUnit, index) => {
      const component = closestComponentForPath(
        deploymentUnit.path,
        components,
        container.id,
      )
      if (component != null) {
        component.deploymentUnitIds.push(deploymentUnit.id)
      }
      deploymentUnits.push({
        id: deploymentUnit.id,
        label: deploymentUnit.label,
        kind:
          deploymentUnit.entryKind ??
          stringProperty(deploymentUnit.properties, 'deployment_kind'),
        containerId: container.id,
        componentId: component?.id ?? null,
        position: distributeAlongEdge(
          container.deploymentUnits.length,
          index,
          containerNode.position,
          containerNode.width,
          containerNode.position.z + containerNode.depth / 2 + 3,
        ),
      })
    })
  }

  return { entryPoints, deploymentUnits }
}

function componentByPathResolver(components: ArchitectureComponentNode[]) {
  return (path: string | null | undefined) =>
    closestComponentForPath(path, components) ?? null
}

function createContractConnections(
  scene: CodeCitySceneModel,
  components: ArchitectureComponentNode[],
) {
  const componentForPath = componentByPathResolver(components)
  const connectionsByPair = new Map<string, ArchitectureContractConnection>()

  for (const flow of scene.architecture.flows) {
    const sequence = unique(
      flowPathSequence(flow)
        .map((path) => componentForPath(path)?.id)
        .filter((componentId): componentId is string => componentId != null),
    )

    for (let index = 0; index < sequence.length - 1; index += 1) {
      const fromComponentId = sequence[index]
      const toComponentId = sequence[index + 1]
      if (fromComponentId == null || toComponentId == null) {
        continue
      }
      if (fromComponentId === toComponentId) {
        continue
      }

      const key = `${fromComponentId}->${toComponentId}`
      const existing = connectionsByPair.get(key)
      if (existing == null) {
        connectionsByPair.set(key, {
          id: `architecture-contract:${slugify(key)}`,
          kind: 'contract',
          fromComponentId,
          toComponentId,
          label: flow.label,
          flowIds: [flow.id],
          entryPointIds: [flow.entryPoint.id],
          confidence: flow.entryPoint.confidence,
          strength: 0.44,
        })
      } else {
        existing.flowIds = unique([...existing.flowIds, flow.id])
        existing.entryPointIds = unique([
          ...existing.entryPointIds,
          flow.entryPoint.id,
        ])
        existing.confidence = Math.max(
          existing.confidence,
          flow.entryPoint.confidence,
        )
        existing.strength = clamp(existing.strength + 0.1, 0.35, 1)
      }
    }
  }

  return Array.from(connectionsByPair.values())
}

function highestSeverity(
  current: CodeCityArc['severity'],
  next: CodeCityArc['severity'],
) {
  const rank = {
    low: 0,
    medium: 1,
    high: 2,
  }
  return rank[next] > rank[current] ? next : current
}

function createDirectConnections(
  scene: CodeCitySceneModel,
  components: ArchitectureComponentNode[],
  contractConnections: ArchitectureContractConnection[],
) {
  const buildings = getSceneBuildings(scene)
  const buildingById = new Map(
    buildings.map((building) => [building.id, building]),
  )
  const componentForPath = componentByPathResolver(components)
  const contractedPairs = new Set(
    contractConnections.map(
      (connection) =>
        `${connection.fromComponentId}->${connection.toComponentId}`,
    ),
  )
  const directByPair = new Map<string, ArchitectureDirectConnection>()

  for (const arc of scene.arcs) {
    if (arc.architecture != null) {
      continue
    }

    const fromBuilding = buildingById.get(arc.fromId)
    const toBuilding = buildingById.get(arc.toId)
    if (fromBuilding == null || toBuilding == null) {
      continue
    }

    const fromComponent = componentForPath(fromBuilding.filePath)
    const toComponent = componentForPath(toBuilding.filePath)
    if (
      fromComponent == null ||
      toComponent == null ||
      fromComponent.id === toComponent.id
    ) {
      continue
    }

    const key = `${fromComponent.id}->${toComponent.id}`
    if (contractedPairs.has(key)) {
      continue
    }

    const existing = directByPair.get(key)
    if (existing == null) {
      directByPair.set(key, {
        id: `architecture-direct:${slugify(key)}`,
        kind: 'direct',
        fromComponentId: fromComponent.id,
        toComponentId: toComponent.id,
        label: 'Direct dependency',
        dependencyCount: 1,
        sourcePaths: arc.fromPath != null ? [arc.fromPath] : [],
        targetPaths: arc.toPath != null ? [arc.toPath] : [],
        strength: arc.strength,
        severity: arc.severity,
      })
    } else {
      existing.dependencyCount += 1
      existing.sourcePaths = unique([
        ...existing.sourcePaths,
        ...(arc.fromPath != null ? [arc.fromPath] : []),
      ])
      existing.targetPaths = unique([
        ...existing.targetPaths,
        ...(arc.toPath != null ? [arc.toPath] : []),
      ])
      existing.strength = Math.max(existing.strength, arc.strength)
      existing.severity = highestSeverity(existing.severity, arc.severity)
    }
  }

  return Array.from(directByPair.values())
}

function nodeKind(node: DevqlArchitectureGraphNode | undefined) {
  return node?.kind.toUpperCase()
}

function createPersistenceLayer(
  graphNodes: DevqlArchitectureGraphNode[],
  graphEdges: DevqlArchitectureGraphEdge[],
  components: MutableComponent[],
  boundsSeed: { maxX: number; centreZ: number },
) {
  const graphNodeById = new Map(graphNodes.map((node) => [node.id, node]))
  const componentForPath = componentByPathResolver(components)
  const persistenceNodes = graphNodes.filter(
    (node) => node.kind.toUpperCase() === 'PERSISTENCE_OBJECT',
  )
  const persistenceObjects: ArchitecturePersistenceNode[] =
    persistenceNodes.map((node, index) => ({
      id: node.id,
      label: node.label,
      path: node.path,
      position: {
        x: boundsSeed.maxX + 16,
        y: -5.4,
        z: boundsSeed.centreZ + (index - (persistenceNodes.length - 1) / 2) * 7,
      },
      readByComponentIds: [],
      writtenByComponentIds: [],
    }))
  const persistenceById = new Map(
    persistenceObjects.map((persistence) => [persistence.id, persistence]),
  )
  const dataConnections: ArchitectureDataConnection[] = []

  for (const edge of graphEdges) {
    const kind = edge.kind.toUpperCase()
    if (kind !== 'READS' && kind !== 'WRITES') {
      continue
    }

    const fromNode = graphNodeById.get(edge.fromNodeId)
    const toNode = graphNodeById.get(edge.toNodeId)
    const persistence =
      nodeKind(toNode) === 'PERSISTENCE_OBJECT'
        ? persistenceById.get(edge.toNodeId)
        : nodeKind(fromNode) === 'PERSISTENCE_OBJECT'
          ? persistenceById.get(edge.fromNodeId)
          : null
    const sourceNode =
      nodeKind(toNode) === 'PERSISTENCE_OBJECT' ? fromNode : toNode
    const component =
      sourceNode?.kind.toUpperCase() === 'COMPONENT'
        ? components.find((candidate) => candidate.id === sourceNode.id)
        : componentForPath(sourceNode?.path)

    if (persistence == null || component == null) {
      continue
    }

    if (kind === 'READS') {
      persistence.readByComponentIds = unique([
        ...persistence.readByComponentIds,
        component.id,
      ])
      component.readCount += 1
    } else {
      persistence.writtenByComponentIds = unique([
        ...persistence.writtenByComponentIds,
        component.id,
      ])
      component.writeCount += 1
    }

    dataConnections.push({
      id: `architecture-data:${edge.id}`,
      kind: kind === 'READS' ? 'read' : 'write',
      componentId: component.id,
      persistenceObjectId: persistence.id,
      label: kind === 'READS' ? 'reads' : 'writes',
      confidence: edge.confidence,
    })
  }

  return {
    persistenceObjects,
    dataConnections,
  }
}

function applyConnectionCounts(
  components: MutableComponent[],
  contractConnections: ArchitectureContractConnection[],
  directConnections: ArchitectureDirectConnection[],
) {
  const byId = new Map(components.map((component) => [component.id, component]))

  for (const connection of contractConnections) {
    const from = byId.get(connection.fromComponentId)
    const to = byId.get(connection.toComponentId)
    if (from != null) {
      from.contractOutCount += 1
    }
    if (to != null) {
      to.contractInCount += 1
    }
  }

  for (const connection of directConnections) {
    const from = byId.get(connection.fromComponentId)
    const to = byId.get(connection.toComponentId)
    if (from != null) {
      from.directOutCount += connection.dependencyCount
    }
    if (to != null) {
      to.directInCount += connection.dependencyCount
    }
  }
}

function sceneBounds(
  containers: ArchitectureContainerNode[],
  persistenceObjects: ArchitecturePersistenceNode[],
): ArchitectureSceneBounds {
  const points = [
    ...containers.flatMap((container) => [
      {
        x: container.position.x - container.width / 2,
        z: container.position.z - container.depth / 2,
      },
      {
        x: container.position.x + container.width / 2,
        z: container.position.z + container.depth / 2,
      },
    ]),
    ...persistenceObjects.map((persistence) => ({
      x: persistence.position.x,
      z: persistence.position.z,
    })),
  ]
  const minX = Math.min(...points.map((point) => point.x), -12)
  const maxX = Math.max(...points.map((point) => point.x), 12)
  const minZ = Math.min(...points.map((point) => point.z), -12)
  const maxZ = Math.max(...points.map((point) => point.z), 12)
  const width = maxX - minX
  const depth = maxZ - minZ

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    centre: {
      x: minX + width / 2,
      y: 0,
      z: minZ + depth / 2,
    },
  }
}

export function buildArchitectureScene({
  codeCityScene,
  repositoryLabel = codeCityScene.source.repo,
  graphNodes = [],
  graphEdges = [],
  navigationContext = null,
}: BuildArchitectureSceneInput): ArchitectureSceneModel {
  const buildings = getSceneBuildings(codeCityScene, { includeTests: false })
  const sourceContainers =
    codeCityScene.architecture.containers.length > 0
      ? codeCityScene.architecture.containers
      : [fallbackContainer(codeCityScene)]
  const componentSeeds = seedComponents(
    sourceContainers,
    buildings,
    codeCityScene.architecture.flows,
  )
  const { components, layouts } = createComponents(
    sourceContainers,
    componentSeeds,
    buildings,
  )
  const containers = createContainers(layouts, components)
  const componentGroups = createComponentGroups(components)
  const { entryPoints, deploymentUnits } = createEntryPointsAndDeployments(
    sourceContainers,
    containers,
    components,
  )
  const preliminaryBounds = sceneBounds(containers, [])
  const contractConnections = createContractConnections(
    codeCityScene,
    components,
  )
  const directConnections = createDirectConnections(
    codeCityScene,
    components,
    contractConnections,
  )
  const { persistenceObjects, dataConnections } = createPersistenceLayer(
    graphNodes,
    graphEdges,
    components,
    {
      maxX: preliminaryBounds.maxX,
      centreZ: preliminaryBounds.centre.z,
    },
  )
  applyConnectionCounts(components, contractConnections, directConnections)
  const finalBounds = sceneBounds(containers, persistenceObjects)

  return {
    id: `architecture:${codeCityScene.id}`,
    title: `Architecture - ${codeCityScene.source.repo}`,
    repositoryLabel,
    containers,
    componentGroups,
    components,
    entryPoints,
    deploymentUnits,
    persistenceObjects,
    contractConnections,
    directConnections,
    dataConnections,
    navigationContext,
    bounds: finalBounds,
    summary: {
      containerCount: containers.length,
      componentGroupCount: componentGroups.length,
      componentCount: components.length,
      contractConnectionCount: contractConnections.length,
      directConnectionCount: directConnections.length,
      persistenceObjectCount: persistenceObjects.length,
      readWriteConnectionCount: dataConnections.length,
    },
  }
}
