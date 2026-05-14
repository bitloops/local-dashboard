import type { DashboardInteractionToolUseDto } from '@/features/dashboard/api-types'
import type { TranscriptMessage } from '@/features/dashboard/components/checkpoint-sheet-utils'
import { describe, expect, it } from 'vitest'
import { buildSessionToolUseDisplayItems } from './session-tool-use-display'

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

function buildTranscriptToolPair({
  toolUseId,
  result,
  callText = 'Tool: Bash\n{\n  "command": "cat src/example.ts"\n}',
}: {
  toolUseId?: string
  result: string
  callText?: string
}): TranscriptMessage[] {
  return [
    {
      id: 'tu-1',
      timestamp: '2026-04-24T09:00:00Z',
      actor: 'assistant',
      variant: 'tool_use',
      text: callText,
      toolUseId,
    },
    {
      id: 'tr-1',
      timestamp: '2026-04-24T09:00:01Z',
      actor: 'assistant',
      variant: 'tool_result',
      text: result,
      toolUseId,
    },
  ]
}

describe('buildSessionToolUseDisplayItems', () => {
  it('prefers multiline transcript output over flattened summary output', () => {
    const items = buildSessionToolUseDisplayItems({
      tools: [buildSummaryToolUse()],
      transcriptEntries: buildTranscriptToolPair({
        toolUseId: 'call_1',
        result: 'const answer = 42;\n  return answer;',
      }),
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.responseText).toBe('const answer = 42;\n  return answer;')
  })

  it('falls back by order when transcript entries do not carry tool ids', () => {
    const items = buildSessionToolUseDisplayItems({
      tools: [buildSummaryToolUse({ tool_use_id: '' })],
      transcriptEntries: buildTranscriptToolPair({
        result: 'function main() {\n  return 1\n}',
      }),
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.responseText).toBe('function main() {\n  return 1\n}')
  })

  it('can render transcript-only tool traces when summary tool uses are missing', () => {
    const items = buildSessionToolUseDisplayItems({
      tools: [],
      transcriptEntries: buildTranscriptToolPair({
        toolUseId: 'call_2',
        result: 'line one\n  line two',
      }),
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      callText: 'Tool: Bash\n{\n  "command": "cat src/example.ts"\n}',
      responseText: 'line one\n  line two',
    })
  })

  it('falls back to summary output when no transcript trace is available', () => {
    const items = buildSessionToolUseDisplayItems({
      tools: [buildSummaryToolUse()],
      transcriptEntries: [],
    })

    expect(items).toHaveLength(1)
    expect(items[0]?.responseText).toBe('const answer = 42; return answer;')
  })

  it('returns empty array when both tools and entries are empty', () => {
    const items = buildSessionToolUseDisplayItems({
      tools: [],
      transcriptEntries: [],
    })
    expect(items).toEqual([])
  })
})
