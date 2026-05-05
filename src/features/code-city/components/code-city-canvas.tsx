import {
  type ElementRef,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import {
  Billboard,
  ContactShadows,
  Edges,
  OrbitControls,
  QuadraticBezierLine,
  RoundedBox,
  Text,
} from '@react-three/drei'
import * as THREE from 'three'
import type {
  CodeCityArc,
  CodeCityArchitectureNode,
  CodeCityBoundary,
  CodeCityBuilding,
  CodeCityDistrict,
  CodeCitySceneModel,
  CodeCityZone,
} from '../schema'
import {
  CODE_CITY_ZONE_PAD_HEIGHT,
  CODE_CITY_DISTRICT_TERRACE_CAP_HEIGHT,
  getBuildingRenderBaseYById,
  getBoundaryGroundLevels,
  getBuildingById,
  getCodeCitySceneFrame,
  getCodeCityZoomTier,
  getDistrictTerrain,
  getFolderLabelOpacity,
  getLabelOpacity,
  getPlotCentre,
  getSceneBuildings,
  getZoneSurfaceCentreY,
  getZoneSurfaceTopY,
  isCodeCityArcVisible,
  resolveCodeCityCameraPreset,
} from '../scene-utils'
import type { CodeCityCameraFocus } from '../store'
import type { CodeCitySceneFrame } from '../scene-utils'
import { scheduleIdleTask } from '../idle'

type CodeCityCanvasProps = {
  scene: CodeCitySceneModel
  selectedBuildingId: string | null
  showLabels: boolean
  showTests: boolean
  showBase: boolean
  showZones: boolean
  showFolders: boolean
  showBuildings: boolean
  showFloors: boolean
  showProps: boolean
  showOverlays: boolean
  cameraFocus: CodeCityCameraFocus | null
  zoomDistance: number
  onSelectBuilding: (buildingId: string | null) => void
  onInspectBuilding: (buildingId: string) => void
  onCameraControlStart: () => void
  onZoomDistanceChange: (distance: number) => void
}

const TRON_BACKGROUND = '#030812'
const TRON_SURFACE = '#0A1424'
const TRON_WATER = '#062A3C'
const TRON_GRID = '#123D59'
const TRON_GRID_MAJOR = '#1CF4FF'
const TRON_CYAN = '#52F6FF'
const TRON_BLUE = '#2D8CFF'
const TRON_MINT = '#50FFC2'
const TRON_LABEL = '#DDFDFF'
const TRON_WARNING = '#FF4F7B'
const TRON_GROUP = '#7DDDE8'
const BUILDING_FOUNDATION_SURFACE_GAP = 0.2
const BUILDING_FOUNDATION_HEIGHT = 0.42
const BUILDING_FLOOR_GAP_ABOVE_FOUNDATION = 0.22
const BUILDING_BASE_CLEARANCE =
  BUILDING_FOUNDATION_SURFACE_GAP +
  BUILDING_FOUNDATION_HEIGHT +
  BUILDING_FLOOR_GAP_ABOVE_FOUNDATION
const BUILDING_FLOOR_GAP = 0.14
const BUILDING_MIN_RENDERED_FLOOR_HEIGHT = 0.5
const CAMERA_MIN_DISTANCE = 6
const MIN_CAMERA_MAX_DISTANCE = 340
const LARGE_SCENE_BUILDING_THRESHOLD = 360
const PROGRESSIVE_INITIAL_BUILDING_BUDGET = 220
const PROGRESSIVE_RENDER_CHUNK_SIZE = 120
const PROGRESSIVE_RENDER_IDLE_TIMEOUT_MS = 120
const ZOOM_DISTANCE_REPORT_INTERVAL_MS = 180
const ZOOM_DISTANCE_REPORT_MIN_DELTA = 10

function zoneTint(zoneType: CodeCityZone['zoneType']) {
  switch (zoneType) {
    case 'core':
      return '#103451'
    case 'application':
      return '#113E3A'
    case 'ports':
      return '#102C46'
    case 'periphery':
      return '#17273A'
    case 'edge':
      return '#20243A'
    case 'module':
      return '#103A40'
    case 'stage':
      return '#132E4B'
    case 'shared':
      return '#332B57'
    case 'test':
      return '#222A37'
    case 'chaos':
      return '#3B1F33'
  }
}

function arcColour(scene: CodeCitySceneModel, arc: CodeCityArc) {
  if (arc.architecture?.kind === 'flow') {
    return TRON_MINT
  }

  if (arc.arcType === 'violation') {
    return scene.config.colours.violationArc
  }

  if (arc.arcType === 'cross-boundary') {
    return arc.strength >= 0.8 ? '#FFB14A' : TRON_BLUE
  }

  return TRON_CYAN
}

function getBuildingFloorRenderLayout(building: CodeCityBuilding) {
  const floorCount = building.floors.length
  const totalGap = BUILDING_FLOOR_GAP * Math.max(0, floorCount - 1)
  const minimumFloorStackHeight =
    floorCount * BUILDING_MIN_RENDERED_FLOOR_HEIGHT + totalGap
  const stackHeight = Math.max(building.height, minimumFloorStackHeight)
  const availableFloorHeight = Math.max(
    BUILDING_MIN_RENDERED_FLOOR_HEIGHT * floorCount,
    stackHeight - totalGap,
  )
  const weights = building.floors.map((floor) => Math.max(0.001, floor.height))
  const totalWeight = weights.reduce((total, weight) => total + weight, 0)
  const extraHeight = Math.max(
    0,
    availableFloorHeight - floorCount * BUILDING_MIN_RENDERED_FLOOR_HEIGHT,
  )
  let cursorY = BUILDING_BASE_CLEARANCE

  return {
    stackHeight,
    floors: building.floors.map((floor, index) => {
      const floorHeight =
        BUILDING_MIN_RENDERED_FLOOR_HEIGHT +
        (extraHeight * weights[index]) / totalWeight
      const positionY = cursorY + floorHeight / 2
      cursorY += floorHeight + BUILDING_FLOOR_GAP

      return {
        floor,
        floorHeight,
        positionY,
      }
    }),
  }
}

function getBuildingRenderedStackHeight(building: CodeCityBuilding) {
  const floorCount = building.floors.length
  const totalGap = BUILDING_FLOOR_GAP * Math.max(0, floorCount - 1)

  return Math.max(
    building.height,
    floorCount * BUILDING_MIN_RENDERED_FLOOR_HEIGHT + totalGap,
  )
}

function getBuildingRenderedTopY(
  building: CodeCityBuilding,
  showFloors = true,
) {
  return (
    BUILDING_BASE_CLEARANCE +
    (showFloors
      ? getBuildingRenderedStackHeight(building)
      : BUILDING_FOUNDATION_HEIGHT)
  )
}

type ArchitectureOverlayRegion = {
  id: string
  label: string
  regionKind: 'container' | 'component'
  minX: number
  maxX: number
  minZ: number
  maxZ: number
  surfaceY: number
  buildingCount: number
}

function stringProperty(value: unknown, key: string) {
  if (typeof value !== 'object' || value == null || !(key in value)) {
    return null
  }

  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'string' && field.trim().length > 0 ? field : null
}

function isDisplayArchitectureComponent(component: CodeCityArchitectureNode) {
  const componentKind = stringProperty(component.properties, 'component_kind')
  const path = component.path ?? ''

  return (
    component.asserted ||
    component.confidence >= 0.7 ||
    componentKind === 'workspace_package' ||
    /^crates\/[^/]+$/u.test(path) ||
    /^(apps|packages|libs|services)\/[^/]+$/u.test(path)
  )
}

function createRectangleOutlineGeometry(width: number, depth: number) {
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const positions = [
    -halfWidth,
    0,
    -halfDepth,
    halfWidth,
    0,
    -halfDepth,
    halfWidth,
    0,
    -halfDepth,
    halfWidth,
    0,
    halfDepth,
    halfWidth,
    0,
    halfDepth,
    -halfWidth,
    0,
    halfDepth,
    -halfWidth,
    0,
    halfDepth,
    -halfWidth,
    0,
    -halfDepth,
  ]
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )

  return geometry
}

function supportsWebGL() {
  if (typeof document === 'undefined') {
    return false
  }

  const canvas = document.createElement('canvas')
  return Boolean(
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl'),
  )
}

function clipDistrictByBuildingBudget(
  district: CodeCityDistrict,
  budget: {
    remaining: number
  },
  pinnedBuildingIds: Set<string>,
): CodeCityDistrict | null {
  const children: CodeCityDistrict['children'] = []

  for (const child of district.children) {
    if (child.nodeType === 'building') {
      const pinned = pinnedBuildingIds.has(child.id)
      if (budget.remaining <= 0 && !pinned) {
        continue
      }

      if (!pinned) {
        budget.remaining -= 1
      }
      children.push(child)
      continue
    }

    const clippedDistrict = clipDistrictByBuildingBudget(
      child,
      budget,
      pinnedBuildingIds,
    )
    if (clippedDistrict != null) {
      children.push(clippedDistrict)
    }
  }

  if (children.length === 0) {
    return null
  }

  return children.length === district.children.length
    ? district
    : {
        ...district,
        children,
      }
}

function clipBoundariesByBuildingBudget(
  boundaries: CodeCityBoundary[],
  renderBudget: number,
  pinnedBuildingIds: Set<string>,
) {
  if (!Number.isFinite(renderBudget)) {
    return boundaries
  }

  const budget = {
    remaining: Math.max(0, Math.floor(renderBudget)),
  }

  return boundaries.map((boundary) => ({
    ...boundary,
    zones: boundary.zones.map((zone) => ({
      ...zone,
      districts: zone.districts
        .map((district) =>
          clipDistrictByBuildingBudget(district, budget, pinnedBuildingIds),
        )
        .filter((district): district is CodeCityDistrict => district != null),
    })),
  }))
}

function bevelRadius(width: number, depth: number, max = 0.22) {
  return Math.min(max, Math.max(0.04, Math.min(width, depth) * 0.08))
}

function floorEdgeColour(
  floor: CodeCityBuilding['floors'][number],
  selected: boolean,
  hovered: boolean,
) {
  if (selected || hovered) {
    return TRON_LABEL
  }

  if (floor.insufficientData) {
    return '#A7B1C2'
  }

  if (floor.healthRisk >= 0.7) {
    return TRON_WARNING
  }

  if (floor.healthRisk <= 0.38) {
    return TRON_MINT
  }

  return TRON_CYAN
}

function BoundaryGround({ boundary }: { boundary: CodeCityBoundary }) {
  const tint = boundary.ground.tint
  const { centre } = boundary.ground
  const levels = getBoundaryGroundLevels(boundary)

  if (boundary.ground.kind === 'disc') {
    return (
      <group position={[centre.x, 0, centre.z]}>
        <mesh receiveShadow position={[0, levels.waterCentreY, 0]}>
          <cylinderGeometry
            args={[
              boundary.ground.radius! + boundary.ground.waterInset,
              boundary.ground.radius! + boundary.ground.waterInset,
              levels.waterHeight,
              64,
            ]}
          />
          <meshStandardMaterial
            color={TRON_WATER}
            emissive='#06445B'
            emissiveIntensity={0.3}
            metalness={0.08}
            roughness={0.62}
            transparent
            opacity={0.62}
            depthWrite={false}
          />
          <Edges color='#0C85A8' threshold={14} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, levels.plinthCentreY, 0]}>
          <cylinderGeometry
            args={[
              boundary.ground.radius!,
              boundary.ground.radius!,
              levels.plinthHeight,
              64,
            ]}
          />
          <meshStandardMaterial
            color={TRON_SURFACE}
            emissive={tint}
            emissiveIntensity={0.04}
            metalness={0.08}
            roughness={0.7}
            transparent={false}
            opacity={1}
          />
          <Edges color='#176684' threshold={14} />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[centre.x, 0, centre.z]}>
      <RoundedBox
        args={[
          boundary.ground.width! + boundary.ground.waterInset * 2,
          levels.waterHeight,
          boundary.ground.depth! + boundary.ground.waterInset * 2,
        ]}
        radius={1.8}
        smoothness={6}
        receiveShadow
        position={[0, levels.waterCentreY, 0]}
      >
        <meshStandardMaterial
          color={TRON_WATER}
          emissive='#06445B'
          emissiveIntensity={0.3}
          metalness={0.08}
          roughness={0.62}
          transparent
          opacity={0.62}
          depthWrite={false}
        />
        <Edges color='#0C85A8' threshold={14} />
      </RoundedBox>
      <RoundedBox
        args={[
          boundary.ground.width!,
          levels.plinthHeight,
          boundary.ground.depth!,
        ]}
        radius={1.35}
        smoothness={8}
        castShadow
        receiveShadow
        position={[0, levels.plinthCentreY, 0]}
      >
        <meshStandardMaterial
          color={TRON_SURFACE}
          emissive={tint}
          emissiveIntensity={0.04}
          metalness={0.08}
          roughness={0.7}
          transparent={false}
          opacity={1}
        />
        <Edges color='#176684' threshold={14} />
      </RoundedBox>
    </group>
  )
}

function BoundaryGroupFrame({ boundary }: { boundary: CodeCityBoundary }) {
  const width = boundary.ground.width ?? 1
  const depth = boundary.ground.depth ?? 1
  const insetWidth = Math.max(0.1, width - 1.2)
  const insetDepth = Math.max(0.1, depth - 1.2)
  const y = 0.14 + (boundary.hierarchyDepth ?? 0) * 0.04
  const geometry = useMemo(
    () => createRectangleOutlineGeometry(width, depth),
    [depth, width],
  )
  const insetGeometry = useMemo(
    () => createRectangleOutlineGeometry(insetWidth, insetDepth),
    [insetDepth, insetWidth],
  )

  return (
    <group position={[boundary.ground.centre.x, y, boundary.ground.centre.z]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={TRON_GROUP}
          transparent
          opacity={0.72}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </lineSegments>
      <lineSegments geometry={insetGeometry}>
        <lineBasicMaterial
          color={TRON_BLUE}
          transparent
          opacity={0.28}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}

function ZonePad({
  width,
  depth,
  tint,
  opacity,
}: {
  width: number
  depth: number
  tint: string
  opacity: number
}) {
  return (
    <RoundedBox
      args={[width, CODE_CITY_ZONE_PAD_HEIGHT, depth]}
      radius={bevelRadius(width, depth, 0.7)}
      smoothness={5}
      receiveShadow
    >
      <meshStandardMaterial
        color={tint}
        emissive={tint}
        emissiveIntensity={0.06}
        transparent
        opacity={opacity * 0.28}
        roughness={0.78}
        metalness={0.08}
      />
      <Edges color='#1B5B79' threshold={14} />
    </RoundedBox>
  )
}

function ZoneSurface({
  boundary,
  zone,
}: {
  boundary: CodeCityBoundary
  zone: CodeCityZone
}) {
  const tint = zoneTint(zone.zoneType)
  const opacity = zone.zoneType === 'test' ? 0.42 : 0.54
  const surfaceCentreY = getZoneSurfaceCentreY(boundary)

  if (zone.shape.kind === 'ring') {
    return (
      <mesh
        position={[zone.shape.centre.x, surfaceCentreY, zone.shape.centre.z]}
        receiveShadow
      >
        <cylinderGeometry
          args={[
            zone.shape.radius!,
            zone.shape.radius!,
            CODE_CITY_ZONE_PAD_HEIGHT,
            48,
          ]}
        />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={0.05}
          transparent
          opacity={opacity * 0.28}
          roughness={0.78}
          metalness={0.08}
        />
        <Edges color={TRON_BLUE} threshold={14} />
      </mesh>
    )
  }

  if (
    zone.shape.kind === 'island' ||
    zone.shape.kind === 'plaza' ||
    zone.shape.kind === 'chaos'
  ) {
    return (
      <mesh
        position={[zone.shape.centre.x, surfaceCentreY, zone.shape.centre.z]}
        receiveShadow
      >
        <cylinderGeometry
          args={[
            zone.shape.radius!,
            zone.shape.radius!,
            CODE_CITY_ZONE_PAD_HEIGHT,
            40,
          ]}
        />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={0.05}
          transparent
          opacity={opacity * 0.3}
          roughness={0.78}
          metalness={0.08}
        />
        <Edges color={TRON_CYAN} threshold={14} />
      </mesh>
    )
  }

  return (
    <group
      position={[zone.shape.centre.x, surfaceCentreY, zone.shape.centre.z]}
      rotation={[0, zone.shape.rotation, 0]}
    >
      <ZonePad
        width={zone.shape.width!}
        depth={zone.shape.depth!}
        tint={tint}
        opacity={opacity}
      />
    </group>
  )
}

function getDistrictLabelPosition(
  district: CodeCityDistrict,
  surfaceTopY: number,
): [number, number, number] {
  const centre = getPlotCentre(district.plot)
  const isTopLevel = district.depth === 0

  return isTopLevel
    ? [
        centre.x,
        surfaceTopY + 2.35,
        district.plot.z + Math.min(2.2, district.plot.depth * 0.18),
      ]
    : [centre.x, surfaceTopY + 1.55 + district.depth * 0.24, centre.z]
}

function DistrictTerrace({
  district,
  parentSurfaceY,
  surfaceTopY,
}: {
  district: CodeCityDistrict
  parentSurfaceY: number
  surfaceTopY: number
}) {
  const centre = getPlotCentre(district.plot)
  const contourY = surfaceTopY + CODE_CITY_DISTRICT_TERRACE_CAP_HEIGHT * 0.25
  const isTopLevel = district.depth === 0
  const edgeColour = isTopLevel ? TRON_CYAN : TRON_BLUE
  const geometry = useMemo(
    () =>
      createRectangleOutlineGeometry(district.plot.width, district.plot.depth),
    [district.plot.depth, district.plot.width],
  )
  const innerGeometry = useMemo(
    () =>
      createRectangleOutlineGeometry(
        Math.max(0.1, district.plot.width - 0.58),
        Math.max(0.1, district.plot.depth - 0.58),
      ),
    [district.plot.depth, district.plot.width],
  )
  const parentContourGeometry = useMemo(
    () =>
      createRectangleOutlineGeometry(
        Math.max(0.1, district.plot.width - 0.18),
        Math.max(0.1, district.plot.depth - 0.18),
      ),
    [district.plot.depth, district.plot.width],
  )

  return (
    <group position={[centre.x, contourY, centre.z]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={edgeColour}
          transparent
          opacity={isTopLevel ? 0.82 : 0.56}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      {isTopLevel && (
        <lineSegments geometry={innerGeometry}>
          <lineBasicMaterial
            color={edgeColour}
            transparent
            opacity={0.28}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>
      )}
      <lineSegments
        geometry={parentContourGeometry}
        position={[0, parentSurfaceY - contourY + 0.03, 0]}
      >
        <lineBasicMaterial
          color={edgeColour}
          transparent
          opacity={0.16}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}

function FolderAnchor({
  district,
  surfaceTopY,
}: {
  district: CodeCityDistrict
  surfaceTopY: number
}) {
  const [x, , z] = getDistrictLabelPosition(district, surfaceTopY)
  const isTopLevel = district.depth === 0
  const colour = isTopLevel ? TRON_CYAN : TRON_BLUE
  const radius = isTopLevel ? 0.62 : 0.42
  const y = surfaceTopY + 0.28

  return (
    <group position={[x, y, z]} rotation={[0, Math.PI / 6, 0]}>
      <mesh>
        <cylinderGeometry args={[radius, radius, 0.06, 6]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={isTopLevel ? 0.58 : 0.38}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.48, 0]}>
        <cylinderGeometry args={[0.022, 0.022, 0.9, 6]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={isTopLevel ? 0.52 : 0.34}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function DistrictLabel({
  district,
  scene,
  zoomDistance,
  surfaceTopY,
}: {
  district: CodeCityDistrict
  scene: CodeCitySceneModel
  zoomDistance: number
  surfaceTopY: number
}) {
  const opacity = getFolderLabelOpacity(district.depth, zoomDistance, scene)
  if (opacity <= 0.05) {
    return null
  }

  const isTopLevel = district.depth === 0
  const labelPosition = getDistrictLabelPosition(district, surfaceTopY)

  return (
    <Billboard position={labelPosition}>
      <Text
        fontSize={isTopLevel ? 1.3 : 0.95}
        color={isTopLevel ? TRON_LABEL : '#B9F8FF'}
        anchorX='center'
        anchorY='bottom'
        maxWidth={Math.max(7, Math.min(13, district.plot.width * 0.72))}
        textAlign='center'
        outlineWidth={isTopLevel ? 0.045 : 0.035}
        outlineColor='#020812'
        material-transparent
        material-opacity={opacity}
        material-depthWrite={false}
        material-depthTest={false}
      >
        {district.label}
      </Text>
    </Billboard>
  )
}

function ZoneLabel({
  boundary,
  zone,
  scene,
  zoomDistance,
}: {
  boundary: CodeCityBoundary
  zone: CodeCityZone
  scene: CodeCitySceneModel
  zoomDistance: number
}) {
  const opacity = getLabelOpacity('zone', zoomDistance, scene)
  if (opacity <= 0.05) {
    return null
  }

  return (
    <Text
      position={[
        zone.shape.centre.x,
        getZoneSurfaceTopY(boundary) + 0.42,
        zone.shape.centre.z,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={1.45}
      color='#7DDDE8'
      anchorX='center'
      anchorY='middle'
      material-transparent
      material-opacity={opacity * 0.46}
      material-depthWrite={false}
      material-depthTest={false}
      outlineWidth={0.04}
      outlineColor='#020812'
    >
      {zone.name}
    </Text>
  )
}

function BoundaryLabel({
  boundary,
  scene,
  zoomDistance,
}: {
  boundary: CodeCityBoundary
  scene: CodeCitySceneModel
  zoomDistance: number
}) {
  const opacity = getLabelOpacity('boundary', zoomDistance, scene)
  if (opacity <= 0.05) {
    return null
  }

  return (
    <Text
      position={[
        boundary.labelAnchor.x,
        boundary.labelAnchor.y,
        boundary.labelAnchor.z,
      ]}
      fontSize={boundary.boundaryRole === 'group' ? 2.8 : 4.2}
      color={boundary.boundaryRole === 'group' ? TRON_GROUP : TRON_LABEL}
      anchorX='center'
      anchorY='middle'
      material-transparent
      material-opacity={
        boundary.boundaryRole === 'group' ? opacity * 0.72 : opacity
      }
      material-depthWrite={false}
      outlineWidth={boundary.boundaryRole === 'group' ? 0.045 : 0.06}
      outlineColor='#020812'
    >
      {boundary.name}
    </Text>
  )
}

function SelectionMarker({
  width,
  depth,
  height,
  label,
}: {
  width: number
  depth: number
  height: number
  label: string
}) {
  const baseRef = useRef<THREE.MeshBasicMaterial>(null)
  const cornerX = width / 2 + 0.24
  const cornerZ = depth / 2 + 0.24
  const postHeight = height + 0.85
  const railY = height + 0.72

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.elapsedTime * 2.4) + 1) / 2
    if (baseRef.current != null) {
      baseRef.current.opacity = 0.2 + pulse * 0.06
    }
  })

  return (
    <group>
      <mesh position={[0, 0.09, 0]}>
        <boxGeometry args={[width + 1.1, 0.08, depth + 1.1]} />
        <meshBasicMaterial
          ref={baseRef}
          color={TRON_CYAN}
          transparent
          opacity={0.2}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[width + 0.35, 0.08, depth + 0.35]} />
        <meshBasicMaterial
          color={TRON_BLUE}
          transparent
          opacity={0.3}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>

      {[
        [-cornerX, -cornerZ],
        [cornerX, -cornerZ],
        [-cornerX, cornerZ],
        [cornerX, cornerZ],
      ].map(([x, z]) => (
        <mesh key={`${x}:${z}`} position={[x, postHeight / 2 + 0.12, z]}>
          <cylinderGeometry args={[0.045, 0.045, postHeight, 8]} />
          <meshBasicMaterial
            color={TRON_CYAN}
            transparent
            opacity={0.82}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      {[
        [0, -cornerZ, width + 0.54, 0.055],
        [0, cornerZ, width + 0.54, 0.055],
        [-cornerX, 0, 0.055, depth + 0.54],
        [cornerX, 0, 0.055, depth + 0.54],
      ].map(([x, z, railWidth, railDepth]) => (
        <mesh key={`rail:${x}:${z}`} position={[x, railY, z]}>
          <boxGeometry args={[railWidth, 0.075, railDepth]} />
          <meshBasicMaterial
            color={TRON_LABEL}
            transparent
            opacity={0.66}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      ))}

      <Billboard position={[0, height + 3.2, 0]}>
        <Text
          fontSize={0.82}
          color={TRON_LABEL}
          anchorX='center'
          anchorY='middle'
          maxWidth={10}
          textAlign='center'
          outlineWidth={0.04}
          outlineColor='#020812'
          material-transparent
          material-opacity={0.96}
          material-depthWrite={false}
        >
          {label}
        </Text>
      </Billboard>
    </group>
  )
}

function ArtefactFacePanel({
  artefactName,
  colour,
  panelWidth,
  panelHeight,
}: {
  artefactName: string
  colour: string
  panelWidth: number
  panelHeight: number
}) {
  const fontSize = Math.min(0.34, Math.max(0.2, panelHeight * 0.48))

  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[panelWidth, panelHeight]} />
        <meshBasicMaterial
          color='#04101D'
          transparent
          opacity={0.84}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, panelHeight / 2 - 0.035, 0.018]}>
        <boxGeometry args={[panelWidth, 0.045, 0.025]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.9}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[-panelWidth / 2 + 0.14, 0, 0.018]}>
        <boxGeometry args={[0.1, Math.max(0.18, panelHeight - 0.16), 0.025]} />
        <meshBasicMaterial
          color={colour}
          transparent
          opacity={0.75}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
      <Text
        position={[-panelWidth / 2 + 0.32, -0.005, 0.032]}
        fontSize={fontSize}
        color={TRON_LABEL}
        anchorX='left'
        anchorY='middle'
        maxWidth={panelWidth - 0.55}
        textAlign='left'
        outlineWidth={0.014}
        outlineColor='#020812'
        material-depthWrite={false}
      >
        {artefactName}
      </Text>
    </group>
  )
}

function FloorArtefactPanels({
  floor,
  width,
  depth,
  floorHeight,
  positionY,
}: {
  floor: CodeCityBuilding['floors'][number]
  width: number
  depth: number
  floorHeight: number
  positionY: number
}) {
  const colour = floorEdgeColour(floor, true, false)
  const panelHeight = Math.min(0.58, Math.max(0.34, floorHeight * 0.52))
  const frontBackWidth = Math.max(width + 0.55, 4.2)
  const sideWidth = Math.max(depth + 0.55, 4.2)
  const offset = 0.065

  return (
    <group position={[0, positionY, 0]}>
      <group position={[0, 0, depth / 2 + offset]}>
        <ArtefactFacePanel
          artefactName={floor.artefactName}
          colour={colour}
          panelWidth={frontBackWidth}
          panelHeight={panelHeight}
        />
      </group>
      <group position={[0, 0, -depth / 2 - offset]} rotation={[0, Math.PI, 0]}>
        <ArtefactFacePanel
          artefactName={floor.artefactName}
          colour={colour}
          panelWidth={frontBackWidth}
          panelHeight={panelHeight}
        />
      </group>
      <group
        position={[width / 2 + offset, 0, 0]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <ArtefactFacePanel
          artefactName={floor.artefactName}
          colour={colour}
          panelWidth={sideWidth}
          panelHeight={panelHeight}
        />
      </group>
      <group
        position={[-width / 2 - offset, 0, 0]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <ArtefactFacePanel
          artefactName={floor.artefactName}
          colour={colour}
          panelWidth={sideWidth}
          panelHeight={panelHeight}
        />
      </group>
    </group>
  )
}

function BuildingStack({
  building,
  scene,
  visualBaseY,
  zoomDistance,
  selected,
  hovered,
  showLabels,
  showFloors,
  onSelectBuilding,
  onInspectBuilding,
  onHoverBuilding,
}: {
  building: CodeCityBuilding
  scene: CodeCitySceneModel
  visualBaseY: number
  zoomDistance: number
  selected: boolean
  hovered: boolean
  showLabels: boolean
  showFloors: boolean
  onSelectBuilding: (buildingId: string | null) => void
  onInspectBuilding: (buildingId: string) => void
  onHoverBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
}) {
  const interactiveWidth = Math.max(0.6, building.plot.width - 0.36)
  const interactiveDepth = Math.max(0.6, building.plot.depth - 0.36)
  const buildingOpacity = building.isTest ? 0.76 : 1
  const labelOpacity = getLabelOpacity('building', zoomDistance, scene)
  const shouldShowBuildingLabel =
    showLabels &&
    (selected ||
      hovered ||
      building.importance >= 0.72 ||
      building.architecture.entryPoints.length > 0)
  const centre = getPlotCentre(building.plot)
  const highlightColour =
    selected || hovered ? TRON_CYAN : building.isTest ? '#78879D' : TRON_BLUE
  const floorLayout = getBuildingFloorRenderLayout(building)
  const visibleStackHeight = showFloors
    ? floorLayout.stackHeight
    : BUILDING_FOUNDATION_HEIGHT
  const buildingRenderedTopY = BUILDING_BASE_CLEARANCE + visibleStackHeight

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    if (!hovered) {
      onHoverBuilding(building.id, { x: event.clientX, y: event.clientY })
    }
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onHoverBuilding(null, null)
    document.body.style.cursor = ''
  }

  return (
    <group position={[centre.x, visualBaseY, centre.z]}>
      {selected && (
        <SelectionMarker
          width={interactiveWidth}
          depth={interactiveDepth}
          height={buildingRenderedTopY}
          label='Selected'
        />
      )}

      {building.architecture.entryPoints.length > 0 && (
        <group position={[0, buildingRenderedTopY + 1.15, 0]}>
          <mesh>
            <octahedronGeometry args={[0.58, 0]} />
            <meshBasicMaterial
              color='#FFB14A'
              transparent
              opacity={0.92}
              depthWrite={false}
              depthTest={false}
              toneMapped={false}
            />
          </mesh>
          {showLabels && (
            <Billboard position={[0, 1.05, 0]}>
              <Text
                fontSize={0.8}
                color='#FFE6B8'
                anchorX='center'
                anchorY='middle'
                maxWidth={8}
                textAlign='center'
                outlineWidth={0.03}
                outlineColor='#020812'
                material-depthWrite={false}
                material-depthTest={false}
              >
                {building.architecture.entryPoints[0]?.entryKind ??
                  'Entry point'}
              </Text>
            </Billboard>
          )}
        </group>
      )}

      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry
          args={[
            Math.max(building.plot.width, building.plot.depth) * 0.48,
            Math.max(building.plot.width, building.plot.depth) * 0.48,
            0.06,
            24,
          ]}
        />
        <meshStandardMaterial
          color={highlightColour}
          emissive={highlightColour}
          emissiveIntensity={selected ? 0.38 : hovered ? 0.24 : 0.12}
          transparent
          opacity={selected ? 0.64 : hovered ? 0.38 : 0.18}
        />
      </mesh>

      <RoundedBox
        position={[
          0,
          BUILDING_FOUNDATION_SURFACE_GAP + BUILDING_FOUNDATION_HEIGHT / 2,
          0,
        ]}
        args={[
          interactiveWidth + 0.18,
          BUILDING_FOUNDATION_HEIGHT,
          interactiveDepth + 0.18,
        ]}
        radius={bevelRadius(interactiveWidth, interactiveDepth, 0.12)}
        smoothness={3}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color='#07111F'
          emissive={selected || hovered ? TRON_BLUE : '#0A2033'}
          emissiveIntensity={selected ? 0.22 : hovered ? 0.16 : 0.08}
          metalness={0.1}
          roughness={0.72}
        />
        <Edges
          color={selected || hovered ? TRON_CYAN : '#1B5B79'}
          threshold={14}
        />
      </RoundedBox>

      {showFloors &&
        floorLayout.floors.map(({ floor, floorHeight, positionY }) => (
          <group key={floor.id}>
            <RoundedBox
              position={[0, positionY, 0]}
              args={[interactiveWidth, floorHeight, interactiveDepth]}
              radius={bevelRadius(interactiveWidth, interactiveDepth, 0.16)}
              smoothness={3}
              castShadow
              receiveShadow
            >
              <meshStandardMaterial
                color={building.isTest ? '#9FAAB8' : floor.colour}
                metalness={building.isTest ? 0.02 : 0.08}
                roughness={0.58}
                transparent
                opacity={buildingOpacity}
                emissive={building.isTest ? '#304057' : floor.colour}
                emissiveIntensity={selected ? 0.32 : hovered ? 0.24 : 0.16}
              />
              <Edges
                color={floorEdgeColour(floor, selected, hovered)}
                threshold={14}
              />
            </RoundedBox>
            {showLabels && selected && (
              <FloorArtefactPanels
                floor={floor}
                width={interactiveWidth}
                depth={interactiveDepth}
                floorHeight={floorHeight}
                positionY={positionY}
              />
            )}
          </group>
        ))}

      <mesh
        position={[0, BUILDING_BASE_CLEARANCE + visibleStackHeight / 2, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onSelectBuilding(building.id)
        }}
        onDoubleClick={(event) => {
          event.stopPropagation()
          onInspectBuilding(building.id)
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry
          args={[interactiveWidth, visibleStackHeight, interactiveDepth]}
        />
        <meshBasicMaterial
          transparent
          opacity={0}
          colorWrite={false}
          depthWrite={false}
        />
      </mesh>

      {shouldShowBuildingLabel && labelOpacity > 0.05 && (
        <Billboard position={[0, buildingRenderedTopY + 1.5, 0]}>
          <Text
            fontSize={1.1}
            color={TRON_LABEL}
            anchorX='center'
            anchorY='middle'
            maxWidth={9}
            textAlign='center'
            outlineWidth={0.03}
            outlineColor='#020812'
            material-transparent
            material-opacity={selected || hovered ? 1 : labelOpacity}
            material-depthWrite={false}
            material-depthTest={false}
          >
            {building.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

const MemoizedBuildingStack = memo(BuildingStack)

function collectBuildingsFromBoundaries(boundaries: CodeCityBoundary[]) {
  const buildings: CodeCityBuilding[] = []

  for (const boundary of boundaries) {
    for (const zone of boundary.zones) {
      for (const district of zone.districts) {
        const visit = (node: CodeCityDistrict) => {
          for (const child of node.children) {
            if (child.nodeType === 'building') {
              buildings.push(child)
              continue
            }

            visit(child)
          }
        }

        visit(district)
      }
    }
  }

  return buildings
}

function architectureRegionForBuildings({
  id,
  label,
  regionKind,
  buildings,
  baseYById,
}: {
  id: string
  label: string
  regionKind: ArchitectureOverlayRegion['regionKind']
  buildings: CodeCityBuilding[]
  baseYById: Map<string, number>
}): ArchitectureOverlayRegion | null {
  if (buildings.length === 0) {
    return null
  }

  const padding = regionKind === 'container' ? 1.35 : 0.72
  const minX = Math.min(...buildings.map((building) => building.plot.x))
  const maxX = Math.max(
    ...buildings.map((building) => building.plot.x + building.plot.width),
  )
  const minZ = Math.min(...buildings.map((building) => building.plot.z))
  const maxZ = Math.max(
    ...buildings.map((building) => building.plot.z + building.plot.depth),
  )
  const surfaceY =
    Math.max(
      ...buildings.map(
        (building) => baseYById.get(building.id) ?? building.plot.y,
      ),
    ) + (regionKind === 'container' ? 0.46 : 0.34)

  return {
    id,
    label,
    regionKind,
    minX: minX - padding,
    maxX: maxX + padding,
    minZ: minZ - padding,
    maxZ: maxZ + padding,
    surfaceY,
    buildingCount: buildings.length,
  }
}

function buildArchitectureOverlayRegions(
  scene: CodeCitySceneModel,
  boundaries: CodeCityBoundary[],
) {
  const buildings = collectBuildingsFromBoundaries(boundaries)
  const baseYById = getBuildingRenderBaseYById({
    ...scene,
    boundaries,
  })
  const regions: ArchitectureOverlayRegion[] = []

  for (const container of scene.architecture.containers) {
    const containerBuildings = buildings.filter((building) =>
      building.architecture.containerIds.includes(container.id),
    )
    const containerRegion = architectureRegionForBuildings({
      id: `architecture-container-outline:${container.id}`,
      label: container.label,
      regionKind: 'container',
      buildings: containerBuildings,
      baseYById,
    })

    if (containerRegion != null) {
      regions.push(containerRegion)
    }

    for (const component of container.components) {
      if (!isDisplayArchitectureComponent(component)) {
        continue
      }

      const componentBuildings = buildings.filter((building) =>
        building.architecture.componentIds.includes(component.id),
      )
      const componentRegion = architectureRegionForBuildings({
        id: `architecture-component-outline:${component.id}`,
        label: component.label,
        regionKind: 'component',
        buildings: componentBuildings,
        baseYById,
      })

      if (componentRegion != null) {
        regions.push(componentRegion)
      }
    }
  }

  return regions.sort((left, right) => {
    if (left.regionKind !== right.regionKind) {
      return left.regionKind === 'container' ? -1 : 1
    }

    return right.buildingCount - left.buildingCount
  })
}

function ArchitectureRegionOutline({
  region,
  scene,
  zoomDistance,
  showLabels,
}: {
  region: ArchitectureOverlayRegion
  scene: CodeCitySceneModel
  zoomDistance: number
  showLabels: boolean
}) {
  const width = Math.max(1, region.maxX - region.minX)
  const depth = Math.max(1, region.maxZ - region.minZ)
  const centreX = region.minX + width / 2
  const centreZ = region.minZ + depth / 2
  const geometry = useMemo(
    () => createRectangleOutlineGeometry(width, depth),
    [depth, width],
  )
  const isContainer = region.regionKind === 'container'
  const colour = isContainer ? TRON_MINT : '#FFD166'
  const opacity = isContainer ? 0.72 : 0.88
  const labelOpacity =
    showLabels && isContainer
      ? getLabelOpacity('zone', zoomDistance, scene)
      : showLabels
        ? getLabelOpacity('district', zoomDistance, scene)
        : 0

  return (
    <group position={[centreX, region.surfaceY, centreZ]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={colour}
          transparent
          opacity={opacity}
          depthWrite={false}
          depthTest={false}
          toneMapped={false}
        />
      </lineSegments>
      {labelOpacity > 0.05 && (
        <Billboard position={[0, isContainer ? 0.9 : 0.68, -depth / 2]}>
          <Text
            fontSize={isContainer ? 0.95 : 0.74}
            color={colour}
            anchorX='center'
            anchorY='bottom'
            maxWidth={Math.max(4, Math.min(14, width * 0.82))}
            textAlign='center'
            outlineWidth={0.035}
            outlineColor='#020812'
            material-transparent
            material-opacity={labelOpacity}
            material-depthWrite={false}
            material-depthTest={false}
          >
            {region.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function ArchitectureOverlayLayer({
  scene,
  boundaries,
  zoomDistance,
  showLabels,
}: {
  scene: CodeCitySceneModel
  boundaries: CodeCityBoundary[]
  zoomDistance: number
  showLabels: boolean
}) {
  const regions = useMemo(
    () => buildArchitectureOverlayRegions(scene, boundaries),
    [boundaries, scene],
  )

  if (regions.length === 0) {
    return null
  }

  return (
    <group>
      {regions.map((region) => (
        <ArchitectureRegionOutline
          key={region.id}
          region={region}
          scene={scene}
          zoomDistance={zoomDistance}
          showLabels={showLabels}
        />
      ))}
    </group>
  )
}

function DistrictContent({
  district,
  scene,
  parentSurfaceY,
  zoomDistance,
  selectedBuildingId,
  hoveredBuildingId,
  showLabels,
  showFolders,
  showBuildings,
  showFloors,
  onSelectBuilding,
  onInspectBuilding,
  onHoverBuilding,
}: {
  district: CodeCityDistrict
  scene: CodeCitySceneModel
  parentSurfaceY: number
  zoomDistance: number
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  showLabels: boolean
  showFolders: boolean
  showBuildings: boolean
  showFloors: boolean
  onSelectBuilding: (buildingId: string | null) => void
  onInspectBuilding: (buildingId: string) => void
  onHoverBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
}) {
  const terrain = getDistrictTerrain(district, parentSurfaceY)

  return (
    <>
      {showFolders && (
        <DistrictTerrace
          district={district}
          parentSurfaceY={terrain.parentSurfaceY}
          surfaceTopY={terrain.surfaceTopY}
        />
      )}
      {showFolders && (
        <FolderAnchor district={district} surfaceTopY={terrain.surfaceTopY} />
      )}
      {showLabels && showFolders && (
        <DistrictLabel
          district={district}
          scene={scene}
          zoomDistance={zoomDistance}
          surfaceTopY={terrain.surfaceTopY}
        />
      )}
      {district.children.map((child) =>
        child.nodeType === 'district' ? (
          <DistrictContent
            key={child.id}
            district={child}
            scene={scene}
            parentSurfaceY={terrain.surfaceTopY}
            zoomDistance={zoomDistance}
            selectedBuildingId={selectedBuildingId}
            hoveredBuildingId={hoveredBuildingId}
            showLabels={showLabels}
            showFolders={showFolders}
            showBuildings={showBuildings}
            showFloors={showFloors}
            onSelectBuilding={onSelectBuilding}
            onInspectBuilding={onInspectBuilding}
            onHoverBuilding={onHoverBuilding}
          />
        ) : showBuildings ? (
          <MemoizedBuildingStack
            key={child.id}
            building={child}
            scene={scene}
            visualBaseY={terrain.surfaceTopY}
            zoomDistance={zoomDistance}
            selected={selectedBuildingId === child.id}
            hovered={hoveredBuildingId === child.id}
            showLabels={showLabels}
            showFloors={showFloors}
            onSelectBuilding={onSelectBuilding}
            onInspectBuilding={onInspectBuilding}
            onHoverBuilding={onHoverBuilding}
          />
        ) : null,
      )}
    </>
  )
}

function BoundaryScene({
  boundary,
  scene,
  zoomDistance,
  selectedBuildingId,
  hoveredBuildingId,
  showLabels,
  showBase,
  showZones,
  showFolders,
  showBuildings,
  showFloors,
  onSelectBuilding,
  onInspectBuilding,
  onHoverBuilding,
}: {
  boundary: CodeCityBoundary
  scene: CodeCitySceneModel
  zoomDistance: number
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  showLabels: boolean
  showBase: boolean
  showZones: boolean
  showFolders: boolean
  showBuildings: boolean
  showFloors: boolean
  onSelectBuilding: (buildingId: string | null) => void
  onInspectBuilding: (buildingId: string) => void
  onHoverBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
}) {
  if (boundary.boundaryRole === 'group') {
    return (
      <group>
        {showBase && <BoundaryGroupFrame boundary={boundary} />}
        {showLabels && showBase && (
          <BoundaryLabel
            boundary={boundary}
            scene={scene}
            zoomDistance={zoomDistance}
          />
        )}
      </group>
    )
  }

  return (
    <group>
      {showBase && <BoundaryGround boundary={boundary} />}
      {showLabels && showBase && (
        <BoundaryLabel
          boundary={boundary}
          scene={scene}
          zoomDistance={zoomDistance}
        />
      )}
      {boundary.zones.map((zone) => (
        <group key={zone.id}>
          {showZones && <ZoneSurface boundary={boundary} zone={zone} />}
          {showLabels && showZones && (
            <ZoneLabel
              boundary={boundary}
              zone={zone}
              scene={scene}
              zoomDistance={zoomDistance}
            />
          )}
          {zone.districts.map((district) => (
            <DistrictContent
              key={district.id}
              district={district}
              scene={scene}
              parentSurfaceY={getZoneSurfaceTopY(boundary)}
              zoomDistance={zoomDistance}
              selectedBuildingId={selectedBuildingId}
              hoveredBuildingId={hoveredBuildingId}
              showLabels={showLabels}
              showFolders={showFolders}
              showBuildings={showBuildings}
              showFloors={showFloors}
              onSelectBuilding={onSelectBuilding}
              onInspectBuilding={onInspectBuilding}
              onHoverBuilding={onHoverBuilding}
            />
          ))}
        </group>
      ))}
    </group>
  )
}

function collectCircuitNodes(boundaries: CodeCityBoundary[]) {
  const nodes: Array<{
    position: THREE.Vector3
    scale: THREE.Vector3
    rotationY: number
  }> = []

  for (const boundary of boundaries) {
    if (boundary.boundaryRole === 'group') {
      continue
    }

    const hash = boundary.id.length + boundary.name.length
    const y = getBoundaryGroundLevels(boundary).plinthTopY + 0.08

    if (boundary.ground.kind === 'disc') {
      const radius = boundary.ground.radius! + boundary.ground.waterInset * 0.55
      const count = boundary.sharedLibrary.isSharedLibrary ? 10 : 16

      for (let index = 0; index < count; index += 1) {
        const angle = ((index + hash * 0.17) / count) * Math.PI * 2
        const distance = radius + (index % 2) * 0.9
        const x = boundary.ground.centre.x + Math.cos(angle) * distance
        const z = boundary.ground.centre.z + Math.sin(angle) * distance
        nodes.push({
          position: new THREE.Vector3(x, y, z),
          scale: new THREE.Vector3(0.42 + (index % 3) * 0.08, 0.08, 1.7),
          rotationY: angle,
        })
      }

      continue
    }

    const width = boundary.ground.width!
    const depth = boundary.ground.depth!
    const count = 14

    for (let index = 0; index < count; index += 1) {
      const side = index % 4
      const ratio = ((index * 17 + hash) % 100) / 100
      const xOffset =
        side < 2
          ? -width / 2 - 2 + ratio * (width + 4)
          : side === 2
            ? -width / 2 - 2
            : width / 2 + 2
      const zOffset =
        side < 2
          ? side === 0
            ? -depth / 2 - 2
            : depth / 2 + 2
          : -depth / 2 - 2 + ratio * (depth + 4)
      const x =
        boundary.ground.centre.x +
        (side < 2 ? xOffset : side === 2 ? xOffset : xOffset)
      const z = boundary.ground.centre.z + (side < 2 ? zOffset : zOffset)

      nodes.push({
        position: new THREE.Vector3(x, y, z),
        scale: new THREE.Vector3(1.4, 0.08, 0.38 + (index % 3) * 0.08),
        rotationY: side < 2 ? 0 : Math.PI / 2,
      })
    }
  }

  return nodes
}

function CircuitDetailLayer({
  boundaries,
}: {
  boundaries: CodeCityBoundary[]
}) {
  const nodes = useMemo(() => collectCircuitNodes(boundaries), [boundaries])
  const nodeRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const nodeMesh = nodeRef.current
    if (nodeMesh == null) {
      return
    }

    const nodeDummy = new THREE.Object3D()

    nodes.forEach((node, index) => {
      nodeDummy.position.copy(node.position)
      nodeDummy.rotation.set(0, node.rotationY, 0)
      nodeDummy.scale.copy(node.scale)
      nodeDummy.updateMatrix()
      nodeMesh.setMatrixAt(index, nodeDummy.matrix)
    })

    nodeMesh.instanceMatrix.needsUpdate = true
  }, [nodes])

  return (
    <instancedMesh ref={nodeRef} args={[undefined, undefined, nodes.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshBasicMaterial
        color={TRON_CYAN}
        transparent
        opacity={0.5}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

function createGridGeometry(
  size: number,
  divisions: number,
  majorEvery: number,
) {
  const positions: number[] = []
  const half = size / 2
  const step = size / divisions

  for (let index = 0; index <= divisions; index += 1) {
    if (index % majorEvery === 0) {
      continue
    }

    const offset = -half + index * step
    positions.push(-half, 0, offset, half, 0, offset)
    positions.push(offset, 0, -half, offset, 0, half)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  return geometry
}

function createMajorGridGeometry(
  size: number,
  divisions: number,
  majorEvery: number,
) {
  const positions: number[] = []
  const half = size / 2
  const step = size / divisions

  for (let index = 0; index <= divisions; index += majorEvery) {
    const offset = -half + index * step
    positions.push(-half, 0, offset, half, 0, offset)
    positions.push(offset, 0, -half, offset, 0, half)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(positions, 3),
  )
  return geometry
}

function TronGroundGrid({ frame }: { frame: CodeCitySceneFrame }) {
  const minorGrid = useMemo(
    () =>
      createGridGeometry(
        frame.groundSize,
        frame.gridDivisions,
        frame.gridMajorEvery,
      ),
    [frame.gridDivisions, frame.gridMajorEvery, frame.groundSize],
  )
  const majorGrid = useMemo(
    () =>
      createMajorGridGeometry(
        frame.groundSize,
        frame.gridDivisions,
        frame.gridMajorEvery,
      ),
    [frame.gridDivisions, frame.gridMajorEvery, frame.groundSize],
  )

  return (
    <group position={[frame.bounds.centre.x, -2.58, frame.bounds.centre.z]}>
      <lineSegments geometry={minorGrid}>
        <lineBasicMaterial
          color={TRON_GRID}
          transparent
          opacity={0.34}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <lineSegments geometry={majorGrid}>
        <lineBasicMaterial
          color={TRON_GRID_MAJOR}
          transparent
          opacity={0.32}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
    </group>
  )
}

function ArcLayer({
  scene,
  boundaries,
  selectedBuildingId,
  showFloors,
  showOverlays,
  zoomDistance,
}: {
  scene: CodeCitySceneModel
  boundaries: CodeCityBoundary[]
  selectedBuildingId: string | null
  showFloors: boolean
  showOverlays: boolean
  zoomDistance: number
}) {
  const buildingsById = useMemo(() => {
    const index = new Map<string, CodeCityBuilding>()
    for (const boundary of boundaries) {
      for (const zone of boundary.zones) {
        for (const district of zone.districts) {
          const visit = (node: CodeCityDistrict) => {
            for (const child of node.children) {
              if (child.nodeType === 'building') {
                index.set(child.id, child)
                continue
              }

              visit(child)
            }
          }

          visit(district)
        }
      }
    }
    return index
  }, [boundaries])
  const buildingBaseYById = useMemo(
    () => getBuildingRenderBaseYById(scene),
    [scene],
  )

  return (
    <group>
      {scene.arcs
        .filter((arc) =>
          isCodeCityArcVisible(arc, {
            selectedBuildingId,
            showOverlays,
            zoomDistance,
          }),
        )
        .map((arc) => {
          const fromBuilding = buildingsById.get(arc.fromId)
          const toBuilding = buildingsById.get(arc.toId)

          if (fromBuilding == null || toBuilding == null) {
            return null
          }

          const start = getPlotCentre(fromBuilding.plot)
          const end = getPlotCentre(toBuilding.plot)
          const fromBaseY =
            buildingBaseYById.get(fromBuilding.id) ?? fromBuilding.plot.y
          const toBaseY =
            buildingBaseYById.get(toBuilding.id) ?? toBuilding.plot.y
          const fromTopY = getBuildingRenderedTopY(fromBuilding, showFloors)
          const toTopY = getBuildingRenderedTopY(toBuilding, showFloors)
          const verticalBoost =
            10 + Math.max(fromTopY, toTopY) * 0.4 + arc.strength * 18

          return (
            <QuadraticBezierLine
              key={arc.id}
              start={[start.x, fromBaseY + fromTopY + 0.8, start.z]}
              end={[end.x, toBaseY + toTopY + 0.8, end.z]}
              mid={[
                (start.x + end.x) / 2,
                Math.max(fromBaseY, toBaseY) + verticalBoost,
                (start.z + end.z) / 2,
              ]}
              color={arcColour(scene, arc)}
              lineWidth={
                arc.architecture?.kind === 'flow'
                  ? 1.7
                  : arc.arcType === 'cross-boundary'
                    ? 3.2
                    : 2.2
              }
              transparent
              opacity={
                arc.architecture?.kind === 'flow'
                  ? 0.58
                  : arc.arcType === 'violation'
                    ? 0.96
                    : 0.84
              }
            />
          )
        })}
    </group>
  )
}

function CameraDirector({
  scene,
  focus,
  frame,
  onCameraControlStart,
  onZoomDistanceChange,
}: {
  scene: CodeCitySceneModel
  focus: CodeCityCameraFocus | null
  frame: CodeCitySceneFrame
  onCameraControlStart: () => void
  onZoomDistanceChange: (distance: number) => void
}) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)
  const desiredPosition = useRef(new THREE.Vector3())
  const desiredTarget = useRef(new THREE.Vector3())
  const activeFlightSequence = useRef<number | null>(null)
  const lastReportedZoomDistance = useRef<number | null>(null)
  const lastReportedZoomTier = useRef<string | null>(null)
  const lastZoomReportAt = useRef(0)
  const initialisedSceneId = useRef<string | null>(null)
  const { camera, gl } = useThree()

  useEffect(() => {
    gl.setClearColor(TRON_BACKGROUND)
  }, [gl])

  useEffect(() => {
    // Three.js camera instances are mutable external objects; keep the projection range in sync with the scene frame.
    // eslint-disable-next-line react-hooks/immutability
    camera.far = frame.cameraFar
    camera.updateProjectionMatrix()
  }, [camera, frame.cameraFar])

  useEffect(() => {
    if (initialisedSceneId.current === scene.id) {
      return
    }

    initialisedSceneId.current = scene.id
    const initialPreset = resolveCodeCityCameraPreset(scene, null)
    const initialPosition = focus?.position ?? [
      initialPreset?.position.x ?? 0,
      initialPreset?.position.y ?? 140,
      initialPreset?.position.z ?? 140,
    ]
    const initialTarget = focus?.target ?? [
      initialPreset?.target.x ?? 0,
      initialPreset?.target.y ?? 0,
      initialPreset?.target.z ?? 0,
    ]

    camera.position.set(...initialPosition)
    desiredPosition.current.set(...initialPosition)
    desiredTarget.current.set(...initialTarget)

    if (controlsRef.current != null) {
      controlsRef.current.target.set(...initialTarget)
      controlsRef.current.update()
      lastReportedZoomDistance.current = camera.position.distanceTo(
        controlsRef.current.target,
      )
      lastReportedZoomTier.current = getCodeCityZoomTier(
        lastReportedZoomDistance.current,
        scene,
      )
      lastZoomReportAt.current = performance.now()
      onZoomDistanceChange(lastReportedZoomDistance.current)
    }
  }, [camera, focus?.position, focus?.target, onZoomDistanceChange, scene])

  useEffect(() => {
    if (focus == null) {
      activeFlightSequence.current = null
      return
    }

    desiredPosition.current.set(...focus.position)
    desiredTarget.current.set(...focus.target)
    activeFlightSequence.current = focus.sequence
  }, [focus])

  useFrame(() => {
    const controls = controlsRef.current
    if (controls == null) {
      return
    }

    if (activeFlightSequence.current != null) {
      camera.position.lerp(desiredPosition.current, 0.085)
      controls.target.lerp(desiredTarget.current, 0.12)

      const cameraDelta = camera.position.distanceTo(desiredPosition.current)
      const targetDelta = controls.target.distanceTo(desiredTarget.current)
      if (cameraDelta < 0.08 && targetDelta < 0.08) {
        camera.position.copy(desiredPosition.current)
        controls.target.copy(desiredTarget.current)
        activeFlightSequence.current = null
      }
    }

    controls.update()

    const distance = camera.position.distanceTo(controls.target)
    const nextZoomTier = getCodeCityZoomTier(distance, scene)
    const lastDistance = lastReportedZoomDistance.current
    const now = performance.now()
    const zoomTierChanged = nextZoomTier !== lastReportedZoomTier.current
    const reportIntervalElapsed =
      now - lastZoomReportAt.current >= ZOOM_DISTANCE_REPORT_INTERVAL_MS
    const reportDistanceChanged =
      lastDistance == null ||
      Math.abs(distance - lastDistance) >= ZOOM_DISTANCE_REPORT_MIN_DELTA

    if (zoomTierChanged || (reportIntervalElapsed && reportDistanceChanged)) {
      lastReportedZoomDistance.current = distance
      lastReportedZoomTier.current = nextZoomTier
      lastZoomReportAt.current = now
      onZoomDistanceChange(distance)
    }
  })

  const handleControlStart = () => {
    activeFlightSequence.current = null
    onCameraControlStart()
  }

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      minDistance={CAMERA_MIN_DISTANCE}
      maxDistance={Math.max(MIN_CAMERA_MAX_DISTANCE, frame.cameraMaxDistance)}
      zoomSpeed={1.2}
      maxPolarAngle={Math.PI / 2.04}
      onStart={handleControlStart}
    />
  )
}

function SceneContents({
  scene,
  selectedBuildingId,
  hoveredBuildingId,
  showLabels,
  showTests,
  showBase,
  showZones,
  showFolders,
  showBuildings,
  showFloors,
  showProps,
  showOverlays,
  zoomDistance,
  frame,
  renderBudget,
  onSelectBuilding,
  onInspectBuilding,
  onHoverBuilding,
}: Omit<
  CodeCityCanvasProps,
  'cameraFocus' | 'onCameraControlStart' | 'onZoomDistanceChange'
> & {
  frame: CodeCitySceneFrame
  hoveredBuildingId: string | null
  renderBudget: number
  onHoverBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
}) {
  const visibleBoundaries = useMemo(() => {
    const filteredBoundaries = scene.boundaries.map((boundary) => ({
      ...boundary,
      zones: boundary.zones.filter((zone) =>
        showTests ? true : zone.zoneType !== 'test',
      ),
    }))
    filteredBoundaries.sort((left, right) => {
      const leftRole = left.boundaryRole ?? 'leaf'
      const rightRole = right.boundaryRole ?? 'leaf'

      if (leftRole !== rightRole) {
        return leftRole === 'group' ? -1 : 1
      }

      return (
        (left.hierarchyDepth ?? 0) - (right.hierarchyDepth ?? 0) ||
        left.name.localeCompare(right.name)
      )
    })
    const pinnedBuildingIds = new Set(
      [selectedBuildingId, hoveredBuildingId].filter(
        (buildingId): buildingId is string => buildingId != null,
      ),
    )

    return clipBoundariesByBuildingBudget(
      filteredBoundaries,
      renderBudget,
      pinnedBuildingIds,
    )
  }, [
    hoveredBuildingId,
    renderBudget,
    scene.boundaries,
    selectedBuildingId,
    showTests,
  ])

  return (
    <>
      <ambientLight intensity={0.38} />
      <hemisphereLight intensity={0.34} color='#D5FCFF' groundColor='#06101D' />
      <directionalLight
        position={[120, 160, 60]}
        intensity={0.86}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-bias={-0.00008}
        shadow-normalBias={0.035}
      />
      <directionalLight
        position={[-90, 70, -120]}
        intensity={0.45}
        color={TRON_CYAN}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[frame.bounds.centre.x, -2.8, frame.bounds.centre.z]}
        receiveShadow
      >
        <circleGeometry args={[frame.groundRadius, 128]} />
        <meshStandardMaterial
          color='#050C16'
          emissive='#02050A'
          emissiveIntensity={0.45}
          roughness={0.98}
        />
      </mesh>
      <TronGroundGrid frame={frame} />
      {showBase && (
        <ContactShadows
          position={[frame.bounds.centre.x, -2.68, frame.bounds.centre.z]}
          opacity={0.5}
          scale={frame.shadowScale}
          blur={2.5}
          far={frame.shadowFar}
          resolution={1024}
          color='#020711'
        />
      )}
      {showProps && <CircuitDetailLayer boundaries={visibleBoundaries} />}
      {visibleBoundaries.map((boundary) => (
        <BoundaryScene
          key={boundary.id}
          boundary={boundary}
          scene={scene}
          zoomDistance={zoomDistance}
          selectedBuildingId={selectedBuildingId}
          hoveredBuildingId={hoveredBuildingId}
          showLabels={showLabels}
          showBase={showBase}
          showZones={showZones}
          showFolders={showFolders}
          showBuildings={showBuildings}
          showFloors={showFloors}
          onSelectBuilding={onSelectBuilding}
          onInspectBuilding={onInspectBuilding}
          onHoverBuilding={onHoverBuilding}
        />
      ))}
      {showOverlays && (
        <ArchitectureOverlayLayer
          scene={scene}
          boundaries={visibleBoundaries}
          zoomDistance={zoomDistance}
          showLabels={showLabels}
        />
      )}
      <ArcLayer
        scene={scene}
        boundaries={visibleBoundaries}
        selectedBuildingId={selectedBuildingId}
        showFloors={showFloors}
        showOverlays={showOverlays}
        zoomDistance={zoomDistance}
      />
    </>
  )
}

export function CodeCityCanvas({
  scene,
  selectedBuildingId,
  showLabels,
  showTests,
  showBase,
  showZones,
  showFolders,
  showBuildings,
  showFloors,
  showProps,
  showOverlays,
  cameraFocus,
  zoomDistance,
  onSelectBuilding,
  onInspectBuilding,
  onCameraControlStart,
  onZoomDistanceChange,
}: CodeCityCanvasProps) {
  const fallbackPreset = resolveCodeCityCameraPreset(scene, null)
  const webglSupported = useMemo(() => supportsWebGL(), [])
  const frame = useMemo(() => getCodeCitySceneFrame(scene), [scene])
  const totalRenderableBuildingCount = useMemo(
    () => getSceneBuildings(scene, { includeTests: showTests }).length,
    [scene, showTests],
  )
  const usesProgressiveRendering =
    totalRenderableBuildingCount > LARGE_SCENE_BUILDING_THRESHOLD
  const initialRenderBudget = usesProgressiveRendering
    ? Math.min(
        PROGRESSIVE_INITIAL_BUILDING_BUDGET,
        totalRenderableBuildingCount,
      )
    : totalRenderableBuildingCount
  const renderBudgetKey = `${scene.id}:${showTests ? 'tests' : 'no-tests'}:${totalRenderableBuildingCount}`
  const [renderBudgetState, setRenderBudgetState] = useState(() => ({
    budget: initialRenderBudget,
    key: renderBudgetKey,
  }))
  const renderBudget =
    renderBudgetState.key === renderBudgetKey
      ? renderBudgetState.budget
      : initialRenderBudget
  const [hoverState, setHoverState] = useState<{
    sceneId: string
    buildingId: string
    point: {
      x: number
      y: number
    } | null
  } | null>(null)
  const initialPosition = cameraFocus?.position ?? [
    fallbackPreset?.position.x ?? 0,
    fallbackPreset?.position.y ?? 150,
    fallbackPreset?.position.z ?? 150,
  ]
  const selectedBuilding = getBuildingById(scene, selectedBuildingId)
  const activeHoverState = hoverState?.sceneId === scene.id ? hoverState : null
  const hoveredBuildingId = activeHoverState?.buildingId ?? null
  const hoverScreenPoint = activeHoverState?.point ?? null
  const hoveredBuilding = getBuildingById(scene, hoveredBuildingId)
  const handleHoverBuilding = useCallback(
    (
      buildingId: string | null,
      point?: {
        x: number
        y: number
      } | null,
    ) => {
      setHoverState(
        buildingId == null
          ? null
          : { sceneId: scene.id, buildingId, point: point ?? null },
      )
    },
    [scene.id],
  )

  useEffect(() => {
    if (
      !usesProgressiveRendering ||
      renderBudget >= totalRenderableBuildingCount
    ) {
      return
    }

    return scheduleIdleTask(() => {
      setRenderBudgetState((currentState) => {
        const currentBudget =
          currentState.key === renderBudgetKey
            ? currentState.budget
            : initialRenderBudget

        return {
          key: renderBudgetKey,
          budget: Math.min(
            totalRenderableBuildingCount,
            currentBudget + PROGRESSIVE_RENDER_CHUNK_SIZE,
          ),
        }
      })
    }, PROGRESSIVE_RENDER_IDLE_TIMEOUT_MS)
  }, [
    initialRenderBudget,
    renderBudget,
    renderBudgetKey,
    totalRenderableBuildingCount,
    usesProgressiveRendering,
  ])

  return (
    <div
      className='relative h-[68svh] min-h-[520px] overflow-hidden rounded-[1.25rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,#10223b_0%,#06101f_44%,#02060d_100%)] shadow-[0_24px_80px_-42px_rgba(82,246,255,0.4)]'
      data-testid='code-city-scene-card'
    >
      {webglSupported ? (
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{
            position: initialPosition as [number, number, number],
            fov: 42,
            near: 0.1,
            far: frame.cameraFar,
          }}
          onPointerMissed={() => onSelectBuilding(null)}
        >
          <Suspense fallback={null}>
            <CameraDirector
              scene={scene}
              focus={cameraFocus}
              frame={frame}
              onCameraControlStart={onCameraControlStart}
              onZoomDistanceChange={onZoomDistanceChange}
            />
            <SceneContents
              scene={scene}
              selectedBuildingId={selectedBuildingId}
              hoveredBuildingId={hoveredBuildingId}
              showLabels={showLabels}
              showTests={showTests}
              showBase={showBase}
              showZones={showZones}
              showFolders={showFolders}
              showBuildings={showBuildings}
              showFloors={showFloors}
              showProps={showProps}
              showOverlays={showOverlays}
              zoomDistance={zoomDistance}
              frame={frame}
              renderBudget={renderBudget}
              onSelectBuilding={onSelectBuilding}
              onInspectBuilding={onInspectBuilding}
              onHoverBuilding={handleHoverBuilding}
            />
          </Suspense>
        </Canvas>
      ) : (
        <div className='flex h-full items-center justify-center p-6'>
          <div className='max-w-md rounded-3xl border border-white/70 bg-white/85 p-6 text-center shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/85'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
              WebGL unavailable
            </p>
            <h3 className='mt-3 text-xl font-semibold'>
              Scene preview unavailable
            </h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              This environment cannot create a WebGL context, so the guided
              controls and inspector stay available but the 3D viewport is
              disabled.
            </p>
          </div>
        </div>
      )}

      <div
        className='pointer-events-none absolute inset-0 opacity-65 mix-blend-screen'
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(82, 246, 255, 0.18), transparent 34%), linear-gradient(rgba(82, 246, 255, 0.06) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 7px',
        }}
      />

      <div className='pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4'>
        <div className='rounded-full border border-cyan-300/25 bg-slate-950/68 px-3 py-1 text-xs font-medium text-cyan-50 shadow-[0_0_24px_rgba(82,246,255,0.16)] backdrop-blur'>
          Orbit, pan, zoom, select buildings, and double-click a building for
          floor-reading mode.
        </div>
        {selectedBuilding != null && (
          <div className='rounded-full border border-cyan-300/30 bg-slate-950/72 px-3 py-1 text-xs font-medium text-cyan-50 shadow-[0_0_28px_rgba(82,246,255,0.2)] backdrop-blur'>
            Selected: {selectedBuilding.label}
          </div>
        )}
      </div>

      {hoveredBuilding != null && (
        <div
          className='pointer-events-none absolute z-20 w-64 rounded-2xl border border-cyan-300/25 bg-slate-950/88 p-3 text-sm text-cyan-50 shadow-[0_18px_45px_-18px_rgba(82,246,255,0.35)] backdrop-blur'
          style={{
            left:
              hoverScreenPoint == null
                ? 20
                : Math.min(hoverScreenPoint.x + 14, window.innerWidth - 300),
            top:
              hoverScreenPoint == null
                ? 72
                : Math.max(hoverScreenPoint.y - 24, 72),
          }}
        >
          <p className='font-semibold'>{hoveredBuilding.label}</p>
          <p className='mt-1 break-all text-xs text-cyan-100/68'>
            {hoveredBuilding.filePath}
          </p>
          <div className='mt-3 grid grid-cols-2 gap-2 text-xs'>
            <div className='rounded-xl bg-cyan-300/8 p-2'>
              <p className='text-cyan-100/68'>Importance</p>
              <p className='mt-1 font-semibold'>
                {Math.round(hoveredBuilding.importance * 100)}%
              </p>
            </div>
            <div className='rounded-xl bg-cyan-300/8 p-2'>
              <p className='text-cyan-100/68'>Risk</p>
              <p className='mt-1 font-semibold'>
                {Math.round(hoveredBuilding.healthRisk * 100)}%
              </p>
            </div>
          </div>
          {(hoveredBuilding.architecture.containerIds.length > 0 ||
            hoveredBuilding.architecture.entryPoints.length > 0) && (
            <div className='mt-2 rounded-xl bg-emerald-300/8 p-2 text-xs'>
              <p className='text-cyan-100/68'>Architecture</p>
              <p className='mt-1 font-semibold'>
                {hoveredBuilding.architecture.containerIds.length} containers ·{' '}
                {hoveredBuilding.architecture.entryPoints.length} entry points
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
