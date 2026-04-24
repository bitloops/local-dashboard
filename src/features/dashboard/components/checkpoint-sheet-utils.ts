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

/** Normalized transcript message: two actors (user | assistant), variant drives styling. */
export type TranscriptMessage = {
  id: string
  timestamp: string
  actor: 'user' | 'assistant'
  variant: 'chat' | 'thinking' | 'tool_use' | 'tool_result'
  text: string
  isError?: boolean
  toolUseId?: string
}

function genId(index: number): string {
  return `msg-${index}`
}

function toText(content: unknown): string {
  if (typeof content === 'string') return content
  return JSON.stringify(content ?? '', null, 2)
}

function readToolUseId(block: Record<string, unknown>): string | undefined {
  for (const key of ['tool_use_id', 'toolUseId', 'id']) {
    const value = block[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function extractTextBlocks(content: unknown): string[] {
  if (typeof content === 'string') {
    const stripped = stripUserQueryTags(content).trimStart()
    return stripped.trim() ? [stripped] : []
  }

  if (!Array.isArray(content)) {
    return []
  }

  return content
    .map((block) => {
      const item = block as Record<string, unknown>
      if (item.type === 'text' && typeof item.text === 'string') {
        return stripUserQueryTags(item.text).trimStart()
      }
      return ''
    })
    .filter((text) => text.trim().length > 0)
}

export const parseTranscriptEntries = (jsonl: string): TranscriptMessage[] => {
  const lines = jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const collected: TranscriptMessage[] = []

  lines.forEach((line, lineIndex) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      const type =
        typeof parsed.type === 'string'
          ? parsed.type
          : typeof parsed.role === 'string'
            ? parsed.role
            : ''
      const timestamp =
        typeof parsed.timestamp === 'string' ? parsed.timestamp : ''
      const uuid =
        typeof parsed.uuid === 'string' ? parsed.uuid : genId(lineIndex)
      const message = parsed.message as Record<string, unknown> | undefined
      const messageContent = message?.content

      if (type === 'user') {
        const textBlocks = extractTextBlocks(messageContent)
        textBlocks.forEach((text, i) => {
          collected.push({
            id: `${uuid}-${i}`,
            timestamp,
            actor: 'user',
            variant: 'chat',
            text,
          })
        })
        if (textBlocks.length > 0) return

        if (Array.isArray(messageContent)) {
          const allToolResult = messageContent.every(
            (b: unknown) =>
              (b as Record<string, unknown>)?.type === 'tool_result',
          )
          if (allToolResult) {
            messageContent.forEach((block: unknown, i: number) => {
              const b = block as Record<string, unknown>
              const content = b.content
              const isError = b.is_error === true
              collected.push({
                id: `${uuid}-${i}`,
                timestamp,
                actor: 'assistant',
                variant: 'tool_result',
                text: toText(content),
                isError,
                toolUseId: readToolUseId(b),
              })
            })
          }
        }
        return
      }

      if (type === 'assistant' && Array.isArray(messageContent)) {
        messageContent.forEach((block: unknown, i: number) => {
          const b = block as Record<string, unknown>
          const blockType = b.type as string | undefined
          const blockId = `${uuid}-${i}`

          if (blockType === 'thinking' && typeof b.thinking === 'string') {
            collected.push({
              id: blockId,
              timestamp,
              actor: 'assistant',
              variant: 'thinking',
              text: `Thinking: ${b.thinking}`,
            })
            return
          }
          if (blockType === 'text' && typeof b.text === 'string') {
            collected.push({
              id: blockId,
              timestamp,
              actor: 'assistant',
              variant: 'chat',
              text: b.text,
            })
            return
          }
          if (blockType === 'tool_use' && typeof b.name === 'string') {
            const input =
              b.input != null ? JSON.stringify(b.input, null, 2) : ''
            collected.push({
              id: blockId,
              timestamp,
              actor: 'assistant',
              variant: 'tool_use',
              text: `Tool: ${b.name}\n${input}`,
              toolUseId: readToolUseId(b),
            })
          }
        })
      }
    } catch {
      // Skip malformed lines; new format only per plan.
    }
  })

  collected.sort((a, b) => {
    const t = (a.timestamp || '').localeCompare(b.timestamp || '')
    if (t !== 0) return t
    return a.id.localeCompare(b.id)
  })

  return collected
}
