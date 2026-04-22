import type {
  DashboardInteractionSessionDto,
  DashboardInteractionToolUseDto,
} from '@/features/dashboard/api-types'

/** Session summary `tool_uses` only (no merging with per-turn lists — avoids duplicates). */
export function sortedSessionToolUses(
  summary: DashboardInteractionSessionDto | null | undefined,
): DashboardInteractionToolUseDto[] {
  const list = summary?.tool_uses ?? []
  return [...list].sort((a, b) => {
    const ta = a.started_at ?? a.ended_at ?? ''
    const tb = b.started_at ?? b.ended_at ?? ''
    const byTime = ta.localeCompare(tb)
    if (byTime !== 0) return byTime
    const ia = a.tool_invocation_id ?? ''
    const ib = b.tool_invocation_id ?? ''
    const byInv = ia.localeCompare(ib)
    if (byInv !== 0) return byInv
    return (a.tool_use_id ?? '').localeCompare(b.tool_use_id ?? '')
  })
}
