import { describe, expect, it } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useResizeWidth } from './use-resize-width'

describe('useResizeWidth', () => {
  it('returns default width initially', () => {
    const { result } = renderHook(() =>
      useResizeWidth({
        defaultWidth: 400,
        minWidth: 200,
        maxWidth: 800,
      }),
    )
    const [width] = result.current
    expect(width).toBe(400)
  })

  it('returns a function as second value', () => {
    const { result } = renderHook(() =>
      useResizeWidth({
        defaultWidth: 500,
        minWidth: 280,
        maxWidth: 1200,
      }),
    )
    const [, onResizeStart] = result.current
    expect(typeof onResizeStart).toBe('function')
  })
})
