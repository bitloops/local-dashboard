import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { fetchDashboardRepositories } from '@/features/dashboard/graphql/fetch-dashboard-data'
import { rootStoreInstance } from '@/store'
import { ArchitecturePage } from './components/architecture-page'
import type { ArchitectureSceneModel } from './model'

vi.mock('./components/architecture-canvas', () => ({
  ArchitectureCanvas: ({
    scene,
    showDirectConnections,
    onSelect,
  }: {
    scene: ArchitectureSceneModel
    showDirectConnections: boolean
    onSelect: (id: string) => void
  }) => (
    <div data-testid='mock-architecture-canvas'>
      <p>{scene.title}</p>
      <p>Direct connections: {showDirectConnections ? 'on' : 'off'}</p>
      <button type='button' onClick={() => onSelect('component:domain')}>
        Select Domain
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
]

function architectureScene(): ArchitectureSceneModel {
  return {
    id: 'architecture:repo-1',
    title: 'Architecture - bitloops',
    repositoryLabel: 'bitloops/bitloops',
    containers: [
      {
        id: 'container:app',
        label: 'Application',
        key: 'app',
        kind: 'cli',
        path: 'src',
        position: { x: 0, y: 0, z: 0 },
        width: 24,
        depth: 18,
        componentIds: ['component:api', 'component:domain'],
        entryPointIds: ['entry:cli'],
        deploymentUnitIds: ['deployment:cli'],
      },
      {
        id: 'container:docs',
        label: 'Documentation',
        key: 'docs',
        kind: 'documentation_site',
        path: 'docs',
        position: { x: 28, y: 0, z: 0 },
        width: 16,
        depth: 12,
        componentIds: ['component:docs'],
        entryPointIds: ['entry:docs-start'],
        deploymentUnitIds: ['deployment:docs'],
      },
    ],
    componentGroups: [],
    components: [
      {
        id: 'component:api',
        label: 'API',
        path: 'src/api',
        kind: 'module',
        containerId: 'container:app',
        confidence: 0.8,
        asserted: false,
        computed: true,
        position: { x: -4, y: 0, z: 0 },
        width: 4,
        depth: 3,
        height: 6,
        colour: '#52F6FF',
        buildingIds: ['building:api'],
        filePaths: ['src/api/main.ts'],
        entryPointIds: ['entry:cli'],
        deploymentUnitIds: ['deployment:cli'],
        contractInCount: 0,
        contractOutCount: 1,
        directInCount: 1,
        directOutCount: 0,
        readCount: 0,
        writeCount: 0,
      },
      {
        id: 'component:domain',
        label: 'Domain',
        path: 'src/domain',
        kind: 'module',
        containerId: 'container:app',
        confidence: 0.8,
        asserted: false,
        computed: true,
        position: { x: 4, y: 0, z: 0 },
        width: 4,
        depth: 3,
        height: 7,
        colour: '#50FFC2',
        buildingIds: ['building:domain'],
        filePaths: ['src/domain/order.ts'],
        entryPointIds: [],
        deploymentUnitIds: [],
        contractInCount: 1,
        contractOutCount: 0,
        directInCount: 0,
        directOutCount: 1,
        readCount: 0,
        writeCount: 0,
      },
      {
        id: 'component:docs',
        label: 'Docs site',
        path: 'docs',
        kind: 'documentation',
        containerId: 'container:docs',
        confidence: 0.8,
        asserted: false,
        computed: true,
        position: { x: 28, y: 0, z: 0 },
        width: 4,
        depth: 3,
        height: 5,
        colour: '#7AA2FF',
        buildingIds: ['building:docs'],
        filePaths: ['docs/package.json', 'docs/docs/intro.mdx'],
        entryPointIds: ['entry:docs-start'],
        deploymentUnitIds: ['deployment:docs'],
        contractInCount: 0,
        contractOutCount: 0,
        directInCount: 0,
        directOutCount: 0,
        readCount: 0,
        writeCount: 0,
      },
    ],
    entryPoints: [
      {
        id: 'entry:cli',
        label: 'bitloops',
        entryKind: 'cli',
        containerId: 'container:app',
        componentId: 'component:api',
        position: { x: -4, y: 0, z: -12 },
      },
      {
        id: 'entry:docs-start',
        label: 'docusaurus start',
        entryKind: 'npm_script',
        containerId: 'container:docs',
        componentId: 'component:docs',
        position: { x: 28, y: 0, z: -12 },
      },
    ],
    deploymentUnits: [
      {
        id: 'deployment:cli',
        label: 'bitloops cli',
        kind: 'cargo_bin',
        containerId: 'container:app',
        componentId: 'component:api',
        position: { x: -4, y: 0, z: 12 },
      },
      {
        id: 'deployment:docs',
        label: 'documentation site',
        kind: 'package_json',
        containerId: 'container:docs',
        componentId: 'component:docs',
        position: { x: 28, y: 0, z: 12 },
      },
    ],
    persistenceObjects: [],
    contractConnections: [
      {
        id: 'contract:api-domain',
        kind: 'contract',
        fromComponentId: 'component:api',
        toComponentId: 'component:domain',
        label: 'CLI flow',
        flowIds: ['flow:cli'],
        entryPointIds: ['entry:cli'],
        confidence: 0.8,
        strength: 0.5,
      },
    ],
    directConnections: [
      {
        id: 'direct:domain-api',
        kind: 'direct',
        fromComponentId: 'component:domain',
        toComponentId: 'component:api',
        label: 'Direct dependency',
        dependencyCount: 1,
        sourcePaths: ['src/domain/order.ts'],
        targetPaths: ['src/api/main.ts'],
        strength: 0.5,
        severity: 'high',
      },
    ],
    dataConnections: [],
    navigationContext: {
      viewId: 'architecture_map',
      viewKind: 'ARCHITECTURE_MAP',
      label: 'Architecture map',
      status: 'stale',
      reviewState: 'unreviewed',
      acceptedSignature: 'accepted-signature',
      currentSignature: 'current-signature',
      materialisedRef: 'navigation-context://materialisations/123',
      updatedAt: '2026-05-03T00:00:00Z',
      changeCount: 1,
      changedPrimitiveIds: ['primitive:domain'],
      changedByPath: {
        'src/domain/order.ts': ['primitive:domain'],
      },
      changedByComponentId: {
        'component:domain': ['primitive:domain'],
      },
      acceptanceHistory: [],
      changedPrimitives: [
        {
          primitiveId: 'primitive:domain',
          primitiveKind: 'SYMBOL',
          label: 'createOrder',
          path: 'src/domain/order.ts',
          sourceKind: 'TEST',
          changeKind: 'hash_changed',
          previousHash: 'previous-signature',
          currentHash: 'current-signature',
          mappedComponentIds: ['component:domain'],
        },
      ],
    },
    bounds: {
      minX: -12,
      maxX: 12,
      minZ: -12,
      maxZ: 12,
      width: 24,
      depth: 24,
      centre: { x: 0, y: 0, z: 0 },
    },
    summary: {
      containerCount: 2,
      componentGroupCount: 0,
      componentCount: 3,
      contractConnectionCount: 1,
      directConnectionCount: 1,
      persistenceObjectCount: 0,
      readWriteConnectionCount: 0,
    },
  }
}

function renderPage(props?: Partial<ComponentProps<typeof ArchitecturePage>>) {
  return render(
    <ThemeProvider>
      <SidebarProvider defaultOpen>
        <ArchitecturePage {...props} />
      </SidebarProvider>
    </ThemeProvider>,
  )
}

describe('Architecture page', () => {
  beforeEach(() => {
    rootStoreInstance.getState().resetDashboardFilters()
    rootStoreInstance.getState().clearDashboardCache()
    mockFetchDashboardRepositories.mockReset()
    mockFetchDashboardRepositories.mockResolvedValue(dashboardRepositories)
  })

  it('loads architecture scene and toggles direct connections', async () => {
    const loadScene = vi.fn(async () => architectureScene())

    renderPage({ loadScene })

    expect(
      screen.getByRole('heading', { name: 'Architecture' }),
    ).toBeInTheDocument()
    await waitFor(() => {
      expect(loadScene).toHaveBeenCalledWith(
        expect.objectContaining({
          repository: dashboardRepositories[0],
          projectPath: '.',
        }),
      )
    })
    await userEvent.click(screen.getByTestId('architecture-mode-map'))
    expect(
      within(await screen.findByTestId('mock-architecture-canvas')).getByText(
        'Architecture - bitloops',
      ),
    ).toBeInTheDocument()

    const directToggle = screen.getByTestId(
      'architecture-toggle-direct-connections',
    )
    expect(directToggle).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(directToggle)
    expect(directToggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('Direct connections: off')).toBeInTheDocument()

    await userEvent.type(
      screen.getByTestId('architecture-search-input'),
      'Domain',
    )
    await userEvent.click(screen.getByText('Domain'))

    expect(
      within(screen.getByTestId('architecture-inspector')).getByText(
        'Component',
      ),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('architecture-inspector')).getByText('Domain'),
    ).toBeInTheDocument()
  })

  it('shows architecture context review and focuses mapped components', async () => {
    const loadScene = vi.fn(async () => architectureScene())

    renderPage({ loadScene })

    await userEvent.click(await screen.findByTestId('architecture-mode-map'))

    expect(
      await screen.findByTestId('architecture-context-summary'),
    ).toHaveTextContent('Initial baseline')

    await userEvent.click(
      screen.getByTestId('architecture-context-review-button'),
    )

    expect(
      within(screen.getByTestId('architecture-context-review')).getByText(
        'createOrder',
      ),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByText('createOrder'))

    expect(
      within(screen.getByTestId('architecture-inspector')).getByText('Domain'),
    ).toBeInTheDocument()
    expect(
      within(screen.getByTestId('architecture-inspector')).getByText(
        'Context changes',
      ),
    ).toBeInTheDocument()
  })

  it('switches to the hierarchy demo workspace', async () => {
    const loadScene = vi.fn(async () => architectureScene())

    renderPage({ loadScene })

    expect(
      await screen.findByTestId('architecture-system-hub'),
    ).toBeInTheDocument()

    await userEvent.click(screen.getByTestId('architecture-mode-hierarchy'))

    expect(
      await screen.findByTestId('architecture-hierarchy-demo'),
    ).toBeInTheDocument()
    expect(screen.getByText('Bitloops developer platform')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Flow/u })).toBeInTheDocument()
    expect(
      screen.queryByTestId('architecture-toggle-direct-connections'),
    ).not.toBeInTheDocument()
  })

  it('shows a data-driven overview in the system hub by default', async () => {
    const loadScene = vi.fn(async () => architectureScene())

    renderPage({ loadScene })

    const hub = await screen.findByTestId('architecture-system-hub')

    expect(
      within(hub).getByRole('heading', { name: 'Architecture' }),
    ).toBeInTheDocument()
    for (const optionId of ['menu-overview', 'menu-state', 'menu-freshness']) {
      expect(
        within(hub).getByTestId(`architecture-hub-menu-option-${optionId}`),
      ).toBeInTheDocument()
    }
    expect(
      within(hub).queryByTestId(
        'architecture-hub-menu-option-menu-entry-points',
      ),
    ).not.toBeInTheDocument()
    expect(
      within(hub).getByTestId('architecture-container-carousel'),
    ).toBeInTheDocument()
    expect(
      within(hub).getByTestId(
        'architecture-container-carousel-item-container-app',
      ),
    ).toHaveAttribute('aria-current', 'true')
    expect(
      within(hub).getByTestId(
        'architecture-container-carousel-item-container-docs',
      ),
    ).toBeInTheDocument()
    expect(
      within(hub).getByTestId('architecture-container-board'),
    ).toBeInTheDocument()
    expect(
      within(hub).getByTestId('architecture-container-entry-point-entry-cli'),
    ).toBeInTheDocument()
    expect(
      within(hub).queryByTestId('architecture-hub-scene-node-menu-overview'),
    ).not.toBeInTheDocument()
    expect(
      within(hub).queryByTestId(
        'architecture-hub-scene-node-overview-container-container-app',
      ),
    ).not.toBeInTheDocument()
    expect(
      within(hub).queryByTestId(
        'architecture-hub-menu-option-overview-deployables',
      ),
    ).not.toBeInTheDocument()
    expect(
      within(hub).queryByTestId(
        'architecture-hub-menu-option-overview-relationships',
      ),
    ).not.toBeInTheDocument()
    expect(within(hub).getAllByText('Application').length).toBeGreaterThan(0)
    expect(within(hub).getByText('bitloops')).toBeInTheDocument()
    expect(within(hub).getByText('bitloops cli')).toBeInTheDocument()
    expect(within(hub).getByText('API')).toBeInTheDocument()
    expect(
      within(hub).getAllByText(/1 changed primitive/u).length,
    ).toBeGreaterThan(0)
  })

  it('moves the overview focus with keyboard and mouse', async () => {
    const loadScene = vi.fn(async () => architectureScene())

    renderPage({ loadScene })

    const hub = await screen.findByTestId('architecture-system-hub')
    const overview = within(hub).getByTestId(
      'architecture-hub-menu-option-menu-overview',
    )
    const state = within(hub).getByTestId(
      'architecture-hub-menu-option-menu-state',
    )
    const application = within(hub).getByTestId(
      'architecture-container-carousel-item-container-app',
    )
    const documentation = within(hub).getByTestId(
      'architecture-container-carousel-item-container-docs',
    )

    expect(overview).toHaveAttribute('aria-current', 'true')
    expect(application).toHaveAttribute('aria-current', 'true')

    fireEvent.keyDown(hub, { key: 'ArrowRight' })

    expect(documentation).toHaveAttribute('aria-current', 'true')
    expect(
      within(hub).getByTestId(
        'architecture-container-entry-point-entry-docs-start',
      ),
    ).toBeInTheDocument()
    expect(within(hub).getByText('docusaurus start')).toBeInTheDocument()

    fireEvent.keyDown(hub, { key: 'ArrowDown' })

    expect(state).toHaveAttribute('aria-current', 'true')

    await userEvent.hover(state)

    expect(state).toHaveAttribute('aria-current', 'true')
    expect(
      within(hub).getByTestId('architecture-hub-scene-node-state-empty'),
    ).toBeInTheDocument()
  })

  it('toggles full-screen mode for the system hub', async () => {
    const loadScene = vi.fn(async () => architectureScene())

    renderPage({ loadScene })

    const hub = await screen.findByTestId('architecture-system-hub')
    expect(hub).not.toHaveClass('fixed')

    await userEvent.click(
      screen.getByRole('button', { name: 'Enter full screen' }),
    )

    expect(hub).toHaveClass('fixed')
    expect(
      screen.getByRole('button', { name: 'Exit full screen' }),
    ).toBeInTheDocument()

    await userEvent.click(
      screen.getByRole('button', { name: 'Exit full screen' }),
    )

    expect(hub).not.toHaveClass('fixed')
  })
})
