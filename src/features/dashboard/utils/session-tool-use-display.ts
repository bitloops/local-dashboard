import type {
  DashboardInteractionEventDto,
  DashboardInteractionToolUseDto,
  DashboardInteractionTurnDto,
} from '@/features/dashboard/api-types'
import { type TranscriptMessage } from '@/features/dashboard/components/checkpoint-sheet-utils'
import { getSessionTranscriptEntriesBestEffort } from '@/features/dashboard/utils/turn-transcript'

function commandLine(tool: DashboardInteractionToolUseDto): string | null {
  const cmd = tool.command?.trim()
  if (cmd) return cmd
  if (tool.command_argv?.length) return tool.command_argv.join(' ')
  const bin = tool.command_binary?.trim()
  if (bin) return bin
  return null
}

/** Build a single "Call" string similar to transcript `Tool: ...` + body + command. */
export function buildToolUseCallText(
  tool: DashboardInteractionToolUseDto,
): string {
  const kind = tool.tool_kind?.trim()
  const taskDescription = tool.task_description?.trim() ?? ''
  const input = tool.input_summary?.trim() ?? ''
  const cmd = commandLine(tool)

  const parts: string[] = []
  if (kind) {
    parts.push(`Tool: ${kind}`)
  }
  if (taskDescription) {
    if (parts.length) parts.push('')
    parts.push(taskDescription)
  }
  if (input && input !== taskDescription) {
    if (parts.length) parts.push('')
    parts.push(input)
  } else if (!taskDescription && input) {
    if (parts.length) parts.push('')
    parts.push(input)
  }
  if (cmd) {
    if (parts.length) parts.push('')
    parts.push(cmd)
  }
  if (parts.length === 0) {
    return '—'
  }
  return parts.join('\n')
}

type TranscriptToolTrace = {
  key: string
  toolUseId?: string
  callText: string
  responseText?: string
  responseIsError?: boolean
}

export type SessionToolUseDisplayItem = {
  key: string
  callText: string
  responseText?: string
  responseIsError?: boolean
}

function groupTranscriptToolTraces(
  entries: TranscriptMessage[],
): TranscriptToolTrace[] {
  const traces: TranscriptToolTrace[] = []
  const pendingTraceIndexes: number[] = []

  for (const entry of entries) {
    if (entry.variant === 'tool_use') {
      traces.push({
        key: entry.id,
        toolUseId: entry.toolUseId,
        callText: entry.text,
      })
      pendingTraceIndexes.push(traces.length - 1)
      continue
    }

    if (entry.variant !== 'tool_result' || pendingTraceIndexes.length === 0) {
      continue
    }

    let pendingIndex = 0
    if (entry.toolUseId?.trim()) {
      const matchedIndex = pendingTraceIndexes.findIndex(
        (traceIndex) => traces[traceIndex]?.toolUseId === entry.toolUseId,
      )
      if (matchedIndex >= 0) {
        pendingIndex = matchedIndex
      }
    }

    const [traceIndex] = pendingTraceIndexes.splice(pendingIndex, 1)
    const trace = traces[traceIndex]
    if (!trace) {
      continue
    }

    traces[traceIndex] = {
      ...trace,
      key: `${trace.key}-${entry.id}`,
      toolUseId: trace.toolUseId ?? entry.toolUseId,
      responseText: entry.text,
      responseIsError: entry.isError === true,
    }
  }

  return traces
}

export function buildSessionToolUseDisplayItems({
  tools,
  turns,
  rawEvents,
}: {
  tools: DashboardInteractionToolUseDto[]
  turns: DashboardInteractionTurnDto[]
  rawEvents: DashboardInteractionEventDto[]
}): SessionToolUseDisplayItem[] {
  const transcriptTraces = groupTranscriptToolTraces(
    getSessionTranscriptEntriesBestEffort(rawEvents, turns),
  )

  if (tools.length === 0) {
    return transcriptTraces.map((trace) => ({
      key: trace.key,
      callText: trace.callText,
      responseText: trace.responseText,
      responseIsError: trace.responseIsError,
    }))
  }

  const traceByToolUseId = new Map<string, TranscriptToolTrace>()
  for (const trace of transcriptTraces) {
    const toolUseId = trace.toolUseId?.trim()
    if (toolUseId && !traceByToolUseId.has(toolUseId)) {
      traceByToolUseId.set(toolUseId, trace)
    }
  }

  const canFallbackByOrder = transcriptTraces.length === tools.length

  return tools.map((tool, index) => {
    const toolUseId = tool.tool_use_id.trim()
    const transcriptTrace =
      (toolUseId ? traceByToolUseId.get(toolUseId) : undefined) ??
      (canFallbackByOrder ? transcriptTraces[index] : undefined)
    const fallbackResponse = tool.output_summary?.trim() ?? ''

    return {
      key:
        tool.tool_invocation_id ||
        `${tool.tool_use_id}-${tool.started_at ?? String(index)}`,
      callText: transcriptTrace?.callText?.trim()
        ? transcriptTrace.callText
        : buildToolUseCallText(tool),
      responseText: transcriptTrace?.responseText?.trim()
        ? transcriptTrace.responseText
        : fallbackResponse || undefined,
      responseIsError: transcriptTrace?.responseIsError === true,
    }
  })
}
