import { GraphQLRequestError } from '@/api/graphql/errors'
import { requestDashboardGraphQL } from '@/api/dashboard/client'
import { rootStoreInstance } from '@/store'
import {
  validateQuery,
  validateVariables,
} from '@/features/query-explorer/run-query'
import { formatGraphqlDocument } from '@/features/query-explorer/graphql/format'

let latestDashboardQueryRequestId = 0

/**
 * Run a GraphQL query against `/devql/dashboard` (same validation/history pattern as
 * `runQueryExplorerQuery`, which uses `/devql/global`).
 */
export async function runDashboardQueryExplorerQuery(overrides?: {
  query: string
  variables: string
}): Promise<void> {
  const state = rootStoreInstance.getState()
  const rawQuery = overrides?.query ?? state.query
  const variables = overrides?.variables ?? state.variables
  let query = rawQuery

  try {
    query = await formatGraphqlDocument(rawQuery)
    if (!overrides && query !== state.query) {
      state.setQuery(query)
    }
  } catch {
    // Fall through to validation
  }

  const queryResult = validateQuery(query)
  if (!queryResult.ok) {
    state.setResult({ status: 'error', error: queryResult.error })
    return
  }
  const variablesResult = validateVariables(variables)
  if (!variablesResult.ok) {
    state.setResult({ status: 'error', error: variablesResult.error })
    return
  }

  state.setResult({ status: 'loading' })
  state.addRunToHistory(query, variables)
  const requestId = ++latestDashboardQueryRequestId

  return requestDashboardGraphQL<unknown>(query, variablesResult.parsed)
    .then((body) => {
      if (requestId !== latestDashboardQueryRequestId) return
      const store = rootStoreInstance.getState()
      const errors = body.errors ?? []
      if (body.data == null && errors.length > 0) {
        store.setResult({
          status: 'error',
          error: errors[0].message ?? 'Query failed.',
        })
        return
      }
      store.setResult({
        status: 'success',
        data: body.data ?? null,
        errors: errors.length > 0 ? errors.map((e) => e.message) : undefined,
      })
    })
    .catch((err: unknown) => {
      if (requestId !== latestDashboardQueryRequestId) return
      const store = rootStoreInstance.getState()
      if (err instanceof GraphQLRequestError) {
        const firstMessage = err.graphQLErrors?.[0]?.message ?? err.message
        store.setResult({ status: 'error', error: firstMessage })
        return
      }
      store.setResult({
        status: 'error',
        error: err instanceof Error ? err.message : 'Request failed.',
      })
    })
}
