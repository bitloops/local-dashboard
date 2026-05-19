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
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

type Drafts = Record<string, string>

type CapabilityPackId =
  | 'architecture-graph'
  | 'context-guidance'
  | 'semantic-clones'
  | 'knowledge-pack'
  | 'test-harness'

type CapabilityPackDefinition = {
  id: CapabilityPackId
  label: string
  summary: string
  directPrefixes: string[][]
  relatedFieldPaths?: string[][]
}

type DisplaySection = Omit<RuntimeConfigSection, 'fields'> & {
  fields: RuntimeConfigField[]
  note?: string
}

type InferenceBindingView = {
  key: string
  label: string
  description: string
  field: RuntimeConfigField
  sections: DisplaySection[]
}

type ProviderChoiceView = {
  key: string
  label: string
  sections: DisplaySection[]
}

type ProviderListView = {
  key: string
  title: string
  description: string
  providers: ProviderChoiceView[]
}

type PackContentItem =
  | { kind: 'section'; key: string; section: DisplaySection }
  | { kind: 'binding'; key: string; binding: InferenceBindingView }
  | { kind: 'providers'; key: string; providers: ProviderListView }

type CapabilityPackCardView = {
  id: CapabilityPackId
  label: string
  summary: string
  items: PackContentItem[]
}

type FieldOwnershipKind =
  | 'pack-direct'
  | 'shared-inference-runtime'
  | 'supporting-dependency'

type FieldOwnership = {
  kind: FieldOwnershipKind
  ownerPackId: CapabilityPackId
  ownerPackLabel: string
}

type ReviewGroups = {
  packDirect: string[]
  sharedInferenceRuntime: string[]
  supportingDependency: string[]
}

type SectionFieldEntry = {
  section: RuntimeConfigSection
  field: RuntimeConfigField
}

type SharedBlockOwner = {
  locationKey: string
  ownerPackId: CapabilityPackId
  ownerPackLabel: string
}

type PackLayout = {
  visiblePacks: CapabilityPackCardView[]
  ownershipByFieldKey: Map<string, FieldOwnership>
}

type SeedFieldSpec = {
  path: string[]
  label: string
  description: string
  fieldType: string
  value: unknown
}

type SeedSectionSpec = {
  key: string
  title: string
  description: string
  order: number
  fields: SeedFieldSpec[]
}

const capabilityPackDefinitions: CapabilityPackDefinition[] = [
  {
    id: 'architecture-graph',
    label: 'Architecture graph',
    summary: 'Components, contracts, entry points, and system facts.',
    directPrefixes: [['architecture']],
  },
  {
    id: 'context-guidance',
    label: 'Context Guidance',
    summary: 'Repository-aware guidance generation and prompt assembly.',
    directPrefixes: [['context_guidance']],
  },
  {
    id: 'semantic-clones',
    label: 'Semantic clones',
    summary: 'Clone scoring, enrichment, and inference bindings.',
    directPrefixes: [['semantic_clones']],
  },
  {
    id: 'knowledge-pack',
    label: 'Knowledge pack',
    summary: 'Knowledge providers, refresh cadence, and durable records.',
    directPrefixes: [['knowledge']],
  },
  {
    id: 'test-harness',
    label: 'Test harness',
    summary: 'Adapters, dependency toggles, coverage, and test evidence.',
    directPrefixes: [['test_harness']],
    relatedFieldPaths: [['stores', 'relational', 'sqlite_path']],
  },
]

const inferenceProfileFieldOrder = [
  'task',
  'driver',
  'runtime',
  'model',
  'api_key',
  'base_url',
  'temperature',
  'max_output_tokens',
  'thinking_level',
]

const inferenceRuntimeFieldOrder = [
  'command',
  'args',
  'startup_timeout_secs',
  'request_timeout_secs',
]

const knowledgeProviderFieldOrder = ['enabled', 'site_url', 'email', 'token']

const providerLabels = new Map<string, string>([
  ['github', 'GitHub'],
  ['atlassian', 'Atlassian'],
])

const UNSET_SELECT_VALUE = '__unset__'

const inferenceTaskOptions = [
  'embeddings',
  'text_generation',
  'structured_generation',
]

const inferenceEmbeddingDriverOptions = ['bitloops_embeddings_ipc']

const inferenceTextGenerationDriverOptions = [
  'bitloops_platform_chat',
  'openai_chat_completions',
  'ollama_chat',
]

const inferenceStructuredGenerationDriverOptions = [
  'codex_exec',
  'claude_code_print',
]

const inferenceThinkingLevelOptions = ['low', 'medium', 'high']

const missingPackSeedSections: SeedSectionSpec[] = [
  {
    key: 'architecture',
    title: 'Architecture',
    description: 'Architecture graph configuration',
    order: 5,
    fields: [
      {
        path: ['architecture', 'inference', 'fact_synthesis'],
        label: 'Fact synthesis',
        description: 'Profile binding for architecture fact synthesis.',
        fieldType: 'string',
        value: 'architecture_fact_synthesis',
      },
      {
        path: ['architecture', 'inference', 'role_adjudication'],
        label: 'Role adjudication',
        description: 'Profile binding for architecture role adjudication.',
        fieldType: 'string',
        value: 'architecture_role_adjudication',
      },
    ],
  },
  {
    key: 'context_guidance',
    title: 'Context Guidance',
    description: 'Repository-aware guidance settings',
    order: 6,
    fields: [
      {
        path: ['context_guidance', 'inference', 'guidance_generation'],
        label: 'Guidance generation',
        description: 'Profile binding for context guidance.',
        fieldType: 'string',
        value: 'guidance_llm',
      },
    ],
  },
  {
    key: 'semantic_clones',
    title: 'Semantic clones',
    description: 'Semantic clone enrichment settings',
    order: 7,
    fields: [
      {
        path: ['semantic_clones', 'summary_mode'],
        label: 'Summary mode',
        description: 'Controls semantic summary generation.',
        fieldType: 'string',
        value: 'auto',
      },
      {
        path: ['semantic_clones', 'embedding_mode'],
        label: 'Embedding mode',
        description: 'Controls semantic clone embedding refresh behaviour.',
        fieldType: 'string',
        value: 'semantic_aware_once',
      },
      {
        path: ['semantic_clones', 'ann_neighbors'],
        label: 'ANN neighbours',
        description: 'Nearest-neighbour count for semantic clone lookup.',
        fieldType: 'integer',
        value: 5,
      },
      {
        path: ['semantic_clones', 'enrichment_workers'],
        label: 'Enrichment workers',
        description: 'Concurrent enrichment worker count.',
        fieldType: 'integer',
        value: 1,
      },
      {
        path: ['semantic_clones', 'inference', 'summary_generation'],
        label: 'Summary generation',
        description: 'Profile binding for semantic clone summary generation.',
        fieldType: 'string',
        value: 'summary_llm',
      },
    ],
  },
  {
    key: 'knowledge',
    title: 'Knowledge',
    description: 'Knowledge providers and refresh settings',
    order: 8,
    fields: [
      {
        path: ['knowledge', 'providers', 'github', 'token'],
        label: 'Token',
        description: 'knowledge.providers.github.token',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['knowledge', 'providers', 'atlassian', 'site_url'],
        label: 'Site URL',
        description: 'knowledge.providers.atlassian.site_url',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['knowledge', 'providers', 'atlassian', 'email'],
        label: 'Email',
        description: 'knowledge.providers.atlassian.email',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['knowledge', 'providers', 'atlassian', 'token'],
        label: 'Token',
        description: 'knowledge.providers.atlassian.token',
        fieldType: 'string',
        value: '',
      },
    ],
  },
  {
    key: 'test_harness',
    title: 'Test harness',
    description: 'Test harness adapters and coverage settings',
    order: 9,
    fields: [
      {
        path: ['test_harness', 'coverage_adapter'],
        label: 'Coverage adapter',
        description: 'test_harness.coverage_adapter',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['test_harness', 'test_discovery_adapter'],
        label: 'Test discovery adapter',
        description: 'test_harness.test_discovery_adapter',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['test_harness', 'language_support'],
        label: 'Language support',
        description: 'test_harness.language_support',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['test_harness', 'dependencies', 'coverage_adapter'],
        label: 'Coverage adapter dependency',
        description: 'test_harness.dependencies.coverage_adapter',
        fieldType: 'boolean',
        value: false,
      },
      {
        path: ['test_harness', 'dependencies', 'test_discovery_adapter'],
        label: 'Test discovery adapter dependency',
        description: 'test_harness.dependencies.test_discovery_adapter',
        fieldType: 'boolean',
        value: false,
      },
      {
        path: ['test_harness', 'dependencies', 'language_support'],
        label: 'Language support dependency',
        description: 'test_harness.dependencies.language_support',
        fieldType: 'boolean',
        value: false,
      },
      {
        path: ['test_harness', 'coverage', 'format'],
        label: 'Coverage format',
        description: 'test_harness.coverage.format',
        fieldType: 'string',
        value: 'lcov',
      },
    ],
  },
]

const supplementalSeedSections: SeedSectionSpec[] = [
  {
    key: 'inference_scaffolds',
    title: 'Inference scaffolds',
    description:
      'Suggested inference profiles and runtimes for capability-pack setup.',
    order: 10,
    fields: [
      {
        path: ['inference', 'runtimes', 'bitloops_inference', 'command'],
        label: 'Command',
        description: 'inference.runtimes.bitloops_inference.command',
        fieldType: 'string',
        value: 'bitloops-inference',
      },
      {
        path: ['inference', 'runtimes', 'bitloops_inference', 'args'],
        label: 'Args',
        description: 'inference.runtimes.bitloops_inference.args',
        fieldType: 'json',
        value: [],
      },
      {
        path: [
          'inference',
          'runtimes',
          'bitloops_inference',
          'startup_timeout_secs',
        ],
        label: 'Startup timeout secs',
        description:
          'inference.runtimes.bitloops_inference.startup_timeout_secs',
        fieldType: 'integer',
        value: 60,
      },
      {
        path: [
          'inference',
          'runtimes',
          'bitloops_inference',
          'request_timeout_secs',
        ],
        label: 'Request timeout secs',
        description:
          'inference.runtimes.bitloops_inference.request_timeout_secs',
        fieldType: 'integer',
        value: 300,
      },
      {
        path: ['inference', 'runtimes', 'codex', 'command'],
        label: 'Command',
        description: 'inference.runtimes.codex.command',
        fieldType: 'string',
        value: 'codex',
      },
      {
        path: ['inference', 'runtimes', 'codex', 'args'],
        label: 'Args',
        description: 'inference.runtimes.codex.args',
        fieldType: 'json',
        value: ['--ask-for-approval', 'never'],
      },
      {
        path: ['inference', 'runtimes', 'codex', 'startup_timeout_secs'],
        label: 'Startup timeout secs',
        description: 'inference.runtimes.codex.startup_timeout_secs',
        fieldType: 'integer',
        value: 5,
      },
      {
        path: ['inference', 'runtimes', 'codex', 'request_timeout_secs'],
        label: 'Request timeout secs',
        description: 'inference.runtimes.codex.request_timeout_secs',
        fieldType: 'integer',
        value: 900,
      },
      {
        path: ['inference', 'runtimes', 'claude', 'command'],
        label: 'Command',
        description: 'inference.runtimes.claude.command',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['inference', 'runtimes', 'claude', 'args'],
        label: 'Args',
        description: 'inference.runtimes.claude.args',
        fieldType: 'json',
        value: [],
      },
      {
        path: ['inference', 'runtimes', 'claude', 'startup_timeout_secs'],
        label: 'Startup timeout secs',
        description: 'inference.runtimes.claude.startup_timeout_secs',
        fieldType: 'integer',
        value: 5,
      },
      {
        path: ['inference', 'runtimes', 'claude', 'request_timeout_secs'],
        label: 'Request timeout secs',
        description: 'inference.runtimes.claude.request_timeout_secs',
        fieldType: 'integer',
        value: 900,
      },
      {
        path: ['inference', 'runtimes', 'bitloops_local_embeddings', 'command'],
        label: 'Command',
        description: 'inference.runtimes.bitloops_local_embeddings.command',
        fieldType: 'string',
        value: 'bitloops-local-embeddings',
      },
      {
        path: ['inference', 'runtimes', 'bitloops_local_embeddings', 'args'],
        label: 'Args',
        description: 'inference.runtimes.bitloops_local_embeddings.args',
        fieldType: 'json',
        value: [],
      },
      {
        path: [
          'inference',
          'runtimes',
          'bitloops_local_embeddings',
          'startup_timeout_secs',
        ],
        label: 'Startup timeout secs',
        description:
          'inference.runtimes.bitloops_local_embeddings.startup_timeout_secs',
        fieldType: 'integer',
        value: 60,
      },
      {
        path: [
          'inference',
          'runtimes',
          'bitloops_local_embeddings',
          'request_timeout_secs',
        ],
        label: 'Request timeout secs',
        description:
          'inference.runtimes.bitloops_local_embeddings.request_timeout_secs',
        fieldType: 'integer',
        value: 300,
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'task'],
        label: 'Task',
        description: 'inference.profiles.summary_llm.task',
        fieldType: 'string',
        value: 'text_generation',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'driver'],
        label: 'Driver',
        description: 'inference.profiles.summary_llm.driver',
        fieldType: 'string',
        value: 'openai_chat_completions',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'runtime'],
        label: 'Runtime',
        description: 'inference.profiles.summary_llm.runtime',
        fieldType: 'string',
        value: 'bitloops_inference',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'model'],
        label: 'Model',
        description: 'inference.profiles.summary_llm.model',
        fieldType: 'string',
        value: 'gpt-5.4-mini',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'api_key'],
        label: 'API key',
        description: 'inference.profiles.summary_llm.api_key',
        fieldType: 'string',
        value: '${OPENAI_API_KEY}',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'base_url'],
        label: 'Base URL',
        description: 'inference.profiles.summary_llm.base_url',
        fieldType: 'string',
        value: 'https://api.openai.com/v1/chat/completions',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'temperature'],
        label: 'Temperature',
        description: 'inference.profiles.summary_llm.temperature',
        fieldType: 'string',
        value: '0.1',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'max_output_tokens'],
        label: 'Max output tokens',
        description: 'inference.profiles.summary_llm.max_output_tokens',
        fieldType: 'integer',
        value: 200,
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'task'],
        label: 'Task',
        description: 'inference.profiles.guidance_llm.task',
        fieldType: 'string',
        value: 'text_generation',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'driver'],
        label: 'Driver',
        description: 'inference.profiles.guidance_llm.driver',
        fieldType: 'string',
        value: 'bitloops_platform_chat',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'runtime'],
        label: 'Runtime',
        description: 'inference.profiles.guidance_llm.runtime',
        fieldType: 'string',
        value: 'bitloops_inference',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'model'],
        label: 'Model',
        description: 'inference.profiles.guidance_llm.model',
        fieldType: 'string',
        value: 'ministral-3-3b-instruct',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'api_key'],
        label: 'API key',
        description: 'inference.profiles.guidance_llm.api_key',
        fieldType: 'string',
        value: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'temperature'],
        label: 'Temperature',
        description: 'inference.profiles.guidance_llm.temperature',
        fieldType: 'string',
        value: '0.1',
      },
      {
        path: ['inference', 'profiles', 'guidance_llm', 'max_output_tokens'],
        label: 'Max output tokens',
        description: 'inference.profiles.guidance_llm.max_output_tokens',
        fieldType: 'integer',
        value: 4096,
      },
      {
        path: ['inference', 'profiles', 'local_code', 'task'],
        label: 'Task',
        description: 'inference.profiles.local_code.task',
        fieldType: 'string',
        value: 'embeddings',
      },
      {
        path: ['inference', 'profiles', 'local_code', 'driver'],
        label: 'Driver',
        description: 'inference.profiles.local_code.driver',
        fieldType: 'string',
        value: 'bitloops_embeddings_ipc',
      },
      {
        path: ['inference', 'profiles', 'local_code', 'runtime'],
        label: 'Runtime',
        description: 'inference.profiles.local_code.runtime',
        fieldType: 'string',
        value: 'bitloops_local_embeddings',
      },
      {
        path: ['inference', 'profiles', 'local_code', 'model'],
        label: 'Model',
        description: 'inference.profiles.local_code.model',
        fieldType: 'string',
        value: 'bge-m3',
      },
      {
        path: ['inference', 'profiles', 'architecture_fact_synthesis', 'task'],
        label: 'Task',
        description: 'inference.profiles.architecture_fact_synthesis.task',
        fieldType: 'string',
        value: 'structured_generation',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'driver',
        ],
        label: 'Driver',
        description: 'inference.profiles.architecture_fact_synthesis.driver',
        fieldType: 'string',
        value: '',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'runtime',
        ],
        label: 'Runtime',
        description: 'inference.profiles.architecture_fact_synthesis.runtime',
        fieldType: 'string',
        value: '',
      },
      {
        path: ['inference', 'profiles', 'architecture_fact_synthesis', 'model'],
        label: 'Model',
        description: 'inference.profiles.architecture_fact_synthesis.model',
        fieldType: 'string',
        value: '',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'temperature',
        ],
        label: 'Temperature',
        description:
          'inference.profiles.architecture_fact_synthesis.temperature',
        fieldType: 'string',
        value: '0.1',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'max_output_tokens',
        ],
        label: 'Max output tokens',
        description:
          'inference.profiles.architecture_fact_synthesis.max_output_tokens',
        fieldType: 'integer',
        value: 4096,
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_fact_synthesis',
          'thinking_level',
        ],
        label: 'Thinking level',
        description:
          'inference.profiles.architecture_fact_synthesis.thinking_level',
        fieldType: 'string',
        value: '',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'task',
        ],
        label: 'Task',
        description: 'inference.profiles.architecture_role_adjudication.task',
        fieldType: 'string',
        value: 'structured_generation',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'driver',
        ],
        label: 'Driver',
        description: 'inference.profiles.architecture_role_adjudication.driver',
        fieldType: 'string',
        value: '',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'runtime',
        ],
        label: 'Runtime',
        description:
          'inference.profiles.architecture_role_adjudication.runtime',
        fieldType: 'string',
        value: '',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'model',
        ],
        label: 'Model',
        description: 'inference.profiles.architecture_role_adjudication.model',
        fieldType: 'string',
        value: '',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'temperature',
        ],
        label: 'Temperature',
        description:
          'inference.profiles.architecture_role_adjudication.temperature',
        fieldType: 'string',
        value: '0.1',
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'max_output_tokens',
        ],
        label: 'Max output tokens',
        description:
          'inference.profiles.architecture_role_adjudication.max_output_tokens',
        fieldType: 'integer',
        value: 1024,
      },
      {
        path: [
          'inference',
          'profiles',
          'architecture_role_adjudication',
          'thinking_level',
        ],
        label: 'Thinking level',
        description:
          'inference.profiles.architecture_role_adjudication.thinking_level',
        fieldType: 'string',
        value: '',
      },
    ],
  },
]

const seedFieldSpecsByPath = new Map(
  [...missingPackSeedSections, ...supplementalSeedSections].flatMap((section) =>
    section.fields.map((field) => [field.path.join('.'), field] as const),
  ),
)

function pathStartsWith(path: string[], prefix: string[]): boolean {
  return prefix.every((segment, index) => path[index] === segment)
}

function pathsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
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

function buildDrafts(sections: RuntimeConfigSection[]): Drafts {
  const drafts: Drafts = {}
  for (const section of sections) {
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

function resolveFieldValueFromDraft(
  field: RuntimeConfigField,
  draft: string | undefined,
): unknown {
  if (draft == null) {
    return field.value
  }

  if (field.fieldType === 'boolean') {
    return draft === 'true'
  }

  if (field.fieldType === 'integer') {
    const trimmed = draft.trim()
    if (!trimmed) return null
    const parsed = Number.parseInt(trimmed, 10)
    return Number.isFinite(parsed) ? parsed : field.value
  }

  if (field.fieldType === 'json') {
    try {
      return JSON.parse(draft)
    } catch {
      return field.value
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

function errorMessage(error: unknown): string {
  if (error instanceof GraphQLRequestError) return error.message
  if (error instanceof Error) return error.message
  return 'Runtime config request failed.'
}

function displayNameFromId(id: string): string {
  const directLabel = providerLabels.get(id)
  if (directLabel) return directLabel
  return id
    .split(/[_-]/g)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(' ')
}

function displayLabelFromKey(key: string): string {
  return key
    .split(/[_-]/g)
    .filter(Boolean)
    .map((segment) => segment[0]?.toUpperCase() + segment.slice(1))
    .join(' ')
}

function inferSyntheticFieldType(value: unknown): string {
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number' && Number.isInteger(value)) return 'integer'
  if (typeof value === 'string') return 'string'
  return 'json'
}

function isExpandableJsonValue(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

function isSecretLikePath(path: string[]) {
  const key = path[path.length - 1]?.toLowerCase() ?? ''
  return ['token', 'api_key', 'password', 'secret'].includes(key)
}

function buildSyntheticFieldsFromValue(params: {
  basePath: string[]
  value: unknown
  existingPaths: Set<string>
  startingOrder: number
}): RuntimeConfigField[] {
  const syntheticFields: RuntimeConfigField[] = []
  let order = params.startingOrder

  function visit(path: string[], value: unknown) {
    if (value == null) return

    if (Array.isArray(value)) {
      const key = path.join('.')
      const seedField = seedFieldSpecsByPath.get(key)
      if (params.existingPaths.has(key)) return
      params.existingPaths.add(key)
      syntheticFields.push({
        key,
        path,
        label:
          seedField?.label ?? displayLabelFromKey(path[path.length - 1] ?? key),
        description: seedField?.description ?? key,
        fieldType: seedField?.fieldType ?? 'json',
        value,
        effectiveValue: value,
        defaultValue: null,
        allowedValues: [],
        validationHints: ['Enter valid JSON.'],
        required: false,
        readOnly: false,
        secret: isSecretLikePath(path),
        order: order++,
        source: 'effective',
      })
      return
    }

    if (isExpandableJsonValue(value)) {
      for (const [childKey, childValue] of Object.entries(value)) {
        visit([...path, childKey], childValue)
      }
      return
    }

    const key = path.join('.')
    const seedField = seedFieldSpecsByPath.get(key)
    if (params.existingPaths.has(key)) return
    params.existingPaths.add(key)
    syntheticFields.push({
      key,
      path,
      label:
        seedField?.label ?? displayLabelFromKey(path[path.length - 1] ?? key),
      description: seedField?.description ?? key,
      fieldType: seedField?.fieldType ?? inferSyntheticFieldType(value),
      value,
      effectiveValue: value,
      defaultValue: null,
      allowedValues: [],
      validationHints: [],
      required: false,
      readOnly: false,
      secret: isSecretLikePath(path),
      order: order++,
      source: 'effective',
    })
  }

  visit(params.basePath, params.value)
  return syntheticFields
}

function createSeedField(
  seed: SeedFieldSpec,
  order: number,
): RuntimeConfigField {
  const key = seed.path.join('.')
  return {
    key,
    path: seed.path,
    label: seed.label,
    description: seed.description,
    fieldType: seed.fieldType,
    value: seed.value,
    effectiveValue: seed.value,
    defaultValue: null,
    allowedValues: [],
    validationHints: [],
    required: false,
    readOnly: false,
    secret: isSecretLikePath(seed.path),
    order,
    source: 'effective',
  }
}

function hasMeaningfulSeedValue(value: unknown) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function isUnsetFieldValue(value: unknown) {
  return (
    value == null || (typeof value === 'string' && value.trim().length === 0)
  )
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueAllowedValues(values: string[], currentValue: unknown) {
  const ordered = [...values]
  const current = stringValue(currentValue)
  if (current && !ordered.includes(current)) {
    ordered.push(current)
  }
  return ordered
}

type DynamicOptionContext = {
  profileIds: string[]
  runtimeIds: string[]
  profileTaskById: Map<string, string>
}

function buildDynamicOptionContext(
  sections: RuntimeConfigSection[],
): DynamicOptionContext {
  const profileIds = new Set<string>()
  const runtimeIds = new Set<string>()
  const profileTaskById = new Map<string, string>()

  for (const section of sections) {
    for (const field of section.fields) {
      if (pathStartsWith(field.path, ['inference', 'profiles'])) {
        const profileId = field.path[2]
        if (profileId) {
          profileIds.add(profileId)
          if (field.path[3] === 'task') {
            const task = stringValue(field.value)
            if (task) {
              profileTaskById.set(profileId, task)
            }
          }
        }
      }

      if (pathStartsWith(field.path, ['inference', 'runtimes'])) {
        const runtimeId = field.path[2]
        if (runtimeId) {
          runtimeIds.add(runtimeId)
        }
      }
    }
  }

  return {
    profileIds: [...profileIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    runtimeIds: [...runtimeIds].sort((left, right) =>
      left.localeCompare(right),
    ),
    profileTaskById,
  }
}

function preferredTaskForBinding(path: string[]) {
  if (!path.includes('inference')) return null
  if (path[0] === 'architecture') return 'structured_generation'
  if (path[0] === 'context_guidance') return 'text_generation'
  if (path[0] === 'semantic_clones') {
    const slotName = path[path.length - 1] ?? ''
    if (slotName.includes('embedding')) return 'embeddings'
    if (slotName.includes('summary')) return 'text_generation'
  }
  return null
}

function profileIdsForBinding(
  field: RuntimeConfigField,
  options: DynamicOptionContext,
) {
  const preferredTask = preferredTaskForBinding(field.path)
  if (!preferredTask) {
    return uniqueAllowedValues(options.profileIds, field.value)
  }

  const matchingProfiles = options.profileIds.filter(
    (profileId) => options.profileTaskById.get(profileId) === preferredTask,
  )
  return uniqueAllowedValues(
    matchingProfiles.length > 0 ? matchingProfiles : options.profileIds,
    field.value,
  )
}

function driverOptionsForTask(task: string) {
  switch (task) {
    case 'embeddings':
      return inferenceEmbeddingDriverOptions
    case 'structured_generation':
      return inferenceStructuredGenerationDriverOptions
    case 'text_generation':
      return inferenceTextGenerationDriverOptions
    default:
      return []
  }
}

function applyFieldChoiceMetadata(
  field: RuntimeConfigField,
  options: DynamicOptionContext,
): RuntimeConfigField {
  let allowedValues = [...field.allowedValues]
  let fieldType = field.fieldType

  if (field.path.length === 3 && field.path.includes('inference')) {
    allowedValues = profileIdsForBinding(field, options)
  }

  if (
    pathStartsWith(field.path, ['inference', 'profiles']) &&
    field.path.length >= 4
  ) {
    const profileId = field.path[2]
    const fieldName = field.path[3]
    const task = options.profileTaskById.get(profileId)

    if (fieldName === 'task') {
      allowedValues = uniqueAllowedValues(inferenceTaskOptions, field.value)
    } else if (fieldName === 'driver' && task) {
      allowedValues = uniqueAllowedValues(
        driverOptionsForTask(task),
        field.value,
      )
    } else if (fieldName === 'runtime') {
      allowedValues = uniqueAllowedValues(options.runtimeIds, field.value)
    } else if (fieldName === 'thinking_level') {
      allowedValues = uniqueAllowedValues(
        inferenceThinkingLevelOptions,
        field.value,
      )
    }
  }

  if (allowedValues.length === 0) {
    return field
  }

  if (fieldType === 'string') {
    fieldType = 'enum'
  }

  return {
    ...field,
    fieldType,
    allowedValues,
  }
}

function applySeedDefaultToField(
  field: RuntimeConfigField,
): RuntimeConfigField {
  const seed = seedFieldSpecsByPath.get(field.path.join('.'))
  if (
    !seed ||
    !hasMeaningfulSeedValue(seed.value) ||
    !isUnsetFieldValue(field.value)
  ) {
    return field
  }

  return {
    ...field,
    value: seed.value,
    effectiveValue: isUnsetFieldValue(field.effectiveValue)
      ? seed.value
      : field.effectiveValue,
  }
}

function applyMissingSeedFields(
  section: RuntimeConfigSection,
  seedSection: SeedSectionSpec,
): RuntimeConfigSection {
  const existingPaths = new Set(
    section.fields.map((field) => field.path.join('.')),
  )
  const missingSeedFields = seedSection.fields
    .filter((seed) => !existingPaths.has(seed.path.join('.')))
    .map((seed, index) =>
      createSeedField(seed, section.fields.length + 2_000 + index),
    )

  if (missingSeedFields.length === 0) {
    return section
  }

  return {
    ...section,
    fields: sortedFieldList([...section.fields, ...missingSeedFields]),
  }
}

function applySupplementalSeedFields(
  sectionsByKey: Map<string, RuntimeConfigSection>,
  seedSection: SeedSectionSpec,
) {
  const existingPaths = new Set(
    [...sectionsByKey.values()].flatMap((section) =>
      section.fields.map((field) => field.path.join('.')),
    ),
  )
  const missingSeedFields = seedSection.fields
    .filter((seed) => !existingPaths.has(seed.path.join('.')))
    .map((seed, index) => createSeedField(seed, 4_000 + index))

  if (missingSeedFields.length === 0) {
    return
  }

  const existingSection = sectionsByKey.get(seedSection.key)
  if (existingSection) {
    sectionsByKey.set(seedSection.key, {
      ...existingSection,
      fields: sortedFieldList([
        ...existingSection.fields,
        ...missingSeedFields,
      ]),
    })
    return
  }

  sectionsByKey.set(seedSection.key, {
    key: seedSection.key,
    title: seedSection.title,
    description: seedSection.description,
    order: seedSection.order,
    advanced: false,
    value: {},
    effectiveValue: {},
    fields: missingSeedFields,
  })
}

function normalizeRuntimeSections(
  sections: RuntimeConfigSection[],
): RuntimeConfigSection[] {
  const normalizedSections = sections.map((section) => {
    const existingPaths = new Set(
      section.fields.map((field) => field.path.join('.')),
    )
    const syntheticFields = [
      ...buildSyntheticFieldsFromValue({
        basePath: [section.key],
        value: section.value,
        existingPaths,
        startingOrder: section.fields.length + 100,
      }),
      ...section.fields.flatMap((field, index) => {
        if (!isExpandableJsonValue(field.value)) return []
        return buildSyntheticFieldsFromValue({
          basePath: field.path,
          value: field.value,
          existingPaths,
          startingOrder: section.fields.length + 1000 + index * 100,
        })
      }),
    ]

    const filteredFields = section.fields.filter(
      (field) =>
        !(field.fieldType === 'json' && isExpandableJsonValue(field.value)),
    )

    return {
      ...section,
      advanced: false,
      fields: sortedFieldList([...filteredFields, ...syntheticFields]),
    }
  })

  const sectionsByKey = new Map(
    normalizedSections.map((section) => [section.key, section] as const),
  )

  for (const seedSection of missingPackSeedSections) {
    const existingSection = sectionsByKey.get(seedSection.key)
    if (existingSection) {
      sectionsByKey.set(
        seedSection.key,
        applyMissingSeedFields(existingSection, seedSection),
      )
      continue
    }

    sectionsByKey.set(seedSection.key, {
      key: seedSection.key,
      title: seedSection.title,
      description: seedSection.description,
      order: seedSection.order,
      advanced: false,
      value: {},
      effectiveValue: {},
      fields: seedSection.fields.map((seed, index) =>
        createSeedField(seed, index),
      ),
    })
  }

  for (const seedSection of supplementalSeedSections) {
    applySupplementalSeedFields(sectionsByKey, seedSection)
  }

  const seededSections = sortedSections(
    [...sectionsByKey.values()].map((section) => ({
      ...section,
      fields: sortedFieldList(section.fields.map(applySeedDefaultToField)),
    })),
  )

  const optionContext = buildDynamicOptionContext(seededSections)

  return seededSections.map((section) => ({
    ...section,
    fields: sortedFieldList(
      section.fields.map((field) =>
        applyFieldChoiceMetadata(field, optionContext),
      ),
    ),
  }))
}

function materializeSectionsForDrafts(
  sections: RuntimeConfigSection[],
  drafts: Drafts,
): RuntimeConfigSection[] {
  const sectionsWithDraftValues = sortedSections(
    sections.map((section) => ({
      ...section,
      fields: sortedFieldList(
        section.fields.map((field) => ({
          ...field,
          value: resolveFieldValueFromDraft(
            field,
            drafts[fieldDraftKey(field)],
          ),
        })),
      ),
    })),
  )

  const optionContext = buildDynamicOptionContext(sectionsWithDraftValues)

  return sectionsWithDraftValues.map((section) => ({
    ...section,
    fields: sortedFieldList(
      section.fields.map((field) =>
        applyFieldChoiceMetadata(field, optionContext),
      ),
    ),
  }))
}

function sortedSections<
  T extends Pick<RuntimeConfigSection, 'order' | 'title'>,
>(sections: T[]) {
  return [...sections].sort((left, right) => {
    return left.order - right.order || left.title.localeCompare(right.title)
  })
}

function pathTail(field: RuntimeConfigField) {
  return field.path[field.path.length - 1] ?? ''
}

function sortedFieldList(
  fields: RuntimeConfigField[],
  preferredPathTail: string[] = [],
) {
  const preferredOrder = new Map(
    preferredPathTail.map((segment, index) => [segment, index]),
  )
  return [...fields].sort((left, right) => {
    const leftPreferred =
      preferredOrder.get(pathTail(left)) ?? Number.MAX_SAFE_INTEGER
    const rightPreferred =
      preferredOrder.get(pathTail(right)) ?? Number.MAX_SAFE_INTEGER
    return (
      leftPreferred - rightPreferred ||
      left.order - right.order ||
      left.label.localeCompare(right.label)
    )
  })
}

function sortedFields(section: RuntimeConfigSection | DisplaySection) {
  return sortedFieldList(section.fields)
}

function flattenSections(
  sections: RuntimeConfigSection[],
): SectionFieldEntry[] {
  return sortedSections(sections).flatMap((section) =>
    sortedFields(section).map((field) => ({
      section,
      field,
    })),
  )
}

function groupEntriesByObjectPath(
  entries: SectionFieldEntry[],
  prefix: string[],
): Map<string, SectionFieldEntry[]> {
  const groups = new Map<string, SectionFieldEntry[]>()
  for (const entry of entries) {
    if (!pathStartsWith(entry.field.path, prefix)) continue
    const objectId = entry.field.path[prefix.length]
    if (!objectId) continue
    groups.set(objectId, [...(groups.get(objectId) ?? []), entry])
  }
  return groups
}

function sortedEntryList(entries: SectionFieldEntry[]) {
  return [...entries].sort((left, right) => {
    return (
      left.section.order - right.section.order ||
      left.field.order - right.field.order ||
      left.field.label.localeCompare(right.field.label)
    )
  })
}

function isInferenceBindingEntry(entry: SectionFieldEntry) {
  return entry.field.path[1] === 'inference'
}

function isKnowledgeProviderEntry(entry: SectionFieldEntry) {
  return entry.field.path[1] === 'providers'
}

function referencedProfileId(
  entry: SectionFieldEntry,
  profileBlocks: Map<string, SectionFieldEntry[]>,
) {
  return typeof entry.field.value === 'string' &&
    profileBlocks.has(entry.field.value)
    ? entry.field.value
    : null
}

function referencedRuntimeId(
  profileEntries: SectionFieldEntry[],
  runtimeBlocks: Map<string, SectionFieldEntry[]>,
) {
  const runtimeEntry = profileEntries.find(
    (entry) => pathTail(entry.field) === 'runtime',
  )
  return typeof runtimeEntry?.field.value === 'string' &&
    runtimeBlocks.has(runtimeEntry.field.value)
    ? runtimeEntry.field.value
    : null
}

function resolveSharedBlockOwner(
  sharedBlockOwners: Map<string, SharedBlockOwner>,
  blockKey: string,
  locationKey: string,
  pack: CapabilityPackDefinition,
) {
  const existingOwner = sharedBlockOwners.get(blockKey)
  if (existingOwner) return existingOwner

  const nextOwner: SharedBlockOwner = {
    locationKey,
    ownerPackId: pack.id,
    ownerPackLabel: pack.label,
  }
  sharedBlockOwners.set(blockKey, nextOwner)
  return nextOwner
}

function applyFieldOwnership(
  field: RuntimeConfigField,
  ownershipByFieldKey: Map<string, FieldOwnership>,
  ownership?: FieldOwnership,
  forceReadOnly = false,
) {
  const key = fieldDraftKey(field)
  const currentOwnership = ownershipByFieldKey.get(key)
  const ownedByOther =
    ownership != null &&
    currentOwnership != null &&
    currentOwnership.ownerPackId !== ownership.ownerPackId

  if (ownership != null && currentOwnership == null) {
    ownershipByFieldKey.set(key, ownership)
  }

  return {
    ...field,
    readOnly: forceReadOnly || field.readOnly || ownedByOther,
  }
}

function buildSectionViewsFromEntries(
  entries: SectionFieldEntry[],
  options: {
    sectionKeyPrefix: string
    ownershipByFieldKey: Map<string, FieldOwnership>
    ownership?: FieldOwnership
    forceReadOnly?: boolean
    note?: string
  },
): DisplaySection[] {
  const grouped = new Map<
    string,
    { section: RuntimeConfigSection; fields: RuntimeConfigField[] }
  >()

  for (const entry of entries) {
    const groupKey = entry.section.key
    const current = grouped.get(groupKey) ?? {
      section: entry.section,
      fields: [],
    }

    current.fields.push(
      applyFieldOwnership(
        entry.field,
        options.ownershipByFieldKey,
        options.ownership,
        options.forceReadOnly,
      ),
    )
    grouped.set(groupKey, current)
  }

  return sortedSections(
    [...grouped.values()].map(({ section, fields }) => ({
      ...section,
      key: `${options.sectionKeyPrefix}:${section.key}`,
      fields: sortedFieldList(fields),
      note: options.note,
    })),
  )
}

function buildNamedBlockSection(
  objectType: 'profile' | 'runtime',
  objectId: string,
  entries: SectionFieldEntry[],
  options: {
    currentLocationKey: string
    owner: SharedBlockOwner
    ownershipByFieldKey: Map<string, FieldOwnership>
  },
): DisplaySection {
  const section = entries[0]?.section
  const editable = options.owner.locationKey === options.currentLocationKey
  const ownership: FieldOwnership | undefined = editable
    ? {
        kind: 'shared-inference-runtime',
        ownerPackId: options.owner.ownerPackId,
        ownerPackLabel: options.owner.ownerPackLabel,
      }
    : undefined

  return {
    ...section,
    key: `${options.currentLocationKey}:${objectType}:${objectId}`,
    title: `Inference ${objectType} · ${objectId}`,
    description:
      objectType === 'profile'
        ? 'Resolved from the selected capability-pack binding.'
        : 'Runtime settings referenced by the selected inference profile.',
    fields: sortedFieldList(
      entries.map((entry) =>
        applyFieldOwnership(
          entry.field,
          options.ownershipByFieldKey,
          ownership,
          !editable,
        ),
      ),
      objectType === 'profile'
        ? inferenceProfileFieldOrder
        : inferenceRuntimeFieldOrder,
    ),
    note: editable
      ? undefined
      : `Shared with ${options.owner.ownerPackLabel}. Edit there.`,
  }
}

function buildKnowledgeProviderSection(
  providerId: string,
  entries: SectionFieldEntry[],
  options: {
    packId: CapabilityPackId
    packLabel: string
    ownershipByFieldKey: Map<string, FieldOwnership>
  },
): DisplaySection {
  const section = entries[0]?.section
  return {
    ...section,
    key: `${options.packId}:provider:${providerId}`,
    title: `Knowledge provider · ${displayNameFromId(providerId)}`,
    description: 'Provider-specific credentials and connection settings.',
    fields: sortedFieldList(
      entries.map((entry) =>
        applyFieldOwnership(entry.field, options.ownershipByFieldKey, {
          kind: 'pack-direct',
          ownerPackId: options.packId,
          ownerPackLabel: options.packLabel,
        }),
      ),
      knowledgeProviderFieldOrder,
    ),
  }
}

function buildPackLayout(sections: RuntimeConfigSection[]): PackLayout {
  const entries = flattenSections(sections)
  const profileBlocks = groupEntriesByObjectPath(entries, [
    'inference',
    'profiles',
  ])
  const runtimeBlocks = groupEntriesByObjectPath(entries, [
    'inference',
    'runtimes',
  ])
  const ownershipByFieldKey = new Map<string, FieldOwnership>()
  const sharedBlockOwners = new Map<string, SharedBlockOwner>()
  const visiblePacks: CapabilityPackCardView[] = []

  for (const pack of capabilityPackDefinitions) {
    const directEntries = entries.filter(({ field }) =>
      pack.directPrefixes.some((prefix) => pathStartsWith(field.path, prefix)),
    )
    const dependencyEntries = entries.filter(({ field }) =>
      (pack.relatedFieldPaths ?? []).some((path) =>
        pathsEqual(field.path, path),
      ),
    )

    if (directEntries.length === 0 && dependencyEntries.length === 0) {
      continue
    }

    const items: PackContentItem[] = []
    const packOwnership: FieldOwnership = {
      kind: 'pack-direct',
      ownerPackId: pack.id,
      ownerPackLabel: pack.label,
    }
    const regularDirectEntries =
      pack.id === 'knowledge-pack'
        ? directEntries.filter((entry) => !isKnowledgeProviderEntry(entry))
        : directEntries.filter((entry) => !isInferenceBindingEntry(entry))

    items.push(
      ...buildSectionViewsFromEntries(regularDirectEntries, {
        sectionKeyPrefix: `${pack.id}:direct`,
        ownershipByFieldKey,
        ownership: packOwnership,
      }).map((section) => ({
        kind: 'section' as const,
        key: section.key,
        section,
      })),
    )

    if (pack.id === 'knowledge-pack') {
      const providerEntries = directEntries.filter(isKnowledgeProviderEntry)
      const providers = [
        ...groupEntriesByObjectPath(providerEntries, [
          'knowledge',
          'providers',
        ]).entries(),
      ].map(([providerId, providerFields]) => ({
        key: providerId,
        label: displayNameFromId(providerId),
        sections: [
          buildKnowledgeProviderSection(providerId, providerFields, {
            packId: pack.id,
            packLabel: pack.label,
            ownershipByFieldKey,
          }),
        ],
      }))

      if (providers.length > 0) {
        items.push({
          kind: 'providers',
          key: `${pack.id}:providers`,
          providers: {
            key: `${pack.id}:providers`,
            title: 'Knowledge providers',
            description:
              'Choose a provider to expand the exact credentials and connection settings backed by runtime config.',
            providers,
          },
        })
      }
    } else {
      for (const bindingEntry of sortedEntryList(
        directEntries.filter(isInferenceBindingEntry),
      )) {
        const locationKey = `${pack.id}:binding:${fieldDraftKey(bindingEntry.field)}`
        const bindingField = applyFieldOwnership(
          bindingEntry.field,
          ownershipByFieldKey,
          packOwnership,
        )
        const bindingSections: DisplaySection[] = []
        const profileId = referencedProfileId(bindingEntry, profileBlocks)
        const profileEntries = profileId
          ? (profileBlocks.get(profileId) ?? [])
          : []

        if (profileId && profileEntries.length > 0) {
          const profileOwner = resolveSharedBlockOwner(
            sharedBlockOwners,
            `profile:${profileId}`,
            `${locationKey}:profile:${profileId}`,
            pack,
          )
          bindingSections.push(
            buildNamedBlockSection('profile', profileId, profileEntries, {
              currentLocationKey: `${locationKey}:profile:${profileId}`,
              owner: profileOwner,
              ownershipByFieldKey,
            }),
          )

          const runtimeId = referencedRuntimeId(profileEntries, runtimeBlocks)
          const runtimeEntries = runtimeId
            ? (runtimeBlocks.get(runtimeId) ?? [])
            : []
          if (runtimeId && runtimeEntries.length > 0) {
            const runtimeOwner = resolveSharedBlockOwner(
              sharedBlockOwners,
              `runtime:${runtimeId}`,
              `${locationKey}:runtime:${runtimeId}`,
              pack,
            )
            bindingSections.push(
              buildNamedBlockSection('runtime', runtimeId, runtimeEntries, {
                currentLocationKey: `${locationKey}:runtime:${runtimeId}`,
                owner: runtimeOwner,
                ownershipByFieldKey,
              }),
            )
          }
        }

        items.push({
          kind: 'binding',
          key: locationKey,
          binding: {
            key: locationKey,
            label: bindingField.label,
            description:
              bindingField.description || bindingField.path.join('.'),
            field: bindingField,
            sections: bindingSections,
          },
        })
      }
    }

    if (dependencyEntries.length > 0) {
      items.push(
        ...buildSectionViewsFromEntries(dependencyEntries, {
          sectionKeyPrefix: `${pack.id}:dependency`,
          ownershipByFieldKey,
          ownership: {
            kind: 'supporting-dependency',
            ownerPackId: pack.id,
            ownerPackLabel: pack.label,
          },
        }).map((section) => ({
          kind: 'section' as const,
          key: section.key,
          section,
        })),
      )
    }

    visiblePacks.push({
      id: pack.id,
      label: pack.label,
      summary: pack.summary,
      items,
    })
  }

  return {
    visiblePacks,
    ownershipByFieldKey,
  }
}

function visiblePackIdsFromSections(
  sections: RuntimeConfigSection[],
): CapabilityPackId[] {
  return buildPackLayout(sections).visiblePacks.map((pack) => pack.id)
}

function buildReviewGroups(params: {
  sections: RuntimeConfigSection[]
  drafts: Drafts
  initialDrafts: Drafts
  ownershipByFieldKey: Map<string, FieldOwnership>
}): ReviewGroups {
  const groups: ReviewGroups = {
    packDirect: [],
    sharedInferenceRuntime: [],
    supportingDependency: [],
  }

  for (const section of sortedSections(params.sections)) {
    for (const field of sortedFields(section)) {
      const key = fieldDraftKey(field)
      if ((params.drafts[key] ?? '') === (params.initialDrafts[key] ?? '')) {
        continue
      }

      const ownership = params.ownershipByFieldKey.get(key)
      const label = ownership
        ? `${ownership.ownerPackLabel} · ${field.label}`
        : `${section.title} · ${field.label}`

      switch (ownership?.kind) {
        case 'pack-direct':
          groups.packDirect.push(label)
          break
        case 'shared-inference-runtime':
          groups.sharedInferenceRuntime.push(label)
          break
        case 'supporting-dependency':
          groups.supportingDependency.push(label)
          break
        default:
          break
      }
    }
  }

  return groups
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

  if (
    field.allowedValues.length > 0 &&
    field.fieldType !== 'boolean' &&
    field.fieldType !== 'json'
  ) {
    return (
      <Select
        value={value || undefined}
        onValueChange={(nextValue) =>
          onChange(nextValue === UNSET_SELECT_VALUE ? '' : nextValue)
        }
        disabled={field.readOnly}
      >
        <SelectTrigger className='w-full sm:w-[280px]'>
          <SelectValue placeholder='Select value' />
        </SelectTrigger>
        <SelectContent>
          {!field.required ? (
            <SelectItem value={UNSET_SELECT_VALUE}>Not configured</SelectItem>
          ) : null}
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
          {field.readOnly && <Badge variant='outline'>Read-only here</Badge>}
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
  section: DisplaySection
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
          {section.note ? (
            <p className='mt-1 text-xs leading-5 text-muted-foreground'>
              {section.note}
            </p>
          ) : null}
        </div>
        {section.advanced ? <Badge variant='outline'>Advanced</Badge> : null}
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

function InferenceBindingPanel({
  binding,
  drafts,
  initialDrafts,
  onDraftChange,
}: {
  binding: InferenceBindingView
  drafts: Drafts
  initialDrafts: Drafts
  onDraftChange: (field: RuntimeConfigField, value: string) => void
}) {
  const key = fieldDraftKey(binding.field)
  const draft = drafts[key] ?? ''

  return (
    <section className='rounded-md border bg-background px-4 py-4'>
      <div>
        <h3 className='text-base font-semibold'>{binding.label}</h3>
        <p className='mt-1 text-sm text-muted-foreground'>
          {binding.description}
        </p>
      </div>
      <Separator className='mt-4' />
      <div className='mt-4 space-y-3'>
        <section className='rounded-md border bg-background px-4 py-2'>
          <div className='divide-y'>
            <ConfigFieldRow
              field={binding.field}
              draft={draft}
              dirty={draft !== (initialDrafts[key] ?? '')}
              onChange={(value) => onDraftChange(binding.field, value)}
            />
          </div>
        </section>
        {binding.sections.map((section) => (
          <ConfigSectionPanel
            key={section.key}
            section={section}
            drafts={drafts}
            initialDrafts={initialDrafts}
            onDraftChange={onDraftChange}
          />
        ))}
      </div>
    </section>
  )
}

function KnowledgeProviderPanel({
  providers,
  drafts,
  initialDrafts,
  onDraftChange,
}: {
  providers: ProviderListView
  drafts: Drafts
  initialDrafts: Drafts
  onDraftChange: (field: RuntimeConfigField, value: string) => void
}) {
  const [selectedProviderKey, setSelectedProviderKey] = useState(
    providers.providers[0]?.key ?? '',
  )

  useEffect(() => {
    if (
      providers.providers.length > 0 &&
      !providers.providers.some(
        (provider) => provider.key === selectedProviderKey,
      )
    ) {
      setSelectedProviderKey(providers.providers[0]?.key ?? '')
    }
  }, [providers.providers, selectedProviderKey])

  const activeProvider =
    providers.providers.find(
      (provider) => provider.key === selectedProviderKey,
    ) ?? providers.providers[0]

  if (!activeProvider) {
    return null
  }

  return (
    <section className='rounded-md border bg-background px-4 py-4'>
      <div>
        <h3 className='text-base font-semibold'>{providers.title}</h3>
        <p className='mt-1 text-sm text-muted-foreground'>
          {providers.description}
        </p>
      </div>
      <div className='mt-4 flex flex-wrap gap-2'>
        {providers.providers.map((provider) => (
          <Button
            key={provider.key}
            type='button'
            size='sm'
            variant={
              provider.key === activeProvider.key ? 'default' : 'outline'
            }
            onClick={() => setSelectedProviderKey(provider.key)}
          >
            {provider.label}
          </Button>
        ))}
      </div>
      <div className='mt-4 space-y-3'>
        {activeProvider.sections.map((section) => (
          <ConfigSectionPanel
            key={section.key}
            section={section}
            drafts={drafts}
            initialDrafts={initialDrafts}
            onDraftChange={onDraftChange}
          />
        ))}
      </div>
    </section>
  )
}

function CapabilityPackCard({
  pack,
  expanded,
  drafts,
  initialDrafts,
  onToggleExpanded,
  onDraftChange,
}: {
  pack: CapabilityPackCardView
  expanded: boolean
  drafts: Drafts
  initialDrafts: Drafts
  onToggleExpanded: () => void
  onDraftChange: (field: RuntimeConfigField, value: string) => void
}) {
  return (
    <section
      data-testid={`capability-pack-card-${pack.id}`}
      className='rounded-md border bg-background px-4 py-4'
    >
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
        <p className='text-sm text-muted-foreground'>{pack.summary}</p>
      </div>

      {expanded ? (
        <div className='mt-4 space-y-3'>
          {pack.items.map((item) => {
            switch (item.kind) {
              case 'section':
                return (
                  <ConfigSectionPanel
                    key={item.key}
                    section={item.section}
                    drafts={drafts}
                    initialDrafts={initialDrafts}
                    onDraftChange={onDraftChange}
                  />
                )
              case 'binding':
                return (
                  <InferenceBindingPanel
                    key={item.key}
                    binding={item.binding}
                    drafts={drafts}
                    initialDrafts={initialDrafts}
                    onDraftChange={onDraftChange}
                  />
                )
              case 'providers':
                return (
                  <KnowledgeProviderPanel
                    key={item.key}
                    providers={item.providers}
                    drafts={drafts}
                    initialDrafts={initialDrafts}
                    onDraftChange={onDraftChange}
                  />
                )
              default:
                return null
            }
          })}
        </div>
      ) : null}
    </section>
  )
}

function CapabilityPackReviewPanel({ groups }: { groups: ReviewGroups }) {
  function renderGroup(title: string, items: string[], emptyLabel: string) {
    return (
      <div className='rounded-md border bg-background px-4 py-3'>
        <h5 className='text-sm font-semibold'>{title}</h5>
        <ul className='mt-2 space-y-1 text-sm text-muted-foreground'>
          {items.length > 0 ? (
            items.map((item) => <li key={item}>{item}</li>)
          ) : (
            <li>{emptyLabel}</li>
          )}
        </ul>
      </div>
    )
  }

  return (
    <section
      data-testid='capability-pack-review-panel'
      className='rounded-md border border-amber-500/30 bg-amber-500/5 px-4 py-4'
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h4 className='text-base font-semibold'>Review changes</h4>
          <p className='mt-1 text-sm text-muted-foreground'>
            This review groups pack-owned config, shared inference/runtime
            blocks, and supporting dependency changes before saving.
          </p>
        </div>
      </div>

      <div className='mt-4 grid gap-4 lg:grid-cols-2'>
        {renderGroup(
          'Pack direct config changes',
          groups.packDirect,
          'No pack direct config changes in draft.',
        )}
        {renderGroup(
          'Shared inference/runtime changes',
          groups.sharedInferenceRuntime,
          'No shared inference/runtime changes in draft.',
        )}
        {renderGroup(
          'Supporting dependency changes',
          groups.supportingDependency,
          'No supporting dependency changes in draft.',
        )}
      </div>
    </section>
  )
}

export function SettingsConfiguration() {
  const [, setTargets] = useState<RuntimeConfigTarget[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [snapshot, setSnapshot] = useState<RuntimeConfigSnapshot | null>(null)
  const [drafts, setDrafts] = useState<Drafts>({})
  const [initialDrafts, setInitialDrafts] = useState<Drafts>({})
  const [, setLoadingTargets] = useState(true)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [expandedPackIds, setExpandedPackIds] = useState<CapabilityPackId[]>([])
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
        const normalizedSections = normalizeRuntimeSections(
          loadedSnapshot.sections,
        )
        const nextDrafts = buildDrafts(normalizedSections)
        setExpandedPackIds(visiblePackIdsFromSections(normalizedSections))
        setSnapshot({
          ...loadedSnapshot,
          sections: normalizedSections,
        })
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

  const runtimeDirty = useMemo(
    () => Object.keys(drafts).some((key) => drafts[key] !== initialDrafts[key]),
    [drafts, initialDrafts],
  )

  const baseSections = snapshot?.sections ?? []
  const sections = useMemo(
    () => materializeSectionsForDrafts(baseSections, drafts),
    [baseSections, drafts],
  )
  const packLayout = useMemo(() => buildPackLayout(sections), [sections])
  const reviewGroups = useMemo(
    () =>
      buildReviewGroups({
        sections,
        drafts,
        initialDrafts,
        ownershipByFieldKey: packLayout.ownershipByFieldKey,
      }),
    [sections, drafts, initialDrafts, packLayout],
  )

  function handleDraftChange(field: RuntimeConfigField, value: string) {
    setDrafts((current) => ({
      ...current,
      [fieldDraftKey(field)]: value,
    }))
  }

  function handleCapabilityPackExpandToggle(id: CapabilityPackId) {
    setExpandedPackIds((current) =>
      current.includes(id)
        ? current.filter((packId) => packId !== id)
        : [...current, id],
    )
  }

  function handleResetPageDraft() {
    setDrafts(initialDrafts)
    setError(null)
    setSaveMessage(null)
    setReviewOpen(false)
  }

  function handleOpenReview() {
    if (!runtimeDirty) return
    setReviewOpen(true)
  }

  async function handleRuntimeConfigSave() {
    if (!snapshot || !runtimeDirty) return

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
      const normalizedSections = normalizeRuntimeSections(updated.sections)
      const nextDrafts = buildDrafts(normalizedSections)
      setExpandedPackIds(visiblePackIdsFromSections(normalizedSections))
      setSnapshot({
        ...updated,
        sections: normalizedSections,
      })
      setDrafts(nextDrafts)
      setInitialDrafts(nextDrafts)
      setSaveMessage('Runtime config saved.')
    } catch (err: unknown) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className='faded-bottom flex h-full w-full flex-1 flex-col overflow-y-auto scroll-smooth pe-4 pb-12'>
      <div className='space-y-3'>
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
                Review and edit the real runtime-config-backed capability pack
                fields directly here.
              </p>
            </div>
            <div className='flex flex-wrap gap-2'>
              {runtimeDirty ? (
                <Badge variant='outline'>Draft changes</Badge>
              ) : (
                <Badge variant='secondary'>No draft changes</Badge>
              )}
            </div>
          </div>

          <div className='mt-4 grid gap-4'>
            {packLayout.visiblePacks.map((pack) => (
              <CapabilityPackCard
                key={pack.id}
                pack={pack}
                expanded={expandedPackIds.includes(pack.id)}
                drafts={drafts}
                initialDrafts={initialDrafts}
                onToggleExpanded={() =>
                  handleCapabilityPackExpandToggle(pack.id)
                }
                onDraftChange={handleDraftChange}
              />
            ))}
          </div>

          <div className='mt-4 flex flex-wrap gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={handleResetPageDraft}
              disabled={!runtimeDirty || saving}
            >
              <RotateCcw className='me-2 size-4' />
              Reset changes
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={handleOpenReview}
              disabled={!runtimeDirty}
            >
              Review changes
            </Button>
            <Button
              type='button'
              onClick={handleRuntimeConfigSave}
              disabled={!runtimeDirty || saving || loadingSnapshot}
            >
              {saving ? (
                <Loader2 className='me-2 size-4 animate-spin' />
              ) : (
                <Save className='me-2 size-4' />
              )}
              Save changes
            </Button>
          </div>

          {reviewOpen ? (
            <div className='mt-4'>
              <CapabilityPackReviewPanel groups={reviewGroups} />
            </div>
          ) : null}
        </section>

        {snapshot ? (
          <div className='flex flex-wrap gap-2'>
            {snapshot.restartRequired ? (
              <Badge variant='outline'>Restart required</Badge>
            ) : null}
            {snapshot.reloadRequired ? (
              <Badge variant='outline'>Reload required</Badge>
            ) : null}
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
        ) : null}

        {error ? (
          <div
            role='alert'
            className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'
          >
            {error}
          </div>
        ) : null}

        {saveMessage ? (
          <div className='rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300'>
            {saveMessage}
          </div>
        ) : null}

        {snapshot?.validationErrors.length ? (
          <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
            {snapshot.validationErrors.join('\n')}
          </div>
        ) : null}
      </div>
    </div>
  )
}
