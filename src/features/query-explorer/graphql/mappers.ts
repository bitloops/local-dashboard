import { buildSchema, isObjectType } from 'graphql'
import type { DevQLSchema } from '@/store/types'

export function mapSdlToDevQlSchema(sdl: string): DevQLSchema {
  let schema
  try {
    schema = buildSchema(sdl)
  } catch (err) {
    throw new Error(
      `Failed to parse GraphQL SDL: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
  const typeMap = schema.getTypeMap()
  const output: DevQLSchema = {}

  for (const [typeName, typeDef] of Object.entries(typeMap)) {
    if (typeName.startsWith('__') || !isObjectType(typeDef)) {
      continue
    }

    const fields = typeDef.getFields()
    const mappedFields: DevQLSchema[string]['fields'] = {}

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
      const args: Record<string, string> = {}
      for (const arg of fieldDef.args) {
        args[arg.name] = String(arg.type)
      }

      mappedFields[fieldName] = {
        type: String(fieldDef.type),
        args: Object.keys(args).length > 0 ? args : undefined,
        description: fieldDef.description ?? undefined,
      }
    }

    output[typeName] = { fields: mappedFields }
  }

  // Preserve existing autocomplete behavior that prefers "Query" by aliasing
  // the actual root query type when available.
  const queryTypeName = schema.getQueryType()?.name
  if (queryTypeName && queryTypeName !== 'Query' && output[queryTypeName]) {
    output.Query = output[queryTypeName]
  }

  return output
}
