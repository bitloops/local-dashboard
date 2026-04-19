import {
  requestDashboardGraphQL,
  subscribeDashboardGraphQL,
} from '@/api/dashboard/client'
import { GraphQLRequestError } from '@/api/graphql/errors'
import type {
  GraphQLRequestOptions,
  GraphQLResponseEnvelope,
} from '@/api/graphql/types'
import type {
  DashboardCheckpointDetailResponse,
  DashboardCommitRowDto,
  DashboardInteractionSessionDetailResponse,
  DashboardInteractionSessionDto,
  DashboardInteractionUpdateDto,
  DashboardRepositoryOption,
} from '../api-types'
import type { UserOption } from '../types'
import {
  DASHBOARD_AGENTS_QUERY,
  DASHBOARD_BRANCHES_QUERY,
  DASHBOARD_CHECKPOINT_DETAIL_QUERY,
  DASHBOARD_COMMITS_QUERY,
  DASHBOARD_INTERACTION_SESSIONS_QUERY,
  DASHBOARD_INTERACTION_SESSION_DETAIL_QUERY,
  DASHBOARD_INTERACTION_UPDATES_SUBSCRIPTION,
  DASHBOARD_REPOSITORIES_QUERY,
  DASHBOARD_USERS_QUERY,
} from './operations'
import {
  mapDashboardAgents,
  mapDashboardBranches,
  mapDashboardCheckpointDetail,
  mapDashboardCommitRows,
  mapDashboardInteractionSessionDetail,
  mapDashboardInteractionSessions,
  mapDashboardInteractionUpdate,
  mapDashboardRepositories,
  mapDashboardUsers,
} from './mappers'
import { mapAgentOptions, mapUserOptions } from '../utils'
import type {
  DashboardAgentsQueryData,
  DashboardBranchesQueryData,
  DashboardCheckpointDetailQueryData,
  DashboardCommitsQueryData,
  DashboardInteractionSessionsQueryData,
  DashboardInteractionSessionDetailQueryData,
  DashboardInteractionUpdatesSubscriptionData,
  DashboardRepositoriesQueryData,
  DashboardUsersQueryData,
} from './types'

/** Display page size; requests fetch one extra row to detect a next page. */
export const COMMITS_PAGE_SIZE = 100
export const DASHBOARD_PAGE_SIZE = COMMITS_PAGE_SIZE

export type FetchDashboardFilterVariables = {
  repoId: string | null
  branch: string
  from: string | null
  to: string | null
}

export type FetchDashboardCommitsVariables = FetchDashboardFilterVariables & {
  user: string | null
  agent: string | null
  offset: number
}

/** `since` / `until` are RFC3339 (dashboard interaction filter). */
export type FetchDashboardInteractionSessionsVariables = {
  repoId: string | null
  branch: string | null
  since: string | null
  until: string | null
  agent: string | null
  /** Maps to GraphQL `commitAuthor` (aligns with commit-author scoped user filter). */
  commitAuthor: string | null
  offset: number
}

const UNKNOWN_DASHBOARD_REPOSITORY_PATTERN =
  /\bfailed to resolve repository: unknown repository\b/i

function buildInteractionFilterForRequest(
  vars: Omit<FetchDashboardInteractionSessionsVariables, 'repoId' | 'offset'>,
): Record<string, string> | undefined {
  const filter: Record<string, string> = {}
  const branch = vars.branch?.trim()
  if (branch) {
    filter.branch = branch
  }
  if (vars.since) {
    filter.since = vars.since
  }
  if (vars.until) {
    filter.until = vars.until
  }
  if (vars.agent) {
    filter.agent = vars.agent
  }
  if (vars.commitAuthor) {
    filter.commitAuthor = vars.commitAuthor
  }
  return Object.keys(filter).length ? filter : undefined
}

function firstGraphQLError(
  message: string,
  errors?: Array<{ message: string }>,
) {
  if (errors?.length) {
    throw new GraphQLRequestError(errors[0].message)
  }

  throw new GraphQLRequestError(message)
}

function isUnknownDashboardRepositoryError(error: unknown): boolean {
  if (error instanceof GraphQLRequestError) {
    if (UNKNOWN_DASHBOARD_REPOSITORY_PATTERN.test(error.message)) {
      return true
    }

    return (
      error.graphQLErrors?.some((item) =>
        UNKNOWN_DASHBOARD_REPOSITORY_PATTERN.test(item.message),
      ) ?? false
    )
  }

  return error instanceof Error
    ? UNKNOWN_DASHBOARD_REPOSITORY_PATTERN.test(error.message)
    : false
}

function hasUnknownDashboardRepositoryResponseError<TData>(
  response: GraphQLResponseEnvelope<TData>,
): boolean {
  return (
    response.errors?.some((item) =>
      UNKNOWN_DASHBOARD_REPOSITORY_PATTERN.test(item.message),
    ) ?? false
  )
}

async function requestDashboardGraphQLWithRepoFallback<
  TData,
  TVariables extends { repoId: string | null },
>(
  query: string,
  variables: TVariables,
  options?: GraphQLRequestOptions,
): Promise<GraphQLResponseEnvelope<TData>> {
  const runRequest = (nextVariables: TVariables) =>
    requestDashboardGraphQL<TData, TVariables>(query, nextVariables, options)

  try {
    const initialResponse = await runRequest(variables)
    if (!hasUnknownDashboardRepositoryResponseError(initialResponse)) {
      return initialResponse
    }

    const tryResolvedRepositoryFallback = async (): Promise<
      GraphQLResponseEnvelope<TData>
    > => {
      const repositories = await fetchDashboardRepositories({
        signal: options?.signal,
      })

      if (repositories.length !== 1) {
        return initialResponse
      }

      const resolvedRepoId = repositories[0]?.repoId ?? null
      if (resolvedRepoId == null || resolvedRepoId === variables.repoId) {
        return initialResponse
      }

      return runRequest({
        ...variables,
        repoId: resolvedRepoId,
      })
    }

    if (variables.repoId == null) {
      return tryResolvedRepositoryFallback()
    }

    const nullRepoResponse = await runRequest({
      ...variables,
      repoId: null,
    })
    if (!hasUnknownDashboardRepositoryResponseError(nullRepoResponse)) {
      return nullRepoResponse
    }

    return tryResolvedRepositoryFallback()
  } catch (error) {
    if (!isUnknownDashboardRepositoryError(error)) {
      throw error
    }

    const tryResolvedRepositoryFallback = async (): Promise<
      GraphQLResponseEnvelope<TData>
    > => {
      const repositories = await fetchDashboardRepositories({
        signal: options?.signal,
      })

      if (repositories.length !== 1) {
        throw error
      }

      const resolvedRepoId = repositories[0]?.repoId ?? null
      if (resolvedRepoId == null || resolvedRepoId === variables.repoId) {
        throw error
      }

      return runRequest({
        ...variables,
        repoId: resolvedRepoId,
      })
    }

    if (variables.repoId == null) {
      return tryResolvedRepositoryFallback()
    }

    try {
      const nullRepoResponse = await runRequest({
        ...variables,
        repoId: null,
      })
      if (!hasUnknownDashboardRepositoryResponseError(nullRepoResponse)) {
        return nullRepoResponse
      }

      return tryResolvedRepositoryFallback()
    } catch (fallbackError) {
      if (!isUnknownDashboardRepositoryError(fallbackError)) {
        throw fallbackError
      }

      return tryResolvedRepositoryFallback()
    }
  }
}

export async function fetchDashboardRepositories(options?: {
  signal?: AbortSignal
}): Promise<DashboardRepositoryOption[]> {
  const response =
    await requestDashboardGraphQL<DashboardRepositoriesQueryData>(
      DASHBOARD_REPOSITORIES_QUERY,
      undefined,
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load repositories.', response.errors)
  }

  return mapDashboardRepositories({
    repositories: response.data?.repositories ?? [],
  })
}

export async function fetchDashboardBranches(
  variables: Pick<FetchDashboardFilterVariables, 'repoId' | 'from' | 'to'>,
  options?: { signal?: AbortSignal },
) {
  const response =
    await requestDashboardGraphQLWithRepoFallback<
      DashboardBranchesQueryData,
      Pick<FetchDashboardFilterVariables, 'repoId' | 'from' | 'to'>
    >(
      DASHBOARD_BRANCHES_QUERY,
      variables,
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load branches.', response.errors)
  }

  return mapDashboardBranches({
    branches: response.data?.branches ?? [],
  })
}

export async function fetchDashboardUsers(
  variables: FetchDashboardFilterVariables & { agent: string | null },
  options?: { signal?: AbortSignal },
) {
  const response =
    await requestDashboardGraphQLWithRepoFallback<
      DashboardUsersQueryData,
      FetchDashboardFilterVariables & { agent: string | null }
    >(
      DASHBOARD_USERS_QUERY,
      variables,
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load users.', response.errors)
  }

  return mapDashboardUsers({
    users: response.data?.users ?? [],
  })
}

export async function fetchDashboardAgents(
  variables: FetchDashboardFilterVariables & { user: string | null },
  options?: { signal?: AbortSignal },
) {
  const response =
    await requestDashboardGraphQLWithRepoFallback<
      DashboardAgentsQueryData,
      FetchDashboardFilterVariables & { user: string | null }
    >(
      DASHBOARD_AGENTS_QUERY,
      variables,
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load agents.', response.errors)
  }

  return mapDashboardAgents({
    agents: response.data?.agents ?? [],
  })
}

export async function fetchDashboardCommitsPage(
  variables: FetchDashboardCommitsVariables,
  options?: { signal?: AbortSignal },
): Promise<{ rows: DashboardCommitRowDto[]; hasNextPage: boolean }> {
  const response =
    await requestDashboardGraphQLWithRepoFallback<
      DashboardCommitsQueryData,
      FetchDashboardCommitsVariables & { limit: number }
    >(
      DASHBOARD_COMMITS_QUERY,
      {
        ...variables,
        limit: COMMITS_PAGE_SIZE + 1,
      },
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load commits.', response.errors)
  }

  const rows = mapDashboardCommitRows({
    commits: response.data?.commits ?? [],
  })

  return {
    rows: rows.slice(0, COMMITS_PAGE_SIZE),
    hasNextPage: rows.length > COMMITS_PAGE_SIZE,
  }
}

export async function fetchDashboardInteractionSessionsPage(
  variables: FetchDashboardInteractionSessionsVariables,
  options?: { signal?: AbortSignal },
): Promise<{
  rows: DashboardInteractionSessionDto[]
  hasNextPage: boolean
  totalSessions: number
  userOptions: UserOption[]
  agentOptions: string[]
}> {
  const filter = buildInteractionFilterForRequest({
    branch: variables.branch,
    since: variables.since,
    until: variables.until,
    agent: variables.agent,
    commitAuthor: variables.commitAuthor,
  })

  const response =
    await requestDashboardGraphQLWithRepoFallback<
      DashboardInteractionSessionsQueryData,
      {
        repoId: string | null
        filter: Record<string, string> | undefined
        limit: number
        offset: number
      }
    >(
      DASHBOARD_INTERACTION_SESSIONS_QUERY,
      {
        repoId: variables.repoId,
        filter,
        limit: DASHBOARD_PAGE_SIZE + 1,
        offset: variables.offset,
      },
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load interaction sessions.', response.errors)
  }

  const rows = mapDashboardInteractionSessions({
    interactionKpis: response.data?.interactionKpis ?? null,
    interactionActors: response.data?.interactionActors ?? [],
    interactionAgents: response.data?.interactionAgents ?? [],
    interactionSessions: response.data?.interactionSessions ?? [],
  })
  const userOptions = mapUserOptions(
    (response.data?.interactionActors ?? []).map((actor) => ({
      key: actor.actorEmail,
      name: '',
      email: actor.actorEmail,
    })),
  )
  const agentOptions = mapAgentOptions(
    (response.data?.interactionAgents ?? []).map((agent) => ({
      key: agent.key,
    })),
  )

  return {
    rows: rows.slice(0, DASHBOARD_PAGE_SIZE),
    hasNextPage: rows.length > DASHBOARD_PAGE_SIZE,
    totalSessions: response.data?.interactionKpis?.totalSessions ?? rows.length,
    userOptions,
    agentOptions,
  }
}

export async function fetchDashboardCheckpointDetail(
  variables: { repoId: string | null; checkpointId: string },
  options?: { signal?: AbortSignal },
): Promise<DashboardCheckpointDetailResponse> {
  const response =
    await requestDashboardGraphQLWithRepoFallback<
      DashboardCheckpointDetailQueryData,
      { repoId: string | null; checkpointId: string }
    >(
      DASHBOARD_CHECKPOINT_DETAIL_QUERY,
      variables,
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load checkpoint detail.', response.errors)
  }

  const checkpoint = response.data?.checkpoint
  if (checkpoint == null) {
    throw new GraphQLRequestError('Checkpoint detail was not returned.')
  }

  return mapDashboardCheckpointDetail({ checkpoint })
}

export async function fetchDashboardInteractionSessionDetail(
  variables: { repoId: string | null; sessionId: string },
  options?: { signal?: AbortSignal },
): Promise<DashboardInteractionSessionDetailResponse> {
  const response =
    await requestDashboardGraphQLWithRepoFallback<
      DashboardInteractionSessionDetailQueryData,
      { repoId: string | null; sessionId: string }
    >(
      DASHBOARD_INTERACTION_SESSION_DETAIL_QUERY,
      variables,
      options,
    )

  if (response.errors?.length) {
    firstGraphQLError('Failed to load interaction session detail.', response.errors)
  }

  const mapped = mapDashboardInteractionSessionDetail({
    interactionSession: response.data?.interactionSession ?? null,
  })
  if (mapped == null) {
    throw new GraphQLRequestError('Interaction session detail was not returned.')
  }
  return mapped
}

export function subscribeDashboardInteractionUpdates(
  variables: { repoId: string | null },
  handlers: {
    onUpdate: (update: DashboardInteractionUpdateDto) => void
    onError?: (error: unknown) => void
  },
): () => void {
  return subscribeDashboardGraphQL<DashboardInteractionUpdatesSubscriptionData>(
    DASHBOARD_INTERACTION_UPDATES_SUBSCRIPTION,
    variables,
    {
      onData: (data) => {
        const update = data.interactionUpdates
        if (update == null) {
          handlers.onError?.(
            new GraphQLRequestError(
              'Interaction update was not returned from the dashboard subscription.',
            ),
          )
          return
        }

        handlers.onUpdate(mapDashboardInteractionUpdate(update))
      },
      onError: handlers.onError,
    },
  )
}
