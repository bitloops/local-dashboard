import { requestGraphQL } from '@/api/graphql/client'
import type {
  CodeCityArc,
  CodeCityArchitectureFlow,
  CodeCityArchitectureNode,
  CodeCityArchitectureSystem,
  CodeCityArchitectureContainer,
  CodeCityBuilding,
  CodeCitySceneModel,
} from './schema'
import { codeCityBuildingIdForPath, slugifyCodeCityValue } from './ids'

export const ARCHITECTURE_GRAPH_NODE_FIELDS = `
  id
  kind
  label
  artefactId
  symbolId
  path
  entryKind
  sourceKind
  confidence
  computed
  asserted
  properties
`

export type DevqlArchitectureGraphNode = {
  id: string
  kind: string
  label: string
  artefactId: string | null
  symbolId: string | null
  path: string | null
  entryKind: string | null
  sourceKind: string
  confidence: number
  computed: boolean
  asserted: boolean
  properties: unknown
}

export type DevqlArchitectureGraphEdge = {
  id: string
  kind: string
  fromNodeId: string
  toNodeId: string
  sourceKind: string
  confidence: number
  computed: boolean
  asserted: boolean
  properties: unknown
}

export type DevqlArchitectureContainer = {
  id: string
  key: string | null
  kind: string | null
  label: string
  repository: {
    repoId: string
    name: string
    provider: string
    organization: string
  }
  node: DevqlArchitectureGraphNode
  components: DevqlArchitectureGraphNode[]
  deploymentUnits: DevqlArchitectureGraphNode[]
  entryPoints: DevqlArchitectureGraphNode[]
}

export type DevqlArchitectureSystem = {
  id: string
  key: string
  label: string
  repositories: Array<{
    repoId: string
    name: string
    provider: string
    organization: string
  }>
  containers: DevqlArchitectureContainer[]
  node: DevqlArchitectureGraphNode
}

export type DevqlArchitectureFlow = {
  entryPoint: DevqlArchitectureGraphNode
  flow: DevqlArchitectureGraphNode
  traversedNodes: DevqlArchitectureGraphNode[]
  steps?: DevqlArchitectureFlowStep[]
}

export type DevqlArchitectureFlowStep = {
  ordinal: number
  moduleKey: string
  depth: number
  nodes: DevqlArchitectureGraphNode[]
  predecessorModuleKeys: string[]
  edgeKinds: string[]
  cyclic: boolean
}

export type DevqlAtlasArchitectureData = {
  systems: DevqlArchitectureSystem[]
  containers: DevqlArchitectureContainer[]
  graphNodes: DevqlArchitectureGraphNode[]
  graphEdges: DevqlArchitectureGraphEdge[]
  flows: DevqlArchitectureFlow[]
  repositoryId: string
}

type DevqlAtlasArchitectureQueryData = {
  repo: {
    project: {
      path: string
      architectureContainers: DevqlArchitectureContainer[]
      architectureFlows: DevqlArchitectureFlow[]
    }
  }
}

type DevqlAtlasArchitectureFactsQueryData = {
  repo: {
    project: {
      path: string
      architectureGraph: {
        nodes: DevqlArchitectureGraphNode[]
        edges: DevqlArchitectureGraphEdge[]
      }
    }
  }
}

type DevqlAtlasArchitectureVariables = {
  repo: string
  projectPath: string
  first: number
}

export const EMPTY_ATLAS_ARCHITECTURE_DATA = {
  systems: [],
  containers: [],
  graphNodes: [],
  graphEdges: [],
  flows: [],
} satisfies Omit<DevqlAtlasArchitectureData, 'repositoryId'>

export const ATLAS_ARCHITECTURE_QUERY = `
  query AtlasArchitecture($repo: String!, $projectPath: String!, $first: Int!) {
    repo(name: $repo) {
      project(path: $projectPath) {
        path
        architectureContainers(first: $first) {
          id
          key
          kind
          label
          repository {
            repoId
            name
            provider
            organization
          }
          node {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
          entryPoints {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
          deploymentUnits {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
          components {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
        }
        architectureFlows(first: $first) {
          entryPoint {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
          flow {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
          traversedNodes {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
          steps {
            ordinal
            moduleKey
            depth
            predecessorModuleKeys
            edgeKinds
            cyclic
            nodes {
              ${ARCHITECTURE_GRAPH_NODE_FIELDS}
            }
          }
        }
      }
    }
  }
`

export const ATLAS_ARCHITECTURE_FACTS_QUERY = `
  query AtlasArchitectureFacts($repo: String!, $projectPath: String!, $first: Int!) {
    repo(name: $repo) {
      project(path: $projectPath) {
        path
        architectureGraph(first: $first) {
          nodes {
            ${ARCHITECTURE_GRAPH_NODE_FIELDS}
          }
          edges {
            id
            kind
            fromNodeId
            toNodeId
            sourceKind
            confidence
            computed
            asserted
            properties
          }
        }
      }
    }
  }
`

function nodeRef(node: DevqlArchitectureGraphNode): CodeCityArchitectureNode {
  return {
    id: node.id,
    kind: node.kind,
    label: node.label,
    path: node.path,
    entryKind: node.entryKind,
    confidence: node.confidence,
    computed: node.computed,
    asserted: node.asserted,
    properties: node.properties,
  }
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

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items))
}

function nonEmptyString(value: string | null | undefined): value is string {
  return value != null && value.trim().length > 0
}

function stringProperty(value: unknown, key: string) {
  if (typeof value !== 'object' || value == null || !(key in value)) {
    return null
  }

  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' && field.trim().length > 0 ? field : null
}

function mapFlowStep(
  step: DevqlArchitectureFlowStep,
): CodeCityArchitectureFlow['steps'][number] {
  const nodePaths = step.nodes.map((node) => node.path).filter(nonEmptyString)

  return {
    ordinal: step.ordinal,
    moduleKey: step.moduleKey,
    depth: step.depth,
    nodeIds: step.nodes.map((node) => node.id),
    paths: unique([step.moduleKey, ...nodePaths].filter(nonEmptyString)),
    predecessorModuleKeys: step.predecessorModuleKeys,
    edgeKinds: step.edgeKinds,
    cyclic: step.cyclic,
  }
}

function orderedFlowPaths(
  flow: DevqlArchitectureFlow,
  steps: CodeCityArchitectureFlow['steps'],
) {
  const stepPaths = steps.flatMap((step) => step.paths)
  const traversedPaths = flow.traversedNodes
    .map((node) => node.path)
    .filter(nonEmptyString)
  const orderedPaths = stepPaths.length > 0 ? stepPaths : traversedPaths

  return unique([flow.entryPoint.path, ...orderedPaths].filter(nonEmptyString))
}

function inferWorkspacePackageComponent(path: string) {
  const segments = path.split('/').filter(Boolean)
  const [scope, name] = segments

  if (scope == null || name == null) {
    return null
  }

  if (scope === 'crates') {
    return {
      root: `${scope}/${name}`,
      label: name,
      kind: 'cargo_crate',
    }
  }

  if (
    scope === 'apps' ||
    scope === 'packages' ||
    scope === 'libs' ||
    scope === 'services'
  ) {
    return {
      root: `${scope}/${name}`,
      label: name,
      kind: `${scope.slice(0, -1)}_package`,
    }
  }

  return null
}

function containerOwnsWorkspaceComponent(
  container: CodeCityArchitectureContainer,
  componentRoot: string,
  containerCount: number,
) {
  if (pathInRoot(componentRoot, container.path)) {
    return true
  }

  if (
    container.path != null &&
    normalisePath(container.path) != null &&
    pathInRoot(container.path, componentRoot)
  ) {
    return true
  }

  return containerCount === 1
}

function isCoarseArchitectureComponent(component: CodeCityArchitectureNode) {
  const componentKind = stringProperty(component.properties, 'component_kind')
  const path = normalisePath(component.path) ?? ''

  return (
    component.asserted ||
    component.confidence >= 0.7 ||
    componentKind === 'workspace_package' ||
    /^crates\/[^/]+$/u.test(path) ||
    /^(apps|packages|libs|services)\/[^/]+$/u.test(path)
  )
}

export function addInferredWorkspaceComponents(
  architecture: CodeCitySceneModel['architecture'],
  buildings: CodeCityBuilding[],
): CodeCitySceneModel['architecture'] {
  if (architecture.containers.length === 0) {
    return architecture
  }

  const componentsByRoot = new Map<
    string,
    {
      root: string
      label: string
      kind: string
    }
  >()

  for (const building of buildings) {
    const component = inferWorkspacePackageComponent(building.filePath)
    if (component != null) {
      componentsByRoot.set(component.root, component)
    }
  }

  if (componentsByRoot.size === 0) {
    return architecture
  }

  return {
    ...architecture,
    containers: architecture.containers.map((container) => {
      const existingComponentRoots = new Set(
        container.components
          .map((component) => normalisePath(component.path))
          .filter((path): path is string => path != null),
      )
      const inferredComponents = Array.from(componentsByRoot.values())
        .filter(
          (component) =>
            !existingComponentRoots.has(component.root) &&
            containerOwnsWorkspaceComponent(
              container,
              component.root,
              architecture.containers.length,
            ),
        )
        .map(
          (component): CodeCityArchitectureNode => ({
            id: `atlas-inferred-component:${container.id}:${slugifyCodeCityValue(
              component.root,
            )}`,
            kind: 'COMPONENT',
            label: component.label,
            path: component.root,
            entryKind: null,
            confidence: 0.48,
            computed: true,
            asserted: false,
            properties: {
              component_key: component.root,
              component_kind: 'workspace_package',
              workspace_package_kind: component.kind,
              inferred_by: 'atlas_workspace_package_fallback',
            },
          }),
        )

      if (inferredComponents.length === 0) {
        return container
      }

      return {
        ...container,
        components: [
          ...container.components.filter(isCoarseArchitectureComponent),
          ...inferredComponents,
        ],
      }
    }),
  }
}

function mergeContainers(
  repositoryId: string,
  systems: DevqlArchitectureSystem[],
  projectContainers: DevqlArchitectureContainer[],
) {
  const containersById = new Map<string, DevqlArchitectureContainer>()
  const systemKeysByContainerId = new Map<string, Set<string>>()

  for (const container of projectContainers) {
    containersById.set(container.id, container)
    const systemKey = stringProperty(container.node.properties, 'system_key')
    if (systemKey != null) {
      const systemKeys = systemKeysByContainerId.get(container.id) ?? new Set()
      systemKeys.add(systemKey)
      systemKeysByContainerId.set(container.id, systemKeys)
    }
  }

  for (const system of systems) {
    for (const container of system.containers) {
      if (container.repository.repoId === repositoryId) {
        containersById.set(
          container.id,
          containersById.get(container.id) ?? container,
        )
      }

      const systemKeys = systemKeysByContainerId.get(container.id) ?? new Set()
      systemKeys.add(system.key)
      systemKeysByContainerId.set(container.id, systemKeys)
    }
  }

  return {
    containers: Array.from(containersById.values()),
    systemKeysByContainerId,
  }
}

export function mapDevqlArchitectureGraphToSceneArchitecture({
  systems,
  containers: projectContainers,
  flows,
  repositoryId,
}: Omit<
  DevqlAtlasArchitectureData,
  'graphNodes' | 'graphEdges'
>): CodeCitySceneModel['architecture'] {
  const { containers, systemKeysByContainerId } = mergeContainers(
    repositoryId,
    systems,
    projectContainers,
  )
  const localContainerIds = new Set(containers.map((container) => container.id))
  const explicitSystems = systems
    .filter(
      (system) =>
        system.repositories.some(
          (repository) => repository.repoId === repositoryId,
        ) ||
        system.containers.some((container) =>
          localContainerIds.has(container.id),
        ),
    )
    .map(
      (system): CodeCityArchitectureSystem => ({
        id: system.id,
        key: system.key,
        label: system.label,
        repositoryIds: system.repositories.map(
          (repository) => repository.repoId,
        ),
        containerIds: system.containers
          .filter((container) => container.repository.repoId === repositoryId)
          .map((container) => container.id),
      }),
    )
  const explicitSystemKeys = new Set(
    explicitSystems.map((system) => system.key),
  )
  const inferredSystemKeys = unique(
    Array.from(systemKeysByContainerId.values()).flatMap((keys) =>
      Array.from(keys),
    ),
  ).filter((key) => !explicitSystemKeys.has(key))

  return {
    systems: [
      ...explicitSystems,
      ...inferredSystemKeys.map(
        (key): CodeCityArchitectureSystem => ({
          id: `architecture-system:${key}`,
          key,
          label: key.startsWith('repo:') ? 'Repository system' : key,
          repositoryIds: [repositoryId],
          containerIds: containers
            .filter((container) =>
              systemKeysByContainerId.get(container.id)?.has(key),
            )
            .map((container) => container.id),
        }),
      ),
    ],
    containers: containers.map(
      (container): CodeCityArchitectureContainer => ({
        id: container.id,
        key: container.key,
        kind: container.kind,
        label: container.label,
        path: container.node.path,
        repositoryId: container.repository.repoId,
        systemKeys: Array.from(systemKeysByContainerId.get(container.id) ?? []),
        entryPoints: container.entryPoints.map(nodeRef),
        deploymentUnits: container.deploymentUnits.map(nodeRef),
        components: container.components.map(nodeRef),
      }),
    ),
    flows: flows.map((flow): CodeCityArchitectureFlow => {
      const steps = (flow.steps ?? []).map(mapFlowStep)

      return {
        id: flow.flow.id,
        label: flow.flow.label,
        entryPoint: nodeRef(flow.entryPoint),
        traversedNodeIds: flow.traversedNodes.map((node) => node.id),
        traversedPaths: orderedFlowPaths(flow, steps),
        steps,
      }
    }),
  }
}

export async function fetchAtlasArchitectureGraph({
  repo,
  projectPath,
  first,
  signal,
}: {
  repo: string
  projectPath: string
  first: number
  signal?: AbortSignal
}): Promise<Omit<DevqlAtlasArchitectureData, 'repositoryId'>> {
  try {
    const response = await requestGraphQL<
      DevqlAtlasArchitectureQueryData,
      DevqlAtlasArchitectureVariables
    >(
      ATLAS_ARCHITECTURE_QUERY,
      {
        repo,
        projectPath,
        first,
      },
      { signal },
    )

    if (response.errors?.length) {
      return EMPTY_ATLAS_ARCHITECTURE_DATA
    }

    const project = response.data?.repo.project
    if (project == null) {
      return EMPTY_ATLAS_ARCHITECTURE_DATA
    }

    return {
      systems: [],
      containers: project.architectureContainers ?? [],
      graphNodes: [],
      graphEdges: [],
      flows: project.architectureFlows ?? [],
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }

    return EMPTY_ATLAS_ARCHITECTURE_DATA
  }
}

export async function fetchAtlasArchitectureFacts({
  repo,
  projectPath,
  first,
  signal,
}: {
  repo: string
  projectPath: string
  first: number
  signal?: AbortSignal
}): Promise<Pick<DevqlAtlasArchitectureData, 'graphNodes' | 'graphEdges'>> {
  try {
    const response = await requestGraphQL<
      DevqlAtlasArchitectureFactsQueryData,
      DevqlAtlasArchitectureVariables
    >(
      ATLAS_ARCHITECTURE_FACTS_QUERY,
      {
        repo,
        projectPath,
        first,
      },
      { signal },
    )

    if (response.errors?.length) {
      return {
        graphNodes: [],
        graphEdges: [],
      }
    }

    const graph = response.data?.repo.project?.architectureGraph

    return {
      graphNodes: graph?.nodes ?? [],
      graphEdges: graph?.edges ?? [],
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }

    return {
      graphNodes: [],
      graphEdges: [],
    }
  }
}

export function enrichBuildingsWithArchitecture(
  buildings: CodeCityBuilding[],
  architecture: CodeCitySceneModel['architecture'],
  graphNodes: DevqlArchitectureGraphNode[],
): CodeCityBuilding[] {
  const codeNodesByPath = new Map<string, DevqlArchitectureGraphNode[]>()
  for (const node of graphNodes) {
    if (node.path == null || node.kind !== 'NODE') {
      continue
    }
    codeNodesByPath.set(node.path, [
      ...(codeNodesByPath.get(node.path) ?? []),
      node,
    ])
  }

  return buildings.map((building) => {
    const containers = architecture.containers.filter(
      (container) =>
        pathInRoot(building.filePath, container.path) ||
        container.components.some((component) =>
          pathInRoot(building.filePath, component.path),
        ),
    )
    const components = containers.flatMap((container) =>
      container.components.filter((component) =>
        pathInRoot(building.filePath, component.path),
      ),
    )
    const entryPoints = containers
      .flatMap((container) => container.entryPoints)
      .filter((entryPoint) => entryPoint.path === building.filePath)
    const traversedByFlowIds = architecture.flows
      .filter((flow) =>
        architectureFlowPathSequence(flow).includes(building.filePath),
      )
      .map((flow) => flow.id)

    return {
      ...building,
      architecture: {
        nodeIds: (codeNodesByPath.get(building.filePath) ?? []).map(
          (node) => node.id,
        ),
        containerIds: unique(containers.map((container) => container.id)),
        componentIds: unique(components.map((component) => component.id)),
        entryPoints,
        traversedByFlowIds: unique(traversedByFlowIds),
      },
    }
  })
}

function architectureFlowPathSequence(flow: CodeCityArchitectureFlow) {
  const stepPaths = (flow.steps ?? []).flatMap((step) => step.paths)
  const orderedPaths = stepPaths.length > 0 ? stepPaths : flow.traversedPaths

  return unique([flow.entryPoint.path, ...orderedPaths].filter(nonEmptyString))
}

export function createArchitectureFlowArcs(
  architecture: CodeCitySceneModel['architecture'],
  buildings: CodeCityBuilding[],
): CodeCityArc[] {
  const buildingIdsByPath = new Map(
    buildings.map((building) => [building.filePath, building.id]),
  )
  const arcs: CodeCityArc[] = []

  for (const flow of architecture.flows) {
    const sequence = architectureFlowPathSequence(flow)

    for (let index = 0; index < sequence.length - 1; index += 1) {
      const sourcePath = sequence[index]
      const targetPath = sequence[index + 1]
      if (sourcePath == null || targetPath == null) {
        continue
      }

      const sourceId = buildingIdsByPath.get(sourcePath)
      const targetId = buildingIdsByPath.get(targetPath)
      if (sourceId == null || targetId == null || targetId === sourceId) {
        continue
      }

      arcs.push({
        id: `architecture-flow:${flow.id}:${index}:${codeCityBuildingIdForPath(targetPath)}`,
        fromId: sourceId,
        toId: targetId,
        arcType: 'dependency',
        visibility: 'visible-at-medium-zoom',
        strength: 0.42,
        severity: 'low',
        fromPath: sourcePath,
        toPath: targetPath,
        label: flow.label,
        tooltip: `${flow.entryPoint.label} flow step ${index + 1}: ${sourcePath} -> ${targetPath}`,
        architecture: {
          kind: 'flow',
          flowId: flow.id,
          entryPointId: flow.entryPoint.id,
        },
        visibleAtZoom: {
          min: 45,
          max: 210,
        },
      })
    }
  }

  return arcs.slice(0, 120)
}
