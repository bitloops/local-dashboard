export type GraphQLErrorItem = {
  message: string
}

export type GraphQLResponseEnvelope<TData> = {
  data?: TData | null
  errors?: GraphQLErrorItem[]
}

export type GraphQLRequestOptions = {
  signal?: AbortSignal
}
