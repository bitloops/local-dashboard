import { requestDashboardGraphQL } from '@/api/dashboard/client'
import { GraphQLRequestError } from '@/api/graphql/errors'
import type {
  DashboardCheckpointDetailResponse,
  DashboardCommitRowDto,
  DashboardInteractionSessionDetailResponse,
  DashboardInteractionSessionDto,
  DashboardRepositoryOption,
} from '../api-types'
import {
  DASHBOARD_AGENTS_QUERY,
  DASHBOARD_BRANCHES_QUERY,
  DASHBOARD_CHECKPOINT_DETAIL_QUERY,
  DASHBOARD_COMMITS_QUERY,
  DASHBOARD_INTERACTION_SESSIONS_QUERY,
  DASHBOARD_INTERACTION_SESSION_DETAIL_QUERY,
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
  mapDashboardRepositories,
  mapDashboardUsers,
} from './mappers'
import type {
  DashboardAgentsQueryData,
  DashboardBranchesQueryData,
  DashboardCheckpointDetailQueryData,
  DashboardCommitsQueryData,
  DashboardInteractionSessionsQueryData,
  DashboardInteractionSessionDetailQueryData,
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
  branch: string
  since: string | null
  until: string | null
  agent: string | null
  /** Maps to GraphQL `commitAuthor` (aligns with commit-author scoped user filter). */
  commitAuthor: string | null
  offset: number
}

function buildInteractionFilterForRequest(
  vars: Omit<FetchDashboardInteractionSessionsVariables, 'repoId' | 'offset'>,
): Record<string, string> | undefined {
  const filter: Record<string, string> = {}
  const branch = vars.branch.trim()
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
  const response = await requestDashboardGraphQL<DashboardBranchesQueryData>(
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
  const response = await requestDashboardGraphQL<DashboardUsersQueryData>(
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
  const response = await requestDashboardGraphQL<DashboardAgentsQueryData>(
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
  const response = await requestDashboardGraphQL<DashboardCommitsQueryData>(
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
): Promise<{ rows: DashboardInteractionSessionDto[]; hasNextPage: boolean }> {
  const filter = buildInteractionFilterForRequest({
    branch: variables.branch,
    since: variables.since,
    until: variables.until,
    agent: variables.agent,
    commitAuthor: variables.commitAuthor,
  })

  const response =
    await requestDashboardGraphQL<DashboardInteractionSessionsQueryData>(
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
    interactionSessions: response.data?.interactionSessions ?? [],
  })

  return {
    rows: rows.slice(0, DASHBOARD_PAGE_SIZE),
    hasNextPage: rows.length > DASHBOARD_PAGE_SIZE,
  }
}

export async function fetchDashboardCheckpointDetail(
  variables: { repoId: string | null; checkpointId: string },
  options?: { signal?: AbortSignal },
): Promise<DashboardCheckpointDetailResponse> {
  const response =
    await requestDashboardGraphQL<DashboardCheckpointDetailQueryData>(
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
    await requestDashboardGraphQL<DashboardInteractionSessionDetailQueryData>(
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
