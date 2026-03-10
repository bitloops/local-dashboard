import { lazy, Suspense, useState } from 'react'
import { Gauge, GitBranch, Bookmark, Bot } from 'lucide-react'
import { type ApiCheckpointDetailResponse } from '@/api/types/schema'
import { DatePicker } from '@/components/date-picker'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sidebar, SidebarRail } from '@/components/ui/sidebar'
import { useSidebar } from '@/components/ui/use-sidebar'
import { CheckpointDetailContent } from './components/checkpoint-sheet'
import { CommitTable } from './components/commits-table'
import { type Checkpoint, type CommitData } from './data/mock-commit-data'
import { formatAgentLabel } from './utils'

const CommitCheckpointChart = lazy(() =>
  import('./components/session-activity-chart').then((m) => ({
    default: m.CommitCheckpointChart,
  })),
)

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
  const { setOpen, setRightOpen } = useSidebar()

  const handleCheckpointSelect = (checkpoint: Checkpoint) => {
    onCheckpointSelect(checkpoint)
    setOpen(false)
    setRightOpen(true)
  }

  const hasActiveFilters =
    Boolean(selectedBranch) ||
    Boolean(selectedUser) ||
    Boolean(selectedAgent) ||
    Boolean(fromDate) ||
    Boolean(toDate)

  const userName = selectedUser
    ? (userOptions.find((u) => u.value === selectedUser)?.label ?? 'You')
    : (userOptions[0]?.label ?? 'You')

  const totalCommits = rows.length
  const totalCheckpoints = rows.reduce((sum, row) => sum + row.checkpoints, 0)
  const totalAgents = new Set(rows.map((row) => row.agent)).size
  const activeBranches = effectiveBranch ? 1 : 0

  return (
    <>
      <Header className='pe-8'>
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
                        {formatAgentLabel(agent)}
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
          {[
            {
              title: 'Throughput',
              icon: Gauge,
              value: `${totalCommits} commits`,
              description: 'For current filters',
            },
            {
              title: 'Checkpoints',
              icon: Bookmark,
              value: String(totalCheckpoints),
              description: 'Across visible commits',
            },
            {
              title: 'Agents',
              icon: Bot,
              value: String(totalAgents),
              description: 'In visible commits',
            },
            {
              title: 'Active Branches',
              icon: GitBranch,
              value: String(activeBranches),
              description: 'Matching current range',
            },
          ].map((stat) => (
            <Card key={stat.title}>
              <CardHeader className='flex items-center justify-between space-y-0 pb-2'>
                <CardTitle className='text-sm font-medium'>
                  {stat.title}
                </CardTitle>
                <stat.icon className='h-4 w-4 text-muted-foreground' />
              </CardHeader>
              <CardContent>
                <div className='text-2xl font-bold'>{stat.value}</div>
                <p className='text-xs text-muted-foreground'>
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          ))}
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
            <Suspense
              fallback={
                <div className='h-[350px] animate-pulse rounded-md bg-muted/30' />
              }
            >
              <CommitCheckpointChart
                data={rows}
                onCommitClick={setSelectedCommit}
              />
            </Suspense>
          </CardContent>
        </Card>

        <div className='mt-6'>
          <h2 className='mb-4 text-lg font-semibold tracking-tight'>
            Recent Commits
          </h2>
          <CommitTable data={rows} onCheckpointClick={handleCheckpointSelect} />
        </div>
      </Main>

      <Sidebar
        side='right'
        collapsible='offcanvas'
        resizable
        defaultWidth={600}
        minWidth={480}
        maxWidth={700}
      >
        <SidebarRail side='right' />
        <CheckpointDetailContent
          selectedCheckpoint={selectedCheckpoint}
          checkpointDetail={checkpointDetail}
          checkpointDetailSource={checkpointDetailSource}
          userName={userName}
          onClose={() => {
            setRightOpen(false)
            onCheckpointClose()
          }}
        />
      </Sidebar>
    </>
  )
}
