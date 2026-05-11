import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  EMPTY_ATLAS_ARCHITECTURE_DATA,
  fetchAtlasArchitectureFacts,
  fetchAtlasArchitectureGraph,
} from './architecture-graph'

const mockRequestGraphQL = vi.hoisted(() => vi.fn())

vi.mock('@/api/graphql/client', () => ({
  requestGraphQL: (...args: unknown[]) => mockRequestGraphQL(...args),
}))

function node(overrides: Record<string, unknown> = {}) {
  return {
    id: 'node',
    kind: 'NODE',
    label: 'Node',
    artefactId: null,
    symbolId: null,
    path: null,
    entryKind: null,
    sourceKind: 'COMPUTED',
    confidence: 0.9,
    computed: true,
    asserted: false,
    properties: {},
    ...overrides,
  }
}

describe('Atlas architecture graph loader', () => {
  beforeEach(() => {
    mockRequestGraphQL.mockReset()
  })

  it('loads project-scoped containers and flows from a separate lightweight query', async () => {
    mockRequestGraphQL.mockResolvedValueOnce({
      data: {
        repo: {
          project: {
            path: '.',
            architectureContainers: [
              {
                id: 'container:orders-api',
                key: 'orders-api',
                kind: 'api',
                label: 'Orders API',
                repository: {
                  repoId: 'repo-1',
                  name: 'bitloops',
                  provider: 'local',
                  organization: 'bitloops',
                },
                node: node({
                  id: 'container:orders-api',
                  kind: 'CONTAINER',
                  label: 'Orders API',
                  path: 'src',
                }),
                entryPoints: [],
                deploymentUnits: [],
                components: [],
              },
            ],
            architectureFlows: [
              {
                entryPoint: node({
                  id: 'entry:orders-api',
                  kind: 'ENTRY_POINT',
                  label: 'orders-api',
                  path: 'src/main.ts',
                  entryKind: 'npm_bin',
                }),
                flow: node({
                  id: 'flow:orders-api',
                  kind: 'FLOW',
                  label: 'orders-api flow',
                }),
                traversedNodes: [],
                steps: [],
              },
            ],
          },
        },
      },
    })

    const result = await fetchAtlasArchitectureGraph({
      repo: 'bitloops',
      projectPath: '.',
      first: 50,
    })

    expect(result.containers).toHaveLength(1)
    expect(result.flows).toHaveLength(1)
    expect(mockRequestGraphQL).toHaveBeenCalledWith(
      expect.stringContaining('query AtlasArchitecture'),
      {
        repo: 'bitloops',
        projectPath: '.',
        first: 50,
      },
      { signal: undefined },
    )
    expect(mockRequestGraphQL).toHaveBeenCalledWith(
      expect.stringContaining('steps'),
      expect.anything(),
      expect.anything(),
    )
  })

  it('falls back to empty architecture data when the graph query is rejected', async () => {
    mockRequestGraphQL.mockResolvedValueOnce({
      errors: [{ message: 'Query is too complex.' }],
    })

    await expect(
      fetchAtlasArchitectureGraph({
        repo: 'bitloops',
        projectPath: '.',
        first: 50,
      }),
    ).resolves.toEqual(EMPTY_ATLAS_ARCHITECTURE_DATA)
  })

  it('loads generic graph facts through a separate optional query', async () => {
    mockRequestGraphQL.mockResolvedValueOnce({
      data: {
        repo: {
          project: {
            path: '.',
            architectureGraph: {
              nodes: [
                node({
                  id: 'persistence:orders',
                  kind: 'PERSISTENCE_OBJECT',
                  label: 'orders',
                }),
              ],
              edges: [
                {
                  id: 'edge:reads',
                  kind: 'READS',
                  fromNodeId: 'node:api',
                  toNodeId: 'persistence:orders',
                  sourceKind: 'COMPUTED',
                  confidence: 0.8,
                  computed: true,
                  asserted: false,
                  properties: {},
                },
              ],
            },
          },
        },
      },
    })

    await expect(
      fetchAtlasArchitectureFacts({
        repo: 'bitloops',
        projectPath: '.',
        first: 50,
      }),
    ).resolves.toEqual({
      graphNodes: [
        expect.objectContaining({
          id: 'persistence:orders',
          kind: 'PERSISTENCE_OBJECT',
        }),
      ],
      graphEdges: [
        expect.objectContaining({
          id: 'edge:reads',
          kind: 'READS',
        }),
      ],
    })
  })
})
