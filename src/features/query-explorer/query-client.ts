import type { DevQLSchema } from '@/store/types'
import { fetchGraphQLSdl, requestGraphQL } from '@/api/graphql/client'
import { mapSdlToDevQlSchema } from './graphql/mappers'
import type { QueryApiResponse } from './graphql/types'

export function getQuerySchema(): Promise<DevQLSchema> {
  return fetchGraphQLSdl().then(mapSdlToDevQlSchema)
}

export function executeQuery(
  query: string,
  variables: Record<string, unknown>,
): Promise<QueryApiResponse> {
  return requestGraphQL<unknown>(query, variables)
}
