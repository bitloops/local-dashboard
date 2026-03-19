import { describe, expect, it, vi, beforeEach } from 'vitest'
import { createStore, type StoreApi } from 'zustand'
import { toast } from 'sonner'
import { getQuerySchema } from '@/features/query-explorer/query-client'
import { createQueryExplorerSlice } from './query-explorer'

vi.mock('@/features/query-explorer/query-client', () => ({
  getQuerySchema: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

const RUN_HISTORY_KEY = 'query-explorer-history'

const mockSchema = {
  Query: {
    fields: {
      repo: { type: 'Repo', args: { name: 'String!' } },
    },
  },
} as const

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

    it('has null schema, schemaLoading false, schemaError null', () => {
      const state = store.getState()
      expect(state.schema).toBeNull()
      expect(state.schemaLoading).toBe(false)
      expect(state.schemaError).toBeNull()
    })

    it('has empty runHistory when localStorage has invalid JSON', () => {
      localStorageData[RUN_HISTORY_KEY] = 'not json'
      const storeWithBadJson = createTestStore()
      expect(storeWithBadJson.getState().runHistory).toEqual([])
    })

    it('has empty runHistory when localStorage value is not an array', () => {
      localStorageData[RUN_HISTORY_KEY] = '{"id":"x","query":"q"}'
      const storeWithObject = createTestStore()
      expect(storeWithObject.getState().runHistory).toEqual([])
    })

    it('loads only valid HistoryEntry entries from localStorage', () => {
      const validEntry = {
        id: 'id-1',
        query: 'query { x }',
        variables: '{}',
        runAt: 1000,
      }
      localStorageData[RUN_HISTORY_KEY] = JSON.stringify([
        validEntry,
        { id: 123, query: 'q', variables: '{}', runAt: 1 },
        { id: 'id-2', query: null, variables: '{}', runAt: 2 },
        { id: 'id-3', query: 'q', variables: '{}' },
      ])
      const storeWithMixed = createTestStore()
      const history = storeWithMixed.getState().runHistory
      expect(history).toHaveLength(1)
      expect(history[0]).toEqual(validEntry)
    })

    it('has empty runHistory when localStorage array has no valid entries', () => {
      localStorageData[RUN_HISTORY_KEY] = JSON.stringify([
        { id: 1 },
        { query: 'q' },
        null,
      ])
      const storeWithInvalidOnly = createTestStore()
      expect(storeWithInvalidOnly.getState().runHistory).toEqual([])
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

  describe('loadSchema', () => {
    beforeEach(() => {
      vi.mocked(getQuerySchema).mockClear()
      vi.mocked(toast.error).mockClear()
    })

    it('sets schema and sets schemaLoading false on success', async () => {
      vi.mocked(getQuerySchema).mockResolvedValue(mockSchema)
      store.getState().loadSchema()
      expect(store.getState().schemaLoading).toBe(true)
      await vi.mocked(getQuerySchema).mock.results[0]?.value
      expect(store.getState().schema).toEqual(mockSchema)
      expect(store.getState().schemaLoading).toBe(false)
      expect(store.getState().schemaError).toBeNull()
    })

    it('sets schema null, schemaError, and schemaLoading false on failure', async () => {
      vi.mocked(getQuerySchema).mockRejectedValue(new Error('Network error'))
      store.getState().loadSchema()
      await vi.mocked(getQuerySchema).mock.results[0]?.value?.catch(() => {})
      expect(store.getState().schema).toBeNull()
      expect(store.getState().schemaLoading).toBe(false)
      expect(store.getState().schemaError).toBe('Network error')
      expect(toast.error).toHaveBeenCalledWith(
        'Could not fetch dependencies',
        expect.objectContaining({
          description:
            "Autocomplete won't work until dependencies are fetched.",
          duration: 6000,
        }),
      )
    })

    it('does not fetch when schema is already set', async () => {
      vi.mocked(getQuerySchema).mockResolvedValue(mockSchema)
      store.getState().loadSchema()
      await vi.mocked(getQuerySchema).mock.results[0]?.value
      expect(getQuerySchema).toHaveBeenCalledTimes(1)
      store.getState().loadSchema()
      expect(getQuerySchema).toHaveBeenCalledTimes(1)
    })

    it('allows retry after failure when schema is still null', async () => {
      vi.mocked(getQuerySchema).mockRejectedValue(new Error('fail'))
      store.getState().loadSchema()
      await vi.mocked(getQuerySchema).mock.results[0]?.value?.catch(() => {})
      expect(getQuerySchema).toHaveBeenCalledTimes(1)
      store.getState().loadSchema()
      expect(getQuerySchema).toHaveBeenCalledTimes(2)
    })

    it('does not fetch when schemaLoading is true', async () => {
      let resolvePromise!: (v: typeof mockSchema) => void
      vi.mocked(getQuerySchema).mockReturnValue(
        new Promise<typeof mockSchema>((resolve) => {
          resolvePromise = resolve
        }),
      )
      store.getState().loadSchema()
      store.getState().loadSchema()
      expect(getQuerySchema).toHaveBeenCalledTimes(1)
      resolvePromise(mockSchema)
      await vi.mocked(getQuerySchema).mock.results[0]?.value
    })
  })
})
