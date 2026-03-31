import { requestGraphQL } from '@/api/graphql/client'
import {
  DASHBOARD_COMMITS_QUERY,
  DASHBOARD_REPO_OPTIONS_QUERY,
} from './operations'
import type {
  DashboardCommitsQueryData,
  DashboardCommitsQueryVariables,
  DashboardRepoOptionsQueryData,
} from './types'

/** Page size for `Repository.commits` cursor pagination. */
export const COMMITS_PAGE_SIZE = 100

export type FetchDashboardCommitsVariables = {
  repo: string
  branch: string
  since: string | null
  until: string | null
  author: string | null
} & (
  | {
      direction?: 'forward'
      after: string | null
      before?: never
    }
  | {
      direction: 'backward'
      before: string | null
      after?: never
    }
)

export type FetchDashboardRepoOptionsVariables = {
  repo: string
}

/**
 * Loads a single page of commits for the dashboard using either
 * forward (`first` + `after`) or backward (`last` + `before`) pagination.
 */
export async function fetchDashboardCommitsPage(
  variables: FetchDashboardCommitsVariables,
  options?: { signal?: AbortSignal },
): Promise<DashboardCommitsQueryData> {
  const { signal } = options ?? {}
  const isBackward = variables.direction === 'backward'

  const response = await requestGraphQL<DashboardCommitsQueryData>(
    DASHBOARD_COMMITS_QUERY,
    {
      repo: variables.repo,
      branch: variables.branch,
      since: variables.since,
      until: variables.until,
      author: variables.author,
      after: isBackward ? undefined : variables.after,
      before: isBackward ? variables.before : undefined,
      commitsFirst: isBackward ? undefined : COMMITS_PAGE_SIZE,
      commitsLast: isBackward ? COMMITS_PAGE_SIZE : undefined,
    } satisfies DashboardCommitsQueryVariables,
    { signal },
  )

  if (response.errors?.length) {
    throw new Error(response.errors[0].message)
  }

  return { repo: response.data?.repo ?? null }
}

export async function fetchDashboardRepoOptions(
  variables: FetchDashboardRepoOptionsVariables,
  options?: { signal?: AbortSignal },
): Promise<DashboardRepoOptionsQueryData> {
  const { signal } = options ?? {}

  const response = await requestGraphQL<DashboardRepoOptionsQueryData>(
    DASHBOARD_REPO_OPTIONS_QUERY,
    {
      repo: variables.repo,
    },
    { signal },
  )

  if (response.errors?.length) {
    throw new Error(response.errors[0].message)
  }

  return { repo: response.data?.repo ?? null }
}
