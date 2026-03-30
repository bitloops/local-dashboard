import type { GraphQLErrorItem } from './types'

export class GraphQLRequestError extends Error {
  readonly status?: number
  readonly graphQLErrors?: GraphQLErrorItem[]

  constructor(
    message: string,
    options?: { status?: number; graphQLErrors?: GraphQLErrorItem[] },
  ) {
    super(message)
    this.name = 'GraphQLRequestError'
    this.status = options?.status
    this.graphQLErrors = options?.graphQLErrors
  }
}
