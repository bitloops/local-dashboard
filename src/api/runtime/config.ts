import { GraphQLRequestError } from '@/api/graphql/errors'
import type {
  GraphQLRequestOptions,
  GraphQLResponseEnvelope,
} from '@/api/graphql/types'

const RUNTIME_GRAPHQL_ENDPOINT = '/devql/runtime'

function resolveEndpoint(path: string): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return new URL(path, window.location.origin).toString()
  }

  return path
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === 'AbortError') ||
    (error instanceof Error && error.name === 'AbortError')
  )
}

async function requestRuntimeGraphQL<
  TData,
  TVariables = Record<string, unknown>,
>(
  query: string,
  variables?: TVariables,
  options?: GraphQLRequestOptions,
): Promise<GraphQLResponseEnvelope<TData>> {
  const response = await fetch(resolveEndpoint(RUNTIME_GRAPHQL_ENDPOINT), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: variables ?? {},
    }),
    signal: options?.signal,
  })

  let payload: GraphQLResponseEnvelope<TData> | undefined
  try {
    payload = (await response.json()) as GraphQLResponseEnvelope<TData>
  } catch (error) {
    if (isAbortError(error)) {
      throw error
    }
    throw new GraphQLRequestError('Invalid runtime GraphQL response payload.', {
      status: response.status,
    })
  }

  if (!response.ok) {
    const firstError = payload.errors?.[0]?.message
    throw new GraphQLRequestError(
      firstError ?? `Request failed (${response.status}).`,
      {
        status: response.status,
        graphQLErrors: payload.errors,
      },
    )
  }

  if (payload.errors?.length) {
    throw new GraphQLRequestError(payload.errors[0].message, {
      status: response.status,
      graphQLErrors: payload.errors,
    })
  }

  return payload
}

export type RuntimeConfigTarget = {
  id: string
  kind: string
  scope: string
  label: string
  group: string
  path: string
  repoRoot: string | null
  exists: boolean
}

export type RuntimeConfigField = {
  key: string
  path: string[]
  label: string
  description: string
  fieldType: string
  value: unknown
  effectiveValue: unknown | null
  defaultValue: unknown | null
  allowedValues: string[]
  validationHints: string[]
  required: boolean
  readOnly: boolean
  secret: boolean
  order: number
  source: string | null
}

export type RuntimeConfigSection = {
  key: string
  title: string
  description: string
  order: number
  advanced: boolean
  fields: RuntimeConfigField[]
  value: unknown
  effectiveValue: unknown | null
}

export type RuntimeConfigSnapshot = {
  target: RuntimeConfigTarget
  revision: string
  valid: boolean
  validationErrors: string[]
  restartRequired: boolean
  reloadRequired: boolean
  sections: RuntimeConfigSection[]
  rawValue: unknown
  effectiveValue: unknown | null
}

export type RuntimeConfigFieldPatch = {
  path: string[]
  value: unknown
}

export type UpdateRuntimeConfigInput = {
  targetId: string
  expectedRevision: string
  patches: RuntimeConfigFieldPatch[]
}

const CONFIG_TARGETS_QUERY = `
  query RuntimeConfigTargets {
    configTargets {
      id
      kind
      scope
      label
      group
      path
      repoRoot
      exists
    }
  }
`

const CONFIG_SNAPSHOT_QUERY = `
  query RuntimeConfigSnapshot($targetId: ID!) {
    configSnapshot(targetId: $targetId) {
      target {
        id
        kind
        scope
        label
        group
        path
        repoRoot
        exists
      }
      revision
      valid
      validationErrors
      restartRequired
      reloadRequired
      rawValue
      effectiveValue
      sections {
        key
        title
        description
        order
        advanced
        value
        effectiveValue
        fields {
          key
          path
          label
          description
          fieldType
          value
          effectiveValue
          defaultValue
          allowedValues
          validationHints
          required
          readOnly
          secret
          order
          source
        }
      }
    }
  }
`

const UPDATE_CONFIG_MUTATION = `
  mutation UpdateRuntimeConfig($input: UpdateRuntimeConfigInput!) {
    updateConfig(input: $input) {
      restartRequired
      reloadRequired
      path
      message
      snapshot {
        target {
          id
          kind
          scope
          label
          group
          path
          repoRoot
          exists
        }
        revision
        valid
        validationErrors
        restartRequired
        reloadRequired
        rawValue
        effectiveValue
        sections {
          key
          title
          description
          order
          advanced
          value
          effectiveValue
          fields {
            key
            path
            label
            description
            fieldType
            value
          effectiveValue
          defaultValue
          allowedValues
          validationHints
          required
          readOnly
          secret
            order
            source
          }
        }
      }
    }
  }
`

export async function fetchRuntimeConfigTargets(
  options?: GraphQLRequestOptions,
): Promise<RuntimeConfigTarget[]> {
  const response = await requestRuntimeGraphQL<{
    configTargets: RuntimeConfigTarget[]
  }>(CONFIG_TARGETS_QUERY, undefined, options)

  return response.data?.configTargets ?? []
}

export async function fetchRuntimeConfigSnapshot(
  targetId: string,
  options?: GraphQLRequestOptions,
): Promise<RuntimeConfigSnapshot> {
  const response = await requestRuntimeGraphQL<{
    configSnapshot: RuntimeConfigSnapshot
  }>(CONFIG_SNAPSHOT_QUERY, { targetId }, options)

  if (!response.data?.configSnapshot) {
    throw new GraphQLRequestError('Runtime config snapshot was empty.')
  }

  return response.data.configSnapshot
}

export async function updateRuntimeConfig(
  input: UpdateRuntimeConfigInput,
  options?: GraphQLRequestOptions,
): Promise<RuntimeConfigSnapshot> {
  const response = await requestRuntimeGraphQL<{
    updateConfig: {
      snapshot: RuntimeConfigSnapshot
    }
  }>(UPDATE_CONFIG_MUTATION, { input }, options)

  if (!response.data?.updateConfig?.snapshot) {
    throw new GraphQLRequestError('Runtime config update returned no snapshot.')
  }

  return response.data.updateConfig.snapshot
}
