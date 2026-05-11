import { codeCityFixtureCatalogue, getFixtureScene } from './fixtures'
import { fetchDevqlCodeCityScene } from './devql'
import { codeCitySceneModelSchema, type CodeCitySceneModel } from './schema'
import { isLiveCodeCityDataset } from './sources'

export type LoadCodeCitySceneInput = {
  datasetId: string
  repoId?: string | null
  projectPath?: string
  first?: number
  signal?: AbortSignal
}

function cloneScene(scene: CodeCitySceneModel): CodeCitySceneModel {
  if (typeof structuredClone === 'function') {
    return structuredClone(scene)
  }

  return JSON.parse(JSON.stringify(scene)) as CodeCitySceneModel
}

export async function loadCodeCityScene({
  datasetId,
  repoId,
  projectPath,
  first,
  signal,
}: LoadCodeCitySceneInput): Promise<CodeCitySceneModel> {
  if (isLiveCodeCityDataset(datasetId)) {
    return fetchDevqlCodeCityScene({
      repoId,
      projectPath,
      first,
      signal,
    })
  }

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
