import { Bot } from 'lucide-react'

const KNOWN_AGENTS = new Set(['claude-code', 'gemini-cli', 'open-code'])

type AgentIconProps = {
  agent: string
  className?: string
}

export function AgentIcon({ agent, className = 'h-4 w-4' }: AgentIconProps) {
  if (KNOWN_AGENTS.has(agent)) {
    return (
      <img
        src={`/images/${agent}.svg`}
        alt={agent}
        className={className}
      />
    )
  }

  return <Bot className={`${className} text-muted-foreground`} />
}
