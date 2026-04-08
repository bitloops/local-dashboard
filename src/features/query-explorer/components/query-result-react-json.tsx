'use client'

import { useCallback, useMemo } from 'react'
import ReactJson, { type OnSelectProps } from '@microlink/react-json-view'
import { cn } from '@/lib/utils'
import { getJsonViewerTheme } from '@/styles/json-viewer-theme'
import { isGitBlobOid } from '../git-blob-oid'
import type { QueryExplorerResolvedTheme } from '../types'

type QueryResultReactJsonProps = {
  /** GraphQL `data` (or `{ data, errors }`); coerced to an `object` for the viewer. */
  data: unknown
  repoForBlobs: string | null
  onOpenBlob: (sha: string) => void
  theme: QueryExplorerResolvedTheme
  className?: string
}

/** `react-json-view` must receive a non-null object; wrap rare scalar roots. */
function toViewerSrc(payload: unknown): object {
  if (payload !== null && typeof payload === 'object') {
    return payload as object
  }
  return { value: payload ?? null }
}

/** Query results via `@microlink/react-json-view` (React 19–safe fork). Blob preview: click a `blobSha` value when `repo` is set, via the `onSelect` callback. */
export function QueryResultReactJson({
  data,
  repoForBlobs,
  onOpenBlob,
  theme,
  className,
}: QueryResultReactJsonProps) {
  const mode = theme === 'dark' ? 'dark' : 'light'
  const src = useMemo(() => toViewerSrc(data), [data])

  const handleSelect = useCallback(
    (select: OnSelectProps) => {
      if (select.name !== 'blobSha' || select.type !== 'string') return
      const raw = typeof select.value === 'string' ? select.value.trim() : ''
      if (!raw || !isGitBlobOid(raw) || !repoForBlobs) return
      onOpenBlob(raw.toLowerCase())
    },
    [onOpenBlob, repoForBlobs],
  )

  return (
    <div
      className={cn('select-text', className)}
      data-testid='query-result-json-tree'
    >
      <ReactJson
        src={src}
        theme={getJsonViewerTheme(mode)}
        name={false}
        collapsed={4}
        indentWidth={1}
        iconStyle='square'
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard={false}
        onEdit={false}
        onAdd={false}
        onDelete={false}
        onSelect={handleSelect}
        style={{
          backgroundColor: 'transparent',
          fontSize: '0.75rem',
          lineHeight: 1.625,
        }}
      />
    </div>
  )
}
