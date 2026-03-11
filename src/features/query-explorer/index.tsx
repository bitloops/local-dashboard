import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'

export function QueryExplorer() {
  return (
    <>
      <Header className='pe-8'>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>
      <Main>
        <div className='mb-4'>
          <h1 className='text-2xl font-bold tracking-tight'>Query Explorer</h1>
          <p className='mt-1 text-sm text-muted-foreground'>
            Query and explore your code intelligence data.
          </p>
        </div>
        <div className='rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground'>
          Query Explorer UI.
        </div>
      </Main>
    </>
  )
}
