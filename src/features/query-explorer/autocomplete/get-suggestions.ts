import type { DevQLSchema } from '@/store/types'
import type { AutocompleteContext, SuggestionItem } from './types'
import { unwrapType } from './get-context'

/**
 * Builds suggestions for fields of a given type.
 *
 * Snippets use a single `\t` as placeholder indent — the registered
 * OnTypeFormattingEditProvider re-indents to the correct depth after the
 * snippet is expanded and the user types `\n` or `}`.
 */
function fieldSuggestions(
  schema: DevQLSchema,
  typeName: string,
): SuggestionItem[] {
  return Object.entries(schema[typeName]?.fields ?? {}).map(
    ([fieldName, field]) => {
      const hasArgs = field.args && Object.keys(field.args).length > 0
      return {
        label: fieldName,
        // The literal \t is a placeholder for "one indent level". The
        // OnTypeFormattingEditProvider re-indents after snippet expansion;
        // for same-line braces the hook's wrapItemsForSameLineBrace replaces
        // each \t with the correct absolute indent string.
        insertText: hasArgs ? `${fieldName}($1) {\n\t$0\n}` : fieldName,
        detail: field.type,
        documentation: field.description,
        kind: 'field',
        isSnippet: Boolean(hasArgs),
      }
    },
  )
}

/**
 * Variable definition suggestions from schema: for each root-level field
 * argument, suggest `$argName: argType` so one completion inserts the
 * full definition. Variables already in the document (but not in schema)
 * are suggested as `$name: ` so the user can pick a type.
 */
function operationVariableNameSuggestions(
  schema: DevQLSchema,
  rootTypeName: string,
  documentText: string,
): SuggestionItem[] {
  const byName = new Map<string, string>()

  for (const field of Object.values(schema[rootTypeName]?.fields ?? {})) {
    for (const [argName, argType] of Object.entries(field.args ?? {})) {
      if (!byName.has(argName)) byName.set(argName, argType)
    }
  }

  const docVars = new Set(
    [...documentText.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g)].map((m) => m[1]),
  )

  const items: SuggestionItem[] = []
  for (const [argName, argType] of byName) {
    items.push({
      label: `$${argName}`,
      insertText: `$${argName}: ${argType}`,
      kind: 'variable',
      detail: argType,
    })
  }
  for (const name of docVars) {
    if (byName.has(name)) continue
    items.push({
      label: `$${name}`,
      insertText: `$${name}: `,
      kind: 'variable',
      detail: 'variable definition',
    })
  }
  return items
}

/**
 * Type suggestions for variable definitions: only types valid as variable
 * types (scalars and types used in argument positions). Uses built-in
 * scalars plus any type name that appears in field.args in the schema.
 */
function operationTypeSuggestions(schema: DevQLSchema): SuggestionItem[] {
  const names = new Set<string>(['ID', 'String', 'Int', 'Float', 'Boolean'])
  for (const typeDef of Object.values(schema)) {
    for (const field of Object.values(typeDef?.fields ?? {})) {
      for (const argType of Object.values(field.args ?? {})) {
        const base = unwrapType(argType)
        if (base) names.add(base)
      }
    }
  }
  return Array.from(names).map((typeName) => ({
    label: typeName,
    insertText: typeName,
    kind: 'type',
    detail: 'type',
  }))
}

/**
 * Returns autocomplete suggestions for the given context.
 */
export function getSuggestions(
  context: AutocompleteContext,
  schema: DevQLSchema,
  rootTypeName: string,
  documentText: string,
): SuggestionItem[] {
  if (context.kind === 'root') return fieldSuggestions(schema, rootTypeName)
  if (context.kind === 'nested')
    return fieldSuggestions(schema, context.typeName)
  if (context.kind === 'argument') {
    const args =
      schema[context.typeName]?.fields?.[context.fieldName]?.args ?? {}
    return Object.entries(args).map(([argName, argType]) => ({
      label: argName,
      insertText: `${argName}: `,
      detail: argType,
      kind: 'argument',
    }))
  }
  if (context.kind === 'operationVariableDefinition') {
    if (context.afterColon) return operationTypeSuggestions(schema)
    return operationVariableNameSuggestions(schema, rootTypeName, documentText)
  }
  if (context.kind === 'variable') {
    const names = Array.from(
      new Set(
        [...documentText.matchAll(/\$([a-zA-Z_][a-zA-Z0-9_]*)/g)].map(
          (m) => m[1],
        ),
      ),
    )
    return names.map((name) => ({
      label: `$${name}`,
      insertText: `$${name}`,
      kind: 'variable',
      detail: 'variable',
    }))
  }
  if (context.kind === 'none') {
    return [
      {
        label: 'query',
        insertText: 'query ${1:Name} {\n\t$0\n}',
        kind: 'field',
        detail: 'operation',
        isSnippet: true,
      },
    ]
  }
  return []
}
