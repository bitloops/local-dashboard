import { getQuerySchema } from '@/features/query-explorer/query-client'
import {
  getHistoryStorage,
  getHistoryStorageModeFromWindow,
  getHistoryTtlMs,
  pruneHistoryByTtl,
  RUN_HISTORY_KEY,
  STORAGE_MODE_KEY,
  type HistoryStorageMode,
} from '@/config/query-history-storage'
import type { StoreApi } from 'zustand'
import type { ResultViewerState } from '@/features/query-explorer/components/result-viewer-panel'
import type { DevQLSchema, HistoryEntry } from '@/store/types'

export type { HistoryStorageMode }

const RUN_HISTORY_MAX = 50

const DEFAULT_QUERY = `# Hold Ctrl/Cmd+Space to see autocomplete suggestions.
# Sample query in GQL syntax

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

function parseHistoryFromRaw(raw: string): HistoryEntry[] {
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed)) return []
  return parsed.filter(isHistoryEntry)
}

function getInitialRunHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    const storage = getHistoryStorage(window)
    if (!storage) return []
    const raw = storage.getItem(RUN_HISTORY_KEY)
    if (!raw) return []
    const entries = parseHistoryFromRaw(raw)
    const ttlMs = getHistoryTtlMs()
    const now = Date.now()
    const pruned = pruneHistoryByTtl(entries, now, ttlMs)
    if (pruned.length !== entries.length) {
      try {
        storage.setItem(RUN_HISTORY_KEY, JSON.stringify(pruned))
      } catch {
        // ignore
      }
    }
    return pruned
  } catch {
    return []
  }
}

/**
 * Persist history to the appropriate storage backend.
 * Accepts the current mode from the store to avoid an extra localStorage read
 * on every mutation.
 */
function persistRunHistory(history: HistoryEntry[], mode: HistoryStorageMode) {
  if (typeof window === 'undefined') return
  if (mode === 'off') return
  const storage =
    mode === 'session' ? window.sessionStorage : window.localStorage
  try {
    storage.setItem(RUN_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // ignore quota or other errors
  }
}

function clearHistoryFromBothStorages() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(RUN_HISTORY_KEY)
    window.sessionStorage.removeItem(RUN_HISTORY_KEY)
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[query-history] Failed to clear history from storage:', err)
    }
  }
}

export type QueryExplorerState = {
  query: string
  variables: string
  result: ResultViewerState
  variablesHaveErrors: boolean
  /** RFC schema for autocomplete; fetched once per session. */
  schema: DevQLSchema | null
  schemaLoading: boolean
  schemaError: string | null
  runHistory: HistoryEntry[]
  /** Where run history is persisted; preference lives in localStorage. */
  historyStorageMode: HistoryStorageMode
}

export type QueryExplorerActions = {
  setQuery: (query: string) => void
  setVariables: (variables: string) => void
  setVariablesHaveErrors: (value: boolean) => void
  setResult: (result: ResultViewerState) => void
  loadSchema: () => void
  addRunToHistory: (query: string, variables: string) => void
  loadHistoryEntry: (id: string) => void
  removeHistoryEntry: (id: string) => void
  clearRunHistory: () => void
  setHistoryStorageMode: (mode: HistoryStorageMode) => void
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
    schema: null,
    schemaLoading: false,
    schemaError: null,
    runHistory: getInitialRunHistory(),
    historyStorageMode:
      typeof window !== 'undefined'
        ? getHistoryStorageModeFromWindow(window)
        : 'local',

    setQuery: (query) => set({ query }),
    setVariables: (variables) => set({ variables }),
    setVariablesHaveErrors: (value) => set({ variablesHaveErrors: value }),
    setResult: (result) => set({ result }),

    loadSchema: () => {
      const state = get()
      if (state.schemaLoading || state.schema !== null) return
      set({ schemaLoading: true, schemaError: null })
      getQuerySchema()
        .then((data) =>
          set({
            schema: data,
            schemaLoading: false,
            schemaError: null,
          }),
        )
        .catch((err: unknown) => {
          const schemaErrorMessage =
            err instanceof Error && err.message.trim().length > 0
              ? err.message
              : 'Failed to load query schema'
          set({
            schema: null,
            schemaLoading: false,
            schemaError: schemaErrorMessage,
          })
        })
    },

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
      persistRunHistory(next, state.historyStorageMode)
    },

    loadHistoryEntry: (id) => {
      const state = get()
      const entry = state.runHistory.find((e: HistoryEntry) => e.id === id)
      if (entry) set({ query: entry.query, variables: entry.variables })
    },

    removeHistoryEntry: (id) => {
      const state = get()
      const next = state.runHistory.filter((e: HistoryEntry) => e.id !== id)
      set({ runHistory: next })
      persistRunHistory(next, state.historyStorageMode)
    },

    clearRunHistory: () => {
      set({ runHistory: [] })
      persistRunHistory([], get().historyStorageMode)
    },

    setHistoryStorageMode: (mode) => {
      set((state: QueryExplorerSlice) => {
        if (typeof window === 'undefined') {
          return { historyStorageMode: mode }
        }
        try {
          window.localStorage.setItem(STORAGE_MODE_KEY, mode)
        } catch {
          // ignore
        }

        try {
          if (mode === 'off') {
            clearHistoryFromBothStorages()
          } else if (mode === 'local') {
            // Prune stale entries before writing to localStorage so entries
            // that accumulated in memory (e.g. while in session/off mode) don't
            // bypass the TTL that would have been enforced on a normal load.
            const pruned = pruneHistoryByTtl(
              state.runHistory,
              Date.now(),
              getHistoryTtlMs(),
            )
            window.sessionStorage.removeItem(RUN_HISTORY_KEY)
            window.localStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(pruned))
            return { historyStorageMode: mode, runHistory: pruned }
          } else {
            window.localStorage.removeItem(RUN_HISTORY_KEY)
            window.sessionStorage.setItem(
              RUN_HISTORY_KEY,
              JSON.stringify(state.runHistory),
            )
          }
        } catch {
          // ignore
        }

        return { historyStorageMode: mode }
      })
    },
  }
}
