import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createStore, type StoreApi } from 'zustand'
import { getQuerySchema } from '@/features/query-explorer/query-client'
import {
  RUN_HISTORY_KEY,
  STORAGE_MODE_KEY,
} from '@/config/query-history-storage'
import { createQueryExplorerSlice } from './query-explorer'

vi.mock('@/features/query-explorer/query-client', () => ({
  getQuerySchema: vi.fn(),
}))

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
  let sessionStorageData: Record<string, string>

  beforeEach(() => {
    localStorageData = {}
    sessionStorageData = {}
    vi.stubEnv('VITE_QUERY_HISTORY_TTL_MS', '')
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageData[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageData[key]
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    vi.stubGlobal('sessionStorage', {
      getItem: vi.fn((key: string) => sessionStorageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        sessionStorageData[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete sessionStorageData[key]
      }),
      clear: vi.fn(),
      length: 0,
      key: vi.fn(),
    })
    store = createTestStore()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
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

    it('has historyStorageMode local by default', () => {
      expect(store.getState().historyStorageMode).toBe('local')
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
        runAt: Date.now() - 60_000,
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

    it('drops entries older than TTL on load', () => {
      vi.stubEnv('VITE_QUERY_HISTORY_TTL_MS', '1000')
      const now = 2_000_000
      vi.spyOn(Date, 'now').mockReturnValue(now)
      const old = { id: 'a', query: 'q', variables: '{}', runAt: 100 }
      const recent = { id: 'b', query: 'q2', variables: '{}', runAt: 1_999_500 }
      localStorageData[RUN_HISTORY_KEY] = JSON.stringify([old, recent])
      const storeWithTtl = createTestStore()
      expect(storeWithTtl.getState().runHistory).toEqual([recent])
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

    it('does not persist when history storage mode is off', () => {
      localStorageData[STORAGE_MODE_KEY] = 'off'
      const s = createTestStore()
      vi.mocked(localStorage.setItem).mockClear()
      s.getState().addRunToHistory('query { a }', '{}')
      expect(localStorageData[RUN_HISTORY_KEY]).toBeUndefined()
      expect(sessionStorageData[RUN_HISTORY_KEY]).toBeUndefined()
    })

    it('persists to sessionStorage when mode is session', () => {
      localStorageData[STORAGE_MODE_KEY] = 'session'
      const s = createTestStore()
      s.getState().addRunToHistory('query { a }', '{}')
      expect(sessionStorageData[RUN_HISTORY_KEY]).toBeDefined()
      expect(JSON.parse(sessionStorageData[RUN_HISTORY_KEY])).toHaveLength(1)
    })
  })

  describe('setHistoryStorageMode', () => {
    it('writes preference to localStorage and migrates history to session', () => {
      store.getState().addRunToHistory('query { a }', '{}')
      store.getState().setHistoryStorageMode('session')
      expect(localStorageData[STORAGE_MODE_KEY]).toBe('session')
      expect(store.getState().historyStorageMode).toBe('session')
      expect(sessionStorageData[RUN_HISTORY_KEY]).toBeDefined()
      expect(JSON.parse(sessionStorageData[RUN_HISTORY_KEY])).toHaveLength(1)
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
