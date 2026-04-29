import { describe, expect, it } from 'vitest'
import { getFixtureScene } from './fixtures'
import type {
  CodeCityBuilding,
  CodeCityDistrict,
  CodeCitySceneModel,
} from './schema'
import {
  createBuildingFacadeCameraFocus,
  getBuildingRenderBaseYById,
  getBoundaryGroundLevels,
  getCodeCitySceneFrame,
  getCodeCitySearchResults,
  getCodeCityZoomTier,
  getFolderLabelOpacity,
  getLabelOpacity,
  getPlotCentre,
  getSceneBuildings,
  getZoneSurfaceTopY,
  isCodeCityArcVisible,
} from './scene-utils'

function stripSceneToBuilding(scene: CodeCitySceneModel, buildingId: string) {
  const keepTargetOnly = (district: CodeCityDistrict) => {
    const retainedChildren: CodeCityDistrict['children'] = []

    district.children.forEach((child) => {
      if (child.nodeType === 'building') {
        if (child.id === buildingId) {
          retainedChildren.push(child)
        }
        return
      }

      keepTargetOnly(child)
      if (child.children.length > 0) {
        retainedChildren.push(child)
      }
    })

    district.children = retainedChildren
  }

  scene.boundaries.forEach((boundary) => {
    boundary.zones.forEach((zone) => {
      zone.districts.forEach(keepTargetOnly)
    })
  })
}

describe('CodeCity scene helpers', () => {
  it('ranks direct label matches ahead of path-only matches', () => {
    const scene = getFixtureScene('star-shared-kernel')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    const results = getCodeCitySearchResults(scene, 'order', { limit: 5 })
    expect(results[0]?.building.label).toBe('order-aggregate.ts')
    expect(results.some((result) => result.matchReason === 'label')).toBe(true)
  })

  it('maps zoom distance into the expected label tier', () => {
    const scene = getFixtureScene('layered-world')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    expect(getCodeCityZoomTier(260, scene)).toBe('world')
    expect(getCodeCityZoomTier(140, scene)).toBe('district')
    expect(getCodeCityZoomTier(95, scene)).toBe('building')
    expect(getCodeCityZoomTier(58, scene)).toBe('detail')
    expect(getCodeCityZoomTier(24, scene)).toBe('detail')
  })

  it('keeps label opacity focused on the active zoom band', () => {
    const scene = getFixtureScene('layered-world')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    expect(getLabelOpacity('boundary', 210, scene)).toBeGreaterThan(0)
    expect(getLabelOpacity('zone', 210, scene)).toBe(0)

    expect(getLabelOpacity('zone', 130, scene)).toBeGreaterThan(
      getLabelOpacity('boundary', 130, scene),
    )

    expect(getLabelOpacity('district', 74, scene)).toBeGreaterThan(
      getLabelOpacity('building', 74, scene),
    )

    expect(getLabelOpacity('boundary', 74, scene)).toBe(0)
    expect(getLabelOpacity('zone', 74, scene)).toBe(0)
  })

  it('keeps top-level folder labels readable across zoom levels', () => {
    const scene = getFixtureScene('layered-world')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    expect(getFolderLabelOpacity(0, 260, scene)).toBeGreaterThan(0.85)
    expect(getFolderLabelOpacity(0, 72, scene)).toBeGreaterThan(0.85)
    expect(getFolderLabelOpacity(1, 140, scene)).toBeGreaterThan(0)
    expect(getFolderLabelOpacity(1, 260, scene)).toBe(0)
  })

  it('frames long, skinny live layouts without fixed-grid clipping', () => {
    const scene = getFixtureScene('star-shared-kernel')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    const skinnyScene = structuredClone(scene) as CodeCitySceneModel
    const boundary = skinnyScene.boundaries[0]!
    skinnyScene.boundaries = [boundary]
    boundary.ground = {
      kind: 'roundedRect',
      centre: { x: 6, y: -1.1, z: 145 },
      width: 12,
      depth: 290,
      height: 0.42,
      waterInset: 2.2,
      tint: '#103451',
    }

    const frame = getCodeCitySceneFrame(skinnyScene)

    expect(frame.bounds.depth).toBeGreaterThan(290)
    expect(frame.groundRadius).toBeGreaterThan(220)
    expect(frame.cameraMaxDistance).toBeGreaterThan(700)
    expect(frame.cameraFar).toBeGreaterThan(1400)
    expect(Math.abs(frame.bounds.centre.z - 145)).toBeLessThan(2)
  })

  it('stacks districts and buildings relative to boundary surfaces', () => {
    const scene = getFixtureScene('star-shared-kernel')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    const liveLikeScene = structuredClone(scene) as CodeCitySceneModel
    const boundary = liveLikeScene.boundaries[0]!
    const zone = boundary.zones[0]!
    zone.elevation = 0.34

    zone.districts.forEach((district) => {
      district.plot.y = 0
    })

    for (const building of getSceneBuildings(liveLikeScene)) {
      building.plot.y = 0
    }

    const zoneTopY = getZoneSurfaceTopY(boundary)
    const groundLevels = getBoundaryGroundLevels(boundary)
    const firstBuilding = getSceneBuildings(liveLikeScene)[0]

    expect(firstBuilding).toBeDefined()
    if (firstBuilding == null) {
      return
    }

    const buildingBaseY = getBuildingRenderBaseYById(liveLikeScene).get(
      firstBuilding.id,
    )

    expect(groundLevels.waterTopY).toBeLessThan(groundLevels.plinthTopY)
    expect(zoneTopY).toBeGreaterThan(groundLevels.plinthTopY)
    expect(buildingBaseY).toBeGreaterThan(zoneTopY)
  })

  it('creates a front-facing facade camera target for selected buildings', () => {
    const scene = getFixtureScene('star-shared-kernel')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    const building = getSceneBuildings(scene).find(
      (candidate) => candidate.filePath === 'src/domain/order-aggregate.ts',
    )

    expect(building).toBeDefined()
    if (building == null) {
      return
    }

    const focus = createBuildingFacadeCameraFocus(scene, building)
    expect(focus.label).toBe('order-aggregate.ts facade')
    expect(focus.position.y).toBe(focus.target.y)
    expect(
      Math.abs(focus.position.x - focus.target.x) +
        Math.abs(focus.position.z - focus.target.z),
    ).toBeGreaterThan(building.height)
  })

  it('chooses the least blocked facade side for selected buildings', () => {
    const scene = getFixtureScene('star-shared-kernel')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    const isolatedScene = structuredClone(scene) as CodeCitySceneModel
    const building = getSceneBuildings(isolatedScene).find(
      (candidate) => candidate.filePath === 'src/domain/order-aggregate.ts',
    )

    expect(building).toBeDefined()
    if (building == null) {
      return
    }

    stripSceneToBuilding(isolatedScene, building.id)

    const centre = getPlotCentre(building.plot)
    const blocker: CodeCityBuilding = {
      ...building,
      id: `${building.id}:south-blocker`,
      filePath: 'src/domain/south-blocker.ts',
      label: 'south-blocker.ts',
      plot: {
        ...building.plot,
        x: centre.x - building.plot.width / 2,
        z: centre.z + building.plot.depth / 2 + 0.45,
        width: building.plot.width,
        depth: 3,
      },
      height: building.height * 1.2,
    }

    isolatedScene.boundaries[0]!.zones[0]!.districts[0]!.children.push(blocker)

    const focus = createBuildingFacadeCameraFocus(isolatedScene, building)
    expect(focus.position.z).toBeLessThan(focus.target.z)
  })

  it('shows only the appropriate arc classes for selection and overlay state', () => {
    const scene = getFixtureScene('star-shared-kernel')
    expect(scene).not.toBeNull()
    if (scene == null) {
      return
    }

    const dependencyArc = scene.arcs.find((arc) => arc.arcType === 'dependency')
    const violationArc = scene.arcs.find((arc) => arc.arcType === 'violation')
    const crossBoundaryArc = scene.arcs.find(
      (arc) => arc.arcType === 'cross-boundary',
    )

    expect(dependencyArc).toBeDefined()
    expect(violationArc).toBeDefined()
    expect(crossBoundaryArc).toBeDefined()

    if (
      dependencyArc == null ||
      violationArc == null ||
      crossBoundaryArc == null
    ) {
      return
    }

    expect(
      isCodeCityArcVisible(dependencyArc, {
        selectedBuildingId: dependencyArc.fromId,
        showOverlays: false,
        zoomDistance: 80,
      }),
    ).toBe(true)

    expect(
      isCodeCityArcVisible(dependencyArc, {
        selectedBuildingId: dependencyArc.toId,
        showOverlays: false,
        zoomDistance: 80,
      }),
    ).toBe(true)

    expect(
      isCodeCityArcVisible(crossBoundaryArc, {
        selectedBuildingId: null,
        showOverlays: true,
        zoomDistance: 260,
      }),
    ).toBe(false)

    expect(
      isCodeCityArcVisible(violationArc, {
        selectedBuildingId: violationArc.fromId,
        showOverlays: false,
        zoomDistance: 80,
      }),
    ).toBe(false)

    expect(
      isCodeCityArcVisible(violationArc, {
        selectedBuildingId: violationArc.fromId,
        showOverlays: true,
        zoomDistance: 80,
      }),
    ).toBe(true)

    expect(
      isCodeCityArcVisible(crossBoundaryArc, {
        selectedBuildingId: crossBoundaryArc.toId,
        showOverlays: true,
        zoomDistance: 260,
      }),
    ).toBe(true)
  })
})
