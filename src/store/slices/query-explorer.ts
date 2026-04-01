import { getQuerySchema } from '@/features/query-explorer/query-client'
import { QUERY_EXPLORER_DEFAULT_QUERY } from '@/features/query-explorer/graphql/operations'
import {
  getHistoryStorage,
  getHistoryStorageForMode,
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

type QueryExplorerRootLikeState = QueryExplorerSlice & {
  selectedRepo?: string | null
  selectedBranch?: string | null
}

export function getDefaultQueryExplorerVariables(
  selectedRepo: string | null | undefined,
  selectedBranch?: string | null,
): string {
  return JSON.stringify(
    {
      repo: selectedRepo ?? '',
      branch: selectedBranch ?? null,
      commitsFirst: 10,
    },
    null,
    2,
  )
}

type SyncVariablesResult =
  | { updated: true; variables: string }
  | { updated: false }

export function syncQueryExplorerVariablesWithDashboardSelection(
  variables: string,
  selectedRepo: string | null,
  selectedBranch: string | null,
): SyncVariablesResult {
  try {
    const parsed = JSON.parse(variables) as Record<string, unknown>
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { updated: false }
    }

    const keys = Object.keys(parsed)
    if (
      keys.length === 0 ||
      keys.every(
        (key) => key === 'repo' || key === 'branch' || key === 'commitsFirst',
      )
    ) {
      return {
        updated: true,
        variables: getDefaultQueryExplorerVariables(
          selectedRepo,
          selectedBranch,
        ),
      }
    }

    return { updated: false }
  } catch {
    return { updated: false }
  }
}

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
  try {
    const storage = getHistoryStorageForMode(window, mode)
    if (!storage) return
    storage.setItem(RUN_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // ignore quota, SecurityError, or other storage errors
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

type GetState = StoreApi<QueryExplorerRootLikeState>['getState']
type SetState = StoreApi<QueryExplorerSlice>['setState']

export function createQueryExplorerSlice(
  set: SetState,
  get: GetState,
): QueryExplorerSlice {
  const initialState = get() as QueryExplorerRootLikeState | undefined

  return {
    query: QUERY_EXPLORER_DEFAULT_QUERY,
    variables: getDefaultQueryExplorerVariables(
      initialState?.selectedRepo,
      initialState?.selectedBranch,
    ),
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
