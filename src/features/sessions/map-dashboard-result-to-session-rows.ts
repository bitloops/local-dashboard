import type { DashboardInteractionSessionDto } from '@/features/dashboard/api-types'
import { mapDashboardInteractionSessions } from '@/features/dashboard/graphql/mappers'
import type { DashboardInteractionSessionsQueryData } from '@/features/dashboard/graphql/types'

/**
 * Maps a successful `/devql/dashboard` response body `data` to session table rows.
 * Expects the default interaction-sessions query shape (or any payload with `interactionSessions`).
 */
export function mapDashboardResultDataToSessionRows(
  data: unknown,
): DashboardInteractionSessionDto[] {
  if (data == null || typeof data !== 'object') {
    return []
  }
  const d = data as Partial<DashboardInteractionSessionsQueryData>
  if (!Array.isArray(d.interactionSessions)) {
    return []
  }
  return mapDashboardInteractionSessions({
    interactionKpis: d.interactionKpis ?? null,
    interactionActors: d.interactionActors ?? [],
    interactionAgents: d.interactionAgents ?? [],
    interactionSessions: d.interactionSessions,
  })
}
