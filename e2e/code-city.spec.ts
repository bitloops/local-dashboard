import { expect, test, type Locator, type Page } from '@playwright/test'

function codeCityBuilding(path: string, zone: string, x: number) {
  const risky = path.includes('service')

  return {
    path,
    language: 'typescript',
    boundaryId: 'boundary:root',
    zone,
    inferredZone: zone,
    conventionZone: zone,
    architectureRole: zone,
    importance: {
      score: risky ? 0.82 : 0.46,
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
    healthRisk: risky ? 0.72 : 0.18,
    healthStatus: 'ok',
    healthConfidence: 0.9,
    colour: risky ? '#E0444E' : '#22A66A',
    healthSummary: {
      floorCount: 1,
      highRiskFloorCount: risky ? 1 : 0,
      insufficientDataFloorCount: 0,
      averageRisk: risky ? 0.72 : 0.18,
      maxRisk: risky ? 0.72 : 0.18,
      missingSignals: [],
    },
    diagnosticBadges: [],
    floors: [
      {
        artefactId: `artefact:${path}`,
        symbolId: `symbol:${path}`,
        name: risky ? 'OrderService' : 'OrderAggregate',
        canonicalKind: 'class',
        languageKind: 'class_declaration',
        startLine: 1,
        endLine: 40,
        loc: 40,
        floorIndex: 0,
        floorHeight: 8,
        healthRisk: risky ? 0.72 : 0.18,
        colour: risky ? '#E0444E' : '#22A66A',
        healthStatus: 'ok',
        healthConfidence: 0.9,
        healthMetrics: {
          churn: 8,
          complexity: 5,
          bugCount: risky ? 2 : 0,
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

function architectureNode(overrides: Record<string, unknown>) {
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

async function mockDevqlCodeCity(page: Page) {
  await page.route('**/devql/dashboard', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          repositories: [
            {
              repoId: 'repo-1',
              identity: 'bitloops/bitloops',
              name: 'bitloops',
              provider: 'local',
              organization: 'bitloops',
              defaultBranch: 'main',
            },
          ],
        },
      }),
    })
  })

  await page.route('**/devql/global', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          architectureSystems: [
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
              node: architectureNode({
                id: 'system:orders',
                kind: 'SYSTEM',
                label: 'Orders',
              }),
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
                  node: architectureNode({
                    id: 'container:orders-api',
                    kind: 'CONTAINER',
                    label: 'Orders API',
                    path: 'src',
                    properties: { container_kind: 'api' },
                  }),
                  entryPoints: [
                    architectureNode({
                      id: 'entry:orders-api',
                      kind: 'ENTRY_POINT',
                      label: 'orders-api',
                      path: 'src/application/order-service.ts',
                      entryKind: 'npm_bin',
                    }),
                  ],
                  deploymentUnits: [
                    architectureNode({
                      id: 'deployment:orders-api',
                      kind: 'DEPLOYMENT_UNIT',
                      label: 'orders-api deployment',
                      path: 'src/application/order-service.ts',
                      entryKind: 'npm_bin',
                    }),
                  ],
                  components: [
                    architectureNode({
                      id: 'component:application',
                      kind: 'COMPONENT',
                      label: 'Application',
                      path: 'src/application',
                      confidence: 0.55,
                    }),
                  ],
                },
              ],
            },
          ],
          repo: {
            project: {
              path: '.',
              architectureGraph: {
                nodes: [
                  architectureNode({
                    id: 'node:order-service',
                    label: 'OrderService',
                    path: 'src/application/order-service.ts',
                  }),
                  architectureNode({
                    id: 'node:order-aggregate',
                    label: 'OrderAggregate',
                    path: 'src/core/order-aggregate.ts',
                  }),
                ],
              },
              architectureContainers: [
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
                  node: architectureNode({
                    id: 'container:orders-api',
                    kind: 'CONTAINER',
                    label: 'Orders API',
                    path: 'src',
                    properties: { container_kind: 'api' },
                  }),
                  entryPoints: [
                    architectureNode({
                      id: 'entry:orders-api',
                      kind: 'ENTRY_POINT',
                      label: 'orders-api',
                      path: 'src/application/order-service.ts',
                      entryKind: 'npm_bin',
                    }),
                  ],
                  deploymentUnits: [
                    architectureNode({
                      id: 'deployment:orders-api',
                      kind: 'DEPLOYMENT_UNIT',
                      label: 'orders-api deployment',
                      path: 'src/application/order-service.ts',
                      entryKind: 'npm_bin',
                    }),
                  ],
                  components: [
                    architectureNode({
                      id: 'component:application',
                      kind: 'COMPONENT',
                      label: 'Application',
                      path: 'src/application',
                      confidence: 0.55,
                    }),
                  ],
                },
              ],
              architectureFlows: [
                {
                  entryPoint: architectureNode({
                    id: 'entry:orders-api',
                    kind: 'ENTRY_POINT',
                    label: 'orders-api',
                    path: 'src/application/order-service.ts',
                    entryKind: 'npm_bin',
                  }),
                  flow: architectureNode({
                    id: 'flow:orders-api',
                    kind: 'FLOW',
                    label: 'orders-api flow',
                  }),
                  traversedNodes: [
                    architectureNode({
                      id: 'node:order-service',
                      label: 'OrderService',
                      path: 'src/application/order-service.ts',
                    }),
                    architectureNode({
                      id: 'node:order-aggregate',
                      label: 'OrderAggregate',
                      path: 'src/core/order-aggregate.ts',
                    }),
                  ],
                  steps: [
                    {
                      ordinal: 1,
                      moduleKey: 'src/application/order-service.ts',
                      depth: 0,
                      predecessorModuleKeys: [],
                      edgeKinds: [],
                      cyclic: false,
                      nodes: [
                        architectureNode({
                          id: 'node:order-service',
                          label: 'OrderService',
                          path: 'src/application/order-service.ts',
                        }),
                      ],
                    },
                    {
                      ordinal: 2,
                      moduleKey: 'src/core/order-aggregate.ts',
                      depth: 1,
                      predecessorModuleKeys: [
                        'src/application/order-service.ts',
                      ],
                      edgeKinds: ['DEPENDS_ON'],
                      cyclic: false,
                      nodes: [
                        architectureNode({
                          id: 'node:order-aggregate',
                          label: 'OrderAggregate',
                          path: 'src/core/order-aggregate.ts',
                        }),
                      ],
                    },
                  ],
                },
              ],
              codeCityWorld: {
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
                  codeCityBuilding(
                    'src/application/order-service.ts',
                    'application',
                    2,
                  ),
                  codeCityBuilding('src/core/order-aggregate.ts', 'core', 9),
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
              },
            },
          },
        },
      }),
    })
  })
}

async function expectCodeCityCanvasRendered(sceneCard: Locator) {
  await expect(sceneCard).toBeVisible()

  const canvas = sceneCard.locator('canvas')
  if ((await canvas.count()) === 0) {
    await expect(sceneCard).toContainText('WebGL unavailable')
    return
  }

  await expect(canvas).toBeVisible()

  await expect
    .poll(
      async () =>
        canvas.evaluate((node) => {
          const canvasElement = node as HTMLCanvasElement
          const context =
            canvasElement.getContext('webgl2') ??
            canvasElement.getContext('webgl') ??
            canvasElement.getContext('experimental-webgl')

          if (context == null) {
            return false
          }

          const gl = context as WebGLRenderingContext
          const width = gl.drawingBufferWidth
          const height = gl.drawingBufferHeight

          if (width === 0 || height === 0) {
            return false
          }

          const samples = [
            [0.5, 0.5],
            [0.35, 0.4],
            [0.65, 0.4],
            [0.45, 0.62],
            [0.58, 0.7],
          ]

          for (const [xRatio, yRatio] of samples) {
            const pixel = new Uint8Array(4)
            gl.readPixels(
              Math.floor(width * xRatio),
              Math.floor(height * yRatio),
              1,
              1,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixel,
            )

            const [red, green, blue, alpha] = pixel
            const isBlankWhite =
              alpha === 0 || (red > 245 && green > 245 && blue > 245)

            if (!isBlankWhite) {
              return true
            }
          }

          return false
        }),
      {
        timeout: 15_000,
      },
    )
    .toBe(true)
}

test('Code Atlas loads live DevQL data, searches, toggles overlays, and updates the inspector', async ({
  page,
}) => {
  const runtimeErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    runtimeErrors.push(error.message)
  })

  await mockDevqlCodeCity(page)
  await page.goto('/code-city')

  await expect(page.getByRole('heading', { name: 'Code Atlas' })).toBeVisible()
  await expectCodeCityCanvasRendered(page.getByTestId('code-city-scene-card'))
  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'C4 projection',
  )
  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'Orders API',
  )

  await page.getByTestId('code-city-search-input').fill('order-service')
  await page
    .getByRole('button', {
      name: /order-service\.ts\s+src\/application\/order-service\.ts/i,
    })
    .click()

  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'Selected building',
  )
  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'src/application/order-service.ts',
  )
  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'Architecture graph',
  )
  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'orders-api',
  )

  const overlaysToggle = page.getByTestId('code-city-toggle-overlays')
  await expect(overlaysToggle).toHaveAttribute('aria-pressed', 'true')
  await overlaysToggle.click()
  await expect(overlaysToggle).toHaveAttribute('aria-pressed', 'false')
  for (const toggleId of [
    'code-city-toggle-base',
    'code-city-toggle-zones',
    'code-city-toggle-folders',
    'code-city-toggle-buildings',
    'code-city-toggle-floors',
  ]) {
    const layerToggle = page.getByTestId(toggleId)
    await expect(layerToggle).toHaveAttribute('aria-pressed', 'true')
    await layerToggle.click()
    await expect(layerToggle).toHaveAttribute('aria-pressed', 'false')
  }

  await page.getByTestId('code-city-preset-select').click()
  await page.getByRole('option', { name: 'World view' }).click()
  await expect(page.getByTestId('code-city-scene-card')).toBeVisible()

  expect(runtimeErrors).toEqual([])
})
