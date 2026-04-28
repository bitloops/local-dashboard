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
  CodeCityVector3,
  CodeCityZone,
} from './schema'

export type CodeCityDatasetOption = {
  id: string
  title: string
  worldLayout: CodeCitySceneModel['worldLayout']
  summary: string
}

const HEALTHY = '#22A66A'
const MODERATE = '#D5D957'
const HIGH_RISK = '#E0444E'
const CRITICAL_RISK = '#B91F35'
const NO_DATA = '#8C96A3'
const VIOLATION = '#D63E4A'
const CROSS_BOUNDARY_LOW = '#6F8798'
const CROSS_BOUNDARY_HIGH = '#E07832'

const generatedAt = '2026-04-28T21:00:00.000Z'

const legend: CodeCityLegend = {
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
      metric: 'Size',
      description: 'Taller buildings contain more artefacts and LoC.',
    },
    {
      dimension: 'Floor colour',
      metric: 'Health',
      description: 'Green floors are healthy; red floors show low health.',
    },
  ],
  arcColours: {
    dependency: '#5E7186',
    violation: VIOLATION,
    crossBoundary: CROSS_BOUNDARY_HIGH,
  },
}

const config: CodeCitySceneModel['config'] = {
  analysisWindowMonths: 6,
  buildingPadding: 0.25,
  availableToggles: ['labels', 'tests', 'props', 'overlays'],
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
    crossBoundaryArcLow: CROSS_BOUNDARY_LOW,
    crossBoundaryArcHigh: CROSS_BOUNDARY_HIGH,
  },
}

function hashString(value: string) {
  let hash = 2166136261

  for (const character of value) {
    hash ^= character.charCodeAt(0)
    hash = Math.imul(hash, 16777619)
  }

  return Math.abs(hash >>> 0)
}

function seeded(value: string, min: number, max: number) {
  const hash = hashString(value)
  const ratio = (hash % 10_000) / 10_000
  return min + (max - min) * ratio
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function mixHex(first: string, second: string, weight: number) {
  const safeWeight = clamp(weight, 0, 1)

  const parse = (hex: string) => ({
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  })

  const left = parse(first)
  const right = parse(second)
  const blend = (from: number, to: number) =>
    Math.round(from + (to - from) * safeWeight)
      .toString(16)
      .padStart(2, '0')

  return `#${blend(left.r, right.r)}${blend(left.g, right.g)}${blend(left.b, right.b)}`
}

function getHealthColour(risk: number) {
  if (risk <= 0.38) {
    return mixHex(HEALTHY, MODERATE, risk / 0.38)
  }

  if (risk <= 0.58) {
    return MODERATE
  }

  return mixHex(HIGH_RISK, CRITICAL_RISK, (risk - 0.58) / 0.42)
}

function slugify(value: string) {
  return value
    .replaceAll(/[^\w/.-]+/gu, '-')
    .replaceAll('/', '--')
    .replaceAll('.', '-')
    .replaceAll('_', '-')
    .replaceAll(/-+/gu, '-')
    .replaceAll(/^-|-$/gu, '')
    .toLowerCase()
}

function buildingId(boundaryId: string, filePath: string) {
  return `${boundaryId}::${slugify(filePath)}`
}

function plot(
  x: number,
  z: number,
  width: number,
  depth: number,
  y = 0,
): CodeCityPlot {
  return {
    x,
    y,
    z,
    width,
    depth,
    rotation: 0,
  }
}

function polarPlot(
  centreX: number,
  centreZ: number,
  radius: number,
  angleDegrees: number,
  width: number,
  depth: number,
  y = 0,
) {
  const radians = (angleDegrees * Math.PI) / 180
  const x = centreX + Math.cos(radians) * radius - width / 2
  const z = centreZ + Math.sin(radians) * radius - depth / 2
  return plot(x, z, width, depth, y)
}

function resizePlotByImportance(
  sourcePlot: CodeCityPlot,
  importance: number,
  filePath: string,
  isTest: boolean,
): CodeCityPlot {
  const centreX = sourcePlot.x + sourcePlot.width / 2
  const centreZ = sourcePlot.z + sourcePlot.depth / 2
  const sourceArea = sourcePlot.width * sourcePlot.depth
  const scale = isTest
    ? 0.52 + importance * 0.82
    : 0.44 + Math.pow(importance, 1.18) * 1.72
  const area = sourceArea * scale
  const aspect = clamp(
    (sourcePlot.width / sourcePlot.depth) *
      seeded(`${filePath}:plot-aspect`, 0.72, 1.34),
    0.55,
    1.85,
  )
  const width = Math.sqrt(area * aspect)
  const depth = area / width

  return {
    ...sourcePlot,
    x: Number((centreX - width / 2).toFixed(2)),
    z: Number((centreZ - depth / 2).toFixed(2)),
    width: Number(width.toFixed(2)),
    depth: Number(depth.toFixed(2)),
  }
}

function floorCountForBuilding(filePath: string) {
  return 2 + (hashString(filePath) % 3)
}

function toWords(value: string) {
  return value
    .replace(/\.[^.]+$/u, '')
    .split(/[^a-zA-Z0-9]+/u)
    .filter(Boolean)
}

function toPascalCase(value: string) {
  const words = toWords(value)
  if (words.length === 0) {
    return 'Artefact'
  }

  return words
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join('')
}

function toCamelCase(value: string) {
  const pascal = toPascalCase(value)
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`
}

function createArtefactName(
  filePath: string,
  artefactKind: string,
  index: number,
) {
  const fileName = filePath.split('/').at(-1) ?? filePath
  const pascalName = toPascalCase(fileName)
  const camelName = toCamelCase(fileName)
  const functionNames = [
    `get${pascalName}Details`,
    `build${pascalName}`,
    `validate${pascalName}`,
    `map${pascalName}Result`,
  ]

  switch (artefactKind) {
    case 'aggregate':
    case 'class':
      return pascalName
    case 'adapter':
      return `${pascalName}Adapter`
    case 'contract':
      return `${pascalName}Contract`
    case 'event':
      return `${pascalName}Event`
    case 'interface':
      return `${pascalName}Port`
    case 'module':
      return `${pascalName}Module`
    case 'policy':
      return `evaluate${pascalName}`
    case 'query':
      return `load${pascalName}`
    case 'rule':
      return `assert${pascalName}`
    case 'stage':
      return `${camelName}Stage`
    case 'value-object':
      return `${pascalName}Value`
    case 'function':
      return functionNames[index % functionNames.length]!
    default:
      return `${camelName}${index + 1}`
  }
}

function createFloors(
  filePath: string,
  height: number,
  healthRisk: number,
  isTest: boolean,
  artefactKinds?: string[],
): CodeCityFloor[] {
  const count = floorCountForBuilding(filePath)
  const gap = 0.14
  const usableHeight = Math.max(2.4, height - gap * (count - 1))
  const baseHeight = usableHeight / count
  const defaultKinds = ['function', 'class', 'interface', 'query', 'adapter']

  return Array.from({ length: count }, (_, index) => {
    const artefactKind =
      artefactKinds?.[index] ?? defaultKinds[index % defaultKinds.length]!
    const floorRisk = clamp(
      healthRisk + seeded(`${filePath}:floor:${index}`, -0.16, 0.18),
      0,
      1,
    )
    const insufficientData = isTest
      ? false
      : hashString(`${filePath}:insufficient:${index}`) % 9 === 0

    return {
      id: `${buildingId(filePath, String(index))}-floor`,
      artefactName: createArtefactName(filePath, artefactKind, index),
      artefactKind,
      loc: Math.max(8, Math.round(seeded(`${filePath}:loc:${index}`, 8, 42))),
      height: Math.max(0.6, baseHeight),
      colour: insufficientData ? NO_DATA : getHealthColour(floorRisk),
      healthRisk: floorRisk,
      insufficientData,
    }
  })
}

function createMetricsSummary(
  filePath: string,
  importance: number,
  healthRisk: number,
  height: number,
  floorCount: number,
): CodeCityMetricsSummary {
  const loc = Math.max(30, Math.round(height * 6.4))

  return {
    blastRadius: clamp(
      importance + seeded(`${filePath}:blast`, -0.12, 0.18),
      0,
      1,
    ),
    weightedFanIn: clamp(
      importance + seeded(`${filePath}:fanin`, -0.16, 0.12),
      0,
      1,
    ),
    articulationScore: clamp(
      importance + seeded(`${filePath}:articulation`, -0.2, 0.1),
      0,
      1,
    ),
    loc,
    artefactCount: floorCount,
    churn: Number(seeded(`${filePath}:churn`, 2, 28).toFixed(1)),
    complexity: Number(seeded(`${filePath}:complexity`, 3, 22).toFixed(1)),
    bugCount: Math.round(seeded(`${filePath}:bugs`, 0, 5)),
    coverage:
      healthRisk > 0.82 ? null : Number((1 - healthRisk * 0.72).toFixed(2)),
    authorConcentration: Number(
      seeded(`${filePath}:authors`, 0.18, 0.9).toFixed(2),
    ),
  }
}

function createBuilding(args: {
  boundaryId: string
  filePath: string
  plot: CodeCityPlot
  label?: string
  importance?: number
  healthRisk?: number
  height?: number
  zoneAgreement?: CodeCityBuilding['zoneAgreement']
  isTest?: boolean
  artefactKinds?: string[]
}) {
  const importance =
    args.importance ??
    Number(seeded(`${args.filePath}:importance`, 0.28, 0.96).toFixed(2))
  const healthRisk =
    args.healthRisk ??
    Number(seeded(`${args.filePath}:risk`, 0.12, 0.92).toFixed(2))
  const height =
    args.height ?? Number(seeded(`${args.filePath}:height`, 7, 28).toFixed(2))
  const isTest = args.isTest ?? false
  const resizedPlot = resizePlotByImportance(
    args.plot,
    importance,
    args.filePath,
    isTest,
  )
  const floors = createFloors(
    args.filePath,
    height,
    healthRisk,
    isTest,
    args.artefactKinds,
  )

  return {
    nodeType: 'building' as const,
    id: buildingId(args.boundaryId, args.filePath),
    filePath: args.filePath,
    label: args.label ?? args.filePath.split('/').at(-1) ?? args.filePath,
    importance,
    healthRisk,
    height,
    footprint: Number((resizedPlot.width * resizedPlot.depth).toFixed(2)),
    plot: resizedPlot,
    zoneAgreement: args.zoneAgreement ?? 'aligned',
    isTest,
    floors,
    incomingArcIds: [],
    outgoingArcIds: [],
    metricsSummary: createMetricsSummary(
      args.filePath,
      importance,
      healthRisk,
      height,
      floors.length,
    ),
  }
}

function createDistrict(args: {
  id: string
  path: string
  label?: string
  plot: CodeCityPlot
  depth: number
  children: Array<CodeCityDistrict | CodeCityBuilding>
}) {
  return {
    nodeType: 'district' as const,
    id: args.id,
    path: args.path,
    label: args.label ?? args.path.split('/').at(-1) ?? args.path,
    plot: args.plot,
    depth: args.depth,
    children: args.children,
  }
}

function createCameraPreset(
  id: string,
  label: string,
  description: string,
  position: CodeCityVector3,
  target: CodeCityVector3,
): CodeCityCameraPreset {
  return {
    id,
    label,
    description,
    position,
    target,
  }
}

function createArc(args: {
  fromId: string
  toId: string
  arcType: CodeCityArc['arcType']
  strength?: number
  severity?: CodeCityArc['severity']
  visibleAtZoom?: CodeCityArc['visibleAtZoom']
}) {
  return {
    id: `${args.arcType}:${args.fromId}->${args.toId}`,
    fromId: args.fromId,
    toId: args.toId,
    arcType: args.arcType,
    strength: args.strength ?? 0.64,
    severity: args.severity ?? 'medium',
    visibleAtZoom:
      args.visibleAtZoom ??
      (args.arcType === 'cross-boundary'
        ? { min: 84, max: 320 }
        : { min: 18, max: 180 }),
  }
}

function collectBuildingsFromDistrict(districts: CodeCityDistrict[]) {
  const buildings: CodeCityBuilding[] = []

  const visit = (district: CodeCityDistrict) => {
    for (const child of district.children) {
      if (child.nodeType === 'building') {
        buildings.push(child)
        continue
      }

      visit(child)
    }
  }

  for (const district of districts) {
    visit(district)
  }

  return buildings
}

function createSharedBoundary(
  boundaryId: string,
  name: string,
  centreX: number,
  centreZ: number,
  topologyRole: CodeCityBoundary['topologyRole'],
): CodeCityBoundary {
  const y = -0.3
  const zone: CodeCityZone = {
    id: `${boundaryId}:shared`,
    name: 'shared-kernel',
    zoneType: 'shared',
    layoutKind: 'plaza',
    elevation: y,
    shape: {
      kind: 'plaza',
      centre: { x: centreX, y, z: centreZ },
      radius: 11,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:src`,
        path: 'src/kernel',
        plot: plot(centreX - 9, centreZ - 9, 18, 18, y),
        depth: 0,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/kernel/cache-coordinator.ts',
            plot: plot(centreX - 6.5, centreZ - 3.5, 4.4, 4.1, y),
            height: 7.8,
            importance: 0.92,
            healthRisk: 0.28,
          }),
          createBuilding({
            boundaryId,
            filePath: 'src/kernel/repo-registry.ts',
            plot: plot(centreX + 0.8, centreZ - 1.8, 4.2, 4.2, y),
            height: 6.6,
            importance: 0.87,
            healthRisk: 0.24,
          }),
          createBuilding({
            boundaryId,
            filePath: 'src/kernel/telemetry-bus.ts',
            plot: plot(centreX - 2, centreZ + 3.2, 4.8, 4.4, y),
            height: 6.4,
            importance: 0.81,
            healthRisk: 0.35,
          }),
        ],
      }),
    ],
  }

  return {
    id: boundaryId,
    name,
    kind: 'shared-kernel' as const,
    architecture: 'shared-library' as const,
    topologyRole,
    labelAnchor: { x: centreX, y: 4.5, z: centreZ - 12 },
    ground: {
      kind: 'disc' as const,
      centre: { x: centreX, y: -1.2, z: centreZ },
      radius: 17,
      height: 1.2,
      waterInset: 4,
      tint: '#E5F0EA',
    },
    zones: [zone],
    sharedLibrary: {
      isSharedLibrary: true,
      renderMode: 'plaza' as const,
      serves: ['orders', 'sessions', 'analytics'],
    },
  }
}

function createHexBoundary(
  boundaryId: string,
  name: string,
  centreX: number,
  centreZ: number,
  topologyRole: CodeCityBoundary['topologyRole'],
): CodeCityBoundary {
  const coreY = 0.1
  const testY = -0.85

  const domainDistrict = createDistrict({
    id: `${boundaryId}:domain`,
    path: 'src/domain',
    plot: plot(centreX - 10, centreZ - 10, 20, 20, coreY),
    depth: 1,
    children: [
      createBuilding({
        boundaryId,
        filePath: 'src/domain/order-aggregate.ts',
        plot: polarPlot(centreX, centreZ, 4.5, 215, 4.4, 4, coreY),
        importance: 0.94,
        healthRisk: 0.26,
        height: 14,
        artefactKinds: ['aggregate', 'policy', 'value-object'],
      }),
      createBuilding({
        boundaryId,
        filePath: 'src/domain/payment-policy.ts',
        plot: polarPlot(centreX, centreZ, 4, 325, 4.1, 3.8, coreY),
        importance: 0.88,
        healthRisk: 0.34,
        height: 12.2,
        artefactKinds: ['policy', 'rule', 'value-object'],
      }),
    ],
  })

  const applicationDistrict = createDistrict({
    id: `${boundaryId}:application`,
    path: 'src/application',
    plot: plot(centreX - 18, centreZ - 18, 36, 36, coreY),
    depth: 1,
    children: [
      createBuilding({
        boundaryId,
        filePath: 'src/application/sync-order.ts',
        plot: polarPlot(centreX, centreZ, 12.2, 140, 4.6, 4.1, coreY),
        importance: 0.82,
        healthRisk: 0.41,
        height: 16.5,
      }),
      createBuilding({
        boundaryId,
        filePath: 'src/application/issue-refund.ts',
        plot: polarPlot(centreX, centreZ, 11.8, 18, 4.2, 3.9, coreY),
        importance: 0.78,
        healthRisk: 0.56,
        height: 15.1,
      }),
    ],
  })

  const portsDistrict = createDistrict({
    id: `${boundaryId}:ports`,
    path: 'src/ports',
    plot: plot(centreX - 22, centreZ - 22, 44, 44, coreY),
    depth: 1,
    children: [
      createBuilding({
        boundaryId,
        filePath: 'src/ports/order-events.ts',
        plot: polarPlot(centreX, centreZ, 18.4, 285, 3.8, 3.8, coreY),
        importance: 0.75,
        healthRisk: 0.33,
        height: 11,
        artefactKinds: ['interface', 'event', 'contract'],
      }),
    ],
  })

  const adaptersDistrict = createDistrict({
    id: `${boundaryId}:adapters`,
    path: 'src/adapters',
    plot: plot(centreX - 28, centreZ - 28, 56, 56, coreY),
    depth: 1,
    children: [
      createDistrict({
        id: `${boundaryId}:adapters:http`,
        path: 'src/adapters/http',
        plot: plot(centreX + 8, centreZ - 24, 12, 12, coreY),
        depth: 2,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/adapters/http/order-controller.ts',
            plot: polarPlot(centreX, centreZ, 24.5, 332, 4.8, 4.2, coreY),
            importance: 0.67,
            healthRisk: 0.49,
            height: 18,
            zoneAgreement: 'warning',
          }),
        ],
      }),
      createDistrict({
        id: `${boundaryId}:adapters:persistence`,
        path: 'src/adapters/persistence',
        plot: plot(centreX - 24, centreZ - 8, 14, 14, coreY),
        depth: 2,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/adapters/persistence/order-repository.ts',
            plot: polarPlot(centreX, centreZ, 23.5, 210, 5.2, 4.4, coreY),
            importance: 0.72,
            healthRisk: 0.63,
            height: 19.4,
            zoneAgreement: 'violation',
          }),
        ],
      }),
      createDistrict({
        id: `${boundaryId}:adapters:messaging`,
        path: 'src/adapters/messaging',
        plot: plot(centreX - 10, centreZ + 18, 16, 10, coreY),
        depth: 2,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/adapters/messaging/refund-publisher.ts',
            plot: polarPlot(centreX, centreZ, 23, 72, 4.4, 4.1, coreY),
            importance: 0.69,
            healthRisk: 0.52,
            height: 13.5,
          }),
        ],
      }),
    ],
  })

  const edgeDistrict = createDistrict({
    id: `${boundaryId}:edge`,
    path: 'src/edge',
    plot: plot(centreX - 32, centreZ - 32, 64, 64, coreY),
    depth: 1,
    children: [
      createDistrict({
        id: `${boundaryId}:api`,
        path: 'src/api',
        plot: plot(centreX + 16, centreZ - 10, 14, 14, coreY),
        depth: 2,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/api/routes/order-route.ts',
            plot: polarPlot(centreX, centreZ, 30, 355, 3.8, 3.8, coreY),
            importance: 0.58,
            healthRisk: 0.46,
            height: 12.2,
          }),
        ],
      }),
      createDistrict({
        id: `${boundaryId}:cli`,
        path: 'src/cli',
        plot: plot(centreX - 24, centreZ + 10, 14, 12, coreY),
        depth: 2,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/cli/sync-order-command.ts',
            plot: polarPlot(centreX, centreZ, 30.5, 120, 3.7, 3.7, coreY),
            importance: 0.55,
            healthRisk: 0.38,
            height: 10.8,
          }),
        ],
      }),
    ],
  })

  const testDistrict = createDistrict({
    id: `${boundaryId}:tests`,
    path: 'tests/ordering',
    plot: plot(centreX + 23, centreZ + 18, 16, 12, testY),
    depth: 1,
    children: [
      createBuilding({
        boundaryId,
        filePath: 'tests/ordering/order-flow.spec.ts',
        plot: plot(centreX + 25, centreZ + 20, 4.2, 3.8, testY),
        importance: 0.34,
        healthRisk: 0.22,
        height: 5.2,
        isTest: true,
      }),
      createBuilding({
        boundaryId,
        filePath: 'tests/ordering/refund-flow.spec.ts',
        plot: plot(centreX + 31, centreZ + 23.5, 4.2, 3.8, testY),
        importance: 0.3,
        healthRisk: 0.18,
        height: 4.8,
        isTest: true,
      }),
    ],
  })

  return {
    id: boundaryId,
    name,
    kind: 'service' as const,
    architecture: 'hexagonal' as const,
    topologyRole,
    labelAnchor: { x: centreX, y: 4.4, z: centreZ - 16 },
    ground: {
      kind: 'disc' as const,
      centre: { x: centreX, y: -1.1, z: centreZ },
      radius: 38,
      height: 1.2,
      waterInset: 4.5,
      tint: '#E7F2F0',
    },
    zones: [
      {
        id: `${boundaryId}:core-zone`,
        name: 'core',
        zoneType: 'core',
        layoutKind: 'ring',
        elevation: coreY,
        shape: {
          kind: 'ring',
          centre: { x: centreX, y: coreY, z: centreZ },
          innerRadius: 0,
          radius: 9.5,
          rotation: 0,
        },
        districts: [domainDistrict],
      },
      {
        id: `${boundaryId}:application-zone`,
        name: 'application',
        zoneType: 'application',
        layoutKind: 'ring',
        elevation: coreY,
        shape: {
          kind: 'ring',
          centre: { x: centreX, y: coreY, z: centreZ },
          innerRadius: 9.5,
          radius: 16.5,
          rotation: 0,
        },
        districts: [applicationDistrict],
      },
      {
        id: `${boundaryId}:ports-zone`,
        name: 'ports',
        zoneType: 'ports',
        layoutKind: 'ring',
        elevation: coreY,
        shape: {
          kind: 'ring',
          centre: { x: centreX, y: coreY, z: centreZ },
          innerRadius: 16.5,
          radius: 21.5,
          rotation: 0,
        },
        districts: [portsDistrict],
      },
      {
        id: `${boundaryId}:periphery-zone`,
        name: 'periphery',
        zoneType: 'periphery',
        layoutKind: 'ring',
        elevation: coreY,
        shape: {
          kind: 'ring',
          centre: { x: centreX, y: coreY, z: centreZ },
          innerRadius: 21.5,
          radius: 28,
          rotation: 0,
        },
        districts: [adaptersDistrict],
      },
      {
        id: `${boundaryId}:edge-zone`,
        name: 'edge',
        zoneType: 'edge',
        layoutKind: 'ring',
        elevation: coreY,
        shape: {
          kind: 'ring',
          centre: { x: centreX, y: coreY, z: centreZ },
          innerRadius: 28,
          radius: 34.5,
          rotation: 0,
        },
        districts: [edgeDistrict],
      },
      {
        id: `${boundaryId}:test-zone`,
        name: 'shadow-tests',
        zoneType: 'test',
        layoutKind: 'island',
        elevation: testY,
        shape: {
          kind: 'island',
          centre: { x: centreX + 31, y: testY, z: centreZ + 24 },
          radius: 10,
          rotation: 0,
        },
        districts: [testDistrict],
      },
    ],
    sharedLibrary: {
      isSharedLibrary: false,
      renderMode: 'district' as const,
      serves: [],
    },
  }
}

function createLayeredBoundary(
  boundaryId: string,
  name: string,
  centreX: number,
  centreZ: number,
  topologyRole: CodeCityBoundary['topologyRole'],
): CodeCityBoundary {
  const baseY = 0.1
  const width = 66
  const depth = 46
  const west = centreX - width / 2

  const infrastructureZone: CodeCityZone = {
    id: `${boundaryId}:infrastructure-zone`,
    name: 'infrastructure',
    zoneType: 'periphery',
    layoutKind: 'band',
    elevation: baseY,
    shape: {
      kind: 'band',
      centre: { x: centreX, y: baseY, z: centreZ + 14 },
      width: 58,
      depth: 10,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:infra`,
        path: 'src/infrastructure',
        plot: plot(west + 3, centreZ + 9, 60, 11, baseY),
        depth: 1,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/infrastructure/sql-checkpoint-store.ts',
            plot: plot(west + 7, centreZ + 10.6, 6.4, 4.8, baseY),
            importance: 0.7,
            healthRisk: 0.58,
            height: 20.2,
          }),
          createBuilding({
            boundaryId,
            filePath: 'src/infrastructure/clickhouse-rollup.ts',
            plot: plot(west + 20, centreZ + 11.1, 5.8, 4.4, baseY),
            importance: 0.64,
            healthRisk: 0.66,
            height: 19.1,
          }),
        ],
      }),
    ],
  }

  const domainZone: CodeCityZone = {
    id: `${boundaryId}:domain-zone`,
    name: 'domain',
    zoneType: 'core',
    layoutKind: 'band',
    elevation: baseY + 1.1,
    shape: {
      kind: 'band',
      centre: { x: centreX, y: baseY + 1.1, z: centreZ - 4 },
      width: 58,
      depth: 12,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:domain`,
        path: 'src/domain',
        plot: plot(west + 3, centreZ - 9, 60, 12, baseY + 1.1),
        depth: 1,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/domain/session-lifecycle.ts',
            plot: plot(west + 9, centreZ - 6.4, 6.4, 4.9, baseY + 1.1),
            importance: 0.89,
            healthRisk: 0.29,
            height: 24.2,
          }),
          createBuilding({
            boundaryId,
            filePath: 'src/domain/model-capabilities.ts',
            plot: plot(west + 24, centreZ - 6.2, 5.8, 4.5, baseY + 1.1),
            importance: 0.81,
            healthRisk: 0.31,
            height: 18.6,
          }),
        ],
      }),
    ],
  }

  const applicationZone: CodeCityZone = {
    id: `${boundaryId}:application-zone`,
    name: 'application',
    zoneType: 'application',
    layoutKind: 'band',
    elevation: baseY + 0.65,
    shape: {
      kind: 'band',
      centre: { x: centreX, y: baseY + 0.65, z: centreZ + 4.5 },
      width: 58,
      depth: 9.5,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:application`,
        path: 'src/application',
        plot: plot(west + 3, centreZ + 0.6, 60, 10.4, baseY + 0.65),
        depth: 1,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/application/build-session-report.ts',
            plot: plot(west + 17, centreZ + 2, 6.1, 4.5, baseY + 0.65),
            importance: 0.74,
            healthRisk: 0.42,
            height: 16.4,
          }),
          createBuilding({
            boundaryId,
            filePath: 'src/application/stream-activity-window.ts',
            plot: plot(west + 31, centreZ + 1.8, 6.4, 4.4, baseY + 0.65),
            importance: 0.69,
            healthRisk: 0.47,
            height: 17.9,
          }),
        ],
      }),
    ],
  }

  const edgeZone: CodeCityZone = {
    id: `${boundaryId}:edge-zone`,
    name: 'presentation',
    zoneType: 'edge',
    layoutKind: 'band',
    elevation: baseY - 0.2,
    shape: {
      kind: 'band',
      centre: { x: centreX, y: baseY - 0.2, z: centreZ - 16 },
      width: 58,
      depth: 9.5,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:edge`,
        path: 'src/api',
        plot: plot(west + 3, centreZ - 20, 60, 9.5, baseY - 0.2),
        depth: 1,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'src/api/session-controller.ts',
            plot: plot(west + 11, centreZ - 18.3, 5.8, 4.4, baseY - 0.2),
            importance: 0.61,
            healthRisk: 0.45,
            height: 13.2,
          }),
          createBuilding({
            boundaryId,
            filePath: 'src/api/settings-controller.ts',
            plot: plot(west + 24, centreZ - 18.2, 5.2, 4.2, baseY - 0.2),
            importance: 0.48,
            healthRisk: 0.39,
            height: 11.1,
          }),
        ],
      }),
    ],
  }

  const testZone: CodeCityZone = {
    id: `${boundaryId}:test-zone`,
    name: 'shadow-tests',
    zoneType: 'test',
    layoutKind: 'island',
    elevation: -0.85,
    shape: {
      kind: 'island',
      centre: { x: centreX + 25, y: -0.85, z: centreZ + 24 },
      radius: 9,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:tests`,
        path: 'tests/integration',
        plot: plot(centreX + 19, centreZ + 19, 14, 10, -0.85),
        depth: 1,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'tests/integration/session-report.test.ts',
            plot: plot(centreX + 21, centreZ + 21.5, 4.2, 3.7, -0.85),
            height: 4.8,
            importance: 0.29,
            healthRisk: 0.18,
            isTest: true,
          }),
        ],
      }),
    ],
  }

  return {
    id: boundaryId,
    name,
    kind: 'application' as const,
    architecture: 'layered' as const,
    topologyRole,
    labelAnchor: { x: centreX, y: 4.8, z: centreZ - 28 },
    ground: {
      kind: 'roundedRect' as const,
      centre: { x: centreX, y: -1.2, z: centreZ },
      width,
      depth,
      height: 1.2,
      waterInset: 3.8,
      tint: '#E8EEF3',
    },
    zones: [
      infrastructureZone,
      domainZone,
      applicationZone,
      edgeZone,
      testZone,
    ],
    sharedLibrary: {
      isSharedLibrary: false,
      renderMode: 'district' as const,
      serves: [],
    },
  }
}

function createModularBoundary(
  boundaryId: string,
  name: string,
  centreX: number,
  centreZ: number,
  topologyRole: CodeCityBoundary['topologyRole'],
): CodeCityBoundary {
  const baseY = 0.12
  const moduleZone = (
    id: string,
    label: string,
    centre: CodeCityVector3,
    filePath: string,
    height: number,
    risk: number,
  ): CodeCityZone => ({
    id: `${boundaryId}:${id}`,
    name: label,
    zoneType: 'module',
    layoutKind: 'island',
    elevation: baseY,
    shape: {
      kind: 'island',
      centre,
      radius: 11,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:${id}:district`,
        path: `src/${label}`,
        plot: plot(centre.x - 8, centre.z - 8, 16, 16, baseY),
        depth: 1,
        children: [
          createBuilding({
            boundaryId,
            filePath,
            plot: plot(centre.x - 2.5, centre.z - 2, 5.2, 4.4, baseY),
            importance: Number(
              seeded(`${filePath}:importance`, 0.58, 0.83).toFixed(2),
            ),
            healthRisk: risk,
            height,
          }),
          createBuilding({
            boundaryId,
            filePath: filePath.replace('.ts', '.query.ts'),
            plot: plot(centre.x + 2.2, centre.z + 1.6, 4.1, 3.8, baseY),
            importance: Number(
              seeded(`${filePath}:query`, 0.4, 0.71).toFixed(2),
            ),
            healthRisk: clamp(risk + 0.08, 0, 1),
            height: height - 2.5,
          }),
        ],
      }),
    ],
  })

  return {
    id: boundaryId,
    name,
    kind: 'service' as const,
    architecture: 'modular' as const,
    topologyRole,
    labelAnchor: { x: centreX, y: 4.5, z: centreZ - 18 },
    ground: {
      kind: 'roundedRect' as const,
      centre: { x: centreX, y: -1.2, z: centreZ },
      width: 60,
      depth: 44,
      height: 1.2,
      waterInset: 4,
      tint: '#E4F0F1',
    },
    zones: [
      moduleZone(
        'catalogue',
        'catalogue',
        { x: centreX - 13, y: baseY, z: centreZ - 7 },
        'src/catalogue/catalogue-module.ts',
        17.2,
        0.36,
      ),
      moduleZone(
        'pricing',
        'pricing',
        { x: centreX + 13, y: baseY, z: centreZ - 8 },
        'src/pricing/pricing-module.ts',
        18.5,
        0.49,
      ),
      moduleZone(
        'fulfilment',
        'fulfilment',
        { x: centreX - 9, y: baseY, z: centreZ + 11 },
        'src/fulfilment/fulfilment-module.ts',
        15.4,
        0.44,
      ),
      {
        id: `${boundaryId}:tests`,
        name: 'shadow-tests',
        zoneType: 'test',
        layoutKind: 'island',
        elevation: -0.8,
        shape: {
          kind: 'island',
          centre: { x: centreX + 20, y: -0.8, z: centreZ + 16 },
          radius: 9,
          rotation: 0,
        },
        districts: [
          createDistrict({
            id: `${boundaryId}:tests:district`,
            path: 'tests/modular',
            plot: plot(centreX + 15, centreZ + 12, 12, 9, -0.8),
            depth: 1,
            children: [
              createBuilding({
                boundaryId,
                filePath: 'tests/modular/catalogue-pricing-flow.spec.ts',
                plot: plot(centreX + 17, centreZ + 14, 4, 3.6, -0.8),
                height: 4.5,
                importance: 0.26,
                healthRisk: 0.19,
                isTest: true,
              }),
            ],
          }),
        ],
      },
    ],
    sharedLibrary: {
      isSharedLibrary: false,
      renderMode: 'district' as const,
      serves: [],
    },
  }
}

function createPipeBoundary(
  boundaryId: string,
  name: string,
  centreX: number,
  centreZ: number,
  topologyRole: CodeCityBoundary['topologyRole'],
): CodeCityBoundary {
  const baseY = 0.15
  const stageWidth = 12
  const stageDepth = 10
  const stages = [
    { label: 'ingest', path: 'src/ingest/ingest-stage.ts', risk: 0.41 },
    {
      label: 'normalise',
      path: 'src/normalise/normalise-stage.ts',
      risk: 0.47,
    },
    { label: 'rank', path: 'src/rank/rank-stage.ts', risk: 0.55 },
    { label: 'publish', path: 'src/publish/publish-stage.ts', risk: 0.6 },
  ]

  const zones: CodeCityZone[] = stages.map((stage, index) => {
    const zoneX = centreX - 21 + index * 14
    return {
      id: `${boundaryId}:${stage.label}`,
      name: stage.label,
      zoneType: 'stage' as const,
      layoutKind: 'strip' as const,
      elevation: baseY,
      shape: {
        kind: 'strip' as const,
        centre: { x: zoneX, y: baseY, z: centreZ },
        width: stageWidth,
        depth: stageDepth,
        rotation: 0,
      },
      districts: [
        createDistrict({
          id: `${boundaryId}:${stage.label}:district`,
          path: `src/${stage.label}`,
          plot: plot(zoneX - 5.4, centreZ - 4.2, 10.8, 8.4, baseY),
          depth: 1,
          children: [
            createBuilding({
              boundaryId,
              filePath: stage.path,
              plot: plot(zoneX - 2.7, centreZ - 1.9, 5.1, 3.8, baseY),
              importance: Number((0.48 + index * 0.07).toFixed(2)),
              healthRisk: stage.risk,
              height: 12.2 + index * 1.8,
            }),
          ],
        }),
      ],
    }
  })

  zones.push({
    id: `${boundaryId}:tests`,
    name: 'shadow-tests',
    zoneType: 'test',
    layoutKind: 'island',
    elevation: -0.85,
    shape: {
      kind: 'island',
      centre: { x: centreX + 30, y: -0.85, z: centreZ + 12 },
      radius: 8,
      rotation: 0,
    },
    districts: [
      createDistrict({
        id: `${boundaryId}:tests:district`,
        path: 'tests/pipeline',
        plot: plot(centreX + 25, centreZ + 8, 12, 8, -0.85),
        depth: 1,
        children: [
          createBuilding({
            boundaryId,
            filePath: 'tests/pipeline/publish-pipeline.spec.ts',
            plot: plot(centreX + 27, centreZ + 10, 4.1, 3.5, -0.85),
            height: 4.6,
            importance: 0.28,
            healthRisk: 0.17,
            isTest: true,
          }),
        ],
      }),
    ],
  })

  return {
    id: boundaryId,
    name,
    kind: 'tooling' as const,
    architecture: 'pipe-and-filter' as const,
    topologyRole,
    labelAnchor: { x: centreX, y: 4.4, z: centreZ - 15 },
    ground: {
      kind: 'roundedRect' as const,
      centre: { x: centreX, y: -1.2, z: centreZ },
      width: 72,
      depth: 30,
      height: 1.2,
      waterInset: 3.5,
      tint: '#E7F1EC',
    },
    zones,
    sharedLibrary: {
      isSharedLibrary: false,
      renderMode: 'district' as const,
      serves: [],
    },
  }
}

function createMudBoundary(
  boundaryId: string,
  name: string,
  centreX: number,
  centreZ: number,
  topologyRole: CodeCityBoundary['topologyRole'],
): CodeCityBoundary {
  const baseY = 0.1
  const chaosBuildings = [
    ['src/core/fat-service.ts', -8, -4, 6.2, 5.1, 0.86, 0.88, 24.8],
    ['src/core/event-bus.ts', -1, -8, 4.8, 4.1, 0.67, 0.78, 17.4],
    ['src/core/schema-switch.ts', 7, -3, 5.4, 4.8, 0.61, 0.69, 15.8],
    ['src/core/render-loop.ts', -6, 4, 4.2, 4.2, 0.55, 0.73, 13.7],
    ['src/core/legacy-fork.ts', 2, 3, 6.4, 4.8, 0.72, 0.91, 26.2],
    ['src/core/unsafe-cache.ts', 10, 5, 4.1, 4.1, 0.46, 0.8, 14.9],
  ] as const

  return {
    id: boundaryId,
    name,
    kind: 'service' as const,
    architecture: 'ball-of-mud' as const,
    topologyRole,
    labelAnchor: { x: centreX, y: 4.6, z: centreZ - 15 },
    ground: {
      kind: 'disc' as const,
      centre: { x: centreX, y: -1.2, z: centreZ },
      radius: 31,
      height: 1.2,
      waterInset: 3.8,
      tint: '#ECEEF2',
    },
    zones: [
      {
        id: `${boundaryId}:chaos`,
        name: 'chaos-core',
        zoneType: 'chaos',
        layoutKind: 'chaos',
        elevation: baseY,
        shape: {
          kind: 'chaos',
          centre: { x: centreX, y: baseY, z: centreZ },
          radius: 24,
          rotation: 0,
        },
        districts: [
          createDistrict({
            id: `${boundaryId}:chaos:district`,
            path: 'src/core',
            plot: plot(centreX - 18, centreZ - 18, 36, 36, baseY),
            depth: 1,
            children: chaosBuildings.map(
              ([filePath, x, z, width, depth, importance, risk, height]) =>
                createBuilding({
                  boundaryId,
                  filePath,
                  plot: plot(centreX + x, centreZ + z, width, depth, baseY),
                  importance,
                  healthRisk: risk,
                  height,
                  zoneAgreement:
                    filePath.includes('legacy') || filePath.includes('unsafe')
                      ? 'violation'
                      : 'warning',
                }),
            ),
          }),
        ],
      },
      {
        id: `${boundaryId}:tests`,
        name: 'shadow-tests',
        zoneType: 'test',
        layoutKind: 'island',
        elevation: -0.95,
        shape: {
          kind: 'island',
          centre: { x: centreX + 20, y: -0.95, z: centreZ + 19 },
          radius: 8,
          rotation: 0,
        },
        districts: [
          createDistrict({
            id: `${boundaryId}:tests:district`,
            path: 'tests/regression',
            plot: plot(centreX + 15, centreZ + 15, 11, 8, -0.95),
            depth: 1,
            children: [
              createBuilding({
                boundaryId,
                filePath: 'tests/regression/legacy-fork.spec.ts',
                plot: plot(centreX + 17, centreZ + 17.5, 4.1, 3.5, -0.95),
                importance: 0.26,
                healthRisk: 0.24,
                height: 4.7,
                isTest: true,
              }),
            ],
          }),
        ],
      },
    ],
    sharedLibrary: {
      isSharedLibrary: false,
      renderMode: 'district' as const,
      serves: [],
    },
  }
}

function createScene(args: {
  id: string
  title: string
  summary: string
  worldLayout: CodeCitySceneModel['worldLayout']
  boundaries: CodeCityBoundary[]
  arcs: CodeCityArc[]
  cameraPresets: CodeCityCameraPreset[]
}): CodeCitySceneModel & {
  summary: string
} {
  return {
    id: args.id,
    title: args.title,
    summary: args.summary,
    mode: 'mock' as const,
    worldLayout: args.worldLayout,
    source: {
      kind: 'mock' as const,
      datasetId: args.id,
      description: args.summary,
      repo: 'bitloops/mock-city',
      analysisWindowMonths: config.analysisWindowMonths,
    },
    generatedAt,
    cameraPresets: args.cameraPresets,
    boundaries: args.boundaries,
    arcs: args.arcs,
    crossBoundaryArcs: args.arcs.filter(
      (arc) => arc.arcType === 'cross-boundary',
    ),
    legend,
    config,
  }
}

function attachArcIndexes(scene: CodeCitySceneModel): CodeCitySceneModel {
  const incoming = new Map<string, string[]>()
  const outgoing = new Map<string, string[]>()

  for (const arc of scene.arcs) {
    outgoing.set(arc.fromId, [...(outgoing.get(arc.fromId) ?? []), arc.id])
    incoming.set(arc.toId, [...(incoming.get(arc.toId) ?? []), arc.id])
  }

  const updateDistrict = (district: CodeCityDistrict): CodeCityDistrict => ({
    ...district,
    children: district.children.map((child) => {
      if (child.nodeType === 'district') {
        return updateDistrict(child)
      }

      return {
        ...child,
        incomingArcIds: incoming.get(child.id) ?? [],
        outgoingArcIds: outgoing.get(child.id) ?? [],
      }
    }),
  })

  return {
    ...scene,
    boundaries: scene.boundaries.map((boundary) => ({
      ...boundary,
      zones: boundary.zones.map((zone) => ({
        ...zone,
        districts: zone.districts.map(updateDistrict),
      })),
    })),
  }
}

function idFor(boundaryId: string, filePath: string) {
  return buildingId(boundaryId, filePath)
}

const starSharedKernelScene = createScene({
  id: 'star-shared-kernel',
  title: 'Star World / Shared Kernel',
  summary:
    'A hub-and-spoke mock city with a central shared kernel, one hexagonal service, a layered app, a modular island, and a pipeline spoke.',
  worldLayout: 'star/shared-kernel',
  boundaries: [
    createSharedBoundary('shared-kernel', 'shared-kernel', 0, 0, 'centre'),
    createHexBoundary('orders-service', 'orders-service', 0, -72, 'spoke'),
    createLayeredBoundary('sessions-app', 'sessions-app', 78, 12, 'spoke'),
    createModularBoundary(
      'catalogue-suite',
      'catalogue-suite',
      -78,
      18,
      'spoke',
    ),
    createPipeBoundary('metrics-pipeline', 'metrics-pipeline', 18, 78, 'spoke'),
  ],
  arcs: [
    createArc({
      fromId: idFor(
        'orders-service',
        'src/adapters/persistence/order-repository.ts',
      ),
      toId: idFor('orders-service', 'src/domain/order-aggregate.ts'),
      arcType: 'dependency',
      strength: 0.58,
    }),
    createArc({
      fromId: idFor('orders-service', 'src/adapters/http/order-controller.ts'),
      toId: idFor('orders-service', 'src/domain/payment-policy.ts'),
      arcType: 'violation',
      severity: 'high',
      strength: 0.78,
    }),
    createArc({
      fromId: idFor(
        'sessions-app',
        'src/infrastructure/sql-checkpoint-store.ts',
      ),
      toId: idFor('sessions-app', 'src/domain/session-lifecycle.ts'),
      arcType: 'violation',
      severity: 'high',
      strength: 0.74,
    }),
    createArc({
      fromId: idFor('catalogue-suite', 'src/pricing/pricing-module.ts'),
      toId: idFor('catalogue-suite', 'src/catalogue/catalogue-module.ts'),
      arcType: 'dependency',
      strength: 0.54,
    }),
    createArc({
      fromId: idFor('metrics-pipeline', 'src/normalise/normalise-stage.ts'),
      toId: idFor('metrics-pipeline', 'src/rank/rank-stage.ts'),
      arcType: 'dependency',
      strength: 0.66,
    }),
    createArc({
      fromId: idFor('orders-service', 'src/ports/order-events.ts'),
      toId: idFor('shared-kernel', 'src/kernel/telemetry-bus.ts'),
      arcType: 'cross-boundary',
      severity: 'medium',
      strength: 0.82,
    }),
    createArc({
      fromId: idFor('sessions-app', 'src/application/build-session-report.ts'),
      toId: idFor('shared-kernel', 'src/kernel/repo-registry.ts'),
      arcType: 'cross-boundary',
      severity: 'medium',
      strength: 0.77,
    }),
    createArc({
      fromId: idFor('catalogue-suite', 'src/fulfilment/fulfilment-module.ts'),
      toId: idFor('shared-kernel', 'src/kernel/cache-coordinator.ts'),
      arcType: 'cross-boundary',
      severity: 'low',
      strength: 0.7,
    }),
    createArc({
      fromId: idFor('metrics-pipeline', 'src/publish/publish-stage.ts'),
      toId: idFor('shared-kernel', 'src/kernel/telemetry-bus.ts'),
      arcType: 'cross-boundary',
      severity: 'high',
      strength: 0.89,
    }),
  ],
  cameraPresets: [
    createCameraPreset(
      'world',
      'World view',
      'Read the shared kernel and every spoke at once.',
      { x: 0, y: 150, z: 150 },
      { x: 0, y: 0, z: 0 },
    ),
    createCameraPreset(
      'orders-core',
      'Orders core',
      'Drop onto the concentric rings and domain core.',
      { x: 22, y: 52, z: -34 },
      { x: 0, y: 8, z: -72 },
    ),
    createCameraPreset(
      'pipeline',
      'Pipeline strip',
      'Read the ingest-to-publish flow left to right.',
      { x: 54, y: 44, z: 108 },
      { x: 18, y: 10, z: 78 },
    ),
  ],
})

const layeredScene = createScene({
  id: 'layered-world',
  title: 'Layered World',
  summary:
    'A front-to-back macro layout with layered delivery, plus a ring-shaped domain island and a supporting shared plaza.',
  worldLayout: 'layered',
  boundaries: [
    createHexBoundary('accounts-core', 'accounts-core', -52, -70, 'layer'),
    createLayeredBoundary('dashboard-app', 'dashboard-app', 0, -4, 'layer'),
    createSharedBoundary('platform-plaza', 'platform-plaza', 0, 66, 'shared'),
    createModularBoundary('query-toolkit', 'query-toolkit', 70, 54, 'layer'),
  ],
  arcs: [
    createArc({
      fromId: idFor(
        'dashboard-app',
        'src/infrastructure/sql-checkpoint-store.ts',
      ),
      toId: idFor('dashboard-app', 'src/domain/session-lifecycle.ts'),
      arcType: 'violation',
      severity: 'high',
      strength: 0.76,
    }),
    createArc({
      fromId: idFor(
        'accounts-core',
        'src/adapters/persistence/order-repository.ts',
      ),
      toId: idFor('accounts-core', 'src/domain/order-aggregate.ts'),
      arcType: 'dependency',
      strength: 0.55,
    }),
    createArc({
      fromId: idFor('query-toolkit', 'src/pricing/pricing-module.ts'),
      toId: idFor('query-toolkit', 'src/catalogue/catalogue-module.ts'),
      arcType: 'violation',
      severity: 'medium',
      strength: 0.63,
    }),
    createArc({
      fromId: idFor('accounts-core', 'src/ports/order-events.ts'),
      toId: idFor('platform-plaza', 'src/kernel/cache-coordinator.ts'),
      arcType: 'cross-boundary',
      strength: 0.8,
      severity: 'medium',
    }),
    createArc({
      fromId: idFor('dashboard-app', 'src/application/build-session-report.ts'),
      toId: idFor('platform-plaza', 'src/kernel/repo-registry.ts'),
      arcType: 'cross-boundary',
      strength: 0.74,
      severity: 'medium',
    }),
    createArc({
      fromId: idFor('query-toolkit', 'src/fulfilment/fulfilment-module.ts'),
      toId: idFor('platform-plaza', 'src/kernel/telemetry-bus.ts'),
      arcType: 'cross-boundary',
      strength: 0.69,
      severity: 'low',
    }),
  ],
  cameraPresets: [
    createCameraPreset(
      'macro-layered',
      'Macro layers',
      'Read the top-to-bottom macro layering across boundaries.',
      { x: 20, y: 148, z: 156 },
      { x: 5, y: 0, z: 0 },
    ),
    createCameraPreset(
      'dashboard-bands',
      'Dashboard bands',
      'Inspect the terraced application bands.',
      { x: 26, y: 52, z: 44 },
      { x: 0, y: 8, z: -4 },
    ),
    createCameraPreset(
      'accounts-ring',
      'Accounts ring',
      'Focus the concentric domain boundary from above.',
      { x: -24, y: 48, z: -26 },
      { x: -52, y: 8, z: -70 },
    ),
  ],
})

const federatedScene = createScene({
  id: 'federated-world',
  title: 'Federated World',
  summary:
    'Loosely coupled islands with long water gaps, a ring-based core, modular peers, a pipeline island, and a shared plaza.',
  worldLayout: 'federated',
  boundaries: [
    createHexBoundary('billing-core', 'billing-core', -82, -34, 'peer'),
    createModularBoundary('search-cluster', 'search-cluster', 18, -76, 'peer'),
    createPipeBoundary('events-pipeline', 'events-pipeline', 84, 12, 'peer'),
    createSharedBoundary(
      'shared-observability',
      'shared-observability',
      -10,
      64,
      'shared',
    ),
  ],
  arcs: [
    createArc({
      fromId: idFor('billing-core', 'src/adapters/http/order-controller.ts'),
      toId: idFor('billing-core', 'src/domain/payment-policy.ts'),
      arcType: 'violation',
      strength: 0.73,
      severity: 'high',
    }),
    createArc({
      fromId: idFor('search-cluster', 'src/pricing/pricing-module.ts'),
      toId: idFor('search-cluster', 'src/fulfilment/fulfilment-module.ts'),
      arcType: 'dependency',
      strength: 0.51,
      severity: 'low',
    }),
    createArc({
      fromId: idFor('events-pipeline', 'src/rank/rank-stage.ts'),
      toId: idFor('events-pipeline', 'src/publish/publish-stage.ts'),
      arcType: 'dependency',
      strength: 0.68,
      severity: 'medium',
    }),
    createArc({
      fromId: idFor('billing-core', 'src/ports/order-events.ts'),
      toId: idFor('shared-observability', 'src/kernel/telemetry-bus.ts'),
      arcType: 'cross-boundary',
      strength: 0.84,
      severity: 'high',
    }),
    createArc({
      fromId: idFor('search-cluster', 'src/catalogue/catalogue-module.ts'),
      toId: idFor('shared-observability', 'src/kernel/cache-coordinator.ts'),
      arcType: 'cross-boundary',
      strength: 0.7,
      severity: 'medium',
    }),
    createArc({
      fromId: idFor('events-pipeline', 'src/publish/publish-stage.ts'),
      toId: idFor('shared-observability', 'src/kernel/repo-registry.ts'),
      arcType: 'cross-boundary',
      strength: 0.75,
      severity: 'medium',
    }),
  ],
  cameraPresets: [
    createCameraPreset(
      'federated-overview',
      'Island overview',
      'Read each island with wide breathing room between them.',
      { x: 8, y: 154, z: 164 },
      { x: 0, y: 0, z: 0 },
    ),
    createCameraPreset(
      'billing',
      'Billing ring',
      'Inspect the billing ring and its shadow tests.',
      { x: -40, y: 54, z: -2 },
      { x: -82, y: 8, z: -34 },
    ),
    createCameraPreset(
      'observability',
      'Shared plaza',
      'Inspect the shared observability plaza and outbound dependencies.',
      { x: 24, y: 44, z: 96 },
      { x: -10, y: 4, z: 64 },
    ),
  ],
})

const tangledScene = createScene({
  id: 'tangled-world',
  title: 'Tangled World',
  summary:
    'A tight, uncomfortable landmass with a mud core, a strained layered neighbour, a ring service fighting back, and a shared plaza with too much traffic.',
  worldLayout: 'tangled',
  boundaries: [
    createMudBoundary('legacy-core', 'legacy-core', -8, -12, 'tangled-cluster'),
    createLayeredBoundary(
      'runtime-shell',
      'runtime-shell',
      60,
      -8,
      'tangled-cluster',
    ),
    createHexBoundary(
      'domain-rescue',
      'domain-rescue',
      -58,
      48,
      'tangled-cluster',
    ),
    createSharedBoundary('common-ground', 'common-ground', 26, 56, 'shared'),
  ],
  arcs: [
    createArc({
      fromId: idFor('legacy-core', 'src/core/fat-service.ts'),
      toId: idFor('legacy-core', 'src/core/legacy-fork.ts'),
      arcType: 'violation',
      strength: 0.86,
      severity: 'high',
    }),
    createArc({
      fromId: idFor('legacy-core', 'src/core/unsafe-cache.ts'),
      toId: idFor('legacy-core', 'src/core/event-bus.ts'),
      arcType: 'violation',
      strength: 0.71,
      severity: 'high',
    }),
    createArc({
      fromId: idFor(
        'runtime-shell',
        'src/infrastructure/sql-checkpoint-store.ts',
      ),
      toId: idFor('runtime-shell', 'src/domain/model-capabilities.ts'),
      arcType: 'violation',
      strength: 0.77,
      severity: 'high',
    }),
    createArc({
      fromId: idFor(
        'domain-rescue',
        'src/adapters/persistence/order-repository.ts',
      ),
      toId: idFor('domain-rescue', 'src/domain/payment-policy.ts'),
      arcType: 'dependency',
      strength: 0.58,
      severity: 'medium',
    }),
    createArc({
      fromId: idFor('legacy-core', 'src/core/event-bus.ts'),
      toId: idFor('common-ground', 'src/kernel/telemetry-bus.ts'),
      arcType: 'cross-boundary',
      strength: 0.91,
      severity: 'high',
    }),
    createArc({
      fromId: idFor(
        'runtime-shell',
        'src/application/stream-activity-window.ts',
      ),
      toId: idFor('common-ground', 'src/kernel/cache-coordinator.ts'),
      arcType: 'cross-boundary',
      strength: 0.78,
      severity: 'high',
    }),
    createArc({
      fromId: idFor('domain-rescue', 'src/ports/order-events.ts'),
      toId: idFor('common-ground', 'src/kernel/repo-registry.ts'),
      arcType: 'cross-boundary',
      strength: 0.73,
      severity: 'medium',
    }),
    createArc({
      fromId: idFor('legacy-core', 'src/core/legacy-fork.ts'),
      toId: idFor('runtime-shell', 'src/api/session-controller.ts'),
      arcType: 'cross-boundary',
      strength: 0.67,
      severity: 'high',
      visibleAtZoom: { min: 60, max: 260 },
    }),
  ],
  cameraPresets: [
    createCameraPreset(
      'tangled-overview',
      'Tangled overview',
      'Read the cramped landmass and bright warning wires.',
      { x: 18, y: 148, z: 138 },
      { x: 0, y: 0, z: 14 },
    ),
    createCameraPreset(
      'legacy-hotspot',
      'Legacy hotspot',
      'Inspect the mud core and its highest-risk towers.',
      { x: 36, y: 52, z: 24 },
      { x: -8, y: 8, z: -12 },
    ),
    createCameraPreset(
      'rescue-ring',
      'Rescue ring',
      'Focus the ring-shaped domain boundary pushing against the cluster.',
      { x: -28, y: 48, z: 98 },
      { x: -58, y: 8, z: 48 },
    ),
  ],
})

const rawScenes = [
  starSharedKernelScene,
  layeredScene,
  federatedScene,
  tangledScene,
] as const

export const codeCityFixtureCatalogue = rawScenes.map((scene) =>
  attachArcIndexes(scene),
)

export const codeCityDatasetOptions: CodeCityDatasetOption[] =
  codeCityFixtureCatalogue.map((scene) => ({
    id: scene.id,
    title: scene.title,
    worldLayout: scene.worldLayout,
    summary: (scene.source.description ?? '') as string,
  }))

export function getFixtureScene(datasetId: string) {
  return (
    codeCityFixtureCatalogue.find((scene) => scene.id === datasetId) ?? null
  )
}

export function getFixtureBuildingCount(datasetId: string) {
  const scene = getFixtureScene(datasetId)
  if (scene == null) {
    return 0
  }

  return scene.boundaries
    .flatMap((boundary) => boundary.zones)
    .flatMap((zone) => collectBuildingsFromDistrict(zone.districts)).length
}
