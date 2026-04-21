import type { DashboardInteractionSessionDto } from '@/features/dashboard/api-types'
import { formatDateTime } from '@/features/dashboard/components/checkpoint-sheet-utils'
import type { Checkpoint } from '@/features/dashboard/types'

/** One deduped checkpoint across sessions on the current page. */
export type SessionsCheckpointRow = {
  checkpoint_id: string
  commit_sha: string
  committed_at: string | null
  name: string | null
  email: string | null
  session_ids: string[]
  /** Branch from the first session that referenced this checkpoint. */
  branch: string | null
}

/**
 * Merge `linked_checkpoints` from the current `interactionSessions` page, deduped by
 * `checkpoint_id`, with originating session ids preserved.
 */
export function deriveDedupedCheckpointsFromSessions(
  sessions: DashboardInteractionSessionDto[],
): SessionsCheckpointRow[] {
  const map = new Map<string, SessionsCheckpointRow>()

  for (const session of sessions) {
    for (const lc of session.linked_checkpoints ?? []) {
      const id = lc.checkpoint_id.trim()
      if (!id) continue

      const existing = map.get(id)
      if (existing) {
        if (!existing.session_ids.includes(session.session_id)) {
          existing.session_ids.push(session.session_id)
        }
        continue
      }

      map.set(id, {
        checkpoint_id: id,
        commit_sha: lc.commit_sha,
        committed_at: lc.committed_at,
        name: lc.name,
        email: lc.email,
        session_ids: [session.session_id],
        branch: session.branch ?? null,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = a.committed_at ? new Date(a.committed_at).getTime() : 0
    const tb = b.committed_at ? new Date(b.committed_at).getTime() : 0
    return tb - ta
  })
}

/** Build a `Checkpoint` for [`CheckpointSheet`] from a deduped sessions row. */
export function sessionsCheckpointRowToCheckpoint(
  row: SessionsCheckpointRow,
): Checkpoint {
  const committed = row.committed_at?.trim()
  return {
    id: row.checkpoint_id,
    timestamp: committed ? formatDateTime(row.committed_at!) : '',
    createdAt: committed ?? undefined,
    commit: row.commit_sha ? row.commit_sha.slice(0, 7) : undefined,
    author:
      [row.name, row.email].filter(Boolean).join(' · ') || undefined,
    branch: row.branch ?? undefined,
  }
}
