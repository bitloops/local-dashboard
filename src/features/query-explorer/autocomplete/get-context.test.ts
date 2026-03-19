import { describe, expect, it } from 'vitest'
import type { DevQLSchema } from '@/store/types'
import {
  getContext,
  getRootTypeName,
  resolveFieldType,
  unwrapType,
} from './get-context'

const SCHEMA: DevQLSchema = {
  Query: {
    fields: {
      repo: { type: 'Repo', args: { name: 'String!' } },
      search: { type: 'SearchResult', args: { query: 'String!' } },
    },
  },
  Repo: {
    fields: {
      ref: { type: 'Ref', args: { name: 'String!' } },
      commit: { type: 'Commit', args: { sha: 'String!' } },
    },
  },
  Ref: { fields: {} },
  SearchResult: { fields: {} },
  Commit: { fields: {} },
}

describe('getRootTypeName', () => {
  it('returns Query when schema has Query.fields', () => {
    expect(getRootTypeName(SCHEMA)).toBe('Query')
  })

  it('returns first type with fields when no Query', () => {
    const noQuery = { Repo: SCHEMA.Repo }
    expect(getRootTypeName(noQuery as DevQLSchema)).toBe('Repo')
  })

  it('returns null for empty schema', () => {
    expect(getRootTypeName({})).toBe(null)
  })
})

describe('unwrapType', () => {
  it('strips ! and []', () => {
    expect(unwrapType('String!')).toBe('String')
    expect(unwrapType('[File]')).toBe('File')
    expect(unwrapType('[File]!')).toBe('File')
  })

  it('returns original string when unwrapped result is not a valid type name', () => {
    expect(unwrapType('[Type (malformed')).toBe('[Type (malformed')
    expect(unwrapType('Type! (x)')).toBe('Type! (x)')
  })
})

describe('resolveFieldType', () => {
  it('returns unwrapped field type', () => {
    expect(resolveFieldType(SCHEMA, 'Query', 'repo')).toBe('Repo')
    expect(resolveFieldType(SCHEMA, 'Repo', 'ref')).toBe('Ref')
  })

  it('returns null for missing type or field', () => {
    expect(resolveFieldType(SCHEMA, 'Query', 'missing')).toBe(null)
    expect(resolveFieldType(SCHEMA, 'Missing', 'repo')).toBe(null)
  })
})

describe('getContext', () => {
  const root = 'Query'

  it('returns none for offset out of range', () => {
    expect(getContext('query { }', -1, SCHEMA, root)).toEqual({ kind: 'none' })
    expect(getContext('query { }', 100, SCHEMA, root)).toEqual({
      kind: 'none',
    })
  })

  it('returns root after opening brace of operation', () => {
    expect(getContext('query { ', 8, SCHEMA, root)).toEqual({ kind: 'root' })
    expect(getContext('query X { ', 10, SCHEMA, root)).toEqual({
      kind: 'root',
    })
  })

  it('returns nested with type after entering nested selection', () => {
    const text = 'query { repo(name: "x") { '
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'nested',
      typeName: 'Repo',
    })
  })

  it('returns argument when inside field parens with last field', () => {
    const text = 'query { repo(name: "x") { ref('
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'argument',
      typeName: 'Repo',
      fieldName: 'ref',
    })
  })

  it('returns argument for repo( with no space before paren', () => {
    const text = 'query { repo('
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'argument',
      typeName: 'Query',
      fieldName: 'repo',
    })
  })

  it('returns variable when after $', () => {
    const text = 'query { repo(name: $var'
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'variable',
    })
  })

  it('returns operationVariableDefinition in operation header params', () => {
    const text = 'query GetRepo($'
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'operationVariableDefinition',
      afterColon: false,
    })
  })

  it('returns operationVariableDefinition with afterColon=true after :', () => {
    const text = 'query GetRepo($repo: '
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'operationVariableDefinition',
      afterColon: true,
    })
  })

  it('returns none at document start', () => {
    expect(getContext('query', 0, SCHEMA, root)).toEqual({ kind: 'none' })
  })

  it('returns none after a fully closed block', () => {
    const text = 'query { repo { } } '
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'none',
    })
  })

  it('ignores content inside line comment', () => {
    const text = 'query { # comment\n '
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'root',
    })
  })

  it('returns nested type for two-level selection', () => {
    const text = 'query { repo(name: "x") { ref(name: "y") { '
    expect(getContext(text, text.length, SCHEMA, root)).toEqual({
      kind: 'nested',
      typeName: 'Ref',
    })
  })

  describe('malformed / edge-case schemas', () => {
    it('falls back gracefully when field type is not in schema (orphaned ref)', () => {
      const orphanSchema: DevQLSchema = {
        Query: {
          fields: {
            missing: { type: 'NonExistent', args: {} },
          },
        },
      }
      // Enter missing's selection set — type can't be resolved so the stack
      // doesn't push, but we should still get a nested context.
      const text = 'query { missing { '
      const ctx = getContext(text, text.length, orphanSchema, 'Query')
      expect(ctx.kind).toBe('nested')
    })

    it('handles fields with undefined args gracefully', () => {
      const noArgsSchema: DevQLSchema = {
        Query: {
          fields: {
            simple: { type: 'String' },
          },
        },
      }
      const text = 'query { '
      const ctx = getContext(text, text.length, noArgsSchema, 'Query')
      expect(ctx).toEqual({ kind: 'root' })
    })

    it('handles type with empty fields object', () => {
      const emptyFieldsSchema: DevQLSchema = {
        Query: { fields: {} },
      }
      const text = 'query { '
      const ctx = getContext(text, text.length, emptyFieldsSchema, 'Query')
      expect(ctx).toEqual({ kind: 'root' })
    })

    it('does not crash with deeply nested orphaned types', () => {
      const deepSchema: DevQLSchema = {
        Query: {
          fields: {
            a: { type: 'A' },
          },
        },
        A: {
          fields: {
            b: { type: 'Missing' },
          },
        },
      }
      const text = 'query { a { b { '
      const ctx = getContext(text, text.length, deepSchema, 'Query')
      // b's type "Missing" isn't in schema, so the stack doesn't push it.
      // We're at braceDepth 3 which is > 1 → nested context.
      expect(ctx.kind).toBe('nested')
    })
  })
})
