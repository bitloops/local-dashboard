import { BitloopsCli } from '@/api/types/schema'

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
