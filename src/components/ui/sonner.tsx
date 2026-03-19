import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useTheme } from '@/context/theme-provider'

export function Toaster({ ...props }: ToasterProps) {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className='toaster group [&_div[data-content]]:w-full'
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          /* Let Sonner read theme tokens if supported; global CSS also targets [data-type=error] */
          '--error-bg': 'var(--toast-error-bg)',
          '--error-border': 'var(--toast-error-border)',
          '--error-text': 'var(--toast-error-fg)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}
