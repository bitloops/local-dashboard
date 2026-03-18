import { describe, expect, it } from 'vitest'
import { parse, buildASTSchema } from 'graphql'
import type { DevQLSchema } from '@/store/types'
import { devQLSchemaToSDL } from './schema-to-sdl'

const MINIMAL_SCHEMA: DevQLSchema = {
  Query: {
    fields: {
      repo: {
        type: 'Repo',
        args: { name: 'String!' },
        description: 'Select a repository',
      },
      search: {
        type: 'SearchResult',
        args: { query: 'String!' },
      },
    },
  },
  Repo: {
    fields: {
      ref: { type: 'Ref', args: { name: 'String!' } },
      commit: { type: 'Commit', args: { sha: 'String!' } },
      files: { type: '[File]', args: { path: 'String' } },
    },
  },
  Ref: {
    fields: {
      file: { type: 'File', args: { path: 'String!' } },
      files: { type: '[File]', args: { path: 'String' } },
    },
  },
  SearchResult: { fields: { __typename: { type: 'String' } } },
  Commit: { fields: { __typename: { type: 'String' } } },
  File: { fields: { __typename: { type: 'String' } } },
}

const MINIMAL_SCHEMA_EXPECTED_SDL = `type Query {
  repo(name: String!): Repo
  search(query: String!): SearchResult
}
type Repo {
  ref(name: String!): Ref
  commit(sha: String!): Commit
  files(path: String): [File]
}
type Ref {
  file(path: String!): File
  files(path: String): [File]
}
type SearchResult {
  __typename: String
}
type Commit {
  __typename: String
}
type File {
  __typename: String
}`.trimEnd()

describe('devQLSchemaToSDL', () => {
  it('emits SDL for Query, Repo, Ref with fields and args', () => {
    const sdl = devQLSchemaToSDL(MINIMAL_SCHEMA)
    expect(sdl).toBe(MINIMAL_SCHEMA_EXPECTED_SDL)
  })

  it('emits field without args as fieldName: returnType', () => {
    const schema: DevQLSchema = {
      Query: {
        fields: {
          ping: { type: 'String' },
        },
      },
    }
    const sdl = devQLSchemaToSDL(schema)
    expect(sdl).toContain('ping: String')
    expect(sdl).not.toContain('ping():')
  })

  it('emits type with placeholder field when type has no fields', () => {
    const schema: DevQLSchema = {
      Empty: { fields: {} },
    }
    const sdl = devQLSchemaToSDL(schema)
    expect(sdl).toContain('type Empty { _empty: Boolean }')
  })

  it('returns empty string for empty schema', () => {
    expect(devQLSchemaToSDL({})).toBe('')
  })

  it('returns empty string for null/undefined input', () => {
    expect(devQLSchemaToSDL(null as unknown as DevQLSchema)).toBe('')
    expect(devQLSchemaToSDL(undefined as unknown as DevQLSchema)).toBe('')
  })

  it('skips type entries without fields object', () => {
    const schema = {
      Query: { fields: { x: { type: 'String' } } },
      Bad: {},
      AlsoBad: { fields: null },
    } as unknown as DevQLSchema
    const sdl = devQLSchemaToSDL(schema)
    expect(sdl).toContain('type Query {')
    expect(sdl).toContain('x: String')
    expect(sdl).not.toContain('type Bad')
    expect(sdl).not.toContain('type AlsoBad')
  })

  it('generated SDL parses and builds a valid GraphQL schema', () => {
    const sdl = devQLSchemaToSDL(MINIMAL_SCHEMA)
    const ast = parse(sdl, { noLocation: true })
    expect(() => buildASTSchema(ast)).not.toThrow()
    const built = buildASTSchema(ast)
    expect(built.getType('Query')).toBeDefined()
    expect(built.getType('Repo')).toBeDefined()
    expect(built.getType('Ref')).toBeDefined()
  })
})
