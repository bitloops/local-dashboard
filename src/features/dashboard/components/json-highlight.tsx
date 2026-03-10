import { useMemo } from 'react'

const TOKEN_RE =
  /("(?:\\.|[^"\\])*"\s*:)|("(?:\\.|[^"\\])*")|(true|false)|(null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

type Match = {
  type: 'key' | 'string' | 'boolean' | 'null' | 'number'
  text: string
}

function tokenize(json: string): (string | Match)[] {
  const result: (string | Match)[] = []
  let last = 0

  for (const m of json.matchAll(TOKEN_RE)) {
    if (m.index > last) {
      result.push(json.slice(last, m.index))
    }

    const type = m[1]
      ? 'key'
      : m[2]
        ? 'string'
        : m[3]
          ? 'boolean'
          : m[4]
            ? 'null'
            : 'number'

    result.push({ type, text: m[0] })
    last = m.index + m[0].length
  }

  if (last < json.length) {
    result.push(json.slice(last))
  }

  return result
}

const COLOR_MAP: Record<Match['type'], string> = {
  key: 'text-purple-400',
  string: 'text-orange-300',
  boolean: 'text-sky-300',
  null: 'text-sky-300',
  number: 'text-green-400',
}

type JsonHighlightProps = {
  value: string
  className?: string
}

export function JsonHighlight({ value, className = '' }: JsonHighlightProps) {
  const tokens = useMemo(() => tokenize(value), [value])

  return (
    <pre
      className={`whitespace-pre-wrap break-words font-mono text-xs ${className}`}
    >
      {tokens.map((token, i) =>
        typeof token === 'string' ? (
          <span key={i} className='text-muted-foreground'>
            {token}
          </span>
        ) : (
          <span key={i} className={COLOR_MAP[token.type]}>
            {token.text}
          </span>
        ),
      )}
    </pre>
  )
}
