import { describe, expect, it } from 'vitest'
import type { DevQLSchema } from '@/store/types'
import { getSuggestions } from './get-suggestions'

const SCHEMA: DevQLSchema = {
  Query: {
    fields: {
      repo: {
        type: 'Repo',
        args: { name: 'String!' },
        description: 'Select a repository',
      },
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
  SearchResult: {
    fields: {
      __typename: { type: 'String' },
      hit: { type: 'String' },
    },
  },
  Commit: { fields: {} },
}

const ROOT = 'Query'

describe('getSuggestions', () => {
  it('returns root field suggestions for root context', () => {
    const got = getSuggestions({ kind: 'root' }, SCHEMA, ROOT, '')
    const labels = got.map((s) => s.label)
    expect(labels).toContain('repo')
    expect(labels).toContain('search')
    expect(got.every((s) => s.kind === 'field')).toBe(true)
  })

  it('returns nested field suggestions for nested context', () => {
    const got = getSuggestions(
      { kind: 'nested', typeName: 'Repo' },
      SCHEMA,
      ROOT,
      '',
    )
    const labels = got.map((s) => s.label)
    expect(labels).toContain('ref')
    expect(labels).toContain('commit')
  })

  it('does not suggest __typename as a field', () => {
    const got = getSuggestions(
      { kind: 'nested', typeName: 'SearchResult' },
      SCHEMA,
      ROOT,
      '',
    )
    const labels = got.map((s) => s.label)
    expect(labels).toContain('hit')
    expect(labels).not.toContain('__typename')
  })

  it('returns argument suggestions for argument context', () => {
    const got = getSuggestions(
      { kind: 'argument', typeName: 'Query', fieldName: 'repo' },
      SCHEMA,
      ROOT,
      '',
    )
    expect(got).toHaveLength(1)
    expect(got[0].label).toBe('name')
    expect(got[0].insertText).toBe('name: ')
    expect(got[0].kind).toBe('argument')
  })

  it('returns variable suggestions for variable context', () => {
    const doc = 'query ($foo: String) { repo(name: $foo) }'
    const got = getSuggestions({ kind: 'variable' }, SCHEMA, ROOT, doc)
    expect(got.some((s) => s.label === '$foo')).toBe(true)
  })

  it('returns operation variable suggestions in operation header', () => {
    const doc = 'query GetRepo($repo: String) { repo(name: $repo) }'
    const got = getSuggestions(
      { kind: 'operationVariableDefinition', afterColon: false },
      SCHEMA,
      ROOT,
      doc,
    )
    // Schema-derived: $name from repo(name: String!) → full def
    expect(
      got.some((s) => s.label === '$name' && s.insertText === '$name: String!'),
    ).toBe(true)
    // Document variable not in schema args → suggest with trailing : for user to type type
    expect(
      got.some((s) => s.label === '$repo' && s.insertText.endsWith(': ')),
    ).toBe(true)
  })

  it('returns type suggestions after colon in operation header', () => {
    const got = getSuggestions(
      { kind: 'operationVariableDefinition', afterColon: true },
      SCHEMA,
      ROOT,
      '',
    )
    const labels = got.map((s) => s.label)
    expect(labels).toContain('String')
    // Only input-valid types (scalars + types used in args), not object types like Query
    expect(labels).not.toContain('Query')
    expect(got.every((s) => s.kind === 'type')).toBe(true)
  })

  it('returns only query snippet for none context', () => {
    const got = getSuggestions({ kind: 'none' }, SCHEMA, ROOT, '')
    expect(got).toHaveLength(1)
    expect(got[0].label).toBe('query')
    expect(got[0].insertText).toContain('query ${1:Name}')
  })

  it('returns empty for unknown context', () => {
    const got = getSuggestions(
      { kind: 'nested', typeName: 'Missing' },
      SCHEMA,
      ROOT,
      '',
    )
    expect(got).toEqual([])
  })

  it('field with args has snippet insertText and isSnippet', () => {
    const got = getSuggestions({ kind: 'root' }, SCHEMA, ROOT, '')
    const repo = got.find((s) => s.label === 'repo')
    expect(repo).toBeDefined()
    expect(repo?.isSnippet).toBe(true)
    expect(repo?.insertText).toContain('$1')
    expect(repo?.insertText).toContain('$0')
  })

  it('field with description includes documentation', () => {
    const got = getSuggestions({ kind: 'root' }, SCHEMA, ROOT, '')
    const repo = got.find((s) => s.label === 'repo')
    expect(repo?.documentation).toBe('Select a repository')
  })
})
