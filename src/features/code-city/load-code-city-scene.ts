import { codeCityFixtureCatalogue, getFixtureScene } from './fixtures'
import { codeCitySceneModelSchema, type CodeCitySceneModel } from './schema'

export type LoadCodeCitySceneInput = {
  datasetId: string
}

function cloneScene(scene: CodeCitySceneModel): CodeCitySceneModel {
  if (typeof structuredClone === 'function') {
    return structuredClone(scene)
  }

  return JSON.parse(JSON.stringify(scene)) as CodeCitySceneModel
}

export async function loadCodeCityScene({
  datasetId,
}: LoadCodeCitySceneInput): Promise<CodeCitySceneModel> {
  const scene = getFixtureScene(datasetId)

  if (scene == null) {
    throw new Error(
      `Unknown Code Atlas dataset "${datasetId}". Available datasets: ${codeCityFixtureCatalogue
        .map((item) => item.id)
        .join(', ')}`,
    )
  }

  return codeCitySceneModelSchema.parse(cloneScene(scene))
}
