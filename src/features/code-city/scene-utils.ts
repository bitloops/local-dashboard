import type {
  CodeCityArc,
  CodeCityBoundary,
  CodeCityBuilding,
  CodeCityCameraPreset,
  CodeCityDistrict,
  CodeCityPlot,
  CodeCitySceneModel,
  CodeCityZone,
  CodeCityVector3,
} from './schema'

export type CodeCityZoomTier =
  | 'world'
  | 'boundary'
  | 'district'
  | 'building'
  | 'detail'

export type CodeCitySearchResult = {
  building: CodeCityBuilding
  score: number
  matchReason: 'label' | 'path' | 'token'
}

export type CodeCityCameraFocusTarget = {
  label: string
  position: CodeCityVector3
  target: CodeCityVector3
}

export type CodeCitySceneSummary = {
  boundaryCount: number
  buildingCount: number
  testBuildingCount: number
  highRiskCount: number
  sharedBoundaryCount: number
  architectureSystemCount: number
  architectureContainerCount: number
  architectureComponentCount: number
  architectureEntryPointCount: number
  architectureFlowCount: number
}

export type CodeCitySceneBounds = {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  width: number
  depth: number
  centre: CodeCityVector3
  tallest: number
}

export type CodeCitySceneFrame = {
  bounds: CodeCitySceneBounds
  groundRadius: number
  groundSize: number
  gridDivisions: number
  gridMajorEvery: number
  cameraMaxDistance: number
  cameraFar: number
  shadowScale: number
  shadowFar: number
}

export const CODE_CITY_ZONE_PAD_HEIGHT = 0.024
export const CODE_CITY_BOUNDARY_PLINTH_HEIGHT = 0.04
export const CODE_CITY_ZONE_SURFACE_LIFT_FROM_BOUNDARY = 0.055
export const CODE_CITY_WATER_LAYER_DROP = 0.28
export const CODE_CITY_DISTRICT_TERRACE_TOP_LIFT = 0.48
export const CODE_CITY_DISTRICT_NESTED_STEP = 0.32
export const CODE_CITY_DISTRICT_TERRACE_CAP_HEIGHT = 0.16
export const CODE_CITY_DISTRICT_TERRACE_MIN_HEIGHT = 0.12

export type CodeCityBoundaryGroundLevels = {
  plinthHeight: number
  plinthTopY: number
  plinthCentreY: number
  plinthBottomY: number
  waterTopY: number
  waterCentreY: number
  waterHeight: number
}

export type CodeCityDistrictTerrain = {
  parentSurfaceY: number
  surfaceTopY: number
  height: number
}

type CodeCityFacadeSide = {
  id: 'south' | 'north' | 'east' | 'west'
  direction: {
    x: -1 | 0 | 1
    z: -1 | 0 | 1
  }
}

const facadeSides: CodeCityFacadeSide[] = [
  { id: 'south', direction: { x: 0, z: 1 } },
  { id: 'north', direction: { x: 0, z: -1 } },
  { id: 'east', direction: { x: 1, z: 0 } },
  { id: 'west', direction: { x: -1, z: 0 } },
]

function includeRectBounds(
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    tallest: number
  },
  rect: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    topY?: number
  },
) {
  bounds.minX = Math.min(bounds.minX, rect.minX)
  bounds.maxX = Math.max(bounds.maxX, rect.maxX)
  bounds.minZ = Math.min(bounds.minZ, rect.minZ)
  bounds.maxZ = Math.max(bounds.maxZ, rect.maxZ)
  bounds.tallest = Math.max(bounds.tallest, rect.topY ?? 0)
}

function includeBoundaryBounds(
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    tallest: number
  },
  boundary: CodeCityBoundary,
) {
  const { centre, waterInset } = boundary.ground
  const plinthHeight = getBoundaryPlinthHeight(boundary)

  if (boundary.ground.kind === 'disc') {
    const radius = (boundary.ground.radius ?? 0) + waterInset
    includeRectBounds(bounds, {
      minX: centre.x - radius,
      maxX: centre.x + radius,
      minZ: centre.z - radius,
      maxZ: centre.z + radius,
      topY: centre.y + plinthHeight / 2,
    })
    return
  }

  const halfWidth = (boundary.ground.width ?? 0) / 2 + waterInset
  const halfDepth = (boundary.ground.depth ?? 0) / 2 + waterInset
  includeRectBounds(bounds, {
    minX: centre.x - halfWidth,
    maxX: centre.x + halfWidth,
    minZ: centre.z - halfDepth,
    maxZ: centre.z + halfDepth,
    topY: centre.y + plinthHeight / 2,
  })
}

export function getBoundaryPlinthHeight(boundary: CodeCityBoundary) {
  return Math.min(boundary.ground.height, CODE_CITY_BOUNDARY_PLINTH_HEIGHT)
}

function includeBuildingBounds(
  bounds: {
    minX: number
    maxX: number
    minZ: number
    maxZ: number
    tallest: number
  },
  building: CodeCityBuilding,
) {
  includeRectBounds(bounds, {
    minX: building.plot.x,
    maxX: building.plot.x + building.plot.width,
    minZ: building.plot.z,
    maxZ: building.plot.z + building.plot.depth,
    topY: building.plot.y + building.height,
  })
}

function walkDistrictChildren(
  district: CodeCityDistrict,
  visitor: (building: CodeCityBuilding, district: CodeCityDistrict) => void,
) {
  for (const child of district.children) {
    if (child.nodeType === 'building') {
      visitor(child, district)
      continue
    }

    walkDistrictChildren(child, visitor)
  }
}

export function getSceneBuildings(
  scene: CodeCitySceneModel,
  options?: {
    includeTests?: boolean
  },
) {
  const includeTests = options?.includeTests ?? true
  const buildings: CodeCityBuilding[] = []

  for (const boundary of scene.boundaries) {
    for (const zone of boundary.zones) {
      for (const district of zone.districts) {
        walkDistrictChildren(district, (building) => {
          if (!includeTests && building.isTest) {
            return
          }

          buildings.push(building)
        })
      }
    }
  }

  return buildings
}

export function getZoneContentBaseY(zone: CodeCityZone) {
  let lowest = Number.POSITIVE_INFINITY

  const visitDistrict = (district: CodeCityDistrict) => {
    lowest = Math.min(lowest, district.plot.y)

    for (const child of district.children) {
      if (child.nodeType === 'building') {
        lowest = Math.min(lowest, child.plot.y)
        continue
      }

      visitDistrict(child)
    }
  }

  for (const district of zone.districts) {
    visitDistrict(district)
  }

  return Number.isFinite(lowest) ? lowest : zone.elevation
}

export function getBoundaryContentBaseY(boundary: CodeCityBoundary) {
  const lowest = boundary.zones.reduce(
    (current, zone) => Math.min(current, getZoneContentBaseY(zone)),
    Number.POSITIVE_INFINITY,
  )

  return Number.isFinite(lowest) ? lowest : boundary.ground.centre.y
}

export function getBoundaryGroundLevels(
  boundary: CodeCityBoundary,
): CodeCityBoundaryGroundLevels {
  const plinthHeight = getBoundaryPlinthHeight(boundary)
  const plinthCentreY = boundary.ground.centre.y
  const plinthTopY = plinthCentreY + plinthHeight / 2
  const plinthBottomY = plinthCentreY - plinthHeight / 2
  const waterHeight = plinthHeight * 0.7
  const waterTopY = plinthBottomY - CODE_CITY_WATER_LAYER_DROP

  return {
    plinthHeight,
    plinthTopY,
    plinthCentreY,
    plinthBottomY,
    waterTopY,
    waterCentreY: waterTopY - waterHeight / 2,
    waterHeight,
  }
}

export function getZoneSurfaceTopY(boundary: CodeCityBoundary) {
  return (
    getBoundaryGroundLevels(boundary).plinthTopY +
    CODE_CITY_ZONE_SURFACE_LIFT_FROM_BOUNDARY
  )
}

export function getZoneSurfaceCentreY(boundary: CodeCityBoundary) {
  return getZoneSurfaceTopY(boundary) - CODE_CITY_ZONE_PAD_HEIGHT / 2
}

export function getDistrictTerrain(
  district: CodeCityDistrict,
  parentSurfaceY: number,
): CodeCityDistrictTerrain {
  const depthLift =
    CODE_CITY_DISTRICT_TERRACE_TOP_LIFT +
    district.depth * CODE_CITY_DISTRICT_NESTED_STEP
  const surfaceTopY = parentSurfaceY + depthLift
  const height = Math.max(
    CODE_CITY_DISTRICT_TERRACE_MIN_HEIGHT,
    surfaceTopY - parentSurfaceY,
  )

  return {
    parentSurfaceY,
    surfaceTopY,
    height,
  }
}

export function getBuildingRenderBaseYById(scene: CodeCitySceneModel) {
  const baseYById = new Map<string, number>()

  const visitDistrict = (
    district: CodeCityDistrict,
    parentSurfaceY: number,
  ) => {
    const terrain = getDistrictTerrain(district, parentSurfaceY)

    for (const child of district.children) {
      if (child.nodeType === 'building') {
        baseYById.set(child.id, terrain.surfaceTopY)
        continue
      }

      visitDistrict(child, terrain.surfaceTopY)
    }
  }

  for (const boundary of scene.boundaries) {
    for (const zone of boundary.zones) {
      const zoneBaseY = getZoneSurfaceTopY(boundary)
      for (const district of zone.districts) {
        visitDistrict(district, zoneBaseY)
      }
    }
  }

  return baseYById
}

export function getCodeCitySceneBounds(
  scene: CodeCitySceneModel,
): CodeCitySceneBounds {
  const bounds = {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minZ: Number.POSITIVE_INFINITY,
    maxZ: Number.NEGATIVE_INFINITY,
    tallest: 0,
  }

  for (const boundary of scene.boundaries) {
    includeBoundaryBounds(bounds, boundary)
  }

  const visualBaseYById = getBuildingRenderBaseYById(scene)
  for (const building of getSceneBuildings(scene, { includeTests: true })) {
    includeBuildingBounds(bounds, {
      ...building,
      plot: {
        ...building.plot,
        y: visualBaseYById.get(building.id) ?? building.plot.y,
      },
    })
  }

  if (
    !Number.isFinite(bounds.minX) ||
    !Number.isFinite(bounds.maxX) ||
    !Number.isFinite(bounds.minZ) ||
    !Number.isFinite(bounds.maxZ)
  ) {
    return {
      minX: -24,
      maxX: 24,
      minZ: -24,
      maxZ: 24,
      width: 48,
      depth: 48,
      centre: { x: 0, y: 0, z: 0 },
      tallest: 12,
    }
  }

  const rawWidth = Math.max(1, bounds.maxX - bounds.minX)
  const rawDepth = Math.max(1, bounds.maxZ - bounds.minZ)
  const padding = Math.max(8, Math.min(32, Math.max(rawWidth, rawDepth) * 0.08))
  const minX = bounds.minX - padding
  const maxX = bounds.maxX + padding
  const minZ = bounds.minZ - padding
  const maxZ = bounds.maxZ + padding
  const width = Math.max(24, maxX - minX)
  const depth = Math.max(24, maxZ - minZ)

  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width,
    depth,
    centre: {
      x: minX + width / 2,
      y: Math.max(0, bounds.tallest * 0.18),
      z: minZ + depth / 2,
    },
    tallest: Math.max(8, bounds.tallest),
  }
}

export function getCodeCitySceneFrame(
  scene: CodeCitySceneModel,
): CodeCitySceneFrame {
  const bounds = getCodeCitySceneBounds(scene)
  const longestSide = Math.max(bounds.width, bounds.depth, 48)
  const groundSize = Math.max(380, longestSide * 1.45)

  return {
    bounds,
    groundRadius: groundSize / 2,
    groundSize,
    gridDivisions: Math.max(64, Math.min(168, Math.round(groundSize / 5))),
    gridMajorEvery: 8,
    cameraMaxDistance: Math.max(340, longestSide * 2.4),
    cameraFar: Math.max(600, longestSide * 5, bounds.tallest * 36),
    shadowScale: Math.max(420, longestSide * 1.55),
    shadowFar: Math.max(80, bounds.tallest * 4),
  }
}

export function getBuildingById(
  scene: CodeCitySceneModel,
  buildingId: string | null,
) {
  if (buildingId == null) {
    return null
  }

  return (
    getSceneBuildings(scene, { includeTests: true }).find(
      (building) => building.id === buildingId,
    ) ?? null
  )
}

export function resolveCodeCityCameraPreset(
  scene: CodeCitySceneModel,
  presetId: string | null,
) {
  const presets = scene.cameraPresets

  if (presetId == null) {
    return presets[0] ?? null
  }

  return presets.find((preset) => preset.id === presetId) ?? presets[0] ?? null
}

export function getPlotCentre(plot: CodeCityPlot): CodeCityVector3 {
  return {
    x: plot.x + plot.width / 2,
    y: plot.y,
    z: plot.z + plot.depth / 2,
  }
}

export function createBuildingCameraFocus(
  building: CodeCityBuilding,
): CodeCityCameraFocusTarget {
  const centre = getPlotCentre(building.plot)
  const widthBias = Math.max(building.plot.width, building.plot.depth)
  const distance = 9 + widthBias * 0.82
  const height = Math.max(9, building.height * 0.72 + 5)

  return {
    label: building.label,
    position: {
      x: centre.x + distance,
      y: building.plot.y + height,
      z: centre.z + distance * 0.42,
    },
    target: {
      x: centre.x,
      y: building.plot.y + Math.min(building.height * 0.5, 12),
      z: centre.z,
    },
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function scoreFacadeSide(
  building: CodeCityBuilding,
  side: CodeCityFacadeSide,
  buildings: CodeCityBuilding[],
  distance: number,
) {
  const centre = getPlotCentre(building.plot)
  const facesX = side.direction.x !== 0
  const targetHalfAlong = facesX
    ? building.plot.width / 2
    : building.plot.depth / 2
  const targetHalfLateral = facesX
    ? building.plot.depth / 2
    : building.plot.width / 2

  return buildings.reduce((score, otherBuilding) => {
    if (otherBuilding.id === building.id) {
      return score
    }

    const otherCentre = getPlotCentre(otherBuilding.plot)
    const deltaX = otherCentre.x - centre.x
    const deltaZ = otherCentre.z - centre.z
    const along = deltaX * side.direction.x + deltaZ * side.direction.z

    if (along <= 0) {
      return score
    }

    const otherHalfAlong = facesX
      ? otherBuilding.plot.width / 2
      : otherBuilding.plot.depth / 2
    const otherHalfLateral = facesX
      ? otherBuilding.plot.depth / 2
      : otherBuilding.plot.width / 2
    const gap = along - targetHalfAlong - otherHalfAlong

    if (gap > distance) {
      return score
    }

    const lateral = Math.abs(facesX ? deltaZ : deltaX)
    const corridorHalfWidth = targetHalfLateral + otherHalfLateral + 1.4

    if (lateral > corridorHalfWidth) {
      return score
    }

    const lateralOverlap = 1 - lateral / corridorHalfWidth
    const proximity = 1 - clamp(gap / distance, 0, 1)
    const heightWeight = clamp(
      otherBuilding.height / building.height,
      0.35,
      1.6,
    )

    return score + lateralOverlap * proximity * heightWeight
  }, 0)
}

function chooseLeastBlockedFacadeSide(
  scene: CodeCitySceneModel,
  building: CodeCityBuilding,
  distance: number,
) {
  const buildings = getSceneBuildings(scene, { includeTests: true })

  return facadeSides.reduce(
    (bestSide, side) => {
      const score = scoreFacadeSide(building, side, buildings, distance)
      return score < bestSide.score ? { side, score } : bestSide
    },
    {
      side: facadeSides[0]!,
      score: Number.POSITIVE_INFINITY,
    },
  ).side
}

export function createBuildingFacadeCameraFocus(
  scene: CodeCitySceneModel,
  building: CodeCityBuilding,
): CodeCityCameraFocusTarget {
  const centre = getPlotCentre(building.plot)
  const widthBias = Math.max(building.plot.width, building.plot.depth)
  const distance = Math.max(10, building.height * 1.34, widthBias * 2.4)
  const baseY =
    getBuildingRenderBaseYById(scene).get(building.id) ?? building.plot.y
  const targetY = baseY + building.height * 0.52
  const side = chooseLeastBlockedFacadeSide(scene, building, distance)

  return {
    label: `${building.label} facade`,
    position: {
      x: centre.x + side.direction.x * distance,
      y: targetY,
      z: centre.z + side.direction.z * distance,
    },
    target: {
      x: centre.x,
      y: targetY,
      z: centre.z,
    },
  }
}

export function createPresetCameraFocus(
  preset: CodeCityCameraPreset,
): CodeCityCameraFocusTarget {
  return {
    label: preset.label,
    position: preset.position,
    target: preset.target,
  }
}

function normaliseQuery(query: string) {
  return query.trim().toLowerCase()
}

function scoreSearchHit(
  building: CodeCityBuilding,
  query: string,
): CodeCitySearchResult | null {
  const normalisedQuery = normaliseQuery(query)

  if (normalisedQuery.length === 0) {
    return null
  }

  const label = building.label.toLowerCase()
  const filePath = building.filePath.toLowerCase()
  const tokens = normalisedQuery.split(/\s+/u).filter(Boolean)

  if (label.includes(normalisedQuery)) {
    return {
      building,
      score: 400 - label.indexOf(normalisedQuery) + building.importance * 100,
      matchReason: 'label',
    }
  }

  if (filePath.includes(normalisedQuery)) {
    return {
      building,
      score: 275 - filePath.indexOf(normalisedQuery) + building.importance * 90,
      matchReason: 'path',
    }
  }

  const tokenMatches = tokens.filter(
    (token) => label.includes(token) || filePath.includes(token),
  ).length

  if (tokenMatches === 0) {
    return null
  }

  return {
    building,
    score: tokenMatches * 60 + building.importance * 85,
    matchReason: 'token',
  }
}

export function getCodeCitySearchResults(
  scene: CodeCitySceneModel,
  query: string,
  options?: {
    includeTests?: boolean
    limit?: number
  },
) {
  const limit = options?.limit ?? 6
  const buildings = getSceneBuildings(scene, {
    includeTests: options?.includeTests ?? true,
  })

  return buildings
    .map((building) => scoreSearchHit(building, query))
    .filter((result): result is CodeCitySearchResult => result != null)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

function fadeBetween(distance: number, near: number, far: number) {
  if (distance <= near) {
    return 1
  }

  if (distance >= far) {
    return 0
  }

  const progress = (distance - near) / (far - near)
  return 1 - progress
}

function fadeOutNear(distance: number, hiddenAt: number, fullAt: number) {
  if (distance <= hiddenAt) {
    return 0
  }

  if (distance >= fullAt) {
    return 1
  }

  return (distance - hiddenAt) / (fullAt - hiddenAt)
}

export function getCodeCityZoomTier(
  distance: number,
  scene: CodeCitySceneModel,
): CodeCityZoomTier {
  const { labelDistances } = scene.config

  if (distance > labelDistances.boundary) {
    return 'world'
  }

  if (distance > labelDistances.zone) {
    return 'boundary'
  }

  if (distance > labelDistances.district) {
    return 'district'
  }

  if (distance > labelDistances.building) {
    return 'building'
  }

  return 'detail'
}

export function getLabelOpacity(
  labelKind: 'boundary' | 'zone' | 'district' | 'building' | 'detail',
  distance: number,
  scene: CodeCitySceneModel,
) {
  const { labelDistances } = scene.config

  switch (labelKind) {
    case 'boundary':
      return (
        fadeBetween(distance, labelDistances.zone, labelDistances.boundary) *
        fadeOutNear(distance, labelDistances.district, labelDistances.zone)
      )
    case 'zone':
      return (
        fadeBetween(distance, labelDistances.district, labelDistances.zone) *
        fadeOutNear(distance, labelDistances.building, labelDistances.district)
      )
    case 'district':
      return (
        fadeBetween(
          distance,
          labelDistances.building,
          labelDistances.district,
        ) *
        fadeOutNear(distance, labelDistances.detail, labelDistances.building)
      )
    case 'building':
      return (
        0.82 *
        fadeBetween(distance, labelDistances.detail, labelDistances.building)
      )
    case 'detail':
      return fadeBetween(distance, 0, labelDistances.detail)
  }
}

export function getFolderLabelOpacity(
  depth: number,
  distance: number,
  scene: CodeCitySceneModel,
) {
  const { labelDistances } = scene.config

  if (depth === 0) {
    return 0.9
  }

  if (depth === 1) {
    return (
      0.78 * fadeBetween(distance, labelDistances.detail, labelDistances.zone)
    )
  }

  return (
    0.62 *
    fadeBetween(distance, labelDistances.detail * 0.65, labelDistances.building)
  )
}

export function isCodeCityArcVisible(
  arc: CodeCityArc,
  options: {
    selectedBuildingId: string | null
    showOverlays: boolean
    zoomDistance: number
  },
) {
  const { selectedBuildingId, showOverlays, zoomDistance } = options

  if (
    zoomDistance < arc.visibleAtZoom.min ||
    zoomDistance > arc.visibleAtZoom.max
  ) {
    return false
  }

  if (
    arc.visibility === 'hidden-by-default' &&
    (selectedBuildingId == null ||
      (arc.fromId !== selectedBuildingId && arc.toId !== selectedBuildingId))
  ) {
    return false
  }

  if (
    arc.visibility == null ||
    arc.visibility === 'visible-on-selection' ||
    arc.visibility === 'hidden-by-default'
  ) {
    if (
      selectedBuildingId == null ||
      (arc.fromId !== selectedBuildingId && arc.toId !== selectedBuildingId)
    ) {
      return false
    }
  }

  if (arc.arcType === 'cross-boundary') {
    return showOverlays
  }

  if (arc.arcType === 'violation') {
    return showOverlays
  }

  return true
}

export function getSceneSummary(
  scene: CodeCitySceneModel,
): CodeCitySceneSummary {
  const buildings = getSceneBuildings(scene, { includeTests: true })
  const leafBoundaries = scene.boundaries.filter(
    (boundary) => boundary.boundaryRole !== 'group',
  )

  return {
    boundaryCount: leafBoundaries.length,
    buildingCount: buildings.length,
    testBuildingCount: buildings.filter((building) => building.isTest).length,
    highRiskCount: buildings.filter((building) => building.healthRisk >= 0.7)
      .length,
    sharedBoundaryCount: leafBoundaries.filter(
      (boundary) => boundary.sharedLibrary.isSharedLibrary,
    ).length,
    architectureSystemCount: scene.architecture.systems.length,
    architectureContainerCount: scene.architecture.containers.length,
    architectureComponentCount: new Set(
      scene.architecture.containers.flatMap((container) =>
        container.components.map((component) => component.id),
      ),
    ).size,
    architectureEntryPointCount: scene.architecture.containers.reduce(
      (total, container) => total + container.entryPoints.length,
      0,
    ),
    architectureFlowCount: scene.architecture.flows.length,
  }
}
