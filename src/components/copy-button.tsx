import { useState } from 'react'
import { Check, Copy } from 'lucide-react'

type CopyButtonProps = {
  value: string
  className?: string
}

export function CopyButton({ value, className = '' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      type='button'
      onClick={handleCopy}
      className={`inline-flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground ${className}`}
      aria-label='Copy to clipboard'
    >
      {copied ? (
        <Check className='h-3.5 w-3.5 text-green-500' />
      ) : (
        <Copy className='h-3.5 w-3.5' />
      )}
    </button>
  )
}
