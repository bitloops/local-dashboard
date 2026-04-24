import { describe, expect, it, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTableUrlState } from './use-table-url-state'

describe('useTableUrlState', () => {
  it('derives initial pagination from search', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { page: 2, pageSize: 25 },
        navigate,
      }),
    )
    expect(result.current.pagination).toEqual({ pageIndex: 1, pageSize: 25 })
  })

  it('uses default pagination when search has no page/pageSize', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: {},
        navigate,
      }),
    )
    expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 10 })
  })

  it('uses custom pagination defaults and ignores non-number search values', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { current: '3', size: '25' },
        navigate,
        pagination: {
          pageKey: 'current',
          pageSizeKey: 'size',
          defaultPage: 2,
          defaultPageSize: 50,
        },
      }),
    )

    expect(result.current.pagination).toEqual({ pageIndex: 1, pageSize: 50 })
  })

  it('onPaginationChange calls navigate with updated page', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: {},
        navigate,
      }),
    )
    act(() => {
      result.current.onPaginationChange((prev) => ({
        ...prev,
        pageIndex: 2,
        pageSize: 10,
      }))
    })
    expect(navigate).toHaveBeenCalledWith({
      search: expect.any(Function),
    })
    const searchFn = navigate.mock.calls[0][0].search
    expect(searchFn({})).toEqual({ page: 3 })
  })

  it('derives initial column filters from search when type is string', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { agent: 'claude' },
        navigate,
        columnFilters: [
          { columnId: 'agent', searchKey: 'agent', type: 'string' },
        ],
      }),
    )
    expect(result.current.columnFilters).toEqual([
      { id: 'agent', value: 'claude' },
    ])
  })

  it('derives initial array column filters through a deserialiser', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { agents: 'claude,codex' },
        navigate,
        columnFilters: [
          {
            columnId: 'agent',
            searchKey: 'agents',
            type: 'array',
            deserialize: (value) =>
              typeof value === 'string' ? value.split(',') : [],
          },
        ],
      }),
    )

    expect(result.current.columnFilters).toEqual([
      { id: 'agent', value: ['claude', 'codex'] },
    ])
  })

  it('derives initial global filter from search', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { filter: 'hello' },
        navigate,
      }),
    )
    expect(result.current.globalFilter).toBe('hello')
  })

  it('omits the global filter state and handler when disabled', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { filter: 'ignored' },
        navigate,
        globalFilter: { enabled: false },
      }),
    )

    expect(result.current.globalFilter).toBeUndefined()
    expect(result.current.onGlobalFilterChange).toBeUndefined()
  })

  it('writes untrimmed global filters when configured', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { p: 4, query: 'old' },
        navigate,
        pagination: { pageKey: 'p' },
        globalFilter: { key: 'query', trim: false },
      }),
    )

    act(() => {
      result.current.onGlobalFilterChange?.('  keep spaces  ')
    })

    const searchFn = navigate.mock.calls[0][0].search
    expect(searchFn({ p: 4, query: 'old' })).toEqual({
      p: undefined,
      query: '  keep spaces  ',
    })
    expect(result.current.globalFilter).toBe('  keep spaces  ')
  })

  it('serialises column filter changes and clears empty filters', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: {},
        navigate,
        columnFilters: [
          { columnId: 'agent', searchKey: 'agent', type: 'string' },
          {
            columnId: 'statuses',
            searchKey: 'status',
            type: 'array',
            serialize: (value) =>
              Array.isArray(value) ? value.join(',') : value,
          },
        ],
      }),
    )

    act(() => {
      result.current.onColumnFiltersChange([
        { id: 'agent', value: 'codex' },
        { id: 'statuses', value: ['running', 'done'] },
      ])
    })

    const populatedSearchFn = navigate.mock.calls[0][0].search
    expect(populatedSearchFn({ page: 3 })).toEqual({
      page: undefined,
      agent: 'codex',
      status: 'running,done',
    })

    act(() => {
      result.current.onColumnFiltersChange([
        { id: 'agent', value: '   ' },
        { id: 'statuses', value: [] },
      ])
    })

    const emptySearchFn = navigate.mock.calls[1][0].search
    expect(emptySearchFn({ page: 3, agent: 'codex', status: 'done' })).toEqual({
      page: undefined,
      agent: undefined,
      status: undefined,
    })
  })

  it('ensurePageInRange navigates when current page exceeds pageCount', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { page: 5 },
        navigate,
      }),
    )
    act(() => {
      result.current.ensurePageInRange(3, { resetTo: 'first' })
    })
    expect(navigate).toHaveBeenCalledWith({
      replace: true,
      search: expect.any(Function),
    })
    const searchFn = navigate.mock.calls[0][0].search
    expect(searchFn({ page: 5 })).toEqual({ page: undefined })
  })

  it('ensurePageInRange can clamp to the last page', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { page: 5 },
        navigate,
      }),
    )

    act(() => {
      result.current.ensurePageInRange(3, { resetTo: 'last' })
    })

    const searchFn = navigate.mock.calls[0][0].search
    expect(searchFn({ page: 5 })).toEqual({ page: 3 })
  })

  it('ensurePageInRange does nothing when there are no pages or the current page fits', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { page: 2 },
        navigate,
      }),
    )

    act(() => {
      result.current.ensurePageInRange(0)
      result.current.ensurePageInRange(2)
    })

    expect(navigate).not.toHaveBeenCalled()
  })
})
