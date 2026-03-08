export const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
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

export type ChatEntry = {
  role: string
  content: string
}

export const parseTranscriptEntries = (jsonl: string): ChatEntry[] => {
  const lines = jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line, index) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      const role =
        typeof parsed.role === 'string'
          ? parsed.role
          : typeof parsed.type === 'string'
            ? parsed.type
            : `entry-${index + 1}`

      const contentCandidate =
        parsed.content ?? parsed.text ?? parsed.message ?? parsed.delta ?? parsed
      const content =
        typeof contentCandidate === 'string'
          ? contentCandidate
          : JSON.stringify(contentCandidate, null, 2)

      return {
        role,
        content,
      }
    } catch {
      return {
        role: `line-${index + 1}`,
        content: line,
      }
    }
  })
}
