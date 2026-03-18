import { describe, expect, it } from 'vitest'
import { braceDepthAt, computeLineIndent } from './format-graphql'

describe('braceDepthAt', () => {
  it('returns 0 for no braces', () => {
    expect(braceDepthAt('hello world', 11)).toBe(0)
  })

  it('counts unmatched opening braces', () => {
    expect(braceDepthAt('query { repo {', 14)).toBe(2)
  })

  it('matched braces cancel out', () => {
    expect(braceDepthAt('query { repo { } }', 18)).toBe(0)
  })

  it('ignores braces inside strings', () => {
    expect(braceDepthAt('repo(name: "{") {', 17)).toBe(1)
  })

  it('ignores braces inside comments', () => {
    expect(braceDepthAt('query { # }\n', 12)).toBe(1)
  })

  it('handles escaped characters in strings', () => {
    expect(braceDepthAt('repo(name: "\\"}") {', 19)).toBe(1)
  })

  it('respects upTo boundary', () => {
    expect(braceDepthAt('query { }', 8)).toBe(1)
    expect(braceDepthAt('query { }', 9)).toBe(0)
  })

  it('never returns negative', () => {
    expect(braceDepthAt('}}}}', 4)).toBe(0)
  })
})

describe('computeLineIndent', () => {
  describe('on newline (\\n)', () => {
    it('indents one level inside a single brace block (tabs)', () => {
      const text = 'query {\n'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 1, '\n', '\t', text)
      expect(edit).toEqual({ lineNumber: 2, newIndent: '\t' })
    })

    it('indents one level inside a single brace block (spaces)', () => {
      const text = 'query {\n'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 1, '\n', '  ', text)
      expect(edit).toEqual({ lineNumber: 2, newIndent: '  ' })
    })

    it('indents two levels inside nested braces', () => {
      const text = 'query {\n\trepo(name: "x") {\n'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 2, '\n', '\t', text)
      expect(edit).toEqual({ lineNumber: 3, newIndent: '\t\t' })
    })

    it('does not indent when not inside any braces', () => {
      const text = 'query\n'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 1, '\n', '\t', text)
      // Line 2 is empty with no indent needed — depth is 0
      expect(edit).toBeNull()
    })

    it('returns null when indentation already correct', () => {
      const text = 'query {\n\t'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 1, '\n', '\t', text)
      expect(edit).toBeNull()
    })
  })

  describe('on closing brace (})', () => {
    it('de-indents closing brace to match opening brace level', () => {
      const text = 'query {\n\t\t}'
      const lines = text.split('\n')
      // Line 2 has "\t\t}" — should be de-indented to "" (depth 0)
      const edit = computeLineIndent(lines, 1, '}', '\t', text)
      expect(edit).toEqual({ lineNumber: 2, newIndent: '' })
    })

    it('de-indents nested closing brace correctly', () => {
      const text = 'query {\n\trepo {\n\t\t\t}'
      const lines = text.split('\n')
      // Line 3 has "\t\t\t}" — depth before this line is 2, so closing brace at depth 1
      const edit = computeLineIndent(lines, 2, '}', '\t', text)
      expect(edit).toEqual({ lineNumber: 3, newIndent: '\t' })
    })

    it('returns null when indentation already correct', () => {
      const text = 'query {\n}'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 1, '}', '\t', text)
      expect(edit).toBeNull()
    })

    it('works with space-based indentation', () => {
      const text = 'query {\n    }'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 1, '}', '  ', text)
      expect(edit).toEqual({ lineNumber: 2, newIndent: '' })
    })
  })

  describe('edge cases', () => {
    it('returns null for out-of-range lineIndex', () => {
      const text = 'query { }'
      const lines = text.split('\n')
      expect(computeLineIndent(lines, -1, '\n', '\t', text)).toBeNull()
      expect(computeLineIndent(lines, 5, '\n', '\t', text)).toBeNull()
    })

    it('returns null for unrecognised trigger character', () => {
      const text = 'query { }'
      const lines = text.split('\n')
      expect(computeLineIndent(lines, 0, 'a', '\t', text)).toBeNull()
    })

    it('ignores braces inside strings when computing depth', () => {
      const text = 'query {\n\trepo(name: "{") {\n'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 2, '\n', '\t', text)
      // Depth should be 2 (the "{" inside the string is ignored)
      expect(edit).toEqual({ lineNumber: 3, newIndent: '\t\t' })
    })

    it('ignores braces inside comments when computing depth', () => {
      const text = 'query { # }\n'
      const lines = text.split('\n')
      const edit = computeLineIndent(lines, 1, '\n', '\t', text)
      // The } in the comment doesn't close the block — depth is still 1
      expect(edit).toEqual({ lineNumber: 2, newIndent: '\t' })
    })
  })
})
