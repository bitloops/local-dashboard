import { useEffect, useState } from 'react'
import type { DashboardCheckpointDetailResponse } from '../api-types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { CopyButton } from '@/components/copy-button'
import { Button } from '@/components/ui/button'
import { fetchDashboardCheckpointDetail } from '../graphql/fetch-dashboard-data'
import { type Checkpoint } from '../types'
import { CheckpointSummaryPanel } from './checkpoint-summary-panel'

type CheckpointSummaryDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  repoId: string | null
  checkpointId: string | null
  /** Minimal checkpoint context for the summary panel (id, commit sha, optional message). */
  checkpointStub: Checkpoint | null
}

export function CheckpointSummaryDialog({
  open,
  onOpenChange,
  repoId,
  checkpointId,
  checkpointStub,
}: CheckpointSummaryDialogProps) {
  const [detail, setDetail] = useState<DashboardCheckpointDetailResponse | null>(
    null,
  )
  const [source, setSource] = useState<'idle' | 'loading' | 'api' | 'error'>(
    'idle',
  )

  useEffect(() => {
    if (!open || !repoId || !checkpointId) {
      setDetail(null)
      setSource('idle')
      return
    }

    let cancelled = false
    setSource('loading')
    setDetail(null)

    fetchDashboardCheckpointDetail({ repoId, checkpointId })
      .then((response) => {
        if (cancelled) return
        setDetail(response)
        setSource('api')
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('Checkpoint summary load failed', err)
        setDetail(null)
        setSource('error')
      })

    return () => {
      cancelled = true
    }
  }, [open, repoId, checkpointId])

  const selected: Checkpoint | null =
    checkpointStub && checkpointId
      ? {
          ...checkpointStub,
          id: checkpointId,
        }
      : checkpointStub

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle className='flex items-center gap-2 pr-8'>
            Checkpoint {checkpointId ?? ''}
            {checkpointId && <CopyButton value={checkpointId} />}
          </DialogTitle>
        </DialogHeader>
        {source === 'loading' && (
          <p className='text-sm text-muted-foreground'>Loading checkpoint…</p>
        )}
        {source === 'error' && (
          <p className='text-sm text-muted-foreground'>
            Could not load checkpoint detail.
          </p>
        )}
        {source === 'api' && selected && (
          <CheckpointSummaryPanel
            selectedCheckpoint={selected}
            checkpointDetail={detail}
          />
        )}
        <div className='flex justify-end pt-2'>
          <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
