import { createStore, useStore, type StoreApi } from 'zustand'
import { createQueryExplorerSlice } from './slices/query-explorer'
import type { QueryExplorerSlice } from './slices/query-explorer'

export type { HistoryEntry, SchemaMetadataCache } from './types'
export type { QueryExplorerState, QueryExplorerActions } from './slices/query-explorer'

export type RootState = QueryExplorerSlice

export function createRootStore() {
  return createStore<RootState>()(
    (
      set: StoreApi<RootState>['setState'],
      get: StoreApi<RootState>['getState'],
    ) => createQueryExplorerSlice(set, get),
  )
}

const rootStore = createRootStore()

/**
 * Use the root store. Prefer selectors to limit re-renders:
 */
export function useRootStore<T>(selector: (state: RootState) => T): T {
  return useStore(rootStore, selector)
}

/** Full store instance for non-React usage (e.g. tests). */
export const rootStoreInstance = rootStore
