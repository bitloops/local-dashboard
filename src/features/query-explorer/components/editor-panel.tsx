import { useCallback, useEffect, useRef, useState } from 'react'
import Editor from '@monaco-editor/react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/context/theme-provider'
import { useStore } from '@/store'
import {
  defineDashboardThemes,
  DASHBOARD_DARK_THEME,
  DASHBOARD_LIGHT_THEME,
} from '../../../styles/monaco-theme'
import type * as Monaco from 'monaco-editor'
import type { DevQLSchema } from '@/store/types'
import {
  FORMAT_GRAPHQL_COMMAND_ID,
  useGraphQLCompletionProvider,
} from '@/hooks/use-graphql-completion-provider'
import { formatGraphqlDocument } from '../graphql/format'

type QueryEditorPanelProps = {
  value: string
  onChange: (value: string) => void
  onRun?: () => void
  onFormat?: () => void
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
  wordBasedSuggestions: 'off',
  suggest: { showWords: false },
  formatOnType: true,
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
  onFormat,
  isRunDisabled = false,
  hideHeader = false,
  className,
}: QueryEditorPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null)
  const [editorHeight, setEditorHeight] = useState(200)
  const [monacoInstance, setMonacoInstance] = useState<typeof Monaco | null>(
    null,
  )
  const schemaRef = useRef<DevQLSchema | null>(null)
  const schema = useStore((s) => s.schema)

  useEffect(() => {
    schemaRef.current = schema
  }, [schema])

  useGraphQLCompletionProvider(monacoInstance, schemaRef)

  const { resolvedTheme } = useTheme()
  const theme =
    resolvedTheme === 'dark' ? DASHBOARD_DARK_THEME : DASHBOARD_LIGHT_THEME

  const applyFormattedValue = useCallback(async () => {
    const editor = editorRef.current
    if (!editor) {
      return
    }

    const model = editor.getModel()
    if (!model) {
      return
    }

    const source = model.getValue()
    try {
      const formatted = await formatGraphqlDocument(source)
      if (formatted === source) {
        return
      }
      editor.executeEdits('query-explorer.format', [
        {
          range: model.getFullModelRange(),
          text: formatted,
          forceMoveMarkers: true,
        },
      ])
      onChange(formatted)
    } catch {
      // Ignore formatting failures during interactive editing.
    }
  }, [onChange])

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

  const handleOnMount = useCallback(
    (editor: Monaco.editor.IStandaloneCodeEditor, monaco: typeof Monaco) => {
      editorRef.current = editor
      setMonacoInstance(monaco)

      const formatCommandDisposable = monaco.editor.registerCommand(
        FORMAT_GRAPHQL_COMMAND_ID,
        () => {
          void applyFormattedValue()
        },
      )

      editor.addAction({
        id: FORMAT_GRAPHQL_COMMAND_ID,
        label: 'Format GraphQL Query',
        keybindings: [
          monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF,
        ],
        run: async () => {
          await applyFormattedValue()
        },
      })

      const onTypeDisposable = editor.onDidChangeModelContent((event) => {
        const shouldFormat = event.changes.some(
          (change) =>
            change.text === '{' || change.text === '}' || change.text === '\n',
        )
        if (shouldFormat) {
          void applyFormattedValue()
        }
      })

      editor.onDidDispose(() => {
        formatCommandDisposable.dispose()
        onTypeDisposable.dispose()
        editorRef.current = null
      })
    },
    [applyFormattedValue],
  )

  return (
    <div
      className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}
      data-panel='query-editor'
    >
      {!hideHeader && (
        <div className='flex h-12 items-center justify-between border-b border-border px-3 py-2'>
          <h2 className='text-sm font-medium'>Editor</h2>
          <div className='flex items-center gap-2'>
            {onFormat && (
              <button
                type='button'
                onClick={onFormat}
                className='rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
                aria-label='Format query'
              >
                <span aria-hidden>{`{}`}</span>
              </button>
            )}
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
            onMount={handleOnMount}
          />
        </div>
      </div>
    </div>
  )
}
