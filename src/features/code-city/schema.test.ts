import { describe, expect, it } from 'vitest'
import { codeCityDatasetOptions, codeCityFixtureCatalogue } from './fixtures'
import { codeCitySceneModelSchema } from './schema'

describe('CodeCity schema and fixtures', () => {
  it('validates every fixture scene against the canonical schema', () => {
    expect(codeCityFixtureCatalogue).toHaveLength(4)

    for (const scene of codeCityFixtureCatalogue) {
      expect(() => codeCitySceneModelSchema.parse(scene)).not.toThrow()
      expect(scene.crossBoundaryArcs.length).toBeGreaterThan(0)
      expect(scene.arcs.some((arc) => arc.arcType === 'violation')).toBe(true)
      expect(
        scene.boundaries.some(
          (boundary) => boundary.architecture === 'hexagonal',
        ),
      ).toBe(true)
      expect(
        scene.boundaries.some((boundary) =>
          boundary.zones.some((zone) => zone.zoneType === 'test'),
        ),
      ).toBe(true)
    }
  })

  it('publishes dataset options for every fixture scene', () => {
    expect(codeCityDatasetOptions.map((option) => option.id)).toEqual(
      codeCityFixtureCatalogue.map((scene) => scene.id),
    )
    expect(
      codeCityDatasetOptions.every(
        (option) => option.summary.trim().length > 0,
      ),
    ).toBe(true)
  })
})
