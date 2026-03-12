import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { QueryExplorer } from './index'

function Wrapper({ children }: { children: React.ReactNode }) {
  return <SidebarProvider>{children}</SidebarProvider>
}

describe('QueryExplorer', () => {
  it('renders Query Explorer heading', () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(
      screen.getByRole('heading', { name: 'Query Explorer' }),
    ).toBeInTheDocument()
  })

  it('renders tagline about schema-driven queries', () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(
      screen.getByText('Query and explore your code intelligence data.'),
    ).toBeInTheDocument()
  })

  it('renders three-panel layout with Query Editor, Results, and Variables', () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(screen.getByText('Query Editor')).toBeInTheDocument()
    expect(screen.getByText('Results')).toBeInTheDocument()
    expect(screen.getByText('Variables')).toBeInTheDocument()
  })

  it('renders resize handle between editor and results panels', () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(
      screen.getByRole('separator', {
        name: 'Resize editor and results panels',
      }),
    ).toBeInTheDocument()
  })

  it('updates query when user types in Query Editor', async () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    const editor = screen.getByRole('textbox', { name: 'GraphQL query' })
    fireEvent.change(editor, { target: { value: 'query { id }' } })
    expect(editor).toHaveValue('query { id }')
  })

  it('updates variables when user types in Variables panel', async () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    const variablesInput = screen.getByRole('textbox', {
      name: 'Query variables JSON',
    })
    fireEvent.change(variablesInput, { target: { value: '{"x": 1}' } })
    expect(variablesInput).toHaveValue('{"x": 1}')
  })

  it('shows idle message in Results panel by default', () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(screen.getByText('Run a query to see results.')).toBeInTheDocument()
  })
})
