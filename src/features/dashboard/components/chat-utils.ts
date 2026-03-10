/** Display only the name; strip email from API labels like "Wayne Omoga OMOGA@GMAIL.COM". */
export function formatDisplayName(label: string): string {
  return (
    label
      .split(/\s+/)
      .filter((part) => !part.includes('@'))
      .join(' ')
      .trim() || label
  )
}

export function isUserRole(role: string): boolean {
  return role === 'user' || role === 'human'
}

export function isToolRole(role: string): boolean {
  return role === 'tool' || role === 'system' || role.startsWith('tool')
}

type TranscriptVariant = 'chat' | 'thinking' | 'tool_use' | 'tool_result'

/** Variants that render as system/tool-style (dashed border, compact). */
export function isSystemVariant(variant: TranscriptVariant): boolean {
  return variant === 'tool_use' || variant === 'tool_result'
}
