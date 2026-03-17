import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createStore, type StoreApi } from 'zustand'
import { createQueryExplorerSlice } from './query-explorer'

const RUN_HISTORY_KEY = 'query-explorer-history'

function createTestStore() {
  return createStore<ReturnType<typeof createQueryExplorerSlice>>()(
    (
      set: StoreApi<ReturnType<typeof createQueryExplorerSlice>>['setState'],
      get: StoreApi<ReturnType<typeof createQueryExplorerSlice>>['getState'],
    ) => createQueryExplorerSlice(set, get),
  )
}

describe('query-explorer slice', () => {
  let store: ReturnType<typeof createTestStore>
  let localStorageData: Record<string, string>

  beforeEach(() => {
    localStorageData = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageData[key] = value
      }),
      removeItem: vi.fn(),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    store = createTestStore()
  })

  describe('initial state', () => {
    it('has default query and variables', () => {
      const state = store.getState()
      expect(state.query).toContain('query GetArtefacts')
      expect(state.variables).toBe('{}')
    })

    it('has idle result', () => {
      expect(store.getState().result).toEqual({ status: 'idle' })
    })

    it('has empty runHistory when localStorage is empty', () => {
      expect(store.getState().runHistory).toEqual([])
    })
  })

  describe('setQuery / setVariables', () => {
    it('updates query', () => {
      store.getState().setQuery('query { x }')
      expect(store.getState().query).toBe('query { x }')
    })

    it('updates variables', () => {
      store.getState().setVariables('{"a":1}')
      expect(store.getState().variables).toBe('{"a":1}')
    })
  })

  describe('setResult', () => {
    it('updates result to loading', () => {
      store.getState().setResult({ status: 'loading' })
      expect(store.getState().result).toEqual({ status: 'loading' })
    })

    it('updates result to success', () => {
      store.getState().setResult({
        status: 'success',
        data: { x: 1 },
        errors: undefined,
      })
      expect(store.getState().result).toEqual({
        status: 'success',
        data: { x: 1 },
        errors: undefined,
      })
    })
  })

  describe('addRunToHistory', () => {
    it('prepends entry to runHistory', () => {
      store.getState().addRunToHistory('query { a }', '{}')
      const history = store.getState().runHistory
      expect(history).toHaveLength(1)
      expect(history[0].query).toBe('query { a }')
      expect(history[0].variables).toBe('{}')
      expect(history[0].id).toBeDefined()
      expect(history[0].runAt).toBeDefined()
    })

    it('persists to localStorage', () => {
      store.getState().addRunToHistory('query { a }', '{}')
      expect(localStorage.setItem).toHaveBeenCalledWith(
        RUN_HISTORY_KEY,
        expect.any(String),
      )
      const stored = JSON.parse(localStorageData[RUN_HISTORY_KEY])
      expect(stored).toHaveLength(1)
      expect(stored[0].query).toBe('query { a }')
    })
  })

  describe('loadHistoryEntry', () => {
    it('sets query and variables from entry', () => {
      store.getState().addRunToHistory('query X { x }', '{"id":"1"}')
      const id = store.getState().runHistory[0].id
      store.getState().setQuery('other')
      store.getState().setVariables('{}')
      store.getState().loadHistoryEntry(id)
      expect(store.getState().query).toBe('query X { x }')
      expect(store.getState().variables).toBe('{"id":"1"}')
    })

    it('does nothing when id not found', () => {
      store.getState().setQuery('q')
      store.getState().loadHistoryEntry('nonexistent')
      expect(store.getState().query).toBe('q')
    })
  })

  describe('removeHistoryEntry', () => {
    it('removes entry and persists', () => {
      store.getState().addRunToHistory('query { a }', '{}')
      const id = store.getState().runHistory[0].id
      store.getState().removeHistoryEntry(id)
      expect(store.getState().runHistory).toHaveLength(0)
      expect(JSON.parse(localStorageData[RUN_HISTORY_KEY])).toHaveLength(0)
    })
  })

  describe('clearRunHistory', () => {
    it('clears runHistory and localStorage', () => {
      store.getState().addRunToHistory('query { a }', '{}')
      store.getState().clearRunHistory()
      expect(store.getState().runHistory).toEqual([])
      expect(localStorageData[RUN_HISTORY_KEY]).toBe('[]')
    })
  })
})
