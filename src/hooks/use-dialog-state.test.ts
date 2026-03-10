import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import useDialogState from './use-dialog-state'

describe('useDialogState', () => {
  it('returns initial state as null when no argument', () => {
    const { result } = renderHook(() => useDialogState())
    expect(result.current[0]).toBe(null)
  })

  it('returns provided initial state', () => {
    const { result } = renderHook(() => useDialogState('approve'))
    expect(result.current[0]).toBe('approve')
  })

  it('setOpen with value opens to that value', () => {
    const { result } = renderHook(() => useDialogState<string | null>(null))
    expect(result.current[0]).toBe(null)
    act(() => {
      result.current[1]('approve')
    })
    expect(result.current[0]).toBe('approve')
  })

  it('setOpen with same value again closes (resets to null)', () => {
    const { result } = renderHook(() => useDialogState<string | null>(null))
    act(() => {
      result.current[1]('approve')
    })
    expect(result.current[0]).toBe('approve')
    act(() => {
      result.current[1]('approve')
    })
    expect(result.current[0]).toBe(null)
  })

  it('setOpen with different value switches value', () => {
    const { result } = renderHook(() => useDialogState<string | null>(null))
    act(() => {
      result.current[1]('approve')
    })
    act(() => {
      result.current[1]('reject')
    })
    expect(result.current[0]).toBe('reject')
  })

  it('setOpen(null) closes', () => {
    const { result } = renderHook(() =>
      useDialogState<string | null>('approve'),
    )
    act(() => {
      result.current[1](null)
    })
    expect(result.current[0]).toBe(null)
  })
})
