import type {
  DashboardInteractionEventDto,
  DashboardInteractionToolUseDto,
  DashboardInteractionTurnDto,
} from '@/features/dashboard/api-types'
import { describe, expect, it } from 'vitest'
import { buildSessionToolUseDisplayItems } from './session-tool-use-display'

function buildTranscriptFragment({
  toolUseId,
  result,
}: {
  toolUseId?: string
  result: string
}) {
  return [
    JSON.stringify({
      type: 'assistant',
      timestamp: '2026-04-24T09:00:00Z',
      uuid: 'assistant-1',
      message: {
        content: [
          {
            type: 'tool_use',
            ...(toolUseId ? { id: toolUseId } : {}),
            name: 'Bash',
            input: { command: 'cat src/example.ts' },
          },
        ],
      },
    }),
    JSON.stringify({
      type: 'user',
      timestamp: '2026-04-24T09:00:01Z',
      uuid: 'user-1',
      message: {
        content: [
          {
            type: 'tool_result',
            ...(toolUseId ? { tool_use_id: toolUseId } : {}),
            content: result,
            is_error: false,
          },
        ],
      },
    }),
  ].join('\n')
}

function buildTurn(turnId: string): DashboardInteractionTurnDto {
  return {
    turn_id: turnId,
    session_id: 'session-1',
    branch: null,
    actor: null,
    turn_number: 1,
    prompt: null,
    summary: null,
    agent_type: 'codex',
    model: null,
    started_at: '2026-04-24T09:00:00Z',
    ended_at: '2026-04-24T09:00:02Z',
    token_usage: null,
    files_modified: [],
    checkpoint_id: null,
    tool_uses: [],
  }
}

function buildTurnEndEvent(
  turnId: string,
  transcriptFragment: string,
): DashboardInteractionEventDto {
  return {
    event_id: `event-${turnId}`,
    session_id: 'session-1',
    turn_id: turnId,
    event_type: 'turn_end',
    event_time: '2026-04-24T09:00:02Z',
    agent_type: 'codex',
    model: null,
    tool_use_id: null,
    tool_kind: null,
    task_description: null,
    subagent_id: null,
    payload: { transcript_fragment: transcriptFragment },
  }
}

function buildSummaryToolUse(
  overrides: Partial<DashboardInteractionToolUseDto> = {},
): DashboardInteractionToolUseDto {
  return {
    tool_invocation_id: 'invocation-1',
    tool_use_id: 'call_1',
    session_id: 'session-1',
    turn_id: 'turn-1',
    tool_kind: 'Bash',
    task_description: 'Inspect a file',
    input_summary: 'cat src/example.ts',
    output_summary: 'const answer = 42; return answer;',
    source: null,
    command: 'cat src/example.ts',
    command_binary: 'cat',
    command_argv: ['cat', 'src/example.ts'],
    transcript_path: null,
    started_at: '2026-04-24T09:00:00Z',
    ended_at: '2026-04-24T09:00:02Z',
    ...overrides,
  }
}

describe('buildSessionToolUseDisplayItems', () => {
  it('prefers multiline transcript output over flattened summary output', () => {
    const turns = [buildTurn('turn-1')]
    const rawEvents = [
      buildTurnEndEvent(
        'turn-1',
        buildTranscriptFragment({
          toolUseId: 'call_1',
          result: 'const answer = 42;\n  return answer;',
        }),
      ),
    ]
    const items = buildSessionToolUseDisplayItems({
      tools: [buildSummaryToolUse()],
      turns,
      rawEvents,
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.responseText).toBe('const answer = 42;\n  return answer;')
  })

  it('falls back by order when transcript entries do not carry tool ids', () => {
    const turns = [buildTurn('turn-1')]
    const rawEvents = [
      buildTurnEndEvent(
        'turn-1',
        buildTranscriptFragment({
          result: 'function main() {\n  return 1\n}',
        }),
      ),
    ]
    const items = buildSessionToolUseDisplayItems({
      tools: [buildSummaryToolUse({ tool_use_id: '' })],
      turns,
      rawEvents,
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.responseText).toBe('function main() {\n  return 1\n}')
  })

  it('can render transcript-only tool traces when summary tool uses are missing', () => {
    const turns = [buildTurn('turn-1')]
    const rawEvents = [
      buildTurnEndEvent(
        'turn-1',
        buildTranscriptFragment({
          toolUseId: 'call_2',
          result: 'line one\n  line two',
        }),
      ),
    ]
    const items = buildSessionToolUseDisplayItems({
      tools: [],
      turns,
      rawEvents,
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      callText: 'Tool: Bash\n{\n  "command": "cat src/example.ts"\n}',
      responseText: 'line one\n  line two',
    })
  })
})
