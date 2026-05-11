import {
  Suspense,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Canvas, type ThreeEvent, useFrame, useThree } from '@react-three/fiber'
import {
  Billboard,
  Html,
  OrbitControls,
  QuadraticBezierLine,
  Text,
} from '@react-three/drei'
import {
  BookOpen,
  Boxes,
  Cable,
  ChevronLeft,
  Code2,
  Database,
  FileCode2,
  Globe2,
  Layers3,
  Maximize2,
  Minimize2,
  Monitor,
  Network,
  Package2,
  Puzzle,
  Radar,
  RadioTower,
  Route,
  ScanSearch,
  Sparkles,
  TerminalSquare,
  type LucideIcon,
} from 'lucide-react'
import * as THREE from 'three'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type {
  ArchitectureComponentNode,
  ArchitectureContainerNode,
  ArchitectureDeploymentUnitNode,
  ArchitectureEntryPointNode,
  ArchitectureNavigationContext,
  ArchitectureSceneModel,
} from '../model'

type HubLevelId =
  | 'root'
  | 'overview'
  | 'entry-points'
  | 'state'
  | 'flows'
  | 'change'
  | 'data'
  | 'interfaces'
  | 'quality'
  | 'freshness'

type HubAssetId =
  | 'core'
  | 'terminal'
  | 'tower'
  | 'observatory'
  | 'workshop'
  | 'vault'
  | 'display'
  | 'dock'
  | 'scanner'
  | 'module'
  | 'gateway'

type HubConceptKind =
  | 'product'
  | 'surface'
  | 'runtime'
  | 'knowledge'
  | 'capability'
  | 'state'
  | 'integration'
  | 'review'

type HubConcept = {
  id: string
  label: string
  shortLabel?: string
  kind: HubConceptKind
  summary: string
  evidence: string[]
  metrics: Array<{ label: string; value: string }>
  children?: string[]
  assetId: HubAssetId
  assetOptions: HubAssetId[]
  colour: string
  importance: number
}

type HubMenuOption = HubConcept & {
  targetLevelId?: HubLevelId
}

type HubMenuLevel = {
  id: HubLevelId
  title: string
  summary: string
  options: HubMenuOption[]
}

type HubSceneNode = HubConcept & {
  targetLevelId?: HubLevelId
  position: THREE.Vector3
  selected: boolean
  focus: boolean
  dimmed: boolean
  canDive: boolean
}

type HubScenePath = {
  id: string
  from: string
  to: string
  colour: string
  label?: string
  active: boolean
}

type HubSceneModel = {
  nodes: HubSceneNode[]
  paths: HubScenePath[]
  centre: THREE.Vector3
  radius: number
  title: string
}

type ArchitectureSystemHubProps = {
  scene: ArchitectureSceneModel
}

const ROOT_CONCEPT_ID = 'bitloops'
const BACKGROUND = '#030812'
const LABEL = '#E8FEFF'
const CYAN = '#52F6FF'
const MINT = '#50FFC2'
const AMBER = '#FFB14A'
const RED = '#FF355D'
const BLUE = '#2D8CFF'
const VIOLET = '#C879FF'

const assetLabels: Record<HubAssetId, string> = {
  core: 'Core',
  terminal: 'Console',
  tower: 'Tower',
  observatory: 'Observatory',
  workshop: 'Workshop',
  vault: 'Vault',
  display: 'Display',
  dock: 'Dock',
  scanner: 'Scanner',
  module: 'Module',
  gateway: 'Gateway',
}

const conceptRegistry: Record<string, HubConcept> = {
  bitloops: {
    id: 'bitloops',
    label: 'Bitloops developer platform',
    shortLabel: 'Bitloops',
    kind: 'product',
    summary:
      'A local development intelligence platform that observes repositories, builds queryable context, and presents it through CLI, daemon, DevQL, and dashboard surfaces.',
    evidence: [
      'bitloops/src/cli',
      'bitloops/src/daemon',
      'bitloops/src/graphql',
      'bitloops/src/capability_packs',
    ],
    metrics: [
      { label: 'Product domains', value: '6' },
      { label: 'Primary surfaces', value: 'CLI + Dashboard' },
    ],
    children: [
      'developer-surfaces',
      'runtime-orchestration',
      'devql-knowledge',
      'analysis-capabilities',
      'state-materialisation',
      'agent-integrations',
    ],
    assetId: 'core',
    assetOptions: ['core', 'observatory', 'display'],
    colour: CYAN,
    importance: 1,
  },
  'developer-surfaces': {
    id: 'developer-surfaces',
    label: 'Developer surfaces',
    kind: 'surface',
    summary:
      'The places humans touch the product: CLI, local dashboard, IDE extension, and documentation.',
    evidence: ['bitloops/src/cli', 'local-dashboard/src', 'vscode-extension'],
    metrics: [
      { label: 'Surfaces', value: '4' },
      { label: 'Human entry', value: 'commands + UI' },
    ],
    children: ['cli', 'dashboard', 'vscode-extension', 'documentation'],
    assetId: 'display',
    assetOptions: ['display', 'terminal', 'gateway'],
    colour: MINT,
    importance: 0.86,
  },
  'runtime-orchestration': {
    id: 'runtime-orchestration',
    label: 'Runtime orchestration',
    kind: 'runtime',
    summary:
      'Daemon, task queue, sessions, hooks, and sync lifecycle that keep repository context current.',
    evidence: ['bitloops/src/daemon', 'bitloops/src/session'],
    metrics: [
      { label: 'Main loop', value: 'sync -> enrich' },
      { label: 'Runtime role', value: 'orchestration' },
    ],
    children: ['daemon', 'task-queue', 'sync-lifecycle', 'sessions', 'hooks'],
    assetId: 'tower',
    assetOptions: ['tower', 'core', 'gateway'],
    colour: BLUE,
    importance: 0.9,
  },
  'devql-knowledge': {
    id: 'devql-knowledge',
    label: 'DevQL knowledge layer',
    kind: 'knowledge',
    summary:
      'GraphQL schema, query contexts, capability host, language packs, and relational facts that make the codebase queryable.',
    evidence: ['bitloops/src/graphql', 'bitloops/src/host/capability_host'],
    metrics: [
      { label: 'Interface', value: 'GraphQL' },
      { label: 'Record shape', value: 'facts + views' },
    ],
    children: [
      'graphql-api',
      'capability-host',
      'language-packs',
      'relational-store',
      'schema-modules',
    ],
    assetId: 'observatory',
    assetOptions: ['observatory', 'vault', 'display'],
    colour: VIOLET,
    importance: 0.88,
  },
  'analysis-capabilities': {
    id: 'analysis-capabilities',
    label: 'Analysis capabilities',
    kind: 'capability',
    summary:
      'Capability packs that turn raw code facts into navigable product information.',
    evidence: ['bitloops/src/capability_packs'],
    metrics: [
      { label: 'Capability packs', value: '6' },
      { label: 'Current focus', value: 'navigation context' },
    ],
    children: [
      'codecity',
      'architecture-graph',
      'navigation-context',
      'test-harness',
      'knowledge-pack',
      'semantic-clones',
    ],
    assetId: 'workshop',
    assetOptions: ['workshop', 'module', 'scanner'],
    colour: AMBER,
    importance: 0.94,
  },
  'state-materialisation': {
    id: 'state-materialisation',
    label: 'State and materialisation',
    kind: 'state',
    summary:
      'Durable task records, checkpoints, relational stores, generated views, and accepted signatures.',
    evidence: ['bitloops/src/host/checkpoints', 'bitloops/src/daemon/tasks'],
    metrics: [
      { label: 'Freshness unit', value: 'signature' },
      { label: 'Review unit', value: 'view' },
    ],
    children: [
      'checkpoints',
      'task-records',
      'navigation-views',
      'materialised-refs',
    ],
    assetId: 'vault',
    assetOptions: ['vault', 'scanner', 'core'],
    colour: '#7AA2FF',
    importance: 0.82,
  },
  'agent-integrations': {
    id: 'agent-integrations',
    label: 'Agent integrations',
    kind: 'integration',
    summary:
      'Adapters and protocols that let external coding agents and inference runtimes participate in Bitloops workflows.',
    evidence: ['bitloops/src/adapters/agents', 'bitloops-inference-protocol'],
    metrics: [
      { label: 'Adapters', value: '3' },
      { label: 'Protocol crate', value: '1' },
    ],
    children: ['claude-code', 'copilot', 'open-code', 'inference-protocol'],
    assetId: 'dock',
    assetOptions: ['dock', 'gateway', 'terminal'],
    colour: '#D885FF',
    importance: 0.74,
  },
  'runtime-flow': {
    id: 'runtime-flow',
    label: 'Runtime flow',
    kind: 'runtime',
    summary:
      'A human action enters through a surface, schedules daemon work, updates DevQL facts, and returns a reviewable view.',
    evidence: ['bitloops/src/daemon', 'bitloops/src/graphql'],
    metrics: [{ label: 'Flow shape', value: 'human -> runtime -> review' }],
    assetId: 'gateway',
    assetOptions: ['gateway', 'tower'],
    colour: BLUE,
    importance: 1,
  },
  'human-intent': flowConcept(
    'human-intent',
    'Human intent',
    'Ask, inspect, change, or review a repository.',
    'Route',
    MINT,
    'gateway',
  ),
  'surface-action': flowConcept(
    'surface-action',
    'CLI or dashboard',
    'Command or UI action enters the product.',
    'Surface',
    CYAN,
    'terminal',
  ),
  'daemon-work': flowConcept(
    'daemon-work',
    'Daemon work',
    'Background task schedules repository sync and follow-up work.',
    'Runtime',
    BLUE,
    'tower',
  ),
  'devql-read-model': flowConcept(
    'devql-read-model',
    'DevQL read model',
    'Facts are produced and queried through GraphQL.',
    'GraphQL',
    VIOLET,
    'observatory',
  ),
  'capability-output': flowConcept(
    'capability-output',
    'Capability output',
    'Packs produce architecture, CodeCity, tests, and navigation context.',
    'Capability',
    AMBER,
    'workshop',
  ),
  'human-review': flowConcept(
    'human-review',
    'Human review',
    'Freshness, context changes, and drill-down guide inspection.',
    'Review',
    RED,
    'scanner',
  ),
  'review-system': {
    id: 'review-system',
    label: 'Review system',
    kind: 'review',
    summary:
      'Accepted baseline, current facts, delta, and materialised view define whether generated understanding can be trusted.',
    evidence: ['navigation_context_views'],
    metrics: [{ label: 'Review state', value: 'signature based' }],
    assetId: 'scanner',
    assetOptions: ['scanner', 'observatory'],
    colour: AMBER,
    importance: 1,
  },
}

const leafConcepts: Array<
  [string, string, HubConceptKind, string, string, string, HubAssetId]
> = [
  [
    'cli',
    'CLI',
    'surface',
    'Command surface for sync, DevQL, daemon, and workflow operations.',
    'bitloops/src/cli',
    MINT,
    'terminal',
  ],
  [
    'dashboard',
    'Local dashboard',
    'surface',
    'Browser UI for sessions, queries, Code Atlas, and architecture.',
    'local-dashboard/src',
    MINT,
    'display',
  ],
  [
    'vscode-extension',
    'VS Code extension',
    'surface',
    'IDE integration surface.',
    'vscode-extension',
    MINT,
    'gateway',
  ],
  [
    'documentation',
    'Documentation',
    'surface',
    'Written product guidance.',
    'documentation',
    MINT,
    'module',
  ],
  [
    'daemon',
    'Daemon',
    'runtime',
    'Long-running local process that owns background work.',
    'bitloops/src/daemon',
    BLUE,
    'tower',
  ],
  [
    'task-queue',
    'Task queue',
    'runtime',
    'Queue and workers for sync and enrichment.',
    'bitloops/src/daemon/tasks',
    BLUE,
    'gateway',
  ],
  [
    'sync-lifecycle',
    'Sync lifecycle',
    'runtime',
    'Repository inspection and artefact materialisation.',
    'bitloops/src/host/devql/commands_sync',
    BLUE,
    'scanner',
  ],
  [
    'sessions',
    'Sessions',
    'runtime',
    'Conversation and workflow state.',
    'bitloops/src/session',
    BLUE,
    'vault',
  ],
  [
    'hooks',
    'Hooks',
    'runtime',
    'Runtime event dispatchers.',
    'bitloops/src/host/hooks',
    BLUE,
    'module',
  ],
  [
    'graphql-api',
    'GraphQL API',
    'knowledge',
    'Typed query and mutation surface.',
    'bitloops/src/graphql',
    VIOLET,
    'observatory',
  ],
  [
    'capability-host',
    'Capability host',
    'knowledge',
    'Registry and lifecycle for capability packs.',
    'bitloops/src/host/capability_host',
    VIOLET,
    'tower',
  ],
  [
    'language-packs',
    'Language packs',
    'knowledge',
    'Language-aware extraction adapters.',
    'bitloops/src/host/extension_host/language',
    VIOLET,
    'dock',
  ],
  [
    'relational-store',
    'Relational store',
    'state',
    'SQLite-backed DevQL fact tables.',
    'bitloops/src/stores',
    '#7AA2FF',
    'vault',
  ],
  [
    'schema-modules',
    'Schema modules',
    'knowledge',
    'Pack-owned GraphQL schema additions.',
    'bitloops/src/capability_packs',
    VIOLET,
    'module',
  ],
  [
    'codecity',
    'CodeCity',
    'capability',
    'Builds the file/world visualisation and health overlays.',
    'bitloops/src/capability_packs/codecity',
    AMBER,
    'display',
  ],
  [
    'architecture-graph',
    'Architecture graph',
    'capability',
    'Builds components, contracts, entry points, and system facts.',
    'bitloops/src/capability_packs/architecture_graph',
    AMBER,
    'observatory',
  ],
  [
    'navigation-context',
    'Navigation context',
    'capability',
    'Tracks primitives, signatures, stale reasons, and materialised context.',
    'bitloops/src/capability_packs/navigation_context',
    AMBER,
    'scanner',
  ],
  [
    'test-harness',
    'Test harness',
    'capability',
    'Discovers tests, coverage, classifications, and verification records.',
    'bitloops/src/capability_packs/test_harness',
    AMBER,
    'module',
  ],
  [
    'knowledge-pack',
    'Knowledge pack',
    'capability',
    'Stores and refreshes durable knowledge records.',
    'bitloops/src/capability_packs/knowledge.rs',
    AMBER,
    'vault',
  ],
  [
    'semantic-clones',
    'Semantic clones',
    'capability',
    'Identifies similar symbols and clone edges.',
    'bitloops/src/capability_packs/semantic_clones',
    AMBER,
    'dock',
  ],
  [
    'checkpoints',
    'Checkpoints',
    'state',
    'Durable runtime and session snapshots.',
    'bitloops/src/host/checkpoints',
    '#7AA2FF',
    'vault',
  ],
  [
    'task-records',
    'Task records',
    'state',
    'Persisted task status for sync and enrichment.',
    'bitloops/src/daemon/tasks',
    '#7AA2FF',
    'module',
  ],
  [
    'navigation-views',
    'Navigation views',
    'state',
    'Accepted and current signatures for generated views.',
    'bitloops/src/capability_packs/navigation_context',
    '#7AA2FF',
    'scanner',
  ],
  [
    'materialised-refs',
    'Materialised refs',
    'state',
    'Stable references to generated context snapshots.',
    'bitloops/src/capability_packs/navigation_context',
    '#7AA2FF',
    'vault',
  ],
  [
    'claude-code',
    'Claude Code',
    'integration',
    'Adapter for Claude Code workflows and hooks.',
    'bitloops/src/adapters/agents/claude_code',
    '#D885FF',
    'dock',
  ],
  [
    'copilot',
    'Copilot',
    'integration',
    'Adapter for Copilot-related transcript workflows.',
    'bitloops/src/adapters/agents/copilot',
    '#D885FF',
    'dock',
  ],
  [
    'open-code',
    'OpenCode',
    'integration',
    'Adapter for OpenCode agent sessions.',
    'bitloops/src/adapters/agents/open_code',
    '#D885FF',
    'terminal',
  ],
  [
    'inference-protocol',
    'Inference protocol',
    'integration',
    'Protocol crate for inference runtime communication.',
    'bitloops-inference-protocol',
    '#D885FF',
    'gateway',
  ],
]

for (const [
  id,
  label,
  kind,
  summary,
  evidence,
  colour,
  assetId,
] of leafConcepts) {
  conceptRegistry[id] = {
    id,
    label,
    kind,
    summary,
    evidence: [evidence],
    metrics: [
      { label: 'Level', value: 'leaf' },
      { label: 'Evidence', value: '1 path' },
    ],
    assetId,
    assetOptions: [assetId, 'module', 'gateway'],
    colour,
    importance: 0.58,
  }
}

function flowConcept(
  id: string,
  label: string,
  summary: string,
  evidence: string,
  colour: string,
  assetId: HubAssetId,
): HubConcept {
  return {
    id,
    label,
    kind: 'review',
    summary,
    evidence: [evidence],
    metrics: [{ label: 'Lens', value: 'runtime' }],
    assetId,
    assetOptions: [assetId, 'module', 'gateway'],
    colour,
    importance: 0.72,
  }
}

function supportsWebGL() {
  if (typeof document === 'undefined') {
    return false
  }

  if (
    typeof navigator !== 'undefined' &&
    navigator.userAgent.toLowerCase().includes('jsdom')
  ) {
    return false
  }

  const canvas = document.createElement('canvas')
  return Boolean(
    canvas.getContext('webgl2') ||
    canvas.getContext('webgl') ||
    canvas.getContext('experimental-webgl'),
  )
}

function conceptById(id: string): HubConcept {
  return conceptRegistry[id] ?? conceptRegistry[ROOT_CONCEPT_ID]!
}

function formatCount(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function compactPathList(paths: Array<string | null | undefined>, limit = 4) {
  return paths.filter((path): path is string => Boolean(path)).slice(0, limit)
}

function overviewOptionId(prefix: string, id: string) {
  return `overview-${prefix}-${id.replaceAll(/[^a-zA-Z0-9_-]+/gu, '-')}`
}

function formatContainerKind(kind: string | null) {
  return kind == null ? 'container' : kind.replaceAll('_', ' ')
}

function containerPresentation(kind: string | null): {
  conceptKind: HubConceptKind
  assetId: HubAssetId
  assetOptions: HubAssetId[]
  colour: string
} {
  switch (kind) {
    case 'cli':
      return {
        conceptKind: 'surface',
        assetId: 'terminal',
        assetOptions: ['terminal', 'gateway', 'core'],
        colour: MINT,
      }
    case 'documentation_site':
      return {
        conceptKind: 'knowledge',
        assetId: 'display',
        assetOptions: ['display', 'observatory', 'gateway'],
        colour: BLUE,
      }
    case 'editor_extension':
      return {
        conceptKind: 'surface',
        assetId: 'gateway',
        assetOptions: ['gateway', 'display', 'workshop'],
        colour: CYAN,
      }
    case 'dev_tool':
      return {
        conceptKind: 'capability',
        assetId: 'workshop',
        assetOptions: ['workshop', 'terminal', 'module'],
        colour: VIOLET,
      }
    default:
      return {
        conceptKind: 'product',
        assetId: 'core',
        assetOptions: ['core', 'gateway', 'dock'],
        colour: BLUE,
      }
  }
}

function buildOverviewLevel(scene: ArchitectureSceneModel): HubMenuLevel {
  const options =
    scene.containers.length > 0
      ? scene.containers.map((container) => {
          const components = scene.components.filter(
            (component) => component.containerId === container.id,
          )
          const relationshipCount = components.reduce(
            (count, component) =>
              count +
              component.contractInCount +
              component.contractOutCount +
              component.directInCount +
              component.directOutCount,
            0,
          )
          const entryLabels = scene.entryPoints
            .filter((entryPoint) => entryPoint.containerId === container.id)
            .map((entryPoint) => entryPoint.label)
          const deploymentLabels = scene.deploymentUnits
            .filter(
              (deploymentUnit) => deploymentUnit.containerId === container.id,
            )
            .map((deploymentUnit) => deploymentUnit.label)
          const presentation = containerPresentation(container.kind)

          return menuConcept({
            id: overviewOptionId('container', container.id),
            label: container.label,
            kind: presentation.conceptKind,
            summary: [
              formatContainerKind(container.kind),
              formatCount(container.componentIds.length, 'component'),
              entryLabels.length > 0
                ? `entries: ${entryLabels.slice(0, 3).join(', ')}`
                : null,
              deploymentLabels.length > 0
                ? `deploys as ${deploymentLabels.slice(0, 2).join(', ')}`
                : null,
            ]
              .filter(Boolean)
              .join(' · '),
            evidence: compactPathList([
              container.path,
              container.key,
              ...entryLabels,
              ...deploymentLabels,
            ]),
            metrics: [
              { label: 'Kind', value: container.kind ?? 'unknown' },
              {
                label: 'Components',
                value: String(container.componentIds.length),
              },
              {
                label: 'Entry points',
                value: String(container.entryPointIds.length),
              },
              {
                label: 'Deployables',
                value: String(container.deploymentUnitIds.length),
              },
              { label: 'Relations', value: String(relationshipCount) },
            ],
            assetId: presentation.assetId,
            assetOptions: presentation.assetOptions,
            colour: presentation.colour,
            importance: 0.9,
          })
        })
      : [
          menuConcept({
            id: 'overview-repository',
            label: scene.repositoryLabel,
            kind: 'product',
            summary: 'No architecture containers were discovered yet.',
            evidence: [scene.title],
            metrics: [
              { label: 'Containers', value: '0' },
              {
                label: 'Components',
                value: String(scene.summary.componentCount),
              },
            ],
            assetId: 'core',
            assetOptions: ['core', 'observatory', 'display'],
            colour: CYAN,
            importance: 1,
          }),
        ]

  return {
    id: 'overview',
    title: 'Overview',
    summary: `Product surfaces discovered for ${scene.repositoryLabel}.`,
    options,
  }
}

function buildEntryPointsLevel(scene: ArchitectureSceneModel): HubMenuLevel {
  const componentsById = new Map(
    scene.components.map((component) => [component.id, component]),
  )
  const containersById = new Map(
    scene.containers.map((container) => [container.id, container]),
  )
  const options =
    scene.entryPoints.length > 0
      ? scene.entryPoints.map((entryPoint) => {
          const container = containersById.get(entryPoint.containerId)
          const component =
            entryPoint.componentId == null
              ? null
              : componentsById.get(entryPoint.componentId)
          const ownerPath = component?.path ?? container?.path ?? container?.key
          return menuConcept({
            id: overviewOptionId('entry-point', entryPoint.id),
            label: entryPoint.label,
            kind: 'surface',
            summary: [
              entryPoint.entryKind ?? 'entry point',
              container?.label == null ? null : `container: ${container.label}`,
              ownerPath == null ? null : `path: ${ownerPath}`,
            ]
              .filter(Boolean)
              .join(' · '),
            evidence: compactPathList([
              ownerPath,
              container?.label,
              entryPoint.entryKind,
            ]),
            metrics: [
              { label: 'Kind', value: entryPoint.entryKind ?? 'unknown' },
              { label: 'Container', value: container?.label ?? 'unknown' },
            ],
            assetId:
              entryPoint.entryKind?.includes('cli') === true
                ? 'terminal'
                : 'gateway',
            assetOptions: ['gateway', 'terminal', 'display'],
            colour: BLUE,
            importance: 0.86,
          })
        })
      : [
          menuConcept({
            id: 'entry-points-empty',
            label: 'No entry points',
            kind: 'surface',
            summary: 'No entry point facts were discovered for this codebase.',
            evidence: ['architecture.entryPoints'],
            metrics: [{ label: 'Entry points', value: '0' }],
            assetId: 'gateway',
            assetOptions: ['gateway', 'terminal', 'display'],
            colour: BLUE,
            importance: 0.72,
          }),
        ]

  return {
    id: 'entry-points',
    title: 'Entry Points',
    summary:
      'Ways a human, tool, process, or route enters behaviour in the system.',
    options,
  }
}

function buildStateLevel(scene: ArchitectureSceneModel): HubMenuLevel {
  const options =
    scene.persistenceObjects.length > 0
      ? scene.persistenceObjects.map((object) =>
          menuConcept({
            id: overviewOptionId('state', object.id),
            label: object.label,
            kind: 'state',
            summary: [
              object.path,
              formatCount(object.readByComponentIds.length, 'reader'),
              formatCount(object.writtenByComponentIds.length, 'writer'),
            ]
              .filter(Boolean)
              .join(' · '),
            evidence: compactPathList([object.path, object.label]),
            metrics: [
              {
                label: 'Readers',
                value: String(object.readByComponentIds.length),
              },
              {
                label: 'Writers',
                value: String(object.writtenByComponentIds.length),
              },
            ],
            assetId: 'vault',
            assetOptions: ['vault', 'scanner', 'module'],
            colour: '#7AA2FF',
            importance: 0.82,
          }),
        )
      : [
          menuConcept({
            id: 'state-empty',
            label: 'No persistence objects',
            kind: 'state',
            summary:
              'No persistence objects were discovered in the current architecture facts.',
            evidence: ['architecture.persistenceObjects'],
            metrics: [
              { label: 'Objects', value: '0' },
              {
                label: 'Reads/writes',
                value: String(scene.dataConnections.length),
              },
            ],
            assetId: 'vault',
            assetOptions: ['vault', 'scanner', 'module'],
            colour: '#7AA2FF',
            importance: 0.72,
          }),
        ]

  return {
    id: 'state',
    title: 'State And Persistence',
    summary:
      'Durable objects and read/write relationships discovered from architecture facts.',
    options,
  }
}

function buildTopLevelMenu(
  scene: ArchitectureSceneModel,
  context: ArchitectureNavigationContext | null,
): HubMenuLevel {
  const options: HubMenuOption[] = [
    menuConcept({
      id: 'menu-overview',
      label: 'Overview',
      kind: 'product',
      summary: [
        formatCount(scene.summary.containerCount, 'container'),
        formatCount(scene.summary.componentCount, 'component'),
        formatCount(scene.entryPoints.length, 'entry point'),
      ].join(', '),
      evidence: compactPathList(
        scene.containers.map((container) => container.path),
      ),
      metrics: [
        { label: 'Containers', value: String(scene.summary.containerCount) },
        { label: 'Components', value: String(scene.summary.componentCount) },
      ],
      assetId: 'core',
      assetOptions: ['core', 'observatory', 'display'],
      colour: CYAN,
      targetLevelId: 'overview',
      importance: 1,
    }),
    menuConcept({
      id: 'menu-state',
      label: 'State and persistence',
      kind: 'state',
      summary:
        scene.persistenceObjects.length > 0
          ? scene.persistenceObjects
              .slice(0, 3)
              .map((object) => object.label)
              .join(' · ')
          : 'No persistence objects were discovered.',
      evidence: ['architecture.persistenceObjects'],
      metrics: [
        { label: 'Objects', value: String(scene.persistenceObjects.length) },
        { label: 'Reads/writes', value: String(scene.dataConnections.length) },
      ],
      assetId: 'vault',
      assetOptions: ['vault', 'scanner', 'module'],
      colour: '#7AA2FF',
      targetLevelId: 'state',
      importance: 0.82,
    }),
  ]

  if (context != null) {
    options.push(
      menuConcept({
        id: 'menu-freshness',
        label:
          context.status === 'stale'
            ? 'Freshness: review needed'
            : 'Freshness: accepted',
        kind: 'review',
        summary:
          context.status === 'stale'
            ? `${formatCount(context.changeCount, 'changed primitive')} since the accepted architecture baseline.`
            : 'The accepted and current architecture signatures match.',
        evidence: [
          'navigation context',
          context.materialisedRef ?? 'No materialised ref',
        ],
        metrics: [
          { label: 'Status', value: context.status },
          { label: 'Changes', value: String(context.changeCount) },
        ],
        assetId: 'scanner',
        assetOptions: ['scanner', 'observatory', 'vault'],
        colour: context.status === 'stale' ? AMBER : MINT,
        targetLevelId: 'freshness',
        importance: context.status === 'stale' ? 0.94 : 0.76,
      }),
    )
  }

  return {
    id: 'root',
    title: 'Architecture',
    summary:
      'Select what you want to inspect; the scene shows the relevant children.',
    options,
  }
}

function reviewConcepts(
  context: ArchitectureNavigationContext | null,
): HubMenuOption[] {
  const current = context?.currentSignature?.slice(0, 12) ?? 'unknown'
  const accepted = context?.acceptedSignature?.slice(0, 12) ?? 'none'
  const changeCount = String(context?.changeCount ?? 0)

  return [
    {
      id: 'review-current',
      label: 'Current code facts',
      kind: 'review',
      summary:
        'Latest primitive signatures produced from the current repository state.',
      evidence: ['navigation_context_primitives'],
      metrics: [{ label: 'Current', value: current }],
      assetId: 'observatory',
      assetOptions: ['observatory', 'scanner', 'vault'],
      colour: CYAN,
      importance: 0.82,
    },
    {
      id: 'review-accepted',
      label: 'Accepted baseline',
      kind: 'review',
      summary: 'Last architecture context version trusted by a human review.',
      evidence: ['navigation_context_view_acceptance_history'],
      metrics: [{ label: 'Accepted', value: accepted }],
      assetId: 'vault',
      assetOptions: ['vault', 'scanner', 'core'],
      colour: MINT,
      importance: 0.72,
    },
    {
      id: 'review-delta',
      label: 'Delta to inspect',
      kind: 'review',
      summary: 'Changed primitives that should guide spatial review targets.',
      evidence: ['staleReason.changedPrimitives'],
      metrics: [{ label: 'Changes', value: changeCount }],
      assetId: 'scanner',
      assetOptions: ['scanner', 'observatory', 'gateway'],
      colour: AMBER,
      importance: 0.95,
    },
    {
      id: 'review-materialised',
      label: 'Materialised view',
      kind: 'review',
      summary: 'Stable generated snapshot that can back the product overview.',
      evidence: [context?.materialisedRef ?? 'materialised ref not set'],
      metrics: [
        {
          label: 'Snapshot',
          value: context?.materialisedRef == null ? 'not set' : 'available',
        },
      ],
      assetId: 'display',
      assetOptions: ['display', 'vault', 'module'],
      colour: VIOLET,
      importance: 0.7,
    },
  ]
}

function menuConcept({
  id,
  label,
  kind,
  summary,
  evidence,
  metrics,
  assetId,
  assetOptions,
  colour,
  importance = 0.76,
  targetLevelId,
}: {
  id: string
  label: string
  kind: HubConceptKind
  summary: string
  evidence: string[]
  metrics: Array<{ label: string; value: string }>
  assetId: HubAssetId
  assetOptions?: HubAssetId[]
  colour: string
  importance?: number
  targetLevelId?: HubLevelId
}): HubMenuOption {
  return {
    id,
    label,
    kind,
    summary,
    evidence,
    metrics,
    assetId,
    assetOptions: assetOptions ?? [assetId, 'module', 'gateway'],
    colour,
    importance,
    targetLevelId,
  }
}

function conceptOption(
  id: string,
  targetLevelId?: HubLevelId,
  overrides: Partial<HubMenuOption> = {},
): HubMenuOption {
  const concept = conceptById(id)
  return {
    ...concept,
    ...overrides,
    evidence: overrides.evidence ?? concept.evidence,
    metrics: overrides.metrics ?? concept.metrics,
    assetOptions: overrides.assetOptions ?? concept.assetOptions,
    targetLevelId,
  }
}

function buildMenuLevel(
  levelId: HubLevelId,
  context: ArchitectureNavigationContext | null,
  scene: ArchitectureSceneModel,
): HubMenuLevel {
  if (levelId === 'overview') {
    return buildOverviewLevel(scene)
  }

  if (levelId === 'entry-points') {
    return buildEntryPointsLevel(scene)
  }

  if (levelId === 'state') {
    return buildStateLevel(scene)
  }

  if (levelId === 'flows') {
    return {
      id: 'flows',
      title: 'Flows',
      summary:
        'How work moves through the system from human intent to background work, generated facts, and reviewable output.',
      options: [
        conceptOption('human-intent'),
        conceptOption('surface-action', 'interfaces'),
        conceptOption('daemon-work'),
        conceptOption('devql-read-model', 'data'),
        conceptOption('capability-output', 'quality'),
        conceptOption('human-review', 'freshness'),
      ],
    }
  }

  if (levelId === 'change') {
    return {
      id: 'change',
      title: 'Change',
      summary:
        'Task-planning views that help a developer find where to edit, what contracts matter, and what else may be affected.',
      options: [
        menuConcept({
          id: 'change-entry-points',
          label: 'Entry points',
          kind: 'capability',
          summary:
            'Commands, pages, API fields, background jobs, and adapters where behaviour starts.',
          evidence: [
            'architecture.entryPoints',
            'cli commands',
            'GraphQL fields',
          ],
          metrics: [{ label: 'Task', value: 'start a change' }],
          assetId: 'gateway',
          colour: CYAN,
          importance: 0.95,
        }),
        menuConcept({
          id: 'change-edit-map',
          label: 'Likely edit map',
          kind: 'capability',
          summary:
            'Modules and files most likely to need edits for a requested product or engineering task.',
          evidence: [
            'component ownership',
            'symbol references',
            'recent changes',
          ],
          metrics: [{ label: 'Task', value: 'plan files' }],
          assetId: 'scanner',
          colour: AMBER,
          importance: 0.92,
        }),
        menuConcept({
          id: 'change-impact-radius',
          label: 'Impact radius',
          kind: 'capability',
          summary:
            'Callers, callees, contracts, schemas, and generated views that could be affected by the edit.',
          evidence: ['dependency edges', 'contracts', 'stale primitives'],
          metrics: [{ label: 'Task', value: 'avoid regressions' }],
          assetId: 'scanner',
          assetOptions: ['scanner', 'observatory', 'gateway'],
          colour: RED,
          importance: 0.9,
        }),
        menuConcept({
          id: 'change-contracts',
          label: 'Contracts to preserve',
          kind: 'knowledge',
          summary:
            'Public APIs, CLI behaviour, persisted data, and protocol boundaries that should not be broken accidentally.',
          evidence: ['schemas', 'protocol crates', 'fixtures'],
          metrics: [{ label: 'Task', value: 'preserve behaviour' }],
          assetId: 'vault',
          colour: VIOLET,
          importance: 0.86,
        }),
        menuConcept({
          id: 'change-verification',
          label: 'Verification path',
          kind: 'capability',
          summary:
            'The smallest useful test, lint, build, or smoke path for proving the change works.',
          evidence: ['test harness', 'package scripts', 'e2e specs'],
          metrics: [{ label: 'Task', value: 'validate safely' }],
          assetId: 'workshop',
          colour: MINT,
          targetLevelId: 'quality',
          importance: 0.88,
        }),
      ],
    }
  }

  if (levelId === 'data') {
    return {
      id: 'data',
      title: 'Data',
      summary:
        'State, read models, signatures, materialised artefacts, and schemas that explain what the system remembers.',
      options: [
        conceptOption('relational-store'),
        conceptOption('graphql-api', 'interfaces'),
        conceptOption('schema-modules'),
        conceptOption('checkpoints'),
        conceptOption('task-records'),
        conceptOption('navigation-views', 'freshness'),
        conceptOption('materialised-refs', 'freshness'),
      ],
    }
  }

  if (levelId === 'interfaces') {
    return {
      id: 'interfaces',
      title: 'Interfaces',
      summary:
        'Human and machine boundaries: CLI, dashboard, IDE, GraphQL, agent adapters, and protocol surfaces.',
      options: [
        conceptOption('cli'),
        conceptOption('dashboard'),
        conceptOption('graphql-api', 'data'),
        conceptOption('vscode-extension'),
        conceptOption('agent-integrations'),
        conceptOption('inference-protocol'),
      ],
    }
  }

  if (levelId === 'quality') {
    return {
      id: 'quality',
      title: 'Quality',
      summary:
        'Risk, verification, and confidence signals that help a developer decide how carefully to change and test an area.',
      options: [
        conceptOption('test-harness'),
        menuConcept({
          id: 'quality-hotspots',
          label: 'Risk hotspots',
          kind: 'capability',
          summary:
            'Areas with high churn, fan-in, complexity, stale context, or weak verification evidence.',
          evidence: ['git churn', 'dependency graph', 'test coverage'],
          metrics: [{ label: 'Task', value: 'prioritise caution' }],
          assetId: 'scanner',
          colour: RED,
          importance: 0.94,
        }),
        menuConcept({
          id: 'quality-test-map',
          label: 'Test map',
          kind: 'capability',
          summary:
            'Relevant unit, integration, e2e, and smoke tests for the selected system area.',
          evidence: ['test discovery', 'package scripts', 'nextest lanes'],
          metrics: [{ label: 'Task', value: 'choose tests' }],
          assetId: 'workshop',
          colour: MINT,
          importance: 0.9,
        }),
        menuConcept({
          id: 'quality-contract-fixtures',
          label: 'Fixtures and contracts',
          kind: 'knowledge',
          summary:
            'Golden files, schema snapshots, protocol fixtures, and compatibility checks.',
          evidence: ['fixtures', 'schemas', 'snapshots'],
          metrics: [{ label: 'Task', value: 'protect outputs' }],
          assetId: 'vault',
          colour: VIOLET,
          importance: 0.82,
        }),
        conceptOption('architecture-graph', 'freshness'),
      ],
    }
  }

  if (levelId === 'freshness') {
    return {
      id: 'freshness',
      title: 'Freshness',
      summary:
        'Whether the generated understanding is current enough to trust, and which changed primitives deserve inspection.',
      options: reviewConcepts(context),
    }
  }

  return buildTopLevelMenu(scene, context)
}

function layoutMenuScene(
  level: HubMenuLevel,
  activeOptionId: string | null,
): HubSceneModel {
  const options = level.options
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.id === activeOptionId),
  )
  const centre = new THREE.Vector3(9, 0, 0)
  const nodes = options.map((option, index) => {
    const offset = index - activeIndex
    const clampedOffset = Math.max(-3.25, Math.min(3.25, offset))
    const angle = clampedOffset * 0.38
    const distance = Math.abs(offset)
    const x = centre.x + Math.sin(angle) * 21 + Math.sign(offset) * distance
    const z = centre.z - Math.cos(angle) * 8 + distance * 2.8
    return sceneNode(option, new THREE.Vector3(x, 0, z), activeOptionId)
  })

  return {
    nodes,
    paths:
      level.id === 'flows'
        ? options.slice(0, -1).map((option, index) => {
            const next = options[index + 1] ?? option
            return {
              id: `flow:${option.id}:${next.id}`,
              from: option.id,
              to: next.id,
              colour: next.colour,
              label: 'flow',
              active:
                activeOptionId == null ||
                activeOptionId === option.id ||
                activeOptionId === next.id,
            }
          })
        : [],
    centre,
    radius: 32,
    title: level.title,
  }
}

function sceneNode(
  concept: HubMenuOption,
  position: THREE.Vector3,
  selectedId: string | null,
): HubSceneNode {
  const selected = selectedId === concept.id
  return {
    ...concept,
    position,
    selected,
    focus: false,
    dimmed: selectedId != null && !selected,
    canDive: concept.targetLevelId != null,
  }
}

function nodeAssetId(
  node: HubSceneNode,
  assetOverrides: Record<string, HubAssetId>,
) {
  return assetOverrides[node.id] ?? node.assetId
}

function selectedNode(model: HubSceneModel, selectedId: string | null) {
  return (
    model.nodes.find((node) => node.id === selectedId) ?? model.nodes[0] ?? null
  )
}

function LandmarkAsset({
  assetId,
  colour,
  selected,
  dimmed,
}: {
  assetId: HubAssetId
  colour: string
  selected: boolean
  dimmed: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const opacity = dimmed ? 0.45 : 0.94

  useFrame(({ clock }) => {
    if (groupRef.current == null) {
      return
    }

    groupRef.current.rotation.y =
      assetId === 'scanner' || assetId === 'core'
        ? clock.elapsedTime * 0.18
        : groupRef.current.rotation.y
  })

  return (
    <group ref={groupRef}>
      <AssetGeometry
        assetId={assetId}
        colour={colour}
        selected={selected}
        opacity={opacity}
      />
    </group>
  )
}

function AssetGeometry({
  assetId,
  colour,
  selected,
  opacity,
}: {
  assetId: HubAssetId
  colour: string
  selected: boolean
  opacity: number
}) {
  switch (assetId) {
    case 'terminal':
      return (
        <>
          <mesh position={[0, 1.2, 0]} rotation={[-0.22, 0, 0]}>
            <boxGeometry args={[4.8, 0.32, 2.7]} />
            <meshStandardMaterial
              color='#07111F'
              emissive={colour}
              emissiveIntensity={selected ? 0.62 : 0.34}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 2.55, -1.1]} rotation={[-0.18, 0, 0]}>
            <planeGeometry args={[4.1, 2.2]} />
            <meshBasicMaterial
              color={colour}
              transparent
              opacity={0.32}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )
    case 'tower':
      return (
        <>
          <mesh position={[0, 1.6, 0]}>
            <cylinderGeometry args={[1.3, 1.75, 3.2, 8]} />
            <meshStandardMaterial
              color='#061424'
              emissive={colour}
              emissiveIntensity={0.38}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 3.45, 0]}>
            <coneGeometry args={[1.75, 1.6, 8]} />
            <meshBasicMaterial
              color={selected ? '#FFFFFF' : colour}
              transparent
              opacity={0.78}
            />
          </mesh>
          <mesh position={[0, 4.35, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.8, 0.06, 10, 42]} />
            <meshBasicMaterial color={colour} transparent opacity={0.72} />
          </mesh>
        </>
      )
    case 'observatory':
      return (
        <>
          <mesh position={[0, 1.35, 0]}>
            <sphereGeometry
              args={[2.1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial
              color='#07111F'
              emissive={colour}
              emissiveIntensity={0.32}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 1.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.16, 0.08, 12, 64]} />
            <meshBasicMaterial color={colour} transparent opacity={0.82} />
          </mesh>
          <mesh position={[0, 2.7, 0]} rotation={[0.6, 0, 0.4]}>
            <coneGeometry args={[0.38, 4.2, 24]} />
            <meshBasicMaterial color={colour} transparent opacity={0.24} />
          </mesh>
        </>
      )
    case 'workshop':
      return (
        <>
          {[-1.6, 0, 1.6].map((x, index) => (
            <mesh
              key={x}
              position={[x, 1.25 + index * 0.25, index % 2 === 0 ? 0.4 : -0.4]}
            >
              <cylinderGeometry args={[0.82, 1.05, 2.5 + index * 0.55, 6]} />
              <meshStandardMaterial
                color='#081424'
                emissive={colour}
                emissiveIntensity={0.34}
                transparent
                opacity={opacity}
              />
            </mesh>
          ))}
          <mesh position={[0, 2.95, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.55, 0.05, 8, 6]} />
            <meshBasicMaterial color={colour} transparent opacity={0.64} />
          </mesh>
        </>
      )
    case 'vault':
      return (
        <>
          <mesh position={[0, 1.45, 0]}>
            <cylinderGeometry args={[2.05, 2.05, 2.9, 40]} />
            <meshStandardMaterial
              color='#061424'
              emissive={colour}
              emissiveIntensity={0.3}
              transparent
              opacity={opacity}
            />
          </mesh>
          {[0.55, 1.45, 2.35].map((y) => (
            <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[2.07, 0.035, 8, 40]} />
              <meshBasicMaterial color={colour} transparent opacity={0.72} />
            </mesh>
          ))}
        </>
      )
    case 'display':
      return (
        <>
          {[-1.65, 0, 1.65].map((x, index) => (
            <mesh
              key={x}
              position={[x, 2.2, -0.2]}
              rotation={[0, (index - 1) * 0.2, 0]}
            >
              <planeGeometry args={[1.7, 2.7]} />
              <meshBasicMaterial
                color={colour}
                transparent
                opacity={index === 1 ? 0.48 : 0.28}
                side={THREE.DoubleSide}
              />
            </mesh>
          ))}
          <mesh position={[0, 0.7, 0]}>
            <cylinderGeometry args={[2.2, 2.8, 0.42, 8]} />
            <meshStandardMaterial
              color='#07111F'
              emissive={colour}
              emissiveIntensity={0.22}
              transparent
              opacity={opacity}
            />
          </mesh>
        </>
      )
    case 'dock':
      return (
        <>
          <mesh position={[0, 2.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.0, 0.18, 16, 64]} />
            <meshStandardMaterial
              color='#07111F'
              emissive={colour}
              emissiveIntensity={0.5}
              transparent
              opacity={opacity}
            />
          </mesh>
          {[-1.9, 1.9].map((x) => (
            <mesh key={x} position={[x, 1.05, 0]}>
              <cylinderGeometry args={[0.28, 0.42, 2.1, 8]} />
              <meshBasicMaterial color={colour} transparent opacity={0.76} />
            </mesh>
          ))}
        </>
      )
    case 'scanner':
      return (
        <>
          {[1.1, 1.85, 2.6].map((radius, index) => (
            <mesh
              key={radius}
              position={[0, 0.08 + index * 0.04, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <torusGeometry args={[radius, 0.035, 8, 72]} />
              <meshBasicMaterial
                color={colour}
                transparent
                opacity={0.66 - index * 0.12}
              />
            </mesh>
          ))}
          <mesh position={[0, 1.75, 0]}>
            <octahedronGeometry args={[1.25, 0]} />
            <meshStandardMaterial
              color='#081424'
              emissive={colour}
              emissiveIntensity={selected ? 0.7 : 0.44}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 2.85, 0]} rotation={[0, 0, Math.PI / 4]}>
            <coneGeometry args={[0.32, 3.8, 24]} />
            <meshBasicMaterial color={colour} transparent opacity={0.28} />
          </mesh>
        </>
      )
    case 'gateway':
      return (
        <>
          <mesh position={[0, 2.2, 0]} rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[1.75, 0.12, 14, 5]} />
            <meshStandardMaterial
              color='#07111F'
              emissive={colour}
              emissiveIntensity={0.48}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 1.05, 0]}>
            <cylinderGeometry args={[1.7, 2.2, 0.36, 5]} />
            <meshBasicMaterial color={colour} transparent opacity={0.34} />
          </mesh>
        </>
      )
    case 'module':
      return (
        <>
          <mesh position={[0, 1.45, 0]}>
            <dodecahedronGeometry args={[1.85, 0]} />
            <meshStandardMaterial
              color='#07111F'
              emissive={colour}
              emissiveIntensity={selected ? 0.62 : 0.34}
              transparent
              opacity={opacity}
            />
          </mesh>
          <mesh position={[0, 1.45, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[2.0, 0.045, 8, 5]} />
            <meshBasicMaterial color={colour} transparent opacity={0.7} />
          </mesh>
        </>
      )
    case 'core':
    default:
      return (
        <>
          <mesh position={[0, 2.0, 0]}>
            <icosahedronGeometry args={[2.1, 1]} />
            <meshStandardMaterial
              color='#07111F'
              emissive={colour}
              emissiveIntensity={selected ? 0.72 : 0.44}
              transparent
              opacity={opacity}
            />
          </mesh>
          {[2.6, 3.2].map((radius, index) => (
            <mesh
              key={radius}
              position={[0, 2.0, 0]}
              rotation={[Math.PI / 2, index * 0.55, 0]}
            >
              <torusGeometry args={[radius, 0.045, 8, 96]} />
              <meshBasicMaterial
                color={colour}
                transparent
                opacity={0.68 - index * 0.18}
              />
            </mesh>
          ))}
        </>
      )
  }
}

function AssetIcon({ assetId }: { assetId: HubAssetId }) {
  switch (assetId) {
    case 'terminal':
      return <TerminalSquare className='size-5' />
    case 'tower':
      return <RadioTower className='size-5' />
    case 'observatory':
      return <ScanSearch className='size-5' />
    case 'workshop':
      return <Boxes className='size-5' />
    case 'vault':
      return <Database className='size-5' />
    case 'display':
      return <Monitor className='size-5' />
    case 'dock':
      return <Cable className='size-5' />
    case 'scanner':
      return <Radar className='size-5' />
    case 'gateway':
      return <Route className='size-5' />
    case 'module':
      return <Code2 className='size-5' />
    case 'core':
    default:
      return <Network className='size-5' />
  }
}

function domSafeId(value: string) {
  return value.replaceAll(/[^a-zA-Z0-9_-]+/gu, '-')
}

function surfacePresentationForContainer(
  container: ArchitectureContainerNode,
): {
  label: string
  icon: LucideIcon
  colour: string
} {
  const kind = container.kind ?? ''
  const identity = `${container.label} ${container.key ?? ''} ${
    container.path ?? ''
  } ${kind}`.toLowerCase()
  const presentation = containerPresentation(container.kind)

  if (kind === 'cli' || identity.includes('cli')) {
    return { label: 'CLI', icon: TerminalSquare, colour: presentation.colour }
  }

  if (
    kind === 'editor_extension' ||
    identity.includes('vscode') ||
    identity.includes('vs code')
  ) {
    return { label: 'VS Code', icon: Puzzle, colour: presentation.colour }
  }

  if (
    kind === 'documentation_site' ||
    identity.includes('docusaurus') ||
    identity.includes('docs')
  ) {
    return { label: 'Docs', icon: BookOpen, colour: presentation.colour }
  }

  if (
    identity.includes('web') ||
    identity.includes('dashboard') ||
    identity.includes('site')
  ) {
    return { label: 'Web', icon: Globe2, colour: presentation.colour }
  }

  if (kind === 'dev_tool' || identity.includes('tool')) {
    return { label: 'Tool', icon: Boxes, colour: presentation.colour }
  }

  if (
    identity.includes('api') ||
    identity.includes('server') ||
    identity.includes('service')
  ) {
    return { label: 'Service', icon: RadioTower, colour: presentation.colour }
  }

  return { label: 'App', icon: Package2, colour: presentation.colour }
}

function languageBadgeForContainer(
  container: ArchitectureContainerNode,
  components: ArchitectureComponentNode[],
  deploymentUnits: ArchitectureDeploymentUnitNode[],
  entryPoints: ArchitectureEntryPointNode[],
): { label: string; name: string; colour: string } {
  const factText = [
    container.kind,
    container.key,
    container.path,
    ...components.flatMap((component) => [
      component.kind,
      component.path,
      ...component.filePaths,
    ]),
    ...deploymentUnits.flatMap((deploymentUnit) => [
      deploymentUnit.kind,
      deploymentUnit.label,
    ]),
    ...entryPoints.flatMap((entryPoint) => [
      entryPoint.entryKind,
      entryPoint.label,
    ]),
  ]
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()

  if (
    factText.includes('.rs') ||
    factText.includes('cargo') ||
    factText.includes('rust')
  ) {
    return { label: 'RS', name: 'Rust', colour: '#F77A52' }
  }

  if (
    container.kind === 'documentation_site' ||
    factText.includes('.mdx') ||
    factText.includes('.md') ||
    factText.includes('docusaurus')
  ) {
    return { label: 'MDX', name: 'MDX', colour: '#8AF7FF' }
  }

  if (
    factText.includes('.tsx') ||
    factText.includes('.ts') ||
    factText.includes('typescript') ||
    factText.includes('vscode')
  ) {
    return { label: 'TS', name: 'TypeScript', colour: '#52A8FF' }
  }

  if (
    factText.includes('.jsx') ||
    factText.includes('.js') ||
    factText.includes('javascript') ||
    factText.includes('package.json')
  ) {
    return { label: 'JS', name: 'JavaScript', colour: '#F1D36B' }
  }

  if (factText.includes('.py') || factText.includes('python')) {
    return { label: 'PY', name: 'Python', colour: '#7AA2FF' }
  }

  if (factText.includes('.go') || factText.includes('golang')) {
    return { label: 'GO', name: 'Go', colour: '#50FFC2' }
  }

  if (
    factText.includes('.java') ||
    factText.includes('.kt') ||
    factText.includes('jvm')
  ) {
    return { label: 'JVM', name: 'JVM', colour: '#D885FF' }
  }

  return { label: 'CODE', name: 'Code', colour: '#C7F9FF' }
}

function relationshipCountForComponent(component: ArchitectureComponentNode) {
  return (
    component.contractInCount +
    component.contractOutCount +
    component.directInCount +
    component.directOutCount
  )
}

function componentSignalScore(component: ArchitectureComponentNode) {
  return (
    relationshipCountForComponent(component) +
    component.entryPointIds.length * 4 +
    component.deploymentUnitIds.length * 3 +
    component.readCount +
    component.writeCount +
    Math.min(component.filePaths.length, 10) / 10
  )
}

function entryIconForKind(kind: string | null) {
  const value = kind?.toLowerCase() ?? ''
  if (value.includes('cli') || value.includes('command')) {
    return TerminalSquare
  }
  if (
    value.includes('http') ||
    value.includes('route') ||
    value.includes('web')
  ) {
    return Globe2
  }
  return Route
}

function MetricPill({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <span className='rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-cyan-50/82'>
      {label}: <span className='text-cyan-50'>{value}</span>
    </span>
  )
}

function ContainerBoardSection({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: LucideIcon
  children: ReactNode
}) {
  return (
    <section className='min-h-0 rounded-2xl border border-white/12 bg-slate-950/64 p-4 shadow-2xl shadow-slate-950/30 backdrop-blur'>
      <div className='mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-50'>
        <span className='flex size-8 items-center justify-center rounded-full border border-cyan-200/20 bg-cyan-300/10 text-cyan-200'>
          <Icon className='size-4' />
        </span>
        {title}
      </div>
      {children}
    </section>
  )
}

function EmptyBoardState({ children }: { children: ReactNode }) {
  return (
    <div className='rounded-xl border border-dashed border-white/14 bg-white/5 px-3 py-4 text-sm leading-6 text-cyan-50/62'>
      {children}
    </div>
  )
}

function ContainerOverviewExperience({
  scene,
  selectedContainerId,
  onSelectContainer,
}: {
  scene: ArchitectureSceneModel
  selectedContainerId: string | null
  onSelectContainer: (containerId: string) => void
}) {
  const containers = scene.containers
  const selectedContainer =
    containers.find((container) => container.id === selectedContainerId) ??
    containers[0] ??
    null

  if (selectedContainer == null) {
    return (
      <div className='pointer-events-auto absolute inset-0 z-[5] pl-[27rem] pr-5 pt-5 text-cyan-50'>
        <div className='flex h-full items-center justify-center rounded-2xl border border-white/12 bg-slate-950/64 p-8 text-center shadow-2xl backdrop-blur'>
          <div>
            <Network className='mx-auto size-10 text-cyan-200' />
            <h3 className='mt-4 text-lg font-semibold'>
              No containers discovered
            </h3>
            <p className='mt-2 max-w-lg text-sm leading-6 text-cyan-50/68'>
              The architecture producer has not emitted container facts for this
              repository yet.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const selectedComponents = scene.components.filter(
    (component) => component.containerId === selectedContainer.id,
  )
  const selectedEntryPoints = scene.entryPoints.filter(
    (entryPoint) => entryPoint.containerId === selectedContainer.id,
  )
  const selectedDeploymentUnits = scene.deploymentUnits.filter(
    (deploymentUnit) => deploymentUnit.containerId === selectedContainer.id,
  )
  const componentIds = new Set(
    selectedComponents.map((component) => component.id),
  )
  const persistenceObjectIds = new Set(
    scene.dataConnections
      .filter((connection) => componentIds.has(connection.componentId))
      .map((connection) => connection.persistenceObjectId),
  )
  const selectedPersistenceObjects = scene.persistenceObjects.filter((object) =>
    persistenceObjectIds.has(object.id),
  )
  const componentsById = new Map(
    selectedComponents.map((component) => [component.id, component]),
  )
  const relationshipCount = selectedComponents.reduce(
    (count, component) => count + relationshipCountForComponent(component),
    0,
  )
  const primaryComponents = [...selectedComponents]
    .sort(
      (left, right) => componentSignalScore(right) - componentSignalScore(left),
    )
    .slice(0, 8)
  const surface = surfacePresentationForContainer(selectedContainer)
  const SurfaceIcon = surface.icon
  const language = languageBadgeForContainer(
    selectedContainer,
    selectedComponents,
    selectedDeploymentUnits,
    selectedEntryPoints,
  )

  return (
    <div className='pointer-events-auto absolute inset-0 z-[5] pl-[27rem] pr-5 pt-5 pb-5 text-cyan-50'>
      <div className='flex h-full min-h-0 flex-col gap-4'>
        <div
          className='mr-12 flex min-h-[5.75rem] items-stretch gap-3 overflow-x-auto rounded-2xl border border-white/12 bg-slate-950/62 p-3 shadow-2xl backdrop-blur'
          data-testid='architecture-container-carousel'
        >
          {containers.map((container) => {
            const active = container.id === selectedContainer.id
            const containerComponents = scene.components.filter(
              (component) => component.containerId === container.id,
            )
            const containerEntryPoints = scene.entryPoints.filter(
              (entryPoint) => entryPoint.containerId === container.id,
            )
            const containerDeploymentUnits = scene.deploymentUnits.filter(
              (deploymentUnit) => deploymentUnit.containerId === container.id,
            )
            const itemSurface = surfacePresentationForContainer(container)
            const ItemSurfaceIcon = itemSurface.icon
            const itemLanguage = languageBadgeForContainer(
              container,
              containerComponents,
              containerDeploymentUnits,
              containerEntryPoints,
            )

            return (
              <button
                key={container.id}
                type='button'
                aria-current={active ? 'true' : undefined}
                data-testid={`architecture-container-carousel-item-${domSafeId(
                  container.id,
                )}`}
                className={cn(
                  'group flex min-w-[15.5rem] items-center gap-3 rounded-xl border px-3 py-2 text-left transition',
                  active
                    ? 'border-cyan-100/80 bg-cyan-300 text-slate-950 shadow-[0_16px_42px_-30px_rgba(82,246,255,0.95)]'
                    : 'border-white/12 bg-white/7 text-cyan-50 hover:border-cyan-200/55 hover:bg-cyan-950/62',
                )}
                onClick={() => onSelectContainer(container.id)}
                onMouseEnter={() => onSelectContainer(container.id)}
              >
                <span
                  className={cn(
                    'flex size-11 shrink-0 flex-col items-center justify-center rounded-xl border text-[0.68rem] font-black leading-none',
                    active
                      ? 'border-slate-950/20 bg-slate-950/10'
                      : 'border-white/14 bg-slate-950/70',
                  )}
                  style={{ color: active ? undefined : itemLanguage.colour }}
                  title={itemLanguage.name}
                >
                  <FileCode2 className='mb-0.5 size-3.5' />
                  {itemLanguage.label}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block truncate text-sm font-semibold'>
                    {container.label}
                  </span>
                  <span
                    className={cn(
                      'mt-1 flex items-center gap-1.5 text-xs',
                      active ? 'text-slate-950/70' : 'text-cyan-50/62',
                    )}
                  >
                    <ItemSurfaceIcon className='size-3.5 shrink-0' />
                    <span>{itemSurface.label}</span>
                    <span aria-hidden='true'>/</span>
                    <span>{formatContainerKind(container.kind)}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>

        <div
          className='relative min-h-0 flex-1 overflow-hidden rounded-[1.25rem] border border-cyan-300/18 bg-[radial-gradient(circle_at_20%_10%,rgba(82,246,255,0.14),transparent_26%),linear-gradient(135deg,rgba(5,13,25,0.96),rgba(2,6,13,0.98))] shadow-[0_24px_80px_-48px_rgba(82,246,255,0.7)]'
          data-testid='architecture-container-board'
        >
          <div className='pointer-events-none absolute inset-0 opacity-70 [background-image:linear-gradient(rgba(82,246,255,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(82,246,255,0.06)_1px,transparent_1px)] [background-size:34px_34px]' />
          <div className='relative h-full overflow-auto p-5'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
              <div className='min-w-0'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge
                    variant='outline'
                    className='border-white/15 bg-white/8 text-cyan-50'
                  >
                    <SurfaceIcon className='mr-1.5 size-3.5' />
                    {surface.label}
                  </Badge>
                  <Badge
                    variant='outline'
                    className='border-white/15 bg-white/8 text-cyan-50'
                  >
                    <FileCode2 className='mr-1.5 size-3.5' />
                    {language.name}
                  </Badge>
                </div>
                <h3 className='mt-3 truncate text-2xl font-semibold tracking-normal text-cyan-50'>
                  {selectedContainer.label}
                </h3>
                <p className='mt-2 max-w-3xl text-sm leading-6 text-cyan-50/70'>
                  {formatContainerKind(selectedContainer.kind)} at{' '}
                  {selectedContainer.path ??
                    selectedContainer.key ??
                    'unknown path'}
                  . Its entry points, main components, deployable outputs, and
                  touched state are shown together.
                </p>
              </div>
              <div className='flex max-w-xl flex-wrap justify-end gap-2'>
                <MetricPill
                  label='Components'
                  value={selectedComponents.length}
                />
                <MetricPill
                  label='Entry points'
                  value={selectedEntryPoints.length}
                />
                <MetricPill
                  label='Deployables'
                  value={selectedDeploymentUnits.length}
                />
                <MetricPill label='Relations' value={relationshipCount} />
              </div>
            </div>

            <div className='mt-5 grid gap-4 xl:grid-cols-[minmax(14rem,0.9fr)_minmax(22rem,1.45fr)_minmax(15rem,0.95fr)]'>
              <ContainerBoardSection title='Entry points' icon={TerminalSquare}>
                {selectedEntryPoints.length > 0 ? (
                  <div className='space-y-2'>
                    {selectedEntryPoints.map((entryPoint) => {
                      const EntryIcon = entryIconForKind(entryPoint.entryKind)
                      const owner =
                        entryPoint.componentId == null
                          ? null
                          : componentsById.get(entryPoint.componentId)
                      return (
                        <div
                          key={entryPoint.id}
                          data-testid={`architecture-container-entry-point-${domSafeId(
                            entryPoint.id,
                          )}`}
                          className='rounded-xl border border-cyan-200/14 bg-cyan-300/8 p-3'
                        >
                          <div className='flex items-start gap-3'>
                            <span className='mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-cyan-200/20 bg-slate-950/70 text-cyan-200'>
                              <EntryIcon className='size-4' />
                            </span>
                            <div className='min-w-0'>
                              <div className='truncate text-sm font-semibold text-cyan-50'>
                                {entryPoint.label}
                              </div>
                              <div className='mt-1 text-xs leading-5 text-cyan-50/62'>
                                {entryPoint.entryKind ?? 'entry point'}
                                {owner == null ? null : ` -> ${owner.label}`}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyBoardState>No entry points discovered.</EmptyBoardState>
                )}
              </ContainerBoardSection>

              <ContainerBoardSection title='Components' icon={Layers3}>
                {primaryComponents.length > 0 ? (
                  <div className='space-y-2'>
                    {primaryComponents.map((component) => {
                      const score = componentSignalScore(component)
                      const relationships =
                        relationshipCountForComponent(component)
                      const barWidth = Math.max(12, Math.min(100, score * 12))
                      return (
                        <div
                          key={component.id}
                          data-testid={`architecture-container-component-${domSafeId(
                            component.id,
                          )}`}
                          className='rounded-xl border border-white/12 bg-white/7 p-3'
                        >
                          <div className='flex flex-wrap items-start justify-between gap-2'>
                            <div className='min-w-0'>
                              <div className='truncate text-sm font-semibold text-cyan-50'>
                                {component.label}
                              </div>
                              <div className='mt-1 truncate text-xs text-cyan-50/58'>
                                {component.path ??
                                  component.kind ??
                                  'component'}
                              </div>
                            </div>
                            <div className='flex flex-wrap justify-end gap-1.5'>
                              {component.entryPointIds.length > 0 && (
                                <Badge className='bg-cyan-300/16 text-cyan-50 hover:bg-cyan-300/16'>
                                  entry {component.entryPointIds.length}
                                </Badge>
                              )}
                              {component.deploymentUnitIds.length > 0 && (
                                <Badge className='bg-amber-300/18 text-amber-50 hover:bg-amber-300/18'>
                                  deploy {component.deploymentUnitIds.length}
                                </Badge>
                              )}
                              {relationships > 0 && (
                                <Badge className='bg-white/10 text-cyan-50 hover:bg-white/10'>
                                  links {relationships}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className='mt-3 h-1.5 rounded-full bg-white/8'>
                            <div
                              className='h-full rounded-full bg-cyan-300'
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: component.colour,
                              }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <EmptyBoardState>No components discovered.</EmptyBoardState>
                )}
              </ContainerBoardSection>

              <div className='space-y-4'>
                <ContainerBoardSection title='Deployables' icon={Package2}>
                  {selectedDeploymentUnits.length > 0 ? (
                    <div className='space-y-2'>
                      {selectedDeploymentUnits.map((deploymentUnit) => {
                        const owner =
                          deploymentUnit.componentId == null
                            ? null
                            : componentsById.get(deploymentUnit.componentId)
                        return (
                          <div
                            key={deploymentUnit.id}
                            data-testid={`architecture-container-deployment-${domSafeId(
                              deploymentUnit.id,
                            )}`}
                            className='rounded-xl border border-amber-200/16 bg-amber-300/8 p-3'
                          >
                            <div className='text-sm font-semibold text-cyan-50'>
                              {deploymentUnit.label}
                            </div>
                            <div className='mt-1 text-xs leading-5 text-cyan-50/62'>
                              {deploymentUnit.kind ?? 'deployable'}
                              {owner == null ? null : ` -> ${owner.label}`}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <EmptyBoardState>
                      No deployables discovered.
                    </EmptyBoardState>
                  )}
                </ContainerBoardSection>

                <ContainerBoardSection title='State touched' icon={Database}>
                  {selectedPersistenceObjects.length > 0 ? (
                    <div className='space-y-2'>
                      {selectedPersistenceObjects.map((object) => (
                        <div
                          key={object.id}
                          className='rounded-xl border border-violet-200/16 bg-violet-300/8 p-3'
                        >
                          <div className='text-sm font-semibold text-cyan-50'>
                            {object.label}
                          </div>
                          <div className='mt-1 text-xs leading-5 text-cyan-50/62'>
                            {object.path ?? 'persistence object'}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyBoardState>
                      No state facts discovered.
                    </EmptyBoardState>
                  )}
                </ContainerBoardSection>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConceptLandmark({
  node,
  assetId,
  onSelect,
  onDive,
}: {
  node: HubSceneNode
  assetId: HubAssetId
  onSelect: (id: string) => void
  onDive: (id: string) => void
}) {
  const scale = node.focus ? 1.22 : 0.9 + node.importance * 0.22
  const labelOpacity = node.dimmed ? 0.5 : 1
  const padRadius = node.focus ? 4.8 : 3.2 + node.importance

  return (
    <group
      position={[node.position.x, 0, node.position.z]}
      scale={scale}
      onClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        onSelect(node.id)
      }}
      onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
        event.stopPropagation()
        if (node.canDive) {
          onDive(node.id)
        }
      }}
    >
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[padRadius, 56]} />
        <meshBasicMaterial
          color={node.selected ? node.colour : '#0B2036'}
          transparent
          opacity={node.selected ? 0.38 : node.focus ? 0.2 : 0.12}
          depthWrite={false}
        />
      </mesh>
      {node.selected && (
        <mesh position={[0, 2.2, 0]}>
          <cylinderGeometry args={[2.7, 2.7, 5.6, 48, 1, true]} />
          <meshBasicMaterial
            color={node.colour}
            transparent
            opacity={0.11}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      <LandmarkAsset
        assetId={assetId}
        colour={node.colour}
        selected={node.selected}
        dimmed={node.dimmed}
      />
      <Html
        center
        distanceFactor={12}
        position={[0, 5.6, 0]}
        className='pointer-events-none'
      >
        <div
          className={cn(
            'flex items-center gap-2 rounded-full border border-white/15 bg-slate-950/75 px-3 py-1.5 text-xs font-medium text-cyan-50 shadow-xl backdrop-blur',
            node.selected && 'border-cyan-200/70 bg-cyan-950/80',
          )}
          style={{ opacity: labelOpacity }}
        >
          <span style={{ color: node.colour }}>
            <AssetIcon assetId={assetId} />
          </span>
          <span className='max-w-[10rem] truncate'>
            {node.shortLabel ?? node.label}
          </span>
        </div>
      </Html>
    </group>
  )
}

function GroundPath({
  path,
  nodesById,
}: {
  path: HubScenePath
  nodesById: Map<string, HubSceneNode>
}) {
  const from = nodesById.get(path.from)
  const to = nodesById.get(path.to)
  if (from == null || to == null) {
    return null
  }

  const bend = (from.position.x < to.position.x ? 1 : -1) * 2.5
  const mid = new THREE.Vector3(
    (from.position.x + to.position.x) / 2,
    0.08,
    (from.position.z + to.position.z) / 2 + bend,
  )

  return (
    <QuadraticBezierLine
      start={[from.position.x, 0.08, from.position.z]}
      mid={[mid.x, mid.y, mid.z]}
      end={[to.position.x, 0.08, to.position.z]}
      color={path.colour}
      lineWidth={path.active ? 4.2 : 1.8}
      transparent
      opacity={path.active ? 0.72 : 0.18}
    />
  )
}

function HubSceneContents({
  model,
  assetOverrides,
  onSelect,
  onDive,
}: {
  model: HubSceneModel
  assetOverrides: Record<string, HubAssetId>
  onSelect: (id: string) => void
  onDive: (id: string) => void
}) {
  const nodesById = useMemo(
    () => new Map(model.nodes.map((node) => [node.id, node])),
    [model.nodes],
  )

  return (
    <>
      <ambientLight intensity={0.44} />
      <hemisphereLight intensity={0.42} color='#D5FCFF' groundColor='#06101D' />
      <directionalLight position={[70, 95, 50]} intensity={0.92} castShadow />
      <directionalLight
        position={[-60, 35, -80]}
        intensity={0.42}
        color={CYAN}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[model.centre.x, -0.08, model.centre.z]}
        receiveShadow
      >
        <planeGeometry args={[model.radius * 2.45, model.radius * 1.9]} />
        <meshStandardMaterial
          color='#050C16'
          emissive='#02050A'
          emissiveIntensity={0.48}
          roughness={0.98}
        />
      </mesh>
      <gridHelper
        args={[model.radius * 2.35, 40, '#1CF4FF', '#123D59']}
        position={[model.centre.x, 0.02, model.centre.z]}
      />
      {model.paths.map((scenePath) => (
        <GroundPath key={scenePath.id} path={scenePath} nodesById={nodesById} />
      ))}
      {model.nodes.map((node) => (
        <ConceptLandmark
          key={node.id}
          node={node}
          assetId={nodeAssetId(node, assetOverrides)}
          onSelect={onSelect}
          onDive={onDive}
        />
      ))}
    </>
  )
}

function HubCameraRig({ model }: { model: HubSceneModel }) {
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const { camera, gl } = useThree()
  const longestSide = Math.max(40, model.radius * 2)

  useEffect(() => {
    gl.setClearColor(BACKGROUND)
  }, [gl])

  useEffect(() => {
    camera.position.set(
      model.centre.x + longestSide * 0.42,
      Math.max(28, longestSide * 0.48),
      model.centre.z + longestSide * 0.64,
    )
    camera.lookAt(model.centre.x, 2.2, model.centre.z)
    // Three.js camera instances are mutable external objects; keep projection in sync with the hub bounds.
    // eslint-disable-next-line react-hooks/immutability
    camera.far = Math.max(550, longestSide * 8)
    camera.updateProjectionMatrix()

    if (controlsRef.current != null) {
      controlsRef.current.target.set(model.centre.x, 2.2, model.centre.z)
      controlsRef.current.update()
    }
  }, [camera, longestSide, model.centre])

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      minDistance={8}
      maxDistance={Math.max(120, longestSide * 2.2)}
      maxPolarAngle={Math.PI / 2.08}
    />
  )
}

function FullscreenButton({
  active,
  onClick,
}: {
  active: boolean
  onClick: () => void
}) {
  const label = active ? 'Exit full screen' : 'Enter full screen'

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant='outline'
          aria-label={label}
          data-testid='architecture-system-hub-fullscreen'
          className={cn(
            'size-9 rounded-full border-white/15 bg-slate-950/70 text-cyan-50 shadow-xl backdrop-blur hover:bg-cyan-950/70',
            active &&
              'border-cyan-200/70 bg-cyan-400 text-slate-950 hover:bg-cyan-300',
          )}
          onClick={onClick}
        >
          {active ? (
            <Minimize2 className='size-4' />
          ) : (
            <Maximize2 className='size-4' />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

function AssetChoiceButton({
  assetId,
  active,
  onClick,
}: {
  assetId: HubAssetId
  active: boolean
  onClick: () => void
}) {
  return (
    <Button
      type='button'
      size='sm'
      variant='outline'
      aria-pressed={active}
      className={cn(
        'h-8 rounded-full border-white/15 bg-white/8 px-2 text-[0.68rem] text-cyan-50 hover:bg-white/15',
        active &&
          'border-amber-200/80 bg-amber-300 text-slate-950 hover:bg-amber-200',
      )}
      onClick={onClick}
    >
      <AssetIcon assetId={assetId} />
      {assetLabels[assetId]}
    </Button>
  )
}

function HubStaticScene({
  model,
  assetOverrides,
  onSelect,
  onDive,
}: {
  model: HubSceneModel
  assetOverrides: Record<string, HubAssetId>
  onSelect: (id: string) => void
  onDive: (id: string) => void
}) {
  const scaleX = model.radius * 2.2
  const scaleZ = model.radius * 1.8

  return (
    <div
      aria-label={`${model.title} static constellation`}
      className='absolute inset-0 overflow-hidden'
      data-testid='architecture-system-hub-static'
    >
      <div className='absolute inset-x-[10%] top-[22%] h-[52%] rounded-[999px] border border-cyan-200/12 bg-cyan-400/5 shadow-[inset_0_0_70px_rgba(82,246,255,0.08)]' />
      <div className='absolute bottom-44 right-5 rounded-full border border-amber-200/45 bg-slate-950/72 px-3 py-1.5 text-xs text-amber-50 shadow-xl backdrop-blur'>
        WebGL unavailable: interactive static view
      </div>
      {model.nodes.map((node) => {
        const assetId = nodeAssetId(node, assetOverrides)
        const left = Math.max(
          42,
          Math.min(90, 64 + ((node.position.x - model.centre.x) / scaleX) * 56),
        )
        const top = Math.max(
          24,
          Math.min(70, 48 + ((node.position.z - model.centre.z) / scaleZ) * 54),
        )

        return (
          <button
            key={node.id}
            type='button'
            data-testid={`architecture-hub-scene-node-${node.id}`}
            className={cn(
              'pointer-events-auto absolute flex min-h-16 w-[11.5rem] -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-1 rounded-2xl border bg-slate-950/78 p-3 text-left text-cyan-50 shadow-2xl backdrop-blur transition hover:scale-[1.02] hover:bg-cyan-950/82',
              node.selected
                ? 'border-cyan-200/80 ring-2 ring-cyan-200/35'
                : 'border-white/12',
              node.dimmed && 'opacity-55',
            )}
            style={{
              left: `${left}%`,
              top: `${top}%`,
              boxShadow: `0 18px 45px -32px ${node.colour}`,
            }}
            onClick={() => onSelect(node.id)}
            onDoubleClick={() => {
              if (node.canDive) {
                onDive(node.id)
              }
            }}
          >
            <span className='flex w-full items-center gap-2 text-xs font-semibold'>
              <span
                className='flex size-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/8'
                style={{ color: node.colour }}
              >
                <AssetIcon assetId={assetId} />
              </span>
              <span className='min-w-0 flex-1 truncate'>
                {node.shortLabel ?? node.label}
              </span>
            </span>
            <span className='line-clamp-2 text-xs leading-5 text-cyan-50/68'>
              {node.summary}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function HubHud({
  level,
  breadcrumb,
  selected,
  activeMenuOptionId,
  selectedAsset,
  context,
  fullscreenActive,
  onOptionFocus,
  onOptionEnter,
  onBack,
  onAssetChange,
  onFullscreenToggle,
}: {
  level: HubMenuLevel
  breadcrumb: string[]
  selected: HubSceneNode | null
  activeMenuOptionId: string | null
  selectedAsset: HubAssetId | null
  context: ArchitectureNavigationContext | null
  fullscreenActive: boolean
  onOptionFocus: (id: string) => void
  onOptionEnter: (id: string) => void
  onBack: () => void
  onAssetChange: (assetId: HubAssetId) => void
  onFullscreenToggle: () => void
}) {
  return (
    <>
      <div className='pointer-events-auto absolute left-5 top-5 z-10 w-[min(25rem,calc(100%-2rem))] text-cyan-50'>
        <div className='rounded-2xl border border-white/12 bg-slate-950/74 px-4 py-3 shadow-2xl backdrop-blur'>
          <div className='flex flex-wrap items-center gap-2 text-xs text-cyan-100/80'>
            <Sparkles className='size-4 text-cyan-300' />
            <span>{breadcrumb.join(' / ')}</span>
            {breadcrumb.length > 1 && level.id !== 'root' && (
              <Button
                type='button'
                size='sm'
                variant='outline'
                className='h-7 rounded-full border-white/15 bg-white/8 px-2 text-xs text-cyan-50 hover:bg-white/15'
                onClick={onBack}
              >
                <ChevronLeft className='size-4' />
                Up
              </Button>
            )}
          </div>
          <h2 className='mt-2 text-xl font-semibold tracking-normal'>
            {level.title}
          </h2>
          <p className='mt-1 text-sm leading-6 text-cyan-50/78'>
            {level.summary}
          </p>
        </div>

        <div className='mt-4 space-y-2'>
          {level.options.map((option, index) => {
            const active = activeMenuOptionId === option.id
            return (
              <button
                key={option.id}
                type='button'
                aria-current={active ? 'true' : undefined}
                data-testid={`architecture-hub-menu-option-${option.id}`}
                className={cn(
                  'group flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left shadow-xl backdrop-blur transition',
                  active
                    ? 'border-cyan-200/80 bg-cyan-300 text-slate-950'
                    : 'border-white/12 bg-slate-950/68 text-cyan-50 hover:border-cyan-200/45 hover:bg-cyan-950/75',
                )}
                onMouseEnter={() => onOptionFocus(option.id)}
                onFocus={() => onOptionFocus(option.id)}
                onClick={() => onOptionEnter(option.id)}
              >
                <span
                  className={cn(
                    'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold',
                    active
                      ? 'border-slate-950/15 bg-slate-950/10'
                      : 'border-white/15 bg-white/8',
                  )}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='flex items-center justify-between gap-3 text-sm font-semibold'>
                    <span className='truncate'>{option.label}</span>
                  </span>
                  <span
                    className={cn(
                      'mt-1 line-clamp-2 text-xs leading-5',
                      active ? 'text-slate-950/72' : 'text-cyan-50/66',
                    )}
                  >
                    {option.summary}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className='pointer-events-auto absolute right-5 top-5 z-10 flex flex-wrap justify-end gap-2'>
        <FullscreenButton
          active={fullscreenActive}
          onClick={onFullscreenToggle}
        />
      </div>

      {selected != null && (
        <div className='pointer-events-auto absolute bottom-5 right-5 z-10 max-w-[min(42rem,calc(100%-2rem))] rounded-2xl border border-white/12 bg-slate-950/78 p-4 text-cyan-50 shadow-2xl backdrop-blur'>
          <div className='mb-3'>
            <div className='text-xs font-medium uppercase text-cyan-100/65'>
              Focus
            </div>
            <h3 className='mt-1 text-lg font-semibold'>{selected.label}</h3>
          </div>
          <div className='flex flex-wrap items-center gap-2'>
            <Badge
              variant='outline'
              className='border-white/15 bg-white/8 text-cyan-50'
            >
              {selected.kind}
            </Badge>
            {selected.metrics.map((metric) => (
              <Badge
                key={`${selected.id}:${metric.label}`}
                variant='outline'
                className='border-white/15 bg-white/8 text-cyan-50'
              >
                {metric.label}: {metric.value}
              </Badge>
            ))}
            {context != null && (
              <Badge
                variant='outline'
                className='border-amber-200/60 bg-amber-300/20 text-amber-50'
              >
                {context.changeCount} review changes
              </Badge>
            )}
          </div>
          <div className='mt-3 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end'>
            <div className='space-y-2'>
              <div className='text-xs font-medium uppercase text-cyan-100/65'>
                Evidence
              </div>
              <div className='flex flex-wrap gap-2'>
                {selected.evidence.map((item) => (
                  <span
                    key={`${selected.id}:${item}`}
                    className='rounded-full border border-white/12 bg-white/8 px-3 py-1 text-xs text-cyan-50/82'
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>
            {selectedAsset != null && (
              <div className='space-y-2'>
                <div className='text-xs font-medium uppercase text-cyan-100/65'>
                  Visual
                </div>
                <div className='flex flex-wrap gap-2'>
                  {selected.assetOptions.map((assetId) => (
                    <AssetChoiceButton
                      key={`${selected.id}:${assetId}`}
                      assetId={assetId}
                      active={selectedAsset === assetId}
                      onClick={() => onAssetChange(assetId)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export function ArchitectureSystemHub({ scene }: ArchitectureSystemHubProps) {
  const [activeOptionByLevel, setActiveOptionByLevel] = useState<
    Partial<Record<HubLevelId, string>>
  >({})
  const [assetOverrides, setAssetOverrides] = useState<
    Record<string, HubAssetId>
  >({})
  const [selectedContainerId, setSelectedContainerId] = useState<string | null>(
    null,
  )
  const [fullscreenActive, setFullscreenActive] = useState(false)
  const hubRef = useRef<HTMLDivElement>(null)
  const webglSupported = useMemo(() => supportsWebGL(), [])
  const context = scene.navigationContext ?? null
  const level = useMemo(
    () => buildTopLevelMenu(scene, context),
    [context, scene],
  )
  const activeMenuOptionId =
    activeOptionByLevel.root ?? level.options[0]?.id ?? null
  const activeMenuOption =
    level.options.find((option) => option.id === activeMenuOptionId) ??
    level.options[0] ??
    null
  const sceneLevelId = activeMenuOption?.targetLevelId ?? 'overview'
  const overviewActive = sceneLevelId === 'overview'
  const selectedContainer =
    scene.containers.find(
      (container) => container.id === selectedContainerId,
    ) ??
    scene.containers[0] ??
    null
  const resolvedSelectedContainerId = selectedContainer?.id ?? null
  const sceneLevel = useMemo(
    () => buildMenuLevel(sceneLevelId, context, scene),
    [context, scene, sceneLevelId],
  )
  const activeSceneOptionId =
    activeOptionByLevel[sceneLevelId] ?? sceneLevel.options[0]?.id ?? null
  const model = useMemo(
    () => layoutMenuScene(sceneLevel, activeSceneOptionId),
    [activeSceneOptionId, sceneLevel],
  )
  const selected = selectedNode(model, activeSceneOptionId)
  const selectedAsset =
    selected == null ? null : nodeAssetId(selected, assetOverrides)
  const breadcrumb = ['Architecture', sceneLevel.title]

  useEffect(() => {
    hubRef.current?.focus()
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    function handleFullscreenChange() {
      setFullscreenActive(document.fullscreenElement === hubRef.current)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  useEffect(() => {
    if (!fullscreenActive || typeof document === 'undefined') {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && document.fullscreenElement == null) {
        setFullscreenActive(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [fullscreenActive])

  function focusOption(id: string) {
    setActiveOptionByLevel((current) => ({
      ...current,
      root: id,
    }))
  }

  function focusSceneOption(id: string) {
    setActiveOptionByLevel((current) => ({
      ...current,
      [sceneLevelId]: id,
    }))
  }

  function moveFocus(delta: number) {
    const activeIndex = Math.max(
      0,
      level.options.findIndex((option) => option.id === activeMenuOptionId),
    )
    const nextIndex =
      (activeIndex + delta + level.options.length) % level.options.length
    const next = level.options[nextIndex]
    if (next != null) {
      focusOption(next.id)
    }
  }

  function enterOption(id = activeMenuOptionId) {
    if (id != null) {
      focusOption(id)
    }
  }

  function handleHubKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const target = event.target
    const targetIsButton =
      target instanceof HTMLElement && target.tagName === 'BUTTON'

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(-1)
      return
    }

    if (event.key === 'Enter' && !targetIsButton) {
      event.preventDefault()
      enterOption()
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveSceneFocus(1)
      return
    }

    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveSceneFocus(-1)
      return
    }

    if (event.key === 'Escape') {
      if (document.fullscreenElement == null && fullscreenActive) {
        setFullscreenActive(false)
      }
    }
  }

  function moveSceneFocus(delta: number) {
    if (overviewActive) {
      moveContainerFocus(delta)
      return
    }

    const activeIndex = Math.max(
      0,
      sceneLevel.options.findIndex(
        (option) => option.id === activeSceneOptionId,
      ),
    )
    const nextIndex =
      (activeIndex + delta + sceneLevel.options.length) %
      sceneLevel.options.length
    const next = sceneLevel.options[nextIndex]
    if (next != null) {
      focusSceneOption(next.id)
    }
  }

  function moveContainerFocus(delta: number) {
    if (scene.containers.length === 0) {
      return
    }

    const activeIndex = Math.max(
      0,
      scene.containers.findIndex(
        (container) => container.id === resolvedSelectedContainerId,
      ),
    )
    const nextIndex =
      (activeIndex + delta + scene.containers.length) % scene.containers.length
    const next = scene.containers[nextIndex]
    if (next != null) {
      setSelectedContainerId(next.id)
    }
  }

  function changeSelectedAsset(assetId: HubAssetId) {
    if (selected == null) {
      return
    }

    setAssetOverrides((current) => ({
      ...current,
      [selected.id]: assetId,
    }))
  }

  async function toggleFullscreen() {
    const root = hubRef.current
    if (root == null || typeof document === 'undefined') {
      return
    }

    if (fullscreenActive) {
      if (
        document.fullscreenElement === root &&
        typeof document.exitFullscreen === 'function'
      ) {
        try {
          await document.exitFullscreen()
        } catch {
          setFullscreenActive(false)
        }
      } else {
        setFullscreenActive(false)
      }
      return
    }

    if (typeof root.requestFullscreen === 'function') {
      try {
        await root.requestFullscreen()
        setFullscreenActive(true)
        return
      } catch {
        // Fall back to fixed positioning when native fullscreen is blocked.
      }
    }

    setFullscreenActive(true)
  }

  return (
    <div
      ref={hubRef}
      tabIndex={0}
      className={cn(
        'outline-none focus-visible:ring-2 focus-visible:ring-cyan-200/70',
        'relative min-h-[680px] overflow-hidden rounded-[1.25rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,#10223b_0%,#06101f_44%,#02060d_100%)] shadow-[0_24px_80px_-42px_rgba(82,246,255,0.4)]',
        fullscreenActive &&
          'fixed inset-0 z-[80] min-h-[100svh] rounded-none border-0 shadow-none',
      )}
      style={{ height: fullscreenActive ? '100svh' : 'calc(100svh - 8.5rem)' }}
      data-testid='architecture-system-hub'
      onKeyDown={handleHubKeyDown}
    >
      {overviewActive ? (
        <ContainerOverviewExperience
          scene={scene}
          selectedContainerId={resolvedSelectedContainerId}
          onSelectContainer={setSelectedContainerId}
        />
      ) : webglSupported ? (
        <Canvas
          shadows
          dpr={[1, 2]}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
          camera={{
            position: [32, 34, 42],
            fov: 42,
            near: 0.1,
            far: 600,
          }}
          onPointerMissed={() => hubRef.current?.focus()}
        >
          <Suspense fallback={null}>
            <HubCameraRig model={model} />
            <HubSceneContents
              model={model}
              assetOverrides={assetOverrides}
              onSelect={focusSceneOption}
              onDive={focusSceneOption}
            />
            <Billboard position={[model.centre.x, 10, model.centre.z]}>
              <Text
                fontSize={0.7}
                color={LABEL}
                anchorX='center'
                anchorY='middle'
                maxWidth={12}
                textAlign='center'
                outlineWidth={0.035}
                outlineColor='#020812'
              >
                {model.title}
              </Text>
            </Billboard>
          </Suspense>
        </Canvas>
      ) : (
        <HubStaticScene
          model={model}
          assetOverrides={assetOverrides}
          onSelect={focusSceneOption}
          onDive={focusSceneOption}
        />
      )}

      <HubHud
        level={level}
        breadcrumb={breadcrumb}
        selected={overviewActive ? null : selected}
        activeMenuOptionId={activeMenuOptionId}
        selectedAsset={overviewActive ? null : selectedAsset}
        context={context}
        fullscreenActive={fullscreenActive}
        onOptionFocus={focusOption}
        onOptionEnter={enterOption}
        onBack={() => {}}
        onAssetChange={changeSelectedAsset}
        onFullscreenToggle={toggleFullscreen}
      />

      <div
        className='pointer-events-none absolute inset-0 opacity-65 mix-blend-screen'
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(82, 246, 255, 0.18), transparent 34%), linear-gradient(rgba(82, 246, 255, 0.06) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 100% 7px',
        }}
      />
    </div>
  )
}
