import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { ThemeProvider } from '@/context/theme-provider'
import { VariablesPanel } from './variables-panel'

function renderWithTheme(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>)
}

const noopDisposable = { dispose: () => {} }

vi.mock('@monaco-editor/react', () => ({
  default: function MockEditor({
    beforeMount,
    value,
    onChange,
    onMount,
  }: {
    beforeMount?: (monaco: unknown) => void
    value: string
    onChange: (v: string | undefined) => void
    onMount?: (editor: unknown, monaco: unknown) => void
  }) {
    useEffect(() => {
      const uri = { toString: () => 'test://variables' }
      const model = { uri, onDidChangeContent: () => noopDisposable }
      const editor = { getModel: () => model }
      const monaco = {
        editor: {
          defineTheme: () => undefined,
          getModelMarkers: () => [],
          onDidChangeMarkers: () => noopDisposable,
        },
        MarkerSeverity: { Error: 8 },
      }
      if (beforeMount) {
        beforeMount(monaco)
      }
      if (onMount) {
        onMount(editor, monaco)
      }
    }, [beforeMount, onMount])
    return (
      <div data-testid='variables-editor-mock'>
        <input
          aria-label='Query variables JSON'
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  },
}))

describe('VariablesPanel', () => {
  it('renders Variables heading and description', () => {
    renderWithTheme(<VariablesPanel value='{}' onChange={() => {}} />)
    expect(screen.getByText('Variables')).toBeInTheDocument()
    expect(
      screen.getByText('JSON object for query variables'),
    ).toBeInTheDocument()
  })

  it('renders editor with variables-editor test id', () => {
    renderWithTheme(<VariablesPanel value='{}' onChange={() => {}} />)
    expect(screen.getByTestId('variables-editor')).toBeInTheDocument()
  })

  it('displays controlled value', () => {
    renderWithTheme(
      <VariablesPanel value='{"key": "value"}' onChange={() => {}} />,
    )
    const input = screen.getByRole('textbox', { name: 'Query variables JSON' })
    expect(input).toHaveValue('{"key": "value"}')
  })

  it('calls onChange when user types', () => {
    const onChange = vi.fn()
    renderWithTheme(<VariablesPanel value='{}' onChange={onChange} />)
    const input = screen.getByRole('textbox', { name: 'Query variables JSON' })
    fireEvent.change(input, { target: { value: '{"a": 1}' } })
    expect(onChange).toHaveBeenCalledWith('{"a": 1}')
  })

  it('calls onValidationChange when provided', () => {
    const onValidationChange = vi.fn()
    renderWithTheme(
      <VariablesPanel
        value='{}'
        onChange={() => {}}
        onValidationChange={onValidationChange}
      />,
    )
    expect(onValidationChange).toHaveBeenCalled()
  })
})
