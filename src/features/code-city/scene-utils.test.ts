import { describe, expect, it } from 'vitest'
import { getFixtureScene } from './fixtures'
import {
  getCodeCitySearchResults,
  getCodeCityZoomTier,
  getFolderLabelOpacity,
  getLabelOpacity,
  isCodeCityArcVisible,
} from './scene-utils'

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
      isCodeCityArcVisible(violationArc, {
        selectedBuildingId: null,
        showOverlays: false,
        zoomDistance: 80,
      }),
    ).toBe(false)

    expect(
      isCodeCityArcVisible(violationArc, {
        selectedBuildingId: null,
        showOverlays: true,
        zoomDistance: 80,
      }),
    ).toBe(true)

    expect(
      isCodeCityArcVisible(crossBoundaryArc, {
        selectedBuildingId: null,
        showOverlays: true,
        zoomDistance: 260,
      }),
    ).toBe(true)
  })
})
