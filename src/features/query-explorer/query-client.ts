import { BitloopsCli } from '@/api/types/schema'
import type { DevQLSchema } from '@/store/types'

/** Temporary type for POST /query response until OpenAPI codegen includes the endpoint. */
export type QueryApiResponse = {
  data: unknown
  errors?: Array<{ message: string }>
}

const getClient = (): BitloopsCli =>
  new BitloopsCli({
    BASE: import.meta.env.VITE_BITLOOPS_CLI_BASE ?? 'http://127.0.0.1:5667',
  })

/**
 * Fetches schema metadata from GET /query-schema for autocomplete.
 * Uses the same CLI instance as executeQuery. Replaced by codegen when backend is ready.
 */
export function getQuerySchema(): Promise<DevQLSchema> {
  const cli = getClient()
  return cli.request.request<DevQLSchema>({
    method: 'GET',
    url: '/api/query-schema',
  })
}

/**
 * Sends a POST request to /api/query with the given query and variables.
 * Returns a promise that resolves with the GraphQL-style response envelope.
 */
export function executeQuery(
  query: string,
  variables: Record<string, unknown>,
): Promise<QueryApiResponse> {
  const cli = getClient()
  return cli.request.request<QueryApiResponse>({
    method: 'POST',
    url: '/api/query',
    body: { query, variables },
    mediaType: 'application/json',
  })
}
