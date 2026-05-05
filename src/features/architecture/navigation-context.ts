import { requestGraphQL } from '@/api/graphql/client'
import type {
  ArchitectureComponentNode,
  ArchitectureNavigationContext,
  ArchitectureNavigationContextAcceptance,
  ArchitectureNavigationContextChange,
  ArchitectureSceneModel,
} from './model'

const ARCHITECTURE_NAVIGATION_VIEW_ID = 'architecture_map'

const ARCHITECTURE_NAVIGATION_CONTEXT_QUERY = `
  query ArchitectureNavigationContext($repo: String!, $projectPath: String!, $filter: NavigationContextFilterInput) {
    repo(name: $repo) {
      project(path: $projectPath) {
        navigationContext(filter: $filter) {
          views {
            viewId
            viewKind
            label
            acceptedSignature
            currentSignature
            status
            staleReason
            materialisedRef
            updatedAt
            acceptanceHistory {
              acceptanceId
              source
              reason
              materialisedRef
              acceptedAt
            }
          }
          primitives {
            id
            kind
            label
            path
            sourceKind
            primitiveHash
          }
        }
      }
    }
  }
`

type DevqlNavigationContextStatus = 'FRESH' | 'STALE'

type DevqlNavigationContextAcceptance = {
  acceptanceId: string
  source: string
  reason: string | null
  materialisedRef: string | null
  acceptedAt: string
}

type DevqlNavigationContextView = {
  viewId: string
  viewKind: string
  label: string
  acceptedSignature: string
  currentSignature: string
  status: DevqlNavigationContextStatus
  staleReason: unknown
  materialisedRef: string | null
  updatedAt: string
  acceptanceHistory: DevqlNavigationContextAcceptance[]
}

type DevqlNavigationPrimitive = {
  id: string
  kind: string
  label: string
  path: string | null
  sourceKind: string
  primitiveHash: string
}

type DevqlNavigationContextQueryData = {
  repo: {
    project: {
      navigationContext: {
        views: DevqlNavigationContextView[]
        primitives: DevqlNavigationPrimitive[]
      }
    } | null
  } | null
}

type DevqlNavigationContextVariables = {
  repo: string
  projectPath: string
  filter: {
    viewId: string
  }
}

type RawNavigationChange = {
  primitiveId: string
  primitiveKind: string
  label: string | null
  path: string | null
  sourceKind: string | null
  changeKind: ArchitectureNavigationContextChange['changeKind']
  previousHash: string | null
  currentHash: string | null
}

export async function fetchArchitectureNavigationContext({
  repo,
  projectPath,
  signal,
}: {
  repo: string
  projectPath: string
  signal?: AbortSignal
}): Promise<ArchitectureNavigationContext | null> {
  try {
    const response = await requestGraphQL<
      DevqlNavigationContextQueryData,
      DevqlNavigationContextVariables
    >(
      ARCHITECTURE_NAVIGATION_CONTEXT_QUERY,
      {
        repo,
        projectPath,
        filter: {
          viewId: ARCHITECTURE_NAVIGATION_VIEW_ID,
        },
      },
      { signal },
    )

    if (response.errors?.length) {
      return null
    }

    const navigationContext = response.data?.repo?.project?.navigationContext
    const view = navigationContext?.views[0]
    if (view == null) {
      return null
    }

    return mapNavigationContextView(view, navigationContext?.primitives ?? [])
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw error
    }

    return null
  }
}

export function mapNavigationContextToScene(
  context: ArchitectureNavigationContext | null,
  scene: ArchitectureSceneModel,
): ArchitectureNavigationContext | null {
  if (context == null) {
    return null
  }

  const changedByComponentId: Record<string, string[]> = {}
  const changedPrimitives = context.changedPrimitives.map((change) => {
    const changedPath = change.path
    const mappedComponentIds = changedPath
      ? scene.components
          .filter((component) => componentMatchesPath(component, changedPath))
          .map((component) => component.id)
      : []

    for (const componentId of mappedComponentIds) {
      changedByComponentId[componentId] = [
        ...(changedByComponentId[componentId] ?? []),
        change.primitiveId,
      ]
    }

    return {
      ...change,
      mappedComponentIds,
    }
  })

  return {
    ...context,
    changedPrimitives,
    changedByComponentId,
  }
}

function mapNavigationContextView(
  view: DevqlNavigationContextView,
  primitives: DevqlNavigationPrimitive[],
): ArchitectureNavigationContext {
  const primitivesById = new Map(
    primitives.map((primitive) => [primitive.id, primitive]),
  )
  const changedPrimitives = rawChangesFromStaleReason(view.staleReason).map(
    (change): ArchitectureNavigationContextChange => {
      const primitive = primitivesById.get(change.primitiveId)

      return {
        primitiveId: change.primitiveId,
        primitiveKind: change.primitiveKind || primitive?.kind || 'UNKNOWN',
        label: change.label ?? primitive?.label ?? null,
        path: change.path ?? primitive?.path ?? null,
        sourceKind: change.sourceKind ?? primitive?.sourceKind ?? null,
        changeKind: change.changeKind,
        previousHash: change.previousHash,
        currentHash: change.currentHash ?? primitive?.primitiveHash ?? null,
        mappedComponentIds: [],
      }
    },
  )
  const changedByPath: Record<string, string[]> = {}
  for (const change of changedPrimitives) {
    if (change.path == null) {
      continue
    }
    changedByPath[change.path] = [
      ...(changedByPath[change.path] ?? []),
      change.primitiveId,
    ]
  }

  return {
    viewId: view.viewId,
    viewKind: view.viewKind,
    label: view.label,
    status: view.status === 'STALE' ? 'stale' : 'fresh',
    reviewState: view.acceptanceHistory.length > 0 ? 'accepted' : 'unreviewed',
    acceptedSignature: view.acceptedSignature,
    currentSignature: view.currentSignature,
    materialisedRef: view.materialisedRef,
    updatedAt: view.updatedAt,
    changeCount:
      numberProperty(view.staleReason, 'changeCount') ??
      changedPrimitives.length,
    changedPrimitiveIds: changedPrimitives.map((change) => change.primitiveId),
    changedPrimitives,
    changedByPath,
    changedByComponentId: {},
    acceptanceHistory: view.acceptanceHistory.map(mapAcceptance),
  }
}

function mapAcceptance(
  acceptance: DevqlNavigationContextAcceptance,
): ArchitectureNavigationContextAcceptance {
  return {
    acceptanceId: acceptance.acceptanceId,
    source: acceptance.source,
    reason: acceptance.reason,
    acceptedAt: acceptance.acceptedAt,
    materialisedRef: acceptance.materialisedRef,
  }
}

function rawChangesFromStaleReason(reason: unknown): RawNavigationChange[] {
  const rawChanges = arrayProperty(reason, 'changedPrimitives')

  return rawChanges
    .map((item) => {
      if (typeof item !== 'object' || item == null) {
        return null
      }
      const value = item as Record<string, unknown>
      const primitiveId = stringValue(value.primitiveId)
      if (primitiveId == null) {
        return null
      }

      return {
        primitiveId,
        primitiveKind: stringValue(value.primitiveKind) ?? 'UNKNOWN',
        label: stringValue(value.label),
        path: stringValue(value.path),
        sourceKind: stringValue(value.sourceKind),
        changeKind: changeKindValue(value.changeKind),
        previousHash: stringValue(value.previousHash),
        currentHash: stringValue(value.currentHash),
      }
    })
    .filter((change): change is RawNavigationChange => change != null)
}

function componentMatchesPath(
  component: ArchitectureComponentNode,
  path: string,
) {
  const componentPath = normalisePath(component.path)
  const changedPath = normalisePath(path)
  if (changedPath == null) {
    return false
  }

  if (
    componentPath != null &&
    (changedPath === componentPath ||
      changedPath.startsWith(`${componentPath}/`) ||
      componentPath.startsWith(`${changedPath}/`))
  ) {
    return true
  }

  return component.filePaths.some((filePath) => {
    const normalisedFilePath = normalisePath(filePath)
    return (
      normalisedFilePath === changedPath ||
      normalisedFilePath?.startsWith(`${changedPath}/`) === true
    )
  })
}

function normalisePath(path: string | null | undefined) {
  const trimmed = path?.trim()
  if (trimmed == null || trimmed.length === 0 || trimmed === '.') {
    return null
  }

  return trimmed.replace(/\/+$/u, '')
}

function arrayProperty(value: unknown, key: string): unknown[] {
  if (typeof value !== 'object' || value == null) {
    return []
  }

  const field = (value as Record<string, unknown>)[key]
  return Array.isArray(field) ? field : []
}

function numberProperty(value: unknown, key: string) {
  if (typeof value !== 'object' || value == null) {
    return null
  }

  const field = (value as Record<string, unknown>)[key]
  return typeof field === 'number' ? field : null
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim().length > 0 ? value : null
}

function changeKindValue(
  value: unknown,
): ArchitectureNavigationContextChange['changeKind'] {
  if (value === 'added' || value === 'removed' || value === 'hash_changed') {
    return value
  }

  return 'changed'
}
