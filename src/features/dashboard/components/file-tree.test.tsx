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

  describe('fileStats (git-diff style)', () => {
    it('renders tree from fileStats and shows additions in green, deletions in red', () => {
      render(
        <FileTree
          fileStats={{
            'src/App.tsx': { additionsCount: 10, deletionsCount: 2 },
            'src/lib/auth.ts': { additionsCount: 0, deletionsCount: 5 },
          }}
        />,
      )
      expect(screen.getByText('App.tsx')).toBeInTheDocument()
      expect(screen.getByText('auth.ts')).toBeInTheDocument()
      expect(screen.getByText('+10')).toBeInTheDocument()
      expect(screen.getByText('−2')).toBeInTheDocument()
      expect(screen.getByText('−5')).toBeInTheDocument()
    })

    it('shows only additions when deletionsCount is 0', () => {
      render(
        <FileTree
          fileStats={{ 'README.md': { additionsCount: 3, deletionsCount: 0 } }}
        />,
      )
      expect(screen.getByText('README.md')).toBeInTheDocument()
      expect(screen.getByText('+3')).toBeInTheDocument()
      expect(screen.queryByText('−0')).not.toBeInTheDocument()
    })

    it('shows only deletions when additionsCount is 0', () => {
      render(
        <FileTree
          fileStats={{ 'old.ts': { additionsCount: 0, deletionsCount: 7 } }}
        />,
      )
      expect(screen.getByText('old.ts')).toBeInTheDocument()
      expect(screen.getByText('−7')).toBeInTheDocument()
      expect(screen.queryByText('+0')).not.toBeInTheDocument()
    })

    it('shows no diff when both counts are 0', () => {
      render(
        <FileTree
          fileStats={{ 'empty.ts': { additionsCount: 0, deletionsCount: 0 } }}
        />,
      )
      expect(screen.getByText('empty.ts')).toBeInTheDocument()
      expect(screen.queryByText('+0')).not.toBeInTheDocument()
      expect(screen.queryByText('−0')).not.toBeInTheDocument()
    })

    it('renders empty when fileStats is empty object', () => {
      const { container } = render(<FileTree fileStats={{}} />)
      expect(container.querySelectorAll('.flex.items-center')).toHaveLength(0)
    })
  })
})
