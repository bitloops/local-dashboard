import { useState } from 'react'
import { Terminal, User } from 'lucide-react'
import { AgentIcon } from './agent-icon'

type ChatEntry = {
  role: string
  content: string
}

const TRUNCATE_LENGTH = 300

function isUserRole(role: string): boolean {
  return role === 'user' || role === 'human'
}

function isToolRole(role: string): boolean {
  return role === 'tool' || role === 'system' || role.startsWith('tool')
}

type ChatBubbleProps = {
  entry: ChatEntry
  index: number
  agentName: string
  userName: string
}

function ChatBubble({ entry, index, agentName, userName }: ChatBubbleProps) {
  const [expanded, setExpanded] = useState(false)
  const isUser = isUserRole(entry.role)
  const isTool = isToolRole(entry.role)
  const shouldTruncate = !isTool && entry.content.length > TRUNCATE_LENGTH
  const displayContent = shouldTruncate && !expanded
    ? entry.content.slice(0, TRUNCATE_LENGTH) + '\u2026'
    : entry.content

  if (isTool) {
    return (
      <div className='ms-8 flex'>
        <div className='inline-flex max-w-[85%] items-start gap-1.5 rounded-md border border-dashed bg-muted/30 px-2.5 py-1.5'>
          <Terminal className='mt-0.5 h-3 w-3 shrink-0 text-muted-foreground' />
          <p className='text-[11px] text-muted-foreground whitespace-pre-wrap break-words'>
            {entry.content}
          </p>
        </div>
      </div>
    )
  }

  const label = isUser ? userName : agentName

  return (
    <div className={`flex items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className='flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted'>
        {isUser ? (
          <User className='h-3.5 w-3.5 text-muted-foreground' />
        ) : (
          <AgentIcon agent={agentName} />
        )}
      </div>

      <div className='min-w-0 max-w-[80%]'>
        <p className={`mb-0.5 text-[10px] text-muted-foreground ${isUser ? 'text-right' : 'text-left'}`}>
          {label} <span className='opacity-50'>#{index + 1}</span>
        </p>
        <div
          className={`overflow-hidden rounded-xl px-3 py-2 text-xs leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-primary/15 text-foreground'
              : 'rounded-tl-sm bg-muted/60 text-foreground'
          }`}
        >
          <p className='whitespace-pre-wrap break-words'>
            {displayContent}
          </p>
          {shouldTruncate && (
            <button
              type='button'
              onClick={() => setExpanded(!expanded)}
              className='mt-1 text-[11px] font-medium text-primary hover:underline'
            >
              {expanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

type ChatTranscriptProps = {
  entries: ChatEntry[]
  sessionId: string
  agentName: string
  userName: string
}

export function ChatTranscript({ entries, sessionId, agentName, userName }: ChatTranscriptProps) {
  if (entries.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        No transcript entries available.
      </p>
    )
  }

  return (
    <div className='space-y-3'>
      {entries.map((entry, index) => (
        <ChatBubble
          key={`${sessionId}-${index}`}
          entry={entry}
          index={index}
          agentName={agentName}
          userName={userName}
        />
      ))}
    </div>
  )
}
