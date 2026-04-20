import { useEffect, useRef, useState } from 'react'
import {
  fetchDashboardBranches,
  fetchDashboardRepositories,
} from '@/features/dashboard/graphql/fetch-dashboard-data'
import type { DashboardRepositoryOption } from '@/features/dashboard/api-types'
import {
  parseSessionsVariablesJson,
  resolveSessionsRepoId,
  setVariablesBranch,
  setVariablesRepoId,
} from '@/features/sessions/parse-sessions-variables'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

type SessionsRepoBranchFiltersProps = {
  value: string
  onChange: (value: string) => void
  /** Fires when the repo id used for dashboard API scope changes (valid id or Auto → first repo). */
  onResolvedRepoIdChange?: (repoId: string | null) => void
  className?: string
}

const repoAutoValue = '__repo_auto__'
const branchAutoValue = '__branch_auto__'

export function SessionsRepoBranchFilters({
  value,
  onChange,
  onResolvedRepoIdChange,
  className,
}: SessionsRepoBranchFiltersProps) {
  const [repoOptions, setRepoOptions] = useState<DashboardRepositoryOption[]>(
    [],
  )
  const [branchOptions, setBranchOptions] = useState<string[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const didSeedDefaultBranchRef = useRef(false)
  const lastRepoIdRef = useRef<string | null | undefined>(undefined)

  const parsed = parseSessionsVariablesJson(value)
  const effectiveRepoId = resolveSessionsRepoId(parsed.repoId, repoOptions)
  const firstRepoId = repoOptions[0]?.repoId ?? null
  const trimmedRepoId = parsed.repoId?.trim() ?? ''
  /** Stored id for the first repo — treat as Auto in the UI so GraphQL gets a concrete `repoId` (matches the Auto label). */
  const repoSelectValue =
    firstRepoId && trimmedRepoId === firstRepoId
      ? repoAutoValue
      : trimmedRepoId && repoOptions.some((r) => r.repoId === trimmedRepoId)
        ? trimmedRepoId
        : repoAutoValue

  useEffect(() => {
    let cancelled = false
    fetchDashboardRepositories()
      .then((repos) => {
        if (cancelled) return
        setRepoOptions(repos)
        setLoadError(null)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('Failed to load repositories', err)
        setRepoOptions([])
        setLoadError('Could not load repositories.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  /** Drop unknown repo ids (e.g. stale persisted JSON); fall back to first repo so variables stay valid. */
  useEffect(() => {
    if (repoOptions.length === 0) {
      return
    }
    const trimmed = parsed.repoId?.trim()
    if (!trimmed) {
      return
    }
    if (repoOptions.some((r) => r.repoId === trimmed)) {
      return
    }
    onChange(setVariablesRepoId(value, firstRepoId))
  }, [repoOptions, parsed.repoId, value, onChange, firstRepoId])

  /** When `repoId` is unset, pin it to the first loaded repo so `/devql/dashboard` scopes like the Auto label. */
  useEffect(() => {
    if (repoOptions.length === 0 || !firstRepoId) {
      return
    }
    if (parsed.repoId?.trim()) {
      return
    }
    onChange(setVariablesRepoId(value, firstRepoId))
  }, [repoOptions.length, firstRepoId, parsed.repoId, value, onChange])

  useEffect(() => {
    if (!effectiveRepoId) {
      setBranchOptions([])
      return
    }
    let cancelled = false
    fetchDashboardBranches({
      repoId: effectiveRepoId,
      from: null,
      to: null,
    })
      .then((branches) => {
        if (cancelled) return
        setBranchOptions(branches.map((b) => b.branch.trim()).filter(Boolean))
      })
      .catch((err: unknown) => {
        if (cancelled) return
        console.error('Failed to load branches', err)
        setBranchOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [effectiveRepoId])

  useEffect(() => {
    onResolvedRepoIdChange?.(effectiveRepoId)
  }, [effectiveRepoId, onResolvedRepoIdChange])

  useEffect(() => {
    if (lastRepoIdRef.current !== effectiveRepoId) {
      lastRepoIdRef.current = effectiveRepoId
      didSeedDefaultBranchRef.current = false
    }
  }, [effectiveRepoId])

  /** When variables have no `filter.branch`, set it to the first branch so `interactionSessions` is scoped like the dashboard. */
  useEffect(() => {
    if (didSeedDefaultBranchRef.current) return
    if (branchOptions.length === 0) return
    const p = parseSessionsVariablesJson(value)
    if (p.branch) {
      didSeedDefaultBranchRef.current = true
      return
    }
    const first = branchOptions[0]
    if (!first) return
    didSeedDefaultBranchRef.current = true
    onChange(setVariablesBranch(value, first))
  }, [branchOptions, value, onChange])

  const onRepoSelect = (v: string) => {
    const nextId = v === repoAutoValue ? firstRepoId : v
    onChange(setVariablesRepoId(value, nextId ?? null))
  }

  const onBranchSelect = (v: string) => {
    const nextBranch = v === branchAutoValue ? null : v
    onChange(setVariablesBranch(value, nextBranch))
  }

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-1.5',
        className,
      )}
      data-layout='sessions-filters'
    >
      <span className='sr-only'>Session query filters</span>
      {loadError && (
        <span className='text-[11px] text-destructive'>{loadError}</span>
      )}
      <div className='flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:gap-3'>
        <label className='flex min-w-[min(100%,12rem)] flex-1 items-center gap-1.5 sm:min-w-[14rem]'>
          <span className='w-9 shrink-0 text-[11px] text-muted-foreground'>
            Repo
          </span>
          <Select
            value={repoSelectValue}
            onValueChange={onRepoSelect}
            disabled={repoOptions.length === 0}
          >
            <SelectTrigger
              size='sm'
              className='min-w-0 flex-1 text-xs'
              data-testid='sessions-variables-repo'
            >
              <SelectValue placeholder='Repository' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={repoAutoValue}>
                {repoOptions[0]?.identity
                  ? `Auto (${repoOptions[0].identity})`
                  : 'Auto (first available)'}
              </SelectItem>
              {repoOptions.map((repo) => (
                <SelectItem key={repo.repoId} value={repo.repoId}>
                  {repo.identity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className='flex min-w-[min(100%,10rem)] flex-1 items-center gap-1.5 sm:min-w-[12rem]'>
          <span className='w-9 shrink-0 text-[11px] text-muted-foreground'>
            Branch
          </span>
          <Select
            value={
              parsed.branch && branchOptions.includes(parsed.branch)
                ? parsed.branch
                : branchAutoValue
            }
            onValueChange={onBranchSelect}
            disabled={!effectiveRepoId || branchOptions.length === 0}
          >
            <SelectTrigger
              size='sm'
              className='min-w-0 flex-1 text-xs'
              data-testid='sessions-variables-branch'
            >
              <SelectValue placeholder='Branch' />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={branchAutoValue}>
                {branchOptions[0]
                  ? `Auto (${branchOptions[0]})`
                  : 'Auto (first available)'}
              </SelectItem>
              {branchOptions.map((branch) => (
                <SelectItem key={branch} value={branch}>
                  {branch}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>
    </div>
  )
}
