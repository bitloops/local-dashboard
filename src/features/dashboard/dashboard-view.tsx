import { useState } from 'react'
import { Gauge, GitBranch, Bookmark, Bot } from 'lucide-react'
import {
  type ApiCheckpointDetailResponse,
  type ApiCheckpointSessionDetailDto,
} from '@/api/types/schema'
import { DatePicker } from '@/components/date-picker'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { CommitCheckpointChart } from './components/session-activity-chart'
import { CommitTable } from './components/sessions-table'
import { type Checkpoint, type CommitData } from './data/mock-commit-data'

const branchAutoValue = '__auto_branch__'
const allFilterValue = '__all__'
const minDate = new Date('1900-01-01')

export type LoadState = 'loading' | 'api' | 'error'
export type CheckpointDetailLoadState = 'idle' | 'loading' | 'api' | 'error'
export type UserOption = {
  label: string
  value: string
}

type DashboardViewProps = {
  rows: CommitData[]
  branchOptions: string[]
  userOptions: UserOption[]
  agentOptions: string[]
  selectedBranch: string | null
  selectedUser: string | null
  selectedAgent: string | null
  fromDate: Date | undefined
  toDate: Date | undefined
  effectiveBranch: string | null
  dataSource: LoadState
  optionsSource: LoadState
  selectedCheckpoint: Checkpoint | null
  checkpointDetail: ApiCheckpointDetailResponse | null
  checkpointDetailSource: CheckpointDetailLoadState
  onBranchChange: (value: string | null) => void
  onUserChange: (value: string | null) => void
  onAgentChange: (value: string | null) => void
  onFromDateChange: (value: Date | undefined) => void
  onToDateChange: (value: Date | undefined) => void
  onClearFilters: () => void
  onCheckpointSelect: (checkpoint: Checkpoint) => void
  onCheckpointClose: () => void
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex items-start justify-between gap-4 py-2 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='text-right font-mono text-xs'>{value}</span>
    </div>
  )
}

const formatDateTime = (value: string): string => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }
  return date.toLocaleString()
}

const stringifyMaybeJson = (value: string): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    return '-'
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    return JSON.stringify(parsed, null, 2)
  } catch {
    return value
  }
}

type ChatEntry = {
  role: string
  content: string
}

const parseTranscriptEntries = (jsonl: string): ChatEntry[] => {
  const lines = jsonl
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  return lines.map((line, index) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      const role =
        typeof parsed.role === 'string'
          ? parsed.role
          : typeof parsed.type === 'string'
            ? parsed.type
            : `entry-${index + 1}`

      const contentCandidate =
        parsed.content ?? parsed.text ?? parsed.message ?? parsed.delta ?? parsed
      const content =
        typeof contentCandidate === 'string'
          ? contentCandidate
          : JSON.stringify(contentCandidate, null, 2)

      return {
        role,
        content,
      }
    } catch {
      return {
        role: `line-${index + 1}`,
        content: line,
      }
    }
  })
}

export function DashboardView({
  rows,
  branchOptions,
  userOptions,
  agentOptions,
  selectedBranch,
  selectedUser,
  selectedAgent,
  fromDate,
  toDate,
  effectiveBranch,
  dataSource,
  optionsSource,
  selectedCheckpoint,
  checkpointDetail,
  checkpointDetailSource,
  onBranchChange,
  onUserChange,
  onAgentChange,
  onFromDateChange,
  onToDateChange,
  onClearFilters,
  onCheckpointSelect,
  onCheckpointClose,
}: DashboardViewProps) {
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)

  const hasActiveFilters =
    Boolean(selectedBranch) ||
    Boolean(selectedUser) ||
    Boolean(selectedAgent) ||
    Boolean(fromDate) ||
    Boolean(toDate)

  const totalCommits = rows.length
  const totalCheckpoints = rows.reduce((sum, row) => sum + row.checkpoints, 0)
  const totalAgents = new Set(rows.map((row) => row.agent)).size
  const activeBranches = effectiveBranch ? 1 : 0

  const selectedCheckpointCreatedAt = selectedCheckpoint?.createdAt
    ? new Date(selectedCheckpoint.createdAt).toLocaleString()
    : null

  const detailFilesTouched =
    checkpointDetail?.files_touched ?? selectedCheckpoint?.filesTouched ?? []
  const detailSessionCount =
    checkpointDetail?.session_count ?? selectedCheckpoint?.sessionCount ?? 0
  const detailCheckpointsCount =
    checkpointDetail?.checkpoints_count ?? selectedCheckpoint?.checkpointsCount ?? 0
  const detailStrategy =
    checkpointDetail?.strategy ?? selectedCheckpoint?.strategy ?? '-'
  const detailBranch = checkpointDetail?.branch ?? selectedCheckpoint?.branch ?? '-'
  const detailTokenUsage = checkpointDetail?.token_usage
  const detailSessions = checkpointDetail?.sessions ?? []

  return (
    <>
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
        </div>
      </Header>

      <Main>
        <div className='mb-2 flex items-center justify-between'>
          <h1 className='text-2xl font-bold tracking-tight'>Dashboard</h1>
        </div>

        {dataSource === 'error' && (
          <p className='mb-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground'>
            Could not load dashboard data from the API.
          </p>
        )}
        {optionsSource === 'error' && (
          <p className='mb-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground'>
            Could not load branch/user/agent filter options from the API.
          </p>
        )}
        {!effectiveBranch && optionsSource !== 'loading' && (
          <p className='mb-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground'>
            No branches are currently available from the API.
          </p>
        )}

        <Card className='mb-4'>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>Filters</CardTitle>
            <CardDescription>
              Filter commits by branch, user, agent, and date range.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>Branch</p>
                <Select
                  value={selectedBranch ?? branchAutoValue}
                  onValueChange={(value) =>
                    onBranchChange(value === branchAutoValue ? null : value)
                  }
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='Select branch' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={branchAutoValue}>
                      {effectiveBranch
                        ? `Auto (${effectiveBranch})`
                        : 'Auto (first available)'}
                    </SelectItem>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>User</p>
                <Select
                  value={selectedUser ?? allFilterValue}
                  onValueChange={(value) =>
                    onUserChange(value === allFilterValue ? null : value)
                  }
                  disabled={!effectiveBranch}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='All users' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allFilterValue}>All users</SelectItem>
                    {userOptions.map((user) => (
                      <SelectItem key={user.value} value={user.value}>
                        {user.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>Agent</p>
                <Select
                  value={selectedAgent ?? allFilterValue}
                  onValueChange={(value) =>
                    onAgentChange(value === allFilterValue ? null : value)
                  }
                  disabled={!effectiveBranch}
                >
                  <SelectTrigger className='w-full'>
                    <SelectValue placeholder='All agents' />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={allFilterValue}>All agents</SelectItem>
                    {agentOptions.map((agent) => (
                      <SelectItem key={agent} value={agent}>
                        {agent}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>From</p>
                <DatePicker
                  selected={fromDate}
                  onSelect={onFromDateChange}
                  placeholder='Start date'
                  className='w-full'
                  disabled={(date) =>
                    date < minDate ||
                    date > new Date() ||
                    Boolean(toDate && date > toDate)
                  }
                />
              </div>

              <div className='space-y-1'>
                <p className='text-xs text-muted-foreground'>To</p>
                <DatePicker
                  selected={toDate}
                  onSelect={onToDateChange}
                  placeholder='End date'
                  className='w-full'
                  disabled={(date) =>
                    date < minDate ||
                    date > new Date() ||
                    Boolean(fromDate && date < fromDate)
                  }
                />
              </div>
            </div>

            <div className='mt-3 flex justify-end'>
              <Button
                variant='outline'
                size='sm'
                onClick={onClearFilters}
                disabled={!hasActiveFilters}
              >
                Clear filters
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Throughput</CardTitle>
              <Gauge className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{totalCommits} commits</div>
              <p className='text-xs text-muted-foreground'>
                For current filters
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Checkpoints</CardTitle>
              <Bookmark className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{totalCheckpoints}</div>
              <p className='text-xs text-muted-foreground'>
                Across visible commits
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Agents</CardTitle>
              <Bot className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{totalAgents}</div>
              <p className='text-xs text-muted-foreground'>
                In visible commits
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Active Branches
              </CardTitle>
              <GitBranch className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{activeBranches}</div>
              <p className='text-xs text-muted-foreground'>
                Matching current range
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className='mt-4'>
          <CardHeader>
            <CardTitle>Commits &amp; Checkpoints</CardTitle>
            <CardDescription>
              Checkpoints per commit over time. Click a point to inspect
              {selectedCommit && (
                <span className='ms-2 font-mono text-xs text-primary'>
                  Selected: {selectedCommit}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className='px-6'>
            <CommitCheckpointChart
              data={rows}
              onCommitClick={setSelectedCommit}
            />
          </CardContent>
        </Card>

        <div className='mt-6'>
          <h2 className='mb-4 text-lg font-semibold tracking-tight'>
            Recent Commits
          </h2>
          <CommitTable data={rows} onCheckpointClick={onCheckpointSelect} />
        </div>
      </Main>

      <Sheet
        open={Boolean(selectedCheckpoint)}
        onOpenChange={(open) => {
          if (!open) {
            onCheckpointClose()
          }
        }}
      >
        <SheetContent side='right' className='w-full p-0 sm:max-w-md'>
          <SheetHeader className='border-b pb-4 text-start'>
            <SheetTitle>
              {selectedCheckpoint
                ? `Checkpoint ${selectedCheckpoint.id}`
                : 'Checkpoint'}
            </SheetTitle>
            <SheetDescription>
              {selectedCheckpoint?.prompt ?? 'Checkpoint details'}
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className='h-[calc(100%-88px)]'>
            <div className='space-y-5 p-4'>
              {selectedCheckpoint && (
                <>
                  <div className='space-y-3'>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline'>
                        {selectedCheckpoint.isTask ? 'Task' : 'Prompt'}
                      </Badge>
                      {selectedCheckpoint.agent && (
                        <Badge variant='secondary'>{selectedCheckpoint.agent}</Badge>
                      )}
                      {detailBranch !== '-' && (
                        <Badge variant='secondary'>branch:{detailBranch}</Badge>
                      )}
                    </div>
                    <p className='rounded-md border bg-muted/30 p-3 text-sm'>
                      {selectedCheckpoint.prompt}
                    </p>
                  </div>

                  <Separator />

                  <div>
                    <h3 className='mb-2 text-sm font-semibold'>Metadata</h3>
                    <DetailRow label='Created' value={selectedCheckpoint.timestamp} />
                    {selectedCheckpointCreatedAt && (
                      <DetailRow label='Created At' value={selectedCheckpointCreatedAt} />
                    )}
                    <DetailRow
                      label='Session ID'
                      value={selectedCheckpoint.sessionId ?? '-'}
                    />
                    <DetailRow label='Strategy' value={detailStrategy} />
                    <DetailRow
                      label='Tool Use ID'
                      value={selectedCheckpoint.toolUseId ?? '-'}
                    />
                    <DetailRow label='Commit' value={selectedCheckpoint.commit ?? '-'} />
                    <DetailRow label='Sessions' value={String(detailSessionCount)} />
                    <DetailRow
                      label='Checkpoints'
                      value={String(detailCheckpointsCount)}
                    />
                  </div>

                  {detailTokenUsage && (
                    <>
                      <Separator />
                      <div>
                        <h3 className='mb-2 text-sm font-semibold'>Token Usage</h3>
                        <DetailRow
                          label='Input'
                          value={String(detailTokenUsage.input_tokens)}
                        />
                        <DetailRow
                          label='Output'
                          value={String(detailTokenUsage.output_tokens)}
                        />
                        <DetailRow
                          label='Cache Read'
                          value={String(detailTokenUsage.cache_read_tokens)}
                        />
                        <DetailRow
                          label='Cache Create'
                          value={String(detailTokenUsage.cache_creation_tokens)}
                        />
                        <DetailRow
                          label='API Calls'
                          value={String(detailTokenUsage.api_call_count)}
                        />
                      </div>
                    </>
                  )}

                  {selectedCheckpoint.commitMessage && (
                    <>
                      <Separator />
                      <div>
                        <h3 className='mb-2 text-sm font-semibold'>Commit Message</h3>
                        <p className='rounded-md border bg-muted/30 p-3 text-sm'>
                          {selectedCheckpoint.commitMessage}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div>
                    <h3 className='mb-2 text-sm font-semibold'>Files Touched</h3>
                    {detailFilesTouched.length > 0 ? (
                      <div className='flex flex-wrap gap-2'>
                        {detailFilesTouched.map((filePath) => (
                          <Badge key={filePath} variant='outline'>
                            {filePath}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className='text-sm text-muted-foreground'>
                        No file information for this checkpoint.
                      </p>
                    )}
                  </div>

                  <Separator />

                  <div>
                    <h3 className='mb-2 text-sm font-semibold'>Chat Sessions</h3>
                    {checkpointDetailSource === 'loading' && (
                      <p className='text-sm text-muted-foreground'>
                        Loading chat data for this checkpoint...
                      </p>
                    )}
                    {checkpointDetailSource === 'error' && (
                      <p className='text-sm text-muted-foreground'>
                        Could not load chat data from `/api/checkpoint`.
                      </p>
                    )}
                    {checkpointDetailSource !== 'loading' &&
                      checkpointDetailSource !== 'error' &&
                      detailSessions.length === 0 && (
                        <p className='text-sm text-muted-foreground'>
                          No chat sessions were returned for this checkpoint.
                        </p>
                      )}

                    {detailSessions.length > 0 && (
                      <div className='space-y-3'>
                        {detailSessions.map(
                          (session: ApiCheckpointSessionDetailDto) => {
                            const transcriptEntries = parseTranscriptEntries(
                              session.transcript_jsonl
                            )

                            return (
                              <Card
                                key={`${session.session_id}-${session.session_index}`}
                                className='bg-muted/20'
                              >
                                <CardHeader className='pb-2'>
                                  <CardTitle className='text-sm'>
                                    Session {session.session_index + 1}
                                  </CardTitle>
                                  <CardDescription className='font-mono text-xs'>
                                    {session.session_id}
                                  </CardDescription>
                                </CardHeader>
                                <CardContent className='space-y-3'>
                                  <div className='flex flex-wrap gap-2'>
                                    <Badge variant='secondary'>{session.agent}</Badge>
                                    <Badge variant='outline'>
                                      {session.is_task ? 'Task' : 'Prompt'}
                                    </Badge>
                                    <Badge variant='outline'>
                                      {formatDateTime(session.created_at)}
                                    </Badge>
                                  </div>

                                  <div className='space-y-1'>
                                    <p className='text-xs text-muted-foreground'>
                                      Prompt(s)
                                    </p>
                                    <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                      {session.prompts_text || '-'}
                                    </pre>
                                  </div>

                                  <div className='space-y-1'>
                                    <p className='text-xs text-muted-foreground'>
                                      Context
                                    </p>
                                    <pre className='max-h-40 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                      {session.context_text || '-'}
                                    </pre>
                                  </div>

                                  <div className='space-y-1'>
                                    <p className='text-xs text-muted-foreground'>
                                      Metadata JSON
                                    </p>
                                    <pre className='max-h-36 overflow-auto rounded-md border bg-background p-2 text-xs whitespace-pre-wrap break-words'>
                                      {stringifyMaybeJson(session.metadata_json)}
                                    </pre>
                                  </div>

                                  <div className='space-y-2'>
                                    <p className='text-xs text-muted-foreground'>
                                      Transcript
                                    </p>
                                    {transcriptEntries.length > 0 ? (
                                      <div className='space-y-2'>
                                        {transcriptEntries.map((entry, entryIndex) => (
                                          <div
                                            key={`${session.session_id}-${entryIndex}`}
                                            className='rounded-md border bg-background p-2'
                                          >
                                            <div className='mb-1 flex items-center gap-2'>
                                              <Badge variant='outline'>
                                                {entry.role}
                                              </Badge>
                                              <span className='text-[11px] text-muted-foreground'>
                                                #{entryIndex + 1}
                                              </span>
                                            </div>
                                            <pre className='text-xs whitespace-pre-wrap break-words'>
                                              {entry.content}
                                            </pre>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className='text-sm text-muted-foreground'>
                                        No transcript entries available.
                                      </p>
                                    )}
                                  </div>
                                </CardContent>
                              </Card>
                            )
                          }
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  )
}
