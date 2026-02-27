import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { Bot, Sparkles, Terminal, MessageSquare, ChevronRight } from 'lucide-react'
import { type Checkpoint } from './session-activity-chart'

export type CommitRow = {
  date: string
  commit: string
  checkpoints: number
  message: string
  agent: string
  checkpointList: Checkpoint[]
}

const agentConfig: Record<
  string,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  'claude-code': { label: 'Claude Code', icon: Bot },
  'gemini-cli': { label: 'Gemini CLI', icon: Sparkles },
  'open-code': { label: 'OpenCode', icon: Terminal },
}

export const commitColumns: ColumnDef<CommitRow>[] = [
  {
    id: 'expand',
    header: () => null,
    cell: ({ row }) => (
      <button
        onClick={(e) => {
          e.stopPropagation()
          row.toggleExpanded()
        }}
        className='flex items-center justify-center rounded p-1 hover:bg-muted'
      >
        <ChevronRight
          className={`size-4 text-muted-foreground transition-transform duration-200 ${
            row.getIsExpanded() ? 'rotate-90' : ''
          }`}
        />
      </button>
    ),
    enableSorting: false,
    meta: { className: 'w-10' },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ row }) => <span>{row.getValue('date')}</span>,
  },
  {
    accessorKey: 'commit',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Commit' />
    ),
    cell: ({ row }) => (
      <Badge variant='outline' className='font-mono text-xs'>
        {row.getValue('commit')}
      </Badge>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'message',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Message' />
    ),
    meta: { className: 'max-w-0 w-1/2', tdClassName: 'ps-4' },
    cell: ({ row }) => (
      <span className='truncate block text-sm'>
        {row.getValue('message')}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'agent',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Agent' />
    ),
    cell: ({ row }) => {
      const config = agentConfig[row.getValue('agent') as string]
      if (!config) return row.getValue('agent')
      const Icon = config.icon
      return (
        <div className='flex items-center gap-2'>
          <Icon className='size-4 text-muted-foreground' />
          <span>{config.label}</span>
        </div>
      )
    },
    filterFn: (row, id, value) => value.includes(row.getValue(id)),
  },
  {
    accessorKey: 'checkpoints',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Checkpoints' />
    ),
    cell: ({ row }) => (
      <div className='flex items-center justify-center gap-1.5'>
        <MessageSquare className='size-3.5 text-muted-foreground' />
        <span className='tabular-nums'>{row.getValue('checkpoints')}</span>
      </div>
    ),
  },
]
