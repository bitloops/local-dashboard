import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { cn, sleep, getPageNumbers } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('handles conditional classes', () => {
    const showHidden = false
    const showBlock = true
    expect(cn('base', showHidden && 'hidden', showBlock && 'block')).toBe('base block')
  })

  it('deduplicates tailwind classes with twMerge', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
})

describe('sleep', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('resolves after given ms', async () => {
    const p = sleep(100)
    vi.advanceTimersByTime(100)
    await expect(p).resolves.toBeUndefined()
  })
})

describe('getPageNumbers', () => {
  it('returns all pages when totalPages <= 5', () => {
    expect(getPageNumbers(1, 3)).toEqual([1, 2, 3])
    expect(getPageNumbers(2, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('near beginning: first pages, ellipsis, last page', () => {
    expect(getPageNumbers(1, 10)).toEqual([1, 2, 3, 4, '...', 10])
    expect(getPageNumbers(3, 10)).toEqual([1, 2, 3, 4, '...', 10])
  })

  it('in middle: first, ellipsis, window, ellipsis, last', () => {
    expect(getPageNumbers(5, 10)).toEqual([1, '...', 4, 5, 6, '...', 10])
  })

  it('near end: first, ellipsis, last pages', () => {
    expect(getPageNumbers(10, 10)).toEqual([1, '...', 7, 8, 9, 10])
    expect(getPageNumbers(8, 10)).toEqual([1, '...', 7, 8, 9, 10])
  })
})
