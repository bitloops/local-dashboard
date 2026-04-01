import { useEffect } from 'react'
import type * as Monaco from 'monaco-editor'
import type { RefObject } from 'react'
import type { DevQLSchema } from '@/store/types'
import {
  getContext,
  getRootTypeName,
  getSuggestions,
} from '@/features/query-explorer/autocomplete'
import type { SuggestionItem } from '@/features/query-explorer/autocomplete/types'
import {
  braceDepthAt,
  computeLineIndent,
} from '@/features/query-explorer/autocomplete/format-graphql'

const EDITOR_LANGUAGE = 'graphql'
export const FORMAT_GRAPHQL_COMMAND_ID = 'query-explorer.format-graphql'

const TRIGGER_CHARACTERS = ['{', ' ', '\n', '(', ':', '$', ',']

/**
 * Range for the current argument being typed: from the last "(" or "," on the
 * line to the cursor. Prevents duplicate-insertion issues like "name:name:".
 */
function getArgumentReplacementRange(
  model: Monaco.editor.ITextModel,
  position: Monaco.Position,
): Monaco.IRange {
  const line = model.getLineContent(position.lineNumber)
  const beforeCursor = line.slice(0, position.column - 1)
  const lastOpen = Math.max(
    beforeCursor.lastIndexOf('('),
    beforeCursor.lastIndexOf(','),
  )
  const startColumn = lastOpen === -1 ? 1 : lastOpen + 2
  return {
    startLineNumber: position.lineNumber,
    startColumn,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  }
}

/**
 * Transform suggestion items for insertion inside same-line braces
 * (e.g. `query { | }`).  Wraps each item with newlines and correct
 * indentation so the result expands into a properly formatted multi-line
 * block, and re-emits the parent closing `}` that the expanded range eats.
 *
 * Exported for unit testing.
 */
export function wrapItemsForSameLineBrace(
  items: SuggestionItem[],
  indentUnit: string,
  depth: number,
): SuggestionItem[] {
  // For non-snippet (leaf) fields we emit absolute in-document indentation,
  // because there is no snippet placeholder structure that Monaco will adjust.
  const absFieldIndent = indentUnit.repeat(depth)
  const absParentIndent = indentUnit.repeat(Math.max(0, depth - 1))

  // For snippet fields we emit relative indentation (+1, +2, +1, +0).
  // Monaco applies insertion context and the on-type formatter normalizes
  // final indentation after expansion/newline typing.
  const snippetFieldIndent = indentUnit
  const relBodyIndent = indentUnit.repeat(2)
  const relCloseIndent = indentUnit
  const relParentIndent = ''

  return items.map((item): SuggestionItem => {
    if (!item.isSnippet) {
      // Leaf fields (no args / no selection set): absolute indentation at depth.
      return {
        ...item,
        insertText: `\n${absFieldIndent}${item.insertText}\n${absParentIndent}}`,
      }
    }
    // Transform the canonical snippet (e.g. `repo($1) {\n\t$0\n}`)
    // into a correctly indented multi-line form using relative indents.
    // Use replaceAll so every placeholder `\t` is replaced, not just the first.
    let wrapped = item.insertText
    wrapped = wrapped.replaceAll('\t', relBodyIndent)
    wrapped = wrapped.replace(/\n\}$/, `\n${relCloseIndent}}`)
    return {
      ...item,
      insertText: `\n${snippetFieldIndent}${wrapped}\n${relParentIndent}}`,
    }
  })
}

/**
 * Registers the GraphQL completion provider and lightweight on-type indentation
 * formatting with Monaco when the editor is ready.
 */
export function useGraphQLCompletionProvider(
  monaco: typeof Monaco | null,
  schemaRef: RefObject<DevQLSchema | null>,
): void {
  useEffect(() => {
    if (!monaco) return

    // --- Completion provider ---
    const completionDisposable =
      monaco.languages.registerCompletionItemProvider(EDITOR_LANGUAGE, {
        triggerCharacters: TRIGGER_CHARACTERS,
        provideCompletionItems(model, position) {
          const currentSchema = schemaRef.current
          if (!currentSchema) return { suggestions: [] }
          const rootTypeName = getRootTypeName(currentSchema)
          if (!rootTypeName) return { suggestions: [] }

          const text = model.getValue()
          const offset = model.getOffsetAt(position)
          const context = getContext(text, offset, currentSchema, rootTypeName)
          let items = getSuggestions(context, currentSchema, rootTypeName, text)
          const word = model.getWordUntilPosition(position)
          const lineContent = model.getLineContent(position.lineNumber)

          // Detect same-line brace: cursor is between { and } on one line,
          // e.g. `query { | }`. We need to eat the trailing `}` and wrap
          // the snippet with proper newlines / indentation.
          const afterCursor = lineContent.slice(position.column - 1)
          const isSameLineBrace =
            (context.kind === 'root' || context.kind === 'nested') &&
            /^\s*\}\s*$/.test(afterCursor)

          let range: Monaco.IRange
          if (context.kind === 'argument') {
            range = getArgumentReplacementRange(model, position)
          } else if (isSameLineBrace) {
            // Expand range to eat everything from word start to end of line
            // (including the closing `}` that we'll re-emit in the snippet).
            range = {
              startLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: lineContent.length + 1,
            }
          } else {
            range = {
              startLineNumber: position.lineNumber,
              startColumn: word.startColumn,
              endLineNumber: position.lineNumber,
              endColumn: word.endColumn,
            }
          }

          if (isSameLineBrace) {
            const opts = model.getOptions()
            const insertSpaces = opts.insertSpaces ?? true
            const tabSize = opts.tabSize ?? 2
            const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '\t'
            const depth = braceDepthAt(text, offset)
            items = wrapItemsForSameLineBrace(items, indentUnit, depth)
          }

          const suggestions: Monaco.languages.CompletionItem[] = items.map(
            (item) => ({
              label: item.label,
              insertText: item.insertText,
              detail: item.detail,
              documentation: item.documentation
                ? { value: item.documentation }
                : undefined,
              kind:
                item.kind === 'field'
                  ? monaco.languages.CompletionItemKind.Field
                  : item.kind === 'argument'
                    ? monaco.languages.CompletionItemKind.Property
                    : item.kind === 'type'
                      ? monaco.languages.CompletionItemKind.Class
                      : monaco.languages.CompletionItemKind.Variable,
              insertTextRules: item.isSnippet
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
              range,
              command: {
                id: FORMAT_GRAPHQL_COMMAND_ID,
                title: 'Format GraphQL Query',
              },
            }),
          )

          return { suggestions }
        },
      })

    // --- On-type formatting provider ---
    const formattingDisposable =
      monaco.languages.registerOnTypeFormattingEditProvider(EDITOR_LANGUAGE, {
        autoFormatTriggerCharacters: ['}', '\n'],
        provideOnTypeFormattingEdits(model, position, ch) {
          const text = model.getValue()
          const lines = text.split('\n')
          const lineIndex = position.lineNumber - 1
          const opts = model.getOptions()
          const insertSpaces = opts.insertSpaces ?? true
          const tabSize = opts.tabSize ?? 2
          const indentUnit = insertSpaces ? ' '.repeat(tabSize) : '\t'

          const edit = computeLineIndent(lines, lineIndex, ch, indentUnit, text)
          if (!edit) return []

          const currentLine = lines[lineIndex]
          const currentIndentLength =
            currentLine.length - currentLine.trimStart().length

          return [
            {
              range: {
                startLineNumber: edit.lineNumber,
                startColumn: 1,
                endLineNumber: edit.lineNumber,
                endColumn: currentIndentLength + 1,
              },
              text: edit.newIndent,
            },
          ]
        },
      })

    return () => {
      completionDisposable.dispose()
      formattingDisposable.dispose()
    }
    // schemaRef is stable (ref identity never changes) but listed for exhaustive-deps.
    // We read schemaRef.current inside the provider so completion always sees the latest
    // schema without re-registering.
  }, [monaco, schemaRef])
}
