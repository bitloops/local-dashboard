import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { SidebarProvider } from '@/components/ui/sidebar'
import { DEFAULT_QUERY, QueryExplorer } from './index'

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

  it('renders Query Editor container', async () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(screen.getByTestId('query-editor')).toBeInTheDocument()
  })

  it('updates variables when user types in Variables panel', async () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    const variablesInput = screen.getByRole('textbox', {
      name: 'Query variables JSON',
    })
    fireEvent.change(variablesInput, {
      target: { value: '{"existing": true}' },
    })
    fireEvent.change(variablesInput, { target: { value: '{"x": 1}' } })
    expect(variablesInput).toHaveValue('{"x": 1}')
  })

  it('shows idle message in Results panel by default', () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(screen.getByText('Run a query to see results.')).toBeInTheDocument()
  })

  it('uses default query with sample comment and GetArtefacts', () => {
    expect(DEFAULT_QUERY).toContain('# Sample query in GQL syntax')
    expect(DEFAULT_QUERY).toContain('query GetArtefacts')
    expect(DEFAULT_QUERY).toContain('repo(name: $repo)')
    expect(DEFAULT_QUERY.trim()).toMatch(/\n\nquery /)
  })
})
