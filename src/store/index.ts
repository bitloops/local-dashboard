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
  HistoryStorageMode,
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
 * Ensure the schema is loaded. Safe to call repeatedly; the slice skips
 * while a fetch is in flight or after a successful load (schema set).
 * After a failed load, another call can retry (e.g. remounting Query Explorer).
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
