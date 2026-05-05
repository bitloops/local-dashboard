import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
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

  const selectedTarget = targets.find(
    (target) => target.id === selectedTargetId,
  )

  function handleDraftChange(field: RuntimeConfigField, value: string) {
    setDrafts((current) => ({
      ...current,
      [fieldDraftKey(field)]: value,
    }))
  }

  async function handleSave() {
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
      setSaveMessage('Configuration saved.')
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
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
        <div className='flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between'>
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
              onClick={handleReset}
              disabled={!dirty || saving}
            >
              <RotateCcw className='me-2 size-4' />
              Reset
            </Button>
            <Button
              type='button'
              onClick={handleSave}
              disabled={!dirty || saving || loadingSnapshot}
            >
              {saving ? (
                <Loader2 className='me-2 size-4 animate-spin' />
              ) : (
                <Save className='me-2 size-4' />
              )}
              Save
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
