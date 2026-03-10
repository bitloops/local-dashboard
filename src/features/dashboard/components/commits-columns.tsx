import { type ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/data-table'
import { MessageSquare, ChevronRight, Circle } from 'lucide-react'
import { type Checkpoint } from '../data/mock-commit-data'
import { AgentIcon } from './agent-icon'

export type CommitRow = {
  date: string
  commit: string
  checkpoints: number
  message: string
  author: string
  agent: string
  checkpointList: Checkpoint[]
}

const agentLabels: Record<string, string> = {
  'claude-code': 'Claude Code',
  'gemini-cli': 'Gemini CLI',
  'open-code': 'OpenCode',
  'cursor': 'Cursor',
  'openai': 'OpenAI',
}

export const commitColumns: ColumnDef<CommitRow>[] = [
  {
    id: 'expand',
    header: () => null,
    cell: ({ row }) => {
      const hasCheckpoints = (row.getValue('checkpoints') as number) > 0
      if (!hasCheckpoints) {
        return (
          <span className='flex items-center justify-center p-1'>
            <Circle className='size-2 text-muted-foreground/40' />
          </span>
        )
      }
      return (
        <button
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
          aria-label={row.getIsExpanded() ? 'Collapse row' : 'Expand row'}
          className='flex items-center justify-center rounded p-1 hover:bg-muted'
        >
          <ChevronRight
            className={`size-4 text-muted-foreground transition-transform duration-200 ${
              row.getIsExpanded() ? 'rotate-90' : ''
            }`}
          />
        </button>
      )
    },
    enableSorting: false,
    meta: { className: 'w-10' },
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Date' />
    ),
    cell: ({ row }) => <span className='tabular-nums'>{row.getValue('date')}</span>,
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
      <span className='block truncate text-sm'>
        {row.getValue('message')}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'author',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Author' />
    ),
    cell: ({ row }) => (
      <span className='truncate text-sm'>{row.getValue('author') || '—'}</span>
    ),
    meta: { tdClassName: 'max-w-[140px]' },
  },
  {
    accessorKey: 'agent',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title='Agent' />
    ),
    cell: ({ row }) => {
      const agent = row.getValue('agent') as string
      const label = agentLabels[agent] ?? agent
      return (
        <div className='flex items-center gap-2'>
          <AgentIcon agent={agent} className='size-4' />
          <span>{label}</span>
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
