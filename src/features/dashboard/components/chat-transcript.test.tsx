import { describe, expect, it } from 'vitest'
import {
  formatDisplayName,
  isUserRole,
  isToolRole,
} from './chat-transcript'

describe('formatDisplayName', () => {
  it('strips email from "Name EMAIL" API format', () => {
    expect(formatDisplayName('Wayne Omoga OMOGA@GMAIL.COM')).toBe('Wayne Omoga')
    expect(formatDisplayName('Wayne Omoga omoga@gmail.com')).toBe('Wayne Omoga')
  })

  it('returns name only when no email', () => {
    expect(formatDisplayName('Name Only')).toBe('Name Only')
  })

  it('returns original when only email (fallback)', () => {
    expect(formatDisplayName('user@example.com')).toBe('user@example.com')
  })

  it('handles empty string', () => {
    expect(formatDisplayName('')).toBe('')
  })

  it('trims and removes token containing @', () => {
    expect(formatDisplayName('  A  B  C@X.COM  ')).toBe('A B')
  })
})

describe('isUserRole', () => {
  it('returns true for "user" and "human"', () => {
    expect(isUserRole('user')).toBe(true)
    expect(isUserRole('human')).toBe(true)
  })

  it('returns false for other roles', () => {
    expect(isUserRole('assistant')).toBe(false)
    expect(isUserRole('tool')).toBe(false)
    expect(isUserRole('')).toBe(false)
    expect(isUserRole('agent')).toBe(false)
  })
})

describe('isToolRole', () => {
  it('returns true for tool, system, and tool_* roles', () => {
    expect(isToolRole('tool')).toBe(true)
    expect(isToolRole('system')).toBe(true)
    expect(isToolRole('tool_foo')).toBe(true)
  })

  it('returns false for user and assistant', () => {
    expect(isToolRole('user')).toBe(false)
    expect(isToolRole('assistant')).toBe(false)
  })
})
