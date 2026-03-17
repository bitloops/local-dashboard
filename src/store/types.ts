/** Single entry in the query explorer run history (localStorage). */
export type HistoryEntry = {
  id: string
  query: string
  variables: string
  runAt: number
}

/** Placeholder for schema introspection / metadata cache. */
export type SchemaMetadataCache = {
  fetchedAt: number
  data?: unknown
}
