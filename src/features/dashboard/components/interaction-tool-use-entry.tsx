import type { DashboardInteractionToolUseDto } from '@/features/dashboard/api-types'
import { ToolTraceCallResponse } from '@/features/dashboard/components/tool-trace-pair'
import { buildToolUseCallText } from '@/features/dashboard/utils/session-tool-use-display'

type InteractionToolUseEntryProps = {
  tool: DashboardInteractionToolUseDto
}

/**
 * Same Call / Response shell as the session transcript (see `ToolTraceCallResponse`), backed by
 * session summary `tool_uses` DTOs.
 */
export function InteractionToolUseEntry({
  tool,
}: InteractionToolUseEntryProps) {
  const callText = buildToolUseCallText(tool)
  const responseText = tool.output_summary?.trim() ?? ''

  return (
    <ToolTraceCallResponse
      callText={callText}
      responseText={responseText || undefined}
      indented={false}
    />
  )
}
