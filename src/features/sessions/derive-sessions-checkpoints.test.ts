import { describe, expect, it } from 'vitest'
import type { DashboardInteractionSessionDto } from '@/features/dashboard/api-types'
import {
  deriveDedupedCheckpointsFromSessions,
  sessionsCheckpointRowToCheckpoint,
} from './derive-sessions-checkpoints'

function sessionWithLinks(
  sessionId: string,
  links: Array<{
    checkpoint_id: string
    commit_sha?: string
    committed_at?: string | null
  }>,
): DashboardInteractionSessionDto {
  return {
    session_id: sessionId,
    branch: 'main',
    actor: null,
    agent_type: 'codex',
    model: null,
    first_prompt: null,
    started_at: '2026-01-01T00:00:00Z',
    ended_at: null,
    last_event_at: null,
    turn_count: 1,
    checkpoint_count: links.length,
    token_usage: null,
    file_paths: [],
    tool_uses: [],
    linked_checkpoints: links.map((l) => ({
      checkpoint_id: l.checkpoint_id,
      commit_sha: l.commit_sha ?? 'abc',
      name: null,
      email: null,
      committed_at: l.committed_at ?? '2026-01-01T12:00:00Z',
    })),
    latest_commit_author: null,
  }
}

describe('deriveDedupedCheckpointsFromSessions', () => {
  it('returns empty when no sessions', () => {
    expect(deriveDedupedCheckpointsFromSessions([])).toEqual([])
  })

  it('dedupes same checkpoint_id across sessions', () => {
    const rows = deriveDedupedCheckpointsFromSessions([
      sessionWithLinks('s1', [{ checkpoint_id: 'cp-1' }]),
      sessionWithLinks('s2', [{ checkpoint_id: 'cp-1' }]),
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0]?.checkpoint_id).toBe('cp-1')
    expect([...(rows[0]?.session_ids ?? [])].sort()).toEqual(['s1', 's2'])
  })

  it('maps row to Checkpoint with id and timestamp', () => {
    const cp = sessionsCheckpointRowToCheckpoint({
      checkpoint_id: 'cp-x',
      commit_sha: 'deadbeef',
      committed_at: '2026-01-15T10:00:00.000Z',
      name: 'A',
      email: 'a@b.c',
      session_ids: ['s1'],
      branch: 'main',
    })
    expect(cp.id).toBe('cp-x')
    expect(cp.commit).toBe('deadbee')
    expect(cp.branch).toBe('main')
  })
})
