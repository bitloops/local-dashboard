import { Bot } from 'lucide-react'

const AGENT_SLUGS = new Set(['claude-code', 'gemini-cli', 'open-code'])

/** Map API display names (and variants) to asset slug for icon lookup */
const DISPLAY_NAME_TO_SLUG: Record<string, string> = {
  'claude code': 'claude-code',
  'claude-code': 'claude-code',
  'gemini cli': 'gemini-cli',
  'gemini-cli': 'gemini-cli',
  'opencode': 'open-code',
  'open code': 'open-code',
  'open-code': 'open-code',
}

function agentToSlug(agent: string): string | null {
  if (!agent || typeof agent !== 'string') return null
  const normalized = agent.toLowerCase().trim().replace(/\s+/g, ' ')
  return DISPLAY_NAME_TO_SLUG[normalized] ?? (AGENT_SLUGS.has(agent) ? agent : null)
}

type AgentIconProps = {
  agent: string
  className?: string
}

export function AgentIcon({ agent, className = 'h-4 w-4' }: AgentIconProps) {
  const slug = agentToSlug(agent)
  if (slug) {
    return (
      <img
        src={`/images/${slug}.svg`}
        alt={agent}
        className={className}
      />
    )
  }

  return <Bot className={`${className} text-muted-foreground`} />
}
