import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, type ThreeEvent, useThree } from '@react-three/fiber'
import {
  Billboard,
  Edges,
  OrbitControls,
  QuadraticBezierLine,
  RoundedBox,
  Text,
} from '@react-three/drei'
import {
  Boxes,
  ChevronLeft,
  CircleDot,
  Clock3,
  Database,
  FileCode2,
  GitBranch,
  Layers3,
  MousePointerClick,
  Network,
  Route,
  SearchCode,
  Waypoints,
  Workflow,
} from 'lucide-react'
import * as THREE from 'three'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type {
  ArchitectureNavigationContext,
  ArchitectureSceneModel,
} from '../model'

type DemoViewId = 'domains' | 'flow' | 'freshness'

type DemoMetric = {
  label: string
  value: string
}

type DemoNodeKind =
  | 'product'
  | 'surface'
  | 'runtime'
  | 'knowledge'
  | 'capability'
  | 'state'
  | 'integration'
  | 'review'

type DemoNode = {
  id: string
  label: string
  shortLabel?: string
  kind: DemoNodeKind
  summary: string
  detail: string
  children?: string[]
  evidence: string[]
  metrics: DemoMetric[]
  colour: string
  height: number
}

type DemoEdge = {
  id: string
  from: string
  to: string
  label: string
  colour: string
}

type DemoSceneNode = DemoNode & {
  position: THREE.Vector3
  selected: boolean
  focus: boolean
  dimmed: boolean
  canDive: boolean
  heat: number
}

type DemoSceneModel = {
  nodes: DemoSceneNode[]
  edges: DemoEdge[]
  centre: THREE.Vector3
  radius: number
}

type ArchitectureHierarchyDemoProps = {
  scene: ArchitectureSceneModel
}

const ROOT_NODE_ID = 'bitloops'
const BACKGROUND = '#030812'
const LABEL = '#E8FEFF'
const CYAN = '#52F6FF'
const MINT = '#50FFC2'
const AMBER = '#FFB14A'
const RED = '#FF355D'
const BLUE = '#2D8CFF'
const VIOLET = '#C879FF'

const viewOptions: Array<{
  id: DemoViewId
  label: string
  icon: typeof Layers3
}> = [
  { id: 'domains', label: 'Hierarchy', icon: Layers3 },
  { id: 'flow', label: 'Flow', icon: Workflow },
  { id: 'freshness', label: 'Review', icon: Clock3 },
]

const demoNodes: Record<string, DemoNode> = {
  bitloops: {
    id: 'bitloops',
    label: 'Bitloops developer platform',
    shortLabel: 'Bitloops',
    kind: 'product',
    summary:
      'A local development intelligence platform that observes a repository, builds queryable context, and presents it through CLI, daemon, DevQL, and dashboard surfaces.',
    detail:
      'This should be the first abstraction a new user sees: what the repo is for, who uses it, and which subsystems make the product work.',
    children: [
      'developer-surfaces',
      'runtime-orchestration',
      'devql-knowledge',
      'analysis-capabilities',
      'state-materialisation',
      'agent-integrations',
    ],
    evidence: [
      'bitloops/src/cli',
      'bitloops/src/daemon',
      'bitloops/src/graphql',
      'bitloops/src/capability_packs',
    ],
    metrics: [
      { label: 'Top-level domains', value: '6' },
      { label: 'Demo depth', value: '3 levels' },
    ],
    colour: CYAN,
    height: 5.8,
  },
  'developer-surfaces': {
    id: 'developer-surfaces',
    label: 'Developer surfaces',
    kind: 'surface',
    summary:
      'The places humans interact with Bitloops: CLI commands, local dashboard, IDE extension, and documentation.',
    detail:
      'This layer should answer “where do I use the product?” before exposing implementation modules.',
    children: ['cli', 'local-dashboard', 'vscode-extension', 'documentation'],
    evidence: [
      'bitloops/src/cli',
      'local-dashboard/src',
      'vscode-extension',
      'documentation',
    ],
    metrics: [
      { label: 'Main surfaces', value: '4' },
      { label: 'Primary UX', value: 'CLI + Dashboard' },
    ],
    colour: MINT,
    height: 4.2,
  },
  'runtime-orchestration': {
    id: 'runtime-orchestration',
    label: 'Runtime orchestration',
    kind: 'runtime',
    summary:
      'The daemon, task queue, sessions, hooks, and sync lifecycle that keep repository context current.',
    detail:
      'This is the operational spine of the repo. A human should understand it as “work gets scheduled, executed, enriched, and surfaced”.',
    children: ['daemon', 'sessions', 'task-queue', 'sync-lifecycle', 'hooks'],
    evidence: [
      'bitloops/src/daemon',
      'bitloops/src/session',
      'bitloops/src/host/devql/commands_sync',
    ],
    metrics: [
      { label: 'Main loop', value: 'sync -> enrich' },
      { label: 'Responsibility', value: 'orchestration' },
    ],
    colour: BLUE,
    height: 4.6,
  },
  'devql-knowledge': {
    id: 'devql-knowledge',
    label: 'DevQL knowledge layer',
    kind: 'knowledge',
    summary:
      'GraphQL schema, query contexts, capability host, language packs, and relational records that make the codebase queryable.',
    detail:
      'This layer converts repository facts into a product API. It is the bridge between analysis producers and human-facing views.',
    children: [
      'graphql-api',
      'capability-host',
      'language-packs',
      'relational-store',
      'schema-modules',
    ],
    evidence: [
      'bitloops/src/graphql',
      'bitloops/src/host/capability_host',
      'bitloops/src/host/extension_host/language',
    ],
    metrics: [
      { label: 'Interface', value: 'GraphQL' },
      { label: 'Storage', value: 'relational facts' },
    ],
    colour: VIOLET,
    height: 4.8,
  },
  'analysis-capabilities': {
    id: 'analysis-capabilities',
    label: 'Analysis capabilities',
    kind: 'capability',
    summary:
      'Capability packs that produce higher-level understanding: CodeCity, architecture graph, navigation context, test harness, knowledge, and clones.',
    detail:
      'This is where raw code facts become navigable product information. The hierarchy view should make these packs feel like named capabilities, not folders.',
    children: [
      'codecity',
      'architecture-graph',
      'navigation-context',
      'test-harness',
      'knowledge-pack',
      'semantic-clones',
    ],
    evidence: ['bitloops/src/capability_packs'],
    metrics: [
      { label: 'Capability packs', value: '6' },
      { label: 'Current focus', value: 'navigation context' },
    ],
    colour: AMBER,
    height: 5,
  },
  'state-materialisation': {
    id: 'state-materialisation',
    label: 'State and materialisation',
    kind: 'state',
    summary:
      'The durable state model: task records, checkpoints, relational stores, generated views, and accepted context signatures.',
    detail:
      'This explains why the UI can talk about freshness: generated information has records, signatures, and materialised refs.',
    children: [
      'checkpoints',
      'task-records',
      'navigation-views',
      'materialised-refs',
    ],
    evidence: [
      'bitloops/src/host/checkpoints',
      'bitloops/src/daemon/tasks',
      'bitloops/src/capability_packs/navigation_context',
    ],
    metrics: [
      { label: 'Freshness primitive', value: 'signature' },
      { label: 'Review unit', value: 'view' },
    ],
    colour: '#7AA2FF',
    height: 4.2,
  },
  'agent-integrations': {
    id: 'agent-integrations',
    label: 'Agent integrations',
    kind: 'integration',
    summary:
      'Adapters and protocols that let external coding agents and inference runtimes participate in Bitloops workflows.',
    detail:
      'Not the first thing a human needs, but important once they ask how the system collaborates with external tools.',
    children: ['claude-code', 'copilot', 'open-code', 'inference-protocol'],
    evidence: ['bitloops/src/adapters/agents', 'bitloops-inference-protocol'],
    metrics: [
      { label: 'Adapters', value: '3' },
      { label: 'Protocol crate', value: '1' },
    ],
    colour: '#D885FF',
    height: 4,
  },
  cli: leaf(
    'cli',
    'CLI',
    'surface',
    'Command surface for sync, DevQL, daemon, and workflow operations.',
    'bitloops/src/cli',
    MINT,
  ),
  'local-dashboard': leaf(
    'local-dashboard',
    'Local dashboard',
    'surface',
    'Browser UI for exploring sessions, queries, Code Atlas, and architecture.',
    'local-dashboard/src',
    MINT,
  ),
  'vscode-extension': leaf(
    'vscode-extension',
    'VS Code extension',
    'surface',
    'IDE integration surface for Bitloops workflows.',
    'vscode-extension',
    MINT,
  ),
  documentation: leaf(
    'documentation',
    'Documentation',
    'surface',
    'Human-facing written guidance and product explanation.',
    'documentation',
    MINT,
  ),
  daemon: leaf(
    'daemon',
    'Daemon',
    'runtime',
    'Long-running local process that owns background work and serves dashboard state.',
    'bitloops/src/daemon',
    BLUE,
  ),
  sessions: leaf(
    'sessions',
    'Sessions',
    'runtime',
    'Conversation and workflow state managed by the runtime.',
    'bitloops/src/session',
    BLUE,
  ),
  'task-queue': leaf(
    'task-queue',
    'Task queue',
    'runtime',
    'Queue and workers for sync, enrichment, and follow-up work.',
    'bitloops/src/daemon/tasks',
    BLUE,
  ),
  'sync-lifecycle': leaf(
    'sync-lifecycle',
    'Sync lifecycle',
    'runtime',
    'Repository inspection, artefact materialisation, and post-sync work.',
    'bitloops/src/host/devql/commands_sync',
    BLUE,
  ),
  hooks: leaf(
    'hooks',
    'Hooks',
    'runtime',
    'Event hooks and dispatchers around runtime actions.',
    'bitloops/src/host/hooks',
    BLUE,
  ),
  'graphql-api': leaf(
    'graphql-api',
    'GraphQL API',
    'knowledge',
    'Typed query and mutation surface used by the dashboard and CLI tools.',
    'bitloops/src/graphql',
    VIOLET,
  ),
  'capability-host': leaf(
    'capability-host',
    'Capability host',
    'knowledge',
    'Registry and lifecycle for packs that own specialised records and schema.',
    'bitloops/src/host/capability_host',
    VIOLET,
  ),
  'language-packs': leaf(
    'language-packs',
    'Language packs',
    'knowledge',
    'Language-aware extraction adapters for Rust, TypeScript, Python, Go, Java, and C#.',
    'bitloops/src/host/extension_host/language',
    VIOLET,
  ),
  'relational-store': leaf(
    'relational-store',
    'Relational store',
    'state',
    'SQLite-backed DevQL fact tables queried by capability schema modules.',
    'bitloops/src/stores',
    '#7AA2FF',
  ),
  'schema-modules': leaf(
    'schema-modules',
    'Schema modules',
    'knowledge',
    'Pack-owned GraphQL schema additions and query examples.',
    'bitloops/src/capability_packs',
    VIOLET,
  ),
  codecity: leaf(
    'codecity',
    'CodeCity',
    'capability',
    'Builds the file/world visualisation and health overlays.',
    'bitloops/src/capability_packs/codecity',
    AMBER,
  ),
  'architecture-graph': leaf(
    'architecture-graph',
    'Architecture graph',
    'capability',
    'Builds components, contracts, entry points, and system facts.',
    'bitloops/src/capability_packs/architecture_graph',
    AMBER,
  ),
  'navigation-context': leaf(
    'navigation-context',
    'Navigation context',
    'capability',
    'Tracks primitives, signatures, stale reasons, and materialised architecture context.',
    'bitloops/src/capability_packs/navigation_context',
    AMBER,
  ),
  'test-harness': leaf(
    'test-harness',
    'Test harness',
    'capability',
    'Discovers tests, coverage, classifications, and verification records.',
    'bitloops/src/capability_packs/test_harness',
    AMBER,
  ),
  'knowledge-pack': leaf(
    'knowledge-pack',
    'Knowledge pack',
    'capability',
    'Stores and refreshes durable knowledge records.',
    'bitloops/src/capability_packs/knowledge.rs',
    AMBER,
  ),
  'semantic-clones': leaf(
    'semantic-clones',
    'Semantic clones',
    'capability',
    'Identifies similar symbols and clone edges.',
    'bitloops/src/capability_packs/semantic_clones',
    AMBER,
  ),
  checkpoints: leaf(
    'checkpoints',
    'Checkpoints',
    'state',
    'Durable snapshots of runtime and session state.',
    'bitloops/src/host/checkpoints',
    '#7AA2FF',
  ),
  'task-records': leaf(
    'task-records',
    'Task records',
    'state',
    'Persisted task status used for sync and enrichment reporting.',
    'bitloops/src/daemon/tasks',
    '#7AA2FF',
  ),
  'navigation-views': leaf(
    'navigation-views',
    'Navigation views',
    'state',
    'Accepted and current signatures for information views.',
    'bitloops/src/capability_packs/navigation_context',
    '#7AA2FF',
  ),
  'materialised-refs': leaf(
    'materialised-refs',
    'Materialised refs',
    'state',
    'Stable references to generated context snapshots.',
    'bitloops/src/capability_packs/navigation_context',
    '#7AA2FF',
  ),
  'claude-code': leaf(
    'claude-code',
    'Claude Code',
    'integration',
    'Adapter for Claude Code workflows and hooks.',
    'bitloops/src/adapters/agents/claude_code',
    '#D885FF',
  ),
  copilot: leaf(
    'copilot',
    'Copilot',
    'integration',
    'Adapter for Copilot-related transcript and workflow integration.',
    'bitloops/src/adapters/agents/copilot',
    '#D885FF',
  ),
  'open-code': leaf(
    'open-code',
    'OpenCode',
    'integration',
    'Adapter for OpenCode agent sessions.',
    'bitloops/src/adapters/agents/open_code',
    '#D885FF',
  ),
  'inference-protocol': leaf(
    'inference-protocol',
    'Inference protocol',
    'integration',
    'Protocol crate for inference runtime communication.',
    'bitloops-inference-protocol',
    '#D885FF',
  ),
}

const flowNodes: DemoNode[] = [
  flowNode(
    'user-intent',
    'Human intent',
    'Ask, inspect, change, review',
    Route,
    MINT,
  ),
  flowNode(
    'surface-action',
    'CLI or dashboard',
    'Command or UI action enters the product',
    MousePointerClick,
    CYAN,
  ),
  flowNode(
    'daemon-work',
    'Daemon task',
    'Background task schedules repository work',
    Workflow,
    BLUE,
  ),
  flowNode(
    'devql-read-model',
    'DevQL read model',
    'Facts are produced and queried through GraphQL',
    SearchCode,
    VIOLET,
  ),
  flowNode(
    'capability-output',
    'Capability output',
    'Packs produce views such as architecture and navigation context',
    Boxes,
    AMBER,
  ),
  flowNode(
    'human-review',
    'Human review',
    'Freshness, context changes, and drill-down guide inspection',
    CircleDot,
    RED,
  ),
]

const flowEdges: DemoEdge[] = [
  edge(
    'flow:user-intent:surface-action',
    'user-intent',
    'surface-action',
    'starts',
    MINT,
  ),
  edge(
    'flow:surface-action:daemon-work',
    'surface-action',
    'daemon-work',
    'queues',
    CYAN,
  ),
  edge(
    'flow:daemon-work:devql-read-model',
    'daemon-work',
    'devql-read-model',
    'syncs',
    BLUE,
  ),
  edge(
    'flow:devql-read-model:capability-output',
    'devql-read-model',
    'capability-output',
    'enriches',
    VIOLET,
  ),
  edge(
    'flow:capability-output:human-review',
    'capability-output',
    'human-review',
    'surfaces',
    AMBER,
  ),
]

function leaf(
  id: string,
  label: string,
  kind: DemoNodeKind,
  summary: string,
  evidence: string,
  colour: string,
): DemoNode {
  return {
    id,
    label,
    kind,
    summary,
    detail:
      'In the final product this node would be generated from system-of-record facts, evidence links, ownership, entry points, and freshness signatures.',
    evidence: [evidence],
    metrics: [
      { label: 'Level', value: 'leaf' },
      { label: 'Evidence', value: '1 path' },
    ],
    colour,
    height: 3.4,
  }
}

function flowNode(
  id: string,
  label: string,
  summary: string,
  Icon: typeof Layers3,
  colour: string,
): DemoNode {
  return {
    id,
    label,
    shortLabel: label,
    kind: 'review',
    summary,
    detail:
      'This flow view is a prototype for presenting the codebase as a user journey instead of a static module diagram.',
    evidence: [Icon.displayName ?? 'runtime evidence'],
    metrics: [{ label: 'View', value: 'flow' }],
    colour,
    height: 3.8,
  }
}

function edge(
  id: string,
  from: string,
  to: string,
  label: string,
  colour: string,
): DemoEdge {
  return { id, from, to, label, colour }
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

function freshnessNodes(
  context: ArchitectureNavigationContext | null,
): DemoNode[] {
  const changeCount = context?.changeCount ?? 0
  const status = context?.status === 'stale' ? 'Potentially stale' : 'Fresh'
  const current = context?.currentSignature?.slice(0, 12) ?? 'unknown'
  const accepted = context?.acceptedSignature?.slice(0, 12) ?? 'none'

  return [
    {
      id: 'freshness-current',
      label: 'Current code facts',
      kind: 'review',
      summary:
        'The latest primitive signatures produced from the current repository state.',
      detail:
        'This is the source of truth that tells us whether a generated overview still matches the code.',
      evidence: ['navigation_context_primitives'],
      metrics: [
        { label: 'Status', value: status },
        { label: 'Current', value: current },
      ],
      colour: CYAN,
      height: 4.4,
    },
    {
      id: 'freshness-accepted',
      label: 'Accepted baseline',
      kind: 'review',
      summary:
        'The last accepted version of the architecture context that a human trusted.',
      detail:
        'The baseline makes the view reviewable instead of being a throwaway generated summary.',
      evidence: ['navigation_context_view_acceptance_history'],
      metrics: [
        { label: 'Accepted', value: accepted },
        {
          label: 'Reviews',
          value: String(context?.acceptanceHistory.length ?? 0),
        },
      ],
      colour: MINT,
      height: 3.6,
    },
    {
      id: 'freshness-delta',
      label: 'Delta to review',
      kind: 'review',
      summary:
        'Changed primitives that should guide the user towards the parts of the codebase that may invalidate the overview.',
      detail:
        'This is where the 3D scene should become useful: changed areas become spatial review targets.',
      evidence: ['staleReason.changedPrimitives'],
      metrics: [
        { label: 'Changes', value: String(changeCount) },
        { label: 'Review state', value: context?.reviewState ?? 'unknown' },
      ],
      colour: AMBER,
      height: 5.1,
    },
    {
      id: 'freshness-materialised',
      label: 'Materialised view',
      kind: 'review',
      summary:
        'A stable generated snapshot that can back the product/domain overview and architecture hierarchy.',
      detail:
        'For this demo, materialisation is shown as the durable artefact the user is deciding whether to trust.',
      evidence: [context?.materialisedRef ?? 'materialised ref not set'],
      metrics: [
        {
          label: 'Snapshot',
          value: context?.materialisedRef == null ? 'not set' : 'available',
        },
      ],
      colour: VIOLET,
      height: 3.8,
    },
  ]
}

function freshnessEdges(): DemoEdge[] {
  return [
    edge(
      'fresh:accepted:delta',
      'freshness-accepted',
      'freshness-delta',
      'compare',
      MINT,
    ),
    edge(
      'fresh:current:delta',
      'freshness-current',
      'freshness-delta',
      'diff',
      CYAN,
    ),
    edge(
      'fresh:delta:materialised',
      'freshness-delta',
      'freshness-materialised',
      'accept',
      AMBER,
    ),
  ]
}

function nodeById(id: string) {
  return demoNodes[id] ?? demoNodes[ROOT_NODE_ID]
}

function childrenFor(id: string) {
  return nodeById(id).children?.map(nodeById) ?? []
}

function layoutRadialNodes(
  focusNode: DemoNode,
  childNodes: DemoNode[],
  selectedId: string | null,
): DemoSceneModel {
  const radius = childNodes.length <= 4 ? 12 : 15
  const centre = new THREE.Vector3(0, 0, 0)
  const nodes: DemoSceneNode[] = [
    {
      ...focusNode,
      position: centre,
      selected: selectedId === focusNode.id,
      focus: true,
      dimmed: selectedId != null && selectedId !== focusNode.id,
      canDive: childrenFor(focusNode.id).length > 0,
      heat: 0.2,
    },
    ...childNodes.map((child, index) => {
      const angle =
        (index / Math.max(1, childNodes.length)) * Math.PI * 2 - Math.PI / 2
      const position = new THREE.Vector3(
        Math.cos(angle) * radius,
        0,
        Math.sin(angle) * radius,
      )

      return {
        ...child,
        position,
        selected: selectedId === child.id,
        focus: false,
        dimmed: selectedId != null && selectedId !== child.id,
        canDive: childrenFor(child.id).length > 0,
        heat:
          child.kind === 'capability' || child.id === 'navigation-context'
            ? 0.88
            : 0.35,
      }
    }),
  ]

  return {
    nodes,
    edges: childNodes.map((child) =>
      edge(
        `hierarchy:${focusNode.id}:${child.id}`,
        focusNode.id,
        child.id,
        'contains',
        child.colour,
      ),
    ),
    centre,
    radius,
  }
}

function layoutLinearNodes(
  nodes: DemoNode[],
  edges: DemoEdge[],
  selectedId: string | null,
): DemoSceneModel {
  const gap = 9.8
  const start = -((nodes.length - 1) * gap) / 2
  const sceneNodes = nodes.map(
    (node, index): DemoSceneNode => ({
      ...node,
      position: new THREE.Vector3(
        start + index * gap,
        0,
        index % 2 === 0 ? -1.8 : 1.8,
      ),
      selected: selectedId === node.id,
      focus: false,
      dimmed: selectedId != null && selectedId !== node.id,
      canDive: false,
      heat: index / Math.max(1, nodes.length - 1),
    }),
  )

  return {
    nodes: sceneNodes,
    edges,
    centre: new THREE.Vector3(0, 0, 0),
    radius: Math.max(24, nodes.length * 5.2),
  }
}

function buildDemoScene({
  view,
  focusId,
  selectedId,
  navigationContext,
}: {
  view: DemoViewId
  focusId: string
  selectedId: string | null
  navigationContext: ArchitectureNavigationContext | null
}) {
  if (view === 'flow') {
    return layoutLinearNodes(flowNodes, flowEdges, selectedId)
  }

  if (view === 'freshness') {
    return layoutLinearNodes(
      freshnessNodes(navigationContext),
      freshnessEdges(),
      selectedId,
    )
  }

  const focusNode = nodeById(focusId)
  return layoutRadialNodes(focusNode, childrenFor(focusNode.id), selectedId)
}

function connectionPoint(node: DemoSceneNode, mode: 'from' | 'to') {
  return new THREE.Vector3(
    node.position.x,
    node.height + 1.3,
    node.position.z + (mode === 'from' ? 0.6 : -0.6),
  )
}

function DemoConnection({
  edge,
  from,
  to,
  selected,
}: {
  edge: DemoEdge
  from: DemoSceneNode
  to: DemoSceneNode
  selected: boolean
}) {
  const start = connectionPoint(from, 'from')
  const end = connectionPoint(to, 'to')
  const mid = new THREE.Vector3(
    (start.x + end.x) / 2,
    Math.max(start.y, end.y) + 2.8,
    (start.z + end.z) / 2,
  )

  return (
    <group>
      <QuadraticBezierLine
        start={[start.x, start.y, start.z]}
        mid={[mid.x, mid.y, mid.z]}
        end={[end.x, end.y, end.z]}
        color={edge.colour}
        lineWidth={selected ? 4.4 : 2.3}
        transparent
        opacity={selected ? 0.92 : 0.48}
      />
      {selected && (
        <Billboard position={[mid.x, mid.y + 0.8, mid.z]}>
          <Text
            fontSize={0.54}
            color={LABEL}
            anchorX='center'
            anchorY='middle'
            maxWidth={5.5}
            textAlign='center'
            outlineWidth={0.035}
            outlineColor='#020812'
          >
            {edge.label}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function DemoBlock({
  node,
  onSelect,
  onDive,
}: {
  node: DemoSceneNode
  onSelect: (id: string) => void
  onDive: (id: string) => void
}) {
  const width = node.focus ? 7.6 : 5.6
  const depth = node.focus ? 5.2 : 4.1
  const opacity = node.dimmed ? 0.45 : 0.96
  const ringRadius = Math.max(width, depth) * (0.72 + node.heat * 0.14)

  return (
    <group
      position={[node.position.x, node.height / 2, node.position.z]}
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
      <RoundedBox
        args={[width, node.height, depth]}
        radius={0.34}
        smoothness={5}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color='#07111F'
          emissive={node.selected ? '#FFFFFF' : node.colour}
          emissiveIntensity={node.selected ? 0.58 : 0.28 + node.heat * 0.26}
          metalness={0.16}
          roughness={0.52}
          transparent
          opacity={opacity}
        />
        <Edges color={node.selected ? '#FFFFFF' : node.colour} threshold={12} />
      </RoundedBox>
      <mesh position={[0, node.height / 2 + 0.18, 0]}>
        <boxGeometry args={[width * 0.72, 0.1, depth * 0.72]} />
        <meshBasicMaterial
          color={node.colour}
          transparent
          opacity={node.selected ? 0.9 : 0.58}
          toneMapped={false}
        />
      </mesh>
      {(node.canDive || node.selected) && (
        <mesh
          position={[0, -node.height / 2 + 0.08, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[ringRadius * 0.78, ringRadius, 72]} />
          <meshBasicMaterial
            color={node.canDive ? node.colour : AMBER}
            transparent
            opacity={node.selected ? 0.7 : 0.34}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      )}
      <Billboard position={[0, node.height / 2 + 1.3, 0]}>
        <Text
          fontSize={node.focus ? 0.82 : 0.62}
          color={LABEL}
          anchorX='center'
          anchorY='middle'
          maxWidth={node.focus ? 7 : 5.4}
          textAlign='center'
          outlineWidth={0.04}
          outlineColor='#020812'
        >
          {node.shortLabel ?? node.label}
        </Text>
      </Billboard>
      {node.canDive && (
        <Billboard position={[0, -node.height / 2 + 1.05, depth / 2 + 0.18]}>
          <Text
            fontSize={0.38}
            color='#FFE5B8'
            anchorX='center'
            anchorY='middle'
            maxWidth={4}
            textAlign='center'
            outlineWidth={0.028}
            outlineColor='#020812'
          >
            double click to drill in
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function DemoSceneContents({
  model,
  onSelect,
  onDive,
}: {
  model: DemoSceneModel
  onSelect: (id: string) => void
  onDive: (id: string) => void
}) {
  const nodesById = useMemo(
    () => new Map(model.nodes.map((node) => [node.id, node])),
    [model.nodes],
  )

  return (
    <>
      <ambientLight intensity={0.42} />
      <hemisphereLight intensity={0.38} color='#D5FCFF' groundColor='#06101D' />
      <directionalLight position={[60, 80, 40]} intensity={0.92} castShadow />
      <directionalLight
        position={[-50, 30, -60]}
        intensity={0.46}
        color={CYAN}
      />
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[model.centre.x, -0.08, model.centre.z]}
        receiveShadow
      >
        <planeGeometry
          args={[model.radius * 2 + 20, model.radius * 1.5 + 18]}
        />
        <meshStandardMaterial
          color='#050C16'
          emissive='#02050A'
          emissiveIntensity={0.45}
          roughness={0.98}
        />
      </mesh>
      <gridHelper
        args={[model.radius * 2 + 20, 36, '#1CF4FF', '#123D59']}
        position={[model.centre.x, 0.02, model.centre.z]}
      />
      {model.edges.map((edge) => {
        const from = nodesById.get(edge.from)
        const to = nodesById.get(edge.to)
        if (from == null || to == null) {
          return null
        }

        return (
          <DemoConnection
            key={edge.id}
            edge={edge}
            from={from}
            to={to}
            selected={from.selected || to.selected}
          />
        )
      })}
      {model.nodes.map((node) => (
        <DemoBlock
          key={node.id}
          node={node}
          onSelect={onSelect}
          onDive={onDive}
        />
      ))}
    </>
  )
}

function DemoCameraRig({ model }: { model: DemoSceneModel }) {
  const controlsRef = useRef<React.ElementRef<typeof OrbitControls>>(null)
  const { camera, gl } = useThree()
  const longestSide = Math.max(34, model.radius * 2.1)

  useEffect(() => {
    gl.setClearColor(BACKGROUND)
  }, [gl])

  useEffect(() => {
    camera.position.set(
      model.centre.x + longestSide * 0.58,
      Math.max(30, longestSide * 0.54),
      model.centre.z + longestSide * 0.72,
    )
    camera.lookAt(model.centre.x, 2, model.centre.z)
    // Three.js camera instances are mutable external objects; keep projection in sync with the demo bounds.
    // eslint-disable-next-line react-hooks/immutability
    camera.far = Math.max(500, longestSide * 8)
    camera.updateProjectionMatrix()

    if (controlsRef.current != null) {
      controlsRef.current.target.set(model.centre.x, 2, model.centre.z)
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
      maxDistance={Math.max(95, longestSide * 2.2)}
      maxPolarAngle={Math.PI / 2.08}
    />
  )
}

function NodeKindIcon({ kind }: { kind: DemoNodeKind }) {
  switch (kind) {
    case 'surface':
      return <MousePointerClick className='size-5 text-cyan-500' />
    case 'runtime':
      return <Workflow className='size-5 text-cyan-500' />
    case 'knowledge':
      return <SearchCode className='size-5 text-cyan-500' />
    case 'capability':
      return <Boxes className='size-5 text-cyan-500' />
    case 'state':
      return <Database className='size-5 text-cyan-500' />
    case 'integration':
      return <GitBranch className='size-5 text-cyan-500' />
    case 'review':
      return <CircleDot className='size-5 text-cyan-500' />
    case 'product':
    default:
      return <Network className='size-5 text-cyan-500' />
  }
}

function selectedNodeFor({
  model,
  view,
  focusId,
  selectedId,
}: {
  model: DemoSceneModel
  view: DemoViewId
  focusId: string
  selectedId: string | null
}) {
  const fallback = view === 'domains' ? focusId : model.nodes[0]?.id
  return (
    model.nodes.find((node) => node.id === (selectedId ?? fallback)) ??
    model.nodes[0]
  )
}

function ViewButton({
  active,
  option,
  onClick,
}: {
  active: boolean
  option: (typeof viewOptions)[number]
  onClick: () => void
}) {
  const Icon = option.icon

  return (
    <Button
      type='button'
      variant='outline'
      size='sm'
      aria-pressed={active}
      className={cn(
        'rounded-full border-slate-200/80 bg-white/80 px-3 text-xs shadow-none dark:border-white/10 dark:bg-white/5',
        active
          ? 'border-slate-900/70 bg-slate-900 text-white hover:bg-slate-900/90 dark:border-white/50 dark:bg-white dark:text-slate-950'
          : 'text-slate-600 dark:text-slate-200',
      )}
      onClick={onClick}
    >
      <Icon className='size-4' />
      {option.label}
    </Button>
  )
}

function DetailPanel({
  selectedNode,
  focusTrail,
  view,
  navigationContext,
  onBack,
  onDive,
}: {
  selectedNode: DemoSceneNode | undefined
  focusTrail: string[]
  view: DemoViewId
  navigationContext: ArchitectureNavigationContext | null
  onBack: () => void
  onDive: (id: string) => void
}) {
  if (selectedNode == null) {
    return null
  }

  const canBack = view === 'domains' && focusTrail.length > 1
  const canDive =
    view === 'domains' && selectedNode.canDive && !selectedNode.focus

  return (
    <div className='space-y-5'>
      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <NodeKindIcon kind={selectedNode.kind} />
            <CardTitle>{selectedNode.label}</CardTitle>
          </div>
          <CardDescription>{selectedNode.summary}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          {view === 'domains' && (
            <div className='flex flex-wrap items-center gap-2'>
              {canBack && (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  onClick={onBack}
                >
                  <ChevronLeft className='size-4' />
                  Up
                </Button>
              )}
              {canDive && (
                <Button
                  type='button'
                  size='sm'
                  onClick={() => onDive(selectedNode.id)}
                >
                  <Layers3 className='size-4' />
                  Drill in
                </Button>
              )}
            </div>
          )}
          <p className='text-sm leading-6 text-muted-foreground'>
            {selectedNode.detail}
          </p>
          <div className='grid grid-cols-2 gap-3'>
            {selectedNode.metrics.map((metric) => (
              <div
                key={`${selectedNode.id}:${metric.label}`}
                className='rounded-lg border border-slate-200/80 bg-white/75 p-3 dark:border-white/10 dark:bg-white/5'
              >
                <div className='text-xs text-muted-foreground'>
                  {metric.label}
                </div>
                <div className='mt-1 break-words text-sm font-semibold'>
                  {metric.value}
                </div>
              </div>
            ))}
          </div>
          <div className='space-y-2'>
            <div className='text-xs font-medium uppercase text-muted-foreground'>
              Evidence
            </div>
            {selectedNode.evidence.map((item) => (
              <div
                key={`${selectedNode.id}:${item}`}
                className='rounded-lg border border-slate-200/80 bg-slate-50/70 px-3 py-2 text-xs font-medium dark:border-white/10 dark:bg-white/5'
              >
                {item}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className='flex items-center gap-2'>
            <Waypoints className='size-5 text-cyan-500' />
            <CardTitle>Prototype intent</CardTitle>
          </div>
        </CardHeader>
        <CardContent className='space-y-3 text-sm text-muted-foreground'>
          <p>
            Start broad, select to understand, double click to descend. Lower
            level details stay hidden until the user asks for them.
          </p>
          <div className='flex flex-wrap gap-2'>
            <Badge variant='outline'>Product first</Badge>
            <Badge variant='outline'>Evidence backed</Badge>
            <Badge variant='outline'>Freshness aware</Badge>
          </div>
          {navigationContext != null && (
            <div className='rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-amber-950 dark:border-amber-400/30 dark:bg-amber-950/20 dark:text-amber-100'>
              {navigationContext.changeCount} primitives currently need review
              for the architecture context.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export function ArchitectureHierarchyDemo({
  scene,
}: ArchitectureHierarchyDemoProps) {
  const [view, setView] = useState<DemoViewId>('domains')
  const [focusTrail, setFocusTrail] = useState([ROOT_NODE_ID])
  const [selectedId, setSelectedId] = useState<string | null>(ROOT_NODE_ID)
  const webglSupported = useMemo(() => supportsWebGL(), [])
  const focusId = focusTrail.at(-1) ?? ROOT_NODE_ID
  const navigationContext = scene.navigationContext ?? null
  const model = useMemo(
    () =>
      buildDemoScene({
        view,
        focusId,
        selectedId,
        navigationContext,
      }),
    [focusId, navigationContext, selectedId, view],
  )
  const selectedNode = selectedNodeFor({ model, view, focusId, selectedId })
  const breadcrumb = focusTrail.map(
    (id) => nodeById(id).shortLabel ?? nodeById(id).label,
  )

  function selectView(nextView: DemoViewId) {
    setView(nextView)
    setSelectedId(nextView === 'domains' ? focusId : null)
  }

  function diveInto(id: string) {
    if (view !== 'domains' || childrenFor(id).length === 0) {
      return
    }

    setFocusTrail((trail) => [...trail, id])
    setSelectedId(id)
  }

  function goBack() {
    setFocusTrail((trail) => trail.slice(0, Math.max(1, trail.length - 1)))
    setSelectedId(null)
  }

  return (
    <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]'>
      <div className='min-w-0'>
        <div
          className='relative h-[70svh] min-h-[560px] overflow-hidden rounded-[1.25rem] border border-cyan-300/20 bg-[radial-gradient(circle_at_top,#10223b_0%,#06101f_44%,#02060d_100%)] shadow-[0_24px_80px_-42px_rgba(82,246,255,0.4)]'
          data-testid='architecture-hierarchy-demo'
        >
          <div className='pointer-events-auto absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-wrap items-center gap-2'>
            {viewOptions.map((option) => (
              <ViewButton
                key={option.id}
                option={option}
                active={view === option.id}
                onClick={() => selectView(option.id)}
              />
            ))}
          </div>
          <div className='pointer-events-none absolute bottom-4 left-4 z-10 max-w-[min(34rem,calc(100%-2rem))] rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-cyan-50 shadow-xl backdrop-blur'>
            {view === 'domains'
              ? breadcrumb.join(' / ')
              : view === 'flow'
                ? 'Human request / runtime / DevQL / review'
                : 'Accepted baseline / current facts / review delta'}
          </div>
          {webglSupported ? (
            <Canvas
              shadows
              dpr={[1, 2]}
              gl={{ antialias: true, powerPreference: 'high-performance' }}
              camera={{
                position: [28, 34, 36],
                fov: 42,
                near: 0.1,
                far: 500,
              }}
              onPointerMissed={() => setSelectedId(null)}
            >
              <Suspense fallback={null}>
                <DemoCameraRig model={model} />
                <DemoSceneContents
                  model={model}
                  onSelect={setSelectedId}
                  onDive={diveInto}
                />
              </Suspense>
            </Canvas>
          ) : (
            <div className='flex h-full items-center justify-center p-6'>
              <div className='max-w-md rounded-3xl border border-white/70 bg-white/85 p-6 text-center shadow-[0_20px_45px_-30px_rgba(15,23,42,0.45)] backdrop-blur dark:border-white/10 dark:bg-slate-950/85'>
                <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
                  WebGL unavailable
                </p>
                <h3 className='mt-3 text-xl font-semibold'>
                  Hierarchy preview unavailable
                </h3>
                <p className='mt-2 text-sm text-muted-foreground'>
                  This environment cannot create a WebGL context, so use the
                  detail panel to inspect the prototype structure.
                </p>
              </div>
            </div>
          )}
          <div
            className='pointer-events-none absolute inset-0 opacity-65 mix-blend-screen'
            style={{
              backgroundImage:
                'radial-gradient(circle at 50% 20%, rgba(82, 246, 255, 0.18), transparent 34%), linear-gradient(rgba(82, 246, 255, 0.06) 1px, transparent 1px)',
              backgroundSize: '100% 100%, 100% 7px',
            }}
          />
        </div>
      </div>

      <div className='space-y-5 xl:sticky xl:top-20 xl:self-start'>
        <DetailPanel
          selectedNode={selectedNode}
          focusTrail={focusTrail}
          view={view}
          navigationContext={navigationContext}
          onBack={goBack}
          onDive={diveInto}
        />
        <Card>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <FileCode2 className='size-5 text-cyan-500' />
              <CardTitle>Demo assumptions</CardTitle>
            </div>
          </CardHeader>
          <CardContent className='space-y-2 text-sm text-muted-foreground'>
            <p>
              The nodes are hand-authored from this repo as a UX sketch. The
              intended production version would generate them from domain
              records, architecture facts, entry points, and accepted
              navigation-context signatures.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
