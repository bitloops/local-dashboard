/**
 * Cursor position context for GraphQL autocomplete.
 */
export type AutocompleteContext =
  | { kind: 'root' }
  | { kind: 'nested'; typeName: string }
  | { kind: 'argument'; typeName: string; fieldName: string }
  | { kind: 'operationVariableDefinition'; afterColon: boolean }
  | { kind: 'variable' }
  | { kind: 'none' }

/**
 * One autocomplete suggestion before mapping to Monaco CompletionItem.
 */
export type SuggestionItem = {
  label: string
  insertText: string
  detail?: string
  documentation?: string
  kind: 'field' | 'argument' | 'variable' | 'type'
  isSnippet?: boolean
}
