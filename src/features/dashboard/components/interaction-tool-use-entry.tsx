import type { DashboardInteractionToolUseDto } from '@/features/dashboard/api-types'
import { CopyButton } from '@/components/copy-button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/features/dashboard/components/checkpoint-sheet-utils'

function commandLine(tool: DashboardInteractionToolUseDto): string | null {
  const cmd = tool.command?.trim()
  if (cmd) return cmd
  if (tool.command_argv?.length) return tool.command_argv.join(' ')
  const bin = tool.command_binary?.trim()
  if (bin) return bin
  return null
}

type InteractionToolUseEntryProps = {
  tool: DashboardInteractionToolUseDto
}

export function InteractionToolUseEntry({ tool }: InteractionToolUseEntryProps) {
  const td = tool.task_description?.trim() ?? ''
  const input = tool.input_summary?.trim() ?? ''
  const output = tool.output_summary?.trim() ?? ''
  const showInput = input.length > 0 && input !== td
  const showOutput = output.length > 0 && output !== td
  const cmd = commandLine(tool)

  return (
    <div className='rounded-md border bg-background px-3 py-2'>
      <div className='flex flex-wrap items-center gap-2'>
        <Badge variant='secondary'>{tool.tool_kind?.trim() || 'tool'}</Badge>
        {tool.source?.trim() ? (
          <Badge variant='outline' className='max-w-[180px] truncate'>
            {tool.source.trim()}
          </Badge>
        ) : null}
        {tool.started_at ? (
          <Badge variant='outline'>{formatDateTime(tool.started_at)}</Badge>
        ) : null}
      </div>

      {td ? (
        <p className='mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words'>
          {tool.task_description}
        </p>
      ) : null}

      {!td && input ? (
        <p className='mt-1 text-xs text-muted-foreground whitespace-pre-wrap break-words'>
          {input}
        </p>
      ) : null}

      {showInput ? (
        <div className='mt-1'>
          <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>
            Input
          </p>
          <p className='text-xs text-muted-foreground whitespace-pre-wrap break-words'>
            {tool.input_summary}
          </p>
        </div>
      ) : null}

      {showOutput ? (
        <div className='mt-1'>
          <p className='text-[10px] uppercase tracking-wide text-muted-foreground'>
            Output
          </p>
          <p className='text-xs text-muted-foreground whitespace-pre-wrap break-words'>
            {tool.output_summary}
          </p>
        </div>
      ) : null}

      {cmd ? (
        <p className='mt-1 break-all rounded border border-border/60 bg-muted/20 px-2 py-1 font-mono text-[11px] text-muted-foreground'>
          {cmd}
        </p>
      ) : null}

      <div className='mt-2 space-y-1 font-mono text-[11px] text-muted-foreground'>
        {tool.tool_invocation_id ? (
          <p className='flex min-w-0 flex-wrap items-center gap-1 break-all'>
            <span className='shrink-0 text-[10px] uppercase tracking-wide'>
              Invocation
            </span>
            <span className='min-w-0 flex-1'>{tool.tool_invocation_id}</span>
            <CopyButton value={tool.tool_invocation_id} />
          </p>
        ) : null}
        {tool.tool_use_id?.trim() ? (
          <p className='flex min-w-0 flex-wrap items-center gap-1 break-all'>
            <span className='shrink-0 text-[10px] uppercase tracking-wide'>
              Provider ID
            </span>
            <span className='min-w-0 flex-1'>{tool.tool_use_id}</span>
            <CopyButton value={tool.tool_use_id} />
          </p>
        ) : null}
      </div>
    </div>
  )
}
