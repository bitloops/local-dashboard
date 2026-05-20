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
        'test_harness',
        'Test harness',
        'Test harness adapters and coverage settings',
        9,
        [
          field(
            ['test_harness', 'coverage_adapter'],
            'Coverage adapter',
            'llvm-cov',
            { order: 0 },
          ),
          field(
            ['test_harness', 'test_discovery_adapter'],
            'Test discovery adapter',
            'cargo-test',
            { order: 1 },
          ),
          field(
            ['test_harness', 'language_support'],
            'Language support',
            'rust',
            { order: 2 },
          ),
          field(
            ['test_harness', 'dependencies', 'coverage'],
            'Coverage dependency',
            true,
            { order: 3 },
          ),
          field(
            ['test_harness', 'dependencies', 'test_discovery'],
            'Test discovery dependency',
            true,
            { order: 4 },
          ),
          field(
            ['test_harness', 'coverage', 'format'],
            'Coverage format',
            'lcov',
            { order: 5 },
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
    vi.clearAllMocks()
    vi.mocked(fetchRuntimeExecutableResolutions).mockResolvedValue([])
    vi.mocked(fetchRuntimeConfigTargets).mockResolvedValue([target])
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValue(snapshot())
    vi.mocked(updateRuntimeConfig).mockResolvedValue(
      snapshot({
        revision: 'rev-2',
        sections: snapshot().sections.map((configSection) => ({
          ...configSection,
          fields: configSection.fields.map((configField) =>
            configField.key === 'stores.relational.sqlite_path'
              ? {
                  ...configField,
                  value: 'updated.sqlite',
                  effectiveValue: 'updated.sqlite',
                }
              : configField,
          ),
        })),
      }),
    )
  })

  it('shows only real visible capability packs and never renders CodeCity', async () => {
    render(<SettingsConfiguration />)

    const cards = await screen.findAllByTestId(/capability-pack-card-/)
    expect(cards).toHaveLength(5)
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
      'Test harness',
    ])
    expect(
      screen.queryByTestId('capability-pack-card-codecity'),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('Render mode')).not.toBeInTheDocument()
  })

  it('expands pack fields without enabling the pack until Enable is clicked', async () => {
    const user = userEvent.setup()
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

  it('does not render raw config paths or duplicate effective values as field help text', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const architectureCard = await ensurePackExpanded(
      user,
      await screen.findByTestId('capability-pack-card-architecture-graph'),
      /Inference profile · summary_llm/,
    )

    expect(
      within(architectureCard).queryByText(
        'inference.profiles.summary_llm.max_output_tokens',
      ),
    ).not.toBeInTheDocument()
    expect(
      within(architectureCard).queryByText('Effective: 200'),
    ).not.toBeInTheDocument()
  })

  it('renders separate repo and daemon setup controls above packs', async () => {
    render(<SettingsConfiguration />)

    const repoSetupPanel = await screen.findByTestId('repo-setup-options')
    expectFieldCheckbox(repoSetupPanel, 'Sync')
    expectFieldCheckbox(repoSetupPanel, 'Ingest')
    expect(
      fieldRowByLabel(repoSetupPanel, 'Daemon should start automatically'),
    ).toBeNull()
    expect(fieldRowByLabel(repoSetupPanel, 'Enable telemetry')).toBeNull()

    const daemonSetupPanel = await screen.findByTestId('daemon-setup-options')
    expectFieldCheckbox(daemonSetupPanel, 'Daemon should start automatically')
    expectFieldCheckbox(daemonSetupPanel, 'Enable telemetry')
    expect(fieldRowByLabel(daemonSetupPanel, 'Sync')).toBeNull()
    expect(fieldRowByLabel(daemonSetupPanel, 'Ingest')).toBeNull()

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

  it('maps architecture, context guidance, semantic clones, knowledge, and test harness fields into their cards', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · summary_llm/,
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
      within(architectureCard).getByRole('heading', {
        name: 'Inference profile · summary_llm',
      }),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).getAllByRole('heading', {
        name: 'Inference runtime · bitloops_inference',
      }),
    ).toHaveLength(2)
    const architectureSummaryProfile = within(
      architectureFactPanel as HTMLElement,
    )
      .getByRole('heading', { name: 'Inference profile · summary_llm' })
      .closest('section') as HTMLElement | null
    expect(architectureSummaryProfile).not.toBeNull()
    expectFieldSelectValue(
      architectureSummaryProfile as HTMLElement,
      'Driver',
      'openai_chat_completions',
    )
    expect(
      within(architectureSummaryProfile as HTMLElement).getByDisplayValue(
        'gpt-5.4-mini',
      ),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).getAllByDisplayValue(
        '/Users/alex/Library/Application Support/bitloops/tools/bitloops-inference/bitloops-inference',
      ),
    ).toHaveLength(2)

    const architectureRolePanel = within(architectureCard)
      .getByRole('heading', { name: 'Role adjudication' })
      .closest('section') as HTMLElement | null
    expect(architectureRolePanel).not.toBeNull()
    expect(
      within(architectureRolePanel as HTMLElement).getByRole('heading', {
        name: 'Inference profile · guidance_llm',
      }),
    ).toBeInTheDocument()
    expect(
      within(architectureRolePanel as HTMLElement).getByDisplayValue(
        'ministral-3-3b-instruct',
      ),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · summary_llm/,
    )
    expectFieldSelectValue(contextCard, 'Guidance generation', 'summary_llm')
    expect(
      within(contextCard).getByRole('heading', {
        name: 'Inference profile · summary_llm',
      }),
    ).toBeInTheDocument()

    let semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      /Inference profile · local_code/,
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
      within(semanticClonesCard).getByRole('heading', {
        name: 'Inference profile · local_code',
      }),
    ).toBeInTheDocument()
    expect(
      within(semanticClonesCard).getByRole('heading', {
        name: 'Inference runtime · bitloops_local_embeddings',
      }),
    ).toBeInTheDocument()

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

    let testHarnessCard = screen.getByTestId(
      'capability-pack-card-test-harness',
    )
    testHarnessCard = await ensurePackExpanded(
      user,
      testHarnessCard,
      'Coverage adapter',
    )
    expect(
      within(testHarnessCard).getByText('Coverage adapter'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Test discovery adapter'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Language support'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Coverage dependency'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Test discovery dependency'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Coverage format'),
    ).toBeInTheDocument()
    expect(within(testHarnessCard).getByText('SQLite path')).toBeInTheDocument()
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
      /Inference profile · summary_llm/,
    )
    expectFieldSelectValue(architectureCard, 'Fact synthesis', 'summary_llm')
    expect(
      within(architectureCard).getByDisplayValue('gpt-5.4-mini'),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · guidance_llm/,
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

    let testHarnessCard = screen.getByTestId(
      'capability-pack-card-test-harness',
    )
    testHarnessCard = await ensurePackExpanded(
      user,
      testHarnessCard,
      'Coverage adapter',
    )
    expect(
      await within(testHarnessCard).findByText('Coverage adapter'),
    ).toBeInTheDocument()
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
      screen.getByTestId('capability-pack-card-test-harness'),
    ).toBeInTheDocument()

    let architectureCard = screen.getByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · architecture_role_adjudication/,
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
      within(architectureRolePanel as HTMLElement).getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      }),
    ).toBeInTheDocument()
    const thinkingLevelRow = fieldRowByLabel(
      architectureRolePanel as HTMLElement,
      'Thinking level',
    )
    expect(thinkingLevelRow).not.toBeNull()
    expect(
      within(thinkingLevelRow as HTMLElement).getByRole('combobox'),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · guidance_llm/,
    )
    expect(within(contextCard).getByText('guidance_llm')).toBeInTheDocument()
    expect(
      within(contextCard).getByRole('heading', {
        name: 'Inference profile · guidance_llm',
      }),
    ).toBeInTheDocument()

    let testHarnessCard = screen.getByTestId(
      'capability-pack-card-test-harness',
    )
    testHarnessCard = await ensurePackExpanded(
      user,
      testHarnessCard,
      'Coverage adapter',
    )
    expect(
      await within(testHarnessCard).findByText('Coverage adapter'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Test discovery adapter'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Language support'),
    ).toBeInTheDocument()
    expect(
      within(testHarnessCard).getByText('Coverage format'),
    ).toBeInTheDocument()
    expect(within(testHarnessCard).getByText('SQLite path')).toBeInTheDocument()
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
      /Inference profile · architecture_role_adjudication/,
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
      within(architectureCard).getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      }),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · guidance_llm/,
    )
    expect(within(contextCard).getByText('guidance_llm')).toBeInTheDocument()
    expect(
      within(contextCard).getByRole('heading', {
        name: 'Inference profile · guidance_llm',
      }),
    ).toBeInTheDocument()
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

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · architecture_role_adjudication_codex/,
    )
    const architectureRolePanel = within(architectureCard)
      .getByRole('heading', { name: 'Role adjudication' })
      .closest('section') as HTMLElement | null
    expect(architectureRolePanel).not.toBeNull()
    const profilePanel = within(architectureRolePanel as HTMLElement)
      .getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication_codex',
      })
      .closest('section') as HTMLElement | null
    expect(profilePanel).not.toBeNull()

    const taskSelect = expectFieldSelectValue(
      profilePanel as HTMLElement,
      'Task',
      'structured_generation',
    )
    expect(taskSelect).toBeInTheDocument()

    const driverSelect = expectFieldSelectValue(
      profilePanel as HTMLElement,
      'Driver',
      'codex_exec',
    )
    expect(
      within(
        fieldRowByLabel(profilePanel as HTMLElement, 'Driver') as HTMLElement,
      ).queryByRole('textbox'),
    ).not.toBeInTheDocument()
    await user.click(driverSelect)
    expect(
      await screen.findByRole('option', { name: 'codex_exec' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'claude_code_print' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'codex_exec' }))

    const runtimeSelect = expectFieldSelectValue(
      profilePanel as HTMLElement,
      'Runtime',
      'codex',
    )
    expect(
      within(
        fieldRowByLabel(profilePanel as HTMLElement, 'Runtime') as HTMLElement,
      ).queryByRole('textbox'),
    ).not.toBeInTheDocument()
    await user.click(runtimeSelect)
    expect(
      await screen.findByRole('option', { name: 'codex' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'claude' })).toBeInTheDocument()
    expect(
      screen.queryByRole('option', { name: 'bitloops_inference' }),
    ).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'codex' }))

    const thinkingSelect = expectFieldSelectValue(
      profilePanel as HTMLElement,
      'Thinking level',
      'high',
    )
    expect(
      within(
        fieldRowByLabel(
          profilePanel as HTMLElement,
          'Thinking level',
        ) as HTMLElement,
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

  it('renders the task aliases and driver-specific thinking levels from the inference reference', async () => {
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

    let contextCard = await screen.findByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · guidance_llm/,
    )
    const guidanceProfile = within(contextCard)
      .getByRole('heading', { name: 'Inference profile · guidance_llm' })
      .closest('section') as HTMLElement | null
    expect(guidanceProfile).not.toBeNull()
    const textTaskSelect = expectFieldSelectValue(
      guidanceProfile as HTMLElement,
      'Task',
      'text-generation',
    )
    await user.click(textTaskSelect)
    expect(
      await screen.findByRole('option', { name: 'text_generation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'text-generation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'structured_generation' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('option', { name: 'structured-generation' }),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'text-generation' }))

    const textDriverSelect = expectFieldSelectValue(
      guidanceProfile as HTMLElement,
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

    let architectureCard = screen.getByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · architecture_role_adjudication/,
    )
    const architectureProfile = within(architectureCard)
      .getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      })
      .closest('section') as HTMLElement | null
    expect(architectureProfile).not.toBeNull()
    expectFieldSelectValue(
      architectureProfile as HTMLElement,
      'Task',
      'structured-generation',
    )

    const claudeThinkingSelect = expectFieldSelectValue(
      architectureProfile as HTMLElement,
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

  it('does not overwrite explicit blank backend runtime fields with supplemental defaults', async () => {
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

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference runtime · codex/,
    )
    const runtimePanel = within(architectureCard)
      .getByRole('heading', { name: 'Inference runtime · codex' })
      .closest('section') as HTMLElement | null
    expect(runtimePanel).not.toBeNull()
    const commandRow = fieldRowByLabel(runtimePanel as HTMLElement, 'Command')
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

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · architecture_role_adjudication/,
    )
    const profilePanel = within(architectureCard)
      .getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      })
      .closest('section') as HTMLElement | null
    expect(profilePanel).not.toBeNull()

    await chooseFieldOption(
      user,
      profilePanel as HTMLElement,
      'Runtime',
      'claude',
    )

    const refreshedCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    const runtimePanel = within(refreshedCard)
      .getByRole('heading', { name: 'Inference runtime · claude' })
      .closest('section') as HTMLElement | null
    expect(runtimePanel).not.toBeNull()
    expect(
      within(runtimePanel as HTMLElement).getByDisplayValue(
        '/opt/homebrew/bin/claude',
      ),
    ).toBeInTheDocument()
    expect(
      within(runtimePanel as HTMLElement).getByText(
        'Resolved executable: /opt/homebrew/bin/claude',
      ),
    ).toBeInTheDocument()
    expect(
      within(runtimePanel as HTMLElement).getByDisplayValue('300'),
    ).toBeInTheDocument()
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

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · architecture_role_adjudication/,
    )
    const profilePanel = within(architectureCard)
      .getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      })
      .closest('section') as HTMLElement | null
    expect(profilePanel).not.toBeNull()
    expect(
      within(profilePanel as HTMLElement).getAllByText('Task'),
    ).toHaveLength(1)
    expect(
      within(profilePanel as HTMLElement).getAllByText('Runtime'),
    ).toHaveLength(1)
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

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · summary_llm/,
    )
    const summaryProfile = within(architectureCard)
      .getByRole('heading', { name: 'Inference profile · summary_llm' })
      .closest('section') as HTMLElement | null
    expect(summaryProfile).not.toBeNull()
    expectFieldSelectValue(
      summaryProfile as HTMLElement,
      'Driver',
      'bitloops_platform_chat',
    )
    expect(
      within(summaryProfile as HTMLElement).getByDisplayValue(
        'ministral-3-3b-instruct',
      ),
    ).toBeInTheDocument()
    expect(
      within(summaryProfile as HTMLElement).getByDisplayValue(
        '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
      ),
    ).toBeInTheDocument()
    expect(
      within(summaryProfile as HTMLElement).getByDisplayValue('200'),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · guidance_llm/,
    )
    const guidanceProfile = within(contextCard)
      .getByRole('heading', { name: 'Inference profile · guidance_llm' })
      .closest('section') as HTMLElement | null
    expect(guidanceProfile).not.toBeNull()
    expect(
      within(guidanceProfile as HTMLElement).getByDisplayValue('124096'),
    ).toBeInTheDocument()

    let semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    semanticClonesCard = await ensurePackExpanded(
      user,
      semanticClonesCard,
      /Inference profile · platform_code/,
    )
    const platformCodeProfile = within(semanticClonesCard)
      .getByRole('heading', { name: 'Inference profile · platform_code' })
      .closest('section') as HTMLElement | null
    expect(platformCodeProfile).not.toBeNull()
    expectFieldSelectValue(
      platformCodeProfile as HTMLElement,
      'Task',
      'embeddings',
    )
    expectFieldSelectValue(
      platformCodeProfile as HTMLElement,
      'Driver',
      'bitloops_embeddings_ipc',
    )
    expectFieldSelectValue(
      platformCodeProfile as HTMLElement,
      'Runtime',
      'bitloops_platform_embeddings',
    )
    expect(
      within(platformCodeProfile as HTMLElement).getByDisplayValue('bge-m3'),
    ).toBeInTheDocument()
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

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · architecture_role_adjudication/,
    )
    const profilePanel = within(architectureCard)
      .getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication',
      })
      .closest('section') as HTMLElement | null
    expect(profilePanel).not.toBeNull()

    await chooseFieldOption(
      user,
      profilePanel as HTMLElement,
      'Driver',
      'codex_exec',
    )
    expectFieldSelectValue(profilePanel as HTMLElement, 'Runtime', 'codex')
    expect(
      within(profilePanel as HTMLElement).getByDisplayValue('gpt-5.4-mini'),
    ).toBeInTheDocument()

    await chooseFieldOption(
      user,
      profilePanel as HTMLElement,
      'Driver',
      'claude_code_print',
    )
    expectFieldSelectValue(profilePanel as HTMLElement, 'Runtime', 'claude')
    expect(
      within(profilePanel as HTMLElement).getByDisplayValue('claude-opus-4-7'),
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

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · architecture_role_adjudication_codex/,
    )
    const architectureRolePanel = within(architectureCard)
      .getByRole('heading', { name: 'Role adjudication' })
      .closest('section')
    expect(architectureRolePanel).not.toBeNull()
    expect(
      within(architectureRolePanel as HTMLElement).getByRole('heading', {
        name: 'Inference profile · architecture_role_adjudication_codex',
      }),
    ).toBeInTheDocument()
    expectFieldSelectValue(
      architectureRolePanel as HTMLElement,
      'Task',
      'structured_generation',
    )
    expectFieldSelectValue(
      architectureRolePanel as HTMLElement,
      'Driver',
      'codex_exec',
    )
    expectFieldSelectValue(
      architectureRolePanel as HTMLElement,
      'Thinking level',
      'high',
    )
    expect(
      within(architectureRolePanel as HTMLElement).getByRole('heading', {
        name: 'Inference runtime · codex',
      }),
    ).toBeInTheDocument()
    expectFieldSelectValue(
      architectureRolePanel as HTMLElement,
      'Runtime',
      'codex',
    )
    expect(
      within(architectureRolePanel as HTMLElement).getByDisplayValue('codex'),
    ).toBeInTheDocument()
    expect(
      within(architectureRolePanel as HTMLElement).getByDisplayValue(
        /--ask-for-approval/,
      ),
    ).toBeInTheDocument()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · guidance_llm/,
    )
    expect(
      within(contextCard).getByRole('heading', {
        name: 'Inference profile · guidance_llm',
      }),
    ).toBeInTheDocument()
    expectFieldSelectValue(contextCard, 'Task', 'text_generation')
    expectFieldSelectValue(contextCard, 'Driver', 'bitloops_platform_chat')
    expect(
      within(contextCard).getByDisplayValue('ministral-3-3b-instruct'),
    ).toBeInTheDocument()
    expect(
      within(contextCard).getByDisplayValue(
        '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
      ),
    ).toBeInTheDocument()
  })

  it('makes shared inference blocks editable only in the first visible owner pack', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    let architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    architectureCard = await ensurePackExpanded(
      user,
      architectureCard,
      /Inference profile · summary_llm/,
    )
    const architectureSharedProfile = within(architectureCard)
      .getByRole('heading', {
        name: 'Inference profile · summary_llm',
      })
      .closest('section')
    expect(architectureSharedProfile).not.toBeNull()
    expect(
      expectFieldSelectValue(
        architectureSharedProfile as HTMLElement,
        'Runtime',
        'bitloops_inference',
      ),
    ).toBeEnabled()

    const architectureSharedRuntime = within(architectureCard)
      .getAllByRole('heading', {
        name: 'Inference runtime · bitloops_inference',
      })[0]
      .closest('section')
    expect(architectureSharedRuntime).not.toBeNull()
    expect(
      within(architectureSharedRuntime as HTMLElement).getByDisplayValue(
        '/Users/alex/Library/Application Support/bitloops/tools/bitloops-inference/bitloops-inference',
      ),
    ).toBeEnabled()

    let contextCard = screen.getByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · summary_llm/,
    )
    const contextSharedProfile = within(contextCard)
      .getByRole('heading', {
        name: 'Inference profile · summary_llm',
      })
      .closest('section')
    expect(contextSharedProfile).not.toBeNull()
    expect(
      within(contextSharedProfile as HTMLElement).getByText(
        'Shared with Architecture graph. Edit there.',
      ),
    ).toBeInTheDocument()
    expect(
      expectFieldSelectValue(
        contextSharedProfile as HTMLElement,
        'Runtime',
        'bitloops_inference',
      ),
    ).toBeDisabled()

    const contextSharedRuntime = within(contextCard)
      .getAllByRole('heading', {
        name: 'Inference runtime · bitloops_inference',
      })[0]
      .closest('section')
    expect(contextSharedRuntime).not.toBeNull()
    expect(
      within(contextSharedRuntime as HTMLElement).getByDisplayValue(
        '/Users/alex/Library/Application Support/bitloops/tools/bitloops-inference/bitloops-inference',
      ),
    ).toBeDisabled()
  })

  it('removes the duplicate lower runtime config area entirely', async () => {
    render(<SettingsConfiguration />)

    await screen.findByTestId('capability-pack-card-test-harness')
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
      /Inference profile · summary_llm/,
    )
    let testHarnessCard = screen.getByTestId(
      'capability-pack-card-test-harness',
    )
    testHarnessCard = await ensurePackExpanded(
      user,
      testHarnessCard,
      'SQLite path',
    )

    await chooseFieldOption(
      user,
      architectureCard,
      'Fact synthesis',
      'architecture_fact_synthesis',
    )
    const sqlitePathInput =
      within(testHarnessCard).getByDisplayValue('bitloops.sqlite')
    await user.clear(sqlitePathInput)
    await user.type(sqlitePathInput, 'draft.sqlite')
    await user.click(screen.getByRole('button', { name: 'Review changes' }))

    const reviewPanel = screen.getByTestId('capability-pack-review-panel')
    expect(
      within(reviewPanel).getByRole('heading', {
        name: 'Pack direct config changes',
      }),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).getByRole('heading', {
        name: 'Shared inference/runtime changes',
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
      within(reviewPanel).getByText('Test harness · SQLite path'),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).queryByText('Backend handoff needed'),
    ).not.toBeInTheDocument()
  })

  it('uses the top configuration save action for pack-backed edits', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    let testHarnessCard = await screen.findByTestId(
      'capability-pack-card-test-harness',
    )
    testHarnessCard = await ensurePackExpanded(
      user,
      testHarnessCard,
      'SQLite path',
    )
    const input = within(testHarnessCard).getByDisplayValue(
      'bitloops.sqlite',
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'updated.sqlite')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['stores', 'relational', 'sqlite_path'],
          value: 'updated.sqlite',
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
    expect(expectFieldCheckbox(repoSetupPanel, 'Sync')).toBeDisabled()
    expect(expectFieldCheckbox(repoSetupPanel, 'Ingest')).toBeDisabled()
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

    await user.selectOptions(
      await screen.findByLabelText('Config target'),
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
    const repoSetupPanel = screen.getByTestId('repo-setup-options')
    await user.click(expectFieldCheckbox(repoSetupPanel, 'Sync'))
    await user.click(expectFieldCheckbox(repoSetupPanel, 'Ingest'))
    const daemonSetupPanel = screen.getByTestId('daemon-setup-options')
    expect(
      expectFieldCheckbox(
        daemonSetupPanel,
        'Daemon should start automatically',
      ),
    ).toBeDisabled()
    expect(
      expectFieldCheckbox(daemonSetupPanel, 'Enable telemetry'),
    ).toBeDisabled()
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

    let contextCard = await screen.findByTestId(
      'capability-pack-card-context-guidance',
    )
    contextCard = await ensurePackExpanded(
      user,
      contextCard,
      /Inference profile · guidance_llm/,
    )
    const guidanceProfile = within(contextCard)
      .getByRole('heading', { name: 'Inference profile · guidance_llm' })
      .closest('section') as HTMLElement | null
    expect(guidanceProfile).not.toBeNull()
    const maxTokensRow = fieldRowByLabel(
      guidanceProfile as HTMLElement,
      'Max output tokens',
    )
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
      section('stores', 'Stores', 'Shared store settings', 12, [
        field(['stores', 'relational', 'sqlite_path'], 'SQLite path', 'old.db'),
      ]),
    ]
    const updatedSections = [
      initialSections[0],
      section('stores', 'Stores', 'Shared store settings', 12, [
        field(['stores', 'relational', 'sqlite_path'], 'SQLite path', 'new.db'),
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

    let testHarnessCard = await screen.findByTestId(
      'capability-pack-card-test-harness',
    )
    testHarnessCard = await ensurePackExpanded(
      user,
      testHarnessCard,
      'SQLite path',
    )
    const input = within(testHarnessCard).getByDisplayValue(
      'old.db',
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'new.db')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: expect.arrayContaining([
        {
          path: ['stores', 'relational', 'sqlite_path'],
          value: 'new.db',
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

    let testHarnessCard = await screen.findByTestId(
      'capability-pack-card-test-harness',
    )
    testHarnessCard = await ensurePackExpanded(
      user,
      testHarnessCard,
      'SQLite path',
    )
    const input = within(testHarnessCard).getByDisplayValue(
      'bitloops.sqlite',
    ) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'updated.sqlite')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['stores', 'relational', 'sqlite_path'],
          value: 'updated.sqlite',
        },
      ],
    })
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Runtime config save did not change the returned snapshot.',
    )
    expect(screen.queryByText('Runtime config saved.')).not.toBeInTheDocument()
  })
})
