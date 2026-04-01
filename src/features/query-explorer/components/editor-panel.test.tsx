import { useEffect } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider } from '@/context/theme-provider'
import { QueryEditorPanel } from './editor-panel'

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

vi.mock('@monaco-editor/react', () => ({
  default: function MockEditor({
    value,
    onChange,
    beforeMount,
    onMount,
  }: {
    value: string
    onChange: (v: string | undefined) => void
    beforeMount?: (monaco: unknown) => void
    onMount?: (editor: unknown, monaco: unknown) => void
  }) {
    const monaco = {
      editor: {
        defineTheme: vi.fn(),
        registerCommand: vi.fn(() => ({ dispose: vi.fn() })),
      },
      languages: {
        registerCompletionItemProvider: vi.fn(() => ({ dispose: vi.fn() })),
        registerOnTypeFormattingEditProvider: vi.fn(() => ({
          dispose: vi.fn(),
        })),
      },
      KeyMod: { Shift: 1, Alt: 2 },
      KeyCode: { KeyF: 3 },
    }
    const editor = {
      getModel: () => ({
        getValue: () => value,
        getFullModelRange: vi.fn(),
      }),
      addAction: vi.fn(),
      onDidChangeModelContent: vi.fn(() => ({ dispose: vi.fn() })),
      onDidDispose: vi.fn(),
      executeEdits: vi.fn(),
    }

    useEffect(() => {
      beforeMount?.(monaco)
      onMount?.(editor, monaco)
    }, [beforeMount, onMount])

    return (
      <input
        aria-label='GraphQL query'
        data-testid='query-editor-input'
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  },
}))

describe('QueryEditorPanel', () => {
  it('renders Editor heading', () => {
    renderWithTheme(<QueryEditorPanel value='' onChange={() => {}} />)
    expect(screen.getByText('Editor')).toBeInTheDocument()
  })

  it('renders editor with GraphQL query label', () => {
    renderWithTheme(<QueryEditorPanel value='' onChange={() => {}} />)
    expect(
      screen.getByRole('textbox', { name: 'GraphQL query' }),
    ).toBeInTheDocument()
  })

  it('displays controlled value', () => {
    renderWithTheme(
      <QueryEditorPanel value='query { id }' onChange={() => {}} />,
    )
    expect(screen.getByRole('textbox', { name: 'GraphQL query' })).toHaveValue(
      'query { id }',
    )
  })

  it('calls onChange when user types', async () => {
    const onChange = vi.fn()
    renderWithTheme(
      <QueryEditorPanel value='query { id }' onChange={onChange} />,
    )
    const input = screen.getByRole('textbox', { name: 'GraphQL query' })
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.change(input, { target: { value: 'query { name }' } })
    expect(onChange).toHaveBeenCalled()
  })

  it('shows Run button when onRun is provided', () => {
    renderWithTheme(
      <QueryEditorPanel value='' onChange={() => {}} onRun={() => {}} />,
    )
    expect(
      screen.getByRole('button', { name: 'Run query' }),
    ).toBeInTheDocument()
  })

  it('disables Run button when isRunDisabled is true', () => {
    renderWithTheme(
      <QueryEditorPanel
        value=''
        onChange={() => {}}
        onRun={() => {}}
        isRunDisabled
      />,
    )
    expect(screen.getByRole('button', { name: 'Run query' })).toBeDisabled()
  })

  it('shows format icon button when onFormat is provided', () => {
    renderWithTheme(
      <QueryEditorPanel
        value=''
        onChange={() => {}}
        onRun={() => {}}
        onFormat={() => {}}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Format query' }),
    ).toBeInTheDocument()
  })

  it('calls onRun when Run button is clicked', () => {
    const onRun = vi.fn()
    renderWithTheme(
      <QueryEditorPanel value='' onChange={() => {}} onRun={onRun} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Run query' }))
    expect(onRun).toHaveBeenCalledTimes(1)
  })

  it('calls onFormat when format icon button is clicked', () => {
    const onFormat = vi.fn()
    renderWithTheme(
      <QueryEditorPanel
        value=''
        onChange={() => {}}
        onRun={() => {}}
        onFormat={onFormat}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Format query' }))
    expect(onFormat).toHaveBeenCalledTimes(1)
  })
})
