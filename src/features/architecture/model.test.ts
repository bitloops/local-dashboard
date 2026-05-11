import { describe, expect, it } from 'vitest'
import type { CodeCitySceneModel } from '@/features/code-city/schema'
import type { DevqlArchitectureGraphNode } from '@/features/code-city/architecture-graph'
import { buildArchitectureScene } from './model'

function architectureNode(
  overrides: Partial<
    CodeCitySceneModel['architecture']['containers'][number]['components'][number]
  > = {},
): CodeCitySceneModel['architecture']['containers'][number]['components'][number] {
  return {
    id: 'node',
    kind: 'COMPONENT',
    label: 'Node',
    path: null,
    entryKind: null,
    confidence: 0.9,
    computed: true,
    asserted: false,
    properties: {},
    ...overrides,
  }
}

function graphNode(
  overrides: Partial<DevqlArchitectureGraphNode> = {},
): DevqlArchitectureGraphNode {
  return {
    id: 'graph-node',
    kind: 'NODE',
    label: 'Graph node',
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

function building({
  id,
  path,
  componentId,
}: {
  id: string
  path: string
  componentId: string
}): CodeCitySceneModel['boundaries'][number]['zones'][number]['districts'][number]['children'][number] {
  return {
    nodeType: 'building',
    id,
    filePath: path,
    label: path.split('/').at(-1) ?? path,
    importance: 0.6,
    healthRisk: 0.2,
    height: 8,
    footprint: 12,
    plot: {
      x: 0,
      y: 0,
      z: 0,
      width: 4,
      depth: 3,
      rotation: 0,
    },
    zoneAgreement: 'aligned',
    isTest: false,
    floors: [
      {
        id: `${id}:floor`,
        artefactName: path,
        artefactKind: 'file',
        loc: 80,
        height: 8,
        colour: '#52F6FF',
        healthRisk: 0.2,
        insufficientData: false,
      },
    ],
    incomingArcIds: [],
    outgoingArcIds: [],
    metricsSummary: {
      blastRadius: 0.4,
      weightedFanIn: 0.4,
      articulationScore: 0.4,
      loc: 80,
      artefactCount: 1,
      churn: 2,
      complexity: 3,
      bugCount: 0,
      coverage: 0.8,
      authorConcentration: 0.4,
    },
    architecture: {
      nodeIds: [],
      containerIds: ['container:app'],
      componentIds: [componentId],
      entryPoints: [],
      traversedByFlowIds: [],
    },
  }
}

function codeCityScene(): CodeCitySceneModel {
  const apiComponent = architectureNode({
    id: 'component:api',
    label: 'API',
    path: 'src/api',
  })
  const domainComponent = architectureNode({
    id: 'component:domain',
    label: 'Domain',
    path: 'src/domain',
  })
  const apiBuilding = building({
    id: 'building:api',
    path: 'src/api/main.ts',
    componentId: apiComponent.id,
  })
  const domainBuilding = building({
    id: 'building:domain',
    path: 'src/domain/order.ts',
    componentId: domainComponent.id,
  })

  return {
    id: 'scene',
    title: 'Code Atlas',
    mode: 'live',
    worldLayout: 'layered',
    source: {
      kind: 'live',
      datasetId: 'live-devql-current',
      description: 'Live DevQL',
      repo: 'bitloops',
      analysisWindowMonths: 6,
    },
    generatedAt: '2026-05-02T00:00:00.000Z',
    boundaries: [
      {
        id: 'boundary:app',
        name: 'Application',
        kind: 'application',
        architecture: 'layered',
        topologyRole: 'centre',
        labelAnchor: {
          x: 0,
          y: 1,
          z: 0,
        },
        ground: {
          kind: 'roundedRect',
          centre: {
            x: 0,
            y: 0,
            z: 0,
          },
          width: 20,
          depth: 20,
          height: 1,
          waterInset: 1,
          tint: '#103451',
        },
        zones: [
          {
            id: 'zone:app',
            name: 'Application',
            zoneType: 'application',
            layoutKind: 'strip',
            elevation: 0,
            shape: {
              kind: 'strip',
              centre: {
                x: 0,
                y: 0,
                z: 0,
              },
              width: 20,
              depth: 20,
              rotation: 0,
            },
            districts: [
              {
                nodeType: 'district',
                id: 'district:src',
                path: 'src',
                label: 'src',
                plot: {
                  x: 0,
                  y: 0,
                  z: 0,
                  width: 20,
                  depth: 20,
                  rotation: 0,
                },
                depth: 0,
                children: [apiBuilding, domainBuilding],
              },
            ],
          },
        ],
        sharedLibrary: {
          isSharedLibrary: false,
          renderMode: 'district',
          serves: [],
        },
      },
    ],
    arcs: [
      {
        id: 'dependency:api-domain',
        fromId: 'building:api',
        toId: 'building:domain',
        arcType: 'dependency',
        visibility: 'always-visible',
        strength: 0.8,
        severity: 'medium',
        fromPath: 'src/api/main.ts',
        toPath: 'src/domain/order.ts',
        visibleAtZoom: {
          min: 0,
          max: 300,
        },
      },
      {
        id: 'dependency:domain-api',
        fromId: 'building:domain',
        toId: 'building:api',
        arcType: 'dependency',
        visibility: 'always-visible',
        strength: 0.6,
        severity: 'high',
        fromPath: 'src/domain/order.ts',
        toPath: 'src/api/main.ts',
        visibleAtZoom: {
          min: 0,
          max: 300,
        },
      },
    ],
    crossBoundaryArcs: [],
    architecture: {
      systems: [],
      containers: [
        {
          id: 'container:app',
          key: 'app',
          kind: 'application',
          label: 'Application',
          path: 'src',
          repositoryId: 'repo-1',
          systemKeys: ['repo:repo-1'],
          entryPoints: [
            architectureNode({
              id: 'entry:cli',
              kind: 'ENTRY_POINT',
              label: 'bitloops',
              path: 'src/api/main.ts',
              entryKind: 'cli',
            }),
          ],
          deploymentUnits: [
            architectureNode({
              id: 'deployment:cli',
              kind: 'DEPLOYMENT_UNIT',
              label: 'bitloops cli',
              path: 'src/api/main.ts',
              entryKind: 'cargo_bin',
            }),
          ],
          components: [apiComponent, domainComponent],
        },
      ],
      flows: [
        {
          id: 'flow:cli',
          label: 'CLI flow',
          entryPoint: architectureNode({
            id: 'entry:cli',
            kind: 'ENTRY_POINT',
            label: 'bitloops',
            path: 'src/api/main.ts',
            entryKind: 'cli',
          }),
          traversedNodeIds: [],
          traversedPaths: ['src/api/main.ts', 'src/domain/order.ts'],
          steps: [],
        },
      ],
    },
    cameraPresets: [
      {
        id: 'world',
        label: 'World',
        description: 'World view',
        position: {
          x: 20,
          y: 20,
          z: 20,
        },
        target: {
          x: 0,
          y: 0,
          z: 0,
        },
      },
    ],
    legend: {
      healthStops: [
        { label: 'Healthy', value: 0, colour: '#22A66A' },
        { label: 'Moderate', value: 0.5, colour: '#D5D957' },
        { label: 'High risk', value: 1, colour: '#E0444E' },
      ],
      mappings: [],
      arcColours: {
        dependency: '#52F6FF',
        violation: '#FF355D',
        crossBoundary: '#FFB14A',
      },
    },
    config: {
      analysisWindowMonths: 6,
      buildingPadding: 0.25,
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
        healthy: '#22A66A',
        moderate: '#D5D957',
        highRisk: '#E0444E',
        noData: '#8C96A3',
        violationArc: '#D63E4A',
        crossBoundaryArcLow: '#6F8798',
        crossBoundaryArcHigh: '#E07832',
      },
    },
  }
}

describe('Architecture scene model', () => {
  it('promotes components, contracts, direct dependencies, and persistence links', () => {
    const scene = buildArchitectureScene({
      codeCityScene: codeCityScene(),
      graphNodes: [
        graphNode({
          id: 'node:api',
          kind: 'NODE',
          label: 'API node',
          path: 'src/api/main.ts',
        }),
        graphNode({
          id: 'persistence:orders',
          kind: 'PERSISTENCE_OBJECT',
          label: 'orders',
          path: 'orders',
        }),
      ],
      graphEdges: [
        {
          id: 'edge:api-reads-orders',
          kind: 'READS',
          fromNodeId: 'node:api',
          toNodeId: 'persistence:orders',
          sourceKind: 'COMPUTED',
          confidence: 0.78,
          computed: true,
          asserted: false,
          properties: {},
        },
      ],
    })

    expect(scene.components.map((component) => component.label)).toEqual([
      'API',
      'Domain',
    ])
    expect(scene.entryPoints).toHaveLength(1)
    expect(scene.deploymentUnits).toHaveLength(1)
    expect(scene.contractConnections).toEqual([
      expect.objectContaining({
        fromComponentId: 'component:api',
        toComponentId: 'component:domain',
        label: 'CLI flow',
      }),
    ])
    expect(scene.directConnections).toEqual([
      expect.objectContaining({
        fromComponentId: 'component:domain',
        toComponentId: 'component:api',
        dependencyCount: 1,
        severity: 'high',
      }),
    ])
    expect(scene.persistenceObjects).toEqual([
      expect.objectContaining({
        id: 'persistence:orders',
        readByComponentIds: ['component:api'],
      }),
    ])
    expect(scene.dataConnections).toEqual([
      expect.objectContaining({
        kind: 'read',
        componentId: 'component:api',
        persistenceObjectId: 'persistence:orders',
      }),
    ])
  })

  it('groups related source components under architecture parents', () => {
    const source = codeCityScene()
    const cliComponent = architectureNode({
      id: 'component:cli',
      label: 'CLI',
      path: 'src/cli',
    })
    const cliBuilding = building({
      id: 'building:cli',
      path: 'src/cli/main.ts',
      componentId: cliComponent.id,
    })

    source.architecture.containers[0]?.components.push(cliComponent)
    source.boundaries[0]?.zones[0]?.districts[0]?.children.push(cliBuilding)

    const scene = buildArchitectureScene({ codeCityScene: source })

    expect(scene.componentGroups).toEqual([
      expect.objectContaining({
        label: null,
        path: 'src',
        componentIds: expect.arrayContaining([
          'component:api',
          'component:cli',
          'component:domain',
        ]),
      }),
    ])
    expect(scene.summary.componentGroupCount).toBe(1)
  })

  it('orders components by flow step sequence before path fallback', () => {
    const source = codeCityScene()
    const container = source.architecture.containers[0]
    const flow = source.architecture.flows[0]

    expect(container).toBeDefined()
    expect(flow).toBeDefined()

    container!.components = [...container!.components].reverse()
    flow!.steps = [
      {
        ordinal: 1,
        moduleKey: 'src/api/main.ts',
        depth: 0,
        nodeIds: ['node:api'],
        paths: ['src/api/main.ts'],
        predecessorModuleKeys: [],
        edgeKinds: [],
        cyclic: false,
      },
      {
        ordinal: 2,
        moduleKey: 'src/domain/order.ts',
        depth: 1,
        nodeIds: ['node:domain'],
        paths: ['src/domain/order.ts'],
        predecessorModuleKeys: ['src/api/main.ts'],
        edgeKinds: ['DEPENDS_ON'],
        cyclic: false,
      },
    ]

    const scene = buildArchitectureScene({ codeCityScene: source })

    expect(scene.components.map((component) => component.id)).toEqual([
      'component:api',
      'component:domain',
    ])
    expect(scene.contractConnections).toEqual([
      expect.objectContaining({
        fromComponentId: 'component:api',
        toComponentId: 'component:domain',
      }),
    ])
  })
})
