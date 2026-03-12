import { cn } from '@/lib/utils'

type QueryEditorPanelProps = {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function QueryEditorPanel({
  value,
  onChange,
  className,
}: QueryEditorPanelProps) {
  return (
    <div
      className={cn('flex min-h-0 flex-col', className)}
      data-panel='query-editor'
    >
      <div className='border-b border-border px-3 py-2'>
        <h2 className='text-sm font-medium'>Query Editor</h2>
      </div>
      <div className='flex min-h-0 flex-1 flex-col p-3'>
        <textarea
          aria-label='GraphQL query'
          className='min-h-[120px] w-full flex-1 resize-none border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2'
          placeholder='Enter your query...'
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  )
}
