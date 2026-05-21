import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  fetchRuntimeExecutableResolutions,
  fetchRuntimeConfigSnapshot,
  fetchRuntimeConfigTargets,
  updateRuntimeConfig,
  type RuntimeConfigField,
  type RuntimeConfigSection,
  type RuntimeConfigSnapshot,
  type RuntimeConfigTarget,
} from '@/api/runtime/config'
import { SettingsConfiguration } from './index'

vi.mock('@/api/runtime/config', () => ({
  fetchRuntimeExecutableResolutions: vi.fn(),
  fetchRuntimeConfigTargets: vi.fn(),
  fetchRuntimeConfigSnapshot: vi.fn(),
  updateRuntimeConfig: vi.fn(),
}))

const target: RuntimeConfigTarget = {
  id: 'target-daemon',
  kind: 'daemon',
  scope: 'Daemon',
  label: 'Daemon config',
  group: 'Daemon',
  path: '/tmp/bitloops/config.toml',
  repoRoot: null,
  exists: true,
}

const repoTarget: RuntimeConfigTarget = {
  id: 'target-repo-local',
  kind: 'repo_local',
  scope: 'Local repo',
  label: '.bitloops.local.toml',
  group: '/tmp/project',
  path: '/tmp/project/.bitloops.local.toml',
  repoRoot: '/tmp/project',
  exists: true,
}

function field(
  path: string[],
  label: string,
  value: unknown,
  overrides: Partial<RuntimeConfigField> = {},
): RuntimeConfigField {
  return {
    key: path.join('.'),
    path,
    label,
    description: path.join('.'),
    fieldType:
      typeof value === 'boolean'
        ? 'boolean'
        : typeof value === 'number'
          ? 'integer'
          : 'string',
    value,
    effectiveValue: value,
    defaultValue: null,
    allowedValues: [],
    validationHints: [],
    required: false,
    readOnly: false,
    secret: false,
    order: 0,
    source: 'effective',
    ...overrides,
  }
}

function section(
  key: string,
  title: string,
  description: string,
  order: number,
  fields: RuntimeConfigField[],
  overrides: Partial<RuntimeConfigSection> = {},
): RuntimeConfigSection {
  return {
    key,
    title,
    description,
    order,
    advanced: false,
    value: {},
    effectiveValue: {},
    fields,
    ...overrides,
  }
}

function snapshot(overrides: Partial<RuntimeConfigSnapshot> = {}) {
  return {
    target,
    revision: 'rev-1',
    valid: true,
    validationErrors: [],
    restartRequired: true,
    reloadRequired: false,
    rawValue: {},
    effectiveValue: {},
    sections: [
      section(
        'architecture',
        'Architecture',
        'Architecture graph configuration',
        5,
        [
          field(
            ['architecture', 'inference', 'fact_synthesis'],
            'Fact synthesis',
            'summary_llm',
            {
              description: 'Profile binding for architecture fact synthesis.',
              order: 0,
            },
          ),
          field(
            ['architecture', 'inference', 'role_adjudication'],
            'Role adjudication',
            'guidance_llm',
            {
              description:
                'Profile binding for architecture role adjudication.',
              order: 1,
            },
          ),
        ],
      ),
      section(
        'context_guidance',
        'Context Guidance',
        'Repository-aware guidance settings',
        6,
        [
          field(
            ['context_guidance', 'inference', 'guidance_generation'],
            'Guidance generation',
            'summary_llm',
            {
              description: 'Profile binding for context guidance.',
            },
          ),
        ],
      ),
      section(
        'semantic_clones',
        'Semantic clones',
        'Semantic clone detection settings',
        7,
        [
          field(['semantic_clones', 'summary_mode'], 'Summary mode', 'dense', {
            order: 0,
          }),
          field(
            ['semantic_clones', 'embedding_mode'],
            'Embedding mode',
            'code',
            { order: 1 },
          ),
          field(['semantic_clones', 'ann_neighbors'], 'ANN neighbors', 16, {
            order: 2,
          }),
          field(
            ['semantic_clones', 'enrichment_workers'],
            'Enrichment workers',
            3,
            { order: 3 },
          ),
          field(
            ['semantic_clones', 'inference', 'clone_review'],
            'Clone review',
            'local_code',
            {
              description: 'Profile binding for semantic clone review.',
              order: 4,
            },
          ),
        ],
      ),
      section(
        'knowledge',
        'Knowledge',
        'Knowledge providers and refresh settings',
        8,
        [
          field(
            ['knowledge', 'refresh_interval_secs'],
            'Refresh interval',
            60,
            { order: 0 },
          ),
          field(
            ['knowledge', 'providers', 'github', 'token'],
            'Token',
            '${GITHUB_TOKEN}',
            { order: 1 },
          ),
          field(
            ['knowledge', 'providers', 'atlassian', 'site_url'],
            'Site URL',
            'https://example.atlassian.net',
            { order: 2 },
          ),
          field(
            ['knowledge', 'providers', 'atlassian', 'email'],
            'Email',
            '${ATLASSIAN_EMAIL}',
            { order: 3 },
          ),
          field(
            ['knowledge', 'providers', 'atlassian', 'token'],
            'Token',
            '${ATLASSIAN_TOKEN}',
            { order: 4 },
          ),
        ],
      ),
      section('codecity', 'CodeCity', 'CodeCity renderer settings', 8.5, [
        field(['codecity', 'render_mode'], 'Render mode', 'world', {
          order: 0,
        }),
      ]),
      section(
        'inference_profiles',
        'Inference profiles',
        'Reusable inference profile definitions',
        10,
        [
          field(
            ['inference', 'profiles', 'summary_llm', 'task'],
            'Task',
            'text_generation',
            { order: 0 },
          ),
          field(
            ['inference', 'profiles', 'summary_llm', 'driver'],
            'Driver',
            'openai_chat_completions',
            { order: 1 },
          ),
          field(
            ['inference', 'profiles', 'summary_llm', 'runtime'],
            'Runtime',
            'bitloops_inference',
            { order: 2 },
          ),
          field(
            ['inference', 'profiles', 'summary_llm', 'model'],
            'Model',
            'gpt-5.4-mini',
            { order: 3 },
          ),
          field(
            ['inference', 'profiles', 'summary_llm', 'api_key'],
            'API key',
            '${OPENAI_API_KEY}',
            { order: 4 },
          ),
          field(
            ['inference', 'profiles', 'summary_llm', 'base_url'],
            'Base URL',
            'https://api.openai.com/v1/chat/completions',
            { order: 5 },
          ),
          field(
            ['inference', 'profiles', 'summary_llm', 'temperature'],
            'Temperature',
            '0.1',
            { order: 6 },
          ),
          field(
            ['inference', 'profiles', 'summary_llm', 'max_output_tokens'],
            'Max output tokens',
            200,
            { order: 7 },
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'task'],
            'Task',
            'text_generation',
            { order: 8 },
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'driver'],
            'Driver',
            'bitloops_platform_chat',
            { order: 9 },
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'runtime'],
            'Runtime',
            'bitloops_inference',
            { order: 10 },
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'model'],
            'Model',
            'ministral-3-3b-instruct',
            { order: 11 },
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'api_key'],
            'API key',
            '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
            { order: 12 },
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'temperature'],
            'Temperature',
            '0.1',
            { order: 13 },
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'max_output_tokens'],
            'Max output tokens',
            4096,
            { order: 14 },
          ),
          field(
            ['inference', 'profiles', 'local_code', 'task'],
            'Task',
            'embeddings',
            { order: 15 },
          ),
          field(
            ['inference', 'profiles', 'local_code', 'driver'],
            'Driver',
            'bitloops_embeddings_ipc',
            { order: 16 },
          ),
          field(
            ['inference', 'profiles', 'local_code', 'runtime'],
            'Runtime',
            'bitloops_local_embeddings',
            { order: 17 },
          ),
          field(
            ['inference', 'profiles', 'local_code', 'model'],
            'Model',
            'bge-m3',
            { order: 18 },
          ),
        ],
      ),
      section(
        'inference_runtimes',
        'Inference runtimes',
        'Reusable runtime definitions',
        11,
        [
          field(
            ['inference', 'runtimes', 'bitloops_inference', 'command'],
            'Command',
            '/Users/alex/Library/Application Support/bitloops/tools/bitloops-inference/bitloops-inference',
            { order: 0 },
          ),
          field(
            ['inference', 'runtimes', 'bitloops_inference', 'args'],
            'Args',
            [],
            { fieldType: 'json', order: 1 },
          ),
          field(
            [
              'inference',
              'runtimes',
              'bitloops_inference',
              'startup_timeout_secs',
            ],
            'Startup timeout secs',
            60,
            { order: 2 },
          ),
          field(
            [
              'inference',
              'runtimes',
              'bitloops_inference',
              'request_timeout_secs',
            ],
            'Request timeout secs',
            300,
            { order: 3 },
          ),
          field(
            ['inference', 'runtimes', 'bitloops_local_embeddings', 'command'],
            'Command',
            '/Users/alex/Library/Application Support/bitloops/tools/bitloops-local-embeddings/bitloops-local-embeddings',
            { order: 1 },
          ),
          field(
            ['inference', 'runtimes', 'bitloops_local_embeddings', 'args'],
            'Args',
            [],
            { fieldType: 'json', order: 5 },
          ),
          field(
            [
              'inference',
              'runtimes',
              'bitloops_local_embeddings',
              'startup_timeout_secs',
            ],
            'Startup timeout secs',
            60,
            { order: 6 },
          ),
          field(
            [
              'inference',
              'runtimes',
              'bitloops_local_embeddings',
              'request_timeout_secs',
            ],
            'Request timeout secs',
            300,
            { order: 7 },
          ),
          field(
            ['inference', 'runtimes', 'unused_runtime', 'command'],
            'Command',
            '/tmp/unused-runtime',
            { order: 8 },
          ),
        ],
      ),
      section('stores', 'Stores', 'Shared store settings', 12, [
        field(
          ['stores', 'relational', 'sqlite_path'],
          'SQLite path',
          'bitloops.sqlite',
          {
            description: 'Local relational store path.',
            order: 0,
          },
        ),
        field(['stores', 'secret', 'token'], 'Github token', '********', {
          description: 'A redacted secret field.',
          secret: true,
          order: 1,
          validationHints: [
            'Existing values are redacted; leave the placeholder unchanged to preserve the current secret.',
          ],
        }),
      ]),
      section('logging', 'Logging', 'Generic daemon logging settings', 13, [
        field(['logging', 'level'], 'Log level', 'info'),
      ]),
      section(
        'advanced',
        'Advanced',
        'Structured runtime value',
        20,
        [
          field(
            ['advanced'],
            'Advanced',
            {},
            {
              fieldType: 'json',
              value: {},
              effectiveValue: null,
              source: null,
              validationHints: ['Enter a valid JSON object, array, or scalar.'],
            },
          ),
        ],
        {
          advanced: true,
          effectiveValue: null,
        },
      ),
    ],
    ...overrides,
  } satisfies RuntimeConfigSnapshot
}

function jsonField(
  path: string[],
  label: string,
  value: unknown,
  overrides: Partial<RuntimeConfigField> = {},
): RuntimeConfigField {
  return field(path, label, value, {
    fieldType: 'json',
    value,
    effectiveValue: value,
    defaultValue: null,
    source: null,
    validationHints: ['Enter valid JSON.'],
    ...overrides,
  })
}

async function ensurePackExpanded(
  user: ReturnType<typeof userEvent.setup>,
  card: HTMLElement,
  nestedContent: RegExp | string,
) {
  const hasContent = () =>
    within(card).queryAllByText(nestedContent).length > 0 ||
    within(card).queryAllByRole('heading', { name: nestedContent }).length > 0

  if (hasContent()) {
    return card
  }

  const testId = card.getAttribute('data-testid')
  const toggle = within(card).getAllByRole('button')[0] as HTMLButtonElement

  try {
    await within(card).findByText(nestedContent, {}, { timeout: 150 })
    return testId ? await screen.findByTestId(testId) : card
  } catch {
    await user.click(toggle)
  }

  const refreshedCard = testId ? await screen.findByTestId(testId) : card
  await waitFor(() => {
    const hasNestedContent =
      within(refreshedCard).queryAllByText(nestedContent).length > 0 ||
      within(refreshedCard).queryAllByRole('heading', { name: nestedContent })
        .length > 0
    expect(hasNestedContent).toBe(true)
  })
  return refreshedCard
}

async function enablePack(
  user: ReturnType<typeof userEvent.setup>,
  packId: string,
  packLabel: string,
) {
  const card = await screen.findByTestId(`capability-pack-card-${packId}`)
  await user.click(
    within(card).getByRole('button', { name: `Enable ${packLabel}` }),
  )
  return screen.findByTestId(`capability-pack-card-${packId}`)
}

function fieldRowByLabel(scope: HTMLElement, label: string) {
  const labelNode = [...scope.querySelectorAll('label')].find(
    (node) => node.textContent?.trim().toLowerCase() === label.toLowerCase(),
  )
  return (labelNode?.closest('div.grid') as HTMLElement | null) ?? null
}

function expectFieldSelectValue(
  scope: HTMLElement,
  label: string,
  value: string,
) {
  const row = fieldRowByLabel(scope, label)
  expect(row).not.toBeNull()
  const combobox = within(row as HTMLElement).getByRole('combobox')
  expect(combobox).toHaveTextContent(value)
  return combobox
}

async function chooseFieldOption(
  user: ReturnType<typeof userEvent.setup>,
  scope: HTMLElement,
  label: string,
  value: string,
) {
  const row = fieldRowByLabel(scope, label)
  expect(row).not.toBeNull()
  const combobox = within(row as HTMLElement).getByRole('combobox')
  await user.click(combobox)
  await user.click(await screen.findByRole('option', { name: value }))
}

function expectFieldCheckbox(scope: HTMLElement, label: string) {
  const row = fieldRowByLabel(scope, label)
  expect(row).not.toBeNull()
  return within(row as HTMLElement).getByRole('checkbox')
}

function sectionByHeading(
  scope: HTMLElement,
  name: string | RegExp,
): HTMLElement {
  const sectionElement = within(scope)
    .getByRole('heading', { name })
    .closest('section') as HTMLElement | null
  expect(sectionElement).not.toBeNull()
  return sectionElement as HTMLElement
}

describe('SettingsConfiguration', () => {
  beforeEach(() => {
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = () => false
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = () => {}
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = () => {}
    }
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = () => {}
    }
    vi.resetAllMocks()
    vi.mocked(fetchRuntimeExecutableResolutions).mockResolvedValue([])
    vi.mocked(fetchRuntimeConfigTargets).mockResolvedValue([target])
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValue(snapshot())
    vi.mocked(updateRuntimeConfig).mockImplementation(async ({ patches }) => {
      const patchedValues = new Map(
        patches.map((patch) => [patch.path.join('.'), patch.value] as const),
      )

      return snapshot({
        revision: 'rev-2',
        sections: snapshot().sections.map((configSection) => ({
          ...configSection,
          fields: configSection.fields.map((configField) => {
            if (!patchedValues.has(configField.key)) {
              return configField
            }
            const value = patchedValues.get(configField.key)
            return {
              ...configField,
              value,
              effectiveValue: value,
            }
          }),
        })),
      })
    })
  })

  it('shows only real visible capability packs and never renders CodeCity', async () => {
    render(<SettingsConfiguration />)

    const cards = await screen.findAllByTestId(/capability-pack-card-/)
    expect(cards).toHaveLength(4)
    expect(
      cards.map(
        (card) =>
          within(card).getAllByRole('button')[0]?.textContent?.trim() ?? '',
      ),
    ).toEqual([
      'Architecture graph',
      'Context Guidance',
      'Semantic clones',
      'Knowledge pack',
    ])
    expect(
      screen.queryByTestId('capability-pack-card-codecity'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Render mode')).not.toBeInTheDocument()
  })

  it('hydrates capability pack enablement from persisted config paths', async () => {
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: snapshot().sections.filter(
          (configSection) => configSection.key !== 'architecture',
        ),
      }),
    )
    render(<SettingsConfiguration />)

    const architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    expect(
      within(architectureCard).getByRole('button', {
        name: 'Enable Architecture graph',
      }),
    ).toBeInTheDocument()

    const semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    expect(
      within(semanticClonesCard).getByRole('button', {
        name: 'Disable Semantic clones',
      }),
    ).toBeInTheDocument()

    const knowledgeCard = screen.getByTestId(
      'capability-pack-card-knowledge-pack',
    )
    expect(
      within(knowledgeCard).getByRole('button', {
        name: 'Disable Knowledge pack',
      }),
    ).toBeInTheDocument()
  })

  it('expands pack fields without enabling the pack until Enable is clicked', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: snapshot().sections.filter(
          (configSection) => configSection.key !== 'architecture',
        ),
      }),
    )
    render(<SettingsConfiguration />)

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    expect(
      within(architectureCard).queryByText('Fact synthesis'),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).getByRole('button', {
        name: 'Enable Architecture graph',
      }),
    ).toBeInTheDocument()

    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Fact synthesis',
    )

    expect(
      within(architectureCard).getByRole('button', {
        name: 'Enable Architecture graph',
      }),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).queryByRole('button', {
        name: 'Disable Architecture graph',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).getAllByText('Fact synthesis')[0],
    ).toBeInTheDocument()

    architectureCard = await enablePack(
      user,
      'architecture-graph',
      'Architecture graph',
    )
    expect(
      within(architectureCard).getByRole('button', {
        name: 'Disable Architecture graph',
      }),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).getAllByText('Fact synthesis')[0],
    ).toBeInTheDocument()
  })

  it('saves disabled persisted capability packs as unset patches', async () => {
    const user = userEvent.setup()
    vi.mocked(updateRuntimeConfig).mockResolvedValueOnce(
      snapshot({
        revision: 'rev-2',
        sections: snapshot().sections.filter(
          (configSection) => configSection.key !== 'architecture',
        ),
      }),
    )
    render(<SettingsConfiguration />)

    const architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    await user.click(
      within(architectureCard).getByRole('button', {
        name: 'Disable Architecture graph',
      }),
    )
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['architecture'],
          unset: true,
        },
      ],
    })
    const submittedPatches =
      vi.mocked(updateRuntimeConfig).mock.calls[0]?.[0].patches ?? []
    expect(
      submittedPatches.some((patch) => patch.path[0] === 'inference'),
    ).toBe(false)
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
    expect(
      within(
        await screen.findByTestId('capability-pack-card-architecture-graph'),
      ).getByRole('button', { name: 'Enable Architecture graph' }),
    ).toBeInTheDocument()
  })

  it('resets capability pack enablement to the file-derived state', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    await user.click(
      within(architectureCard).getByRole('button', {
        name: 'Disable Architecture graph',
      }),
    )
    expect(
      within(architectureCard).getByRole('button', {
        name: 'Enable Architecture graph',
      }),
    ).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Reset changes' }))
    expect(
      within(architectureCard).getByRole('button', {
        name: 'Disable Architecture graph',
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  })

  it('does not render raw config paths or duplicate effective values as field help text', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const architectureCard = await ensurePackExpanded(
      user,
      await screen.findByTestId('capability-pack-card-architecture-graph'),
      'Fact synthesis',
    )

    expect(
      within(architectureCard).queryByText(
        'inference.profiles.summary_llm.max_output_tokens',
      ),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).queryByText('Effective: 200'),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).queryByRole('heading', {
        name: 'Inference profile · summary_llm',
      }),
    ).not.toBeInTheDocument()
  })

  it('renders daemon setup above repo setup and keeps repo target selection inside repo setup', async () => {
    vi.mocked(fetchRuntimeConfigTargets).mockResolvedValueOnce([
      target,
      repoTarget,
    ])
    vi.mocked(fetchRuntimeConfigSnapshot)
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot({ target: repoTarget }))
    render(<SettingsConfiguration />)

    expect(
      screen.queryByRole('heading', { name: 'Setup & capability packs' }),
    ).not.toBeInTheDocument()

    const daemonSetupPanel = await screen.findByTestId('daemon-setup-options')
    expectFieldCheckbox(daemonSetupPanel, 'Daemon should start automatically')
    expectFieldCheckbox(daemonSetupPanel, 'Enable telemetry')
    expect(fieldRowByLabel(daemonSetupPanel, 'Sync')).toBeNull()
    expect(fieldRowByLabel(daemonSetupPanel, 'Ingest')).toBeNull()

    const repoSetupPanel = await screen.findByTestId('repo-setup-options')
    expect(
      within(repoSetupPanel).getByRole('heading', { name: 'Repo setup' }),
    ).toBeInTheDocument()
    const repositorySelect = within(repoSetupPanel).getByLabelText('Repository')
    expect(repositorySelect).toHaveValue('target-repo-local')
    expect(
      within(repositorySelect).queryByRole('option', {
        name: /Daemon config/,
      }),
    ).not.toBeInTheDocument()
    expect(
      within(repositorySelect).getByRole('option', {
        name: '/tmp/project · .bitloops.local.toml',
      }),
    ).toBeInTheDocument()
    expectFieldCheckbox(repoSetupPanel, 'Sync')
    expectFieldCheckbox(repoSetupPanel, 'Ingest')
    expect(
      fieldRowByLabel(repoSetupPanel, 'Daemon should start automatically'),
    ).toBeNull()
    expect(fieldRowByLabel(repoSetupPanel, 'Enable telemetry')).toBeNull()

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    expect(
      daemonSetupPanel.compareDocumentPosition(repoSetupPanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      repoSetupPanel.compareDocumentPosition(inferencePanel) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    expect(
      within(architectureCard).queryByText('Overview'),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).queryByText('Inside this pack'),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).queryByText('Advanced config'),
    ).not.toBeInTheDocument()

    const semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    expect(
      within(semanticClonesCard).queryByText('Advanced config'),
    ).not.toBeInTheDocument()
  })

  it('does not render dead repo setup controls when no repo config target exists', async () => {
    vi.mocked(fetchRuntimeConfigTargets).mockResolvedValueOnce([target])
    render(<SettingsConfiguration />)

    const repoSetupPanel = await screen.findByTestId('repo-setup-options')
    expect(
      within(repoSetupPanel).getByText(
        'No repository config files are available.',
      ),
    ).toBeInTheDocument()
    expect(
      within(repoSetupPanel).queryByLabelText('Repository'),
    ).not.toBeInTheDocument()
    expect(fieldRowByLabel(repoSetupPanel, 'Sync')).toBeNull()
    expect(fieldRowByLabel(repoSetupPanel, 'Ingest')).toBeNull()
  })

  it('renders a strict inference config panel for all runnable backend profiles and runtimes', async () => {
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  bitloops_inference: {
                    command: 'bitloops-inference',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                  openai_runtime: {
                    request_timeout_secs: 120,
                  },
                  ollama_runtime: {
                    request_timeout_secs: 90,
                  },
                  custom_agent: {
                    command: 'custom-agent',
                    args: ['--json'],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 900,
                  },
                  bitloops_platform_embeddings: {
                    command: 'bitloops-embeddings',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                },
                profiles: {
                  summary_llm: {
                    task: 'text_generation',
                    driver: 'openai_chat_completions',
                    runtime: 'openai_runtime',
                    model: 'gpt-4.1-mini',
                    base_url: 'https://api.openai.com/v1/chat/completions',
                    api_key: '${OPENAI_API_KEY}',
                    temperature: '0.1',
                    max_output_tokens: 200,
                  },
                  openai_fast: {
                    task: 'text-generation',
                    driver: 'openai_chat_completions',
                    runtime: 'openai_runtime',
                    model: 'gpt-4.1-mini',
                    base_url: 'https://api.openai.com/v1/chat/completions',
                    temperature: '0.2',
                    max_output_tokens: 128,
                  },
                  ollama_local: {
                    task: 'text_generation',
                    driver: 'ollama_chat',
                    runtime: 'ollama_runtime',
                    model: 'qwen2.5-coder:14b',
                    base_url: 'http://127.0.0.1:11434/api/chat',
                    temperature: '0.1',
                    max_output_tokens: 512,
                  },
                  local_agent: {
                    task: 'structured_generation',
                    driver: 'codex_exec',
                    runtime: 'custom_agent',
                    model: 'gpt-5.4-mini',
                    temperature: '0.1',
                    max_output_tokens: 4096,
                    thinking_level: 'xhigh',
                  },
                  platform_code: {
                    task: 'embeddings',
                    driver: 'bitloops_embeddings_ipc',
                    runtime: 'bitloops_platform_embeddings',
                    model: 'bge-m3',
                  },
                },
              }),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    expect(
      within(inferencePanel).getByRole('heading', { name: 'Inference config' }),
    ).toBeInTheDocument()

    for (const profileId of [
      'summary_llm',
      'openai_fast',
      'ollama_local',
      'local_agent',
    ]) {
      expect(
        within(inferencePanel).getByRole('heading', {
          name: `Inference profile · ${profileId}`,
        }),
      ).toBeInTheDocument()
    }

    expect(
      within(inferencePanel).queryByRole('heading', {
        name: 'Inference profile · platform_code',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(inferencePanel).queryByText('bitloops_embeddings_ipc'),
    ).not.toBeInTheDocument()
    expect(
      within(inferencePanel).queryByText('embeddings'),
    ).not.toBeInTheDocument()

    const summaryProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · summary_llm',
    )
    expectFieldSelectValue(summaryProfile, 'Task', 'text_generation')
    expectFieldSelectValue(summaryProfile, 'Driver', 'openai_chat_completions')
    expectFieldSelectValue(summaryProfile, 'Runtime', 'openai_runtime')
    expect(
      within(summaryProfile).getByDisplayValue('gpt-4.1-mini'),
    ).toBeInTheDocument()
    expect(
      within(summaryProfile).getByDisplayValue(
        'https://api.openai.com/v1/chat/completions',
      ),
    ).toBeInTheDocument()
    expect(
      within(summaryProfile).getByDisplayValue('${OPENAI_API_KEY}'),
    ).toBeInTheDocument()
    expect(within(summaryProfile).getByDisplayValue('0.1')).toBeInTheDocument()
    expect(within(summaryProfile).getByDisplayValue('200')).toBeInTheDocument()

    expect(
      within(summaryProfile).queryByText('Thinking level'),
    ).not.toBeInTheDocument()

    for (const runtimeId of [
      'bitloops_inference',
      'openai_runtime',
      'ollama_runtime',
      'custom_agent',
    ]) {
      expect(
        within(inferencePanel).getByRole('heading', {
          name: `Inference runtime · ${runtimeId}`,
        }),
      ).toBeInTheDocument()
    }
    expect(
      within(inferencePanel).queryByRole('heading', {
        name: 'Inference runtime · bitloops_platform_embeddings',
      }),
    ).not.toBeInTheDocument()
  })

  it('maps capability pack fields into their cards without redefining selected inference profiles', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    expect(
      within(inferencePanel).getByRole('heading', {
        name: 'Inference profile · summary_llm',
      }),
    ).toBeInTheDocument()

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Fact synthesis',
    )
    const architectureFactPanel = within(architectureCard)
      .getByRole('heading', { name: 'Fact synthesis' })
      .closest('section') as HTMLElement | null
    expect(architectureFactPanel).not.toBeNull()
    expectFieldSelectValue(
      architectureFactPanel as HTMLElement,
      'Fact synthesis',
      'summary_llm',
    )
    expect(
      within(architectureCard).queryByRole('heading', {
        name: 'Inference profile · summary_llm',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).queryByRole('heading', {
        name: 'Inference runtime · bitloops_inference',
      }),
    ).not.toBeInTheDocument()

    const architectureRolePanel = within(architectureCard)
      .getByRole('heading', { name: 'Role adjudication' })
      .closest('section') as HTMLElement | null
    expect(architectureRolePanel).not.toBeNull()
    expectFieldSelectValue(
      architectureRolePanel as HTMLElement,
      'Role adjudication',
      'guidance_llm',
    )

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      'Guidance generation',
    )
    expectFieldSelectValue(contextCard, 'Guidance generation', 'summary_llm')
    expect(
      within(contextCard).queryByRole('heading', {
        name: 'Inference profile · summary_llm',
      }),
    ).not.toBeInTheDocument()

    let semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      'Clone review',
    )
    expect(
      within(semanticClonesCard).getByText('Summary mode'),
    ).toBeInTheDocument()
    expect(
      within(semanticClonesCard).getByText('Embedding mode'),
    ).toBeInTheDocument()
    expect(
      within(semanticClonesCard).getByText('ANN neighbors'),
    ).toBeInTheDocument()
    expect(
      within(semanticClonesCard).getByText('Enrichment workers'),
    ).toBeInTheDocument()
    expectFieldSelectValue(semanticClonesCard, 'Clone review', 'local_code')
    expect(
      within(semanticClonesCard).queryByRole('heading', {
        name: 'Inference profile · local_code',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(semanticClonesCard).queryByRole('heading', {
        name: 'Inference runtime · bitloops_local_embeddings',
      }),
    ).not.toBeInTheDocument()

    let knowledgeCard = screen.getByTestId(
      'capability-pack-card-knowledge-pack',
    )
    knowledgeCard = await ensurePackExpanded(user, knowledgeCard, 'GitHub')
    expect(
      within(knowledgeCard).getByRole('button', { name: 'GitHub' }),
    ).toBeInTheDocument()
    expect(
      within(knowledgeCard).getByDisplayValue('${GITHUB_TOKEN}'),
    ).toBeInTheDocument()
    await user.click(
      within(knowledgeCard).getByRole('button', { name: 'Atlassian' }),
    )
    expect(
      within(knowledgeCard).getByDisplayValue('https://example.atlassian.net'),
    ).toBeInTheDocument()
    expect(
      within(knowledgeCard).getByDisplayValue('${ATLASSIAN_EMAIL}'),
    ).toBeInTheDocument()
    expect(
      within(knowledgeCard).getByDisplayValue('${ATLASSIAN_TOKEN}'),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('capability-pack-card-test-harness'),
    ).not.toBeInTheDocument()
  })

  it('shows capability packs from the backend snapshot shape even when config arrives as JSON sections', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Advanced config section supplied by the runtime.',
            10_000,
            [
              jsonField(['architecture'], 'Architecture', {
                inference: {
                  fact_synthesis: 'summary_llm',
                  role_adjudication: 'guidance_llm',
                },
              }),
            ],
            {
              advanced: true,
              value: {
                inference: {
                  fact_synthesis: 'summary_llm',
                  role_adjudication: 'guidance_llm',
                },
              },
              effectiveValue: {
                inference: {
                  fact_synthesis: 'summary_llm',
                  role_adjudication: 'guidance_llm',
                },
              },
            },
          ),
          section(
            'context_guidance',
            'Context Guidance',
            'Advanced config section supplied by the runtime.',
            10_000,
            [
              jsonField(['context_guidance'], 'Context Guidance', {
                inference: {
                  guidance_generation: 'guidance_llm',
                },
              }),
            ],
            {
              advanced: true,
              value: {
                inference: {
                  guidance_generation: 'guidance_llm',
                },
              },
              effectiveValue: {
                inference: {
                  guidance_generation: 'guidance_llm',
                },
              },
            },
          ),
          section(
            'semantic_clones',
            'Semantic clones',
            'Semantic clone enrichment settings.',
            50,
            [
              field(
                ['semantic_clones', 'summary_mode'],
                'Summary mode',
                'auto',
              ),
              field(['semantic_clones', 'ann_neighbors'], 'ANN neighbours', 5),
              field(
                ['semantic_clones', 'enrichment_workers'],
                'Enrichment workers',
                1,
              ),
            ],
            {
              value: {
                summary_mode: 'auto',
                ann_neighbors: 5,
                enrichment_workers: 1,
                inference: {
                  summary_generation: 'summary_llm',
                },
              },
              effectiveValue: {
                summary_mode: 'auto',
                ann_neighbors: 5,
                enrichment_workers: 1,
                inference: {
                  summary_generation: 'summary_llm',
                },
              },
            },
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['knowledge', 'providers'], 'Knowledge providers', {
                github: { token: '${GITHUB_TOKEN}' },
                atlassian: {
                  site_url: 'https://example.atlassian.net',
                  email: '${ATLASSIAN_EMAIL}',
                  token: '${ATLASSIAN_TOKEN}',
                },
              }),
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  bitloops_inference: {
                    command:
                      '/Users/alex/Library/Application Support/bitloops/tools/bitloops-inference/bitloops-inference',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                  bitloops_local_embeddings: {
                    command:
                      '/Users/alex/Library/Application Support/bitloops/tools/bitloops-local-embeddings/bitloops-local-embeddings',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                },
                profiles: {
                  summary_llm: {
                    task: 'text_generation',
                    driver: 'openai_chat_completions',
                    runtime: 'bitloops_inference',
                    model: 'gpt-5.4-mini',
                    api_key: '${OPENAI_API_KEY}',
                    base_url: 'https://api.openai.com/v1/chat/completions',
                    temperature: '0.1',
                    max_output_tokens: 200,
                  },
                  guidance_llm: {
                    task: 'text_generation',
                    driver: 'bitloops_platform_chat',
                    runtime: 'bitloops_inference',
                    model: 'ministral-3-3b-instruct',
                    api_key: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
                    temperature: '0.1',
                    max_output_tokens: 4096,
                  },
                },
              }),
            ],
            {
              value: {
                providers: {
                  github: { token: '${GITHUB_TOKEN}' },
                  atlassian: {
                    site_url: 'https://example.atlassian.net',
                    email: '${ATLASSIAN_EMAIL}',
                    token: '${ATLASSIAN_TOKEN}',
                  },
                },
              },
              effectiveValue: {
                providers: {
                  github: { token: '${GITHUB_TOKEN}' },
                  atlassian: {
                    site_url: 'https://example.atlassian.net',
                    email: '${ATLASSIAN_EMAIL}',
                    token: '${ATLASSIAN_TOKEN}',
                  },
                },
              },
            },
          ),
          section(
            'test_harness',
            'Test Harness',
            'Advanced config section supplied by the runtime.',
            10_000,
            [
              jsonField(['test_harness'], 'Test Harness', {
                coverage_adapter: 'llvm-cov',
                test_discovery_adapter: 'cargo-test',
                language_support: 'rust',
                dependencies: {
                  coverage_adapter: true,
                  test_discovery_adapter: true,
                  language_support: true,
                },
                coverage: {
                  format: 'lcov',
                },
              }),
            ],
            {
              advanced: true,
              value: {
                coverage_adapter: 'llvm-cov',
                test_discovery_adapter: 'cargo-test',
                language_support: 'rust',
                dependencies: {
                  coverage_adapter: true,
                  test_discovery_adapter: true,
                  language_support: true,
                },
                coverage: {
                  format: 'lcov',
                },
              },
              effectiveValue: {
                coverage_adapter: 'llvm-cov',
                test_discovery_adapter: 'cargo-test',
                language_support: 'rust',
                dependencies: {
                  coverage_adapter: true,
                  test_discovery_adapter: true,
                  language_support: true,
                },
                coverage: {
                  format: 'lcov',
                },
              },
            },
          ),
          section('stores', 'Stores', 'Local storage backend paths.', 40, [
            field(
              ['stores', 'relational', 'sqlite_path'],
              'SQLite path',
              'bitloops.sqlite',
            ),
          ]),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Fact synthesis',
    )
    expectFieldSelectValue(architectureCard, 'Fact synthesis', 'summary_llm')
    const inferencePanel = await screen.findByTestId('inference-config-panel')
    const summaryProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · summary_llm',
    )
    expect(
      within(summaryProfile).getByDisplayValue('gpt-5.4-mini'),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      'Guidance generation',
    )
    expect(
      within(contextCard).getAllByText('Guidance generation')[0],
    ).toBeInTheDocument()

    let semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      /Summary generation/,
    )
    expect(
      within(semanticClonesCard).getAllByText('Summary generation')[0],
    ).toBeInTheDocument()

    expect(
      screen.queryByTestId('capability-pack-card-test-harness'),
    ).not.toBeInTheDocument()
  })

  it('seeds visible capability packs when the backend omits those sections entirely', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'semantic_clones',
            'Semantic clones',
            'Semantic clone enrichment settings.',
            50,
            [
              field(
                ['semantic_clones', 'summary_mode'],
                'Summary mode',
                'auto',
              ),
              field(
                ['semantic_clones', 'embedding_mode'],
                'Embedding mode',
                'semantic_aware_once',
              ),
            ],
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['knowledge', 'providers'], 'Knowledge providers', {
                github: { token: '${GITHUB_TOKEN}' },
              }),
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  bitloops_inference: {
                    command: '/tmp/bitloops-inference',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                },
                profiles: {
                  summary_llm: {
                    task: 'text_generation',
                    driver: 'openai_chat_completions',
                    runtime: 'bitloops_inference',
                    model: 'gpt-5.4-mini',
                  },
                },
              }),
            ],
          ),
          section('stores', 'Stores', 'Local storage backend paths.', 40, [
            field(
              ['stores', 'relational', 'sqlite_path'],
              'SQLite path',
              'bitloops.sqlite',
            ),
          ]),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    expect(
      await screen.findByTestId('capability-pack-card-architecture-graph'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('capability-pack-card-context-guidance'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('capability-pack-card-semantic-clones'),
    ).toBeInTheDocument()
    expect(
      screen.getByTestId('capability-pack-card-knowledge-pack'),
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('capability-pack-card-test-harness'),
    ).not.toBeInTheDocument()

    let architectureCard = screen.getByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Role adjudication',
    )
    const architectureRolePanel = within(architectureCard)
      .getByRole('heading', { name: 'Role adjudication' })
      .closest('section')
    expect(architectureRolePanel).not.toBeNull()
    expectFieldSelectValue(
      architectureRolePanel as HTMLElement,
      'Role adjudication',
      'architecture_role_adjudication',
    )
    expect(
      within(architectureRolePanel as HTMLElement).queryByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      }),
    ).not.toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      'Guidance generation',
    )
    expect(within(contextCard).getByText('guidance_llm')).toBeInTheDocument()
    expect(
      within(contextCard).queryByRole('heading', {
        name: 'Inference profile · guidance_llm',
      }),
    ).not.toBeInTheDocument()
  })

  it('backfills blank architecture and guidance bindings with the recommended profiles', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'fact_synthesis'],
                'Fact synthesis',
                '',
              ),
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                '',
              ),
            ],
          ),
          section(
            'context_guidance',
            'Context Guidance',
            'Guidance configuration.',
            6,
            [
              field(
                ['context_guidance', 'inference', 'guidance_generation'],
                'Guidance generation',
                '',
              ),
            ],
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['knowledge', 'providers'], 'Knowledge providers', {
                github: { token: '${GITHUB_TOKEN}' },
              }),
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  bitloops_inference: {
                    command: '/tmp/bitloops-inference',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                  codex: {
                    command: 'codex',
                    args: ['--ask-for-approval', 'never'],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 900,
                  },
                },
                profiles: {
                  architecture_fact_synthesis_codex: {
                    task: 'structured_generation',
                    driver: 'codex_exec',
                    runtime: 'codex',
                    model: 'gpt-5.4-mini',
                    temperature: '0.1',
                    max_output_tokens: 4096,
                    thinking_level: 'high',
                  },
                  architecture_role_adjudication_codex: {
                    task: 'structured_generation',
                    driver: 'codex_exec',
                    runtime: 'codex',
                    model: 'gpt-5.4-mini',
                    temperature: '0.1',
                    max_output_tokens: 1024,
                    thinking_level: 'high',
                  },
                  guidance_llm: {
                    task: 'text_generation',
                    runtime: 'bitloops_inference',
                    driver: 'bitloops_platform_chat',
                    model: 'ministral-3-3b-instruct',
                    api_key: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
                    temperature: '0.1',
                    max_output_tokens: 4096,
                  },
                },
              }),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Role adjudication',
    )
    const architectureFactPanel = within(architectureCard)
      .getByRole('heading', { name: 'Fact synthesis' })
      .closest('section') as HTMLElement | null
    expect(architectureFactPanel).not.toBeNull()
    const architectureFactRow = fieldRowByLabel(
      architectureFactPanel as HTMLElement,
      'Fact synthesis',
    )
    expect(architectureFactRow).not.toBeNull()
    expect(
      within(architectureFactRow as HTMLElement).getByRole('combobox'),
    ).toBeInTheDocument()
    const architectureRolePanel = within(architectureCard)
      .getByRole('heading', { name: 'Role adjudication' })
      .closest('section') as HTMLElement | null
    expect(architectureRolePanel).not.toBeNull()
    const architectureRoleRow = fieldRowByLabel(
      architectureRolePanel as HTMLElement,
      'Role adjudication',
    )
    expect(architectureRoleRow).not.toBeNull()
    expect(
      within(architectureRoleRow as HTMLElement).getByRole('combobox'),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).getByText('architecture_fact_synthesis'),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).queryByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      }),
    ).not.toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      'Guidance generation',
    )
    expect(within(contextCard).getByText('guidance_llm')).toBeInTheDocument()
    expect(
      within(contextCard).queryByRole('heading', {
        name: 'Inference profile · guidance_llm',
      }),
    ).not.toBeInTheDocument()
  })

  it('renders structured-generation driver, runtime, and thinking level as selects with supported options', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                'architecture_role_adjudication_codex',
              ),
            ],
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['knowledge', 'providers'], 'Knowledge providers', {
                github: { token: '${GITHUB_TOKEN}' },
              }),
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  bitloops_inference: {
                    command: '/tmp/bitloops-inference',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                  codex: {
                    command: 'codex',
                    args: ['--ask-for-approval', 'never'],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 900,
                  },
                  claude: {
                    command: 'claude',
                    args: [],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 900,
                  },
                },
                profiles: {
                  architecture_role_adjudication_codex: {
                    task: 'structured_generation',
                    driver: 'codex_exec',
                    runtime: 'codex',
                    model: 'gpt-5.4-mini',
                    temperature: '0.1',
                    max_output_tokens: 1024,
                    thinking_level: 'high',
                  },
                },
              }),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const profilePanel = sectionByHeading(
      await screen.findByTestId('inference-config-panel'),
      'Inference profile · architecture_role_adjudication_codex',
    )

    const taskSelect = expectFieldSelectValue(
      profilePanel,
      'Task',
      'structured_generation',
    )
    expect(taskSelect).toBeInTheDocument()

    const driverSelect = expectFieldSelectValue(profilePanel, 'Driver', 'codex')
    expect(
      within(
        fieldRowByLabel(profilePanel, 'Driver') as HTMLElement,
      ).queryByRole('textbox'),
    ).not.toBeInTheDocument()
    await user.click(driverSelect)
    expect(
      await screen.findByRole('option', { name: 'codex' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'claude' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'codex_exec' })).toBeNull()
    expect(
      screen.queryByRole('option', { name: 'claude_code_print' }),
    ).toBeNull()
    await user.click(screen.getByRole('option', { name: 'codex' }))

    const runtimeSelect = expectFieldSelectValue(
      profilePanel,
      'Runtime',
      'codex',
    )
    expect(
      within(
        fieldRowByLabel(profilePanel, 'Runtime') as HTMLElement,
      ).queryByRole('textbox'),
    ).not.toBeInTheDocument()
    await user.click(runtimeSelect)
    expect(
      await screen.findByRole('option', { name: 'codex' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'claude' })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'bitloops_inference' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'codex' }))

    const thinkingSelect = expectFieldSelectValue(
      profilePanel,
      'Thinking level',
      'high',
    )
    expect(
      within(
        fieldRowByLabel(profilePanel, 'Thinking level') as HTMLElement,
      ).queryByRole('textbox'),
    ).not.toBeInTheDocument()
    await user.click(thinkingSelect)
    expect(
      await screen.findByRole('option', { name: 'low' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'medium' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'high' })).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'extra_high' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'xhigh' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'max' })).toBeNull()
    await user.click(screen.getByRole('option', { name: 'high' }))
  })

  it('deduplicates task aliases and keeps driver-specific thinking levels from the inference reference', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                'architecture_role_adjudication',
              ),
            ],
          ),
          section(
            'context_guidance',
            'Context Guidance',
            'Guidance configuration.',
            6,
            [
              field(
                ['context_guidance', 'inference', 'guidance_generation'],
                'Guidance generation',
                'guidance_llm',
              ),
            ],
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  bitloops_inference: {
                    command: 'bitloops-inference',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                  claude: {
                    command: 'claude',
                    args: [],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 300,
                  },
                },
                profiles: {
                  guidance_llm: {
                    task: 'text-generation',
                    runtime: 'bitloops_inference',
                    driver: 'openai_chat_completions',
                    model: 'gpt-4.1-mini',
                    base_url: 'https://api.openai.com/v1/chat/completions',
                    temperature: '0.1',
                    max_output_tokens: 200,
                  },
                  architecture_role_adjudication: {
                    task: 'structured-generation',
                    driver: 'claude_code_print',
                    runtime: 'claude',
                    model: 'claude-opus-4-7',
                    temperature: '0.1',
                    max_output_tokens: 4096,
                    thinking_level: 'max',
                  },
                },
              }),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    const guidanceProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · guidance_llm',
    )
    const textTaskSelect = expectFieldSelectValue(
      guidanceProfile,
      'Task',
      'text_generation',
    )
    await user.click(textTaskSelect)
    expect(
      await screen.findByRole('option', { name: 'text_generation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'structured_generation' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'text-generation' })).toBeNull()
    expect(
      screen.queryByRole('option', { name: 'structured-generation' }),
    ).toBeNull()
    await user.click(screen.getByRole('option', { name: 'text_generation' }))

    const textDriverSelect = expectFieldSelectValue(
      guidanceProfile,
      'Driver',
      'openai_chat_completions',
    )
    await user.click(textDriverSelect)
    expect(
      await screen.findByRole('option', { name: 'openai_chat_completions' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'bitloops_platform_chat' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'ollama_chat' }),
    ).toBeInTheDocument()
    await user.click(
      screen.getByRole('option', { name: 'openai_chat_completions' }),
    )

    const architectureProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · architecture_role_adjudication',
    )
    const architectureDriverSelect = expectFieldSelectValue(
      architectureProfile,
      'Driver',
      'claude',
    )
    await user.click(architectureDriverSelect)
    expect(
      await screen.findByRole('option', { name: 'codex' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'claude' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'codex_exec' })).toBeNull()
    expect(
      screen.queryByRole('option', { name: 'claude_code_print' }),
    ).toBeNull()
    await user.click(screen.getByRole('option', { name: 'claude' }))

    const architectureTaskSelect = expectFieldSelectValue(
      architectureProfile,
      'Task',
      'structured_generation',
    )
    await user.click(architectureTaskSelect)
    expect(
      await screen.findByRole('option', { name: 'structured_generation' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'structured-generation' }),
    ).toBeNull()
    await user.click(
      screen.getByRole('option', { name: 'structured_generation' }),
    )

    const claudeThinkingSelect = expectFieldSelectValue(
      architectureProfile,
      'Thinking level',
      'max',
    )
    await user.click(claudeThinkingSelect)
    expect(
      await screen.findByRole('option', { name: 'low' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'medium' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'high' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'xhigh' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'max' })).toBeInTheDocument()
    expect(screen.queryByRole('option', { name: 'extra_high' })).toBeNull()
    await user.click(screen.getByRole('option', { name: 'max' }))
  })

  it('adds Codex and Claude runtime defaults when saved profiles reference scaffolded runtimes', async () => {
    const user = userEvent.setup()
    const initialSections = [
      section(
        'architecture',
        'Architecture',
        'Architecture graph configuration.',
        5,
        [
          field(
            ['architecture', 'inference', 'fact_synthesis'],
            'Fact synthesis',
            'architecture_fact_synthesis',
          ),
          field(
            ['architecture', 'inference', 'role_adjudication'],
            'Role adjudication',
            'architecture_role_adjudication',
          ),
        ],
      ),
      section(
        'inference_profiles',
        'Inference profiles',
        'Reusable inference profile definitions',
        10,
        [
          field(
            ['inference', 'profiles', 'architecture_fact_synthesis', 'task'],
            'Task',
            'structured_generation',
          ),
          field(
            ['inference', 'profiles', 'architecture_fact_synthesis', 'driver'],
            'Driver',
            '',
          ),
          field(
            ['inference', 'profiles', 'architecture_fact_synthesis', 'runtime'],
            'Runtime',
            '',
          ),
          field(
            ['inference', 'profiles', 'architecture_fact_synthesis', 'model'],
            'Model',
            '',
          ),
          field(
            ['inference', 'profiles', 'architecture_role_adjudication', 'task'],
            'Task',
            'structured_generation',
          ),
          field(
            [
              'inference',
              'profiles',
              'architecture_role_adjudication',
              'driver',
            ],
            'Driver',
            '',
          ),
          field(
            [
              'inference',
              'profiles',
              'architecture_role_adjudication',
              'runtime',
            ],
            'Runtime',
            '',
          ),
          field(
            [
              'inference',
              'profiles',
              'architecture_role_adjudication',
              'model',
            ],
            'Model',
            '',
          ),
        ],
      ),
    ]
    const savedPatches = [
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'driver',
        ],
        value: 'codex_exec',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'runtime',
        ],
        value: 'codex',
      },
      {
        path: ['inference', 'profiles', 'architecture_fact_synthesis', 'model'],
        value: 'gpt-5.4-mini',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'driver',
        ],
        value: 'claude_code_print',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'runtime',
        ],
        value: 'claude',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'model',
        ],
        value: 'claude-opus-4-7',
      },
      {
        path: ['inference', 'runtimes', 'codex', 'command'],
        value: 'codex',
      },
      {
        path: ['inference', 'runtimes', 'codex', 'args'],
        value: ['--ask-for-approval', 'never'],
      },
      {
        path: ['inference', 'runtimes', 'codex', 'startup_timeout_secs'],
        value: 5,
      },
      {
        path: ['inference', 'runtimes', 'codex', 'request_timeout_secs'],
        value: 300,
      },
      {
        path: ['inference', 'runtimes', 'claude', 'command'],
        value: 'claude',
      },
      {
        path: ['inference', 'runtimes', 'claude', 'args'],
        value: [],
      },
      {
        path: ['inference', 'runtimes', 'claude', 'startup_timeout_secs'],
        value: 5,
      },
      {
        path: ['inference', 'runtimes', 'claude', 'request_timeout_secs'],
        value: 300,
      },
    ]

    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({ sections: initialSections }),
    )
    vi.mocked(updateRuntimeConfig).mockImplementationOnce(async ({ patches }) =>
      snapshot({
        revision: 'rev-2',
        sections: [
          section(
            'saved',
            'Saved config',
            'Saved config values.',
            10,
            patches
              .filter((patch) => patch.unset !== true)
              .map((patch) =>
                field(
                  patch.path,
                  patch.path[patch.path.length - 1] ?? 'Value',
                  patch.value,
                ),
              ),
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    const factProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · architecture_fact_synthesis',
    )
    await chooseFieldOption(user, factProfile, 'Driver', 'codex_exec')

    const roleProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · architecture_role_adjudication',
    )
    await chooseFieldOption(user, roleProfile, 'Driver', 'claude_code_print')

    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: expect.arrayContaining(savedPatches),
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('adds default Architecture graph profile tools and local runtimes when enabling the pack', async () => {
    const user = userEvent.setup()
    const expectedRuntimePatches = [
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'driver',
        ],
        value: 'codex_exec',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'runtime',
        ],
        value: 'codex',
      },
      {
        path: ['inference', 'profiles', 'architecture_fact_synthesis', 'model'],
        value: 'gpt-5.4-mini',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'driver',
        ],
        value: 'claude_code_print',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'runtime',
        ],
        value: 'claude',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'model',
        ],
        value: 'claude-opus-4-7',
      },
      {
        path: ['inference', 'runtimes', 'codex', 'command'],
        value: 'codex',
      },
      {
        path: ['inference', 'runtimes', 'claude', 'command'],
        value: 'claude',
      },
    ]
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({ sections: [] }),
    )
    vi.mocked(updateRuntimeConfig).mockImplementationOnce(async ({ patches }) =>
      snapshot({
        revision: 'rev-2',
        sections: [
          section(
            'saved',
            'Saved config',
            'Saved config values.',
            10,
            patches
              .filter((patch) => patch.unset !== true)
              .map((patch) =>
                field(
                  patch.path,
                  patch.path[patch.path.length - 1] ?? 'Value',
                  patch.value,
                ),
              ),
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    await enablePack(user, 'architecture-graph', 'Architecture graph')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: expect.arrayContaining([
        {
          path: ['architecture', 'inference', 'fact_synthesis'],
          value: 'architecture_fact_synthesis',
        },
        {
          path: ['architecture', 'inference', 'role_adjudication'],
          value: 'architecture_role_adjudication',
        },
        ...expectedRuntimePatches,
      ]),
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('does not overwrite explicit blank backend runtime fields with supplemental defaults', async () => {
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                'architecture_role_adjudication_codex',
              ),
            ],
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  codex: {
                    command: '',
                    args: [],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 900,
                  },
                },
                profiles: {
                  architecture_role_adjudication_codex: {
                    task: 'structured_generation',
                    driver: 'codex_exec',
                    runtime: 'codex',
                    model: 'gpt-5.4-mini',
                    temperature: '0.1',
                    max_output_tokens: 1024,
                    thinking_level: 'high',
                  },
                },
              }),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const runtimePanel = sectionByHeading(
      await screen.findByTestId('inference-config-panel'),
      'Inference runtime · codex',
    )
    const commandRow = fieldRowByLabel(runtimePanel, 'Command')
    expect(commandRow).not.toBeNull()
    expect(within(commandRow as HTMLElement).getByRole('textbox')).toHaveValue(
      '',
    )
  })

  it('scaffolds selectable Claude runtimes with the resolved executable path and reference request timeout', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeExecutableResolutions).mockResolvedValueOnce([
      {
        command: 'claude',
        path: '/opt/homebrew/bin/claude',
        found: true,
      },
    ])
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                '',
              ),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    const profilePanel = sectionByHeading(
      inferencePanel,
      'Inference profile · architecture_role_adjudication',
    )

    await chooseFieldOption(user, profilePanel, 'Runtime', 'claude')

    const runtimePanel = sectionByHeading(
      inferencePanel,
      'Inference runtime · claude',
    )
    expect(within(runtimePanel).getByDisplayValue('claude')).toBeInTheDocument()
    expect(
      within(runtimePanel).getByText(
        'Resolved executable: /opt/homebrew/bin/claude',
      ),
    ).toBeInTheDocument()
    expect(within(runtimePanel).getByDisplayValue('300')).toBeInTheDocument()
  })

  it('deduplicates inference profile fields that arrive in both expanded and JSON backend shapes', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                'architecture_role_adjudication',
              ),
            ],
          ),
          section(
            'inference_profiles',
            'Inference profiles',
            'Reusable inference profile definitions',
            10,
            [
              field(
                [
                  'inference',
                  'profiles',
                  'architecture_role_adjudication',
                  'task',
                ],
                'Task',
                'structured_generation',
              ),
              field(
                [
                  'inference',
                  'profiles',
                  'architecture_role_adjudication',
                  'runtime',
                ],
                'Runtime',
                'codex',
              ),
            ],
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['inference'], 'Inference', {
                profiles: {
                  architecture_role_adjudication: {
                    task: 'structured_generation',
                    runtime: 'codex',
                  },
                },
                runtimes: {
                  codex: {
                    command: 'codex',
                    args: [],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 1800,
                  },
                },
              }),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    const profilePanel = sectionByHeading(
      inferencePanel,
      'Inference profile · architecture_role_adjudication',
    )
    expect(within(profilePanel).getAllByText('Task')).toHaveLength(1)
    expect(within(profilePanel).getAllByText('Runtime')).toHaveLength(1)

    let architectureCard = screen.getByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Role adjudication',
    )
    expect(
      within(architectureCard).queryByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      }),
    ).not.toBeInTheDocument()
  })

  it('scaffolds the requested platform inference profiles', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'fact_synthesis'],
                'Fact synthesis',
                'summary_llm',
              ),
            ],
          ),
          section(
            'context_guidance',
            'Context Guidance',
            'Guidance configuration.',
            6,
            [
              field(
                ['context_guidance', 'inference', 'guidance_generation'],
                'Guidance generation',
                'guidance_llm',
              ),
            ],
          ),
          section(
            'semantic_clones',
            'Semantic clones',
            'Semantic clone detection settings',
            7,
            [
              field(
                ['semantic_clones', 'inference', 'clone_review'],
                'Clone review',
                'platform_code',
              ),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    const summaryProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · summary_llm',
    )
    expectFieldSelectValue(summaryProfile, 'Driver', 'bitloops_platform_chat')
    expect(
      within(summaryProfile).getByDisplayValue('ministral-3-3b-instruct'),
    ).toBeInTheDocument()
    expect(
      within(summaryProfile).getByDisplayValue(
        'https://platform.bitloops.net/v1/chat/completions',
      ),
    ).toBeInTheDocument()
    expect(
      within(summaryProfile).getByDisplayValue(
        '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
      ),
    ).toBeInTheDocument()
    expect(within(summaryProfile).getByDisplayValue('200')).toBeInTheDocument()

    const guidanceProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · guidance_llm',
    )
    expect(
      within(guidanceProfile).getByDisplayValue('124096'),
    ).toBeInTheDocument()

    let semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      /Clone review/,
    )
    expectFieldSelectValue(semanticClonesCard, 'Clone review', 'platform_code')
    expect(
      within(inferencePanel).queryByRole('heading', {
        name: 'Inference profile · platform_code',
      }),
    ).not.toBeInTheDocument()
    expect(
      within(inferencePanel).queryByText('embeddings'),
    ).not.toBeInTheDocument()
    expect(
      within(inferencePanel).queryByText('bitloops_embeddings_ipc'),
    ).not.toBeInTheDocument()
  })

  it('selects default models when switching structured generation tools', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                'architecture_role_adjudication',
              ),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const profilePanel = sectionByHeading(
      await screen.findByTestId('inference-config-panel'),
      'Inference profile · architecture_role_adjudication',
    )

    await chooseFieldOption(user, profilePanel, 'Driver', 'codex_exec')
    expectFieldSelectValue(profilePanel, 'Runtime', 'codex')
    expect(
      within(profilePanel).getByDisplayValue('gpt-5.4-mini'),
    ).toBeInTheDocument()

    await chooseFieldOption(user, profilePanel, 'Driver', 'claude_code_print')
    expectFieldSelectValue(profilePanel, 'Runtime', 'claude')
    expect(
      within(profilePanel).getByDisplayValue('claude-opus-4-7'),
    ).toBeInTheDocument()
  })

  it('renders structured generation architecture profiles and guidance profiles from the exact backend inference json', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({
        sections: [
          section(
            'architecture',
            'Architecture',
            'Architecture graph configuration.',
            5,
            [
              field(
                ['architecture', 'inference', 'role_adjudication'],
                'Role adjudication',
                'architecture_role_adjudication_codex',
              ),
            ],
          ),
          section(
            'context_guidance',
            'Context Guidance',
            'Guidance configuration.',
            6,
            [
              field(
                ['context_guidance', 'inference', 'guidance_generation'],
                'Guidance generation',
                'guidance_llm',
              ),
            ],
          ),
          section(
            'knowledge',
            'Providers and inference',
            'Provider and inference configuration.',
            70,
            [
              jsonField(['knowledge', 'providers'], 'Knowledge providers', {
                github: { token: '${GITHUB_TOKEN}' },
              }),
              jsonField(['inference'], 'Inference', {
                runtimes: {
                  bitloops_inference: {
                    command:
                      '/Users/alex/Library/Application Support/bitloops/tools/bitloops-inference/bitloops-inference',
                    args: [],
                    startup_timeout_secs: 60,
                    request_timeout_secs: 300,
                  },
                  codex: {
                    command: 'codex',
                    args: ['--ask-for-approval', 'never'],
                    startup_timeout_secs: 5,
                    request_timeout_secs: 900,
                  },
                },
                profiles: {
                  architecture_role_adjudication_codex: {
                    task: 'structured_generation',
                    driver: 'codex_exec',
                    runtime: 'codex',
                    model: 'gpt-5.4-mini',
                    temperature: '0.1',
                    max_output_tokens: 1024,
                    thinking_level: 'high',
                  },
                  guidance_llm: {
                    task: 'text_generation',
                    runtime: 'bitloops_inference',
                    driver: 'bitloops_platform_chat',
                    model: 'ministral-3-3b-instruct',
                    api_key: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
                    temperature: '0.1',
                    max_output_tokens: 4096,
                  },
                },
              }),
            ],
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Role adjudication',
    )
    const architectureRolePanel = within(architectureCard)
      .getByRole('heading', { name: 'Role adjudication' })
      .closest('section')
    expect(architectureRolePanel).not.toBeNull()
    expectFieldSelectValue(
      architectureRolePanel as HTMLElement,
      'Role adjudication',
      'architecture_role_adjudication_codex',
    )
    expect(
      within(architectureRolePanel as HTMLElement).queryByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication_codex',
      }),
    ).not.toBeInTheDocument()
    const architectureProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · architecture_role_adjudication_codex',
    )
    expectFieldSelectValue(architectureProfile, 'Task', 'structured_generation')
    expectFieldSelectValue(architectureProfile, 'Driver', 'codex_exec')
    expectFieldSelectValue(architectureProfile, 'Thinking level', 'high')
    expect(
      within(inferencePanel).getByRole('heading', {
        name: 'Inference runtime · codex',
      }),
    ).toBeInTheDocument()
    expectFieldSelectValue(architectureProfile, 'Runtime', 'codex')
    expect(
      within(inferencePanel).getByDisplayValue('codex'),
    ).toBeInTheDocument()
    expect(
      within(inferencePanel).getByDisplayValue(/--ask-for-approval/),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      'Guidance generation',
    )
    expect(
      within(contextCard).queryByRole('heading', {
        name: 'Inference profile · guidance_llm',
      }),
    ).not.toBeInTheDocument()
    const guidanceProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · guidance_llm',
    )
    expectFieldSelectValue(guidanceProfile, 'Task', 'text_generation')
    expectFieldSelectValue(guidanceProfile, 'Driver', 'bitloops_platform_chat')
    expect(
      within(guidanceProfile).getByDisplayValue('ministral-3-3b-instruct'),
    ).toBeInTheDocument()
    expect(
      within(guidanceProfile).getByDisplayValue(
        '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
      ),
    ).toBeInTheDocument()
  })

  it('keeps shared inference blocks editable in the strict inference panel only', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const inferencePanel = await screen.findByTestId('inference-config-panel')
    const sharedProfile = sectionByHeading(
      inferencePanel,
      'Inference profile · summary_llm',
    )
    expect(
      expectFieldSelectValue(sharedProfile, 'Runtime', 'bitloops_inference'),
    ).toBeEnabled()

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Fact synthesis',
    )
    expectFieldSelectValue(architectureCard, 'Fact synthesis', 'summary_llm')
    expect(
      within(architectureCard).queryByRole('heading', {
        name: 'Inference profile · summary_llm',
      }),
    ).not.toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      'Guidance generation',
    )
    expectFieldSelectValue(contextCard, 'Guidance generation', 'summary_llm')
    expect(
      within(contextCard).queryByText(
        'Shared with Architecture graph. Edit there.',
      ),
    ).not.toBeInTheDocument()
  })

  it('removes the duplicate lower runtime config area entirely', async () => {
    render(<SettingsConfiguration />)

    await screen.findByTestId('capability-pack-card-knowledge-pack')
    expect(
      screen.queryByRole('heading', { name: 'Advanced runtime config' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Daemon config')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Save runtime config' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('runtime-config-sections'),
    ).not.toBeInTheDocument()
  })

  it('opens a review sheet without backend blocker copy', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      'Fact synthesis',
    )
    let semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      'Summary mode',
    )

    await chooseFieldOption(
      user,
      architectureCard,
      'Fact synthesis',
      'architecture_fact_synthesis',
    )
    const summaryModeInput =
      within(semanticClonesCard).getByDisplayValue('dense')
    await user.clear(summaryModeInput)
    await user.type(summaryModeInput, 'draft')
    await user.click(screen.getByRole('button', { name: 'Review changes' }))

    const reviewPanel = screen.getByTestId('capability-pack-review-panel')
    expect(
      within(reviewPanel).getByRole('heading', {
        name: 'Pack direct config changes',
      }),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).getByRole('heading', {
        name: 'Supporting dependency changes',
      }),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).getByText('Architecture graph · Fact synthesis'),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).getByText('Semantic clones · Summary mode'),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).queryByText('Backend handoff needed'),
    ).not.toBeInTheDocument()
  })

  it('uses the top configuration save action for pack-backed edits', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    let semanticClonesCard = await screen.findByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      'Summary mode',
    )
    const input = within(semanticClonesCard).getByDisplayValue(
      'dense',
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'updated')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['semantic_clones', 'summary_mode'],
          value: 'updated',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'base_url'],
          value: 'https://platform.bitloops.net/v1/chat/completions',
        },
      ],
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('saves changed daemon init setup values to their config paths', async () => {
    const user = userEvent.setup()
    vi.mocked(updateRuntimeConfig).mockResolvedValueOnce(
      snapshot({
        revision: 'rev-2',
        sections: [
          section('dashboard', 'Dashboard', 'Dashboard setup settings', 2, [
            field(
              ['dashboard', 'auto_start_daemon'],
              'Daemon should start automatically',
              true,
            ),
          ]),
          section('telemetry', 'Telemetry', 'Telemetry consent settings', 3, [
            field(['telemetry', 'enabled'], 'Enable telemetry', true),
          ]),
          ...snapshot().sections,
        ],
      }),
    )
    render(<SettingsConfiguration />)

    const repoSetupPanel = await screen.findByTestId('repo-setup-options')
    expect(fieldRowByLabel(repoSetupPanel, 'Sync')).toBeNull()
    expect(fieldRowByLabel(repoSetupPanel, 'Ingest')).toBeNull()
    const daemonSetupPanel = await screen.findByTestId('daemon-setup-options')
    await user.click(
      expectFieldCheckbox(
        daemonSetupPanel,
        'Daemon should start automatically',
      ),
    )
    await user.click(expectFieldCheckbox(daemonSetupPanel, 'Enable telemetry'))
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['dashboard', 'auto_start_daemon'],
          value: true,
        },
        {
          path: ['telemetry', 'enabled'],
          value: true,
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'base_url'],
          value: 'https://platform.bitloops.net/v1/chat/completions',
        },
      ],
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('saves changed repo init setup values to the repo policy target', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchRuntimeConfigTargets).mockResolvedValueOnce([
      target,
      repoTarget,
    ])
    vi.mocked(fetchRuntimeConfigSnapshot)
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(
        snapshot({
          target: repoTarget,
          revision: 'repo-rev-1',
          sections: [
            section('devql', 'DevQL', 'DevQL producer settings', 1, []),
          ],
        }),
      )
    vi.mocked(updateRuntimeConfig).mockResolvedValueOnce(
      snapshot({
        target: repoTarget,
        revision: 'repo-rev-2',
        sections: [
          section('devql', 'DevQL', 'DevQL producer settings', 1, [
            field(['devql', 'sync_enabled'], 'Sync', true),
            field(['devql', 'ingest_enabled'], 'Ingest', true),
          ]),
        ],
      }),
    )
    render(<SettingsConfiguration />)

    let repoSetupPanel = await screen.findByTestId('repo-setup-options')
    await user.selectOptions(
      within(repoSetupPanel).getByLabelText('Repository'),
      'target-repo-local',
    )
    await waitFor(() =>
      expect(fetchRuntimeConfigSnapshot).toHaveBeenLastCalledWith(
        'target-repo-local',
        expect.any(Object),
      ),
    )
    await waitFor(() =>
      expect(
        expectFieldCheckbox(screen.getByTestId('repo-setup-options'), 'Sync'),
      ).not.toBeDisabled(),
    )
    repoSetupPanel = screen.getByTestId('repo-setup-options')
    const syncCheckbox = expectFieldCheckbox(repoSetupPanel, 'Sync')
    const ingestCheckbox = expectFieldCheckbox(repoSetupPanel, 'Ingest')
    expect(ingestCheckbox).toBeDisabled()
    await user.click(syncCheckbox)
    expect(ingestCheckbox).toBeEnabled()
    await user.click(ingestCheckbox)
    expect(syncCheckbox).toBeChecked()
    expect(ingestCheckbox).toBeChecked()
    await user.click(syncCheckbox)
    expect(syncCheckbox).not.toBeChecked()
    expect(ingestCheckbox).not.toBeChecked()
    expect(ingestCheckbox).toBeDisabled()
    await user.click(syncCheckbox)
    await user.click(ingestCheckbox)
    const daemonSetupPanel = screen.getByTestId('daemon-setup-options')
    expect(
      expectFieldCheckbox(
        daemonSetupPanel,
        'Daemon should start automatically',
      ),
    ).toBeEnabled()
    expect(
      expectFieldCheckbox(daemonSetupPanel, 'Enable telemetry'),
    ).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-repo-local',
      expectedRevision: 'repo-rev-1',
      patches: [
        {
          path: ['devql', 'sync_enabled'],
          value: true,
        },
        {
          path: ['devql', 'ingest_enabled'],
          value: true,
        },
      ],
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('saves edited inference fields materialized from backend JSON config', async () => {
    const user = userEvent.setup()
    const initialSections = [
      section(
        'context_guidance',
        'Context Guidance',
        'Guidance configuration.',
        6,
        [
          field(
            ['context_guidance', 'inference', 'guidance_generation'],
            'Guidance generation',
            'guidance_llm',
          ),
        ],
      ),
      section(
        'knowledge',
        'Providers and inference',
        'Provider and inference configuration.',
        70,
        [
          jsonField(['inference'], 'Inference', {
            profiles: {
              guidance_llm: {
                task: 'text_generation',
                runtime: 'bitloops_inference',
                driver: 'bitloops_platform_chat',
                model: 'ministral-3-3b-instruct',
                api_key: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
                temperature: '0.1',
                max_output_tokens: 4096,
              },
            },
            runtimes: {
              bitloops_inference: {
                command: 'bitloops-inference',
                args: [],
                startup_timeout_secs: 60,
                request_timeout_secs: 900,
              },
            },
          }),
        ],
      ),
    ]
    const updatedSections = [
      initialSections[0],
      section(
        'knowledge',
        'Providers and inference',
        'Provider and inference configuration.',
        70,
        [
          jsonField(['inference'], 'Inference', {
            profiles: {
              guidance_llm: {
                task: 'text_generation',
                runtime: 'bitloops_inference',
                driver: 'bitloops_platform_chat',
                model: 'ministral-3-3b-instruct',
                api_key: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
                temperature: '0.1',
                max_output_tokens: 124096,
              },
            },
            runtimes: {
              bitloops_inference: {
                command: 'bitloops-inference',
                args: [],
                startup_timeout_secs: 60,
                request_timeout_secs: 900,
              },
            },
          }),
        ],
      ),
    ]
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({ sections: initialSections }),
    )
    vi.mocked(updateRuntimeConfig).mockResolvedValueOnce(
      snapshot({ revision: 'rev-2', sections: updatedSections }),
    )

    render(<SettingsConfiguration />)

    const guidanceProfile = sectionByHeading(
      await screen.findByTestId('inference-config-panel'),
      'Inference profile · guidance_llm',
    )
    const maxTokensRow = fieldRowByLabel(guidanceProfile, 'Max output tokens')
    expect(maxTokensRow).not.toBeNull()
    const maxTokensInput = within(maxTokensRow as HTMLElement).getByRole(
      'spinbutton',
    )
    await user.clear(maxTokensInput)
    await user.type(maxTokensInput, '124096')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['inference', 'profiles', 'guidance_llm', 'max_output_tokens'],
          value: 124096,
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'base_url'],
          value: 'https://platform.bitloops.net/v1/chat/completions',
        },
      ],
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('persists missing default guidance profile fields when saving config changes', async () => {
    const user = userEvent.setup()
    const initialSections = [
      section(
        'context_guidance',
        'Context Guidance',
        'Guidance configuration.',
        6,
        [
          field(
            ['context_guidance', 'inference', 'guidance_generation'],
            'Guidance generation',
            'guidance_llm',
          ),
        ],
      ),
      section('semantic_clones', 'Semantic clones', 'Semantic settings', 12, [
        field(['semantic_clones', 'summary_mode'], 'Summary mode', 'old'),
      ]),
    ]
    const updatedSections = [
      initialSections[0],
      section('semantic_clones', 'Semantic clones', 'Semantic settings', 12, [
        field(['semantic_clones', 'summary_mode'], 'Summary mode', 'new'),
      ]),
      section(
        'inference_profiles',
        'Inference profiles',
        'Reusable inference profile definitions',
        10,
        [
          field(
            ['inference', 'profiles', 'guidance_llm', 'task'],
            'Task',
            'text_generation',
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'driver'],
            'Driver',
            'bitloops_platform_chat',
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'runtime'],
            'Runtime',
            'bitloops_inference',
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'model'],
            'Model',
            'ministral-3-3b-instruct',
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'api_key'],
            'API key',
            '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'base_url'],
            'Base URL',
            'https://platform.bitloops.net/v1/chat/completions',
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'temperature'],
            'Temperature',
            '0.1',
          ),
          field(
            ['inference', 'profiles', 'guidance_llm', 'max_output_tokens'],
            'Max output tokens',
            124096,
          ),
          field(
            ['inference', 'runtimes', 'bitloops_inference', 'command'],
            'Command',
            'bitloops-inference',
          ),
          field(
            ['inference', 'runtimes', 'bitloops_inference', 'args'],
            'Args',
            [],
            { fieldType: 'json' },
          ),
          field(
            [
              'inference',
              'runtimes',
              'bitloops_inference',
              'startup_timeout_secs',
            ],
            'Startup timeout secs',
            60,
          ),
          field(
            [
              'inference',
              'runtimes',
              'bitloops_inference',
              'request_timeout_secs',
            ],
            'Request timeout secs',
            300,
          ),
        ],
      ),
    ]
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({ sections: initialSections }),
    )
    vi.mocked(updateRuntimeConfig).mockResolvedValueOnce(
      snapshot({ revision: 'rev-2', sections: updatedSections }),
    )

    render(<SettingsConfiguration />)

    let semanticClonesCard = await screen.findByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      'Summary mode',
    )
    const input = within(semanticClonesCard).getByDisplayValue(
      'old',
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'new')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: expect.arrayContaining([
        {
          path: ['semantic_clones', 'summary_mode'],
          value: 'new',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'task'],
          value: 'text_generation',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'driver'],
          value: 'bitloops_platform_chat',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'runtime'],
          value: 'bitloops_inference',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'model'],
          value: 'ministral-3-3b-instruct',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'api_key'],
          value: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'base_url'],
          value: 'https://platform.bitloops.net/v1/chat/completions',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'temperature'],
          value: '0.1',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'max_output_tokens'],
          value: 124096,
        },
        {
          path: ['inference', 'runtimes', 'bitloops_inference', 'command'],
          value: 'bitloops-inference',
        },
      ]),
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('saves default guidance and summary inference profiles when enabling their packs', async () => {
    const user = userEvent.setup()
    const expectedPatches = [
      {
        path: ['context_guidance', 'inference', 'guidance_generation'],
        value: 'guidance_llm',
      },
      {
        path: ['semantic_clones', 'summary_mode'],
        value: 'auto',
      },
      {
        path: ['semantic_clones', 'embedding_mode'],
        value: 'semantic_aware_once',
      },
      {
        path: ['semantic_clones', 'ann_neighbors'],
        value: 5,
      },
      {
        path: ['semantic_clones', 'enrichment_workers'],
        value: 1,
      },
      {
        path: ['semantic_clones', 'inference', 'summary_generation'],
        value: 'summary_llm',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'task'],
        value: 'text_generation',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'driver'],
        value: 'bitloops_platform_chat',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'runtime'],
        value: 'bitloops_inference',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'model'],
        value: 'ministral-3-3b-instruct',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'base_url'],
        value: 'https://platform.bitloops.net/v1/chat/completions',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'api_key'],
        value: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'temperature'],
        value: '0.1',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'max_output_tokens'],
        value: 124096,
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'task'],
        value: 'text_generation',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'driver'],
        value: 'bitloops_platform_chat',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'runtime'],
        value: 'bitloops_inference',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'model'],
        value: 'ministral-3-3b-instruct',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'base_url'],
        value: 'https://platform.bitloops.net/v1/chat/completions',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'api_key'],
        value: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'temperature'],
        value: '0.1',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'max_output_tokens'],
        value: 200,
      },
      {
        path: ['inference', 'runtimes', 'bitloops_inference', 'command'],
        value: 'bitloops-inference',
      },
      {
        path: ['inference', 'runtimes', 'bitloops_inference', 'args'],
        value: [],
      },
      {
        path: [
          'inference',
          'runtimes',
          'bitloops_inference',
          'startup_timeout_secs',
        ],
        value: 60,
      },
      {
        path: [
          'inference',
          'runtimes',
          'bitloops_inference',
          'request_timeout_secs',
        ],
        value: 300,
      },
    ]

    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValueOnce(
      snapshot({ sections: [] }),
    )
    vi.mocked(updateRuntimeConfig).mockResolvedValueOnce(
      snapshot({
        revision: 'rev-2',
        sections: [
          section(
            'saved',
            'Saved config',
            'Saved config values.',
            10,
            expectedPatches.map((patch) =>
              field(
                patch.path,
                patch.path[patch.path.length - 1] ?? 'Value',
                patch.value,
              ),
            ),
          ),
        ],
      }),
    )

    render(<SettingsConfiguration />)

    await enablePack(user, 'context-guidance', 'Context Guidance')
    await enablePack(user, 'semantic-clones', 'Semantic clones')
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: expectedPatches,
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('reports a save failure when the returned snapshot does not include the submitted config change', async () => {
    const user = userEvent.setup()
    vi.mocked(updateRuntimeConfig).mockResolvedValueOnce(snapshot())
    render(<SettingsConfiguration />)

    let semanticClonesCard = await screen.findByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      'Summary mode',
    )
    const input = within(semanticClonesCard).getByDisplayValue(
      'dense',
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'updated')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['semantic_clones', 'summary_mode'],
          value: 'updated',
        },
        {
          path: ['inference', 'profiles', 'guidance_llm', 'base_url'],
          value: 'https://platform.bitloops.net/v1/chat/completions',
        },
      ],
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Runtime config save did not change the returned snapshot.',
    )
    expect(screen.queryByText('Runtime config saved.')).not.toBeInTheDocument()
  })
})
