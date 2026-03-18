import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { RefObject } from 'react'
import type * as Monaco from 'monaco-editor'
import type { DevQLSchema } from '@/store/types'
import {
  useGraphQLCompletionProvider,
  wrapItemsForSameLineBrace,
} from './use-graphql-completion-provider'

/** Minimal model shape used by the completion provider in tests. */
type MockCompletionModel = {
  getValue: () => string
  getOffsetAt: (pos: { lineNumber: number; column: number }) => number
  getWordUntilPosition: (pos: unknown) => {
    startColumn: number
    endColumn: number
  }
  getLineContent: (lineNumber: number) => string
  getOptions: () => { insertSpaces: boolean; tabSize: number }
}

/** Shape of the config passed to registerCompletionItemProvider in tests. */
type MockProviderConfig = {
  triggerCharacters: string[]
  provideCompletionItems: (
    model: MockCompletionModel,
    position: { lineNumber: number; column: number },
  ) => { suggestions: unknown[] }
}

/** Shape of the config passed to registerOnTypeFormattingEditProvider. */
type MockFormattingConfig = {
  autoFormatTriggerCharacters: string[]
  provideOnTypeFormattingEdits: (
    model: MockCompletionModel,
    position: { lineNumber: number; column: number },
    ch: string,
  ) => unknown[]
}

const SCHEMA: DevQLSchema = {
  Query: {
    fields: {
      repo: { type: 'Repo', args: { name: 'String!' } },
      search: { type: 'SearchResult', args: { query: 'String!' } },
    },
  },
  Repo: { fields: { ref: { type: 'Ref' } } },
  Ref: { fields: {} },
  SearchResult: { fields: {} },
}

function createMockMonaco() {
  const completionDispose = vi.fn()
  const formattingDispose = vi.fn()
  let providerConfig: MockProviderConfig | null = null
  let formattingConfig: MockFormattingConfig | null = null

  const monaco = {
    languages: {
      registerCompletionItemProvider: vi.fn(
        (_language: string, config: MockProviderConfig) => {
          providerConfig = config
          return { dispose: completionDispose }
        },
      ),
      registerOnTypeFormattingEditProvider: vi.fn(
        (_language: string, config: MockFormattingConfig) => {
          formattingConfig = config
          return { dispose: formattingDispose }
        },
      ),
      CompletionItemKind: {
        Field: 9,
        Property: 10,
        Variable: 8,
        Class: 7,
      },
      CompletionItemInsertTextRule: {
        InsertAsSnippet: 4,
      },
    },
  }

  return {
    monaco: monaco as unknown as typeof Monaco,
    completionDispose,
    formattingDispose,
    getProviderConfig: () => providerConfig,
    getFormattingConfig: () => formattingConfig,
  }
}

/** Default editor options used by all test models. */
const DEFAULT_OPTS = { insertSpaces: false, tabSize: 2 }

describe('useGraphQLCompletionProvider', () => {
  it('does not register any providers when monaco is null', () => {
    const schemaRef = { current: SCHEMA }

    renderHook(() =>
      useGraphQLCompletionProvider(
        null,
        schemaRef as RefObject<DevQLSchema | null>,
      ),
    )

    // Nothing to assert on — just verifying no error is thrown.
  })

  it('registers both completion and formatting providers for graphql', () => {
    const { monaco, getProviderConfig, getFormattingConfig } =
      createMockMonaco()
    const schemaRef = { current: SCHEMA }

    renderHook(() =>
      useGraphQLCompletionProvider(
        monaco,
        schemaRef as RefObject<DevQLSchema | null>,
      ),
    )

    expect(
      monaco.languages.registerCompletionItemProvider,
    ).toHaveBeenCalledWith(
      'graphql',
      expect.objectContaining({
        triggerCharacters: ['{', ' ', '\n', '(', ':', '$', ','],
        provideCompletionItems: expect.any(Function),
      }),
    )

    expect(
      monaco.languages.registerOnTypeFormattingEditProvider,
    ).toHaveBeenCalledWith(
      'graphql',
      expect.objectContaining({
        autoFormatTriggerCharacters: ['}', '\n'],
        provideOnTypeFormattingEdits: expect.any(Function),
      }),
    )

    expect(getProviderConfig()).not.toBeNull()
    expect(getFormattingConfig()).not.toBeNull()
  })

  it('provideCompletionItems returns empty suggestions when schemaRef.current is null', () => {
    const { monaco, getProviderConfig } = createMockMonaco()
    const schemaRef = { current: null as DevQLSchema | null }

    renderHook(() =>
      useGraphQLCompletionProvider(
        monaco,
        schemaRef as RefObject<DevQLSchema | null>,
      ),
    )

    const config = getProviderConfig()!
    const model = {
      getValue: () => 'query { ',
      getOffsetAt: () => 8,
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 9 }),
      getLineContent: (lineNumber: number) =>
        lineNumber === 1 ? 'query { ' : '',
      getOptions: () => DEFAULT_OPTS,
    }
    const position = { lineNumber: 1, column: 9 }

    const result = config.provideCompletionItems(
      model as never,
      position as never,
    )

    expect(result.suggestions).toEqual([])
  })

  it('provideCompletionItems returns Monaco completion items from schema', () => {
    const { monaco, getProviderConfig } = createMockMonaco()
    const schemaRef = { current: SCHEMA }

    renderHook(() =>
      useGraphQLCompletionProvider(
        monaco,
        schemaRef as RefObject<DevQLSchema | null>,
      ),
    )

    const config = getProviderConfig()!
    const model = {
      getValue: () => 'query { ',
      getOffsetAt: () => 8,
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 9 }),
      getLineContent: (lineNumber: number) =>
        lineNumber === 1 ? 'query { ' : '',
      getOptions: () => DEFAULT_OPTS,
    }
    const position = { lineNumber: 1, column: 9 }

    const result = config.provideCompletionItems(
      model as never,
      position as never,
    )

    expect(result.suggestions.length).toBeGreaterThan(0)
    const labels = (result.suggestions as { label: string }[]).map(
      (s) => s.label,
    )
    expect(labels).toContain('repo')
    expect(labels).toContain('search')
    const first = result.suggestions[0] as {
      label: string
      insertText: string
      kind: number
      range: {
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
      }
    }
    expect(first).toHaveProperty('label')
    expect(first).toHaveProperty('insertText')
    expect(first).toHaveProperty('kind', 9) // Field
    expect(first.range).toEqual({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 9,
    })
  })

  it('wraps snippet with newlines and indentation for same-line braces', () => {
    const { monaco, getProviderConfig } = createMockMonaco()
    const schemaRef = { current: SCHEMA }

    renderHook(() =>
      useGraphQLCompletionProvider(
        monaco,
        schemaRef as RefObject<DevQLSchema | null>,
      ),
    )

    const config = getProviderConfig()!
    // Simulate cursor inside `query { | }` — same-line braces
    const model = {
      getValue: () => 'query { }',
      getOffsetAt: () => 8,
      getWordUntilPosition: () => ({ startColumn: 9, endColumn: 9 }),
      getLineContent: () => 'query { }',
      getOptions: () => DEFAULT_OPTS,
    }
    const position = { lineNumber: 1, column: 9 }

    const result = config.provideCompletionItems(
      model as never,
      position as never,
    )

    // Range should expand to eat the trailing " }"
    const first = result.suggestions[0] as {
      insertText: string
      range: {
        startLineNumber: number
        startColumn: number
        endLineNumber: number
        endColumn: number
      }
    }
    expect(first.range.endColumn).toBe(10) // end of line (length 9 + 1)

    // Snippet should start with \n + indent and end with \n + parent closing }
    expect(first.insertText).toMatch(/^\n\t/) // starts with newline + tab
    expect(first.insertText).toMatch(/\n\}$/) // ends with newline + closing brace
  })

  it('provideOnTypeFormattingEdits re-indents after newline', () => {
    const { monaco, getFormattingConfig } = createMockMonaco()
    const schemaRef = { current: SCHEMA }

    renderHook(() =>
      useGraphQLCompletionProvider(
        monaco,
        schemaRef as RefObject<DevQLSchema | null>,
      ),
    )

    const config = getFormattingConfig()!
    // Simulate typing Enter after "query {" — new line should be indented
    const text = 'query {\n'
    const model = {
      getValue: () => text,
      getOffsetAt: () => text.length,
      getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 }),
      getLineContent: (lineNumber: number) =>
        text.split('\n')[lineNumber - 1] ?? '',
      getOptions: () => DEFAULT_OPTS,
    }
    const position = { lineNumber: 2, column: 1 }

    const edits = config.provideOnTypeFormattingEdits(
      model as never,
      position as never,
      '\n',
    )

    expect(edits).toHaveLength(1)
    expect(edits[0]).toMatchObject({
      text: '\t',
    })
  })

  it('disposes both providers on unmount', () => {
    const { monaco, completionDispose, formattingDispose } = createMockMonaco()
    const schemaRef = { current: SCHEMA }

    const { unmount } = renderHook(() =>
      useGraphQLCompletionProvider(
        monaco,
        schemaRef as RefObject<DevQLSchema | null>,
      ),
    )

    expect(completionDispose).not.toHaveBeenCalled()
    expect(formattingDispose).not.toHaveBeenCalled()
    unmount()
    expect(completionDispose).toHaveBeenCalledTimes(1)
    expect(formattingDispose).toHaveBeenCalledTimes(1)
  })
})

describe('wrapItemsForSameLineBrace', () => {
  it('wraps a snippet item at depth 1 with correct indentation (tabs)', () => {
    const items = [
      {
        label: 'repo',
        insertText: 'repo($1) {\n\t$0\n}',
        kind: 'field' as const,
        isSnippet: true,
      },
    ]
    const result = wrapItemsForSameLineBrace(items, '\t', 1)
    // Expected: \n\trepo($1) {\n\t\t$0\n\t}\n}
    expect(result[0].insertText).toBe('\n\trepo($1) {\n\t\t$0\n\t}\n}')
  })

  it('wraps a snippet item at depth 2 with correct indentation (tabs)', () => {
    const items = [
      {
        label: 'ref',
        insertText: 'ref($1) {\n\t$0\n}',
        kind: 'field' as const,
        isSnippet: true,
      },
    ]
    const result = wrapItemsForSameLineBrace(items, '\t', 2)
    // Expected: \n\t\tref($1) {\n\t\t\t$0\n\t\t}\n\t}
    expect(result[0].insertText).toBe('\n\t\tref($1) {\n\t\t\t$0\n\t\t}\n\t}')
  })

  it('wraps a snippet item with space-based indentation', () => {
    const items = [
      {
        label: 'repo',
        insertText: 'repo($1) {\n\t$0\n}',
        kind: 'field' as const,
        isSnippet: true,
      },
    ]
    const result = wrapItemsForSameLineBrace(items, '  ', 1)
    expect(result[0].insertText).toBe('\n  repo($1) {\n    $0\n  }\n}')
  })

  it('wraps a non-snippet (leaf) item without emitting a nested selection set', () => {
    const items = [
      {
        label: '__typename',
        insertText: '__typename',
        kind: 'field' as const,
        isSnippet: false,
      },
    ]
    const result = wrapItemsForSameLineBrace(items, '\t', 1)
    // Leaf fields just get newline + indent, then parent closing brace
    expect(result[0].insertText).toBe('\n\t__typename\n}')
    expect(result[0].isSnippet).toBe(false)
  })

  it('wraps a non-snippet item at depth 2', () => {
    const items = [
      {
        label: '__typename',
        insertText: '__typename',
        kind: 'field' as const,
        isSnippet: false,
      },
    ]
    const result = wrapItemsForSameLineBrace(items, '\t', 2)
    expect(result[0].insertText).toBe('\n\t\t__typename\n\t}')
  })
})
