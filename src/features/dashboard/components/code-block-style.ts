import { type CSSProperties } from 'react'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

const preKey = 'pre[class*="language-"]'
const codeKey = 'code[class*="language-"]'

export const codeBlockStyle: Record<string, CSSProperties> = {
  ...(oneDark as Record<string, CSSProperties>),
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
