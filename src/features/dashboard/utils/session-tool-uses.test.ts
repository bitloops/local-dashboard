import { describe, expect, it } from 'vitest'
import { sortedSessionToolUses } from './session-tool-uses'
import type { DashboardInteractionSessionDto } from '@/features/dashboard/api-types'

function tool(
  inv: string,
  use: string,
  started: string,
): DashboardInteractionSessionDto['tool_uses'][number] {
  return {
    tool_invocation_id: inv,
    tool_use_id: use,
    session_id: 's1',
    turn_id: null,
    tool_kind: 'x',
    task_description: null,
    input_summary: null,
    output_summary: null,
    source: null,
    command: null,
    command_binary: null,
    command_argv: [],
    transcript_path: null,
    started_at: started,
    ended_at: null,
  }
}

describe('sortedSessionToolUses', () => {
  it('sorts by started_at then invocation id', () => {
    const summary: DashboardInteractionSessionDto = {
      session_id: 's1',
      branch: null,
      actor: null,
      agent_type: 'a',
      model: null,
      first_prompt: null,
      started_at: '2025-01-01T00:00:00.000Z',
      ended_at: null,
      last_event_at: null,
      turn_count: 0,
      checkpoint_count: 0,
      token_usage: null,
      file_paths: [],
      tool_uses: [
        tool('b', 'u2', '2025-01-02T00:00:00.000Z'),
        tool('a', 'u1', '2025-01-01T00:00:00.000Z'),
      ],
      linked_checkpoints: [],
      latest_commit_author: null,
    }

    const sorted = sortedSessionToolUses(summary)
    expect(sorted.map((t) => t.tool_invocation_id)).toEqual(['a', 'b'])
  })
})
