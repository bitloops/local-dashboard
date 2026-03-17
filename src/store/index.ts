import {
  createStore,
  useStore as useZustandStore,
  type StoreApi,
} from 'zustand'
import { createQueryExplorerSlice } from './slices/query-explorer'
import type { QueryExplorerSlice } from './slices/query-explorer'

export type { DevQLSchema, HistoryEntry } from './types'
export type {
  QueryExplorerState,
  QueryExplorerActions,
} from './slices/query-explorer'

export type RootState = QueryExplorerSlice

export function createRootStore() {
  const store = createStore<RootState>()(
    (
      set: StoreApi<RootState>['setState'],
      get: StoreApi<RootState>['getState'],
    ) => createQueryExplorerSlice(set, get),
  )
  return store
}

const rootStore = createRootStore()

/**
 * Ensure the schema is loaded. Safe to call repeatedly; the slice will only
 * fetch once (guarded by schema / schemaLoading / schemaError).
 * Call from code paths that need the schema (e.g. Query Explorer).
 */
export function ensureSchemaLoaded(): void {
  rootStore.getState().loadSchema()
}

/**
 * Use the root store. Prefer selectors to limit re-renders.
 */
export function useStore<T>(selector: (state: RootState) => T): T {
  return useZustandStore(rootStore, selector)
}

/** Full store instance for non-React usage (e.g. tests). */
export const rootStoreInstance = rootStore
