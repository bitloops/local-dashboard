import { useCallback, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { QueryExplorerLayout } from './components/query-explorer'
import { QueryEditorPanel } from './components/query-editor-panel'
import { ResultViewerPanel } from './components/result-viewer-panel'
import type { ResultViewerState } from './components/result-viewer-panel'
import { VariablesPanel } from './components/variables-panel'
import { useResizeWidth } from './hooks/use-resize-width'

const EDITOR_PANEL_MIN = 280
const EDITOR_PANEL_MAX = 1200
const EDITOR_PANEL_DEFAULT = 780

export const DEFAULT_QUERY = `# Sample query in GQL syntax

query GetArtefacts($repo: String!, $ref: String!, $path: String!) {
  repo(name: $repo) {
    ref(name: $ref) {
      file(path: $path) {
        artefacts {
          symbolFqn
          canonicalKind
          semantics {
            summary
          }
        }
      }
    }
  }
}
`

export function QueryExplorer() {
  const [query, setQuery] = useState(DEFAULT_QUERY)
  const [variables, setVariables] = useState('{}')
  const [result, setResult] = useState<ResultViewerState>({ status: 'idle' })
  const [variablesHaveErrors, setVariablesHaveErrors] = useState(false)
  const [editorPanelWidth, onResizeStart] = useResizeWidth({
    defaultWidth: EDITOR_PANEL_DEFAULT,
    minWidth: EDITOR_PANEL_MIN,
    maxWidth: EDITOR_PANEL_MAX,
  })

  const handleRunQuery = useCallback(() => {
    let parsed: unknown
    try {
      parsed = JSON.parse(variables)
    } catch {
      setResult({
        status: 'error',
        error: 'Invalid JSON in variables.',
      })
      return
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      setResult({
        status: 'error',
        error: 'Variables must be a JSON object.',
      })
      return
    }
    setResult({ status: 'loading' })
    // TODO: fetch(GRAPHQL_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: parsed }) })
    setResult({
      status: 'success',
      data: { message: 'Query execution not implemented.' },
    })
  }, [variables])

  return (
    <>
      <Header className='pe-8'>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>
      <Main fixed>
        <div className='mb-4 flex min-h-0 flex-1 flex-col'>
          <div className='shrink-0'>
            <h1 className='text-2xl font-bold tracking-tight'>
              Query Explorer
            </h1>
            <p className='mt-1 text-sm text-muted-foreground'>
              Query and explore your code intelligence data.
            </p>
          </div>
          <QueryExplorerLayout
            className='mt-4'
            editorPanelWidth={editorPanelWidth}
            onResizeStart={onResizeStart}
            leftPanel={
              <QueryEditorPanel
                value={query}
                onChange={setQuery}
                onRun={handleRunQuery}
                isRunDisabled={variablesHaveErrors}
              />
            }
            rightPanel={<ResultViewerPanel result={result} />}
            bottomPanel={
              <VariablesPanel
                value={variables}
                onChange={setVariables}
                onValidationChange={setVariablesHaveErrors}
              />
            }
          />
        </div>
      </Main>
    </>
  )
}
