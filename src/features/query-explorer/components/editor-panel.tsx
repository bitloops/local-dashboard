import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import {
  defineDashboardThemes,
  DASHBOARD_DARK_THEME,
  DASHBOARD_LIGHT_THEME,
} from '../../../styles/monaco-theme'
import type * as Monaco from 'monaco-editor'

type QueryEditorPanelProps = {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  isRunDisabled?: boolean
  /** When true, only render the editor body (no header with title and Run). */
  hideHeader?: boolean
  className?: string
}

const EDITOR_LANGUAGE = 'graphql'

const EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  padding: { top: 8, bottom: 8 },
}

export function QueryEditorPanel({
  value,
  onChange,
  onRun,
  isRunDisabled = false,
  hideHeader = false,
  className,
}: QueryEditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [editorHeight, setEditorHeight] = useState(200)
  const { resolvedTheme } = useTheme()
  const theme =
    resolvedTheme === 'dark' ? DASHBOARD_DARK_THEME : DASHBOARD_LIGHT_THEME

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { height } = entries[0]?.contentRect ?? { height: 200 }
      setEditorHeight(Math.max(120, Math.floor(height)))
    })
    ro.observe(el)
    setEditorHeight(
      Math.max(120, Math.floor(el.getBoundingClientRect().height)),
    )
    return () => ro.disconnect()
  }, [])

  const handleBeforeMount = useCallback((monaco: typeof Monaco) => {
    defineDashboardThemes(monaco)
  }, [])

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-panel='query-editor'
    >
      {!hideHeader && (
        <div className='flex h-12 items-center justify-between border-b border-border px-3 py-2'>
          <h2 className='text-sm font-medium'>Editor</h2>
          {onRun && (
            <button
              type='button'
              onClick={onRun}
              disabled={isRunDisabled}
              className='rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50'
              aria-label='Run query'
            >
              Run
            </button>
          )}
        </div>
      )}
      <div
        className='flex min-h-0 flex-1 flex-col overflow-hidden bg-[var(--editor-bg)] p-3'
        aria-label='GraphQL query'
        data-testid='query-editor'
      >
        <div
          ref={containerRef}
          className='relative min-h-0 flex-1 overflow-hidden'
        >
          <Editor
            height={editorHeight}
            language={EDITOR_LANGUAGE}
            theme={theme}
            value={value}
            onChange={(v: string | undefined) => onChange(v ?? '')}
            options={EDITOR_OPTIONS}
            beforeMount={handleBeforeMount}
          />
        </div>
      </div>
    </div>
  )
}
