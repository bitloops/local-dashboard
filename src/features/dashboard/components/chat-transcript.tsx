import { useState } from 'react'
import { Terminal, UserCircle } from 'lucide-react'
import type { TranscriptMessage } from './checkpoint-sheet-utils'
import { AgentIcon } from './agent-icon'
import { formatDisplayName, isSystemVariant } from './chat-utils'
import { ToolMessageContent, ToolTraceCallResponse } from './tool-trace-pair'

type TranscriptNode =
  | { type: 'single'; message: TranscriptMessage }
  | {
      type: 'tool-pair'
      use: TranscriptMessage
      result: TranscriptMessage | null
    }

function groupToolPairs(entries: TranscriptMessage[]): TranscriptNode[] {
  const nodes: TranscriptNode[] = []
  let i = 0
  while (i < entries.length) {
    const msg = entries[i]
    if (
      msg.variant === 'tool_use' &&
      i + 1 < entries.length &&
      entries[i + 1].variant === 'tool_result'
    ) {
      nodes.push({ type: 'tool-pair', use: msg, result: entries[i + 1] })
      i += 2
      continue
    }
    if (msg.variant === 'tool_use') {
      nodes.push({ type: 'tool-pair', use: msg, result: null })
      i += 1
      continue
    }
    nodes.push({ type: 'single', message: msg })
    i += 1
  }
  return nodes
}

function ToolPairBlock({
  use,
  result,
}: {
  use: TranscriptMessage
  result: TranscriptMessage | null
}) {
  return (
    <ToolTraceCallResponse
      callText={use.text}
      responseText={result?.text}
      responseIsError={result?.isError}
    />
  )
}

const TRUNCATE_LENGTH = 300

type ChatBubbleProps = {
  message: TranscriptMessage
  index: number
  agentName: string
  userName: string
}

function ChatBubble({ message, agentName, userName }: ChatBubbleProps) {
  const [expanded, setExpanded] = useState(false)
  const isUser = message.actor === 'user'
  const isSystem = isSystemVariant(message.variant)
  const isThinking = message.variant === 'thinking'
  const shouldTruncate =
    !isSystem && !isThinking && message.text.length > TRUNCATE_LENGTH
  const displayContent =
    shouldTruncate && !expanded
      ? message.text.slice(0, TRUNCATE_LENGTH) + '\u2026'
      : message.text

  if (isSystem) {
    return (
      <div className='ml-8 min-w-0 w-[calc(100%-2rem)]'>
        <div
          className={`min-w-0 overflow-hidden rounded-md border border-border bg-muted/20 py-1 text-[11px] ${
            message.isError ? 'border-destructive/50 bg-destructive/10' : ''
          }`}
        >
          <div className='flex w-full items-center gap-1.5 border-b border-border py-1 px-2'>
            <Terminal
              className='size-3 shrink-0 text-muted-foreground'
              aria-hidden
            />
            <span className='font-medium text-muted-foreground'>Output</span>
          </div>
          <div className='w-full overflow-x-auto py-1 px-2'>
            <ToolMessageContent text={message.text} />
          </div>
        </div>
      </div>
    )
  }

  if (isThinking) {
    const thinkingBody = message.text.startsWith('Thinking: ')
      ? message.text.slice(10)
      : message.text
    return (
      <div className='ml-8 flex min-w-0 w-[calc(100%-2rem)]'>
        <div className='inline-flex min-w-0 items-start gap-1.5 rounded-lg border border-muted bg-background px-2.5 py-1.5'>
          <AgentIcon agent={agentName} className='mt-0.5 size-3.5 shrink-0' />
          <div className='flex flex-col gap-0.5'>
            <span className='text-[11px] text-muted-foreground'>
              Thinking...
            </span>
            <p className='text-[11px] italic text-foreground whitespace-pre-wrap break-words'>
              {thinkingBody}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const label = isUser ? formatDisplayName(userName) : agentName

  return (
    <div
      className={`flex w-full min-w-0 items-start gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      <div className='flex size-6 shrink-0 items-center justify-center rounded-full bg-muted'>
        {isUser ? (
          <UserCircle className='h-3.5 w-3.5 text-muted-foreground' />
        ) : (
          <AgentIcon agent={agentName} />
        )}
      </div>

      <div className='min-w-0 max-w-[calc(100%-2rem)]'>
        <p
          className={`mb-0.5 text-[10px] text-muted-foreground ${isUser ? 'text-right' : 'text-left'}`}
        >
          {label}
        </p>
        <div
          className={`overflow-hidden rounded-xl px-3 py-2 text-xs leading-relaxed ${
            isUser
              ? 'rounded-tr-sm bg-[#15173D] text-foreground'
              : 'rounded-tl-sm bg-primary text-primary-foreground'
          }`}
        >
          <p className='whitespace-pre-wrap break-words'>{displayContent}</p>
          {shouldTruncate && (
            <button
              type='button'
              onClick={() => setExpanded(!expanded)}
              className={`mt-1 text-[11px] font-medium hover:underline ${isUser ? 'text-foreground' : 'text-primary-foreground'}`}
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
  entries: TranscriptMessage[]
  sessionId: string
  agentName: string
  userName: string
  /**
   * When true, drop tool_use / tool_result lines so the Turns view is chat+thinking only;
   * tool details belong on the Tool use tab.
   */
  hideToolTraces?: boolean
}

export function ChatTranscript({
  entries,
  sessionId,
  agentName,
  userName,
  hideToolTraces = false,
}: ChatTranscriptProps) {
  const visible = hideToolTraces
    ? entries.filter(
        (e) => e.variant !== 'tool_use' && e.variant !== 'tool_result',
      )
    : entries

  if (visible.length === 0) {
    return (
      <p className='text-sm text-muted-foreground'>
        No transcript entries available.
      </p>
    )
  }

  const nodes = groupToolPairs(visible)

  return (
    <div className='w-full min-w-0 space-y-3'>
      {nodes.map((node, index) =>
        node.type === 'tool-pair' ? (
          <ToolPairBlock
            key={`${sessionId}-${node.use.id}-${node.result?.id ?? 'none'}`}
            use={node.use}
            result={node.result}
          />
        ) : (
          <ChatBubble
            key={
              node.message.id
                ? `${sessionId}-${node.message.id}`
                : `${sessionId}-${index}`
            }
            message={node.message}
            index={index}
            agentName={agentName}
            userName={userName}
          />
        ),
      )}
    </div>
  )
}
