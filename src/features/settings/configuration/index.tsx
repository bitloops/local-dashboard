import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  RotateCcw,
  Save,
} from 'lucide-react'
import { GraphQLRequestError } from '@/api/graphql/errors'
import {
  fetchRuntimeConfigSnapshot,
  fetchRuntimeConfigTargets,
  updateRuntimeConfig,
  type RuntimeConfigField,
  type RuntimeConfigFieldPatch,
  type RuntimeConfigSection,
  type RuntimeConfigSnapshot,
  type RuntimeConfigTarget,
} from '@/api/runtime/config'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

type Drafts = Record<string, string>
type CrossPackPreferences = {
  daemonStartOnStartup: boolean
  syncEnabled: boolean
  ingestEnabled: boolean
  observabilityEnabled: boolean
}
type CapabilityPackStatus = 'Needs setup' | 'Ready' | 'Applying' | 'Failed'
type CapabilityPackSelectionKind = 'Explicit' | 'Dependency-selected'

type GuidedSettingDefinition = {
  key: string
  label: string
  options: string[]
}

type CapabilityPackDefinition = {
  id: string
  label: string
  summary: string
  evidence: string
  status: CapabilityPackStatus
  selectionKind: CapabilityPackSelectionKind
  experimental?: boolean
  dependencies: string[]
  initiallyEnabled: boolean
  initiallyExpanded?: boolean
  guidedSettings?: GuidedSettingDefinition[]
  advancedSectionKeys: string[]
}

const capabilityPackCatalog: CapabilityPackDefinition[] = [
  {
    id: 'codecity',
    label: 'CodeCity',
    summary: 'Builds the file/world visualisation and health overlays.',
    evidence: 'bitloops/src/capability_packs/codecity',
    status: 'Ready',
    selectionKind: 'Explicit',
    dependencies: [],
    initiallyEnabled: true,
    advancedSectionKeys: ['codecity'],
  },
  {
    id: 'architecture-graph',
    label: 'Architecture graph',
    summary: 'Builds components, contracts, entry points, and system facts.',
    evidence: 'bitloops/src/capability_packs/architecture_graph',
    status: 'Needs setup',
    selectionKind: 'Explicit',
    dependencies: ['Knowledge pack'],
    initiallyEnabled: true,
    initiallyExpanded: true,
    guidedSettings: [
      {
        key: 'factSynthesisRuntime',
        label: 'Fact synthesis runtime',
        options: ['Codex', 'Claude', 'Bitloops-managed'],
      },
      {
        key: 'roleAdjudicationRuntime',
        label: 'Role adjudication runtime',
        options: ['Codex', 'Claude', 'Bitloops-managed'],
      },
    ],
    advancedSectionKeys: ['architecture'],
  },
  {
    id: 'context-guidance',
    label: 'Context Guidance',
    summary:
      'Guides repository-aware text generation with knowledge-backed prompts.',
    evidence: 'bitloops/src/capability_packs/context_guidance',
    status: 'Ready',
    selectionKind: 'Explicit',
    dependencies: ['Knowledge pack'],
    initiallyEnabled: true,
    initiallyExpanded: true,
    guidedSettings: [
      {
        key: 'guidanceGenerationRuntime',
        label: 'Guidance generation runtime',
        options: ['Bitloops-managed', 'Local LLM', 'Codex', 'Claude'],
      },
    ],
    advancedSectionKeys: ['context_guidance'],
  },
  {
    id: 'test-harness',
    label: 'Test harness',
    summary:
      'Discovers tests, coverage, classifications, and verification records.',
    evidence: 'bitloops/src/capability_packs/test_harness',
    status: 'Ready',
    selectionKind: 'Dependency-selected',
    dependencies: [],
    initiallyEnabled: true,
    advancedSectionKeys: ['test_harness'],
  },
  {
    id: 'knowledge-pack',
    label: 'Knowledge pack',
    summary: 'Stores and refreshes durable knowledge records.',
    evidence: 'bitloops/src/capability_packs/knowledge.rs',
    status: 'Ready',
    selectionKind: 'Dependency-selected',
    dependencies: [],
    initiallyEnabled: true,
    advancedSectionKeys: ['knowledge'],
  },
  {
    id: 'semantic-clones',
    label: 'Semantic clones',
    summary: 'Identifies similar symbols and clone edges.',
    evidence: 'bitloops/src/capability_packs/semantic_clones',
    status: 'Failed',
    selectionKind: 'Explicit',
    experimental: true,
    dependencies: [],
    initiallyEnabled: false,
    advancedSectionKeys: ['semantic_clones'],
  },
] as const

type CapabilityPackId = (typeof capabilityPackCatalog)[number]['id']
type CapabilityPackGuidedDraft = Record<string, string>
type CapabilityPackDraft = {
  enabled: boolean
  guidedSettings: CapabilityPackGuidedDraft
}
type CapabilityPackDrafts = Record<CapabilityPackId, CapabilityPackDraft>

function defaultCrossPackPreferences(): CrossPackPreferences {
  return {
    daemonStartOnStartup: true,
    syncEnabled: true,
    ingestEnabled: true,
    observabilityEnabled: true,
  }
}

function crossPackDirty(
  current: CrossPackPreferences,
  initial: CrossPackPreferences,
): boolean {
  return (
    current.daemonStartOnStartup !== initial.daemonStartOnStartup ||
    current.syncEnabled !== initial.syncEnabled ||
    current.ingestEnabled !== initial.ingestEnabled ||
    current.observabilityEnabled !== initial.observabilityEnabled
  )
}

function defaultCapabilityPackDrafts(): CapabilityPackDrafts {
  return capabilityPackCatalog.reduce((drafts, pack) => {
    drafts[pack.id] = {
      enabled: pack.initiallyEnabled,
      guidedSettings: (pack.guidedSettings ?? []).reduce(
        (settings, definition) => {
          settings[definition.key] = definition.options[0] ?? ''
          return settings
        },
        {} as CapabilityPackGuidedDraft,
      ),
    }
    return drafts
  }, {} as CapabilityPackDrafts)
}

function capabilityPackDraftsDirty(
  current: CapabilityPackDrafts,
  initial: CapabilityPackDrafts,
): boolean {
  return capabilityPackCatalog.some((pack) => {
    const currentPack = current[pack.id]
    const initialPack = initial[pack.id]
    if (currentPack.enabled !== initialPack.enabled) {
      return true
    }

    return Object.keys(currentPack.guidedSettings).some(
      (key) =>
        currentPack.guidedSettings[key] !== initialPack.guidedSettings[key],
    )
  })
}

function defaultExpandedPackIds(): string[] {
  return capabilityPackCatalog
    .filter((pack) => pack.initiallyEnabled && pack.initiallyExpanded)
    .map((pack) => pack.id)
}

function statusForPack(
  pack: CapabilityPackDefinition,
  draft: CapabilityPackDraft,
): string {
  if (!draft.enabled) {
    return 'Disabled'
  }

  return pack.status
}

function changedPackIds(
  current: CapabilityPackDrafts,
  initial: CapabilityPackDrafts,
): CapabilityPackId[] {
  return capabilityPackCatalog
    .filter((pack) => {
      const currentPack = current[pack.id]
      const initialPack = initial[pack.id]
      if (currentPack.enabled !== initialPack.enabled) {
        return true
      }
      return Object.keys(currentPack.guidedSettings).some(
        (key) =>
          currentPack.guidedSettings[key] !== initialPack.guidedSettings[key],
      )
    })
    .map((pack) => pack.id)
}

function advancedSectionsForPack(
  sections: RuntimeConfigSection[],
  pack: CapabilityPackDefinition,
): RuntimeConfigSection[] {
  return sortedSections(sections).filter(
    (section) =>
      pack.advancedSectionKeys.includes(section.key) ||
      section.fields.some((field) =>
        pack.advancedSectionKeys.includes(field.path[0] ?? ''),
      ),
  )
}

function fieldDraftKey(field: RuntimeConfigField): string {
  return field.path.join('\u001f')
}

function valueToDraft(field: RuntimeConfigField): string {
  if (field.fieldType === 'boolean') {
    return field.value === true ? 'true' : 'false'
  }
  if (field.fieldType === 'json') {
    return JSON.stringify(field.value ?? null, null, 2)
  }
  if (field.value == null) {
    return ''
  }
  if (typeof field.value === 'string') {
    return field.value
  }
  if (typeof field.value === 'number' || typeof field.value === 'boolean') {
    return String(field.value)
  }
  return JSON.stringify(field.value, null, 2)
}

function buildDrafts(snapshot: RuntimeConfigSnapshot): Drafts {
  const drafts: Drafts = {}
  for (const section of snapshot.sections) {
    for (const field of section.fields) {
      drafts[fieldDraftKey(field)] = valueToDraft(field)
    }
  }
  return drafts
}

function parseFieldDraft(field: RuntimeConfigField, draft: string): unknown {
  if (field.fieldType === 'boolean') {
    return draft === 'true'
  }
  if (field.fieldType === 'integer') {
    const trimmed = draft.trim()
    if (!trimmed) return null
    const parsed = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(parsed)) {
      throw new Error(`${field.label} must be an integer.`)
    }
    return parsed
  }
  if (field.fieldType === 'json') {
    try {
      return JSON.parse(draft)
    } catch {
      throw new Error(`${field.label} must be valid JSON.`)
    }
  }
  return draft
}

function formatValue(value: unknown): string {
  if (value == null) return 'not set'
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  return JSON.stringify(value)
}

function displayPath(path: string): string {
  return path
}

function errorMessage(error: unknown): string {
  if (error instanceof GraphQLRequestError) return error.message
  if (error instanceof Error) return error.message
  return 'Runtime config request failed.'
}

function sortedSections(sections: RuntimeConfigSection[]) {
  return [...sections].sort((left, right) => {
    return left.order - right.order || left.title.localeCompare(right.title)
  })
}

function sortedFields(section: RuntimeConfigSection) {
  return [...section.fields].sort((left, right) => {
    return left.order - right.order || left.label.localeCompare(right.label)
  })
}

function targetGroups(targets: RuntimeConfigTarget[]) {
  const groups = new Map<string, RuntimeConfigTarget[]>()
  for (const target of targets) {
    const group = target.group || target.scope
    groups.set(group, [...(groups.get(group) ?? []), target])
  }
  return [...groups.entries()]
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: RuntimeConfigField
  value: string
  onChange: (value: string) => void
}) {
  if (field.fieldType === 'boolean') {
    return (
      <label className='flex h-9 w-fit items-center gap-2 rounded-md border border-input px-3 text-sm shadow-xs'>
        <input
          type='checkbox'
          checked={value === 'true'}
          disabled={field.readOnly}
          onChange={(event) => onChange(event.currentTarget.checked.toString())}
        />
        Enabled
      </label>
    )
  }

  if (field.fieldType === 'enum' && field.allowedValues.length > 0) {
    return (
      <Select value={value} onValueChange={onChange} disabled={field.readOnly}>
        <SelectTrigger className='w-full sm:w-[280px]'>
          <SelectValue placeholder='Select value' />
        </SelectTrigger>
        <SelectContent>
          {field.allowedValues.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.fieldType === 'json') {
    return (
      <Textarea
        value={value}
        disabled={field.readOnly}
        spellCheck={false}
        onChange={(event) => onChange(event.currentTarget.value)}
        className='min-h-28 font-mono text-xs'
      />
    )
  }

  return (
    <Input
      type={
        field.secret
          ? 'password'
          : field.fieldType === 'integer'
            ? 'number'
            : 'text'
      }
      value={value}
      disabled={field.readOnly}
      onChange={(event) => onChange(event.currentTarget.value)}
      className='sm:max-w-md'
    />
  )
}

function ConfigFieldRow({
  field,
  draft,
  dirty,
  onChange,
}: {
  field: RuntimeConfigField
  draft: string
  dirty: boolean
  onChange: (value: string) => void
}) {
  const inputId = `config-field-${field.path.join('-')}`
  return (
    <div className='grid gap-2 py-4 md:grid-cols-[minmax(180px,260px)_minmax(0,1fr)] md:gap-6'>
      <div className='space-y-1.5'>
        <div className='flex items-center gap-2'>
          <Label htmlFor={inputId}>{field.label}</Label>
          {dirty && <Badge variant='outline'>Changed</Badge>}
          {field.secret && <Badge variant='secondary'>Secret</Badge>}
        </div>
        <p className='text-xs leading-5 text-muted-foreground'>
          {field.description || field.path.join('.')}
        </p>
        {field.validationHints.length > 0 && (
          <p className='text-xs leading-5 text-muted-foreground'>
            {field.validationHints.join(' ')}
          </p>
        )}
        {field.effectiveValue !== null && (
          <p className='break-all text-xs leading-5 text-muted-foreground'>
            Effective: {formatValue(field.effectiveValue)}
          </p>
        )}
      </div>
      <div id={inputId}>
        <FieldControl field={field} value={draft} onChange={onChange} />
      </div>
    </div>
  )
}

function CrossPackControls({
  preferences,
  onToggle,
}: {
  preferences: CrossPackPreferences
  onToggle: (key: keyof CrossPackPreferences, value: boolean) => void
}) {
  const controls: Array<{
    key: keyof CrossPackPreferences
    label: string
    description: string
  }> = [
    {
      key: 'daemonStartOnStartup',
      label: 'Start daemon on app startup',
      description:
        'Automatically launch the Bitloops daemon when the dashboard opens.',
    },
    {
      key: 'syncEnabled',
      label: 'Sync enabled',
      description: 'Keep repository sync available across enabled packs.',
    },
    {
      key: 'ingestEnabled',
      label: 'Ingest enabled',
      description: 'Keep repository ingest available for pack-owned knowledge.',
    },
    {
      key: 'observabilityEnabled',
      label: 'Observability enabled',
      description: 'Match the existing Bitloops CLI observability concept.',
    },
  ]

  return (
    <div className='grid gap-3 lg:grid-cols-2'>
      {controls.map((control) => (
        <div
          key={control.key}
          className='rounded-md border bg-muted/20 px-4 py-3'
        >
          <div className='flex items-start justify-between gap-3'>
            <div className='space-y-1'>
              <Label htmlFor={`cross-pack-${control.key}`}>
                {control.label}
              </Label>
              <p className='text-xs leading-5 text-muted-foreground'>
                {control.description}
              </p>
            </div>
            <label className='flex h-9 w-fit items-center gap-2 rounded-md border border-input px-3 text-sm shadow-xs'>
              <input
                id={`cross-pack-${control.key}`}
                type='checkbox'
                checked={preferences[control.key]}
                onChange={(event) =>
                  onToggle(control.key, event.currentTarget.checked)
                }
                aria-label={control.label}
              />
              Enabled
            </label>
          </div>
        </div>
      ))}
    </div>
  )
}

function CapabilityPackCard({
  pack,
  draft,
  expanded,
  sections,
  drafts,
  initialDrafts,
  onToggleEnabled,
  onToggleExpanded,
  onGuidedSettingChange,
  onDraftChange,
}: {
  pack: CapabilityPackDefinition
  draft: CapabilityPackDraft
  expanded: boolean
  sections: RuntimeConfigSection[]
  drafts: Drafts
  initialDrafts: Drafts
  onToggleEnabled: (enabled: boolean) => void
  onToggleExpanded: () => void
  onGuidedSettingChange: (key: string, value: string) => void
  onDraftChange: (field: RuntimeConfigField, value: string) => void
}) {
  const status = statusForPack(pack, draft)

  return (
    <section
      data-testid={`capability-pack-card-${pack.id}`}
      className='rounded-md border bg-background px-4 py-4'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='space-y-2'>
          <button
            type='button'
            onClick={onToggleExpanded}
            className='flex items-center gap-2 text-left'
          >
            {expanded ? (
              <ChevronDown className='size-4 text-muted-foreground' />
            ) : (
              <ChevronRight className='size-4 text-muted-foreground' />
            )}
            <span className='text-sm font-semibold'>{pack.label}</span>
          </button>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge variant={draft.enabled ? 'default' : 'secondary'}>
              {status}
            </Badge>
            <Badge variant='outline'>{pack.selectionKind}</Badge>
            {pack.experimental ? (
              <Badge variant='secondary'>Experimental</Badge>
            ) : null}
          </div>
          <p className='text-sm text-muted-foreground'>{pack.summary}</p>
          {pack.dependencies.length > 0 ? (
            <p className='text-xs leading-5 text-muted-foreground'>
              Dependencies: {pack.dependencies.join(', ')}
            </p>
          ) : null}
          <p className='break-all text-xs text-muted-foreground'>
            {pack.evidence}
          </p>
        </div>
        <label className='flex h-9 w-fit items-center gap-2 rounded-md border border-input px-3 text-sm shadow-xs'>
          <input
            type='checkbox'
            checked={draft.enabled}
            onChange={(event) => onToggleEnabled(event.currentTarget.checked)}
            aria-label={`Enable ${pack.label}`}
          />
          Enabled
        </label>
      </div>

      {expanded ? (
        <div className='mt-4 space-y-4'>
          <div className='rounded-md border bg-muted/20 px-4 py-3'>
            <h5 className='text-sm font-semibold'>Overview</h5>
            <p className='mt-2 text-xs leading-5 text-muted-foreground'>
              {draft.enabled
                ? `${pack.label} is currently ${status.toLowerCase()}.`
                : `${pack.label} is disabled but remains available for review.`}
            </p>
            {pack.selectionKind === 'Dependency-selected' ? (
              <p className='mt-2 text-xs leading-5 text-muted-foreground'>
                This pack is currently marked as dependency-selected, so disable
                behavior should stay backend-owned.
              </p>
            ) : null}
          </div>

          {pack.guidedSettings?.length ? (
            <div className='rounded-md border bg-muted/20 px-4 py-3'>
              <h5 className='text-sm font-semibold'>Guided settings</h5>
              <div className='mt-3 grid gap-3 md:grid-cols-2'>
                {pack.guidedSettings.map((setting) => (
                  <div key={setting.key} className='space-y-1.5'>
                    <Label htmlFor={`${pack.id}-${setting.key}`}>
                      {setting.label}
                    </Label>
                    <select
                      id={`${pack.id}-${setting.key}`}
                      aria-label={setting.label}
                      value={draft.guidedSettings[setting.key] ?? ''}
                      onChange={(event) =>
                        onGuidedSettingChange(
                          setting.key,
                          event.currentTarget.value,
                        )
                      }
                      className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
                    >
                      {setting.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className='space-y-3'>
            <div className='rounded-md border bg-muted/20 px-4 py-3'>
              <h5 className='text-sm font-semibold'>Advanced config</h5>
              <p className='mt-1 text-xs leading-5 text-muted-foreground'>
                Related runtime-config fields stay grouped under the owning
                capability pack when the backend does not yet expose a dedicated
                guided contract.
              </p>
            </div>
            {sections.length > 0 ? (
              sections.map((section) => (
                <ConfigSectionPanel
                  key={`${pack.id}-${section.key}`}
                  section={section}
                  drafts={drafts}
                  initialDrafts={initialDrafts}
                  onDraftChange={onDraftChange}
                />
              ))
            ) : (
              <div className='rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground'>
                No advanced config fields are currently exposed for this pack.
              </div>
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function CapabilityPackReviewPanel({
  crossPackPreferences,
  initialCrossPackPreferences,
  packDrafts,
  initialPackDrafts,
}: {
  crossPackPreferences: CrossPackPreferences
  initialCrossPackPreferences: CrossPackPreferences
  packDrafts: CapabilityPackDrafts
  initialPackDrafts: CapabilityPackDrafts
}) {
  const changedCrossPackControls: string[] = []
  if (
    crossPackPreferences.daemonStartOnStartup !==
    initialCrossPackPreferences.daemonStartOnStartup
  ) {
    changedCrossPackControls.push('Start daemon on app startup')
  }
  if (
    crossPackPreferences.syncEnabled !== initialCrossPackPreferences.syncEnabled
  ) {
    changedCrossPackControls.push('Sync enabled')
  }
  if (
    crossPackPreferences.ingestEnabled !==
    initialCrossPackPreferences.ingestEnabled
  ) {
    changedCrossPackControls.push('Ingest enabled')
  }
  if (
    crossPackPreferences.observabilityEnabled !==
    initialCrossPackPreferences.observabilityEnabled
  ) {
    changedCrossPackControls.push('Observability enabled')
  }

  const changedPacks = changedPackIds(packDrafts, initialPackDrafts)

  return (
    <section
      data-testid='capability-pack-review-panel'
      className='rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-4'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h4 className='text-base font-semibold'>Review changes</h4>
          <p className='mt-1 text-sm text-muted-foreground'>
            This review groups cross-pack settings, pack enablement, and
            pack-specific draft values before `Save & Run`.
          </p>
        </div>
        <Button type='button' disabled>
          <Save className='me-2 size-4' />
          Save & Run
        </Button>
      </div>

      <div className='mt-4 grid gap-4 lg:grid-cols-2'>
        <div className='rounded-md border bg-background px-4 py-3'>
          <h5 className='text-sm font-semibold'>Cross-pack changes</h5>
          <ul className='mt-2 space-y-1 text-sm text-muted-foreground'>
            {changedCrossPackControls.length > 0 ? (
              changedCrossPackControls.map((control) => (
                <li key={control}>{control}</li>
              ))
            ) : (
              <li>No cross-pack changes in draft.</li>
            )}
          </ul>
        </div>
        <div className='rounded-md border bg-background px-4 py-3'>
          <h5 className='text-sm font-semibold'>Pack changes</h5>
          <ul className='mt-2 space-y-1 text-sm text-muted-foreground'>
            {changedPacks.length > 0 ? (
              changedPacks.map((packId) => {
                const pack = capabilityPackCatalog.find(
                  (item) => item.id === packId,
                )
                return <li key={packId}>{pack?.label ?? packId}</li>
              })
            ) : (
              <li>No pack changes in draft.</li>
            )}
          </ul>
        </div>
      </div>

      <div className='mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3'>
        <h5 className='text-sm font-semibold text-destructive'>
          Backend handoff needed
        </h5>
        <p className='mt-2 text-sm text-destructive'>
          The frontend UI is ready to review capability-pack changes, but the
          backend capability-pack contract is not available from this repo yet.
        </p>
        <div className='mt-3 space-y-1 text-xs text-destructive'>
          <p>
            <span className='font-medium'>Route:</span>{' '}
            <code>/settings/configuration</code>
          </p>
          <p>
            <span className='font-medium'>Blocking operation:</span>{' '}
            <code>planCapabilityPackConfig</code>
          </p>
          <p>
            <span className='font-medium'>Follow-up operation:</span>{' '}
            <code>applyCapabilityPackConfig</code>
          </p>
        </div>
      </div>
    </section>
  )
}

function ConfigSectionPanel({
  section,
  drafts,
  initialDrafts,
  onDraftChange,
}: {
  section: RuntimeConfigSection
  drafts: Drafts
  initialDrafts: Drafts
  onDraftChange: (field: RuntimeConfigField, value: string) => void
}) {
  const fields = sortedFields(section)
  return (
    <section className='rounded-md border bg-background px-4 py-3'>
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h3 className='text-base font-semibold'>{section.title}</h3>
          <p className='mt-1 text-sm text-muted-foreground'>
            {section.description}
          </p>
        </div>
        {section.advanced && <Badge variant='outline'>Advanced</Badge>}
      </div>
      <Separator className='mt-4' />
      <div className='divide-y'>
        {fields.map((field) => {
          const key = fieldDraftKey(field)
          const draft = drafts[key] ?? ''
          return (
            <ConfigFieldRow
              key={key}
              field={field}
              draft={draft}
              dirty={draft !== (initialDrafts[key] ?? '')}
              onChange={(value) => onDraftChange(field, value)}
            />
          )
        })}
      </div>
    </section>
  )
}

export function SettingsConfiguration() {
  const [targets, setTargets] = useState<RuntimeConfigTarget[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [snapshot, setSnapshot] = useState<RuntimeConfigSnapshot | null>(null)
  const [drafts, setDrafts] = useState<Drafts>({})
  const [initialDrafts, setInitialDrafts] = useState<Drafts>({})
  const [loadingTargets, setLoadingTargets] = useState(true)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [crossPackPreferences, setCrossPackPreferences] =
    useState<CrossPackPreferences>(() => defaultCrossPackPreferences())
  const [initialCrossPackPreferences] = useState<CrossPackPreferences>(() =>
    defaultCrossPackPreferences(),
  )
  const [capabilityPackDrafts, setCapabilityPackDrafts] =
    useState<CapabilityPackDrafts>(() => defaultCapabilityPackDrafts())
  const [initialCapabilityPackDrafts] = useState<CapabilityPackDrafts>(() =>
    defaultCapabilityPackDrafts(),
  )
  const [expandedPackIds, setExpandedPackIds] = useState<string[]>(
    defaultExpandedPackIds,
  )
  const [reviewOpen, setReviewOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoadingTargets(true)
    setError(null)
    fetchRuntimeConfigTargets({ signal: controller.signal })
      .then((loadedTargets) => {
        setTargets(loadedTargets)
        setSelectedTargetId((current) => {
          if (
            current &&
            loadedTargets.some((target) => target.id === current)
          ) {
            return current
          }
          return loadedTargets[0]?.id ?? ''
        })
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(errorMessage(err))
      })
      .finally(() => setLoadingTargets(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedTargetId) {
      setSnapshot(null)
      setDrafts({})
      setInitialDrafts({})
      return
    }
    const controller = new AbortController()
    setLoadingSnapshot(true)
    setError(null)
    setSaveMessage(null)
    fetchRuntimeConfigSnapshot(selectedTargetId, { signal: controller.signal })
      .then((loadedSnapshot) => {
        const nextDrafts = buildDrafts(loadedSnapshot)
        setSnapshot(loadedSnapshot)
        setDrafts(nextDrafts)
        setInitialDrafts(nextDrafts)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(errorMessage(err))
      })
      .finally(() => setLoadingSnapshot(false))
    return () => controller.abort()
  }, [selectedTargetId])

  const dirty = useMemo(() => {
    return Object.keys(drafts).some((key) => drafts[key] !== initialDrafts[key])
  }, [drafts, initialDrafts])
  const capabilityPackDirty = useMemo(
    () =>
      crossPackDirty(crossPackPreferences, initialCrossPackPreferences) ||
      capabilityPackDraftsDirty(
        capabilityPackDrafts,
        initialCapabilityPackDrafts,
      ),
    [
      capabilityPackDrafts,
      crossPackPreferences,
      initialCapabilityPackDrafts,
      initialCrossPackPreferences,
    ],
  )

  const selectedTarget = targets.find(
    (target) => target.id === selectedTargetId,
  )

  function handleDraftChange(field: RuntimeConfigField, value: string) {
    setDrafts((current) => ({
      ...current,
      [fieldDraftKey(field)]: value,
    }))
  }

  function handleCrossPackChange<K extends keyof CrossPackPreferences>(
    key: K,
    value: CrossPackPreferences[K],
  ) {
    setCrossPackPreferences((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function handleCapabilityPackToggle(id: CapabilityPackId, enabled: boolean) {
    setCapabilityPackDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        enabled,
      },
    }))
    setExpandedPackIds((current) => {
      if (enabled) {
        return current.includes(id) ? current : [...current, id]
      }

      return current.filter((packId) => packId !== id)
    })
  }

  function handleCapabilityPackExpandToggle(id: CapabilityPackId) {
    setExpandedPackIds((current) =>
      current.includes(id)
        ? current.filter((packId) => packId !== id)
        : [...current, id],
    )
  }

  function handleGuidedSettingChange(
    id: CapabilityPackId,
    key: string,
    value: string,
  ) {
    setCapabilityPackDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        guidedSettings: {
          ...current[id].guidedSettings,
          [key]: value,
        },
      },
    }))
  }

  function handleResetCapabilityPackDraft() {
    setCrossPackPreferences(initialCrossPackPreferences)
    setCapabilityPackDrafts(initialCapabilityPackDrafts)
    setExpandedPackIds(defaultExpandedPackIds())
    setReviewOpen(false)
  }

  function handleOpenReview() {
    if (!capabilityPackDirty) return
    setReviewOpen(true)
  }

  async function handleRuntimeConfigSave() {
    if (!snapshot || !dirty) return

    const patches: RuntimeConfigFieldPatch[] = []
    try {
      for (const section of snapshot.sections) {
        for (const field of section.fields) {
          const key = fieldDraftKey(field)
          if ((drafts[key] ?? '') === (initialDrafts[key] ?? '')) continue
          patches.push({
            path: field.path,
            value: parseFieldDraft(field, drafts[key] ?? ''),
          })
        }
      }
    } catch (err: unknown) {
      setError(errorMessage(err))
      return
    }

    setSaving(true)
    setError(null)
    setSaveMessage(null)
    try {
      const updated = await updateRuntimeConfig({
        targetId: snapshot.target.id,
        expectedRevision: snapshot.revision,
        patches,
      })
      const nextDrafts = buildDrafts(updated)
      setSnapshot(updated)
      setDrafts(nextDrafts)
      setInitialDrafts(nextDrafts)
      setSaveMessage('Runtime config saved.')
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function handleRuntimeConfigReset() {
    setDrafts(initialDrafts)
    setError(null)
    setSaveMessage(null)
  }

  const sections = snapshot ? sortedSections(snapshot.sections) : []

  return (
    <div className='flex flex-1 flex-col'>
      <div className='flex-none space-y-3'>
        <div>
          <h3 className='text-lg font-medium'>Configuration</h3>
          <p className='text-sm text-muted-foreground'>
            Edit runtime-discovered Bitloops config files without leaving the
            dashboard.
          </p>
        </div>
        <section className='rounded-md border bg-background px-4 py-4'>
          <div className='flex flex-wrap items-start justify-between gap-3'>
            <div>
              <h3 className='text-base font-semibold'>Capability Packs</h3>
              <p className='mt-1 text-sm text-muted-foreground'>
                Configure cross-pack behavior first, then expand each capability
                pack for guided or advanced settings.
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {capabilityPackDirty ? (
                <Badge variant='outline'>Draft changes</Badge>
              ) : (
                <Badge variant='secondary'>No draft changes</Badge>
              )}
              <Badge variant='outline'>Backend handoff aware</Badge>
            </div>
          </div>

          <Separator className='my-4' />
          <CrossPackControls
            preferences={crossPackPreferences}
            onToggle={handleCrossPackChange}
          />

          <div className='mt-4 grid gap-4'>
            {capabilityPackCatalog.map((pack) => (
              <CapabilityPackCard
                key={pack.id}
                pack={pack}
                draft={capabilityPackDrafts[pack.id]}
                expanded={expandedPackIds.includes(pack.id)}
                sections={advancedSectionsForPack(sections, pack)}
                drafts={drafts}
                initialDrafts={initialDrafts}
                onToggleEnabled={(enabled) =>
                  handleCapabilityPackToggle(pack.id, enabled)
                }
                onToggleExpanded={() =>
                  handleCapabilityPackExpandToggle(pack.id)
                }
                onGuidedSettingChange={(key, value) =>
                  handleGuidedSettingChange(pack.id, key, value)
                }
                onDraftChange={handleDraftChange}
              />
            ))}
          </div>

          <div className='mt-4 flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={handleResetCapabilityPackDraft}
              disabled={!capabilityPackDirty}
            >
              <RotateCcw className='me-2 size-4' />
              Reset draft
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={handleOpenReview}
              disabled={!capabilityPackDirty}
            >
              Review changes
            </Button>
            {!reviewOpen ? (
              <Button
                type='button'
                onClick={handleOpenReview}
                disabled={!capabilityPackDirty}
              >
                <Save className='me-2 size-4' />
                Save & Run
              </Button>
            ) : null}
          </div>

          {reviewOpen ? (
            <div className='mt-4'>
              <CapabilityPackReviewPanel
                crossPackPreferences={crossPackPreferences}
                initialCrossPackPreferences={initialCrossPackPreferences}
                packDrafts={capabilityPackDrafts}
                initialPackDrafts={initialCapabilityPackDrafts}
              />
            </div>
          ) : null}
        </section>
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <h3 className='text-base font-semibold'>Advanced runtime config</h3>
            <p className='mt-1 text-sm text-muted-foreground'>
              The existing runtime-config editor stays available for raw config
              targets while capability-pack backend contracts are still missing.
            </p>
          </div>
          <div className='space-y-2'>
            <Label>Config target</Label>
            <Select
              value={selectedTargetId}
              onValueChange={setSelectedTargetId}
              disabled={loadingTargets || targets.length === 0}
            >
              <SelectTrigger className='w-full min-w-[280px] lg:w-[460px]'>
                <SelectValue placeholder='Select config file' />
              </SelectTrigger>
              <SelectContent>
                {targetGroups(targets).map(([group, groupTargets]) => (
                  <SelectGroup key={group}>
                    <SelectLabel>{group}</SelectLabel>
                    {groupTargets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        {target.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={handleRuntimeConfigReset}
              disabled={!dirty || saving}
            >
              <RotateCcw className='me-2 size-4' />
              Reset runtime config
            </Button>
            <Button
              type='button'
              onClick={handleRuntimeConfigSave}
              disabled={!dirty || saving || loadingSnapshot}
            >
              {saving ? (
                <Loader2 className='me-2 size-4 animate-spin' />
              ) : (
                <Save className='me-2 size-4' />
              )}
              Save runtime config
            </Button>
          </div>
        </div>
        {selectedTarget && (
          <div className='flex flex-wrap items-center gap-2 text-sm text-muted-foreground'>
            <Badge variant='secondary'>{selectedTarget.scope}</Badge>
            <span className='break-all'>
              {displayPath(selectedTarget.path)}
            </span>
          </div>
        )}
        {snapshot && (
          <div className='flex flex-wrap gap-2'>
            {snapshot.restartRequired && (
              <Badge variant='outline'>Restart required</Badge>
            )}
            {snapshot.reloadRequired && (
              <Badge variant='outline'>Reload required</Badge>
            )}
            {snapshot.valid ? (
              <Badge className='gap-1'>
                <CheckCircle2 className='size-3' />
                Valid
              </Badge>
            ) : (
              <Badge variant='destructive' className='gap-1'>
                <AlertCircle className='size-3' />
                Invalid
              </Badge>
            )}
          </div>
        )}
        {error && (
          <div
            role='alert'
            className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          >
            {error}
          </div>
        )}
        {saveMessage && (
          <div className='rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>
            {saveMessage}
          </div>
        )}
        {snapshot?.validationErrors.length ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {snapshot.validationErrors.join('\n')}
          </div>
        ) : null}
      </div>
      <Separator className='my-4 flex-none' />
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        {loadingTargets || loadingSnapshot ? (
          <div className='flex items-center gap-2 py-8 text-sm text-muted-foreground'>
            <Loader2 className='size-4 animate-spin' />
            Loading configuration
          </div>
        ) : sections.length > 0 ? (
          <div
            className={cn(
              'grid gap-4',
              snapshot?.target.kind === 'daemon' ? 'xl:grid-cols-2' : '',
            )}
          >
            {sections.map((section) => (
              <ConfigSectionPanel
                key={section.key}
                section={section}
                drafts={drafts}
                initialDrafts={initialDrafts}
                onDraftChange={handleDraftChange}
              />
            ))}
          </div>
        ) : (
          <div className='py-8 text-sm text-muted-foreground'>
            No existing Bitloops config targets were found.
          </div>
        )}
      </div>
    </div>
  )
}
