import { useState } from 'react'
import {
  Gauge,
  GitBranch,
  Bookmark,
  Bot,
} from 'lucide-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ThemeSwitch } from '@/components/theme-switch'
import { CommitCheckpointChart, commitData } from './components/session-activity-chart'
import { CommitTable } from './components/sessions-table'

export function Dashboard() {
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)

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

        {/* KPI Cards */}
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Throughput
              </CardTitle>
              <Gauge className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>47 commits</div>
              <p className='text-xs text-muted-foreground'>
                +12% from last week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Checkpoints
              </CardTitle>
              <Bookmark className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>342</div>
              <p className='text-xs text-muted-foreground'>
                +48 from last week
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>
                Agents
              </CardTitle>
              <Bot className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>3</div>
              <p className='text-xs text-muted-foreground'>
                Claude Code, Gemini CLI, OpenCode
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
              <div className='text-2xl font-bold'>5</div>
              <p className='text-xs text-muted-foreground'>
                2 with active sessions
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Commit / Checkpoint Chart */}
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
            <CommitCheckpointChart onCommitClick={setSelectedCommit} />
          </CardContent>
        </Card>

        {/* Commits Table */}
        <div className='mt-6'>
          <h2 className='mb-4 text-lg font-semibold tracking-tight'>
            Recent Commits
          </h2>
          <CommitTable data={commitData} />
        </div>
      </Main>
    </>
  )
}
