import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { createStore, type StoreApi } from 'zustand'
import { getQuerySchema } from '@/features/query-explorer/query-client'
import {
  RUN_HISTORY_KEY,
  STORAGE_MODE_KEY,
} from '@/config/query-history-storage'
import { createRootStore } from '@/store'
import {
  createQueryExplorerSlice,
  getDefaultQueryExplorerVariables,
  syncQueryExplorerVariablesWithDashboardSelection,
} from './query-explorer'

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
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  describe('initial state', () => {
    it('has default query and variables', () => {
      const state = store.getState()
      expect(state.query).toContain('query Commits(')
      expect(state.variables).toBe(getDefaultQueryExplorerVariables(null))
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
      const recent = {
        id: 'b',
        query: 'q2',
        variables: '{}',
        runAt: 1_999_500,
      }
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

  describe('repo variable helpers', () => {
    it('builds default variables with empty repo and null branch when there is no selection', () => {
      expect(getDefaultQueryExplorerVariables(null)).toBe(
        '{\n  "repo": "",\n  "branch": null,\n  "commitsFirst": 10\n}',
      )
    })

    it('builds default variables with the selected repo and branch', () => {
      expect(getDefaultQueryExplorerVariables('acme/demo')).toBe(
        '{\n  "repo": "acme/demo",\n  "branch": null,\n  "commitsFirst": 10\n}',
      )
    })

    it('syncs repo and branch variables when dashboard selection changes', () => {
      expect(
        syncQueryExplorerVariablesWithDashboardSelection(
          '{"repo":"old/repo"}',
          'new/repo',
          'main',
        ),
      ).toEqual({
        updated: true,
        variables:
          '{\n  "repo": "new/repo",\n  "branch": "main",\n  "commitsFirst": 10\n}',
      })
    })

    it('treats repo-and-branch-only variable objects as default-shaped', () => {
      expect(
        syncQueryExplorerVariablesWithDashboardSelection(
          '{"repo":"old/repo","branch":"main"}',
          'new/repo',
          'develop',
        ),
      ).toEqual({
        updated: true,
        variables:
          '{\n  "repo": "new/repo",\n  "branch": "develop",\n  "commitsFirst": 10\n}',
      })
    })

    it('treats repo-branch-commitsFirst variable objects as default-shaped', () => {
      expect(
        syncQueryExplorerVariablesWithDashboardSelection(
          '{"repo":"old/repo","branch":"main","commitsFirst":20}',
          'new/repo',
          'develop',
        ),
      ).toEqual({
        updated: true,
        variables:
          '{\n  "repo": "new/repo",\n  "branch": "develop",\n  "commitsFirst": 10\n}',
      })
    })

    it('does not sync custom variable objects', () => {
      expect(
        syncQueryExplorerVariablesWithDashboardSelection(
          '{"repo":"old/repo","after":"cursor"}',
          'new/repo',
          'develop',
        ),
      ).toEqual({ updated: false })
    })

    it('does not sync invalid or non-object variables', () => {
      expect(
        syncQueryExplorerVariablesWithDashboardSelection(
          'not json',
          'new/repo',
          'develop',
        ),
      ).toEqual({ updated: false })
      expect(
        syncQueryExplorerVariablesWithDashboardSelection(
          'null',
          'new/repo',
          'develop',
        ),
      ).toEqual({ updated: false })
      expect(
        syncQueryExplorerVariablesWithDashboardSelection(
          '["repo"]',
          'new/repo',
          'develop',
        ),
      ).toEqual({ updated: false })
    })
  })

  describe('dashboard repo sync', () => {
    const repoOptions = [
      {
        repoId: 'repo-1',
        identity: 'acme/demo',
        name: 'demo',
        provider: 'github',
        organization: 'acme',
        defaultBranch: 'main',
      },
    ]

    it('updates query explorer variables when selectedRepoId changes and variables are still default-shaped', () => {
      const rootStore = createRootStore()

      rootStore.getState().setRepoOptions(repoOptions)
      rootStore.getState().setSelectedRepoId('repo-1')

      expect(rootStore.getState().variables).toBe(
        '{\n  "repo": "acme/demo",\n  "branch": null,\n  "commitsFirst": 10\n}',
      )
    })

    it('updates query explorer variables when selectedBranch changes and variables are still default-shaped', () => {
      const rootStore = createRootStore()

      rootStore.getState().setRepoOptions(repoOptions)
      rootStore.getState().setSelectedRepoId('repo-1')
      rootStore.getState().setSelectedBranch('main')

      expect(rootStore.getState().variables).toBe(
        '{\n  "repo": "acme/demo",\n  "branch": "main",\n  "commitsFirst": 10\n}',
      )
    })

    it('resyncs selectedRepoId using the repo identity when variables are still default-shaped', () => {
      const rootStore = createRootStore()

      rootStore.getState().setVariables('{"repo":"old/repo","branch":"main"}')
      rootStore.getState().setRepoOptions(repoOptions)
      rootStore.getState().setSelectedRepoId('repo-1')

      expect(rootStore.getState().variables).toBe(
        '{\n  "repo": "acme/demo",\n  "branch": null,\n  "commitsFirst": 10\n}',
      )
    })

    it('uses an empty repo variable when the selected repo is not in options', () => {
      const rootStore = createRootStore()

      rootStore.getState().setRepoOptions(repoOptions)
      rootStore.getState().setSelectedRepoId('missing-repo')

      expect(rootStore.getState().variables).toBe(
        '{\n  "repo": "",\n  "branch": null,\n  "commitsFirst": 10\n}',
      )
    })

    it('leaves custom query explorer variables unchanged on dashboard selection changes', () => {
      const rootStore = createRootStore()

      rootStore.getState().setVariables('{"repo":"old/repo","after":"cursor"}')
      rootStore.getState().setRepoOptions(repoOptions)
      rootStore.getState().setSelectedRepoId('repo-1')
      rootStore.getState().setSelectedBranch('main')

      expect(rootStore.getState().variables).toBe(
        '{"repo":"old/repo","after":"cursor"}',
      )
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

    it('does not retain or persist history when history storage mode is off', () => {
      localStorageData[STORAGE_MODE_KEY] = 'off'
      const s = createTestStore()
      vi.mocked(localStorage.setItem).mockClear()
      s.getState().addRunToHistory('query { a }', '{}')
      expect(s.getState().runHistory).toEqual([])
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

    it('starts with empty localStorage history when switching from off to local', () => {
      localStorageData[STORAGE_MODE_KEY] = 'off'
      const s = createTestStore()
      s.getState().addRunToHistory('query { a }', '{}')
      expect(localStorageData[RUN_HISTORY_KEY]).toBeUndefined()

      s.getState().setHistoryStorageMode('local')
      expect(localStorageData[STORAGE_MODE_KEY]).toBe('local')
      expect(s.getState().historyStorageMode).toBe('local')
      expect(localStorageData[RUN_HISTORY_KEY]).toBeDefined()
      expect(JSON.parse(localStorageData[RUN_HISTORY_KEY])).toEqual([])
    })

    it('starts with empty sessionStorage history when switching from off to session', () => {
      localStorageData[STORAGE_MODE_KEY] = 'off'
      const s = createTestStore()
      s.getState().addRunToHistory('query { a }', '{}')
      expect(sessionStorageData[RUN_HISTORY_KEY]).toBeUndefined()

      s.getState().setHistoryStorageMode('session')
      expect(localStorageData[STORAGE_MODE_KEY]).toBe('session')
      expect(s.getState().historyStorageMode).toBe('session')
      expect(sessionStorageData[RUN_HISTORY_KEY]).toBeDefined()
      expect(JSON.parse(sessionStorageData[RUN_HISTORY_KEY])).toEqual([])
    })

    it('clears existing in-memory history when switching to off', () => {
      store.getState().addRunToHistory('query { a }', '{}')
      expect(store.getState().runHistory).toHaveLength(1)

      store.getState().setHistoryStorageMode('off')

      expect(store.getState().historyStorageMode).toBe('off')
      expect(store.getState().runHistory).toEqual([])
      expect(localStorageData[RUN_HISTORY_KEY]).toBeUndefined()
      expect(sessionStorageData[RUN_HISTORY_KEY]).toBeUndefined()
    })

    it('prunes stale entries when switching to local mode', () => {
      vi.stubEnv('VITE_QUERY_HISTORY_TTL_MS', '1000')
      const now = 2_000_000
      vi.spyOn(Date, 'now').mockReturnValue(now)

      localStorageData[STORAGE_MODE_KEY] = 'off'
      const s = createTestStore()
      // Manually seed in-memory history with one fresh and one stale entry
      s.setState({
        runHistory: [
          { id: 'fresh', query: 'q1', variables: '{}', runAt: now - 500 },
          { id: 'stale', query: 'q2', variables: '{}', runAt: now - 5000 },
        ],
      })

      s.getState().setHistoryStorageMode('local')
      const stored = JSON.parse(localStorageData[RUN_HISTORY_KEY])
      expect(stored).toHaveLength(1)
      expect(stored[0].id).toBe('fresh')
      expect(s.getState().runHistory).toHaveLength(1)
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

    it('uses the fallback schema error when the thrown error has no message', async () => {
      vi.mocked(getQuerySchema).mockRejectedValue(new Error('   '))

      store.getState().loadSchema()
      await vi.mocked(getQuerySchema).mock.results[0]?.value?.catch(() => {})

      expect(store.getState().schema).toBeNull()
      expect(store.getState().schemaLoading).toBe(false)
      expect(store.getState().schemaError).toBe('Failed to load query schema')
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
