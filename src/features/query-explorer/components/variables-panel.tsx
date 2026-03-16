import { useCallback, useEffect, useRef } from 'react'
import Editor from '@monaco-editor/react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import {
  defineDashboardThemes,
  DASHBOARD_DARK_VARIABLES_THEME,
  DASHBOARD_LIGHT_VARIABLES_THEME,
} from '../lib/monaco-theme'
import type * as Monaco from 'monaco-editor'

type VariablesPanelProps = {
  value: string
  onChange: (value: string) => void
  onValidationChange?: (hasErrors: boolean) => void
  className?: string
}

const EDITOR_LANGUAGE = 'json'

const EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  tabSize: 2,
  insertSpaces: true,
  wordWrap: 'on',
  minimap: { enabled: false },
  fontSize: 14,
  lineNumbers: 'on',
  scrollBeyondLastLine: false,
  padding: { top: 8, bottom: 24 },
}

export function VariablesPanel({
  value,
  onChange,
  onValidationChange,
  className,
}: VariablesPanelProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoRef = useRef<typeof Monaco | null>(null)
  const markersDisposableRef = useRef<Monaco.IDisposable | null>(null)
  const contentDisposableRef = useRef<Monaco.IDisposable | null>(null)
  const { resolvedTheme } = useTheme()
  const theme =
    resolvedTheme === 'dark'
      ? DASHBOARD_DARK_VARIABLES_THEME
      : DASHBOARD_LIGHT_VARIABLES_THEME

  const updateMarkers = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return
    const model = editor.getModel()
    if (!model) return
    const uri = model.uri
    const all = monaco.editor.getModelMarkers({ resource: uri })
    const errors = all.filter((m) => m.severity === monaco.MarkerSeverity.Error)
    onValidationChange?.(errors.length > 0)
  }, [onValidationChange])

  const handleEditorDidMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      defineDashboardThemes(monaco)
      editorRef.current = editor
      monacoRef.current = monaco
      const model = editor.getModel()
      if (model) {
        const uri = model.uri
        markersDisposableRef.current = monaco.editor.onDidChangeMarkers(
          (uris) => {
            if (uris.some((u) => u.toString() === uri.toString())) {
              updateMarkers()
            }
          },
        )
        contentDisposableRef.current = model.onDidChangeContent(() => {
          setTimeout(updateMarkers, 0)
        })
        updateMarkers()
      }
    },
    [updateMarkers],
  )

  useEffect(() => {
    return () => {
      markersDisposableRef.current?.dispose()
      markersDisposableRef.current = null
      contentDisposableRef.current?.dispose()
      contentDisposableRef.current = null
      editorRef.current = null
      monacoRef.current = null
    }
  }, [])

  const handleBeforeMount = useCallback((monaco: typeof Monaco) => {
    defineDashboardThemes(monaco)
  }, [])

  return (
    <div
      className={cn('flex min-h-0 flex-col', className)}
      data-panel='variables'
    >
      <div className='border-b border-border px-3 py-2'>
        <h2 className='text-sm font-medium'>Variables</h2>
        <p className='text-xs text-muted-foreground'>
          JSON object for query variables
        </p>
      </div>
      <div className='flex min-h-0 flex-1 flex-col'>
        <div
          className='relative min-h-0 flex-1 overflow-hidden bg-[var(--editor-bg-secondary)]'
          aria-label='Query variables JSON'
          data-testid='variables-editor'
        >
          <Editor
            height={160}
            language={EDITOR_LANGUAGE}
            theme={theme}
            value={value}
            onChange={(v: string | undefined) => onChange(v ?? '')}
            options={EDITOR_OPTIONS}
            beforeMount={handleBeforeMount}
            onMount={handleEditorDidMount}
          />
        </div>
      </div>
    </div>
  )
}
