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
      })
    )
    expect(result.current.pagination).toEqual({ pageIndex: 1, pageSize: 25 })
  })

  it('uses default pagination when search has no page/pageSize', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: {},
        navigate,
      })
    )
    expect(result.current.pagination).toEqual({ pageIndex: 0, pageSize: 10 })
  })

  it('onPaginationChange calls navigate with updated page', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: {},
        navigate,
      })
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
      })
    )
    expect(result.current.columnFilters).toEqual([
      { id: 'agent', value: 'claude' },
    ])
  })

  it('derives initial global filter from search', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { filter: 'hello' },
        navigate,
      })
    )
    expect(result.current.globalFilter).toBe('hello')
  })

  it('ensurePageInRange navigates when current page exceeds pageCount', () => {
    const navigate = vi.fn()
    const { result } = renderHook(() =>
      useTableUrlState({
        search: { page: 5 },
        navigate,
      })
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
})
