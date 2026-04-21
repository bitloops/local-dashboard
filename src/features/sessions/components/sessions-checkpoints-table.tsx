import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/features/dashboard/components/checkpoint-sheet-utils'
import type { SessionsCheckpointRow } from '@/features/sessions/derive-sessions-checkpoints'

type SessionsCheckpointsTableProps = {
  rows: SessionsCheckpointRow[]
  onCheckpointClick?: (row: SessionsCheckpointRow) => void
}

export function SessionsCheckpointsTable({
  rows,
  onCheckpointClick,
}: SessionsCheckpointsTableProps) {
  return (
    <div className='rounded-md border'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Checkpoint</TableHead>
            <TableHead>Commit</TableHead>
            <TableHead>Committed</TableHead>
            <TableHead>Sessions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow
                key={row.checkpoint_id}
                className={cn(
                  onCheckpointClick && 'cursor-pointer hover:bg-muted/50',
                )}
                onClick={() => onCheckpointClick?.(row)}
              >
                <TableCell className='max-w-[220px] font-mono text-xs'>
                  {row.checkpoint_id}
                </TableCell>
                <TableCell className='font-mono text-xs'>
                  {row.commit_sha.slice(0, 7)}
                </TableCell>
                <TableCell className='text-sm text-muted-foreground'>
                  {row.committed_at
                    ? formatDateTime(row.committed_at)
                    : '—'}
                </TableCell>
                <TableCell className='max-w-[280px] truncate text-xs text-muted-foreground'>
                  {row.session_ids.join(', ')}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className='h-24 text-center'>
                No linked checkpoints for sessions on this page. Ensure the
                query selects{' '}
                <span className='font-mono'>linkedCheckpoints</span>.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
