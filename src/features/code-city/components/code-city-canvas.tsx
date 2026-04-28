import { type ElementRef, Suspense, useEffect, useMemo, useRef } from 'react'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import {
  Billboard,
  OrbitControls,
  QuadraticBezierLine,
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

function zoneTint(zoneType: CodeCityZone['zoneType']) {
  switch (zoneType) {
    case 'core':
      return '#C8D8F4'
    case 'application':
      return '#D7E8F6'
    case 'ports':
      return '#E0EDF8'
    case 'periphery':
      return '#E6F0F8'
    case 'edge':
      return '#F1F6FB'
    case 'module':
      return '#DFF0F1'
    case 'stage':
      return '#E4EFF7'
    case 'shared':
      return '#F3E8C9'
    case 'test':
      return '#DEE5EC'
    case 'chaos':
      return '#E9DADF'
  }
}

function boundaryAccent(boundary: CodeCityBoundary) {
  if (boundary.sharedLibrary.isSharedLibrary) {
    return '#E5C97B'
  }

  if (boundary.architecture === 'ball-of-mud') {
    return '#D8B6B8'
  }

  return '#A7C3DA'
}

function arcColour(scene: CodeCitySceneModel, arc: CodeCityArc) {
  if (arc.arcType === 'violation') {
    return scene.config.colours.violationArc
  }

  if (arc.arcType === 'cross-boundary') {
    return arc.strength >= 0.8
      ? scene.config.colours.crossBoundaryArcHigh
      : scene.config.colours.crossBoundaryArcLow
  }

  return scene.legend.arcColours.dependency
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

function BoundaryGround({ boundary }: { boundary: CodeCityBoundary }) {
  const tint = boundary.ground.tint
  const accent = boundaryAccent(boundary)
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
            color='#C8DBEA'
            metalness={0.04}
            roughness={0.78}
            transparent
            opacity={0.82}
          />
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
            color={tint}
            metalness={0.04}
            roughness={0.72}
            transparent
            opacity={shapeOpacity(boundary)}
          />
        </mesh>
        <mesh
          position={[0, boundary.ground.height / 2 + 0.18, 0]}
          receiveShadow
        >
          <ringGeometry
            args={[
              Math.max(boundary.ground.radius! - 1.7, 0.5),
              boundary.ground.radius! - 0.45,
              64,
            ]}
          />
          <meshStandardMaterial
            color={accent}
            metalness={0.02}
            roughness={0.9}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    )
  }

  return (
    <group position={[centre.x, centre.y, centre.z]}>
      <mesh receiveShadow>
        <boxGeometry
          args={[
            boundary.ground.width! + boundary.ground.waterInset * 2,
            boundary.ground.height * 0.7,
            boundary.ground.depth! + boundary.ground.waterInset * 2,
          ]}
        />
        <meshStandardMaterial
          color='#C8DBEA'
          metalness={0.04}
          roughness={0.78}
          transparent
          opacity={0.82}
        />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.22, 0]}>
        <boxGeometry
          args={[
            boundary.ground.width!,
            boundary.ground.height,
            boundary.ground.depth!,
          ]}
        />
        <meshStandardMaterial
          color={tint}
          metalness={0.04}
          roughness={0.72}
          transparent
          opacity={shapeOpacity(boundary)}
        />
      </mesh>
    </group>
  )
}

function ZoneSurface({ zone }: { zone: CodeCityZone }) {
  const tint = zoneTint(zone.zoneType)
  const opacity = zone.zoneType === 'test' ? 0.7 : 0.88

  if (zone.shape.kind === 'ring') {
    return (
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[
          zone.shape.centre.x,
          zone.elevation + 0.08,
          zone.shape.centre.z,
        ]}
        receiveShadow
      >
        <ringGeometry
          args={[zone.shape.innerRadius!, zone.shape.radius!, 64]}
        />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={opacity}
          roughness={0.92}
          metalness={0.02}
          side={THREE.DoubleSide}
        />
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
          zone.elevation + 0.02,
          zone.shape.centre.z,
        ]}
        receiveShadow
      >
        <cylinderGeometry
          args={[zone.shape.radius!, zone.shape.radius!, 0.14, 40]}
        />
        <meshStandardMaterial
          color={tint}
          transparent
          opacity={opacity}
          roughness={0.92}
          metalness={0.02}
        />
      </mesh>
    )
  }

  return (
    <mesh
      position={[
        zone.shape.centre.x,
        zone.elevation + 0.03,
        zone.shape.centre.z,
      ]}
      rotation={[0, zone.shape.rotation, 0]}
      receiveShadow
    >
      <boxGeometry args={[zone.shape.width!, 0.16, zone.shape.depth!]} />
      <meshStandardMaterial
        color={tint}
        transparent
        opacity={opacity}
        roughness={0.92}
        metalness={0.02}
      />
    </mesh>
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

  const centre = getPlotCentre(district.plot)
  const isTopLevel = district.depth === 0
  const labelPosition = isTopLevel
    ? ([
        centre.x,
        district.plot.y + 2.1,
        district.plot.z + Math.min(2.2, district.plot.depth * 0.18),
      ] as [number, number, number])
    : ([centre.x, district.plot.y + 1.55 + district.depth * 0.28, centre.z] as [
        number,
        number,
        number,
      ])

  return (
    <Billboard position={labelPosition}>
      <Text
        fontSize={isTopLevel ? 1.3 : 0.95}
        color={isTopLevel ? '#1F3850' : '#29445C'}
        anchorX='center'
        anchorY='middle'
        maxWidth={Math.max(7, Math.min(13, district.plot.width * 0.72))}
        textAlign='center'
        outlineWidth={isTopLevel ? 0.035 : 0.025}
        outlineColor='#F7FBFF'
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
      color='#24445E'
      anchorX='center'
      anchorY='middle'
      material-transparent
      material-opacity={opacity}
      material-depthWrite={false}
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
      color='#1F3345'
      anchorX='center'
      anchorY='middle'
      material-transparent
      material-opacity={opacity}
      material-depthWrite={false}
    >
      {boundary.name}
    </Text>
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
    selected || hovered ? '#7F97B5' : building.isTest ? '#A7B8C6' : '#B5C5D6'

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

  let floorBottom = 0

  return (
    <group position={[centre.x, building.plot.y, centre.z]}>
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry
          args={[
            Math.max(building.plot.width, building.plot.depth) * 0.48,
            Math.max(building.plot.width, building.plot.depth) * 0.48,
            0.12,
            24,
          ]}
        />
        <meshStandardMaterial
          color={highlightColour}
          transparent
          opacity={selected ? 0.58 : hovered ? 0.34 : 0.16}
        />
      </mesh>

      {building.floors.map((floor) => {
        const gap = 0.14
        const floorHeight = Math.max(0.5, floor.height - gap * 0.35)
        const positionY = floorBottom + floorHeight / 2
        floorBottom += floor.height + gap

        return (
          <group key={floor.id}>
            <mesh position={[0, positionY, 0]} castShadow>
              <boxGeometry
                args={[interactiveWidth, floorHeight, interactiveDepth]}
              />
              <meshStandardMaterial
                color={building.isTest ? '#9FB0BE' : floor.colour}
                metalness={0.05}
                roughness={0.68}
                transparent
                opacity={buildingOpacity}
              />
            </mesh>
            {showLabels && selected && detailOpacity > 0.05 && (
              <Billboard
                position={[0, positionY, interactiveDepth / 2 + 1.1]}
                follow
              >
                <Text
                  fontSize={0.9}
                  color='#183248'
                  anchorX='center'
                  anchorY='middle'
                  outlineWidth={0.02}
                  outlineColor='#F7FBFF'
                  material-transparent
                  material-opacity={detailOpacity}
                  material-depthWrite={false}
                >
                  {floor.artefactKind}
                </Text>
              </Billboard>
            )}
          </group>
        )
      })}

      <mesh
        position={[0, building.height / 2 + 0.08, 0]}
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
        <Billboard position={[0, building.height + 1.5, 0]}>
          <Text
            fontSize={1.1}
            color='#163248'
            anchorX='center'
            anchorY='middle'
            maxWidth={9}
            textAlign='center'
            outlineWidth={0.03}
            outlineColor='#F7FBFF'
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
      <mesh
        position={[
          district.plot.x + district.plot.width / 2,
          district.plot.y + 0.025,
          district.plot.z + district.plot.depth / 2,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[district.plot.width, district.plot.depth]} />
        <meshStandardMaterial
          color='#F8FBFE'
          transparent
          opacity={district.depth === 0 ? 0.28 : 0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
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

function collectPropPoints(boundaries: CodeCityBoundary[]) {
  const points: Array<{
    trunk: THREE.Vector3
    canopy: THREE.Vector3
    canopyScale: number
  }> = []

  for (const boundary of boundaries) {
    const hash = boundary.id.length + boundary.name.length

    if (boundary.ground.kind === 'disc') {
      const radius = boundary.ground.radius! + 2
      const count = boundary.sharedLibrary.isSharedLibrary ? 12 : 20

      for (let index = 0; index < count; index += 1) {
        const angle = ((index + hash * 0.17) / count) * Math.PI * 2
        const distance = radius + (index % 3) * 1.6
        const x = boundary.ground.centre.x + Math.cos(angle) * distance
        const z = boundary.ground.centre.z + Math.sin(angle) * distance
        points.push({
          trunk: new THREE.Vector3(x, -0.12, z),
          canopy: new THREE.Vector3(x, 0.75, z),
          canopyScale: 0.65 + (index % 4) * 0.12,
        })
      }

      continue
    }

    const width = boundary.ground.width!
    const depth = boundary.ground.depth!
    const count = 18

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

      points.push({
        trunk: new THREE.Vector3(x, -0.12, z),
        canopy: new THREE.Vector3(x, 0.75, z),
        canopyScale: 0.6 + (index % 3) * 0.14,
      })
    }
  }

  return points
}

function DecorativeProps({ boundaries }: { boundaries: CodeCityBoundary[] }) {
  const points = useMemo(() => collectPropPoints(boundaries), [boundaries])
  const trunkRef = useRef<THREE.InstancedMesh>(null)
  const canopyRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    const trunkMesh = trunkRef.current
    const canopyMesh = canopyRef.current
    if (trunkMesh == null || canopyMesh == null) {
      return
    }

    const trunkDummy = new THREE.Object3D()
    const canopyDummy = new THREE.Object3D()

    points.forEach((point, index) => {
      trunkDummy.position.copy(point.trunk)
      trunkDummy.scale.setScalar(1)
      trunkDummy.updateMatrix()
      trunkMesh.setMatrixAt(index, trunkDummy.matrix)

      canopyDummy.position.copy(point.canopy)
      canopyDummy.scale.setScalar(point.canopyScale)
      canopyDummy.updateMatrix()
      canopyMesh.setMatrixAt(index, canopyDummy.matrix)
    })

    trunkMesh.instanceMatrix.needsUpdate = true
    canopyMesh.instanceMatrix.needsUpdate = true
  }, [points])

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[undefined, undefined, points.length]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry args={[0.14, 0.18, 1.3, 6]} />
        <meshStandardMaterial color='#7C5E4A' roughness={0.95} />
      </instancedMesh>
      <instancedMesh
        ref={canopyRef}
        args={[undefined, undefined, points.length]}
        castShadow
        receiveShadow
      >
        <sphereGeometry args={[0.82, 10, 10]} />
        <meshStandardMaterial color='#9FD7C7' roughness={0.85} />
      </instancedMesh>
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
              lineWidth={arc.arcType === 'cross-boundary' ? 2.6 : 1.7}
              transparent
              opacity={arc.arcType === 'violation' ? 0.9 : 0.72}
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
    gl.setClearColor('#EFF6FB')
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
      <ambientLight intensity={0.85} />
      <hemisphereLight intensity={0.55} color='#FFFFFF' groundColor='#B8D1E2' />
      <directionalLight
        position={[120, 160, 60]}
        intensity={1.22}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -2.8, 0]}
        receiveShadow
      >
        <circleGeometry args={[260, 96]} />
        <meshStandardMaterial color='#F2F7FB' roughness={0.98} />
      </mesh>
      {showProps && <DecorativeProps boundaries={visibleBoundaries} />}
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
      className='relative h-[68svh] min-h-[520px] overflow-hidden rounded-[1.25rem] bg-[radial-gradient(circle_at_top,#fefefe_0%,#edf5fb_52%,#d9e8f3_100%)]'
      data-testid='code-city-scene-card'
    >
      {webglSupported ? (
        <Canvas
          shadows
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

      <div className='pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4'>
        <div className='rounded-full border border-white/60 bg-white/75 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur'>
          Orbit, pan, zoom, and select buildings to reveal dependency arcs.
        </div>
        {selectedBuilding != null && (
          <div className='rounded-full border border-white/60 bg-white/75 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm backdrop-blur'>
            Selected: {selectedBuilding.label}
          </div>
        )}
      </div>

      {hoveredBuilding != null && (
        <div
          className='pointer-events-none absolute z-20 w-64 rounded-2xl border border-white/70 bg-white/92 p-3 text-sm shadow-[0_16px_35px_-20px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/88'
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
          <p className='mt-1 break-all text-xs text-muted-foreground'>
            {hoveredBuilding.filePath}
          </p>
          <div className='mt-3 grid grid-cols-2 gap-2 text-xs'>
            <div className='rounded-xl bg-slate-100/80 p-2 dark:bg-white/5'>
              <p className='text-muted-foreground'>Importance</p>
              <p className='mt-1 font-semibold'>
                {Math.round(hoveredBuilding.importance * 100)}%
              </p>
            </div>
            <div className='rounded-xl bg-slate-100/80 p-2 dark:bg-white/5'>
              <p className='text-muted-foreground'>Risk</p>
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
