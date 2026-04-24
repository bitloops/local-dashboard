import { type CSSProperties } from 'react'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const preKey = 'pre[class*="language-"]'
const codeKey = 'code[class*="language-"]'
/** oneDark sets whiteSpace: normal for “inline” code — invalid for <pre><code> tool output. */
const notPreCodeKey = ':not(pre) > code[class*="language-"]'

export const codeBlockStyle: Record<string, CSSProperties> = {
  ...(oneDark as Record<string, CSSProperties>),
  [notPreCodeKey]: {
    ...(typeof oneDark[notPreCodeKey] === 'object' &&
    oneDark[notPreCodeKey] !== null
      ? (oneDark[notPreCodeKey] as CSSProperties)
      : {}),
    whiteSpace: 'pre',
  },
  [preKey]: {
    ...(typeof oneDark[preKey] === 'object' && oneDark[preKey] !== null
      ? (oneDark[preKey] as CSSProperties)
      : {}),
    margin: 0,
    padding: 0,
    fontSize: '11px',
    background: 'transparent',
  },
  [codeKey]: {
    ...(typeof oneDark[codeKey] === 'object' && oneDark[codeKey] !== null
      ? (oneDark[codeKey] as CSSProperties)
      : {}),
    fontSize: '11px',
    background: 'transparent',
  },
}
