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
  beforeEach(() => {
    vi.clearAllMocks()
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

  it('sends changed field patches with the expected revision', async () => {
    const user = userEvent.setup()
    render(<SettingsConfiguration />)

    const input = (await screen.findByDisplayValue(
      'old.db',
    )) as HTMLInputElement
    await user.clear(input)
    await user.type(input, 'new.db')
    await user.click(screen.getByRole('button', { name: 'Save' }))

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
    expect(await screen.findByText('Configuration saved.')).toBeInTheDocument()
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
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(updateRuntimeConfig).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Advanced must be valid JSON.',
    )
  })
})
