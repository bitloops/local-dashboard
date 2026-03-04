import { describe, expect, it } from 'vitest'
import {
  formatDateTime,
  parseTranscriptEntries,
  prettyPrintJson,
} from './checkpoint-sheet'

describe('formatDateTime', () => {
  it('formats valid ISO string to locale string', () => {
    const result = formatDateTime('2025-03-04T14:30:00.000Z')
    expect(result).not.toBe('2025-03-04T14:30:00.000Z')
    expect(new Date(result).getTime()).toBe(new Date('2025-03-04T14:30:00.000Z').getTime())
  })

  it('returns original value for invalid date', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})

describe('prettyPrintJson', () => {
  it('formats valid JSON with indentation', () => {
    const result = prettyPrintJson('{"a":1}')
    expect(result).toContain('  ')
    expect(JSON.parse(result)).toEqual({ a: 1 })
  })

  it('returns "-" for empty or whitespace-only string', () => {
    expect(prettyPrintJson('')).toBe('-')
    expect(prettyPrintJson('   ')).toBe('-')
  })

  it('returns original value on parse error', () => {
    expect(prettyPrintJson('not json')).toBe('not json')
  })
})

describe('parseTranscriptEntries', () => {
  it('parses JSONL with role and content', () => {
    const jsonl = '{"role":"user","content":"hello"}'
    const result = parseTranscriptEntries(jsonl)
    expect(result).toEqual([{ role: 'user', content: 'hello' }])
  })

  it('uses type as role when role missing', () => {
    const jsonl = '{"type":"assistant","content":"hi"}'
    const result = parseTranscriptEntries(jsonl)
    expect(result).toEqual([{ role: 'assistant', content: 'hi' }])
  })

  it('falls back to content from text, message, or delta', () => {
    const jsonl = '{"role":"user","text":"fallback"}'
    const result = parseTranscriptEntries(jsonl)
    expect(result[0].content).toBe('fallback')
  })

  it('stringifies non-string content', () => {
    const jsonl = '{"role":"user","content":{"nested":true}}'
    const result = parseTranscriptEntries(jsonl)
    expect(result[0].content).toContain('nested')
  })

  it('ignores empty lines', () => {
    const jsonl = '{"role":"user","content":"a"}\n\n{"role":"assistant","content":"b"}'
    const result = parseTranscriptEntries(jsonl)
    expect(result).toHaveLength(2)
  })

  it('returns line as content on parse error for a line', () => {
    const jsonl = 'not valid json'
    const result = parseTranscriptEntries(jsonl)
    expect(result).toHaveLength(1)
    expect(result[0].role).toMatch(/^line-\d+$/)
    expect(result[0].content).toBe('not valid json')
  })
})
