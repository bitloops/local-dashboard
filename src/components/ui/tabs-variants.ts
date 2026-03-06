import { cva } from 'class-variance-authority'

export const tabsListVariants = cva('', {
  variants: {
    variant: {
      default:
        'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      line:
        'inline-flex w-fit border-b border-border p-0 text-muted-foreground',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
})

export const tabsTriggerVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground',
  {
    variants: {
      variant: {
        default: 'data-[state=active]:bg-background data-[state=active]:shadow-sm',
        line:
          'rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:text-foreground -mb-px',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)
