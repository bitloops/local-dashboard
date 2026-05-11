import { describe, expect, it } from 'vitest'
import { codeCityDatasetOptions, codeCityFixtureCatalogue } from './fixtures'
import { codeCitySceneModelSchema } from './schema'
import { getSceneBuildings } from './scene-utils'
import { CODE_CITY_LIVE_DATASET_ID } from './sources'

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

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
    expect(codeCityDatasetOptions.map((option) => option.id)).toEqual([
      CODE_CITY_LIVE_DATASET_ID,
      ...codeCityFixtureCatalogue.map((scene) => scene.id),
    ])
    expect(
      codeCityDatasetOptions.every(
        (option) => option.summary.trim().length > 0,
      ),
    ).toBe(true)
  })

  it('uses clear green-to-red health colours in fixture legends', () => {
    for (const scene of codeCityFixtureCatalogue) {
      expect(scene.config.colours.healthy).toBe('#22A66A')
      expect(scene.config.colours.moderate).toBe('#D5D957')
      expect(scene.config.colours.highRisk).toBe('#E0444E')
      expect(scene.legend.healthStops.map((stop) => stop.colour)).toEqual([
        '#22A66A',
        '#D5D957',
        '#E0444E',
      ])
    }
  })

  it('keeps every mock arc anchored to concrete buildings', () => {
    for (const scene of codeCityFixtureCatalogue) {
      const buildingIds = new Set(
        getSceneBuildings(scene, { includeTests: true }).map(
          (building) => building.id,
        ),
      )

      for (const arc of scene.arcs) {
        expect(buildingIds.has(arc.fromId)).toBe(true)
        expect(buildingIds.has(arc.toId)).toBe(true)
      }
    }
  })

  it('uses artefact names rather than artefact types for floors', () => {
    for (const scene of codeCityFixtureCatalogue) {
      const buildings = getSceneBuildings(scene, { includeTests: true })

      for (const building of buildings) {
        for (const floor of building.floors) {
          expect(floor.artefactName).not.toBe(floor.artefactKind)
          expect(floor.artefactName).not.toMatch(/^\d+\.\s/u)
          expect(floor.artefactName).not.toContain('.ts')
        }
      }
    }
  })

  it('varies building footprints enough for importance to read visually', () => {
    for (const scene of codeCityFixtureCatalogue) {
      const buildings = getSceneBuildings(scene, { includeTests: false }).sort(
        (left, right) => left.importance - right.importance,
      )
      const footprints = buildings.map((building) => building.footprint)
      const smallest = Math.min(...footprints)
      const largest = Math.max(...footprints)
      const comparisonSize = Math.max(2, Math.floor(buildings.length / 4))
      const lowestImportance = buildings.slice(0, comparisonSize)
      const highestImportance = buildings.slice(-comparisonSize)

      expect(largest / smallest).toBeGreaterThan(2.1)
      expect(
        average(highestImportance.map((building) => building.footprint)),
      ).toBeGreaterThan(
        average(lowestImportance.map((building) => building.footprint)) * 1.35,
      )
    }
  })
})
