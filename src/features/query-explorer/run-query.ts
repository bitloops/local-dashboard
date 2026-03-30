import { GraphQLRequestError } from '@/api/graphql/errors'
import { rootStoreInstance } from '@/store'
import { parse } from 'graphql'
import { executeQuery } from './query-client'

export type ValidateQueryResult = { ok: true } | { ok: false; error: string }

export type ValidateVariablesResult =
  | { ok: true; parsed: Record<string, unknown> }
  | { ok: false; error: string }

let latestQueryRequestId = 0

/**
 * Validates the query string (non-empty, valid GraphQL). Pure, no I/O.
 */
export function validateQuery(query: string): ValidateQueryResult {
  if (!query.trim()) {
    return { ok: false, error: 'Query cannot be empty.' }
  }
  try {
    parse(query)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid GraphQL syntax.'
    return { ok: false, error: message }
  }
  return { ok: true }
}

/**
 * Validates the variables string (valid JSON object). Pure, no I/O.
 */
export function validateVariables(variables: string): ValidateVariablesResult {
  try {
    const parsed = JSON.parse(variables) as Record<string, unknown>
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ok: false, error: 'Variables must be a JSON object.' }
    }
    return { ok: true, parsed }
  } catch {
    return { ok: false, error: 'Invalid JSON in variables.' }
  }
}

/**
 * Run the query explorer request: validate, set loading, add to history, execute, then set result.
 * Use current store query/variables when no overrides are passed (e.g. Run button).
 * Pass { query, variables } to run a historical entry without loading it into the store first (e.g. Re-run).
 */
export function runQueryExplorerQuery(overrides?: {
  query: string
  variables: string
}): void {
  const state = rootStoreInstance.getState()
  const query = overrides?.query ?? state.query
  const variables = overrides?.variables ?? state.variables

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
  const requestId = ++latestQueryRequestId

  executeQuery(query, variablesResult.parsed)
    .then((body) => {
      if (requestId !== latestQueryRequestId) return
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
      if (requestId !== latestQueryRequestId) return
      const store = rootStoreInstance.getState()
      if (err instanceof GraphQLRequestError) {
        // err.message is set by the client to `firstGraphQLError ?? 'Request failed (status).'`,
        // so it already encodes HTTP status context; no statusText fallback needed.
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
