import { describe, expect, it } from 'vitest'
import {
  codeCityBuildingIdForPath,
  mapDevqlCodeCityWorldToScene,
} from './devql'
import { getSceneBuildings } from './scene-utils'

type DevqlWorldFixture = Parameters<typeof mapDevqlCodeCityWorldToScene>[0]
type ArchitectureFixture = NonNullable<
  Parameters<typeof mapDevqlCodeCityWorldToScene>[1]['architecture']
>

function architectureNode(
  overrides: Partial<ArchitectureFixture['graphNodes'][number]>,
): ArchitectureFixture['graphNodes'][number] {
  return {
    id: 'architecture-node',
    kind: 'NODE',
    label: 'Architecture node',
    artefactId: null,
    symbolId: null,
    path: null,
    entryKind: null,
    sourceKind: 'COMPUTED',
    confidence: 0.9,
    computed: true,
    asserted: false,
    properties: {},
    ...overrides,
  }
}

function building(
  path: string,
  zone: string,
  x: number,
): DevqlWorldFixture['buildings'][number] {
  return {
    path,
    language: 'typescript',
    boundaryId: 'boundary:root',
    zone,
    inferredZone: zone,
    conventionZone: zone,
    architectureRole: zone,
    importance: {
      score: path.includes('service') ? 0.82 : 0.46,
      blastRadius: 4,
      weightedFanIn: 0.64,
      articulationScore: 0.48,
      normalizedBlastRadius: 0.8,
      normalizedWeightedFanIn: 0.64,
      normalizedArticulationScore: 0.48,
    },
    size: {
      loc: 80,
      artefactCount: 1,
      totalHeight: 8,
    },
    geometry: {
      x,
      y: 0,
      z: 2,
      width: 4,
      depth: 3,
      sideLength: 4,
      footprintArea: 12,
      height: 8,
    },
    healthRisk: path.includes('service') ? 0.72 : 0.18,
    healthStatus: 'ok',
    healthConfidence: 0.9,
    colour: path.includes('service') ? '#E0444E' : '#22A66A',
    healthSummary: {
      floorCount: 1,
      highRiskFloorCount: path.includes('service') ? 1 : 0,
      insufficientDataFloorCount: 0,
      averageRisk: path.includes('service') ? 0.72 : 0.18,
      maxRisk: path.includes('service') ? 0.72 : 0.18,
      missingSignals: [],
    },
    diagnosticBadges: [],
    floors: [
      {
        artefactId: `artefact:${path}`,
        symbolId: `symbol:${path}`,
        name: path.includes('service') ? 'OrderService' : 'OrderAggregate',
        canonicalKind: 'class',
        languageKind: 'class_declaration',
        startLine: 1,
        endLine: 40,
        loc: 40,
        floorIndex: 0,
        floorHeight: 8,
        healthRisk: path.includes('service') ? 0.72 : 0.18,
        colour: path.includes('service') ? '#E0444E' : '#22A66A',
        healthStatus: 'ok',
        healthConfidence: 0.9,
        healthMetrics: {
          churn: 8,
          complexity: 5,
          bugCount: path.includes('service') ? 2 : 0,
          coverage: 0.74,
          authorConcentration: 0.42,
        },
        healthEvidence: {
          missingSignals: [],
        },
      },
    ],
  }
}

function world(overrides?: Partial<DevqlWorldFixture>): DevqlWorldFixture {
  return {
    capability: 'codecity',
    stage: 'codecity_world',
    status: 'ok',
    repoId: 'repo-1',
    commitSha: '1234567890abcdef',
    configFingerprint: 'fingerprint-1',
    summary: {
      fileCount: 2,
      artefactCount: 2,
      dependencyCount: 1,
      boundaryCount: 1,
      macroEdgeCount: 0,
      includedFileCount: 2,
      excludedFileCount: 0,
      unhealthyFloorCount: 1,
      insufficientHealthDataCount: 0,
      coverageAvailable: true,
      gitHistoryAvailable: true,
      violationCount: 1,
      highSeverityViolationCount: 1,
      visibleArcCount: 1,
      crossBoundaryArcCount: 0,
      maxImportance: 0.82,
      maxHeight: 8,
    },
    health: {
      status: 'ok',
      analysisWindowMonths: 6,
      generatedAt: '2026-04-29T12:00:00.000Z',
      confidence: 0.9,
      missingSignals: [],
      coverageAvailable: true,
      gitHistoryAvailable: true,
    },
    layout: {
      layoutKind: 'phase1_grid_treemap',
      width: 20,
      depth: 14,
      gap: 0.5,
    },
    boundaries: [
      {
        id: 'boundary:root',
        name: 'Bitloops',
        rootPath: '.',
        kind: 'ROOT_FALLBACK',
        fileCount: 2,
        sharedLibrary: false,
        atomic: true,
        architecture: {
          primaryPattern: 'LAYERED',
          primaryScore: 0.88,
          secondaryPattern: null,
          mudScore: 0.12,
          modularity: 0.5,
        },
        violationSummary: {
          total: 1,
          high: 1,
          medium: 0,
          low: 0,
          info: 0,
        },
        diagnostics: [],
      },
    ],
    boundaryLayouts: [
      {
        boundaryId: 'boundary:root',
        strategy: 'PHASE_1_GRID_TREEMAP',
        zoneCount: 2,
        width: 20,
        depth: 14,
        x: 0,
        z: 0,
      },
    ],
    macroGraph: {
      topology: 'SINGLE_BOUNDARY',
      boundaryCount: 1,
      edgeCount: 0,
    },
    buildings: [
      building('src/application/order-service.ts', 'application', 2),
      building('src/core/order-aggregate.ts', 'core', 9),
    ],
    arcs: [
      {
        id: 'render:violation:1',
        kind: 'VIOLATION',
        visibility: 'VISIBLE_ON_SELECTION',
        severity: 'HIGH',
        fromPath: 'src/application/order-service.ts',
        toPath: 'src/core/order-aggregate.ts',
        fromBoundaryId: 'boundary:root',
        toBoundaryId: 'boundary:root',
        weight: 12,
        label: 'Layered dependency',
        tooltip: 'Application imports core through the wrong path.',
      },
    ],
    dependencyArcs: [
      {
        fromPath: 'src/application/order-service.ts',
        toPath: 'src/core/order-aggregate.ts',
        edgeCount: 3,
        arcKind: 'dependency',
        severity: null,
      },
    ],
    diagnostics: [],
    ...overrides,
  }
}

function visibleBuildingBounds(
  building: ReturnType<typeof getSceneBuildings>[number],
) {
  const markerDiameter =
    Math.max(building.plot.width, building.plot.depth) * 1.34
  const centreX = building.plot.x + building.plot.width / 2
  const centreZ = building.plot.z + building.plot.depth / 2

  return {
    minX: centreX - markerDiameter / 2,
    maxX: centreX + markerDiameter / 2,
    minZ: centreZ - markerDiameter / 2,
    maxZ: centreZ + markerDiameter / 2,
  }
}

function maxVisibleGap(
  left: ReturnType<typeof getSceneBuildings>[number],
  right: ReturnType<typeof getSceneBuildings>[number],
) {
  const leftBounds = visibleBuildingBounds(left)
  const rightBounds = visibleBuildingBounds(right)
  const xGap =
    Math.max(leftBounds.minX, rightBounds.minX) -
    Math.min(leftBounds.maxX, rightBounds.maxX)
  const zGap =
    Math.max(leftBounds.minZ, rightBounds.minZ) -
    Math.min(leftBounds.maxZ, rightBounds.maxZ)

  return Math.max(xGap, zGap)
}

function architecture(): ArchitectureFixture {
  const containerNode = architectureNode({
    id: 'container:orders-api',
    kind: 'CONTAINER',
    label: 'Orders API',
    path: 'src',
    properties: {
      container_kind: 'api',
    },
  })
  const entryPoint = architectureNode({
    id: 'entry:orders-api',
    kind: 'ENTRY_POINT',
    label: 'orders-api',
    path: 'src/application/order-service.ts',
    entryKind: 'npm_bin',
    confidence: 0.86,
  })
  const component = architectureNode({
    id: 'component:application',
    kind: 'COMPONENT',
    label: 'Application',
    path: 'src/application',
    confidence: 0.55,
  })
  const deploymentUnit = architectureNode({
    id: 'deployment:orders-api',
    kind: 'DEPLOYMENT_UNIT',
    label: 'orders-api deployment',
    path: 'src/application/order-service.ts',
    entryKind: 'npm_bin',
  })
  const serviceNode = architectureNode({
    id: 'node:order-service',
    label: 'OrderService',
    path: 'src/application/order-service.ts',
  })
  const aggregateNode = architectureNode({
    id: 'node:order-aggregate',
    label: 'OrderAggregate',
    path: 'src/core/order-aggregate.ts',
  })
  const flowNode = architectureNode({
    id: 'flow:orders-api',
    kind: 'FLOW',
    label: 'orders-api flow',
  })

  return {
    systems: [
      {
        id: 'system:orders',
        key: 'repo:repo-1',
        label: 'Orders',
        repositories: [
          {
            repoId: 'repo-1',
            name: 'bitloops',
            provider: 'local',
            organization: 'bitloops',
          },
        ],
        containers: [
          {
            id: 'container:orders-api',
            key: 'orders-api',
            kind: 'api',
            label: 'Orders API',
            repository: {
              repoId: 'repo-1',
              name: 'bitloops',
              provider: 'local',
              organization: 'bitloops',
            },
            node: containerNode,
            entryPoints: [entryPoint],
            deploymentUnits: [deploymentUnit],
            components: [component],
          },
        ],
        node: architectureNode({
          id: 'system:orders',
          kind: 'SYSTEM',
          label: 'Orders',
        }),
      },
    ],
    containers: [
      {
        id: 'container:orders-api',
        key: 'orders-api',
        kind: 'api',
        label: 'Orders API',
        repository: {
          repoId: 'repo-1',
          name: 'bitloops',
          provider: 'local',
          organization: 'bitloops',
        },
        node: containerNode,
        entryPoints: [entryPoint],
        deploymentUnits: [deploymentUnit],
        components: [component],
      },
    ],
    graphNodes: [serviceNode, aggregateNode],
    flows: [
      {
        entryPoint,
        flow: flowNode,
        traversedNodes: [aggregateNode, serviceNode],
        steps: [
          {
            ordinal: 1,
            moduleKey: 'src/application/order-service.ts',
            depth: 0,
            nodes: [serviceNode],
            predecessorModuleKeys: [],
            edgeKinds: [],
            cyclic: false,
          },
          {
            ordinal: 2,
            moduleKey: 'src/core/order-aggregate.ts',
            depth: 1,
            nodes: [aggregateNode],
            predecessorModuleKeys: ['src/application/order-service.ts'],
            edgeKinds: ['DEPENDS_ON'],
            cyclic: false,
          },
        ],
      },
    ],
  }
}

describe('DevQL CodeCity mapper', () => {
  it('maps CodeCityWorldResult into the renderer scene model', () => {
    const scene = mapDevqlCodeCityWorldToScene(world(), {
      repository: {
        repoId: 'repo-1',
        identity: 'bitloops/bitloops',
        name: 'bitloops',
        organization: 'bitloops',
      },
      projectPath: '.',
    })

    expect(scene.mode).toBe('live')
    expect(scene.worldLayout).toBe('single-boundary')
    expect(scene.source.repo).toBe('bitloops/bitloops')
    expect(scene.boundaries).toHaveLength(1)
    expect(scene.boundaries[0]?.architecture).toBe('layered')
    expect(scene.boundaries[0]?.zones.map((zone) => zone.zoneType)).toEqual([
      'application',
      'core',
    ])

    const sourceId = codeCityBuildingIdForPath(
      'src/application/order-service.ts',
    )
    const targetId = codeCityBuildingIdForPath('src/core/order-aggregate.ts')
    const sourceBuilding = getSceneBuildings(scene).find(
      (building) => building.id === sourceId,
    )

    expect(sourceBuilding).toBeDefined()
    if (sourceBuilding != null) {
      expect(sourceBuilding.id).toBe(sourceId)
      expect(sourceBuilding.outgoingArcIds).toEqual(['render:violation:1'])
      expect(sourceBuilding.metricsSummary.coverage).toBe(0.74)
    }

    expect(scene.arcs).toEqual([
      expect.objectContaining({
        id: 'render:violation:1',
        fromId: sourceId,
        toId: targetId,
        arcType: 'violation',
        severity: 'high',
        visibility: 'visible-on-selection',
      }),
    ])
  })

  it('maps CodeCity parent boundaries as group frames', () => {
    const apiBuilding = {
      ...building('packages/api/src/main.ts', 'application', 2),
      boundaryId: 'boundary:packages/api',
    }
    const webBuilding = {
      ...building('packages/web/src/app.tsx', 'application', 13),
      boundaryId: 'boundary:packages/web',
    }
    const scene = mapDevqlCodeCityWorldToScene(
      world({
        summary: {
          ...world().summary,
          boundaryCount: 3,
          fileCount: 2,
          artefactCount: 2,
          includedFileCount: 2,
        },
        boundaries: [
          {
            id: 'boundary:packages',
            name: 'packages',
            rootPath: 'packages',
            kind: 'GROUP',
            parentBoundaryId: null,
            source: 'HIERARCHY',
            fileCount: 2,
            sharedLibrary: false,
            atomic: false,
            architecture: null,
            violationSummary: {
              total: 0,
              high: 0,
              medium: 0,
              low: 0,
              info: 0,
            },
            diagnostics: [],
          },
          {
            id: 'boundary:packages/api',
            name: 'api',
            rootPath: 'packages/api',
            kind: 'EXPLICIT',
            parentBoundaryId: 'boundary:packages',
            source: 'MANIFEST',
            fileCount: 1,
            sharedLibrary: false,
            atomic: true,
            architecture: null,
            violationSummary: {
              total: 0,
              high: 0,
              medium: 0,
              low: 0,
              info: 0,
            },
            diagnostics: [],
          },
          {
            id: 'boundary:packages/web',
            name: 'web',
            rootPath: 'packages/web',
            kind: 'EXPLICIT',
            parentBoundaryId: 'boundary:packages',
            source: 'MANIFEST',
            fileCount: 1,
            sharedLibrary: false,
            atomic: true,
            architecture: null,
            violationSummary: {
              total: 0,
              high: 0,
              medium: 0,
              low: 0,
              info: 0,
            },
            diagnostics: [],
          },
        ],
        boundaryLayouts: [
          {
            boundaryId: 'boundary:packages',
            strategy: 'GRID_TREEMAP',
            zoneCount: 2,
            width: 22,
            depth: 10,
            x: 0,
            z: 0,
          },
          {
            boundaryId: 'boundary:packages/api',
            strategy: 'PLAIN_TREEMAP',
            zoneCount: 1,
            width: 8,
            depth: 8,
            x: 1,
            z: 1,
          },
          {
            boundaryId: 'boundary:packages/web',
            strategy: 'PLAIN_TREEMAP',
            zoneCount: 1,
            width: 8,
            depth: 8,
            x: 13,
            z: 1,
          },
        ],
        macroGraph: {
          topology: 'FEDERATED',
          boundaryCount: 2,
          edgeCount: 0,
        },
        buildings: [apiBuilding, webBuilding],
        arcs: [],
        dependencyArcs: [],
      }),
      {
        repository: {
          repoId: 'repo-1',
          identity: 'bitloops/bitloops',
          name: 'bitloops',
          organization: 'bitloops',
        },
        projectPath: '.',
      },
    )

    const parent = scene.boundaries.find(
      (boundary) => boundary.id === 'boundary:packages',
    )
    const leaves = scene.boundaries.filter(
      (boundary) => boundary.parentBoundaryId === 'boundary:packages',
    )

    expect(parent).toEqual(
      expect.objectContaining({
        boundaryRole: 'group',
        kind: 'group',
        zones: [],
      }),
    )
    expect(parent?.ground.width).toBeGreaterThan(20)
    expect(leaves).toHaveLength(2)
    expect(leaves.every((boundary) => boundary.boundaryRole === 'leaf')).toBe(
      true,
    )
    expect(getSceneBuildings(scene)).toHaveLength(2)
  })

  it('falls back to dependency arcs when render arcs are absent', () => {
    const scene = mapDevqlCodeCityWorldToScene(world({ arcs: [] }), {
      repository: {
        repoId: 'repo-1',
        identity: 'bitloops/bitloops',
        name: 'bitloops',
        organization: 'bitloops',
      },
      projectPath: '.',
    })

    expect(scene.arcs).toEqual([
      expect.objectContaining({
        arcType: 'dependency',
        fromPath: 'src/application/order-service.ts',
        toPath: 'src/core/order-aggregate.ts',
      }),
    ])
  })

  it('builds nested folder districts from live file paths', () => {
    const scene = mapDevqlCodeCityWorldToScene(
      world({
        summary: {
          ...world().summary,
          fileCount: 5,
          artefactCount: 5,
          includedFileCount: 5,
        },
        buildings: [
          building('apps/api/src/routes/orders.ts', 'application', 2),
          building('apps/api/src/domain/order.ts', 'application', 8),
          building('apps/api/src/domain/customer.ts', 'application', 14),
          building('apps/web/src/pages/orders.tsx', 'application', 22),
          building('apps/web/src/components/order-card.tsx', 'application', 28),
        ],
      }),
      {
        repository: {
          repoId: 'repo-1',
          identity: 'bitloops/bitloops',
          name: 'bitloops',
          organization: 'bitloops',
        },
        projectPath: '.',
      },
    )

    const applicationZone = scene.boundaries[0]?.zones.find(
      (zone) => zone.zoneType === 'application',
    )
    const topLevelLabels = applicationZone?.districts.map(
      (district) => district.label,
    )
    const appsDistrict = applicationZone?.districts.find(
      (district) => district.label === 'apps',
    )
    const nestedLabels = appsDistrict?.children
      .filter((child) => child.nodeType === 'district')
      .map((district) => district.label)

    expect(topLevelLabels).toEqual(['apps'])
    expect(nestedLabels).toEqual(['api', 'web'])
    expect(appsDistrict?.children.length).toBeGreaterThan(1)
    expect(appsDistrict?.plot.width).toBeLessThan(20)

    const applicationBuildings = getSceneBuildings(scene).filter((candidate) =>
      candidate.filePath.startsWith('apps/'),
    )
    for (const candidate of applicationBuildings) {
      expect(candidate.plot.x).toBeGreaterThanOrEqual(appsDistrict!.plot.x)
      expect(candidate.plot.z).toBeGreaterThanOrEqual(appsDistrict!.plot.z)
      expect(candidate.plot.x + candidate.plot.width).toBeLessThanOrEqual(
        appsDistrict!.plot.x + appsDistrict!.plot.width,
      )
      expect(candidate.plot.z + candidate.plot.depth).toBeLessThanOrEqual(
        appsDistrict!.plot.z + appsDistrict!.plot.depth,
      )
    }
  })

  it('keeps neighbouring source files visibly separated in the live folder layout', () => {
    const configFixture = building('src/config.rs', 'core', 2)
    const largeConfig = {
      ...configFixture,
      geometry: {
        ...configFixture.geometry,
        width: 8,
        depth: 6,
        footprintArea: 48,
      },
    }
    const scene = mapDevqlCodeCityWorldToScene(
      world({
        summary: {
          ...world().summary,
          fileCount: 4,
          artefactCount: 4,
          includedFileCount: 4,
        },
        buildings: [
          largeConfig,
          building('src/main.rs', 'unclassified', 8),
          building('src/protocol_loop.rs', 'unclassified', 11),
          building('src/lib.rs', 'application', 14),
        ],
      }),
      {
        repository: {
          repoId: 'repo-1',
          identity: 'bitloops/bitloops',
          name: 'bitloops',
          organization: 'bitloops',
        },
        projectPath: '.',
      },
    )
    const buildings = getSceneBuildings(scene)
    const config = buildings.find(
      (candidate) => candidate.filePath === 'src/config.rs',
    )
    const main = buildings.find(
      (candidate) => candidate.filePath === 'src/main.rs',
    )
    const protocolLoop = buildings.find(
      (candidate) => candidate.filePath === 'src/protocol_loop.rs',
    )

    expect(config).toBeDefined()
    expect(main).toBeDefined()
    expect(protocolLoop).toBeDefined()

    expect(maxVisibleGap(config!, main!)).toBeGreaterThanOrEqual(1)
    expect(maxVisibleGap(config!, protocolLoop!)).toBeGreaterThanOrEqual(1)
  })

  it('enriches buildings with architecture containers, entry points, and flows', () => {
    const scene = mapDevqlCodeCityWorldToScene(world(), {
      repository: {
        repoId: 'repo-1',
        identity: 'bitloops/bitloops',
        name: 'bitloops',
        organization: 'bitloops',
      },
      projectPath: '.',
      architecture: architecture(),
    })
    const service = getSceneBuildings(scene).find(
      (building) => building.filePath === 'src/application/order-service.ts',
    )
    const aggregate = getSceneBuildings(scene).find(
      (building) => building.filePath === 'src/core/order-aggregate.ts',
    )

    expect(scene.architecture.systems).toEqual([
      expect.objectContaining({
        key: 'repo:repo-1',
        containerIds: ['container:orders-api'],
      }),
    ])
    expect(scene.architecture.containers).toEqual([
      expect.objectContaining({
        label: 'Orders API',
        entryPoints: [expect.objectContaining({ entryKind: 'npm_bin' })],
      }),
    ])
    expect(service?.architecture.entryPoints).toEqual([
      expect.objectContaining({ label: 'orders-api' }),
    ])
    expect(service?.architecture.containerIds).toEqual(['container:orders-api'])
    expect(aggregate?.architecture.traversedByFlowIds).toEqual([
      'flow:orders-api',
    ])
    expect(scene.architecture.flows[0]?.traversedPaths).toEqual([
      'src/application/order-service.ts',
      'src/core/order-aggregate.ts',
    ])
    expect(
      scene.arcs.find((arc) => arc.architecture?.flowId === 'flow:orders-api'),
    ).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^architecture-flow:/u),
        architecture: expect.objectContaining({ kind: 'flow' }),
        fromPath: 'src/application/order-service.ts',
        toPath: 'src/core/order-aggregate.ts',
      }),
    )
  })

  it('uses workspace packages as fallback components for a single runnable container', () => {
    const containerNode = architectureNode({
      id: 'container:bitloops-inference',
      kind: 'CONTAINER',
      label: 'bitloops-inference',
      path: 'crates/bitloops-inference',
      properties: {
        container_kind: 'cli',
      },
    })
    const scene = mapDevqlCodeCityWorldToScene(
      world({
        buildings: [
          building('crates/bitloops-inference/src/main.rs', 'application', 2),
          building('crates/bitloops-inference-protocol/src/lib.rs', 'core', 9),
        ],
      }),
      {
        repository: {
          repoId: 'repo-1',
          identity: 'bitloops/bitloops-inference',
          name: 'bitloops-inference',
          organization: 'bitloops',
        },
        projectPath: '.',
        architecture: {
          systems: [],
          graphNodes: [],
          flows: [],
          containers: [
            {
              id: 'container:bitloops-inference',
              key: 'bitloops-inference',
              kind: 'cli',
              label: 'bitloops-inference',
              repository: {
                repoId: 'repo-1',
                name: 'bitloops-inference',
                provider: 'local',
                organization: 'bitloops',
              },
              node: containerNode,
              entryPoints: [],
              deploymentUnits: [],
              components: [],
            },
          ],
        },
      },
    )
    const container = scene.architecture.containers.find(
      (candidate) => candidate.id === 'container:bitloops-inference',
    )
    const protocolBuilding = getSceneBuildings(scene).find(
      (candidate) =>
        candidate.filePath === 'crates/bitloops-inference-protocol/src/lib.rs',
    )
    const componentLabels =
      container?.components.map((component) => component.label) ?? []
    const protocolComponent = container?.components.find(
      (component) => component.label === 'bitloops-inference-protocol',
    )

    expect(componentLabels).toEqual(
      expect.arrayContaining([
        'bitloops-inference',
        'bitloops-inference-protocol',
      ]),
    )
    expect(protocolComponent?.properties).toEqual(
      expect.objectContaining({
        component_kind: 'workspace_package',
      }),
    )
    expect(protocolBuilding?.architecture.containerIds).toContain(
      'container:bitloops-inference',
    )
    expect(protocolBuilding?.architecture.componentIds).toContain(
      protocolComponent?.id,
    )
  })
})
