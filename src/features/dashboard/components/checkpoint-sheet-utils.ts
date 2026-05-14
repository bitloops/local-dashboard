export const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

/** Removes only <user_query> and </user_query> tag markup; leaves spacing unchanged. */
export const stripUserQueryTags = (value: string): string => {
  if (!value.trim()) return value
  return value.replace(/<user_query>/gi, '').replace(/<\/user_query>/gi, '')
}

/** Prompt text from the API: strips user_query tags and trims outer whitespace for display. */
export function formatPromptForDisplay(
  value: string | null | undefined,
): string {
  if (value == null) {
    return ''
  }
  return stripUserQueryTags(value).trim()
}

export const prettyPrintJson = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return '-'
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

/**
 * Normalized transcript message: two actors (user | assistant), variant drives styling.
 *
 * This is the renderer-facing shape consumed by `<ChatTranscript>`. It is produced
 * from canonical `DashboardTranscriptEntryDto` rows by
 * `transcriptEntriesToMessages` in `utils/transcript-entries.ts`.
 *
 * The legacy Claude-shape JSONL parser (`parseTranscriptEntries`) that used to
 * live here was removed once all six agents started serving canonical
 * transcript entries from the backend.
 */
export type TranscriptMessage = {
  id: string
  timestamp: string
  actor: 'user' | 'assistant'
  variant: 'chat' | 'thinking' | 'tool_use' | 'tool_result'
  text: string
  isError?: boolean
  toolUseId?: string
}
