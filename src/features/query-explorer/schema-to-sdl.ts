import type { DevQLSchema } from '@/store/types'

/**
 * Converts DevQLSchema (GET /query-schema response) to a GraphQL SDL string
 * for use with monaco-graphql's setSchemaConfig (documentString).
 */
export function devQLSchemaToSDL(schema: DevQLSchema): string {
  if (!schema || typeof schema !== 'object') {
    return ''
  }

  const lines: string[] = []

  for (const [typeName, typeDef] of Object.entries(schema)) {
    if (!typeDef?.fields || typeof typeDef.fields !== 'object') {
      continue
    }

    const fieldEntries = Object.entries(typeDef.fields)
    if (fieldEntries.length === 0) {
      // GraphQL SDL requires at least one field per object type
      lines.push(`type ${typeName} { _empty: Boolean }`)
      continue
    }

    const fieldLines = fieldEntries.map(([fieldName, field]) => {
      const returnType = field.type
      const args = field.args
      if (args && Object.keys(args).length > 0) {
        const argsStr = Object.entries(args)
          .map(([argName, argType]) => `${argName}: ${argType}`)
          .join(', ')
        return `  ${fieldName}(${argsStr}): ${returnType}`
      }
      return `  ${fieldName}: ${returnType}`
    })

    lines.push(`type ${typeName} {`, ...fieldLines, '}')
  }

  return lines.join('\n')
}
