import type { DevQLSchema } from '@/store/types'
import type { AutocompleteContext } from './types'

export function getRootTypeName(schema: DevQLSchema): string | null {
  if (schema.Query?.fields) return 'Query'

  const firstWithFields = Object.entries(schema).find(
    ([, typeDef]) => typeDef?.fields && Object.keys(typeDef.fields).length > 0,
  )
  return firstWithFields?.[0] ?? null
}

/** Valid GraphQL type name (no modifiers). Used to reject malformed unwrap results. */
const TYPE_NAME_REGEX = /^[A-Za-z_][A-Za-z0-9_]*$/

/**
 * Strips GraphQL type modifiers (!, [], etc.) to get the inner type name.
 */
export function unwrapType(typeName: string): string {
  const unwrapped = typeName
    .replaceAll('!', '')
    .replaceAll('[', '')
    .replaceAll(']', '')
  return TYPE_NAME_REGEX.test(unwrapped) ? unwrapped : typeName
}

export function resolveFieldType(
  schema: DevQLSchema,
  typeName: string,
  fieldName: string,
): string | null {
  const field = schema[typeName]?.fields?.[fieldName]
  if (!field?.type) return null
  return unwrapType(field.type)
}

/**
 * Determines autocomplete context at the given offset in the query text.
 */
export function getContext(
  text: string,
  offset: number,
  schema: DevQLSchema,
  rootTypeName: string,
): AutocompleteContext {
  if (offset < 0 || offset > text.length) return { kind: 'none' }

  let braceDepth = 0
  let parenDepth = 0
  let inComment = false
  let inString: '"' | "'" | null = null
  let identStart: number | null = null
  let lastField: string | null = null
  const typeStack: string[] = [rootTypeName]

  const flushIdent = (i: number) => {
    if (identStart === null) return
    const name = text.slice(identStart, i).trim()
    identStart = null
    if (!name || /^(query|mutation|subscription|fragment|on)$/i.test(name))
      return
    if (parenDepth > 0) return
    if (braceDepth > 0) lastField = name
  }

  for (let i = 0; i < offset; i++) {
    const c = text[i]

    if (inComment) {
      if (c === '\n') inComment = false
      continue
    }

    if (inString) {
      if (c === '\\') {
        i++
        continue
      }
      if (c === inString) inString = null
      continue
    }

    if (c === '#') {
      flushIdent(i)
      inComment = true
      continue
    }

    if (c === '"' || c === "'") {
      flushIdent(i)
      inString = c
      continue
    }

    if (c === '{') {
      flushIdent(i)
      braceDepth++
      if (lastField && typeStack.length > 0) {
        const next = resolveFieldType(
          schema,
          typeStack[typeStack.length - 1],
          lastField,
        )
        if (next) typeStack.push(next)
        lastField = null
      }
      continue
    }

    if (c === '}') {
      flushIdent(i)
      braceDepth--
      if (typeStack.length > 1) typeStack.pop()
      lastField = null
      continue
    }

    if (c === '(') {
      // Flush before incrementing so lastField is set while parenDepth is still 0
      // (e.g. "repo(" with no space: flush sees "repo", then we enter parens).
      flushIdent(i)
      parenDepth++
      continue
    }

    if (c === ')') {
      flushIdent(i)
      parenDepth--
      continue
    }

    if (/[a-zA-Z_]/.test(c) && (i === 0 || !/[\w$]/.test(text[i - 1]))) {
      identStart = i
    } else if (identStart !== null && !/[\w$]/.test(c)) {
      flushIdent(i)
    }
  }

  flushIdent(offset)

  const before = text.slice(0, offset)
  const lastOpenParen = before.lastIndexOf('(')
  if (parenDepth > 0 && braceDepth === 0 && lastOpenParen !== -1) {
    const header = before.slice(0, lastOpenParen).trimEnd()
    const isOperationHeader =
      /\bquery\b(?:\s+[A-Za-z_][A-Za-z0-9_]*)?\s*$/.test(header)
    if (isOperationHeader) {
      const insideParens = before.slice(lastOpenParen + 1)
      const currentItem = insideParens.slice(
        Math.max(insideParens.lastIndexOf(',') + 1, 0),
      )
      return {
        kind: 'operationVariableDefinition',
        afterColon: currentItem.includes(':'),
      }
    }
  }

  if (/\$[\w]*$/.test(before)) return { kind: 'variable' }

  if (parenDepth > 0 && braceDepth > 0 && lastField) {
    return {
      kind: 'argument',
      typeName: typeStack[typeStack.length - 1],
      fieldName: lastField,
    }
  }
  if (braceDepth > 0 && parenDepth === 0) {
    if (braceDepth === 1) return { kind: 'root' }
    return {
      kind: 'nested',
      typeName: typeStack[typeStack.length - 1],
    }
  }
  return { kind: 'none' }
}
