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
  fetchRuntimeExecutableResolutions,
  fetchRuntimeConfigSnapshot,
  fetchRuntimeConfigTargets,
  updateRuntimeConfig,
  type RuntimeConfigField,
  type RuntimeConfigFieldPatch,
  type RuntimeConfigSection,
  type RuntimeConfigSnapshot,
  type RuntimeConfigTarget,
  type RuntimeExecutableResolution,
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

type FieldOwnershipKind = 'pack-direct' | 'supporting-dependency'

type FieldOwnership = {
  kind: FieldOwnershipKind
  ownerPackId: CapabilityPackId
  ownerPackLabel: string
}

type ReviewGroups = {
  initialSetup: string[]
  packDirect: string[]
  supportingDependency: string[]
}

type SectionFieldEntry = {
  section: RuntimeConfigSection
  field: RuntimeConfigField
}

type PackLayout = {
  visiblePacks: CapabilityPackCardView[]
  ownershipByFieldKey: Map<string, FieldOwnership>
}

type InferenceConfigLayout = {
  profiles: DisplaySection[]
  runtimes: DisplaySection[]
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
]

const inferenceProfileFieldOrder = [
  'task',
  'driver',
  'runtime',
  'model',
  'base_url',
  'api_key',
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

const inferenceTaskOptions = ['text_generation', 'structured_generation']

const inferenceTextGenerationDriverOptions = [
  'bitloops_platform_chat',
  'openai_chat_completions',
  'ollama_chat',
]

const inferenceStructuredGenerationDriverOptions = ['codex', 'claude']

const codexThinkingLevelOptions = [
  'low',
  'medium',
  'high',
  'extra_high',
  'xhigh',
]
const claudeThinkingLevelOptions = ['low', 'medium', 'high', 'xhigh', 'max']
const DEFAULT_INFERENCE_REQUEST_TIMEOUT_SECS = 300
const DEFAULT_LOCAL_AGENT_REQUEST_TIMEOUT_SECS = 300
const DEFAULT_CODEX_MODEL = 'gpt-5.4-mini'
const DEFAULT_CLAUDE_MODEL = 'claude-opus-4-7'
const DEFAULT_OPENAI_CHAT_BASE_URL =
  'https://api.openai.com/v1/chat/completions'
const DEFAULT_BITLOOPS_PLATFORM_CHAT_BASE_URL =
  'https://platform.bitloops.net/v1/chat/completions'
const DEFAULT_OLLAMA_CHAT_BASE_URL = 'http://127.0.0.1:11434/api/chat'
const REPO_SETUP_SECTION_KEY = 'repo_init_setup'
const DAEMON_SETUP_SECTION_KEY = 'daemon_init_setup'
const REPO_SYNC_FIELD_PATH = ['devql', 'sync_enabled']
const REPO_INGEST_FIELD_PATH = ['devql', 'ingest_enabled']
const REPO_SYNC_FIELD_KEY = REPO_SYNC_FIELD_PATH.join('\u001f')
const REPO_INGEST_FIELD_KEY = REPO_INGEST_FIELD_PATH.join('\u001f')
const INFERENCE_NAME_FIELD = '__name'
const INFERENCE_NAME_PATTERN = /^[A-Za-z0-9_-]+$/u

type InferenceObjectKind = 'profile' | 'runtime'

type InferenceRenamePlan = {
  profileRenames: Map<string, string>
  runtimeRenames: Map<string, string>
}

const structuredGenerationToolDefaults = new Map<
  string,
  { driver: string; runtime: string; model: string }
>([
  [
    'codex_exec',
    {
      driver: 'codex',
      runtime: 'codex',
      model: DEFAULT_CODEX_MODEL,
    },
  ],
  [
    'claude_code_print',
    {
      driver: 'claude',
      runtime: 'claude',
      model: DEFAULT_CLAUDE_MODEL,
    },
  ],
  [
    'codex',
    {
      driver: 'codex',
      runtime: 'codex',
      model: DEFAULT_CODEX_MODEL,
    },
  ],
  [
    'claude',
    {
      driver: 'claude',
      runtime: 'claude',
      model: DEFAULT_CLAUDE_MODEL,
    },
  ],
])

const repoSetupSeedSection: SeedSectionSpec = {
  key: REPO_SETUP_SECTION_KEY,
  title: 'Repo setup',
  description: 'Per-repo setup choices carried over from bitloops init.',
  order: 1,
  fields: [
    {
      path: ['devql', 'sync_enabled'],
      label: 'Sync',
      description: 'Run repository sync as part of setup.',
      fieldType: 'boolean',
      value: false,
    },
    {
      path: ['devql', 'ingest_enabled'],
      label: 'Ingest',
      description: 'Import commit history as part of setup.',
      fieldType: 'boolean',
      value: false,
    },
  ],
}

const daemonSetupSeedSection: SeedSectionSpec = {
  key: DAEMON_SETUP_SECTION_KEY,
  title: 'Daemon setup',
  description: 'Daemon-level setup choices carried over from bitloops init.',
  order: 2,
  fields: [
    {
      path: ['dashboard', 'auto_start_daemon'],
      label: 'Daemon should start automatically',
      description: 'Start the Bitloops daemon automatically for this setup.',
      fieldType: 'boolean',
      value: false,
    },
    {
      path: ['telemetry', 'enabled'],
      label: 'Enable telemetry',
      description: 'Enable anonymous Bitloops telemetry.',
      fieldType: 'boolean',
      value: false,
    },
  ],
}

const setupSeedSections = [repoSetupSeedSection, daemonSetupSeedSection]

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
        value: DEFAULT_INFERENCE_REQUEST_TIMEOUT_SECS,
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
        value: DEFAULT_LOCAL_AGENT_REQUEST_TIMEOUT_SECS,
      },
      {
        path: ['inference', 'runtimes', 'claude', 'command'],
        label: 'Command',
        description: 'inference.runtimes.claude.command',
        fieldType: 'string',
        value: 'claude',
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
        value: DEFAULT_LOCAL_AGENT_REQUEST_TIMEOUT_SECS,
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
        value: 'bitloops_platform_chat',
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
        value: 'ministral-3-3b-instruct',
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'base_url'],
        label: 'Base URL',
        description: 'inference.profiles.summary_llm.base_url',
        fieldType: 'string',
        value: DEFAULT_BITLOOPS_PLATFORM_CHAT_BASE_URL,
      },
      {
        path: ['inference', 'profiles', 'summary_llm', 'api_key'],
        label: 'API key',
        description: 'inference.profiles.summary_llm.api_key',
        fieldType: 'string',
        value: '${BITLOOPS_PLATFORM_GATEWAY_TOKEN}',
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
        path: ['inference', 'profiles', 'guidance_llm', 'base_url'],
        label: 'Base URL',
        description: 'inference.profiles.guidance_llm.base_url',
        fieldType: 'string',
        value: DEFAULT_BITLOOPS_PLATFORM_CHAT_BASE_URL,
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
        value: 124096,
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
        value: 'codex',
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
        value: 'codex',
      },
      {
        path: ['inference', 'profiles', 'architecture_fact_synthesis', 'model'],
        label: 'Model',
        description: 'inference.profiles.architecture_fact_synthesis.model',
        fieldType: 'string',
        value: DEFAULT_CODEX_MODEL,
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
        value: 'claude',
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
        value: 'claude',
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
        value: DEFAULT_CLAUDE_MODEL,
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
  [
    ...setupSeedSections,
    ...missingPackSeedSections,
    ...supplementalSeedSections,
  ].flatMap((section) =>
    section.fields.map((field) => [field.path.join('.'), field] as const),
  ),
)
const initSetupFieldSpecsByPath = new Map(
  setupSeedSections.flatMap((section) =>
    section.fields.map((field) => [field.path.join('.'), field] as const),
  ),
)
const setupSectionKeys = new Set(
  setupSeedSections.map((section) => section.key),
)
const setupSectionTestIds = new Map<string, string>([
  [REPO_SETUP_SECTION_KEY, 'repo-setup-options'],
  [DAEMON_SETUP_SECTION_KEY, 'daemon-setup-options'],
])
const setupSectionKeyByFieldPath = new Map(
  setupSeedSections.flatMap((section) =>
    section.fields.map((field) => [field.path.join('.'), section.key] as const),
  ),
)

function setupSectionTestId(sectionKey: string) {
  return setupSectionTestIds.get(sectionKey)
}

function pathStartsWith(path: string[], prefix: string[]): boolean {
  return prefix.every((segment, index) => path[index] === segment)
}

function pathsEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  )
}

function pathDraftKey(path: string[]) {
  return path.join('\u001f')
}

function isRuntimeCommandField(field: RuntimeConfigField) {
  return (
    field.path.length === 4 &&
    field.path[0] === 'inference' &&
    field.path[1] === 'runtimes' &&
    field.path[3] === 'command'
  )
}

function isBareExecutableCommand(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    !value.includes('/') &&
    !value.includes('\\')
  )
}

function runtimeExecutableCommands(sections: RuntimeConfigSection[]) {
  const commands = new Set<string>()
  for (const section of sections) {
    for (const field of section.fields) {
      if (
        isRuntimeCommandField(field) &&
        isBareExecutableCommand(field.value)
      ) {
        commands.add(field.value.trim())
      }
    }
  }
  return [...commands].sort((left, right) => left.localeCompare(right))
}

function executableResolutionHint(
  command: string,
  resolution: RuntimeExecutableResolution | undefined,
) {
  if (!resolution) return null
  if (resolution.found && resolution.path) {
    return `Resolved executable: ${resolution.path}`
  }
  return `Executable not found on PATH: ${command}`
}

function applyRuntimeExecutableResolutionHints(
  sections: RuntimeConfigSection[],
  resolutions: RuntimeExecutableResolution[],
) {
  if (resolutions.length === 0) return sections

  const resolutionsByCommand = new Map(
    resolutions.map((resolution) => [resolution.command, resolution] as const),
  )

  return sections.map((section) => ({
    ...section,
    fields: section.fields.map((field) => {
      if (
        !isRuntimeCommandField(field) ||
        !isBareExecutableCommand(field.value)
      ) {
        return field
      }

      const command = field.value.trim()
      const resolution = resolutionsByCommand.get(command)
      const hint = executableResolutionHint(command, resolution)
      if (!hint) return field

      const resolvedValue =
        resolution?.found === true && resolution.path ? resolution.path : null

      return {
        ...field,
        value: resolvedValue ?? field.value,
        effectiveValue:
          resolvedValue && valuesEqual(field.effectiveValue, field.value)
            ? resolvedValue
            : field.effectiveValue,
        validationHints: [
          ...field.validationHints.filter(
            (existingHint) =>
              !existingHint.startsWith('Resolved executable: ') &&
              !existingHint.startsWith('Executable not found on PATH: '),
          ),
          hint,
        ],
      }
    }),
  }))
}

async function resolveRuntimeExecutableHints(
  sections: RuntimeConfigSection[],
  signal: AbortSignal,
) {
  const commands = runtimeExecutableCommands(sections)
  if (commands.length === 0) return sections

  try {
    const resolutions = await fetchRuntimeExecutableResolutions(commands, {
      signal,
    })
    return applyRuntimeExecutableResolutionHints(sections, resolutions)
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    return sections
  }
}

function fieldDraftKey(field: RuntimeConfigField): string {
  return pathDraftKey(field.path)
}

function siblingProfileDraftKey(field: RuntimeConfigField, fieldName: string) {
  return pathDraftKey([...field.path.slice(0, 3), fieldName])
}

function profileToolDefaultsForChange(
  field: RuntimeConfigField,
  value: string,
) {
  if (
    !pathStartsWith(field.path, ['inference', 'profiles']) ||
    field.path.length !== 4
  ) {
    return null
  }

  const fieldName = field.path[3]
  if (fieldName !== 'driver' && fieldName !== 'runtime') {
    return null
  }

  return structuredGenerationToolDefaults.get(value) ?? null
}

function baseUrlDefaultForDriver(driver: string) {
  switch (driver) {
    case 'openai_chat_completions':
      return DEFAULT_OPENAI_CHAT_BASE_URL
    case 'ollama_chat':
      return DEFAULT_OLLAMA_CHAT_BASE_URL
    case 'bitloops_platform_chat':
      return DEFAULT_BITLOOPS_PLATFORM_CHAT_BASE_URL
    default:
      return null
  }
}

function isDriverDefaultBaseUrl(value: string) {
  return (
    value === DEFAULT_OPENAI_CHAT_BASE_URL ||
    value === DEFAULT_OLLAMA_CHAT_BASE_URL ||
    value === DEFAULT_BITLOOPS_PLATFORM_CHAT_BASE_URL
  )
}

function applyProfileToolDefaults(
  drafts: Drafts,
  field: RuntimeConfigField,
  value: string,
) {
  const defaults = profileToolDefaultsForChange(field, value)
  const baseUrlDefault =
    pathStartsWith(field.path, ['inference', 'profiles']) &&
    field.path[3] === 'driver'
      ? baseUrlDefaultForDriver(value)
      : null
  if (!defaults && !baseUrlDefault) return drafts

  const next = { ...drafts }
  const driverKey = siblingProfileDraftKey(field, 'driver')
  const runtimeKey = siblingProfileDraftKey(field, 'runtime')
  const modelKey = siblingProfileDraftKey(field, 'model')
  const baseUrlKey = siblingProfileDraftKey(field, 'base_url')

  if (defaults && driverKey in next) {
    next[driverKey] = defaults.driver
  }
  if (defaults && runtimeKey in next) {
    next[runtimeKey] = defaults.runtime
  }
  if (defaults && modelKey in next) {
    next[modelKey] = defaults.model
  }
  if (
    baseUrlDefault &&
    baseUrlKey in next &&
    (isUnsetFieldValue(next[baseUrlKey]) ||
      isDriverDefaultBaseUrl(next[baseUrlKey]))
  ) {
    next[baseUrlKey] = baseUrlDefault
  }

  return next
}

function valueToDraft(field: RuntimeConfigField): string {
  if (
    pathStartsWith(field.path, ['inference', 'profiles']) &&
    field.path[3] === 'task' &&
    typeof field.value === 'string'
  ) {
    return canonicalInferenceTask(field.value)
  }

  if (
    pathStartsWith(field.path, ['inference', 'profiles']) &&
    field.path[3] === 'driver' &&
    typeof field.value === 'string'
  ) {
    return canonicalStructuredGenerationDriver(field.value)
  }

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

function collectValueLeafPathKeys(
  value: unknown,
  path: string[],
  keys: Set<string>,
) {
  if (value == null) return

  if (Array.isArray(value)) {
    keys.add(pathDraftKey(path))
    return
  }

  if (isExpandableJsonValue(value)) {
    for (const [childKey, childValue] of Object.entries(value)) {
      collectValueLeafPathKeys(childValue, [...path, childKey], keys)
    }
    return
  }

  keys.add(pathDraftKey(path))
}

function persistedFieldKeysFromSections(sections: RuntimeConfigSection[]) {
  const keys = new Set<string>()

  for (const section of sections) {
    collectValueLeafPathKeys(section.value, [section.key], keys)
    for (const field of section.fields) {
      keys.add(fieldDraftKey(field))
      collectValueLeafPathKeys(field.value, field.path, keys)
    }
  }

  return [...keys]
}

function persistedFieldKeyMatchesPathPrefix(key: string, prefix: string[]) {
  const prefixKey = pathDraftKey(prefix)
  return key === prefixKey || key.startsWith(`${prefixKey}\u001f`)
}

function capabilityPackIdsFromPersistedSections(
  sections: RuntimeConfigSection[],
): CapabilityPackId[] {
  const persistedFieldKeys = persistedFieldKeysFromSections(sections)

  return capabilityPackDefinitions
    .filter((pack) =>
      pack.directPrefixes.some((prefix) =>
        persistedFieldKeys.some((key) =>
          persistedFieldKeyMatchesPathPrefix(key, prefix),
        ),
      ),
    )
    .map((pack) => pack.id)
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

function valuesEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function visibleFieldDescription(field: RuntimeConfigField): string | null {
  const description = field.description.trim()
  if (!description || description === field.path.join('.')) {
    return null
  }
  return description
}

function shouldShowEffectiveValue(field: RuntimeConfigField): boolean {
  return (
    field.effectiveValue !== null &&
    !valuesEqual(field.effectiveValue, field.value)
  )
}

function shouldShowDefaultValue(field: RuntimeConfigField): boolean {
  return (
    field.defaultValue !== null &&
    !valuesEqual(field.defaultValue, field.value) &&
    !valuesEqual(field.defaultValue, field.effectiveValue)
  )
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

function createInferenceNameField(
  kind: InferenceObjectKind,
  objectId: string,
): RuntimeConfigField {
  const path =
    kind === 'profile'
      ? ['inference', 'profiles', objectId, INFERENCE_NAME_FIELD]
      : ['inference', 'runtimes', objectId, INFERENCE_NAME_FIELD]
  const key = path.join('.')

  return {
    key,
    path,
    label: 'Name',
    description:
      kind === 'profile'
        ? 'Inference profile config key.'
        : 'Inference runtime config key.',
    fieldType: 'string',
    value: objectId,
    effectiveValue: objectId,
    defaultValue: null,
    allowedValues: [],
    validationHints: [
      'Use letters, numbers, underscores, or dashes; references update on save.',
    ],
    required: true,
    readOnly: false,
    secret: false,
    order: -1_000,
    source: 'synthetic',
  }
}

function initSetupFieldWithMetadata(
  field: RuntimeConfigField,
  seed: SeedFieldSpec,
  order: number,
  targetKind: string | null,
): RuntimeConfigField {
  return {
    ...field,
    label: seed.label,
    description: seed.description,
    fieldType: seed.fieldType,
    readOnly: field.readOnly || initSetupFieldReadOnly(seed, targetKind),
    order,
  }
}

function isRepoConfigTargetKind(targetKind: string | null) {
  return targetKind === 'repo_shared' || targetKind === 'repo_local'
}

function initSetupFieldReadOnly(
  seed: SeedFieldSpec,
  targetKind: string | null,
) {
  const key = seed.path.join('.')
  if (key === 'devql.sync_enabled' || key === 'devql.ingest_enabled') {
    return !isRepoConfigTargetKind(targetKind)
  }
  if (key === 'dashboard.auto_start_daemon' || key === 'telemetry.enabled') {
    return targetKind !== 'daemon'
  }
  return false
}

function createInitSetupSeedField(
  seed: SeedFieldSpec,
  order: number,
  targetKind: string | null,
) {
  return {
    ...createSeedField(seed, order),
    readOnly: initSetupFieldReadOnly(seed, targetKind),
  }
}

function applyInitSetupSection(
  sectionsByKey: Map<string, RuntimeConfigSection>,
  targetKind: string | null,
) {
  const initFieldsByPath = new Map<
    string,
    { field: RuntimeConfigField; sectionKey: string }
  >()

  for (const [sectionKey, section] of sectionsByKey) {
    if (setupSectionKeys.has(sectionKey)) continue

    const remainingFields: RuntimeConfigField[] = []
    for (const field of section.fields) {
      const key = field.path.join('.')
      const seed = initSetupFieldSpecsByPath.get(key)
      const targetSectionKey = setupSectionKeyByFieldPath.get(key)
      if (!seed) {
        remainingFields.push(field)
        continue
      }

      if (targetSectionKey && !initFieldsByPath.has(key)) {
        initFieldsByPath.set(key, {
          field,
          sectionKey: targetSectionKey,
        })
      }
    }

    sectionsByKey.set(sectionKey, {
      ...section,
      fields: sortedFieldList(remainingFields),
    })
  }

  for (const setupSection of setupSeedSections) {
    const fields = setupSection.fields.map((seed, index) => {
      const existing = initFieldsByPath.get(seed.path.join('.'))
      return existing?.sectionKey === setupSection.key
        ? initSetupFieldWithMetadata(existing.field, seed, index, targetKind)
        : createInitSetupSeedField(seed, index, targetKind)
    })

    sectionsByKey.set(setupSection.key, {
      key: setupSection.key,
      title: setupSection.title,
      description: setupSection.description,
      order: setupSection.order,
      advanced: false,
      value: {},
      effectiveValue: {},
      fields,
    })
  }
}

function hasMeaningfulSeedValue(value: unknown) {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function isPackInferenceBindingPath(path: string[]) {
  return (
    path.length === 3 &&
    path[1] === 'inference' &&
    ['architecture', 'context_guidance', 'semantic_clones'].includes(path[0])
  )
}

function isInferenceProfileFieldPath(path: string[]) {
  return pathStartsWith(path, ['inference', 'profiles']) && path.length >= 4
}

function isInferenceRuntimeFieldPath(path: string[]) {
  return pathStartsWith(path, ['inference', 'runtimes']) && path.length >= 4
}

function isInferenceNameFieldPath(path: string[]) {
  return (
    (isInferenceProfileFieldPath(path) || isInferenceRuntimeFieldPath(path)) &&
    path[3] === INFERENCE_NAME_FIELD
  )
}

function inferenceObjectKindForPath(
  path: string[],
): InferenceObjectKind | null {
  if (isInferenceProfileFieldPath(path)) return 'profile'
  if (isInferenceRuntimeFieldPath(path)) return 'runtime'
  return null
}

function inferenceObjectIdForPath(path: string[]) {
  return path[2] ?? ''
}

function isInferenceNameField(field: RuntimeConfigField) {
  return isInferenceNameFieldPath(field.path)
}

function isUnsetFieldValue(value: unknown) {
  return (
    value == null || (typeof value === 'string' && value.trim().length === 0)
  )
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function uniqueAllowedValues(
  values: string[],
  currentValue: unknown,
  normalize: (value: string) => string = (value) => value,
) {
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const value of values) {
    const normalized = normalize(value)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    ordered.push(value)
  }

  const current = stringValue(currentValue)
  const normalizedCurrent = normalize(current)
  if (current && !seen.has(normalizedCurrent)) {
    ordered.push(current)
  }
  return ordered
}

type DynamicOptionContext = {
  profileIds: string[]
  runtimeIds: string[]
  profileTaskById: Map<string, string>
  profileDriverById: Map<string, string>
}

function canonicalInferenceTask(task: string) {
  switch (task) {
    case 'text-generation':
      return 'text_generation'
    case 'structured-generation':
      return 'structured_generation'
    default:
      return task
  }
}

function canonicalStructuredGenerationDriver(driver: string) {
  switch (driver) {
    case 'codex_exec':
      return 'codex'
    case 'claude_code_print':
      return 'claude'
    default:
      return driver
  }
}

function isRunnableInferenceTask(task: string | undefined) {
  return (
    task === 'text_generation' ||
    task === 'structured_generation' ||
    task === 'text-generation' ||
    task === 'structured-generation'
  )
}

function isLocalStructuredGenerationDriver(driver: string | undefined) {
  const canonicalDriver = canonicalStructuredGenerationDriver(driver ?? '')
  return canonicalDriver === 'codex' || canonicalDriver === 'claude'
}

function isHttpGenerationDriver(driver: string | undefined) {
  return (
    driver === 'openai_chat_completions' ||
    driver === 'bitloops_platform_chat' ||
    driver === 'ollama_chat'
  )
}

function buildDynamicOptionContext(
  sections: RuntimeConfigSection[],
): DynamicOptionContext {
  const profileIds = new Set<string>()
  const runtimeIds = new Set<string>()
  const profileTaskById = new Map<string, string>()
  const profileDriverById = new Map<string, string>()
  const profileNameById = new Map<string, string>()
  const runtimeNameById = new Map<string, string>()

  for (const section of sections) {
    for (const field of section.fields) {
      if (!isInferenceNameField(field)) continue
      const objectId = inferenceObjectIdForPath(field.path)
      const name = stringValue(field.value)
      if (!objectId || !name) continue

      if (inferenceObjectKindForPath(field.path) === 'profile') {
        profileNameById.set(objectId, name)
      } else {
        runtimeNameById.set(objectId, name)
      }
    }
  }

  for (const section of sections) {
    for (const field of section.fields) {
      if (isInferenceNameField(field)) continue

      if (pathStartsWith(field.path, ['inference', 'profiles'])) {
        const profileId = field.path[2]
        if (profileId) {
          if (field.path[3] === 'task') {
            const task = stringValue(field.value)
            if (task) {
              profileTaskById.set(profileId, canonicalInferenceTask(task))
            }
          }
          if (field.path[3] === 'driver') {
            const driver = stringValue(field.value)
            if (driver) {
              profileDriverById.set(
                profileId,
                canonicalStructuredGenerationDriver(driver),
              )
            }
          }
        }
      }

      if (pathStartsWith(field.path, ['inference', 'runtimes'])) {
        const runtimeId = field.path[2]
        if (runtimeId) {
          runtimeIds.add(runtimeNameById.get(runtimeId) ?? runtimeId)
        }
      }
    }
  }

  for (const [profileId, task] of profileTaskById) {
    if (isRunnableInferenceTask(task)) {
      profileIds.add(profileNameById.get(profileId) ?? profileId)
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
    profileDriverById,
  }
}

function driverOptionsForTask(task: string) {
  switch (canonicalInferenceTask(task)) {
    case 'structured_generation':
      return inferenceStructuredGenerationDriverOptions
    case 'text_generation':
      return inferenceTextGenerationDriverOptions
    default:
      return []
  }
}

function thinkingLevelOptionsForProfile(
  driver: string | undefined,
  task: string | undefined,
) {
  switch (canonicalStructuredGenerationDriver(driver ?? '')) {
    case 'codex':
      return codexThinkingLevelOptions
    case 'claude':
      return claudeThinkingLevelOptions
    default:
      if (canonicalInferenceTask(task ?? '') === 'structured_generation') {
        return [
          ...new Set([
            ...codexThinkingLevelOptions,
            ...claudeThinkingLevelOptions,
          ]),
        ]
      }
      return []
  }
}

function appendValidationHints(
  field: RuntimeConfigField,
  hints: string[],
): RuntimeConfigField {
  const meaningfulHints = hints.filter((hint) => hint.trim().length > 0)
  if (meaningfulHints.length === 0) return field

  const validationHints = [...field.validationHints]
  for (const hint of meaningfulHints) {
    if (!validationHints.includes(hint)) {
      validationHints.push(hint)
    }
  }

  return {
    ...field,
    validationHints,
  }
}

function profileFieldValidationHints(
  fieldName: string,
  driver: string | undefined,
) {
  if (fieldName === 'temperature') {
    return ['Must be finite and greater than or equal to 0.']
  }
  if (fieldName === 'max_output_tokens') {
    return ['Must be greater than 0.']
  }
  if (fieldName !== 'base_url') {
    return []
  }

  switch (driver) {
    case 'openai_chat_completions':
      return [
        `Required for openai_chat_completions; defaults to ${DEFAULT_OPENAI_CHAT_BASE_URL} and must start with http:// or https://.`,
      ]
    case 'ollama_chat':
      return [
        `Required for ollama_chat; defaults to ${DEFAULT_OLLAMA_CHAT_BASE_URL} and must end with /api/chat.`,
      ]
    case 'bitloops_platform_chat':
      return [
        `Optional override for bitloops_platform_chat; defaults to ${DEFAULT_BITLOOPS_PLATFORM_CHAT_BASE_URL}.`,
      ]
    default:
      return []
  }
}

function runtimeFieldValidationHints(fieldName: string) {
  switch (fieldName) {
    case 'startup_timeout_secs':
    case 'request_timeout_secs':
      return ['Must be greater than 0.']
    default:
      return []
  }
}

function inferenceSelectorKind(
  field: RuntimeConfigField,
): InferenceObjectKind | null {
  if (field.fieldType === 'profile') return 'profile'
  if (field.fieldType === 'runtime') return 'runtime'
  if (isPackInferenceBindingPath(field.path)) return 'profile'
  if (isInferenceProfileFieldPath(field.path) && field.path[3] === 'runtime') {
    return 'runtime'
  }
  return null
}

function applyFieldChoiceMetadata(
  field: RuntimeConfigField,
  options: DynamicOptionContext,
): RuntimeConfigField {
  let allowedValues = [...field.allowedValues]
  let fieldType = field.fieldType
  let validationHints: string[] = []
  const selectorKind = inferenceSelectorKind(field)

  if (selectorKind === 'profile') {
    allowedValues = uniqueAllowedValues(options.profileIds, field.value)
  } else if (selectorKind === 'runtime') {
    allowedValues = uniqueAllowedValues(options.runtimeIds, field.value)
  }

  if (
    pathStartsWith(field.path, ['inference', 'profiles']) &&
    field.path.length >= 4
  ) {
    const profileId = field.path[2]
    const fieldName = field.path[3]
    const task = options.profileTaskById.get(profileId)
    const driver = options.profileDriverById.get(profileId)

    if (fieldName === 'task') {
      allowedValues = uniqueAllowedValues(
        inferenceTaskOptions,
        field.value,
        canonicalInferenceTask,
      )
    } else if (fieldName === 'driver' && task) {
      allowedValues = uniqueAllowedValues(
        driverOptionsForTask(task),
        field.value,
      )
    } else if (fieldName === 'thinking_level') {
      allowedValues = uniqueAllowedValues(
        thinkingLevelOptionsForProfile(driver, task),
        field.value,
      )
    }

    validationHints = profileFieldValidationHints(fieldName, driver)
  } else if (
    pathStartsWith(field.path, ['inference', 'runtimes']) &&
    field.path.length >= 4
  ) {
    validationHints = runtimeFieldValidationHints(field.path[3])
  }

  if (allowedValues.length === 0) {
    return appendValidationHints(field, validationHints)
  }

  if (fieldType === 'string') {
    fieldType = 'enum'
  }

  return appendValidationHints(
    {
      ...field,
      fieldType,
      allowedValues,
    },
    validationHints,
  )
}

function applySeedDefaultToField(
  field: RuntimeConfigField,
): RuntimeConfigField {
  const seed = seedFieldSpecsByPath.get(field.path.join('.'))
  if (
    !seed ||
    !isPackInferenceBindingPath(field.path) ||
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

function applyInferenceNameFields(
  sections: RuntimeConfigSection[],
): RuntimeConfigSection[] {
  const additionsBySectionKey = new Map<string, RuntimeConfigField[]>()
  const entries = flattenSections(sections)

  function addNameFieldsForKind(kind: InferenceObjectKind, prefix: string[]) {
    for (const [, objectEntries] of groupEntriesByObjectPath(entries, prefix)) {
      const concreteEntry = objectEntries.find(
        (entry) => !isInferenceNameField(entry.field),
      )
      if (!concreteEntry) continue

      const objectId = inferenceObjectIdForPath(concreteEntry.field.path)
      if (!objectId) continue
      if (objectEntries.some((entry) => isInferenceNameField(entry.field))) {
        continue
      }

      additionsBySectionKey.set(concreteEntry.section.key, [
        ...(additionsBySectionKey.get(concreteEntry.section.key) ?? []),
        createInferenceNameField(kind, objectId),
      ])
    }
  }

  addNameFieldsForKind('profile', ['inference', 'profiles'])
  addNameFieldsForKind('runtime', ['inference', 'runtimes'])

  if (additionsBySectionKey.size === 0) return sections

  return sections.map((section) => {
    const additions = additionsBySectionKey.get(section.key) ?? []
    if (additions.length === 0) return section
    return {
      ...section,
      fields: sortedFieldList([...section.fields, ...additions]),
    }
  })
}

function normalizeRuntimeSections(
  sections: RuntimeConfigSection[],
  targetKind: string | null = null,
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

  applyInitSetupSection(sectionsByKey, targetKind)

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

  const seededSections = applyInferenceNameFields(
    sortedSections(
      [...sectionsByKey.values()].map((section) => ({
        ...section,
        fields: sortedFieldList(section.fields.map(applySeedDefaultToField)),
      })),
    ),
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
  const entries: SectionFieldEntry[] = []
  const seenFieldKeys = new Set<string>()

  for (const section of sortedSections(sections)) {
    for (const field of sortedFields(section)) {
      const key = fieldDraftKey(field)
      if (seenFieldKeys.has(key)) continue
      seenFieldKeys.add(key)
      entries.push({ section, field })
    }
  }

  return entries
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

function entriesFieldValue(
  entries: SectionFieldEntry[],
  fieldName: string,
): string | undefined {
  const entry = entries.find(
    (candidate) => pathTail(candidate.field) === fieldName,
  )
  return typeof entry?.field.value === 'string' ? entry.field.value : undefined
}

function isEmbeddingRuntimeId(runtimeId: string) {
  return (
    runtimeId === 'bitloops_local_embeddings' ||
    runtimeId === 'bitloops_platform_embeddings'
  )
}

function shouldRenderInferenceProfileField(params: {
  fieldName: string
  task: string
  driver: string | undefined
}) {
  if (!inferenceProfileFieldOrder.includes(params.fieldName)) {
    return false
  }

  if (params.fieldName === 'base_url') {
    return (
      params.task === 'text_generation' && isHttpGenerationDriver(params.driver)
    )
  }

  if (params.fieldName === 'thinking_level') {
    return isLocalStructuredGenerationDriver(params.driver)
  }

  return true
}

function buildStrictInferenceProfileSection(
  profileId: string,
  entries: SectionFieldEntry[],
): DisplaySection | null {
  const task = canonicalInferenceTask(entriesFieldValue(entries, 'task') ?? '')
  if (!isRunnableInferenceTask(task)) return null

  const driver = entriesFieldValue(entries, 'driver')
  const displayProfileId =
    entriesFieldValue(entries, INFERENCE_NAME_FIELD) ?? profileId
  const fields = entries
    .map((entry) => entry.field)
    .filter((field) =>
      isInferenceNameField(field)
        ? true
        : shouldRenderInferenceProfileField({
            fieldName: pathTail(field),
            task,
            driver,
          }),
    )

  if (fields.length === 0) return null

  const section = entries[0]?.section
  return {
    ...section,
    key: `inference-config:profile:${profileId}`,
    title: `Inference profile · ${displayProfileId}`,
    description:
      'Persistent [inference.profiles.*] TOML for the Bitloops inference daemon.',
    advanced: false,
    fields: sortedFieldList(fields, [
      INFERENCE_NAME_FIELD,
      ...inferenceProfileFieldOrder,
    ]),
  }
}

function buildStrictInferenceRuntimeSection(
  runtimeId: string,
  entries: SectionFieldEntry[],
): DisplaySection | null {
  if (isEmbeddingRuntimeId(runtimeId)) return null

  const displayRuntimeId =
    entriesFieldValue(entries, INFERENCE_NAME_FIELD) ?? runtimeId
  const fields = entries
    .map((entry) => entry.field)
    .filter(
      (field) =>
        isInferenceNameField(field) ||
        inferenceRuntimeFieldOrder.includes(pathTail(field)),
    )

  if (fields.length === 0) return null

  const section = entries[0]?.section
  return {
    ...section,
    key: `inference-config:runtime:${runtimeId}`,
    title: `Inference runtime · ${displayRuntimeId}`,
    description:
      'Persistent [inference.runtimes.*] TOML for provider and local agent execution.',
    advanced: false,
    fields: sortedFieldList(fields, [
      INFERENCE_NAME_FIELD,
      ...inferenceRuntimeFieldOrder,
    ]),
  }
}

function buildInferenceConfigLayout(
  sections: RuntimeConfigSection[],
): InferenceConfigLayout {
  const entries = flattenSections(sections)
  const profileBlocks = groupEntriesByObjectPath(entries, [
    'inference',
    'profiles',
  ])
  const runtimeBlocks = groupEntriesByObjectPath(entries, [
    'inference',
    'runtimes',
  ])

  return {
    profiles: [...profileBlocks.entries()]
      .map(([profileId, profileEntries]) =>
        buildStrictInferenceProfileSection(profileId, profileEntries),
      )
      .filter((section): section is DisplaySection => section != null)
      .sort((left, right) => left.title.localeCompare(right.title)),
    runtimes: [...runtimeBlocks.entries()]
      .map(([runtimeId, runtimeEntries]) =>
        buildStrictInferenceRuntimeSection(runtimeId, runtimeEntries),
      )
      .filter((section): section is DisplaySection => section != null)
      .sort((left, right) => left.title.localeCompare(right.title)),
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
  const ownershipByFieldKey = new Map<string, FieldOwnership>()
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

        items.push({
          kind: 'binding',
          key: locationKey,
          binding: {
            key: locationKey,
            label: bindingField.label,
            description:
              bindingField.description || bindingField.path.join('.'),
            field: bindingField,
            sections: [],
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

function buildReviewGroups(params: {
  sections: RuntimeConfigSection[]
  drafts: Drafts
  initialDrafts: Drafts
  ownershipByFieldKey: Map<string, FieldOwnership>
}): ReviewGroups {
  const groups: ReviewGroups = {
    initialSetup: [],
    packDirect: [],
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
        case 'supporting-dependency':
          groups.supportingDependency.push(label)
          break
        default:
          if (setupSectionKeys.has(section.key)) {
            groups.initialSetup.push(label)
          }
          break
      }
    }
  }

  return groups
}

function findFieldsByPath(
  sections: RuntimeConfigSection[],
  path: string[],
): RuntimeConfigField[] {
  const fields: RuntimeConfigField[] = []
  for (const section of sections) {
    fields.push(...section.fields.filter((item) => pathsEqual(item.path, path)))
  }
  return fields
}

function sectionsReflectPatches(
  sections: RuntimeConfigSection[],
  patches: RuntimeConfigFieldPatch[],
  persistedFieldKeys = persistedFieldKeysFromSections(sections),
) {
  return patches.every((patch) => {
    if (patch.unset === true) {
      return !persistedFieldKeys.some((key) =>
        persistedFieldKeyMatchesPathPrefix(key, patch.path),
      )
    }

    return findFieldsByPath(sections, patch.path).some((field) =>
      valuesEqual(field.value, patch.value),
    )
  })
}

function fieldMapByPath(sections: RuntimeConfigSection[]) {
  const fields = new Map<string, RuntimeConfigField>()
  for (const section of sections) {
    for (const field of section.fields) {
      const key = fieldDraftKey(field)
      if (!fields.has(key)) {
        fields.set(key, field)
      }
    }
  }
  return fields
}

function collectInferenceObjectNames(params: {
  sections: RuntimeConfigSection[]
  drafts: Drafts
  kind: InferenceObjectKind
}) {
  const namesById = new Map<string, string>()

  for (const section of params.sections) {
    for (const field of section.fields) {
      if (inferenceObjectKindForPath(field.path) !== params.kind) continue
      const objectId = inferenceObjectIdForPath(field.path)
      if (!objectId || !isInferenceNameField(field)) continue
      namesById.set(
        objectId,
        stringValue(
          resolveFieldValueFromDraft(
            field,
            params.drafts[fieldDraftKey(field)],
          ),
        ),
      )
    }
  }

  return namesById
}

function validateInferenceNames(
  sections: RuntimeConfigSection[],
  drafts: Drafts,
): string | null {
  const profileNames = collectInferenceObjectNames({
    sections,
    drafts,
    kind: 'profile',
  })
  const runtimeNames = collectInferenceObjectNames({
    sections,
    drafts,
    kind: 'runtime',
  })
  const allNames = [...profileNames.values(), ...runtimeNames.values()]

  if (allNames.some((name) => name.length === 0)) {
    return 'Inference names cannot be blank.'
  }
  if (allNames.some((name) => !INFERENCE_NAME_PATTERN.test(name))) {
    return 'Inference names may only contain letters, numbers, underscores, and dashes.'
  }

  if (new Set(profileNames.values()).size !== profileNames.size) {
    return 'Inference profile names must be unique.'
  }
  if (new Set(runtimeNames.values()).size !== runtimeNames.size) {
    return 'Inference runtime names must be unique.'
  }

  return null
}

function buildInferenceRenamePlan(
  sections: RuntimeConfigSection[],
  drafts: Drafts,
): InferenceRenamePlan {
  const profileRenames = new Map<string, string>()
  const runtimeRenames = new Map<string, string>()

  for (const [profileId, profileName] of collectInferenceObjectNames({
    sections,
    drafts,
    kind: 'profile',
  })) {
    if (profileName !== profileId) {
      profileRenames.set(profileId, profileName)
    }
  }

  for (const [runtimeId, runtimeName] of collectInferenceObjectNames({
    sections,
    drafts,
    kind: 'runtime',
  })) {
    if (runtimeName !== runtimeId) {
      runtimeRenames.set(runtimeId, runtimeName)
    }
  }

  return {
    profileRenames,
    runtimeRenames,
  }
}

function inferenceRenameForPath(
  path: string[],
  renamePlan: InferenceRenamePlan,
) {
  const objectId = inferenceObjectIdForPath(path)
  if (isInferenceProfileFieldPath(path)) {
    return renamePlan.profileRenames.get(objectId) ?? null
  }
  if (isInferenceRuntimeFieldPath(path)) {
    return renamePlan.runtimeRenames.get(objectId) ?? null
  }
  return null
}

function fieldBelongsToRenamedInferenceObject(
  field: RuntimeConfigField,
  renamePlan: InferenceRenamePlan,
) {
  return (
    !isInferenceNameField(field) &&
    inferenceRenameForPath(field.path, renamePlan) != null
  )
}

function rewriteInferenceReferenceValue(
  field: RuntimeConfigField,
  value: unknown,
  renamePlan: InferenceRenamePlan,
) {
  if (typeof value !== 'string') return value

  switch (inferenceSelectorKind(field)) {
    case 'profile':
      return renamePlan.profileRenames.get(value) ?? value
    case 'runtime':
      return renamePlan.runtimeRenames.get(value) ?? value
    default:
      return value
  }
}

function referencedProfileIdsFromPackBindings(
  sections: RuntimeConfigSection[],
  drafts: Drafts,
  persistedFieldKeys: Set<string>,
  patchKeys: Set<string>,
) {
  const profileIds = new Set<string>()
  for (const section of sections) {
    for (const field of section.fields) {
      if (inferenceSelectorKind(field) !== 'profile') continue
      const key = fieldDraftKey(field)
      if (!persistedFieldKeys.has(key) && !patchKeys.has(key)) continue
      const value = resolveFieldValueFromDraft(field, drafts[key])
      if (typeof value === 'string' && value.trim()) {
        profileIds.add(value.trim())
      }
    }
  }
  return profileIds
}

function seedFieldsUnderPath(prefix: string[]) {
  return [...seedFieldSpecsByPath.values()].filter((seed) =>
    pathStartsWith(seed.path, prefix),
  )
}

function draftValueForField(field: RuntimeConfigField, drafts: Drafts) {
  return resolveFieldValueFromDraft(field, drafts[fieldDraftKey(field)])
}

function renamedInferenceFieldPath(
  field: RuntimeConfigField,
  renamePlan: InferenceRenamePlan,
) {
  const renamedObjectId = inferenceRenameForPath(field.path, renamePlan)
  if (!renamedObjectId) return field.path
  return [...field.path.slice(0, 2), renamedObjectId, ...field.path.slice(3)]
}

function addPatchIfAbsent(params: {
  path: string[]
  value?: unknown
  unset?: boolean
  patchKeys: Set<string>
  patches: RuntimeConfigFieldPatch[]
}) {
  const key = pathDraftKey(params.path)
  if (params.patchKeys.has(key)) return
  params.patchKeys.add(key)
  params.patches.push(
    params.unset === true
      ? {
          path: params.path,
          unset: true,
        }
      : {
          path: params.path,
          value: params.value,
        },
  )
}

function addInferenceRenamePatches(params: {
  sections: RuntimeConfigSection[]
  drafts: Drafts
  renamePlan: InferenceRenamePlan
  patchKeys: Set<string>
  patches: RuntimeConfigFieldPatch[]
}) {
  for (const section of params.sections) {
    for (const field of section.fields) {
      if (
        isInferenceNameField(field) ||
        !fieldBelongsToRenamedInferenceObject(field, params.renamePlan)
      ) {
        continue
      }

      const value = rewriteInferenceReferenceValue(
        field,
        draftValueForField(field, params.drafts),
        params.renamePlan,
      )
      addPatchIfAbsent({
        path: renamedInferenceFieldPath(field, params.renamePlan),
        value,
        patchKeys: params.patchKeys,
        patches: params.patches,
      })
    }
  }

  for (const profileId of params.renamePlan.profileRenames.keys()) {
    addPatchIfAbsent({
      path: ['inference', 'profiles', profileId],
      unset: true,
      patchKeys: params.patchKeys,
      patches: params.patches,
    })
  }
  for (const runtimeId of params.renamePlan.runtimeRenames.keys()) {
    addPatchIfAbsent({
      path: ['inference', 'runtimes', runtimeId],
      unset: true,
      patchKeys: params.patchKeys,
      patches: params.patches,
    })
  }
}

function addInferenceReferenceRenamePatches(params: {
  sections: RuntimeConfigSection[]
  drafts: Drafts
  renamePlan: InferenceRenamePlan
  patchKeys: Set<string>
  patches: RuntimeConfigFieldPatch[]
}) {
  for (const section of params.sections) {
    for (const field of section.fields) {
      if (
        isInferenceNameField(field) ||
        fieldBelongsToRenamedInferenceObject(field, params.renamePlan) ||
        inferenceSelectorKind(field) == null
      ) {
        continue
      }

      const value = draftValueForField(field, params.drafts)
      const rewrittenValue = rewriteInferenceReferenceValue(
        field,
        value,
        params.renamePlan,
      )
      if (valuesEqual(rewrittenValue, field.value)) continue

      addPatchIfAbsent({
        path: field.path,
        value: rewrittenValue,
        patchKeys: params.patchKeys,
        patches: params.patches,
      })
    }
  }
}

function addMissingSeedFieldPatch(params: {
  seed: SeedFieldSpec
  fieldsByPath: Map<string, RuntimeConfigField>
  drafts: Drafts
  persistedFieldKeys: Set<string>
  patchKeys: Set<string>
  patches: RuntimeConfigFieldPatch[]
}) {
  const key = pathDraftKey(params.seed.path)
  if (params.persistedFieldKeys.has(key) || params.patchKeys.has(key)) {
    return
  }

  const field = params.fieldsByPath.get(key)
  const value = field
    ? draftValueForField(field, params.drafts)
    : params.seed.value

  if (!hasMeaningfulSeedValue(value)) {
    return
  }

  params.patchKeys.add(key)
  params.patches.push({
    path: params.seed.path,
    value,
  })
}

function addMissingReferencedInferenceDefaults(params: {
  sections: RuntimeConfigSection[]
  drafts: Drafts
  persistedFieldKeys: string[]
  patchKeys: Set<string>
  patches: RuntimeConfigFieldPatch[]
}) {
  const persistedFieldKeys = new Set(params.persistedFieldKeys)
  const fieldsByPath = fieldMapByPath(params.sections)
  const profileIds = referencedProfileIdsFromPackBindings(
    params.sections,
    params.drafts,
    persistedFieldKeys,
    params.patchKeys,
  )
  const runtimeIds = new Set<string>()

  for (const profileId of profileIds) {
    for (const seed of seedFieldsUnderPath([
      'inference',
      'profiles',
      profileId,
    ])) {
      addMissingSeedFieldPatch({
        seed,
        fieldsByPath,
        drafts: params.drafts,
        persistedFieldKeys,
        patchKeys: params.patchKeys,
        patches: params.patches,
      })
    }

    const runtimeField = fieldsByPath.get(
      pathDraftKey(['inference', 'profiles', profileId, 'runtime']),
    )
    const runtimeId = runtimeField
      ? stringValue(draftValueForField(runtimeField, params.drafts))
      : stringValue(
          seedFieldSpecsByPath.get(
            ['inference', 'profiles', profileId, 'runtime'].join('.'),
          )?.value,
        )
    if (runtimeId) {
      runtimeIds.add(runtimeId)
    }
  }

  for (const runtimeId of runtimeIds) {
    for (const seed of seedFieldsUnderPath([
      'inference',
      'runtimes',
      runtimeId,
    ])) {
      addMissingSeedFieldPatch({
        seed,
        fieldsByPath,
        drafts: params.drafts,
        persistedFieldKeys,
        patchKeys: params.patchKeys,
        patches: params.patches,
      })
    }
  }
}

function seedFieldsForCapabilityPack(packId: CapabilityPackId) {
  const pack = capabilityPackDefinitions.find(
    (candidate) => candidate.id === packId,
  )
  if (!pack) return []

  return [...seedFieldSpecsByPath.values()].filter((seed) =>
    pack.directPrefixes.some((prefix) => pathStartsWith(seed.path, prefix)),
  )
}

function addEnabledPackSeedDefaults(params: {
  enabledPackIds: CapabilityPackId[]
  fieldsByPath: Map<string, RuntimeConfigField>
  drafts: Drafts
  persistedFieldKeys: Set<string>
  patchKeys: Set<string>
  patches: RuntimeConfigFieldPatch[]
}) {
  for (const packId of params.enabledPackIds) {
    for (const seed of seedFieldsForCapabilityPack(packId)) {
      addMissingSeedFieldPatch({
        seed,
        fieldsByPath: params.fieldsByPath,
        drafts: params.drafts,
        persistedFieldKeys: params.persistedFieldKeys,
        patchKeys: params.patchKeys,
        patches: params.patches,
      })
    }
  }
}

function enabledPackHasMissingSeedDefaults(params: {
  packId: CapabilityPackId
  sections: RuntimeConfigSection[]
  drafts: Drafts
  persistedFieldKeys: Set<string>
}) {
  const directSeeds = seedFieldsForCapabilityPack(params.packId)
  if (
    directSeeds.some(
      (seed) =>
        !params.persistedFieldKeys.has(pathDraftKey(seed.path)) &&
        hasMeaningfulSeedValue(seed.value),
    )
  ) {
    return true
  }

  const fieldsByPath = fieldMapByPath(params.sections)
  const profileIds = new Set<string>()
  for (const seed of directSeeds) {
    if (!isPackInferenceBindingPath(seed.path)) continue
    const field = fieldsByPath.get(pathDraftKey(seed.path))
    const value = field ? draftValueForField(field, params.drafts) : seed.value
    if (typeof value === 'string' && value.trim()) {
      profileIds.add(value.trim())
    }
  }

  for (const profileId of profileIds) {
    const hasMissingProfileSeed = seedFieldsUnderPath([
      'inference',
      'profiles',
      profileId,
    ]).some(
      (seed) =>
        !params.persistedFieldKeys.has(pathDraftKey(seed.path)) &&
        hasMeaningfulSeedValue(seed.value),
    )
    if (hasMissingProfileSeed) return true

    const runtimeField = fieldsByPath.get(
      pathDraftKey(['inference', 'profiles', profileId, 'runtime']),
    )
    const runtimeId = runtimeField
      ? stringValue(draftValueForField(runtimeField, params.drafts))
      : stringValue(
          seedFieldSpecsByPath.get(
            ['inference', 'profiles', profileId, 'runtime'].join('.'),
          )?.value,
        )
    if (!runtimeId) continue

    const hasMissingRuntimeSeed = seedFieldsUnderPath([
      'inference',
      'runtimes',
      runtimeId,
    ]).some(
      (seed) =>
        !params.persistedFieldKeys.has(pathDraftKey(seed.path)) &&
        hasMeaningfulSeedValue(seed.value),
    )
    if (hasMissingRuntimeSeed) return true
  }

  return false
}

function enabledPacksHaveMissingDefaults(params: {
  enabledPackIds: CapabilityPackId[]
  sections: RuntimeConfigSection[]
  drafts: Drafts
  persistedFieldKeys: string[]
}) {
  if (params.enabledPackIds.length === 0) return false

  const persistedFieldKeys = new Set(params.persistedFieldKeys)
  return params.enabledPackIds.some((packId) =>
    enabledPackHasMissingSeedDefaults({
      packId,
      sections: params.sections,
      drafts: params.drafts,
      persistedFieldKeys,
    }),
  )
}

function capabilityPackIdDifference(
  left: CapabilityPackId[],
  right: CapabilityPackId[],
) {
  const rightIds = new Set(right)
  return left.filter((packId) => !rightIds.has(packId))
}

function capabilityPackIdsEqual(
  left: CapabilityPackId[],
  right: CapabilityPackId[],
) {
  return (
    left.length === right.length &&
    left.every((packId) => right.includes(packId))
  )
}

function capabilityPackForId(packId: CapabilityPackId) {
  return capabilityPackDefinitions.find((pack) => pack.id === packId)
}

function pathBelongsToCapabilityPack(path: string[], packId: CapabilityPackId) {
  return (
    capabilityPackForId(packId)?.directPrefixes.some((prefix) =>
      pathStartsWith(path, prefix),
    ) ?? false
  )
}

function addDisabledPackUnsetPatches(params: {
  disabledPackIds: CapabilityPackId[]
  patchKeys: Set<string>
  patches: RuntimeConfigFieldPatch[]
}) {
  for (const packId of params.disabledPackIds) {
    const pack = capabilityPackForId(packId)
    if (!pack) continue

    for (const prefix of pack.directPrefixes) {
      const key = pathDraftKey(prefix)
      if (params.patchKeys.has(key)) continue

      params.patchKeys.add(key)
      params.patches.push({
        path: prefix,
        unset: true,
      })
    }
  }
}

function buildRuntimeConfigPatches(params: {
  sections: RuntimeConfigSection[]
  drafts: Drafts
  initialDrafts: Drafts
  persistedFieldKeys: string[]
  enabledPackIds: CapabilityPackId[]
  initialEnabledPackIds?: CapabilityPackId[]
}) {
  const patches: RuntimeConfigFieldPatch[] = []
  const patchKeys = new Set<string>()
  const persistedFieldKeys = new Set(params.persistedFieldKeys)
  const inferenceRenamePlan = buildInferenceRenamePlan(
    params.sections,
    params.drafts,
  )
  const initialEnabledPackIds = params.initialEnabledPackIds ?? []
  const newlyEnabledPackIds = capabilityPackIdDifference(
    params.enabledPackIds,
    initialEnabledPackIds,
  )
  const newlyDisabledPackIds = capabilityPackIdDifference(
    initialEnabledPackIds,
    params.enabledPackIds,
  )

  addInferenceRenamePatches({
    sections: params.sections,
    drafts: params.drafts,
    renamePlan: inferenceRenamePlan,
    patchKeys,
    patches,
  })

  for (const section of params.sections) {
    for (const field of section.fields) {
      if (
        isInferenceNameField(field) ||
        fieldBelongsToRenamedInferenceObject(field, inferenceRenamePlan)
      ) {
        continue
      }

      const key = fieldDraftKey(field)
      if ((params.drafts[key] ?? '') === (params.initialDrafts[key] ?? '')) {
        continue
      }
      if (
        newlyDisabledPackIds.some((packId) =>
          pathBelongsToCapabilityPack(field.path, packId),
        )
      ) {
        continue
      }
      patchKeys.add(key)
      patches.push({
        path: field.path,
        value: rewriteInferenceReferenceValue(
          field,
          parseFieldDraft(field, params.drafts[key] ?? ''),
          inferenceRenamePlan,
        ),
      })
    }
  }

  addInferenceReferenceRenamePatches({
    sections: params.sections,
    drafts: params.drafts,
    renamePlan: inferenceRenamePlan,
    patchKeys,
    patches,
  })

  addEnabledPackSeedDefaults({
    enabledPackIds: newlyEnabledPackIds,
    fieldsByPath: fieldMapByPath(params.sections),
    drafts: params.drafts,
    persistedFieldKeys,
    patchKeys,
    patches,
  })

  addDisabledPackUnsetPatches({
    disabledPackIds: newlyDisabledPackIds,
    patchKeys,
    patches,
  })

  if (patches.some((patch) => patch.unset !== true)) {
    addMissingReferencedInferenceDefaults({
      sections: params.sections,
      drafts: params.drafts,
      persistedFieldKeys: params.persistedFieldKeys,
      patchKeys,
      patches,
    })
  }

  return patches
}

function applyInferenceNameReferenceDrafts(params: {
  sections: RuntimeConfigSection[]
  currentDrafts: Drafts
  nameField: RuntimeConfigField
  nextName: string
}) {
  if (!isInferenceNameField(params.nameField)) return params.currentDrafts

  const objectKind = inferenceObjectKindForPath(params.nameField.path)
  const objectId = inferenceObjectIdForPath(params.nameField.path)
  const nameKey = fieldDraftKey(params.nameField)
  const previousName = stringValue(params.currentDrafts[nameKey]) || objectId
  const trimmedNextName = params.nextName.trim()
  const nextDrafts = {
    ...params.currentDrafts,
    [nameKey]: params.nextName,
  }

  if (!objectKind || !trimmedNextName || previousName === trimmedNextName) {
    return nextDrafts
  }

  for (const section of params.sections) {
    for (const field of section.fields) {
      if (isInferenceNameField(field)) continue
      if (inferenceSelectorKind(field) !== objectKind) continue

      const key = fieldDraftKey(field)
      const currentValue = params.currentDrafts[key] ?? valueToDraft(field)
      if (currentValue === previousName || currentValue === objectId) {
        nextDrafts[key] = trimmedNextName
      }
    }
  }

  return nextDrafts
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
        value={value || UNSET_SELECT_VALUE}
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
  const fieldDescription = visibleFieldDescription(field)

  return (
    <div className='grid gap-2 py-4 md:grid-cols-[minmax(180px,260px)_minmax(0,1fr)] md:gap-6'>
      <div className='space-y-1.5'>
        <div className='flex items-center gap-2'>
          <Label htmlFor={inputId}>{field.label}</Label>
          {dirty && <Badge variant='outline'>Changed</Badge>}
          {field.secret && <Badge variant='secondary'>Secret</Badge>}
          {field.readOnly && <Badge variant='outline'>Read-only here</Badge>}
        </div>
        {fieldDescription ? (
          <p className='text-xs leading-5 text-muted-foreground'>
            {fieldDescription}
          </p>
        ) : null}
        {field.validationHints.length > 0 && (
          <p className='text-xs leading-5 text-muted-foreground'>
            {field.validationHints.join(' ')}
          </p>
        )}
        {shouldShowDefaultValue(field) ? (
          <p className='text-xs leading-5 text-muted-foreground'>
            Default: {formatValue(field.defaultValue)}
          </p>
        ) : null}
        {shouldShowEffectiveValue(field) && (
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
    <section
      data-testid={setupSectionTestId(section.key)}
      className='rounded-md border bg-background px-4 py-3'
    >
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

function repoSetupFieldForDrafts(
  field: RuntimeConfigField,
  drafts: Drafts,
): RuntimeConfigField {
  if (!pathsEqual(field.path, REPO_INGEST_FIELD_PATH)) return field

  const syncEnabled = drafts[REPO_SYNC_FIELD_KEY] === 'true'
  if (syncEnabled) return field

  return {
    ...field,
    readOnly: true,
    validationHints: field.readOnly
      ? field.validationHints
      : [...field.validationHints, 'Enable Sync before selecting Ingest.'],
  }
}

function RepoSetupPanel({
  section,
  targets,
  selectedTargetId,
  onTargetChange,
  drafts,
  initialDrafts,
  onDraftChange,
}: {
  section: DisplaySection
  targets: RuntimeConfigTarget[]
  selectedTargetId: string
  onTargetChange: (targetId: string) => void
  drafts: Drafts
  initialDrafts: Drafts
  onDraftChange: (field: RuntimeConfigField, value: string) => void
}) {
  const fields = sortedFields(section)
  const repoTargets = targets.filter((target) =>
    isRepoConfigTargetKind(target.kind),
  )
  const selectedRepoTargetId = repoTargets.some(
    (target) => target.id === selectedTargetId,
  )
    ? selectedTargetId
    : ''

  return (
    <section
      data-testid='repo-setup-options'
      className='rounded-md border bg-background px-4 py-3'
    >
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
        {repoTargets.length === 0 ? (
          <p className='py-4 text-sm text-muted-foreground'>
            No repository config files are available.
          </p>
        ) : (
          <div className='grid gap-2 py-4 md:grid-cols-[minmax(180px,260px)_minmax(0,1fr)] md:gap-6'>
            <div className='space-y-1.5'>
              <Label htmlFor='repo-setup-target'>Repository</Label>
              <p className='text-xs leading-5 text-muted-foreground'>
                Choose which Bitloops config file these repo setup fields save
                into.
              </p>
            </div>
            <select
              id='repo-setup-target'
              aria-label='Repository'
              value={selectedRepoTargetId}
              onChange={(event) => onTargetChange(event.currentTarget.value)}
              className='h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 sm:w-[360px]'
            >
              {selectedRepoTargetId ? null : (
                <option value='' disabled>
                  Select repository config
                </option>
              )}
              {repoTargets.map((configTarget) => (
                <option key={configTarget.id} value={configTarget.id}>
                  {configTarget.group} · {configTarget.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {repoTargets.length > 0
          ? fields.map((field) => {
              const fieldWithRepoRules = repoSetupFieldForDrafts(field, drafts)
              const key = fieldDraftKey(fieldWithRepoRules)
              const draft = drafts[key] ?? ''
              return (
                <ConfigFieldRow
                  key={key}
                  field={fieldWithRepoRules}
                  draft={draft}
                  dirty={draft !== (initialDrafts[key] ?? '')}
                  onChange={(value) => onDraftChange(fieldWithRepoRules, value)}
                />
              )
            })
          : null}
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
  enabled,
  expanded,
  drafts,
  initialDrafts,
  onToggleEnabled,
  onToggleExpanded,
  onDraftChange,
}: {
  pack: CapabilityPackCardView
  enabled: boolean
  expanded: boolean
  drafts: Drafts
  initialDrafts: Drafts
  onToggleEnabled: () => void
  onToggleExpanded: () => void
  onDraftChange: (field: RuntimeConfigField, value: string) => void
}) {
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
          <p className='text-sm text-muted-foreground'>{pack.summary}</p>
        </div>
        <Button
          type='button'
          size='sm'
          variant={enabled ? 'default' : 'outline'}
          aria-pressed={enabled}
          onClick={onToggleEnabled}
        >
          {enabled ? 'Disable' : 'Enable'}
          <span className='sr-only'> {pack.label}</span>
        </Button>
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
            This review groups setup, pack-owned config, and supporting
            dependency changes before saving.
          </p>
        </div>
      </div>

      <div className='mt-4 grid gap-4 lg:grid-cols-2'>
        {renderGroup(
          'Initial setup changes',
          groups.initialSetup,
          'No initial setup changes in draft.',
        )}
        {renderGroup(
          'Pack direct config changes',
          groups.packDirect,
          'No pack direct config changes in draft.',
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
  const [targets, setTargets] = useState<RuntimeConfigTarget[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [selectedRepoTargetId, setSelectedRepoTargetId] = useState<string>('')
  const [snapshot, setSnapshot] = useState<RuntimeConfigSnapshot | null>(null)
  const [repoSnapshot, setRepoSnapshot] =
    useState<RuntimeConfigSnapshot | null>(null)
  const [drafts, setDrafts] = useState<Drafts>({})
  const [repoDrafts, setRepoDrafts] = useState<Drafts>({})
  const [initialDrafts, setInitialDrafts] = useState<Drafts>({})
  const [repoInitialDrafts, setRepoInitialDrafts] = useState<Drafts>({})
  const [, setLoadingTargets] = useState(true)
  const [loadingSnapshot, setLoadingSnapshot] = useState(false)
  const [loadingRepoSnapshot, setLoadingRepoSnapshot] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [persistedFieldKeys, setPersistedFieldKeys] = useState<string[]>([])
  const [repoPersistedFieldKeys, setRepoPersistedFieldKeys] = useState<
    string[]
  >([])
  const [initialEnabledPackIds, setInitialEnabledPackIds] = useState<
    CapabilityPackId[]
  >([])
  const [enabledPackIds, setEnabledPackIds] = useState<CapabilityPackId[]>([])
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
          const daemonTarget = loadedTargets.find(
            (target) => target.kind === 'daemon',
          )
          if (
            current &&
            loadedTargets.some(
              (target) => target.id === current && target.kind === 'daemon',
            )
          ) {
            return current
          }
          return daemonTarget?.id ?? loadedTargets[0]?.id ?? ''
        })
        setSelectedRepoTargetId((current) => {
          const repoTargets = loadedTargets.filter((target) =>
            isRepoConfigTargetKind(target.kind),
          )
          if (current && repoTargets.some((target) => target.id === current)) {
            return current
          }
          return repoTargets[0]?.id ?? ''
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
      setPersistedFieldKeys([])
      setInitialEnabledPackIds([])
      setEnabledPackIds([])
      setExpandedPackIds([])
      return
    }

    const controller = new AbortController()
    setLoadingSnapshot(true)
    setError(null)
    setSaveMessage(null)
    fetchRuntimeConfigSnapshot(selectedTargetId, { signal: controller.signal })
      .then(async (loadedSnapshot) => {
        const normalizedSections = await resolveRuntimeExecutableHints(
          normalizeRuntimeSections(
            loadedSnapshot.sections,
            loadedSnapshot.target.kind,
          ),
          controller.signal,
        )
        const nextDrafts = buildDrafts(normalizedSections)
        const nextEnabledPackIds = capabilityPackIdsFromPersistedSections(
          loadedSnapshot.sections,
        )
        setPersistedFieldKeys(
          persistedFieldKeysFromSections(loadedSnapshot.sections),
        )
        setInitialEnabledPackIds(nextEnabledPackIds)
        setEnabledPackIds(nextEnabledPackIds)
        setExpandedPackIds([])
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

  useEffect(() => {
    if (!selectedRepoTargetId) {
      setRepoSnapshot(null)
      setRepoDrafts({})
      setRepoInitialDrafts({})
      setRepoPersistedFieldKeys([])
      return
    }

    const controller = new AbortController()
    setLoadingRepoSnapshot(true)
    setError(null)
    setSaveMessage(null)
    fetchRuntimeConfigSnapshot(selectedRepoTargetId, {
      signal: controller.signal,
    })
      .then((loadedSnapshot) => {
        const normalizedSections = normalizeRuntimeSections(
          loadedSnapshot.sections,
          loadedSnapshot.target.kind,
        )
        const nextDrafts = buildDrafts(normalizedSections)
        setRepoPersistedFieldKeys(
          persistedFieldKeysFromSections(loadedSnapshot.sections),
        )
        setRepoSnapshot({
          ...loadedSnapshot,
          sections: normalizedSections,
        })
        setRepoDrafts(nextDrafts)
        setRepoInitialDrafts(nextDrafts)
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(errorMessage(err))
      })
      .finally(() => setLoadingRepoSnapshot(false))
    return () => controller.abort()
  }, [selectedRepoTargetId])

  const draftDirty = useMemo(
    () => Object.keys(drafts).some((key) => drafts[key] !== initialDrafts[key]),
    [drafts, initialDrafts],
  )
  const repoDraftDirty = useMemo(
    () =>
      Object.keys(repoDrafts).some(
        (key) => repoDrafts[key] !== repoInitialDrafts[key],
      ),
    [repoDrafts, repoInitialDrafts],
  )
  const enablementDirty = useMemo(
    () => !capabilityPackIdsEqual(enabledPackIds, initialEnabledPackIds),
    [enabledPackIds, initialEnabledPackIds],
  )
  const newlyEnabledPackIds = useMemo(
    () => capabilityPackIdDifference(enabledPackIds, initialEnabledPackIds),
    [enabledPackIds, initialEnabledPackIds],
  )

  const sections = useMemo(
    () => materializeSectionsForDrafts(snapshot?.sections ?? [], drafts),
    [snapshot?.sections, drafts],
  )
  const repoSections = useMemo(
    () =>
      materializeSectionsForDrafts(repoSnapshot?.sections ?? [], repoDrafts),
    [repoSnapshot?.sections, repoDrafts],
  )
  const setupSections = useMemo(
    () =>
      setupSeedSections
        .map((setupSection) =>
          sections.find((section) => section.key === setupSection.key),
        )
        .filter((section): section is RuntimeConfigSection => section != null),
    [sections],
  )
  const repoSetupSection = setupSections.find(
    (section) => section.key === REPO_SETUP_SECTION_KEY,
  )
  const repoTargetSetupSection =
    repoSections.find((section) => section.key === REPO_SETUP_SECTION_KEY) ??
    repoSetupSection
  const daemonSetupSection = setupSections.find(
    (section) => section.key === DAEMON_SETUP_SECTION_KEY,
  )
  const enabledPackDirty = useMemo(
    () =>
      enabledPacksHaveMissingDefaults({
        enabledPackIds: newlyEnabledPackIds,
        sections,
        drafts,
        persistedFieldKeys,
      }),
    [newlyEnabledPackIds, sections, drafts, persistedFieldKeys],
  )
  const runtimeDirty =
    draftDirty || enabledPackDirty || enablementDirty || repoDraftDirty
  const inferenceConfigLayout = useMemo(
    () => buildInferenceConfigLayout(sections),
    [sections],
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
    setDrafts((current) => {
      const key = fieldDraftKey(field)
      const next = isInferenceNameField(field)
        ? applyInferenceNameReferenceDrafts({
            sections,
            currentDrafts: current,
            nameField: field,
            nextName: value,
          })
        : {
            ...applyProfileToolDefaults(current, field, value),
            [key]: value,
          }

      if (key === REPO_SYNC_FIELD_KEY && value !== 'true') {
        next[REPO_INGEST_FIELD_KEY] = 'false'
      }
      if (key === REPO_INGEST_FIELD_KEY && value === 'true') {
        next[REPO_SYNC_FIELD_KEY] = 'true'
      }

      return next
    })
  }

  function handleRepoDraftChange(field: RuntimeConfigField, value: string) {
    setRepoDrafts((current) => {
      const key = fieldDraftKey(field)
      const next = {
        ...current,
        [key]: value,
      }

      if (key === REPO_SYNC_FIELD_KEY && value !== 'true') {
        next[REPO_INGEST_FIELD_KEY] = 'false'
      }
      if (key === REPO_INGEST_FIELD_KEY && value === 'true') {
        next[REPO_SYNC_FIELD_KEY] = 'true'
      }

      return next
    })
  }

  function handleCapabilityPackEnabledToggle(id: CapabilityPackId) {
    const enabled = enabledPackIds.includes(id)
    setEnabledPackIds((current) =>
      enabled ? current.filter((packId) => packId !== id) : [...current, id],
    )
    if (!enabled) {
      setExpandedPackIds((current) =>
        current.includes(id) ? current : [...current, id],
      )
    }
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
    setRepoDrafts(repoInitialDrafts)
    setEnabledPackIds(initialEnabledPackIds)
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
    const repoPatches: RuntimeConfigFieldPatch[] = []
    try {
      const inferenceNameError = validateInferenceNames(sections, drafts)
      if (inferenceNameError) {
        setError(inferenceNameError)
        return
      }

      if (draftDirty || enabledPackDirty || enablementDirty) {
        patches.push(
          ...buildRuntimeConfigPatches({
            sections,
            drafts,
            initialDrafts,
            persistedFieldKeys,
            enabledPackIds,
            initialEnabledPackIds,
          }),
        )
      }
      if (repoDraftDirty && repoSnapshot) {
        repoPatches.push(
          ...buildRuntimeConfigPatches({
            sections: repoSections,
            drafts: repoDrafts,
            initialDrafts: repoInitialDrafts,
            persistedFieldKeys: repoPersistedFieldKeys,
            enabledPackIds: [],
          }),
        )
      }
    } catch (err: unknown) {
      setError(errorMessage(err))
      return
    }

    setSaving(true)
    setError(null)
    setSaveMessage(null)
    try {
      if (patches.length > 0) {
        const updated = await updateRuntimeConfig({
          targetId: snapshot.target.id,
          expectedRevision: snapshot.revision,
          patches,
        })
        const normalizedSections = normalizeRuntimeSections(
          updated.sections,
          updated.target.kind,
        )
        if (
          !sectionsReflectPatches(
            normalizedSections,
            patches,
            persistedFieldKeysFromSections(updated.sections),
          )
        ) {
          setError('Runtime config save did not change the returned snapshot.')
          return
        }
        const nextDrafts = buildDrafts(normalizedSections)
        const nextEnabledPackIds = capabilityPackIdsFromPersistedSections(
          updated.sections,
        )
        setPersistedFieldKeys(persistedFieldKeysFromSections(updated.sections))
        setInitialEnabledPackIds(nextEnabledPackIds)
        setEnabledPackIds(nextEnabledPackIds)
        setExpandedPackIds([])
        setSnapshot({
          ...updated,
          sections: normalizedSections,
        })
        setDrafts(nextDrafts)
        setInitialDrafts(nextDrafts)
      }

      if (repoPatches.length > 0 && repoSnapshot) {
        const updatedRepo = await updateRuntimeConfig({
          targetId: repoSnapshot.target.id,
          expectedRevision: repoSnapshot.revision,
          patches: repoPatches,
        })
        const normalizedRepoSections = normalizeRuntimeSections(
          updatedRepo.sections,
          updatedRepo.target.kind,
        )
        if (
          !sectionsReflectPatches(
            normalizedRepoSections,
            repoPatches,
            persistedFieldKeysFromSections(updatedRepo.sections),
          )
        ) {
          setError('Runtime config save did not change the returned snapshot.')
          return
        }
        const nextRepoDrafts = buildDrafts(normalizedRepoSections)
        setRepoPersistedFieldKeys(
          persistedFieldKeysFromSections(updatedRepo.sections),
        )
        setRepoSnapshot({
          ...updatedRepo,
          sections: normalizedRepoSections,
        })
        setRepoDrafts(nextRepoDrafts)
        setRepoInitialDrafts(nextRepoDrafts)
      }

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

        {daemonSetupSection ? (
          <ConfigSectionPanel
            section={daemonSetupSection}
            drafts={drafts}
            initialDrafts={initialDrafts}
            onDraftChange={handleDraftChange}
          />
        ) : null}

        {repoTargetSetupSection ? (
          <RepoSetupPanel
            section={repoTargetSetupSection}
            targets={targets}
            selectedTargetId={selectedRepoTargetId}
            onTargetChange={setSelectedRepoTargetId}
            drafts={repoDrafts}
            initialDrafts={repoInitialDrafts}
            onDraftChange={handleRepoDraftChange}
          />
        ) : null}

        {snapshot ? (
          <section data-testid='inference-config-panel' className='space-y-3'>
            <div>
              <h3 className='text-base font-semibold'>Inference config</h3>
              <p className='mt-1 text-sm text-muted-foreground'>
                Strict Bitloops inference daemon profiles and runtimes backed by
                [inference.profiles.*] and [inference.runtimes.*] TOML.
              </p>
            </div>
            <div className='grid gap-3'>
              {[
                ...inferenceConfigLayout.profiles,
                ...inferenceConfigLayout.runtimes,
              ].map((section) => (
                <ConfigSectionPanel
                  key={section.key}
                  section={section}
                  drafts={drafts}
                  initialDrafts={initialDrafts}
                  onDraftChange={handleDraftChange}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section
          data-testid='setup-capability-packs-panel'
          className='space-y-3'
        >
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
                  enabled={enabledPackIds.includes(pack.id)}
                  expanded={expandedPackIds.includes(pack.id)}
                  drafts={drafts}
                  initialDrafts={initialDrafts}
                  onToggleEnabled={() =>
                    handleCapabilityPackEnabledToggle(pack.id)
                  }
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
                disabled={
                  !runtimeDirty ||
                  saving ||
                  loadingSnapshot ||
                  loadingRepoSnapshot
                }
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
