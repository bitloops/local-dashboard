import type { DashboardRepositoryOption } from '@/features/dashboard/api-types'
import { fetchAtlasArchitectureFacts } from '@/features/code-city/architecture-graph'
import { loadCodeCityScene } from '@/features/code-city/load-code-city-scene'
import { CODE_CITY_LIVE_DATASET_ID } from '@/features/code-city/sources'
import { buildArchitectureScene, type ArchitectureSceneModel } from './model'
import {
  fetchArchitectureNavigationContext,
  mapNavigationContextToScene,
} from './navigation-context'

export type LoadArchitectureSceneInput = {
  repository: DashboardRepositoryOption
  projectPath?: string
  first?: number
  signal?: AbortSignal
}

export async function loadArchitectureScene({
  repository,
  projectPath = '.',
  first = 500,
  signal,
}: LoadArchitectureSceneInput): Promise<ArchitectureSceneModel> {
  const [codeCityScene, architectureFacts, navigationContext] =
    await Promise.all([
      loadCodeCityScene({
        datasetId: CODE_CITY_LIVE_DATASET_ID,
        repoId: repository.repoId,
        projectPath,
        first,
        signal,
      }),
      fetchAtlasArchitectureFacts({
        repo: repository.name,
        projectPath,
        first,
        signal,
      }),
      fetchArchitectureNavigationContext({
        repo: repository.name,
        projectPath,
        signal,
      }),
    ])

  const scene = buildArchitectureScene({
    codeCityScene,
    repositoryLabel: repository.identity,
    graphNodes: architectureFacts.graphNodes,
    graphEdges: architectureFacts.graphEdges,
  })

  return {
    ...scene,
    navigationContext: mapNavigationContextToScene(navigationContext, scene),
  }
}
