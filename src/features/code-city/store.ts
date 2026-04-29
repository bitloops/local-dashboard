import { createStore } from 'zustand'
import { useStore as useZustandStore } from 'zustand'
import type { CodeCitySceneModel, CodeCityVector3 } from './schema'
import {
  createBuildingFacadeCameraFocus,
  createBuildingCameraFocus,
  createPresetCameraFocus,
  getBuildingById,
  resolveCodeCityCameraPreset,
} from './scene-utils'

export type CodeCityLayerToggle = 'labels' | 'tests' | 'props' | 'overlays'

export type CodeCityCameraFocus = {
  sequence: number
  label: string
  position: [number, number, number]
  target: [number, number, number]
}

export type CodeCityUiState = {
  datasetId: string
  searchQuery: string
  selectedBuildingId: string | null
  hoveredBuildingId: string | null
  hoverScreenPoint: {
    x: number
    y: number
  } | null
  activePresetId: string | null
  showLabels: boolean
  showTests: boolean
  showProps: boolean
  showOverlays: boolean
  zoomDistance: number
  cameraFocus: CodeCityCameraFocus | null
  setDatasetId: (datasetId: string) => void
  setSearchQuery: (value: string) => void
  setSelectedBuildingId: (buildingId: string | null) => void
  setHoveredBuilding: (
    buildingId: string | null,
    point?: {
      x: number
      y: number
    } | null,
  ) => void
  setActivePresetId: (presetId: string | null) => void
  toggleLayer: (layer: CodeCityLayerToggle) => void
  setZoomDistance: (value: number) => void
  setCameraFocus: (
    focus: {
      label: string
      position: CodeCityVector3
      target: CodeCityVector3
    } | null,
  ) => void
  focusBuilding: (
    scene: CodeCitySceneModel,
    buildingId: string | null,
    options?: {
      focusCamera?: boolean
      cameraMode?: 'oblique' | 'facade'
    },
  ) => void
  focusPreset: (scene: CodeCitySceneModel, presetId: string | null) => void
  resetSceneUi: () => void
}

type CodeCityUiStateInput = Pick<
  CodeCityUiState,
  | 'datasetId'
  | 'searchQuery'
  | 'selectedBuildingId'
  | 'hoveredBuildingId'
  | 'hoverScreenPoint'
  | 'activePresetId'
  | 'showLabels'
  | 'showTests'
  | 'showProps'
  | 'showOverlays'
  | 'zoomDistance'
  | 'cameraFocus'
>

const DEFAULT_DATASET_ID = 'star-shared-kernel'

function toTuple(vector: CodeCityVector3) {
  return [vector.x, vector.y, vector.z] as [number, number, number]
}

function buildCameraFocus(
  focus: {
    label: string
    position: CodeCityVector3
    target: CodeCityVector3
  },
  sequence: number,
): CodeCityCameraFocus {
  return {
    sequence,
    label: focus.label,
    position: toTuple(focus.position),
    target: toTuple(focus.target),
  }
}

function createInitialState(
  overrides?: Partial<CodeCityUiStateInput>,
): CodeCityUiStateInput {
  return {
    datasetId: DEFAULT_DATASET_ID,
    searchQuery: '',
    selectedBuildingId: null,
    hoveredBuildingId: null,
    hoverScreenPoint: null,
    activePresetId: null,
    showLabels: true,
    showTests: true,
    showProps: true,
    showOverlays: true,
    zoomDistance: 120,
    cameraFocus: null,
    ...overrides,
  }
}

export function createCodeCityUiStore(
  overrides?: Partial<CodeCityUiStateInput>,
) {
  let focusSequence = 0
  const initialState = createInitialState(overrides)

  return createStore<CodeCityUiState>()((set) => ({
    ...initialState,
    setDatasetId: (datasetId) =>
      set(() => ({
        datasetId,
        searchQuery: '',
        selectedBuildingId: null,
        hoveredBuildingId: null,
        hoverScreenPoint: null,
        activePresetId: null,
        cameraFocus: null,
      })),
    setSearchQuery: (searchQuery) => set(() => ({ searchQuery })),
    setSelectedBuildingId: (selectedBuildingId) =>
      set(() => ({ selectedBuildingId })),
    setHoveredBuilding: (hoveredBuildingId, hoverScreenPoint = null) =>
      set(() => ({ hoveredBuildingId, hoverScreenPoint })),
    setActivePresetId: (activePresetId) => set(() => ({ activePresetId })),
    toggleLayer: (layer) =>
      set((state) => {
        if (layer === 'labels') {
          return { showLabels: !state.showLabels }
        }

        if (layer === 'tests') {
          return { showTests: !state.showTests }
        }

        if (layer === 'props') {
          return { showProps: !state.showProps }
        }

        return { showOverlays: !state.showOverlays }
      }),
    setZoomDistance: (zoomDistance) => set(() => ({ zoomDistance })),
    setCameraFocus: (focus) =>
      set(() => {
        if (focus == null) {
          return { cameraFocus: null }
        }

        focusSequence += 1
        return { cameraFocus: buildCameraFocus(focus, focusSequence) }
      }),
    focusBuilding: (scene, buildingId, options) =>
      set(() => {
        const building = getBuildingById(scene, buildingId)
        if (building == null) {
          return { selectedBuildingId: null }
        }

        if (!options?.focusCamera) {
          return {
            selectedBuildingId: building.id,
            activePresetId: null,
          }
        }

        focusSequence += 1
        return {
          selectedBuildingId: building.id,
          activePresetId: null,
          cameraFocus: buildCameraFocus(
            options.cameraMode === 'facade'
              ? createBuildingFacadeCameraFocus(scene, building)
              : createBuildingCameraFocus(building),
            focusSequence,
          ),
        }
      }),
    focusPreset: (scene, presetId) =>
      set(() => {
        const preset = resolveCodeCityCameraPreset(scene, presetId)
        if (preset == null) {
          return {}
        }

        focusSequence += 1
        return {
          activePresetId: preset.id,
          cameraFocus: buildCameraFocus(
            createPresetCameraFocus(preset),
            focusSequence,
          ),
        }
      }),
    resetSceneUi: () =>
      set(() => createInitialState({ datasetId: DEFAULT_DATASET_ID })),
  }))
}

export const codeCityUiStore = createCodeCityUiStore()

export function useCodeCityStore<T>(
  selector: (state: CodeCityUiState) => T,
): T {
  return useZustandStore(codeCityUiStore, selector)
}

export const selectVisibleLayerState = (state: CodeCityUiState) => ({
  showLabels: state.showLabels,
  showTests: state.showTests,
  showProps: state.showProps,
  showOverlays: state.showOverlays,
})
