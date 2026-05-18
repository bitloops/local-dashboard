import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  fetchRuntimeConfigSnapshot,
  fetchRuntimeConfigTargets,
  updateRuntimeConfig,
  type RuntimeConfigSnapshot,
  type RuntimeConfigTarget,
} from '@/api/runtime/config'
import { SettingsConfiguration } from './index'

vi.mock('@/api/runtime/config', () => ({
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
      {
        key: 'context_guidance',
        title: 'Context Guidance',
        description: 'Guided context generation settings',
        order: 5,
        advanced: false,
        value: {},
        effectiveValue: {},
        fields: [
          {
            key: 'context_guidance.inference.guidance_generation',
            path: ['context_guidance', 'inference', 'guidance_generation'],
            label: 'Guidance generation',
            description: 'Profile binding for context guidance.',
            fieldType: 'string',
            value: 'guidance_llm',
            effectiveValue: 'guidance_llm',
            defaultValue: null,
            allowedValues: [],
            validationHints: [],
            required: false,
            readOnly: false,
            secret: false,
            order: 0,
            source: 'effective',
          },
        ],
      },
      {
        key: 'architecture',
        title: 'Architecture',
        description: 'Architecture pack settings',
        order: 6,
        advanced: false,
        value: {},
        effectiveValue: {},
        fields: [
          {
            key: 'architecture.inference.fact_synthesis',
            path: ['architecture', 'inference', 'fact_synthesis'],
            label: 'Fact synthesis',
            description: 'Profile binding for architecture fact synthesis.',
            fieldType: 'string',
            value: 'architecture_fact_synthesis_codex',
            effectiveValue: 'architecture_fact_synthesis_codex',
            defaultValue: null,
            allowedValues: [],
            validationHints: [],
            required: false,
            readOnly: false,
            secret: false,
            order: 0,
            source: 'effective',
          },
          {
            key: 'architecture.inference.role_adjudication',
            path: ['architecture', 'inference', 'role_adjudication'],
            label: 'Role adjudication',
            description: 'Profile binding for architecture role adjudication.',
            fieldType: 'string',
            value: 'architecture_role_adjudication_codex',
            effectiveValue: 'architecture_role_adjudication_codex',
            defaultValue: null,
            allowedValues: [],
            validationHints: [],
            required: false,
            readOnly: false,
            secret: false,
            order: 1,
            source: 'effective',
          },
        ],
      },
      {
        key: 'knowledge',
        title: 'Knowledge',
        description: 'Knowledge pack settings',
        order: 7,
        advanced: false,
        value: {},
        effectiveValue: {},
        fields: [
          {
            key: 'knowledge.refresh_interval_secs',
            path: ['knowledge', 'refresh_interval_secs'],
            label: 'Refresh interval',
            description: 'Refresh interval in seconds.',
            fieldType: 'integer',
            value: 60,
            effectiveValue: 60,
            defaultValue: null,
            allowedValues: [],
            validationHints: [],
            required: false,
            readOnly: false,
            secret: false,
            order: 0,
            source: 'effective',
          },
        ],
      },
      {
        key: 'semantic_clones',
        title: 'Semantic clones',
        description: 'Semantic clone detection settings',
        order: 8,
        advanced: false,
        value: {},
        effectiveValue: {},
        fields: [
          {
            key: 'semantic_clones.similarity_threshold',
            path: ['semantic_clones', 'similarity_threshold'],
            label: 'Similarity threshold',
            description: 'Threshold for clone matching.',
            fieldType: 'integer',
            value: 90,
            effectiveValue: 90,
            defaultValue: null,
            allowedValues: [],
            validationHints: [],
            required: false,
            readOnly: false,
            secret: false,
            order: 0,
            source: 'effective',
          },
        ],
      },
      {
        key: 'stores',
        title: 'Stores',
        description: 'Runtime-provided store metadata',
        order: 10,
        advanced: false,
        value: {},
        effectiveValue: {},
        fields: [
          {
            key: 'stores.relational.sqlite_path',
            path: ['stores', 'relational', 'sqlite_path'],
            label: 'SQLite path',
            description: 'Local relational store path.',
            fieldType: 'string',
            value: 'old.db',
            effectiveValue: 'old.db',
            defaultValue: null,
            allowedValues: [],
            validationHints: [],
            required: false,
            readOnly: false,
            secret: false,
            order: 0,
            source: 'effective',
          },
          {
            key: 'stores.secret.token',
            path: ['stores', 'secret', 'token'],
            label: 'Github token',
            description: 'A redacted secret field.',
            fieldType: 'string',
            value: '********',
            effectiveValue: '********',
            defaultValue: null,
            allowedValues: [],
            validationHints: [
              'Existing values are redacted; leave the placeholder unchanged to preserve the current secret.',
            ],
            required: false,
            readOnly: false,
            secret: true,
            order: 1,
            source: 'effective',
          },
        ],
      },
      {
        key: 'advanced',
        title: 'Advanced',
        description: 'Structured runtime value',
        order: 20,
        advanced: true,
        value: {},
        effectiveValue: null,
        fields: [
          {
            key: 'advanced',
            path: ['advanced'],
            label: 'Advanced',
            description: 'Edit as JSON',
            fieldType: 'json',
            value: {},
            effectiveValue: null,
            defaultValue: null,
            allowedValues: [],
            validationHints: ['Enter a valid JSON object, array, or scalar.'],
            required: false,
            readOnly: false,
            secret: false,
            order: 0,
            source: null,
          },
        ],
      },
    ],
    ...overrides,
  } satisfies RuntimeConfigSnapshot
}

describe('SettingsConfiguration', () => {
  let localStorageData: Record<string, string>

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageData = {}
    vi.stubGlobal('localStorage', {
      getItem: vi.fn((key: string) => localStorageData[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        localStorageData[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete localStorageData[key]
      }),
    })
    vi.mocked(fetchRuntimeConfigTargets).mockResolvedValue([target])
    vi.mocked(fetchRuntimeConfigSnapshot).mockResolvedValue(snapshot())
    vi.mocked(updateRuntimeConfig).mockResolvedValue(
      snapshot({
        revision: 'rev-2',
        sections: snapshot().sections.map((section) =>
          section.key === 'stores'
            ? {
                ...section,
                fields: section.fields.map((field) =>
                  field.key === 'stores.relational.sqlite_path'
                    ? { ...field, value: 'new.db', effectiveValue: 'new.db' }
                    : field,
                ),
              }
            : section,
        ),
      }),
    )
  })

  it('renders runtime-provided targets and fields', async () => {
    const { container } = render(<SettingsConfiguration />)

    expect(await screen.findByText('Daemon config')).toBeInTheDocument()
    expect(await screen.findByText('Stores')).toBeInTheDocument()
    expect(screen.getByText('SQLite path')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Advanced' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Secret')).toBeInTheDocument()
    expect(container.querySelector('input[type="password"]')).not.toBeNull()
  })

  it('renders cross-pack checkbox controls and keeps disabled packs visible', async () => {
    render(<SettingsConfiguration />)

    expect(
      await screen.findByRole('heading', { name: 'Capability Packs' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', { name: 'Start daemon on app startup' }),
    ).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Sync enabled' })).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Ingest enabled' }),
    ).toBeChecked()
    expect(
      screen.getByRole('checkbox', { name: 'Observability enabled' }),
    ).toBeChecked()

    const semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    expect(within(semanticClonesCard).getByText('Disabled')).toBeInTheDocument()
    expect(
      within(semanticClonesCard).queryByText('Advanced config'),
    ).not.toBeInTheDocument()
  })

  it('shows guided settings for guided packs and expands advanced packs when enabled', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const architectureCard = await screen.findByTestId(
      'capability-pack-card-architecture-graph',
    )
    expect(
      within(architectureCard).getByText('Guided settings'),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).getByLabelText('Fact synthesis runtime'),
    ).toBeInTheDocument()
    expect(
      within(architectureCard).getByLabelText('Role adjudication runtime'),
    ).toBeInTheDocument()

    const semanticClonesCard = screen.getByTestId(
      'capability-pack-card-semantic-clones',
    )
    await user.click(
      within(semanticClonesCard).getByRole('checkbox', {
        name: 'Enable Semantic clones',
      }),
    )

    expect(
      within(semanticClonesCard).getByText('Advanced config'),
    ).toBeInTheDocument()
    expect(
      within(semanticClonesCard).getByRole('heading', {
        name: 'Semantic clones',
      }),
    ).toBeInTheDocument()
  })

  it('opens a review sheet and surfaces backend handoff blockers', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    expect(
      await screen.findByRole('heading', { name: 'Capability Packs' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('checkbox', { name: 'Observability enabled' }),
    )
    await user.click(screen.getByRole('button', { name: 'Review changes' }))

    const reviewPanel = screen.getByTestId('capability-pack-review-panel')
    expect(
      screen.getByRole('heading', { name: 'Review changes' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Backend handoff needed')).toBeInTheDocument()
    expect(
      within(reviewPanel).getByText('/settings/configuration'),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).getByText(/planCapabilityPackConfig/i),
    ).toBeInTheDocument()
    expect(
      within(reviewPanel).getByRole('button', { name: 'Save & Run' }),
    ).toBeDisabled()
    expect(
      within(reviewPanel).getByText('Observability enabled'),
    ).toBeInTheDocument()
  })

  it('keeps the generic runtime configuration editor available', async () => {
    render(<SettingsConfiguration />)

    expect(await screen.findByText('Daemon config')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Edit runtime-discovered Bitloops config files without leaving the dashboard.',
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Save runtime config' }),
    ).toBeInTheDocument()
  })

  it('sends changed field patches with the expected revision', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const input = (await screen.findByDisplayValue(
      'old.db',
    )) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'new.db')
    await user.click(
      screen.getByRole('button', { name: 'Save runtime config' }),
    )

    expect(updateRuntimeConfig).toHaveBeenCalledWith({
      targetId: 'target-daemon',
      expectedRevision: 'rev-1',
      patches: [
        {
          path: ['stores', 'relational', 'sqlite_path'],
          value: 'new.db',
        },
      ],
    })
    expect(await screen.findByText('Runtime config saved.')).toBeInTheDocument()
  })

  it('validates JSON fields before saving', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const advancedSection = await screen.findByText('Structured runtime value')
    const section = advancedSection.closest('section')
    expect(section).not.toBeNull()
    const textarea = within(section as HTMLElement).getByRole('textbox')
    await user.clear(textarea)
    await user.type(textarea, '{{')
    await user.click(
      screen.getByRole('button', { name: 'Save runtime config' }),
    )

    expect(updateRuntimeConfig).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Advanced must be valid JSON.',
    )
  })
})
