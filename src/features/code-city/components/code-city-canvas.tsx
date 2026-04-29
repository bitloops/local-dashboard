import { type ElementRef, Suspense, useEffect, useMemo, useRef } from 'react'
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
  CodeCityBoundary,
  CodeCityBuilding,
  CodeCityDistrict,
  CodeCitySceneModel,
  CodeCityZone,
} from '../schema'
import {
  getBuildingById,
  getFolderLabelOpacity,
  getLabelOpacity,
  getPlotCentre,
  isCodeCityArcVisible,
  resolveCodeCityCameraPreset,
} from '../scene-utils'
import type { CodeCityCameraFocus } from '../store'

type CodeCityCanvasProps = {
  scene: CodeCitySceneModel
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  hoverScreenPoint: {
    x: number
    y: number
  } | null
  showLabels: boolean
  showTests: boolean
  showProps: boolean
  showOverlays: boolean
  cameraFocus: CodeCityCameraFocus | null
  zoomDistance: number
  onSelectBuilding: (buildingId: string | null) => void
  onHoverBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
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
const BUILDING_BASE_CLEARANCE = 0.18

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
  if (arc.arcType === 'violation') {
    return scene.config.colours.violationArc
  }

  if (arc.arcType === 'cross-boundary') {
    return arc.strength >= 0.8 ? '#FFB14A' : TRON_BLUE
  }

  return TRON_CYAN
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

function shapeOpacity(boundary: CodeCityBoundary) {
  return boundary.sharedLibrary.isSharedLibrary ? 0.88 : 0.96
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

  if (boundary.ground.kind === 'disc') {
    return (
      <group position={[centre.x, centre.y, centre.z]}>
        <mesh receiveShadow>
          <cylinderGeometry
            args={[
              boundary.ground.radius! + boundary.ground.waterInset,
              boundary.ground.radius! + boundary.ground.waterInset,
              boundary.ground.height * 0.7,
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
            opacity={0.9}
          />
          <Edges color='#0C85A8' threshold={14} />
        </mesh>
        <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
          <cylinderGeometry
            args={[
              boundary.ground.radius!,
              boundary.ground.radius!,
              boundary.ground.height,
              64,
            ]}
          />
          <meshStandardMaterial
            color={TRON_SURFACE}
            emissive={tint}
            emissiveIntensity={0.04}
            metalness={0.08}
            roughness={0.7}
            transparent
            opacity={shapeOpacity(boundary)}
          />
          <Edges color='#176684' threshold={14} />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[centre.x, centre.y, centre.z]}>
      <RoundedBox
        args={[
          boundary.ground.width! + boundary.ground.waterInset * 2,
          boundary.ground.height * 0.7,
          boundary.ground.depth! + boundary.ground.waterInset * 2,
        ]}
        radius={1.8}
        smoothness={6}
        receiveShadow
      >
        <meshStandardMaterial
          color={TRON_WATER}
          emissive='#06445B'
          emissiveIntensity={0.3}
          metalness={0.08}
          roughness={0.62}
          transparent
          opacity={0.9}
        />
        <Edges color='#0C85A8' threshold={14} />
      </RoundedBox>
      <RoundedBox
        args={[
          boundary.ground.width!,
          boundary.ground.height,
          boundary.ground.depth!,
        ]}
        radius={1.35}
        smoothness={8}
        castShadow
        receiveShadow
        position={[0, 0.22, 0]}
      >
        <meshStandardMaterial
          color={TRON_SURFACE}
          emissive={tint}
          emissiveIntensity={0.04}
          metalness={0.08}
          roughness={0.7}
          transparent
          opacity={shapeOpacity(boundary)}
        />
        <Edges color='#176684' threshold={14} />
      </RoundedBox>
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
      args={[width, 0.075, depth]}
      radius={bevelRadius(width, depth, 0.7)}
      smoothness={5}
      receiveShadow
    >
      <meshStandardMaterial
        color={tint}
        emissive={tint}
        emissiveIntensity={0.12}
        transparent
        opacity={opacity * 0.74}
        roughness={0.78}
        metalness={0.08}
      />
      <Edges color={TRON_CYAN} threshold={14} />
    </RoundedBox>
  )
}

function ZoneSurface({ zone }: { zone: CodeCityZone }) {
  const tint = zoneTint(zone.zoneType)
  const opacity = zone.zoneType === 'test' ? 0.7 : 0.88

  if (zone.shape.kind === 'ring') {
    return (
      <mesh
        position={[
          zone.shape.centre.x,
          zone.elevation - 0.045,
          zone.shape.centre.z,
        ]}
        receiveShadow
      >
        <cylinderGeometry
          args={[zone.shape.radius!, zone.shape.radius!, 0.075, 48]}
        />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={0.1}
          transparent
          opacity={opacity * 0.52}
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
        position={[
          zone.shape.centre.x,
          zone.elevation - 0.045,
          zone.shape.centre.z,
        ]}
        receiveShadow
      >
        <cylinderGeometry
          args={[zone.shape.radius!, zone.shape.radius!, 0.075, 40]}
        />
        <meshStandardMaterial
          color={tint}
          emissive={tint}
          emissiveIntensity={0.1}
          transparent
          opacity={opacity * 0.7}
          roughness={0.78}
          metalness={0.08}
        />
        <Edges color={TRON_CYAN} threshold={14} />
      </mesh>
    )
  }

  return (
    <group
      position={[
        zone.shape.centre.x,
        zone.elevation - 0.04,
        zone.shape.centre.z,
      ]}
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
): [number, number, number] {
  const centre = getPlotCentre(district.plot)
  const isTopLevel = district.depth === 0

  return isTopLevel
    ? [
        centre.x,
        district.plot.y + 2.1,
        district.plot.z + Math.min(2.2, district.plot.depth * 0.18),
      ]
    : [centre.x, district.plot.y + 1.55 + district.depth * 0.28, centre.z]
}

function FolderAnchor({ district }: { district: CodeCityDistrict }) {
  const [x, , z] = getDistrictLabelPosition(district)
  const isTopLevel = district.depth === 0
  const colour = isTopLevel ? TRON_CYAN : TRON_BLUE
  const radius = isTopLevel ? 0.62 : 0.42
  const y = district.plot.y + 0.16

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
}: {
  district: CodeCityDistrict
  scene: CodeCitySceneModel
  zoomDistance: number
}) {
  const opacity = getFolderLabelOpacity(district.depth, zoomDistance, scene)
  if (opacity <= 0.05) {
    return null
  }

  const isTopLevel = district.depth === 0
  const labelPosition = getDistrictLabelPosition(district)

  return (
    <Billboard position={labelPosition}>
      <Text
        fontSize={isTopLevel ? 1.3 : 0.95}
        color={isTopLevel ? TRON_LABEL : '#B9F8FF'}
        anchorX='center'
        anchorY='middle'
        maxWidth={Math.max(7, Math.min(13, district.plot.width * 0.72))}
        textAlign='center'
        outlineWidth={isTopLevel ? 0.045 : 0.035}
        outlineColor='#020812'
        material-transparent
        material-opacity={opacity}
        material-depthWrite={false}
      >
        {district.label}
      </Text>
    </Billboard>
  )
}

function ZoneLabel({
  zone,
  scene,
  zoomDistance,
}: {
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
        zone.elevation + 0.22,
        zone.shape.centre.z,
      ]}
      rotation={[-Math.PI / 2, 0, 0]}
      fontSize={2.4}
      color='#9CF7FF'
      anchorX='center'
      anchorY='middle'
      material-transparent
      material-opacity={opacity}
      material-depthWrite={false}
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
      fontSize={4.2}
      color={TRON_LABEL}
      anchorX='center'
      anchorY='middle'
      material-transparent
      material-opacity={opacity}
      material-depthWrite={false}
      outlineWidth={0.06}
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

function BuildingStack({
  building,
  scene,
  zoomDistance,
  selected,
  hovered,
  showLabels,
  onSelectBuilding,
  onHoverBuilding,
}: {
  building: CodeCityBuilding
  scene: CodeCitySceneModel
  zoomDistance: number
  selected: boolean
  hovered: boolean
  showLabels: boolean
  onSelectBuilding: (buildingId: string | null) => void
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
  const detailOpacity = getLabelOpacity('detail', zoomDistance, scene)
  const shouldShowBuildingLabel =
    showLabels && (selected || hovered || building.importance >= 0.72)
  const centre = getPlotCentre(building.plot)
  const highlightColour =
    selected || hovered ? TRON_CYAN : building.isTest ? '#78879D' : TRON_BLUE

  const handlePointerMove = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onHoverBuilding(building.id, { x: event.clientX, y: event.clientY })
    document.body.style.cursor = 'pointer'
  }

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    onHoverBuilding(null, null)
    document.body.style.cursor = ''
  }

  let floorBottom = BUILDING_BASE_CLEARANCE

  return (
    <group position={[centre.x, building.plot.y, centre.z]}>
      {selected && (
        <SelectionMarker
          width={interactiveWidth}
          depth={interactiveDepth}
          height={building.height + BUILDING_BASE_CLEARANCE}
          label='Selected'
        />
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

      {building.floors.map((floor) => {
        const gap = 0.14
        const floorHeight = Math.max(0.5, floor.height - gap * 0.35)
        const positionY = floorBottom + floorHeight / 2
        floorBottom += floor.height + gap

        return (
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
            {showLabels && selected && detailOpacity > 0.05 && (
              <Billboard
                position={[0, positionY, interactiveDepth / 2 + 1.1]}
                follow
              >
                <Text
                  fontSize={0.9}
                  color={TRON_LABEL}
                  anchorX='center'
                  anchorY='middle'
                  maxWidth={8}
                  textAlign='center'
                  outlineWidth={0.02}
                  outlineColor='#020812'
                  material-transparent
                  material-opacity={detailOpacity}
                  material-depthWrite={false}
                >
                  {floor.artefactName}
                </Text>
              </Billboard>
            )}
          </group>
        )
      })}

      <mesh
        position={[0, BUILDING_BASE_CLEARANCE + building.height / 2, 0]}
        onClick={(event) => {
          event.stopPropagation()
          onSelectBuilding(building.id)
        }}
        onPointerOver={handlePointerMove}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      >
        <boxGeometry
          args={[interactiveWidth, building.height, interactiveDepth]}
        />
        <meshBasicMaterial
          transparent
          opacity={0}
          colorWrite={false}
          depthWrite={false}
        />
      </mesh>

      {shouldShowBuildingLabel && labelOpacity > 0.05 && (
        <Billboard
          position={[0, building.height + BUILDING_BASE_CLEARANCE + 1.5, 0]}
        >
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
          >
            {building.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function DistrictContent({
  district,
  scene,
  zoomDistance,
  selectedBuildingId,
  hoveredBuildingId,
  showLabels,
  onSelectBuilding,
  onHoverBuilding,
}: {
  district: CodeCityDistrict
  scene: CodeCitySceneModel
  zoomDistance: number
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  showLabels: boolean
  onSelectBuilding: (buildingId: string | null) => void
  onHoverBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
}) {
  return (
    <>
      <FolderAnchor district={district} />
      {showLabels && (
        <DistrictLabel
          district={district}
          scene={scene}
          zoomDistance={zoomDistance}
        />
      )}
      {district.children.map((child) =>
        child.nodeType === 'district' ? (
          <DistrictContent
            key={child.id}
            district={child}
            scene={scene}
            zoomDistance={zoomDistance}
            selectedBuildingId={selectedBuildingId}
            hoveredBuildingId={hoveredBuildingId}
            showLabels={showLabels}
            onSelectBuilding={onSelectBuilding}
            onHoverBuilding={onHoverBuilding}
          />
        ) : (
          <BuildingStack
            key={child.id}
            building={child}
            scene={scene}
            zoomDistance={zoomDistance}
            selected={selectedBuildingId === child.id}
            hovered={hoveredBuildingId === child.id}
            showLabels={showLabels}
            onSelectBuilding={onSelectBuilding}
            onHoverBuilding={onHoverBuilding}
          />
        ),
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
  onSelectBuilding,
  onHoverBuilding,
}: {
  boundary: CodeCityBoundary
  scene: CodeCitySceneModel
  zoomDistance: number
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  showLabels: boolean
  onSelectBuilding: (buildingId: string | null) => void
  onHoverBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
}) {
  return (
    <group>
      <BoundaryGround boundary={boundary} />
      {showLabels && (
        <BoundaryLabel
          boundary={boundary}
          scene={scene}
          zoomDistance={zoomDistance}
        />
      )}
      {boundary.zones.map((zone) => (
        <group key={zone.id}>
          <ZoneSurface zone={zone} />
          {showLabels && (
            <ZoneLabel zone={zone} scene={scene} zoomDistance={zoomDistance} />
          )}
          {zone.districts.map((district) => (
            <DistrictContent
              key={district.id}
              district={district}
              scene={scene}
              zoomDistance={zoomDistance}
              selectedBuildingId={selectedBuildingId}
              hoveredBuildingId={hoveredBuildingId}
              showLabels={showLabels}
              onSelectBuilding={onSelectBuilding}
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
    const hash = boundary.id.length + boundary.name.length
    const y = boundary.ground.centre.y + boundary.ground.height / 2 + 0.18

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

function TronGroundGrid() {
  const minorGrid = useMemo(() => createGridGeometry(380, 76, 8), [])
  const majorGrid = useMemo(() => createMajorGridGeometry(380, 76, 8), [])

  return (
    <group position={[0, -2.58, 0]}>
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
  selectedBuildingId,
  showOverlays,
  zoomDistance,
}: {
  scene: CodeCitySceneModel
  selectedBuildingId: string | null
  showOverlays: boolean
  zoomDistance: number
}) {
  const buildingsById = useMemo(() => {
    const index = new Map<string, CodeCityBuilding>()
    for (const boundary of scene.boundaries) {
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
  }, [scene])

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
          const verticalBoost =
            10 +
            Math.max(fromBuilding.height, toBuilding.height) * 0.4 +
            arc.strength * 18

          return (
            <QuadraticBezierLine
              key={arc.id}
              start={[start.x, start.y + fromBuilding.height + 0.8, start.z]}
              end={[end.x, end.y + toBuilding.height + 0.8, end.z]}
              mid={[
                (start.x + end.x) / 2,
                Math.max(start.y, end.y) + verticalBoost,
                (start.z + end.z) / 2,
              ]}
              color={arcColour(scene, arc)}
              lineWidth={arc.arcType === 'cross-boundary' ? 3.2 : 2.2}
              transparent
              opacity={arc.arcType === 'violation' ? 0.96 : 0.84}
            />
          )
        })}
    </group>
  )
}

function CameraDirector({
  scene,
  focus,
  onCameraControlStart,
  onZoomDistanceChange,
}: {
  scene: CodeCitySceneModel
  focus: CodeCityCameraFocus | null
  onCameraControlStart: () => void
  onZoomDistanceChange: (distance: number) => void
}) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)
  const desiredPosition = useRef(new THREE.Vector3())
  const desiredTarget = useRef(new THREE.Vector3())
  const activeFlightSequence = useRef<number | null>(null)
  const lastReportedZoomDistance = useRef<number | null>(null)
  const { camera, gl } = useThree()

  useEffect(() => {
    gl.setClearColor(TRON_BACKGROUND)
  }, [gl])

  useEffect(() => {
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
      onZoomDistanceChange(lastReportedZoomDistance.current)
    }
  }, [camera, onZoomDistanceChange, scene])

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
    if (
      lastReportedZoomDistance.current == null ||
      Math.abs(distance - lastReportedZoomDistance.current) >= 1.5
    ) {
      lastReportedZoomDistance.current = distance
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
      minDistance={20}
      maxDistance={300}
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
  showProps,
  showOverlays,
  zoomDistance,
  onSelectBuilding,
  onHoverBuilding,
}: Omit<
  CodeCityCanvasProps,
  | 'cameraFocus'
  | 'hoverScreenPoint'
  | 'onCameraControlStart'
  | 'onZoomDistanceChange'
>) {
  const visibleBoundaries = useMemo(
    () =>
      scene.boundaries.map((boundary) => ({
        ...boundary,
        zones: boundary.zones.filter((zone) =>
          showTests ? true : zone.zoneType !== 'test',
        ),
      })),
    [scene.boundaries, showTests],
  )

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
        position={[0, -2.8, 0]}
        receiveShadow
      >
        <circleGeometry args={[260, 96]} />
        <meshStandardMaterial
          color='#050C16'
          emissive='#02050A'
          emissiveIntensity={0.45}
          roughness={0.98}
        />
      </mesh>
      <TronGroundGrid />
      <ContactShadows
        position={[0, -2.68, 0]}
        opacity={0.5}
        scale={420}
        blur={2.5}
        far={80}
        resolution={1024}
        color='#020711'
      />
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
          onSelectBuilding={onSelectBuilding}
          onHoverBuilding={onHoverBuilding}
        />
      ))}
      <ArcLayer
        scene={scene}
        selectedBuildingId={selectedBuildingId}
        showOverlays={showOverlays}
        zoomDistance={zoomDistance}
      />
    </>
  )
}

export function CodeCityCanvas({
  scene,
  selectedBuildingId,
  hoveredBuildingId,
  hoverScreenPoint,
  showLabels,
  showTests,
  showProps,
  showOverlays,
  cameraFocus,
  zoomDistance,
  onSelectBuilding,
  onHoverBuilding,
  onCameraControlStart,
  onZoomDistanceChange,
}: CodeCityCanvasProps) {
  const fallbackPreset = resolveCodeCityCameraPreset(scene, null)
  const webglSupported = useMemo(() => supportsWebGL(), [])
  const initialPosition = cameraFocus?.position ?? [
    fallbackPreset?.position.x ?? 0,
    fallbackPreset?.position.y ?? 150,
    fallbackPreset?.position.z ?? 150,
  ]
  const selectedBuilding = getBuildingById(scene, selectedBuildingId)
  const hoveredBuilding = getBuildingById(scene, hoveredBuildingId)

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
            far: 600,
          }}
          onPointerMissed={() => onSelectBuilding(null)}
        >
          <Suspense fallback={null}>
            <CameraDirector
              scene={scene}
              focus={cameraFocus}
              onCameraControlStart={onCameraControlStart}
              onZoomDistanceChange={onZoomDistanceChange}
            />
            <SceneContents
              scene={scene}
              selectedBuildingId={selectedBuildingId}
              hoveredBuildingId={hoveredBuildingId}
              showLabels={showLabels}
              showTests={showTests}
              showProps={showProps}
              showOverlays={showOverlays}
              zoomDistance={zoomDistance}
              onSelectBuilding={onSelectBuilding}
              onHoverBuilding={onHoverBuilding}
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
          Orbit, pan, zoom, and select buildings to reveal dependency arcs.
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
        </div>
      )}
    </div>
  )
}
