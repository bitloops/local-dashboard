import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { loadCodeCityScene } from './load-code-city-scene'
import type { CodeCitySceneModel } from './schema'
import { CodeCityPage } from './components/code-city-page'
import { codeCityUiStore } from './store'

vi.mock('./components/code-city-canvas', () => ({
  CodeCityCanvas: ({
    scene,
    onSelectBuilding,
  }: {
    scene: CodeCitySceneModel
    onSelectBuilding: (buildingId: string) => void
  }) => (
    <div data-testid='mock-code-city-canvas'>
      <p>{scene.title}</p>
      <button
        type='button'
        onClick={() =>
          onSelectBuilding('orders-service::src-domain-order-aggregate-ts')
        }
      >
        Select mock building
      </button>
    </div>
  ),
}))

function renderPage(props?: Partial<ComponentProps<typeof CodeCityPage>>) {
  return render(
    <ThemeProvider>
      <SidebarProvider defaultOpen>
        <CodeCityPage {...props} />
      </SidebarProvider>
    </ThemeProvider>,
  )
}

describe('CodeCity page', () => {
  beforeEach(() => {
    codeCityUiStore.getState().resetSceneUi()
  })

  it('renders controls and updates the inspector through guided search', async () => {
    renderPage()

    expect(
      screen.getByRole('heading', { name: 'Code Atlas' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('code-city-mock-badge')).toBeInTheDocument()

    await screen.findByTestId('mock-code-city-canvas')

    await userEvent.type(
      screen.getByTestId('code-city-search-input'),
      'order-aggregate',
    )
    await userEvent.click(await screen.findByText('order-aggregate.ts'))

    expect(await screen.findByText('Selected building')).toBeInTheDocument()
    expect(
      within(screen.getByTestId('code-city-inspector')).getByText(
        'src/domain/order-aggregate.ts',
      ),
    ).toBeInTheDocument()

    const overlayToggle = screen.getByTestId('code-city-toggle-overlays')
    expect(overlayToggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(overlayToggle)
    expect(overlayToggle).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows an empty state when the loader returns no boundaries', async () => {
    const scene = await loadCodeCityScene({ datasetId: 'star-shared-kernel' })
    renderPage({
      loadScene: async () =>
        ({
          ...scene,
          boundaries: [],
        }) as CodeCitySceneModel,
    })

    expect(
      await screen.findByText('No Code Atlas data available'),
    ).toBeInTheDocument()
  })

  it('shows an error state when the loader rejects', async () => {
    renderPage({
      loadScene: async () => {
        throw new Error('Fixture load failed')
      },
    })

    expect(
      await screen.findByText('Could not load Code Atlas'),
    ).toBeInTheDocument()
    expect(screen.getByText('Fixture load failed')).toBeInTheDocument()
  })
})
