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
})
