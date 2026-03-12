import { Bot } from 'lucide-react'

/** Hyphenated slugs the API sends; used for icon path /images/{slug}.svg */
const AGENT_SLUGS = new Set([
  'claude-code',
  'codex',
  'cursor',
  'gemini-cli',
  'open-code',
])

function agentToSlug(agent: string): string | null {
  if (!agent || typeof agent !== 'string') return null
  const slug = agent.toLowerCase().trim().replace(/\s+/g, '-')
  return AGENT_SLUGS.has(slug) ? slug : null
}

type AgentIconProps = {
  agent: string
  className?: string
}

export function AgentIcon({ agent, className = 'h-4 w-4' }: AgentIconProps) {
  const slug = agentToSlug(agent)
  if (slug) {
    return <img src={`/images/${slug}.svg`} alt={agent} className={className} />
  }

  return <Bot className={`${className} text-muted-foreground`} />
}
