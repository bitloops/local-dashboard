import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { fetchDashboardRepositories } from '@/features/dashboard/graphql/fetch-dashboard-data'
import { rootStoreInstance } from '@/store'
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

vi.mock('@/features/dashboard/graphql/fetch-dashboard-data', () => ({
  fetchDashboardRepositories: vi.fn(),
}))

const mockFetchDashboardRepositories = vi.mocked(fetchDashboardRepositories)

const dashboardRepositories = [
  {
    repoId: 'repo-1',
    identity: 'bitloops/bitloops',
    name: 'bitloops',
    provider: 'local',
    organization: 'bitloops',
    defaultBranch: 'main',
  },
  {
    repoId: 'repo-2',
    identity: 'bitloops/local-dashboard',
    name: 'local-dashboard',
    provider: 'local',
    organization: 'bitloops',
    defaultBranch: 'main',
  },
]

function renderPage(props?: Partial<ComponentProps<typeof CodeCityPage>>) {
  return render(
    <ThemeProvider>
      <SidebarProvider defaultOpen>
        <CodeCityPage {...props} />
      </SidebarProvider>
    </ThemeProvider>,
  )
}

async function loadFixtureScene() {
  return loadCodeCityScene({ datasetId: 'star-shared-kernel' })
}

describe('CodeCity page', () => {
  beforeEach(() => {
    codeCityUiStore.getState().resetSceneUi()
    rootStoreInstance.getState().resetDashboardFilters()
    rootStoreInstance.getState().clearDashboardCache()
    mockFetchDashboardRepositories.mockReset()
    mockFetchDashboardRepositories.mockResolvedValue(dashboardRepositories)
  })

  it('renders controls and updates the inspector through guided search', async () => {
    renderPage({ loadScene: loadFixtureScene })

    expect(
      screen.getByRole('heading', { name: 'Code Atlas' }),
    ).toBeInTheDocument()
    expect(screen.getByTestId('code-city-source-badge')).toHaveTextContent(
      'Live DevQL',
    )

    expect(
      await screen.findByTestId('code-city-repo-select'),
    ).toHaveTextContent('Auto (bitloops/bitloops)')
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

  it('loads live scenes with the selected dashboard repository', async () => {
    rootStoreInstance.getState().setSelectedRepoId('repo-2')
    const loadScene = vi.fn(async () => loadFixtureScene())

    renderPage({ loadScene })

    await waitFor(() => {
      expect(loadScene).toHaveBeenCalledWith(
        expect.objectContaining({
          datasetId: 'live-devql-current',
          repoId: 'repo-2',
          projectPath: '.',
        }),
      )
    })

    expect(
      await screen.findByTestId('code-city-repo-select'),
    ).toHaveTextContent('bitloops/local-dashboard')
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
