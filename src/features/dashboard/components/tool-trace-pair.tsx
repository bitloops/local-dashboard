import { Terminal } from 'lucide-react'
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter'
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json'
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript'
import bash from 'react-syntax-highlighter/dist/esm/languages/prism/bash'
import typescript from 'react-syntax-highlighter/dist/esm/languages/prism/typescript'
import { prettyPrintJson } from './checkpoint-sheet-utils'
import { codeBlockStyle } from './code-block-style'
import { cn } from '@/lib/utils'

SyntaxHighlighter.registerLanguage('json', json)
SyntaxHighlighter.registerLanguage('javascript', javascript)
SyntaxHighlighter.registerLanguage('bash', bash)
SyntaxHighlighter.registerLanguage('typescript', typescript)

function tryParseJson(s: string): string | null {
  const t = s.trim()
  if (!t) return null
  try {
    JSON.parse(t)
    return t
  } catch {
    return null
  }
}

function detectLanguage(text: string): {
  language: string
  code: string
  prefix?: string
} {
  const trimmed = text.trim()
  if (!trimmed) return { language: 'plaintext', code: text }

  const jsonPart = tryParseJson(trimmed)
  if (jsonPart) return { language: 'json', code: prettyPrintJson(jsonPart) }

  const toolPrefix = /^Tool:\s*\S+\n/s
  const match = text.match(toolPrefix)
  if (match) {
    const after = text.slice(match[0].length).trim()
    const jsonAfter = tryParseJson(after)
    if (jsonAfter) {
      return {
        language: 'json',
        code: prettyPrintJson(jsonAfter),
        prefix: match[0],
      }
    }
    if (/^\$|^#|^(echo|cat|cd|ls|npm|pnpm|yarn|git)\s/.test(after)) {
      return { language: 'bash', code: after, prefix: match[0] }
    }
    return { language: 'javascript', code: after, prefix: match[0] }
  }

  if (/^\$|^#|^(echo|cat|cd|ls|npm|pnpm|yarn|git)\s/.test(trimmed)) {
    return { language: 'bash', code: text }
  }
  if (
    /\b(function|=>|const|let|var|import|export)\b/.test(trimmed) ||
    trimmed.startsWith('{') ||
    trimmed.startsWith('[')
  ) {
    return { language: 'javascript', code: text }
  }
  return { language: 'plaintext', code: text }
}

export function ToolMessageContent({ text }: { text: string }) {
  const { language, code, prefix } = detectLanguage(text)

  if (language === 'plaintext') {
    return (
      <div className='min-w-0 max-w-full overflow-x-auto'>
        <pre className='m-0 whitespace-pre break-normal font-sans text-[11px] text-muted-foreground'>
          {text}
        </pre>
      </div>
    )
  }

  return (
    <div className='min-w-0 max-w-full text-[11px]'>
      {prefix && (
        <div className='whitespace-pre text-muted-foreground'>{prefix}</div>
      )}
      <div className='min-w-0 overflow-x-auto'>
        <SyntaxHighlighter
          language={language}
          style={codeBlockStyle}
          customStyle={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            fontSize: '11px',
            // Preserve author indentation; scroll horizontally when needed. Do not use
            // pre-wrap / break-word / wrapLongLines — those reflow code and look “jumbled”.
            whiteSpace: 'pre',
            wordBreak: 'normal',
            overflowWrap: 'normal',
            minWidth: 0,
          }}
          // Restore theme + class so oneDark :not(pre) > code and token styles resolve; the
          // highlighter’s merge still forces whiteSpace: 'pre' when wrapLongLines is false.
          codeTagProps={{
            className: `language-${language}`,
            style: {
              ...(codeBlockStyle['code[class*="language-"]'] as object),
              ...((codeBlockStyle[
                `code[class*="language-${language}"]` as 'code[class*="language-"]'
              ] as object) ?? {}),
              fontSize: '11px',
            },
          }}
          PreTag='pre'
          showLineNumbers={false}
          wrapLongLines={false}
          // Default wrapLines: false flattens the token tree; line breaks can look like one
          // visual line. Per-line <span> + block display keeps true multiline output.
          wrapLines
          lineProps={{ style: { display: 'block' } }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  )
}

export type ToolTraceCallResponseProps = {
  callText: string
  responseText?: string | null
  responseIsError?: boolean
  /** When true, matches in-transcript left indent. Tool use tab uses false for full width. */
  indented?: boolean
  className?: string
}

/**
 * Same Call / Response shell as the transcript (Terminal icon, border, `ToolMessageContent`).
 */
export function ToolTraceCallResponse({
  callText,
  responseText,
  responseIsError = false,
  indented = true,
  className,
}: ToolTraceCallResponseProps) {
  const res = responseText?.trim() ?? ''
  const showResponse = res.length > 0

  return (
    <div
      className={cn(
        'min-w-0',
        indented && 'ml-8 w-[calc(100%-2rem)]',
        className,
      )}
    >
      <div className='min-w-0 overflow-hidden rounded-md border border-border bg-muted/20 pt-1 text-[11px]'>
        <div className='flex w-full items-center gap-1.5 border-b border-border py-1 px-2'>
          <Terminal
            className='size-3 shrink-0 text-muted-foreground'
            aria-hidden
          />
          <span className='font-medium text-muted-foreground'>Call</span>
        </div>
        <div className='w-full overflow-x-auto px-2 pt-1 mb-2'>
          <ToolMessageContent text={callText} />
        </div>
        {showResponse && (
          <>
            <div
              className='w-full border-b border-border'
              role='separator'
              aria-hidden
            />
            <div className='w-full border-b border-border py-1 px-2'>
              <span className='font-medium text-muted-foreground'>
                Response
              </span>
            </div>
            <div
              className={cn(
                'w-full overflow-x-auto px-2 pt-1 pb-1.5',
                responseIsError && 'bg-destructive/10',
              )}
            >
              <ToolMessageContent text={res} />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
