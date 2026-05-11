import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requestGraphQL } from '@/api/graphql/client'
import {
  fetchArchitectureNavigationContext,
  mapNavigationContextToScene,
} from './navigation-context'
import type {
  ArchitectureComponentNode,
  ArchitectureNavigationContext,
  ArchitectureSceneModel,
} from './model'

vi.mock('@/api/graphql/client', () => ({
  requestGraphQL: vi.fn(),
}))

const mockRequestGraphQL = vi.mocked(requestGraphQL)

function component(
  overrides: Partial<ArchitectureComponentNode>,
): ArchitectureComponentNode {
  return {
    id: 'component:api',
    label: 'API',
    path: 'src/api',
    kind: 'module',
    containerId: 'container:app',
    confidence: 0.9,
    asserted: false,
    computed: true,
    position: { x: 0, y: 0, z: 0 },
    width: 4,
    depth: 3,
    height: 5,
    colour: '#52F6FF',
    buildingIds: [],
    filePaths: ['src/api/main.ts'],
    entryPointIds: [],
    deploymentUnitIds: [],
    contractInCount: 0,
    contractOutCount: 0,
    directInCount: 0,
    directOutCount: 0,
    readCount: 0,
    writeCount: 0,
    ...overrides,
  }
}

function sceneWithComponents(
  components: ArchitectureComponentNode[],
): ArchitectureSceneModel {
  return {
    id: 'architecture:repo',
    title: 'Architecture',
    repositoryLabel: 'bitloops/bitloops',
    containers: [],
    componentGroups: [],
    components,
    entryPoints: [],
    deploymentUnits: [],
    persistenceObjects: [],
    contractConnections: [],
    directConnections: [],
    dataConnections: [],
    navigationContext: null,
    bounds: {
      minX: 0,
      maxX: 1,
      minZ: 0,
      maxZ: 1,
      width: 1,
      depth: 1,
      centre: { x: 0.5, y: 0, z: 0.5 },
    },
    summary: {
      containerCount: 0,
      componentGroupCount: 0,
      componentCount: components.length,
      contractConnectionCount: 0,
      directConnectionCount: 0,
      persistenceObjectCount: 0,
      readWriteConnectionCount: 0,
    },
  }
}

function navigationContext(
  overrides: Partial<ArchitectureNavigationContext> = {},
): ArchitectureNavigationContext {
  return {
    viewId: 'architecture_map',
    viewKind: 'architecture',
    label: 'Architecture Map',
    status: 'stale',
    reviewState: 'unreviewed',
    acceptedSignature: 'accepted',
    currentSignature: 'current',
    materialisedRef: 'refs/bitloops/architecture',
    updatedAt: '2026-05-10T00:00:00.000Z',
    changeCount: 1,
    changedPrimitiveIds: ['primitive:api'],
    changedPrimitives: [
      {
        primitiveId: 'primitive:api',
        primitiveKind: 'COMPONENT',
        label: 'API',
        path: 'src/api/main.ts',
        sourceKind: 'COMPUTED',
        changeKind: 'hash_changed',
        previousHash: 'old',
        currentHash: 'new',
        mappedComponentIds: [],
      },
    ],
    changedByPath: {
      'src/api/main.ts': ['primitive:api'],
    },
    changedByComponentId: {},
    acceptanceHistory: [],
    ...overrides,
  }
}

beforeEach(() => {
  mockRequestGraphQL.mockReset()
})

describe('architecture navigation context', () => {
  it('fetches and maps stale navigation context from GraphQL', async () => {
    mockRequestGraphQL.mockResolvedValue({
      data: {
        repo: {
          project: {
            navigationContext: {
              views: [
                {
                  viewId: 'architecture_map',
                  viewKind: 'architecture',
                  label: 'Architecture Map',
                  acceptedSignature: 'accepted',
                  currentSignature: 'current',
                  status: 'STALE',
                  staleReason: {
                    changeCount: 3,
                    changedPrimitives: [
                      {
                        primitiveId: 'primitive:api',
                        primitiveKind: 'COMPONENT',
                        label: '',
                        path: '',
                        sourceKind: 'COMPUTED',
                        changeKind: 'hash_changed',
                        previousHash: 'old',
                      },
                      {
                        primitiveId: 'primitive:worker',
                        changeKind: 'added',
                      },
                      null,
                    ],
                  },
                  materialisedRef: 'refs/bitloops/architecture',
                  updatedAt: '2026-05-10T00:00:00.000Z',
                  acceptanceHistory: [
                    {
                      acceptanceId: 'acceptance:one',
                      source: 'user',
                      reason: 'Reviewed',
                      materialisedRef: 'refs/bitloops/architecture',
                      acceptedAt: '2026-05-10T00:01:00.000Z',
                    },
                  ],
                },
              ],
              primitives: [
                {
                  id: 'primitive:api',
                  kind: 'COMPONENT',
                  label: 'API',
                  path: 'src/api/main.ts',
                  sourceKind: 'COMPUTED',
                  primitiveHash: 'new',
                },
                {
                  id: 'primitive:worker',
                  kind: 'COMPONENT',
                  label: 'Worker',
                  path: 'src/worker',
                  sourceKind: 'ASSERTED',
                  primitiveHash: 'worker-hash',
                },
              ],
            },
          },
        },
      },
    })

    const context = await fetchArchitectureNavigationContext({
      repo: 'bitloops',
      projectPath: '.',
    })

    expect(mockRequestGraphQL).toHaveBeenCalledWith(
      expect.stringContaining('ArchitectureNavigationContext'),
      {
        repo: 'bitloops',
        projectPath: '.',
        filter: {
          viewId: 'architecture_map',
        },
      },
      { signal: undefined },
    )
    expect(context).toMatchObject({
      status: 'stale',
      reviewState: 'accepted',
      changeCount: 3,
      changedPrimitiveIds: ['primitive:api', 'primitive:worker'],
      changedByPath: {
        'src/api/main.ts': ['primitive:api'],
        'src/worker': ['primitive:worker'],
      },
      acceptanceHistory: [
        {
          acceptanceId: 'acceptance:one',
          reason: 'Reviewed',
        },
      ],
    })
    expect(context?.changedPrimitives[0]).toMatchObject({
      primitiveId: 'primitive:api',
      label: 'API',
      path: 'src/api/main.ts',
      currentHash: 'new',
    })
  })

  it('maps changed primitives back to matching scene components', () => {
    const api = component({
      id: 'component:api',
      path: 'src/api',
      filePaths: ['src/api/main.ts'],
    })
    const worker = component({
      id: 'component:worker',
      label: 'Worker',
      path: 'src/worker/main.ts',
      filePaths: ['src/worker/main.ts'],
    })

    const mapped = mapNavigationContextToScene(
      navigationContext({
        changedPrimitives: [
          {
            primitiveId: 'primitive:api',
            primitiveKind: 'COMPONENT',
            label: 'API',
            path: 'src/api/main.ts',
            sourceKind: 'COMPUTED',
            changeKind: 'changed',
            previousHash: null,
            currentHash: 'new',
            mappedComponentIds: [],
          },
          {
            primitiveId: 'primitive:worker',
            primitiveKind: 'COMPONENT',
            label: 'Worker',
            path: 'src/worker',
            sourceKind: 'ASSERTED',
            changeKind: 'removed',
            previousHash: 'old',
            currentHash: null,
            mappedComponentIds: [],
          },
        ],
      }),
      sceneWithComponents([api, worker]),
    )

    expect(mapped?.changedByComponentId).toEqual({
      'component:api': ['primitive:api'],
      'component:worker': ['primitive:worker'],
    })
    expect(mapped?.changedPrimitives).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          primitiveId: 'primitive:api',
          mappedComponentIds: ['component:api'],
        }),
        expect.objectContaining({
          primitiveId: 'primitive:worker',
          mappedComponentIds: ['component:worker'],
        }),
      ]),
    )
  })

  it('returns null for absent or errored navigation context and rethrows aborts', async () => {
    mockRequestGraphQL.mockResolvedValueOnce({
      data: {
        repo: {
          project: {
            navigationContext: {
              views: [],
              primitives: [],
            },
          },
        },
      },
    })
    await expect(
      fetchArchitectureNavigationContext({
        repo: 'bitloops',
        projectPath: '.',
      }),
    ).resolves.toBeNull()

    mockRequestGraphQL.mockResolvedValueOnce({
      errors: [{ message: 'not available' }],
    })
    await expect(
      fetchArchitectureNavigationContext({
        repo: 'bitloops',
        projectPath: '.',
      }),
    ).resolves.toBeNull()

    mockRequestGraphQL.mockRejectedValueOnce(new Error('network'))
    await expect(
      fetchArchitectureNavigationContext({
        repo: 'bitloops',
        projectPath: '.',
      }),
    ).resolves.toBeNull()

    const abort = new Error('aborted')
    abort.name = 'AbortError'
    mockRequestGraphQL.mockRejectedValueOnce(abort)
    await expect(
      fetchArchitectureNavigationContext({
        repo: 'bitloops',
        projectPath: '.',
      }),
    ).rejects.toThrow('aborted')

    expect(
      mapNavigationContextToScene(null, sceneWithComponents([])),
    ).toBeNull()
  })
})
