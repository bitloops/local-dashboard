import { describe, expect, it } from 'vitest'
import {
  codeCityBuildingIdForPath,
  mapDevqlCodeCityWorldToScene,
} from './devql'
import { getSceneBuildings } from './scene-utils'

type DevqlWorldFixture = Parameters<typeof mapDevqlCodeCityWorldToScene>[0]

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
})
