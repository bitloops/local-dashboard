import type { ReactNode, Ref } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import {
  buildArchitectureScene,
  type ArchitectureNavigationContext,
  type ArchitectureSceneModel,
} from '@/features/architecture/model'
import { ArchitectureCanvas } from '@/features/architecture/components/architecture-canvas'
import { ArchitectureSystemHub } from '@/features/architecture/components/architecture-system-hub'
import { CodeCityCanvas } from '@/features/code-city/components/code-city-canvas'
import { getFixtureScene } from '@/features/code-city/fixtures'
import type {
  CodeCityBuilding,
  CodeCityDistrict,
  CodeCitySceneModel,
} from '@/features/code-city/schema'

type MutableRef<T> = {
  current: T | null
}

type MockVector = {
  set: ReturnType<typeof vi.fn>
  lerp: ReturnType<typeof vi.fn>
  copy: ReturnType<typeof vi.fn>
}

type MockControls = {
  target: MockVector
  update: ReturnType<typeof vi.fn>
}

type MockPointerEvent = {
  stopPropagation: () => void
  point: {
    x: number
    y: number
    z: number
  }
  nativeEvent: {
    clientX: number
    clientY: number
  }
}

type MockThreeComponentProps = {
  children?: ReactNode
  onClick?: (event: MockPointerEvent) => void
  onDoubleClick?: (event: MockPointerEvent) => void
  onPointerEnter?: (event: MockPointerEvent) => void
  onPointerLeave?: (event: MockPointerEvent) => void
}

const canvasMockState = vi.hoisted(() => ({
  frameCallbacks: [] as Array<() => void>,
  setClearColor: vi.fn(),
  updateProjectionMatrix: vi.fn(),
  lookAt: vi.fn(),
  cameraPositionSet: vi.fn(),
  cameraPositionLerp: vi.fn(),
  cameraPositionCopy: vi.fn(),
  cameraDistanceTo: vi.fn(() => 120),
  controlsTargetSet: vi.fn(),
  controlsTargetLerp: vi.fn(),
  controlsUpdate: vi.fn(),
}))

vi.mock('@react-three/fiber', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  return {
    Canvas: ({
      children,
      onPointerMissed,
    }: {
      children?: ReactNode
      onPointerMissed?: () => void
    }) =>
      React.createElement(
        'div',
        {
          'data-testid': 'mock-r3f-canvas',
          onClick: () => onPointerMissed?.(),
        },
        children,
      ),
    useFrame: (callback: () => void) => {
      canvasMockState.frameCallbacks.push(callback)
    },
    useThree: () => ({
      camera: {
        far: 0,
        lookAt: canvasMockState.lookAt,
        updateProjectionMatrix: canvasMockState.updateProjectionMatrix,
        position: {
          set: canvasMockState.cameraPositionSet,
          lerp: canvasMockState.cameraPositionLerp,
          copy: canvasMockState.cameraPositionCopy,
          distanceTo: canvasMockState.cameraDistanceTo,
        },
      },
      gl: {
        setClearColor: canvasMockState.setClearColor,
      },
    }),
  }
})

vi.mock('@react-three/drei', async () => {
  const React = await vi.importActual<typeof import('react')>('react')

  const pointerEvent = (): MockPointerEvent => ({
    stopPropagation: vi.fn(),
    point: { x: 1, y: 2, z: 3 },
    nativeEvent: { clientX: 42, clientY: 84 },
  })

  const assignRef = (ref: Ref<MockControls>, value: MockControls) => {
    if (typeof ref === 'function') {
      ref(value)
      return
    }

    if (ref != null) {
      const mutableRef = ref as MutableRef<MockControls>
      mutableRef.current = value
    }
  }

  const createComponent = (name: string) =>
    React.forwardRef<MockControls, MockThreeComponentProps>(
      (
        { children, onClick, onDoubleClick, onPointerEnter, onPointerLeave },
        ref,
      ) => {
        assignRef(ref, {
          target: {
            set: canvasMockState.controlsTargetSet,
            lerp: canvasMockState.controlsTargetLerp,
            copy: vi.fn(),
          },
          update: canvasMockState.controlsUpdate,
        })

        return React.createElement(
          'div',
          {
            'data-testid': `mock-${name}`,
            onClick: () => onClick?.(pointerEvent()),
            onDoubleClick: () => onDoubleClick?.(pointerEvent()),
            onMouseEnter: () => onPointerEnter?.(pointerEvent()),
            onMouseLeave: () => onPointerLeave?.(pointerEvent()),
          },
          children,
        )
      },
    )

  return {
    Billboard: createComponent('Billboard'),
    ContactShadows: createComponent('ContactShadows'),
    Edges: createComponent('Edges'),
    Html: createComponent('Html'),
    OrbitControls: createComponent('OrbitControls'),
    QuadraticBezierLine: createComponent('QuadraticBezierLine'),
    RoundedBox: createComponent('RoundedBox'),
    Text: createComponent('Text'),
  }
})

function forceWebGLSupport() {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: 'Chrome',
  })
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
    {} as RenderingContext,
  )
}

function fixtureScene(id: string): CodeCitySceneModel {
  const scene = getFixtureScene(id)
  if (scene == null) {
    throw new Error(`Missing fixture scene ${id}`)
  }

  return scene
}

function collectBuildings(districts: CodeCityDistrict[]): CodeCityBuilding[] {
  return districts.flatMap((district) =>
    district.children.flatMap((child) =>
      child.nodeType === 'building' ? [child] : collectBuildings([child]),
    ),
  )
}

function firstBuilding(scene: CodeCitySceneModel): CodeCityBuilding {
  const building = scene.boundaries
    .flatMap((boundary) => boundary.zones)
    .flatMap((zone) => collectBuildings(zone.districts))[0]

  if (building == null) {
    throw new Error('Fixture scene has no buildings')
  }

  return building
}

beforeEach(() => {
  forceWebGLSupport()
  canvasMockState.frameCallbacks.length = 0
  canvasMockState.setClearColor.mockClear()
  canvasMockState.updateProjectionMatrix.mockClear()
  canvasMockState.lookAt.mockClear()
  canvasMockState.cameraPositionSet.mockClear()
  canvasMockState.cameraPositionLerp.mockClear()
  canvasMockState.cameraPositionCopy.mockClear()
  canvasMockState.cameraDistanceTo.mockClear()
  canvasMockState.cameraDistanceTo.mockReturnValue(120)
  canvasMockState.controlsTargetSet.mockClear()
  canvasMockState.controlsTargetLerp.mockClear()
  canvasMockState.controlsUpdate.mockClear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('visualisation canvas coverage', () => {
  it('renders the Code City WebGL scene path with selected building chrome', () => {
    const scene = fixtureScene('layered-world')
    const selectedBuilding = firstBuilding(scene)
    const onSelectBuilding = vi.fn()

    render(
      <CodeCityCanvas
        scene={scene}
        selectedBuildingId={selectedBuilding.id}
        showLabels
        showTests
        showBase
        showZones
        showFolders
        showBuildings
        showFloors
        showProps={false}
        showOverlays
        cameraFocus={null}
        zoomDistance={82}
        onSelectBuilding={onSelectBuilding}
        onInspectBuilding={vi.fn()}
        onCameraControlStart={vi.fn()}
        onZoomDistanceChange={vi.fn()}
      />,
    )

    expect(screen.getByTestId('code-city-scene-card')).toBeInTheDocument()
    expect(screen.getByText(/Orbit, pan, zoom/)).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`Selected: ${selectedBuilding.label}`)),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mock-r3f-canvas'))

    expect(onSelectBuilding).toHaveBeenCalledWith(null)
    expect(canvasMockState.setClearColor).toHaveBeenCalled()
  })

  it('renders the Architecture Canvas WebGL scene path with all overlays enabled', () => {
    const codeCityScene = fixtureScene('star-shared-kernel')
    const baseScene = buildArchitectureScene({
      codeCityScene,
      repositoryLabel: 'bitloops/bitloops',
    })
    const selectedComponent = baseScene.components[0]
    if (selectedComponent == null) {
      throw new Error('Architecture fixture has no components')
    }
    const scene: ArchitectureSceneModel = {
      ...baseScene,
      navigationContext: {
        viewId: 'architecture_map',
        viewKind: 'architecture',
        label: 'Architecture Map',
        status: 'stale',
        reviewState: 'unreviewed',
        acceptedSignature: 'old',
        currentSignature: 'new',
        materialisedRef: null,
        updatedAt: '2026-05-10T00:00:00.000Z',
        changeCount: 1,
        changedPrimitiveIds: ['primitive:one'],
        changedPrimitives: [
          {
            primitiveId: 'primitive:one',
            primitiveKind: 'COMPONENT',
            label: selectedComponent.label,
            path: selectedComponent.path,
            sourceKind: 'COMPUTED',
            changeKind: 'hash_changed',
            previousHash: 'old',
            currentHash: 'new',
            mappedComponentIds: [selectedComponent.id],
          },
        ],
        changedByPath: {
          [selectedComponent.path ?? selectedComponent.id]: ['primitive:one'],
        },
        changedByComponentId: {
          [selectedComponent.id]: ['primitive:one'],
        },
        acceptanceHistory: [],
      },
    }
    const onSelect = vi.fn()

    render(
      <ArchitectureCanvas
        scene={scene}
        selectedId={selectedComponent.id}
        showLabels
        showContracts
        showDirectConnections
        showEntryPoints
        showDeployments
        showPersistence
        showDataConnections
        onSelect={onSelect}
      />,
    )

    expect(screen.getByTestId('architecture-scene-card')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('mock-r3f-canvas'))

    expect(onSelect).toHaveBeenCalledWith(null)
    expect(canvasMockState.setClearColor).toHaveBeenCalled()
  })

  it('renders the Architecture System Hub overview and navigates into a focused level', () => {
    const codeCityScene = fixtureScene('tangled-world')
    const baseScene = buildArchitectureScene({
      codeCityScene,
      repositoryLabel: 'bitloops/bitloops',
    })
    const selectedComponent = baseScene.components[0]
    const navigationContext: ArchitectureNavigationContext | null =
      selectedComponent == null
        ? null
        : {
            viewId: 'architecture_map',
            viewKind: 'architecture',
            label: 'Architecture Map',
            status: 'stale',
            reviewState: 'accepted',
            acceptedSignature: 'accepted-signature',
            currentSignature: 'current-signature',
            materialisedRef: 'refs/bitloops/architecture',
            updatedAt: '2026-05-10T00:00:00.000Z',
            changeCount: 2,
            changedPrimitiveIds: ['primitive:one', 'primitive:two'],
            changedPrimitives: [
              {
                primitiveId: 'primitive:one',
                primitiveKind: 'COMPONENT',
                label: selectedComponent.label,
                path: selectedComponent.path,
                sourceKind: 'COMPUTED',
                changeKind: 'changed',
                previousHash: 'old',
                currentHash: 'new',
                mappedComponentIds: [selectedComponent.id],
              },
            ],
            changedByPath:
              selectedComponent.path == null
                ? {}
                : { [selectedComponent.path]: ['primitive:one'] },
            changedByComponentId: {
              [selectedComponent.id]: ['primitive:one'],
            },
            acceptanceHistory: [
              {
                acceptanceId: 'acceptance:one',
                source: 'user',
                reason: 'Reviewed',
                acceptedAt: '2026-05-10T00:01:00.000Z',
                materialisedRef: 'refs/bitloops/architecture',
              },
            ],
          }
    const scene: ArchitectureSceneModel = {
      ...baseScene,
      navigationContext,
    }

    render(<ArchitectureSystemHub scene={scene} />)

    const hub = screen.getByTestId('architecture-system-hub')
    expect(hub).toBeInTheDocument()
    expect(
      screen.getByTestId('architecture-container-carousel'),
    ).toBeInTheDocument()

    fireEvent.keyDown(hub, { key: 'ArrowDown' })
    fireEvent.keyDown(hub, { key: 'ArrowRight' })
    fireEvent.click(
      screen.getByTestId('architecture-hub-menu-option-menu-state'),
    )

    expect(screen.getByText('State and persistence')).toBeInTheDocument()

    fireEvent.click(screen.getByTestId('architecture-system-hub-fullscreen'))
    expect(
      screen.getByRole('button', { name: 'Exit full screen' }),
    ).toBeInTheDocument()
  })
})
