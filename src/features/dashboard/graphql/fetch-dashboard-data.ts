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
  after: string | null
}

export type FetchDashboardRepoOptionsVariables = {
  repo: string
  since: string | null
  until: string | null
}

/**
 * Loads a single page of commits for the dashboard (`after` + `pageInfo`).
 */
export async function fetchDashboardCommitsPage(
  variables: FetchDashboardCommitsVariables,
  options?: { signal?: AbortSignal },
): Promise<DashboardCommitsQueryData> {
  const { signal } = options ?? {}

  const response = await requestGraphQL<DashboardCommitsQueryData>(
    DASHBOARD_COMMITS_QUERY,
    {
      repo: variables.repo,
      branch: variables.branch,
      since: variables.since,
      until: variables.until,
      author: variables.author,
      after: variables.after,
      commitsFirst: COMMITS_PAGE_SIZE,
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
      since: variables.since,
      until: variables.until,
    },
    { signal },
  )

  if (response.errors?.length) {
    throw new Error(response.errors[0].message)
  }

  return { repo: response.data?.repo ?? null }
}
