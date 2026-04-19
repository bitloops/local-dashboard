import type { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import type { DashboardInteractionSessionDto } from '../api-types'
import { formatAgentLabel } from '../utils'

export type SessionRow = DashboardInteractionSessionDto

export const sessionColumns: ColumnDef<SessionRow>[] = [
  {
    accessorKey: 'started_at',
    header: 'Started',
    cell: ({ row }) => {
      const v = row.original.started_at
      const d = new Date(v)
      return Number.isNaN(d.getTime())
        ? v
        : d.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
    },
  },
  {
    id: 'actor',
    header: 'Actor',
    cell: ({ row }) => {
      const a = row.original.actor
      const label = a?.name ?? a?.email ?? a?.id ?? '—'
      return <span className='max-w-[140px] truncate'>{label}</span>
    },
  },
  {
    accessorKey: 'agent_type',
    header: 'Agent',
    cell: ({ row }) => (
      <Badge variant='secondary'>
        {formatAgentLabel(row.original.agent_type)}
      </Badge>
    ),
  },
  {
    accessorKey: 'first_prompt',
    header: 'Prompt',
    cell: ({ row }) => (
      <span className='line-clamp-2 max-w-md text-muted-foreground'>
        {row.original.first_prompt?.trim() || '—'}
      </span>
    ),
  },
  {
    accessorKey: 'turn_count',
    header: 'Turns',
    cell: ({ row }) => row.original.turn_count,
  },
  {
    accessorKey: 'checkpoint_count',
    header: 'CPs',
    cell: ({ row }) => row.original.checkpoint_count,
  },
]
