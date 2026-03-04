import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FileTree } from './file-tree'

describe('FileTree', () => {
  it('renders nothing visible for empty paths', () => {
    const { container } = render(<FileTree paths={[]} />)
    expect(container.querySelectorAll('.flex.items-center')).toHaveLength(0)
  })

  it('renders single file path', () => {
    render(<FileTree paths={['src/App.tsx']} />)
    expect(screen.getByText('App.tsx')).toBeInTheDocument()
    expect(screen.getByText('src')).toBeInTheDocument()
  })

  it('renders multiple paths with shared prefix', () => {
    render(<FileTree paths={['src/a.ts', 'src/b.ts']} />)
    expect(screen.getByText('a.ts')).toBeInTheDocument()
    expect(screen.getByText('b.ts')).toBeInTheDocument()
    expect(screen.getAllByText('src')).toHaveLength(1)
  })

  it('renders nested folder structure', () => {
    render(<FileTree paths={['lib/utils/format.ts']} />)
    expect(screen.getByText('format.ts')).toBeInTheDocument()
    expect(screen.getByText('utils')).toBeInTheDocument()
    expect(screen.getByText('lib')).toBeInTheDocument()
  })
})
