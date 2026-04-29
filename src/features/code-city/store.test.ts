import { describe, expect, it } from 'vitest'
import { getFixtureScene } from './fixtures'
import { getSceneBuildings } from './scene-utils'
import { createCodeCityUiStore } from './store'

describe('CodeCity UI store', () => {
  it('resets scene state when switching datasets', () => {
    const store = createCodeCityUiStore()

    store.getState().setSearchQuery('order')
    store.getState().setSelectedBuildingId('building-1')
    store.getState().toggleLayer('labels')
    store.getState().setDatasetId('federated-world')

    const state = store.getState()
    expect(state.datasetId).toBe('federated-world')
    expect(state.searchQuery).toBe('')
    expect(state.selectedBuildingId).toBeNull()
    expect(state.cameraFocus).toBeNull()
    expect(state.showLabels).toBe(false)
  })

  it('focuses a building and creates a camera target', () => {
    const store = createCodeCityUiStore()
    const scene = getFixtureScene('star-shared-kernel')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    const targetBuilding = getSceneBuildings(scene).find(
      (building) => building.filePath === 'src/domain/order-aggregate.ts',
    )
    const targetBuildingId = targetBuilding?.id
    expect(targetBuildingId).toBeDefined()
    if (targetBuilding == null || targetBuildingId == null) {
      return
    }

    store.getState().focusBuilding(scene, targetBuildingId, {
      focusCamera: true,
    })

    const state = store.getState()
    expect(state.selectedBuildingId).toBe(targetBuildingId)
    expect(state.cameraFocus?.label).toBe('order-aggregate.ts')
    expect(state.cameraFocus?.position[1]).toBeGreaterThan(
      targetBuilding.plot.y + targetBuilding.height,
    )
  })

  it('resolves preset focus into camera state', () => {
    const store = createCodeCityUiStore()
    const scene = getFixtureScene('tangled-world')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    store.getState().focusPreset(scene, 'legacy-hotspot')

    const state = store.getState()
    expect(state.activePresetId).toBe('legacy-hotspot')
    expect(state.cameraFocus?.label).toBe('Legacy hotspot')
    expect(state.cameraFocus?.target).toEqual([-8, 8, -12])
  })
})
