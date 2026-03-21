import { describe, expect, it } from 'vitest'
import type { DevQLSchema } from '@/store/types'
import {
  getContext,
  getRootTypeName,
  getSuggestions,
  resolveFieldType,
  unwrapType,
} from '@/features/query-explorer/autocomplete'

const SCHEMA: DevQLSchema = {
  Query: { fields: { repo: { type: 'Repo' } } },
  Repo: { fields: {} },
}

describe('autocomplete public API', () => {
  it('exports getContext and getSuggestions for editor integration', () => {
    const context = getContext('query { ', 8, SCHEMA, 'Query')
    expect(context).toMatchObject({ kind: 'root' })
    const suggestions = getSuggestions(context, SCHEMA, 'Query', '')
    expect(suggestions.map((s) => s.label)).toContain('repo')
  })

  it('exports getRootTypeName, unwrapType, resolveFieldType for tests', () => {
    expect(getRootTypeName(SCHEMA)).toBe('Query')
    expect(unwrapType('String!')).toBe('String')
    expect(resolveFieldType(SCHEMA, 'Query', 'repo')).toBe('Repo')
  })
})
