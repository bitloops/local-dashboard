import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { getCookie, setCookie, removeCookie } from './cookies'

describe('getCookie', () => {
  beforeEach(() => {
    setCookie('foo', 'bar', 3600)
    setCookie('baz', 'qux', 3600)
  })
  afterEach(() => {
    removeCookie('foo')
    removeCookie('baz')
  })

  it('returns value when cookie exists', () => {
    expect(getCookie('foo')).toBe('bar')
    expect(getCookie('baz')).toBe('qux')
  })

  it('returns undefined when cookie does not exist', () => {
    expect(getCookie('missing')).toBeUndefined()
  })
})

describe('setCookie', () => {
  afterEach(() => {
    document.cookie = 'test=; path=/; max-age=0'
  })

  it('sets cookie that getCookie can read', () => {
    setCookie('test', 'value', 3600)
    expect(getCookie('test')).toBe('value')
  })
})

describe('removeCookie', () => {
  it('removes cookie so getCookie returns undefined', () => {
    setCookie('toRemove', 'x', 3600)
    expect(getCookie('toRemove')).toBe('x')
    removeCookie('toRemove')
    expect(getCookie('toRemove')).toBeUndefined()
  })
})
