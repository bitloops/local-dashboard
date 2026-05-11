import { z } from 'zod'

const hexColourSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/u, 'Expected a hex colour.')

export const codeCityVector2Schema = z.object({
  x: z.number().finite(),
  z: z.number().finite(),
})

export const codeCityVector3Schema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  z: z.number().finite(),
})

export const codeCityPlotSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite().default(0),
  z: z.number().finite(),
  width: z.number().positive(),
  depth: z.number().positive(),
  rotation: z.number().finite().default(0),
})

export const codeCityArcSchema = z.object({
  id: z.string().min(1),
  fromId: z.string().min(1),
  toId: z.string().min(1),
  arcType: z.enum(['dependency', 'violation', 'cross-boundary']),
  visibility: z
    .enum([
      'hidden-by-default',
      'visible-on-selection',
      'visible-at-medium-zoom',
      'visible-at-world-zoom',
      'always-visible',
    ])
    .optional(),
  strength: z.number().min(0).max(1),
  severity: z.enum(['low', 'medium', 'high']),
  fromPath: z.string().min(1).optional(),
  toPath: z.string().min(1).optional(),
  label: z.string().min(1).optional(),
  tooltip: z.string().min(1).optional(),
  architecture: z
    .object({
      kind: z.enum(['flow']),
      flowId: z.string().min(1),
      entryPointId: z.string().min(1),
    })
    .optional(),
  visibleAtZoom: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().positive(),
    })
    .refine(({ min, max }) => max >= min, {
      message: 'visibleAtZoom.max must be greater than or equal to min.',
    }),
})

export const codeCityFloorSchema = z.object({
  id: z.string().min(1),
  artefactName: z.string().min(1),
  artefactKind: z.string().min(1),
  loc: z.number().int().min(0),
  height: z.number().positive(),
  colour: hexColourSchema,
  healthRisk: z.number().min(0).max(1),
  insufficientData: z.boolean(),
})

export const codeCityMetricsSummarySchema = z.object({
  blastRadius: z.number().min(0).max(1),
  weightedFanIn: z.number().min(0).max(1),
  articulationScore: z.number().min(0).max(1),
  loc: z.number().int().min(0),
  artefactCount: z.number().int().min(0),
  churn: z.number().min(0),
  complexity: z.number().min(0),
  bugCount: z.number().int().min(0),
  coverage: z.number().min(0).max(1).nullable(),
  authorConcentration: z.number().min(0).max(1),
})

export const codeCityArchitectureNodeSchema = z.object({
  id: z.string().min(1),
  kind: z.string().min(1),
  label: z.string().min(1),
  path: z.string().min(1).nullable().optional(),
  entryKind: z.string().min(1).nullable().optional(),
  confidence: z.number().min(0).max(1),
  computed: z.boolean(),
  asserted: z.boolean(),
  properties: z.unknown().optional(),
})

export const codeCityBuildingArchitectureSchema = z.object({
  nodeIds: z.array(z.string().min(1)).default([]),
  containerIds: z.array(z.string().min(1)).default([]),
  componentIds: z.array(z.string().min(1)).default([]),
  entryPoints: z.array(codeCityArchitectureNodeSchema).default([]),
  traversedByFlowIds: z.array(z.string().min(1)).default([]),
})

export const codeCityBuildingSchema = z.object({
  nodeType: z.literal('building'),
  id: z.string().min(1),
  filePath: z.string().min(1),
  label: z.string().min(1),
  importance: z.number().min(0).max(1),
  healthRisk: z.number().min(0).max(1),
  height: z.number().positive(),
  footprint: z.number().positive(),
  plot: codeCityPlotSchema,
  zoneAgreement: z.enum(['aligned', 'warning', 'violation']),
  isTest: z.boolean(),
  floors: z.array(codeCityFloorSchema).min(1),
  incomingArcIds: z.array(z.string().min(1)),
  outgoingArcIds: z.array(z.string().min(1)),
  metricsSummary: codeCityMetricsSummarySchema,
  architecture: codeCityBuildingArchitectureSchema.default({
    nodeIds: [],
    containerIds: [],
    componentIds: [],
    entryPoints: [],
    traversedByFlowIds: [],
  }),
})

export type CodeCityBuilding = z.infer<typeof codeCityBuildingSchema>

export type CodeCityDistrict = {
  nodeType: 'district'
  id: string
  path: string
  label: string
  plot: z.infer<typeof codeCityPlotSchema>
  depth: number
  children: Array<CodeCityDistrict | CodeCityBuilding>
}

export const codeCityDistrictSchema: z.ZodType<CodeCityDistrict> = z.lazy(() =>
  z.object({
    nodeType: z.literal('district'),
    id: z.string().min(1),
    path: z.string().min(1),
    label: z.string().min(1),
    plot: codeCityPlotSchema,
    depth: z.number().int().min(0),
    children: z.array(
      z.union([codeCityDistrictSchema, codeCityBuildingSchema]),
    ),
  }),
)

export const codeCityZoneShapeSchema = z
  .object({
    kind: z.enum(['ring', 'band', 'island', 'strip', 'chaos', 'plaza']),
    centre: codeCityVector3Schema,
    radius: z.number().positive().optional(),
    innerRadius: z.number().nonnegative().optional(),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    rotation: z.number().finite().default(0),
  })
  .superRefine((shape, ctx) => {
    if (shape.kind === 'ring') {
      if (shape.radius == null || shape.innerRadius == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Ring zones require radius and innerRadius.',
        })
      }
      if (shape.radius != null && shape.innerRadius != null) {
        if (shape.radius <= shape.innerRadius) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Ring radius must be greater than innerRadius.',
          })
        }
      }
      return
    }

    if (
      shape.kind === 'chaos' ||
      shape.kind === 'plaza' ||
      shape.kind === 'island'
    ) {
      if (shape.radius == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${shape.kind} zones require radius.`,
        })
      }
      return
    }

    if (shape.width == null || shape.depth == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${shape.kind} zones require width and depth.`,
      })
    }
  })

export const codeCityZoneSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  zoneType: z.enum([
    'core',
    'application',
    'periphery',
    'edge',
    'ports',
    'module',
    'stage',
    'chaos',
    'shared',
    'test',
  ]),
  layoutKind: z.enum(['ring', 'band', 'island', 'strip', 'chaos', 'plaza']),
  elevation: z.number().finite(),
  shape: codeCityZoneShapeSchema,
  districts: z.array(codeCityDistrictSchema).min(1),
})

export const codeCityBoundaryGroundSchema = z
  .object({
    kind: z.enum(['disc', 'roundedRect']),
    centre: codeCityVector3Schema,
    radius: z.number().positive().optional(),
    width: z.number().positive().optional(),
    depth: z.number().positive().optional(),
    height: z.number().positive(),
    waterInset: z.number().nonnegative(),
    tint: hexColourSchema,
  })
  .superRefine((ground, ctx) => {
    if (ground.kind === 'disc') {
      if (ground.radius == null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Disc boundaries require radius.',
        })
      }
      return
    }

    if (ground.width == null || ground.depth == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rounded rectangle boundaries require width and depth.',
      })
    }
  })

export const codeCitySharedLibrarySchema = z.object({
  isSharedLibrary: z.boolean(),
  renderMode: z.enum(['plaza', 'district']),
  serves: z.array(z.string().min(1)),
})

export const codeCityBoundarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  parentBoundaryId: z.string().min(1).nullable().optional(),
  boundaryRole: z.enum(['group', 'leaf']).optional(),
  hierarchyDepth: z.number().int().min(0).optional(),
  kind: z.enum([
    'group',
    'service',
    'library',
    'application',
    'tooling',
    'shared-kernel',
  ]),
  architecture: z.enum([
    'hexagonal',
    'layered',
    'modular',
    'event-driven',
    'pipe-and-filter',
    'ball-of-mud',
    'shared-library',
    'unclassified',
  ]),
  topologyRole: z.enum([
    'centre',
    'spoke',
    'layer',
    'peer',
    'shared',
    'tangled-cluster',
  ]),
  labelAnchor: codeCityVector3Schema,
  ground: codeCityBoundaryGroundSchema,
  zones: z.array(codeCityZoneSchema),
  sharedLibrary: codeCitySharedLibrarySchema,
})

export const codeCityCameraPresetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  position: codeCityVector3Schema,
  target: codeCityVector3Schema,
})

export const codeCityLegendSchema = z.object({
  healthStops: z
    .array(
      z.object({
        label: z.string().min(1),
        value: z.number().min(0).max(1),
        colour: hexColourSchema,
      }),
    )
    .min(3),
  mappings: z.array(
    z.object({
      dimension: z.string().min(1),
      metric: z.string().min(1),
      description: z.string().min(1),
    }),
  ),
  arcColours: z.object({
    dependency: hexColourSchema,
    violation: hexColourSchema,
    crossBoundary: hexColourSchema,
  }),
})

export const codeCityAnalysisConfigSchema = z.object({
  analysisWindowMonths: z.number().int().positive(),
  buildingPadding: z.number().nonnegative(),
  availableToggles: z
    .array(
      z.enum([
        'labels',
        'tests',
        'base',
        'zones',
        'folders',
        'buildings',
        'floors',
        'props',
        'overlays',
      ]),
    )
    .min(1),
  labelDistances: z.object({
    boundary: z.number().positive(),
    zone: z.number().positive(),
    district: z.number().positive(),
    building: z.number().positive(),
    detail: z.number().positive(),
  }),
  colours: z.object({
    healthy: hexColourSchema,
    moderate: hexColourSchema,
    highRisk: hexColourSchema,
    noData: hexColourSchema,
    violationArc: hexColourSchema,
    crossBoundaryArcLow: hexColourSchema,
    crossBoundaryArcHigh: hexColourSchema,
  }),
})

export const codeCitySourceSchema = z.object({
  kind: z.enum(['mock', 'live']),
  datasetId: z.string().min(1),
  description: z.string().min(1),
  repo: z.string().min(1),
  analysisWindowMonths: z.number().int().positive(),
})

export const codeCityArchitectureContainerSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1).nullable().optional(),
  kind: z.string().min(1).nullable().optional(),
  label: z.string().min(1),
  path: z.string().min(1).nullable().optional(),
  repositoryId: z.string().min(1),
  systemKeys: z.array(z.string().min(1)).default([]),
  entryPoints: z.array(codeCityArchitectureNodeSchema).default([]),
  deploymentUnits: z.array(codeCityArchitectureNodeSchema).default([]),
  components: z.array(codeCityArchitectureNodeSchema).default([]),
})

export const codeCityArchitectureSystemSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  label: z.string().min(1),
  repositoryIds: z.array(z.string().min(1)).default([]),
  containerIds: z.array(z.string().min(1)).default([]),
})

export const codeCityArchitectureFlowStepSchema = z.object({
  ordinal: z.number().int().positive(),
  moduleKey: z.string().min(1),
  depth: z.number().int().min(0),
  nodeIds: z.array(z.string().min(1)).default([]),
  paths: z.array(z.string().min(1)).default([]),
  predecessorModuleKeys: z.array(z.string().min(1)).default([]),
  edgeKinds: z.array(z.string().min(1)).default([]),
  cyclic: z.boolean().default(false),
})

export const codeCityArchitectureFlowSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  entryPoint: codeCityArchitectureNodeSchema,
  traversedNodeIds: z.array(z.string().min(1)).default([]),
  traversedPaths: z.array(z.string().min(1)).default([]),
  steps: z.array(codeCityArchitectureFlowStepSchema).default([]),
})

export const codeCityArchitectureSummarySchema = z.object({
  systems: z.array(codeCityArchitectureSystemSchema).default([]),
  containers: z.array(codeCityArchitectureContainerSchema).default([]),
  flows: z.array(codeCityArchitectureFlowSchema).default([]),
})

export const codeCitySceneModelSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  mode: z.enum(['mock', 'live']),
  worldLayout: z.enum([
    'single-boundary',
    'star/shared-kernel',
    'layered',
    'federated',
    'tangled',
    'unknown',
  ]),
  source: codeCitySourceSchema,
  generatedAt: z.string().datetime(),
  cameraPresets: z.array(codeCityCameraPresetSchema).min(1),
  boundaries: z.array(codeCityBoundarySchema),
  arcs: z.array(codeCityArcSchema),
  crossBoundaryArcs: z.array(codeCityArcSchema),
  architecture: codeCityArchitectureSummarySchema.default({
    systems: [],
    containers: [],
    flows: [],
  }),
  legend: codeCityLegendSchema,
  config: codeCityAnalysisConfigSchema,
})

export type CodeCityVector2 = z.infer<typeof codeCityVector2Schema>
export type CodeCityVector3 = z.infer<typeof codeCityVector3Schema>
export type CodeCityPlot = z.infer<typeof codeCityPlotSchema>
export type CodeCityArc = z.infer<typeof codeCityArcSchema>
export type CodeCityFloor = z.infer<typeof codeCityFloorSchema>
export type CodeCityMetricsSummary = z.infer<
  typeof codeCityMetricsSummarySchema
>
export type CodeCityArchitectureNode = z.infer<
  typeof codeCityArchitectureNodeSchema
>
export type CodeCityBuildingArchitecture = z.infer<
  typeof codeCityBuildingArchitectureSchema
>
export type CodeCityZoneShape = z.infer<typeof codeCityZoneShapeSchema>
export type CodeCityZone = z.infer<typeof codeCityZoneSchema>
export type CodeCitySharedLibrary = z.infer<typeof codeCitySharedLibrarySchema>
export type CodeCityBoundaryGround = z.infer<
  typeof codeCityBoundaryGroundSchema
>
export type CodeCityBoundary = z.infer<typeof codeCityBoundarySchema>
export type CodeCityCameraPreset = z.infer<typeof codeCityCameraPresetSchema>
export type CodeCityLegend = z.infer<typeof codeCityLegendSchema>
export type CodeCityAnalysisConfig = z.infer<
  typeof codeCityAnalysisConfigSchema
>
export type CodeCitySource = z.infer<typeof codeCitySourceSchema>
export type CodeCityArchitectureContainer = z.infer<
  typeof codeCityArchitectureContainerSchema
>
export type CodeCityArchitectureSystem = z.infer<
  typeof codeCityArchitectureSystemSchema
>
export type CodeCityArchitectureFlow = z.infer<
  typeof codeCityArchitectureFlowSchema
>
export type CodeCitySceneModel = z.infer<typeof codeCitySceneModelSchema>
