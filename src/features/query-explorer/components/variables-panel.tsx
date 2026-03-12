import { cn } from '@/lib/utils'

type VariablesPanelProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function VariablesPanel({
  value,
  onChange,
  className,
}: VariablesPanelProps) {
  return (
    <div
      className={cn('flex min-h-0 flex-col', className)}
      data-panel='variables'
    >
      <div className='border-b border-border px-3 py-2'>
        <h2 className='text-sm font-medium'>Variables</h2>
        <p className='text-xs text-muted-foreground'>
          JSON object for query variables
        </p>
      </div>
      <div className='flex min-h-0 flex-1 flex-col p-3'>
        <textarea
          aria-label='Query variables JSON'
          className='min-h-[80px] w-full flex-1 resize-none border border-input bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          placeholder='{}'
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}
