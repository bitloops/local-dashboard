import { Suspense, useEffect, useMemo, useRef, type ElementRef } from 'react'
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
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
  ArchitectureComponentGroupNode,
  ArchitectureComponentNode,
  ArchitectureDataConnection,
  ArchitectureDirectConnection,
  ArchitectureNavigationContextReviewState,
  ArchitectureNavigationContextStatus,
  ArchitectureSceneModel,
  ArchitectureVector3,
} from '../model'

type ArchitectureCanvasProps = {
  scene: ArchitectureSceneModel
  selectedId: string | null
  showLabels: boolean
  showContracts: boolean
  showDirectConnections: boolean
  showEntryPoints: boolean
  showDeployments: boolean
  showPersistence: boolean
  showDataConnections: boolean
  onSelect: (id: string | null) => void
}

const BACKGROUND = '#030812'
const SURFACE = '#08182A'
const CYAN = '#52F6FF'
const MINT = '#50FFC2'
const AMBER = '#FFB14A'
const RED = '#FF355D'
const BLUE = '#2D8CFF'
const VIOLET = '#C879FF'
const LABEL = '#DDFDFF'

type ContextOverlayIndex = {
  componentCounts: Map<string, number>
  groupCounts: Map<string, number>
  containerCounts: Map<string, number>
  maxComponentCount: number
  status: ArchitectureNavigationContextStatus | null
  reviewState: ArchitectureNavigationContextReviewState | null
}

function supportsWebGL() {
  if (typeof document === 'undefined') {
    return false
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('jsdom')
  ) {
    return false
  }

  const canvas = document.createElement('canvas')
  return Boolean(
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl'),
  )
}

function toVector3(vector: ArchitectureVector3) {
  return new THREE.Vector3(vector.x, vector.y, vector.z)
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function contextSignalIntensity(count: number, maxCount: number) {
  if (count <= 0) {
    return 0
  }

  return clamp(count / Math.max(1, maxCount), 0.34, 1)
}

function buildContextOverlayIndex(
  scene: ArchitectureSceneModel,
): ContextOverlayIndex {
  const componentCounts = new Map<string, number>()
  const groupCounts = new Map<string, number>()
  const containerCounts = new Map<string, number>()
  const changedByComponentId = scene.navigationContext?.changedByComponentId

  for (const component of scene.components) {
    const count = changedByComponentId?.[component.id]?.length ?? 0
    if (count <= 0) {
      continue
    }

    componentCounts.set(component.id, count)
    containerCounts.set(
      component.containerId,
      (containerCounts.get(component.containerId) ?? 0) + count,
    )
  }

  for (const group of scene.componentGroups) {
    const count = group.componentIds.reduce(
      (total, componentId) => total + (componentCounts.get(componentId) ?? 0),
      0,
    )
    if (count > 0) {
      groupCounts.set(group.id, count)
    }
  }

  return {
    componentCounts,
    groupCounts,
    containerCounts,
    maxComponentCount: Math.max(1, ...componentCounts.values()),
    status: scene.navigationContext?.status ?? null,
    reviewState: scene.navigationContext?.reviewState ?? null,
  }
}

function pointOnQuadratic(
  from: THREE.Vector3,
  control: THREE.Vector3,
  to: THREE.Vector3,
  t: number,
) {
  const oneMinusT = 1 - t
  return new THREE.Vector3(
    oneMinusT * oneMinusT * from.x +
      2 * oneMinusT * t * control.x +
      t * t * to.x,
    oneMinusT * oneMinusT * from.y +
      2 * oneMinusT * t * control.y +
      t * t * to.y,
    oneMinusT * oneMinusT * from.z +
      2 * oneMinusT * t * control.z +
      t * t * to.z,
  )
}

function tangentOnQuadratic(
  from: THREE.Vector3,
  control: THREE.Vector3,
  to: THREE.Vector3,
  t: number,
) {
  return new THREE.Vector3(
    2 * (1 - t) * (control.x - from.x) + 2 * t * (to.x - control.x),
    2 * (1 - t) * (control.y - from.y) + 2 * t * (to.y - control.y),
    2 * (1 - t) * (control.z - from.z) + 2 * t * (to.z - control.z),
  ).normalize()
}

function ArrowHead({
  position,
  direction,
  colour,
  scale,
}: {
  position: THREE.Vector3
  direction: THREE.Vector3
  colour: string
  scale: number
}) {
  const quaternion = useMemo(() => {
    const next = new THREE.Quaternion()
    next.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction)
    return next
  }, [direction])

  return (
    <mesh position={position} quaternion={quaternion}>
      <coneGeometry args={[0.22 * scale, 0.64 * scale, 20]} />
      <meshBasicMaterial
        color={colour}
        transparent
        opacity={0.96}
        toneMapped={false}
      />
    </mesh>
  )
}

function FlowPulse({
  from,
  control,
  to,
  colour,
  offset,
}: {
  from: THREE.Vector3
  control: THREE.Vector3
  to: THREE.Vector3
  colour: string
  offset: number
}) {
  const point = pointOnQuadratic(from, control, to, offset)

  return (
    <mesh position={point}>
      <sphereGeometry args={[0.16, 12, 12]} />
      <meshBasicMaterial
        color={colour}
        transparent
        opacity={0.82}
        toneMapped={false}
      />
    </mesh>
  )
}

function DirectedConnection({
  id,
  from,
  to,
  colour,
  lineWidth,
  arcHeight,
  selected,
  muted,
  arrows = 2,
  label,
  onSelect,
}: {
  id: string
  from: ArchitectureVector3
  to: ArchitectureVector3
  colour: string
  lineWidth: number
  arcHeight: number
  selected: boolean
  muted: boolean
  arrows?: number
  label?: string
  onSelect: (id: string) => void
}) {
  const fromVector = useMemo(() => toVector3(from), [from])
  const toVector = useMemo(() => toVector3(to), [to])
  const control = useMemo(
    () =>
      new THREE.Vector3(
        (from.x + to.x) / 2,
        Math.max(from.y, to.y) + arcHeight,
        (from.z + to.z) / 2,
      ),
    [arcHeight, from, to],
  )
  const arrowPoints = useMemo(
    () =>
      Array.from({ length: arrows }, (_, index) => {
        const t = 0.54 + (index / Math.max(1, arrows - 1)) * 0.28
        return {
          position: pointOnQuadratic(fromVector, control, toVector, t),
          direction: tangentOnQuadratic(fromVector, control, toVector, t),
        }
      }),
    [arrows, control, fromVector, toVector],
  )
  const opacity = muted ? 0.18 : selected ? 0.98 : 0.72

  return (
    <group
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(id)
      }}
    >
      <QuadraticBezierLine
        start={[from.x, from.y, from.z]}
        mid={[control.x, control.y, control.z]}
        end={[to.x, to.y, to.z]}
        color={colour}
        lineWidth={selected ? lineWidth + 1.6 : lineWidth}
        transparent
        opacity={opacity}
      />
      {arrowPoints.map((arrow, index) => (
        <ArrowHead
          key={`${id}:arrow:${index}`}
          position={arrow.position}
          direction={arrow.direction}
          colour={colour}
          scale={selected ? 1.2 : 1}
        />
      ))}
      {!muted && (
        <>
          <FlowPulse
            from={fromVector}
            control={control}
            to={toVector}
            colour={colour}
            offset={0.28}
          />
          <FlowPulse
            from={fromVector}
            control={control}
            to={toVector}
            colour={colour}
            offset={0.74}
          />
        </>
      )}
      {label != null && selected && (
        <Billboard
          position={[(from.x + to.x) / 2, control.y + 1.2, (from.z + to.z) / 2]}
        >
          <Text
            fontSize={0.72}
            color={LABEL}
            anchorX='center'
            anchorY='middle'
            maxWidth={9}
            textAlign='center'
            outlineWidth={0.035}
            outlineColor='#020812'
          >
            {label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function rectangleGeometry(width: number, depth: number) {
  const halfWidth = width / 2
  const halfDepth = depth / 2
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [
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
      ],
      3,
    ),
  )
  return geometry
}

function ContainerOutline({
  container,
  contextChangeCount,
  showLabels,
}: {
  container: ArchitectureSceneModel['containers'][number]
  contextChangeCount: number
  showLabels: boolean
}) {
  const geometry = useMemo(
    () => rectangleGeometry(container.width, container.depth),
    [container.depth, container.width],
  )
  const hasContextChanges = contextChangeCount > 0
  const colour = hasContextChanges ? AMBER : CYAN

  return (
    <group position={[container.position.x, 0.08, container.position.z]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={colour}
          transparent
          opacity={hasContextChanges ? 0.82 : 0.58}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <mesh position={[0, -0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[container.width, container.depth]} />
        <meshBasicMaterial
          color={hasContextChanges ? '#2B1805' : SURFACE}
          transparent
          opacity={hasContextChanges ? 0.16 : 0.1}
          depthWrite={false}
        />
      </mesh>
      {showLabels && (
        <Billboard position={[0, 1.3, -container.depth / 2 - 1.2]}>
          <Text
            fontSize={1}
            color={hasContextChanges ? '#FFE5B8' : LABEL}
            anchorX='center'
            anchorY='middle'
            outlineWidth={0.04}
            outlineColor='#020812'
          >
            {container.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function ComponentGroupOutline({
  group,
  selected,
  contextChangeCount,
  showLabels,
  onSelect,
}: {
  group: ArchitectureComponentGroupNode
  selected: boolean
  contextChangeCount: number
  showLabels: boolean
  onSelect: (id: string) => void
}) {
  const geometry = useMemo(
    () => rectangleGeometry(group.width, group.depth),
    [group.depth, group.width],
  )
  const hasContextChanges = contextChangeCount > 0
  const colour = selected ? '#FFFFFF' : hasContextChanges ? AMBER : MINT

  return (
    <group
      position={[
        group.position.x,
        0.14 + group.hierarchyDepth * 0.04,
        group.position.z,
      ]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(group.id)
      }}
    >
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color={colour}
          transparent
          opacity={selected ? 0.9 : hasContextChanges ? 0.74 : 0.52}
          depthWrite={false}
          toneMapped={false}
        />
      </lineSegments>
      <mesh position={[0, -0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[group.width, group.depth]} />
        <meshBasicMaterial
          color={hasContextChanges ? AMBER : MINT}
          transparent
          opacity={selected ? 0.1 : hasContextChanges ? 0.09 : 0.055}
          depthWrite={false}
        />
      </mesh>
      {showLabels && group.label != null && (
        <Billboard position={[0, 0.95, -group.depth / 2 + 0.7]}>
          <Text
            fontSize={0.58}
            color={
              selected ? '#FFFFFF' : hasContextChanges ? '#FFE5B8' : '#C6FFF0'
            }
            anchorX='center'
            anchorY='middle'
            maxWidth={Math.max(7, group.width - 1)}
            textAlign='center'
            outlineWidth={0.03}
            outlineColor='#020812'
          >
            {group.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function ComponentTower({
  component,
  selected,
  dimmed,
  contextChangeCount,
  contextMaxChangeCount,
  contextStatus,
  contextReviewState,
  showLabels,
  onSelect,
}: {
  component: ArchitectureComponentNode
  selected: boolean
  dimmed: boolean
  contextChangeCount: number
  contextMaxChangeCount: number
  contextStatus: ArchitectureNavigationContextStatus | null
  contextReviewState: ArchitectureNavigationContextReviewState | null
  showLabels: boolean
  onSelect: (id: string) => void
}) {
  const hasContextChanges = contextChangeCount > 0
  const contextNeedsReview =
    contextStatus === 'stale' || contextReviewState === 'unreviewed'
  const contextIntensity = contextSignalIntensity(
    contextChangeCount,
    contextMaxChangeCount,
  )
  const contextColour = contextNeedsReview ? AMBER : MINT
  const glow = selected
    ? CYAN
    : hasContextChanges
      ? contextColour
      : component.directOutCount > 0
        ? RED
        : component.colour
  const opacity = dimmed ? (hasContextChanges ? 0.58 : 0.32) : 0.94
  const outerRadius =
    Math.max(component.width, component.depth) * (0.66 + contextIntensity * 0.2)

  return (
    <group
      position={[
        component.position.x,
        component.position.y + component.height / 2,
        component.position.z,
      ]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(component.id)
      }}
    >
      <RoundedBox
        args={[component.width, component.height, component.depth]}
        radius={0.22}
        smoothness={4}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color='#07111F'
          emissive={glow}
          emissiveIntensity={
            selected
              ? 0.52
              : hasContextChanges
                ? 0.38 + contextIntensity * 0.28
                : component.directOutCount > 0
                  ? 0.3
                  : 0.2
          }
          metalness={0.16}
          roughness={0.5}
          transparent
          opacity={opacity}
        />
        <Edges color={selected ? '#FFFFFF' : glow} threshold={14} />
      </RoundedBox>
      <mesh position={[0, component.height / 2 + 0.2, 0]}>
        <boxGeometry
          args={[component.width * 0.72, 0.08, component.depth * 0.72]}
        />
        <meshBasicMaterial
          color={glow}
          transparent
          opacity={selected ? 0.84 : 0.46}
          toneMapped={false}
        />
      </mesh>
      {hasContextChanges && (
        <>
          <mesh
            position={[0, -component.height / 2 + 0.08, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[outerRadius * 0.74, outerRadius, 80]} />
            <meshBasicMaterial
              color={contextColour}
              transparent
              opacity={0.38 + contextIntensity * 0.34}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh
            position={[0, component.height / 2 + 0.34, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry
              args={[
                Math.max(component.width, component.depth) * 0.28,
                Math.max(component.width, component.depth) * 0.38,
                56,
              ]}
            />
            <meshBasicMaterial
              color={contextColour}
              transparent
              opacity={0.7}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <Billboard position={[0, component.height / 2 + 2.35, 0]}>
            <Text
              fontSize={0.58}
              color='#FFE5B8'
              anchorX='center'
              anchorY='middle'
              maxWidth={7}
              textAlign='center'
              outlineWidth={0.04}
              outlineColor='#170A02'
            >
              {`${contextChangeCount} ${
                contextChangeCount === 1 ? 'change' : 'changes'
              }`}
            </Text>
          </Billboard>
        </>
      )}
      {showLabels && (
        <Billboard position={[0, component.height / 2 + 1.35, 0]}>
          <Text
            fontSize={0.86}
            color={LABEL}
            anchorX='center'
            anchorY='middle'
            maxWidth={8}
            textAlign='center'
            outlineWidth={0.035}
            outlineColor='#020812'
          >
            {component.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function EntryPointGate({
  entryPoint,
  selected,
  showLabels,
  onSelect,
}: {
  entryPoint: ArchitectureSceneModel['entryPoints'][number]
  selected: boolean
  showLabels: boolean
  onSelect: (id: string) => void
}) {
  return (
    <group
      position={[
        entryPoint.position.x,
        entryPoint.position.y + 1.25,
        entryPoint.position.z,
      ]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(entryPoint.id)
      }}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.72, 0.08, 12, 32]} />
        <meshBasicMaterial color={AMBER} toneMapped={false} />
      </mesh>
      <mesh>
        <octahedronGeometry args={[0.34, 0]} />
        <meshBasicMaterial
          color={selected ? '#FFFFFF' : AMBER}
          toneMapped={false}
        />
      </mesh>
      {showLabels && (
        <Billboard position={[0, 1.25, 0]}>
          <Text
            fontSize={0.58}
            color='#FFE6B8'
            anchorX='center'
            anchorY='middle'
            maxWidth={6}
            textAlign='center'
            outlineWidth={0.03}
            outlineColor='#020812'
          >
            {entryPoint.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function DeploymentMarker({
  deploymentUnit,
  showLabels,
  onSelect,
}: {
  deploymentUnit: ArchitectureSceneModel['deploymentUnits'][number]
  showLabels: boolean
  onSelect: (id: string) => void
}) {
  return (
    <group
      position={[
        deploymentUnit.position.x,
        deploymentUnit.position.y + 1.4,
        deploymentUnit.position.z,
      ]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(deploymentUnit.id)
      }}
    >
      <mesh>
        <dodecahedronGeometry args={[0.48, 0]} />
        <meshStandardMaterial
          color='#0B1628'
          emissive={VIOLET}
          emissiveIntensity={0.42}
          metalness={0.2}
          roughness={0.42}
        />
      </mesh>
      {showLabels && (
        <Billboard position={[0, 1, 0]}>
          <Text
            fontSize={0.55}
            color='#F0D8FF'
            anchorX='center'
            anchorY='middle'
            maxWidth={6}
            textAlign='center'
            outlineWidth={0.03}
            outlineColor='#020812'
          >
            {deploymentUnit.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function PersistenceNode({
  persistence,
  selected,
  showLabels,
  onSelect,
}: {
  persistence: ArchitectureSceneModel['persistenceObjects'][number]
  selected: boolean
  showLabels: boolean
  onSelect: (id: string) => void
}) {
  return (
    <group
      position={[
        persistence.position.x,
        persistence.position.y,
        persistence.position.z,
      ]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(persistence.id)
      }}
    >
      <mesh>
        <cylinderGeometry args={[1.2, 1.2, 0.7, 36]} />
        <meshStandardMaterial
          color='#061424'
          emissive={selected ? '#FFFFFF' : BLUE}
          emissiveIntensity={selected ? 0.46 : 0.26}
          metalness={0.12}
          roughness={0.62}
        />
      </mesh>
      <mesh position={[0, 0.43, 0]}>
        <torusGeometry args={[1.18, 0.035, 8, 36]} />
        <meshBasicMaterial
          color={BLUE}
          transparent
          opacity={0.76}
          toneMapped={false}
        />
      </mesh>
      {showLabels && (
        <Billboard position={[0, 1.35, 0]}>
          <Text
            fontSize={0.62}
            color='#C9F5FF'
            anchorX='center'
            anchorY='middle'
            maxWidth={7}
            textAlign='center'
            outlineWidth={0.03}
            outlineColor='#020812'
          >
            {persistence.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function componentAnchor(
  component: ArchitectureComponentNode,
  mode: 'top' | 'side',
) {
  return {
    x: component.position.x,
    y:
      mode === 'top'
        ? component.height + 1
        : Math.max(2, component.height * 0.62),
    z: component.position.z,
  }
}

function ContractGlyph({
  connection,
  componentsById,
  selected,
  onSelect,
}: {
  connection: ArchitectureSceneModel['contractConnections'][number]
  componentsById: Map<string, ArchitectureComponentNode>
  selected: boolean
  onSelect: (id: string) => void
}) {
  const from = componentsById.get(connection.fromComponentId)
  const to = componentsById.get(connection.toComponentId)
  if (from == null || to == null) {
    return null
  }

  return (
    <group
      position={[
        (from.position.x + to.position.x) / 2,
        Math.max(from.height, to.height) + 4.7,
        (from.position.z + to.position.z) / 2,
      ]}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(connection.id)
      }}
    >
      <mesh>
        <octahedronGeometry args={[0.54, 0]} />
        <meshBasicMaterial
          color={selected ? '#FFFFFF' : MINT}
          toneMapped={false}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.78, 0.035, 8, 28]} />
        <meshBasicMaterial
          color={MINT}
          transparent
          opacity={0.78}
          toneMapped={false}
        />
      </mesh>
    </group>
  )
}

function dataConnectionTarget(
  connection: ArchitectureDataConnection,
  componentsById: Map<string, ArchitectureComponentNode>,
  persistenceById: Map<
    string,
    ArchitectureSceneModel['persistenceObjects'][number]
  >,
) {
  const component = componentsById.get(connection.componentId)
  const persistence = persistenceById.get(connection.persistenceObjectId)

  if (component == null || persistence == null) {
    return null
  }

  return {
    from: componentAnchor(component, 'side'),
    to: {
      x: persistence.position.x,
      y: persistence.position.y + 0.6,
      z: persistence.position.z,
    },
  }
}

function SceneContents({
  scene,
  selectedId,
  showLabels,
  showContracts,
  showDirectConnections,
  showEntryPoints,
  showDeployments,
  showPersistence,
  showDataConnections,
  onSelect,
}: ArchitectureCanvasProps) {
  const componentsById = useMemo(
    () =>
      new Map(scene.components.map((component) => [component.id, component])),
    [scene.components],
  )
  const persistenceById = useMemo(
    () =>
      new Map(
        scene.persistenceObjects.map((persistence) => [
          persistence.id,
          persistence,
        ]),
      ),
    [scene.persistenceObjects],
  )
  const selectedConnections = useMemo(() => {
    if (selectedId == null) {
      return null
    }

    return new Set(
      [
        ...scene.contractConnections.filter(
          (connection) =>
            connection.id === selectedId ||
            connection.fromComponentId === selectedId ||
            connection.toComponentId === selectedId,
        ),
        ...scene.directConnections.filter(
          (connection) =>
            connection.id === selectedId ||
            connection.fromComponentId === selectedId ||
            connection.toComponentId === selectedId,
        ),
      ].map((connection) => connection.id),
    )
  }, [scene.contractConnections, scene.directConnections, selectedId])
  const contextOverlay = useMemo(() => buildContextOverlayIndex(scene), [scene])
  const selectedComponent = componentsById.get(selectedId ?? '')

  return (
    <>
      <ambientLight intensity={0.4} />
      <hemisphereLight intensity={0.36} color='#D5FCFF' groundColor='#06101D' />
      <directionalLight
        position={[70, 100, 45]}
        intensity={0.9}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-60, 40, -80]}
        intensity={0.42}
        color={CYAN}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[scene.bounds.centre.x, -0.08, scene.bounds.centre.z]}
        receiveShadow
      >
        <planeGeometry
          args={[scene.bounds.width + 34, scene.bounds.depth + 34]}
        />
        <meshStandardMaterial
          color='#050C16'
          emissive='#02050A'
          emissiveIntensity={0.45}
          roughness={0.98}
        />
      </mesh>
      <gridHelper
        args={[
          Math.max(scene.bounds.width, scene.bounds.depth) + 42,
          42,
          '#1CF4FF',
          '#123D59',
        ]}
        position={[scene.bounds.centre.x, 0.02, scene.bounds.centre.z]}
      />
      <ContactShadows
        position={[scene.bounds.centre.x, -0.02, scene.bounds.centre.z]}
        opacity={0.36}
        scale={Math.max(scene.bounds.width, scene.bounds.depth) + 42}
        blur={2.6}
        far={26}
        resolution={1024}
        color='#020711'
      />

      {scene.containers.map((container) => (
        <ContainerOutline
          key={container.id}
          container={container}
          contextChangeCount={
            contextOverlay.containerCounts.get(container.id) ?? 0
          }
          showLabels={showLabels}
        />
      ))}

      {scene.componentGroups.map((group) => (
        <ComponentGroupOutline
          key={group.id}
          group={group}
          selected={selectedId === group.id}
          contextChangeCount={contextOverlay.groupCounts.get(group.id) ?? 0}
          showLabels={showLabels}
          onSelect={onSelect}
        />
      ))}

      {showPersistence &&
        scene.persistenceObjects.map((persistence) => (
          <PersistenceNode
            key={persistence.id}
            persistence={persistence}
            selected={selectedId === persistence.id}
            showLabels={showLabels}
            onSelect={onSelect}
          />
        ))}

      {scene.components.map((component) => (
        <ComponentTower
          key={component.id}
          component={component}
          selected={selectedId === component.id}
          dimmed={
            selectedComponent != null &&
            selectedComponent.id !== component.id &&
            !scene.contractConnections.some(
              (connection) =>
                selectedConnections?.has(connection.id) &&
                (connection.fromComponentId === component.id ||
                  connection.toComponentId === component.id),
            ) &&
            !scene.directConnections.some(
              (connection) =>
                selectedConnections?.has(connection.id) &&
                (connection.fromComponentId === component.id ||
                  connection.toComponentId === component.id),
            )
          }
          contextChangeCount={
            contextOverlay.componentCounts.get(component.id) ?? 0
          }
          contextMaxChangeCount={contextOverlay.maxComponentCount}
          contextStatus={contextOverlay.status}
          contextReviewState={contextOverlay.reviewState}
          showLabels={showLabels}
          onSelect={onSelect}
        />
      ))}

      {showContracts &&
        scene.contractConnections.map((connection) => {
          const from = componentsById.get(connection.fromComponentId)
          const to = componentsById.get(connection.toComponentId)
          if (from == null || to == null) {
            return null
          }

          const selected =
            selectedId === connection.id ||
            selectedConnections?.has(connection.id)

          return (
            <group key={connection.id}>
              <DirectedConnection
                id={connection.id}
                from={componentAnchor(from, 'top')}
                to={componentAnchor(to, 'top')}
                colour={MINT}
                lineWidth={2.8 + connection.strength * 2}
                arcHeight={4.8}
                selected={Boolean(selected)}
                muted={selectedConnections != null && !selected}
                label={connection.label}
                onSelect={onSelect}
              />
              <ContractGlyph
                connection={connection}
                componentsById={componentsById}
                selected={selectedId === connection.id}
                onSelect={onSelect}
              />
            </group>
          )
        })}

      {showDirectConnections &&
        scene.directConnections.map(
          (connection: ArchitectureDirectConnection) => {
            const from = componentsById.get(connection.fromComponentId)
            const to = componentsById.get(connection.toComponentId)
            if (from == null || to == null) {
              return null
            }

            const selected =
              selectedId === connection.id ||
              selectedConnections?.has(connection.id)

            return (
              <DirectedConnection
                key={connection.id}
                id={connection.id}
                from={componentAnchor(from, 'side')}
                to={componentAnchor(to, 'side')}
                colour={RED}
                lineWidth={1.7 + connection.strength * 2}
                arcHeight={1.2}
                selected={Boolean(selected)}
                muted={selectedConnections != null && !selected}
                arrows={1}
                label={`${connection.label} (${connection.dependencyCount})`}
                onSelect={onSelect}
              />
            )
          },
        )}

      {showPersistence &&
        showDataConnections &&
        scene.dataConnections.map((connection) => {
          const target = dataConnectionTarget(
            connection,
            componentsById,
            persistenceById,
          )
          if (target == null) {
            return null
          }

          return (
            <DirectedConnection
              key={connection.id}
              id={connection.id}
              from={target.from}
              to={target.to}
              colour={connection.kind === 'read' ? BLUE : AMBER}
              lineWidth={1.8}
              arcHeight={1.8}
              selected={selectedId === connection.id}
              muted={selectedId != null && selectedId !== connection.id}
              arrows={1}
              label={connection.label}
              onSelect={onSelect}
            />
          )
        })}

      {showEntryPoints &&
        scene.entryPoints.map((entryPoint) => (
          <EntryPointGate
            key={entryPoint.id}
            entryPoint={entryPoint}
            selected={selectedId === entryPoint.id}
            showLabels={showLabels}
            onSelect={onSelect}
          />
        ))}

      {showDeployments &&
        scene.deploymentUnits.map((deploymentUnit) => (
          <DeploymentMarker
            key={deploymentUnit.id}
            deploymentUnit={deploymentUnit}
            showLabels={showLabels}
            onSelect={onSelect}
          />
        ))}
    </>
  )
}

function CameraRig({ scene }: { scene: ArchitectureSceneModel }) {
  const controlsRef = useRef<ElementRef<typeof OrbitControls>>(null)
  const { camera, gl } = useThree()
  const longestSide = Math.max(scene.bounds.width, scene.bounds.depth, 36)

  useEffect(() => {
    gl.setClearColor(BACKGROUND)
  }, [gl])

  useEffect(() => {
    camera.position.set(
      scene.bounds.centre.x + longestSide * 0.72,
      Math.max(38, longestSide * 0.68),
      scene.bounds.centre.z + longestSide * 0.86,
    )
    camera.lookAt(scene.bounds.centre.x, 2, scene.bounds.centre.z)
    // Three.js camera instances are mutable external objects; keep the projection range in sync with the scene bounds.
    // eslint-disable-next-line react-hooks/immutability
    camera.far = Math.max(800, longestSide * 8)
    camera.updateProjectionMatrix()

    if (controlsRef.current != null) {
      controlsRef.current.target.set(
        scene.bounds.centre.x,
        2,
        scene.bounds.centre.z,
      )
      controlsRef.current.update()
    }
  }, [
    camera,
    longestSide,
    scene.bounds.centre,
    scene.bounds.depth,
    scene.bounds.width,
  ])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={8}
      maxDistance={Math.max(120, longestSide * 2.5)}
      maxPolarAngle={Math.PI / 2.08}
    />
  )
}

export function ArchitectureCanvas(props: ArchitectureCanvasProps) {
  const webglSupported = useMemo(() => supportsWebGL(), [])
  const longestSide = Math.max(
    props.scene.bounds.width,
    props.scene.bounds.depth,
    36,
  )

  return (
    <div
      className='relative h-[70svh] min-h-[560px] overflow-hidden rounded-[1.25rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,#10223b_0%,#06101f_44%,#02060d_100%)] shadow-[0_24px_80px_-42px_rgba(82,246,255,0.4)]'
      data-testid='architecture-scene-card'
    >
      {webglSupported ? (
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{
            position: [
              props.scene.bounds.centre.x + longestSide * 0.72,
              Math.max(38, longestSide * 0.68),
              props.scene.bounds.centre.z + longestSide * 0.86,
            ],
            fov: 42,
            near: 0.1,
            far: Math.max(800, longestSide * 8),
          }}
          onPointerMissed={() => props.onSelect(null)}
        >
          <Suspense fallback={null}>
            <CameraRig scene={props.scene} />
            <SceneContents {...props} />
          </Suspense>
        </Canvas>
      ) : (
        <div className='flex h-full items-center justify-center p-6'>
          <div className='max-w-md rounded-3xl border border-white/70 bg-white/85 p-6 text-center shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/85'>
            <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
              WebGL unavailable
            </p>
            <h3 className='mt-3 text-xl font-semibold'>
              Architecture preview unavailable
            </h3>
            <p className='mt-2 text-sm text-muted-foreground'>
              This environment cannot create a WebGL context, so the controls
              and inspector remain available without the 3D viewport.
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
    </div>
  )
}
