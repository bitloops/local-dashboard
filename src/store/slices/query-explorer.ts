import type { StoreApi } from 'zustand'
import type { ResultViewerState } from '@/features/query-explorer/components/result-viewer-panel'
import type { HistoryEntry } from '@/store/types'

const RUN_HISTORY_KEY = 'query-explorer-history'
const RUN_HISTORY_MAX = 50

const DEFAULT_QUERY = `# Sample query in GQL syntax

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

function isHistoryEntry(value: unknown): value is HistoryEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as HistoryEntry).id === 'string' &&
    typeof (value as HistoryEntry).query === 'string' &&
    typeof (value as HistoryEntry).variables === 'string' &&
    typeof (value as HistoryEntry).runAt === 'number'
  )
}

function getInitialRunHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RUN_HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isHistoryEntry)
  } catch {
    return []
  }
}

function persistRunHistory(history: HistoryEntry[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // ignore quota or other errors
  }
}

export type QueryExplorerState = {
  query: string
  variables: string
  result: ResultViewerState
  variablesHaveErrors: boolean
  runHistory: HistoryEntry[]
}

export type QueryExplorerActions = {
  setQuery: (query: string) => void
  setVariables: (variables: string) => void
  setVariablesHaveErrors: (value: boolean) => void
  setResult: (result: ResultViewerState) => void
  addRunToHistory: (query: string, variables: string) => void
  loadHistoryEntry: (id: string) => void
  removeHistoryEntry: (id: string) => void
  clearRunHistory: () => void
}

export type QueryExplorerSlice = QueryExplorerState & QueryExplorerActions

type GetState = StoreApi<QueryExplorerSlice>['getState']
type SetState = StoreApi<QueryExplorerSlice>['setState']

export function createQueryExplorerSlice(
  set: SetState,
  get: GetState,
): QueryExplorerSlice {
  return {
    query: DEFAULT_QUERY,
    variables: '{}',
    result: { status: 'idle' },
    variablesHaveErrors: false,
    runHistory: getInitialRunHistory(),

    setQuery: (query) => set({ query }),
    setVariables: (variables) => set({ variables }),
    setVariablesHaveErrors: (value) => set({ variablesHaveErrors: value }),
    setResult: (result) => set({ result }),

    addRunToHistory: (query, variables) => {
      const state = get()
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        query,
        variables,
        runAt: Date.now(),
      }
      const next = [entry, ...state.runHistory].slice(0, RUN_HISTORY_MAX)
      set({ runHistory: next })
      persistRunHistory(next)
    },

    loadHistoryEntry: (id) => {
      const state = get()
      const entry = state.runHistory.find((e) => e.id === id)
      if (entry) set({ query: entry.query, variables: entry.variables })
    },

    removeHistoryEntry: (id) => {
      const state = get()
      const next = state.runHistory.filter((e) => e.id !== id)
      set({ runHistory: next })
      persistRunHistory(next)
    },

    clearRunHistory: () => {
      set({ runHistory: [] })
      persistRunHistory([])
    },
  }
}
