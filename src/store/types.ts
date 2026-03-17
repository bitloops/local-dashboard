/** Single entry in the query explorer run history (localStorage). */
export type HistoryEntry = {
  id: string
  query: string
  variables: string
  runAt: number
}

/**
 * RFC schema metadata for Query Explorer autocomplete.
 * Type names → { fields: { fieldName → { type, args?, description? } } }.
 * Replaced by codegen when backend is ready.
 */
export type DevQLSchema = Record<
  string,
  {
    fields: Record<
      string,
      {
        type: string
        args?: Record<string, string>
        description?: string
      }
    >
  }
>
