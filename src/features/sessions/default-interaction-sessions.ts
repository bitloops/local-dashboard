import { DASHBOARD_PAGE_SIZE } from '@/features/dashboard/graphql/fetch-dashboard-data'
import { DASHBOARD_INTERACTION_SESSIONS_ONLY_QUERY } from '@/features/dashboard/graphql/operations'

/** Default GraphQL document for the Sessions landing explorer: `interactionSessions` only. */
export const SESSIONS_LANDING_DEFAULT_QUERY =
  DASHBOARD_INTERACTION_SESSIONS_ONLY_QUERY

/**
 * Variables for the sessions default query — matches
 * `fetchDashboardInteractionSessionsPage` / `requestDashboardGraphQL` shape.
 * `filter.branch` scopes results to a branch; `null` means unset (Sessions repo/branch
 * controls may set a concrete branch once options load).
 */
export function getDefaultInteractionSessionsVariables(
  repoId: string | null,
  branch: string | null,
  options?: { limit?: number; offset?: number },
): string {
  const b = branch?.trim()
  const limit = options?.limit ?? DASHBOARD_PAGE_SIZE
  const offset = options?.offset ?? 0
  return JSON.stringify(
    {
      repoId,
      filter: {
        branch: b ? b : null,
      },
      limit,
      offset,
    },
    null,
    2,
  )
}
