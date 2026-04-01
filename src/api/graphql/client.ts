import { GraphQLRequestError } from './errors'
import type { GraphQLRequestOptions, GraphQLResponseEnvelope } from './types'

const GRAPHQL_ENDPOINT = '/devql/global'

export async function requestGraphQL<
  TData,
  TVariables = Record<string, unknown>,
>(
  query: string,
  variables?: TVariables,
  options?: GraphQLRequestOptions,
): Promise<GraphQLResponseEnvelope<TData>> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: variables ?? {},
    }),
    signal: options?.signal,
  })

  let payload: GraphQLResponseEnvelope<TData> | undefined
  try {
    payload = (await response.json()) as GraphQLResponseEnvelope<TData>
  } catch {
    throw new GraphQLRequestError('Invalid GraphQL response payload.', {
      status: response.status,
    })
  }

  if (!response.ok) {
    const firstError = payload.errors?.[0]?.message
    throw new GraphQLRequestError(
      firstError ?? `Request failed (${response.status}).`,
      {
        status: response.status,
        graphQLErrors: payload.errors,
      },
    )
  }

  return payload
}

export async function fetchGraphQLSdl(
  options?: GraphQLRequestOptions,
): Promise<string> {
  const response = await fetch('/devql/global/sdl', {
    method: 'GET',
    signal: options?.signal,
  })

  if (!response.ok) {
    throw new GraphQLRequestError(
      `Failed to load schema SDL (${response.status}).`,
      {
        status: response.status,
      },
    )
  }

  return response.text()
}
