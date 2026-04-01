import { format } from 'prettier/standalone'
import graphqlPlugin from 'prettier/plugins/graphql'

export async function formatGraphqlDocument(source: string): Promise<string> {
  if (!source.trim()) {
    return source
  }

  return format(source, {
    parser: 'graphql',
    plugins: [graphqlPlugin],
  })
}
