import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it('renders placeholder for Query Explorer UI', () => {
    render(<QueryExplorer />, { wrapper: Wrapper })
    expect(screen.getByText('Query Explorer UI.')).toBeInTheDocument()
  })
})
