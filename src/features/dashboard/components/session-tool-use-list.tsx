import { useMemo } from 'react'
import type {
  DashboardInteractionEventDto,
  DashboardInteractionToolUseDto,
  DashboardInteractionTurnDto,
} from '@/features/dashboard/api-types'
import type { TranscriptMessage } from '@/features/dashboard/components/checkpoint-sheet-utils'
import { ToolTraceCallResponse } from '@/features/dashboard/components/tool-trace-pair'
import { buildSessionToolUseDisplayItems } from '@/features/dashboard/utils/session-tool-use-display'

type SessionToolUseListProps = {
  tools: DashboardInteractionToolUseDto[]
  turns?: DashboardInteractionTurnDto[]
  rawEvents?: DashboardInteractionEventDto[]
  transcriptEntries?: TranscriptMessage[]
  emptyMessage: string
}

export function SessionToolUseList({
  tools,
  turns,
  rawEvents,
  transcriptEntries,
  emptyMessage,
}: SessionToolUseListProps) {
  const items = useMemo(
    () =>
      buildSessionToolUseDisplayItems({
        tools,
        turns,
        rawEvents,
        transcriptEntries,
      }),
    [rawEvents, tools, transcriptEntries, turns],
  )

  if (items.length === 0) {
    return <p className='text-sm text-muted-foreground'>{emptyMessage}</p>
  }

  return (
    <div className='flex min-w-0 flex-col gap-4'>
      {items.map((item) => (
        <ToolTraceCallResponse
          key={item.key}
          callText={item.callText}
          responseText={item.responseText}
          responseIsError={item.responseIsError}
          indented={false}
        />
      ))}
    </div>
  )
}
