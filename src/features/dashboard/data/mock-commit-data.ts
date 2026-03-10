export type FileChangeStats = { additionsCount: number; deletionsCount: number }
export type FilesTouchedMap = Record<string, FileChangeStats>

export type Checkpoint = {
  id: string
  prompt: string
  timestamp: string
  createdAt?: string
  branch?: string
  agent?: string
  strategy?: string
  sessionId?: string
  toolUseId?: string
  filesTouched?: FilesTouchedMap
  sessionCount?: number
  checkpointsCount?: number
  isTask?: boolean
  commit?: string
  commitMessage?: string
}

export type CommitData = {
  date: string
  commit: string
  checkpoints: number
  message: string
  agent: string
  checkpointList: Checkpoint[]
}

export const commitData: CommitData[] = [
  {
    date: 'Feb 14',
    commit: 'a3f1c2d',
    checkpoints: 4,
    message: 'feat: add dashboard layout scaffold',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-01',
        prompt: 'Create the basic layout with sidebar and header',
        timestamp: '10:12 AM',
      },
      {
        id: 'cp-02',
        prompt: 'Add responsive breakpoints for mobile',
        timestamp: '10:28 AM',
      },
      {
        id: 'cp-03',
        prompt: 'Wire up the theme provider',
        timestamp: '10:45 AM',
      },
      {
        id: 'cp-04',
        prompt: 'Fix sidebar collapse animation',
        timestamp: '11:03 AM',
      },
    ],
  },
  {
    date: 'Feb 15',
    commit: 'b7e9a01',
    checkpoints: 7,
    message: 'fix: resolve auth token refresh loop',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-05',
        prompt: 'Investigate the infinite refresh issue',
        timestamp: '09:15 AM',
      },
      {
        id: 'cp-06',
        prompt: 'Add token expiry check before refresh',
        timestamp: '09:32 AM',
      },
      {
        id: 'cp-07',
        prompt: 'Handle 401 responses in query cache',
        timestamp: '09:48 AM',
      },
      {
        id: 'cp-08',
        prompt: 'Add retry backoff for failed refreshes',
        timestamp: '10:05 AM',
      },
      {
        id: 'cp-09',
        prompt: 'Write unit test for token refresh',
        timestamp: '10:22 AM',
      },
      {
        id: 'cp-10',
        prompt: 'Fix race condition in concurrent requests',
        timestamp: '10:40 AM',
      },
      { id: 'cp-11', prompt: 'Clean up error handling', timestamp: '10:55 AM' },
    ],
  },
  {
    date: 'Feb 16',
    commit: 'c4d2f88',
    checkpoints: 2,
    message: 'chore: update dependencies to latest',
    agent: 'gemini-cli',
    checkpointList: [
      {
        id: 'cp-12',
        prompt: 'Update all packages to latest versions',
        timestamp: '02:10 PM',
      },
      {
        id: 'cp-13',
        prompt: 'Fix breaking changes from React 19 update',
        timestamp: '02:35 PM',
      },
    ],
  },
  {
    date: 'Feb 17',
    commit: 'e1b3a55',
    checkpoints: 9,
    message: 'feat: implement session tracking hooks',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-14',
        prompt: 'Design the hook lifecycle events',
        timestamp: '08:30 AM',
      },
      {
        id: 'cp-15',
        prompt: 'Implement session start hook',
        timestamp: '08:52 AM',
      },
      {
        id: 'cp-16',
        prompt: 'Implement prompt submit hook',
        timestamp: '09:10 AM',
      },
      {
        id: 'cp-17',
        prompt: 'Implement session stop hook',
        timestamp: '09:28 AM',
      },
      {
        id: 'cp-18',
        prompt: 'Add pre-tool-use hook for subagents',
        timestamp: '09:45 AM',
      },
      { id: 'cp-19', prompt: 'Add post-tool-use hook', timestamp: '10:02 AM' },
      {
        id: 'cp-20',
        prompt: 'Handle hook registration in settings.json',
        timestamp: '10:20 AM',
      },
      {
        id: 'cp-21',
        prompt: 'Add error handling for failed hooks',
        timestamp: '10:38 AM',
      },
      {
        id: 'cp-22',
        prompt: 'Test hooks with Claude Code integration',
        timestamp: '10:55 AM',
      },
    ],
  },
  {
    date: 'Feb 18',
    commit: '0a2b4c6',
    checkpoints: 11,
    message: 'feat: add checkpoint metadata storage',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-23',
        prompt: 'Define metadata schema for checkpoints',
        timestamp: '09:00 AM',
      },
      {
        id: 'cp-24',
        prompt: 'Create .bitloops/metadata directory structure',
        timestamp: '09:15 AM',
      },
      {
        id: 'cp-25',
        prompt: 'Implement transcript file writer',
        timestamp: '09:30 AM',
      },
      {
        id: 'cp-26',
        prompt: 'Store prompt text on each checkpoint',
        timestamp: '09:48 AM',
      },
      {
        id: 'cp-27',
        prompt: 'Generate summary from transcript',
        timestamp: '10:05 AM',
      },
      {
        id: 'cp-28',
        prompt: 'Save context markdown file',
        timestamp: '10:22 AM',
      },
      {
        id: 'cp-29',
        prompt: 'Link checkpoints to session IDs',
        timestamp: '10:40 AM',
      },
      {
        id: 'cp-30',
        prompt: 'Handle concurrent session writes safely',
        timestamp: '10:58 AM',
      },
      {
        id: 'cp-31',
        prompt: 'Add gitignore rules for metadata',
        timestamp: '11:12 AM',
      },
      {
        id: 'cp-32',
        prompt: 'Validate metadata integrity on read',
        timestamp: '11:30 AM',
      },
      {
        id: 'cp-33',
        prompt: 'Clean up temp files after checkpoint',
        timestamp: '11:45 AM',
      },
    ],
  },
  {
    date: 'Feb 19',
    commit: '1d3e5f7',
    checkpoints: 5,
    message: 'refactor: extract git operations module',
    agent: 'open-code',
    checkpointList: [
      {
        id: 'cp-34',
        prompt: 'Move git functions to dedicated module',
        timestamp: '01:00 PM',
      },
      {
        id: 'cp-35',
        prompt: 'Add branch creation and switching helpers',
        timestamp: '01:20 PM',
      },
      {
        id: 'cp-36',
        prompt: 'Implement shadow branch management',
        timestamp: '01:42 PM',
      },
      {
        id: 'cp-37',
        prompt: 'Add commit and diff utilities',
        timestamp: '02:00 PM',
      },
      {
        id: 'cp-38',
        prompt: 'Write tests for git operations',
        timestamp: '02:18 PM',
      },
    ],
  },
  {
    date: 'Feb 20',
    commit: '3c5d7e9',
    checkpoints: 6,
    message: 'fix: shadow branch cleanup on reset',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-39',
        prompt: 'Debug orphaned shadow branches',
        timestamp: '11:00 AM',
      },
      {
        id: 'cp-40',
        prompt: 'List all bitloops/* branches safely',
        timestamp: '11:18 AM',
      },
      {
        id: 'cp-41',
        prompt: 'Delete branches matching stale sessions',
        timestamp: '11:35 AM',
      },
      {
        id: 'cp-42',
        prompt: 'Skip branches with active sessions',
        timestamp: '11:52 AM',
      },
      {
        id: 'cp-43',
        prompt: 'Add dry-run mode for clean command',
        timestamp: '12:10 PM',
      },
      {
        id: 'cp-44',
        prompt: 'Test reset with concurrent sessions',
        timestamp: '12:28 PM',
      },
    ],
  },
  {
    date: 'Feb 21',
    commit: '4e6f8a0',
    checkpoints: 14,
    message: 'feat: add commit attribution trailers',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-45',
        prompt: 'Research git trailer format standards',
        timestamp: '08:00 AM',
      },
      {
        id: 'cp-46',
        prompt: 'Define Bitloops trailer keys',
        timestamp: '08:15 AM',
      },
      {
        id: 'cp-47',
        prompt: 'Parse existing commit messages for trailers',
        timestamp: '08:32 AM',
      },
      {
        id: 'cp-48',
        prompt: 'Append session ID trailer to commits',
        timestamp: '08:50 AM',
      },
      {
        id: 'cp-49',
        prompt: 'Append agent name trailer',
        timestamp: '09:05 AM',
      },
      { id: 'cp-50', prompt: 'Append strategy trailer', timestamp: '09:20 AM' },
      {
        id: 'cp-51',
        prompt: 'Handle multi-line commit messages',
        timestamp: '09:38 AM',
      },
      {
        id: 'cp-52',
        prompt: 'Preserve user trailers when appending',
        timestamp: '09:55 AM',
      },
      {
        id: 'cp-53',
        prompt: 'Add trailer extraction for explain cmd',
        timestamp: '10:12 AM',
      },
      {
        id: 'cp-54',
        prompt: 'Handle amend commits with trailers',
        timestamp: '10:30 AM',
      },
      {
        id: 'cp-55',
        prompt: 'Strip trailers in clean display mode',
        timestamp: '10:48 AM',
      },
      {
        id: 'cp-56',
        prompt: 'Add redaction for sensitive trailers',
        timestamp: '11:05 AM',
      },
      {
        id: 'cp-57',
        prompt: 'Write trailer parsing tests',
        timestamp: '11:22 AM',
      },
      {
        id: 'cp-58',
        prompt: 'Validate trailer format on write',
        timestamp: '11:40 AM',
      },
    ],
  },
  {
    date: 'Feb 22',
    commit: '5a7b9c1',
    checkpoints: 3,
    message: 'docs: update CLI usage instructions',
    agent: 'gemini-cli',
    checkpointList: [
      {
        id: 'cp-59',
        prompt: 'Rewrite getting started section',
        timestamp: '03:00 PM',
      },
      {
        id: 'cp-60',
        prompt: 'Add examples for each CLI command',
        timestamp: '03:25 PM',
      },
      {
        id: 'cp-61',
        prompt: 'Document environment variables',
        timestamp: '03:45 PM',
      },
    ],
  },
  {
    date: 'Feb 23',
    commit: '6b8c0d2',
    checkpoints: 10,
    message: 'feat: implement resume from checkpoint',
    agent: 'claude-code',
    checkpointList: [
      { id: 'cp-62', prompt: 'Design resume workflow', timestamp: '09:00 AM' },
      {
        id: 'cp-63',
        prompt: 'Find latest checkpoint for a branch',
        timestamp: '09:18 AM',
      },
      {
        id: 'cp-64',
        prompt: 'Restore working tree from checkpoint',
        timestamp: '09:35 AM',
      },
      {
        id: 'cp-65',
        prompt: 'Restore session metadata',
        timestamp: '09:52 AM',
      },
      {
        id: 'cp-66',
        prompt: 'Handle conflicts during restore',
        timestamp: '10:10 AM',
      },
      {
        id: 'cp-67',
        prompt: 'Add --force flag for older checkpoints',
        timestamp: '10:28 AM',
      },
      {
        id: 'cp-68',
        prompt: 'Print resume summary to terminal',
        timestamp: '10:45 AM',
      },
      {
        id: 'cp-69',
        prompt: 'Validate checkpoint integrity before resume',
        timestamp: '11:02 AM',
      },
      {
        id: 'cp-70',
        prompt: 'Handle missing checkpoint branches',
        timestamp: '11:20 AM',
      },
      {
        id: 'cp-71',
        prompt: 'Add integration test for resume flow',
        timestamp: '11:38 AM',
      },
    ],
  },
  {
    date: 'Feb 24',
    commit: '7c9d1e3',
    checkpoints: 7,
    message: 'test: add integration tests for hooks',
    agent: 'open-code',
    checkpointList: [
      {
        id: 'cp-72',
        prompt: 'Set up test harness for hook lifecycle',
        timestamp: '10:00 AM',
      },
      {
        id: 'cp-73',
        prompt: 'Test session start event capture',
        timestamp: '10:20 AM',
      },
      {
        id: 'cp-74',
        prompt: 'Test prompt submit recording',
        timestamp: '10:40 AM',
      },
      {
        id: 'cp-75',
        prompt: 'Test stop event with metadata flush',
        timestamp: '11:00 AM',
      },
      {
        id: 'cp-76',
        prompt: 'Test concurrent session isolation',
        timestamp: '11:20 AM',
      },
      {
        id: 'cp-77',
        prompt: 'Test hook failure recovery',
        timestamp: '11:40 AM',
      },
      {
        id: 'cp-78',
        prompt: 'Add edge case tests for empty sessions',
        timestamp: '12:00 PM',
      },
    ],
  },
  {
    date: 'Feb 25',
    commit: '8d0e2f4',
    checkpoints: 12,
    message: 'feat: add telemetry opt-in support',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-79',
        prompt: 'Define telemetry event schema',
        timestamp: '08:30 AM',
      },
      {
        id: 'cp-80',
        prompt: 'Add telemetry flag to settings',
        timestamp: '08:45 AM',
      },
      {
        id: 'cp-81',
        prompt: 'Implement PostHog client wrapper',
        timestamp: '09:02 AM',
      },
      {
        id: 'cp-82',
        prompt: 'Fire event on each CLI command',
        timestamp: '09:20 AM',
      },
      {
        id: 'cp-83',
        prompt: 'Include strategy and agent in events',
        timestamp: '09:38 AM',
      },
      {
        id: 'cp-84',
        prompt: 'Dispatch telemetry in background process',
        timestamp: '09:55 AM',
      },
      {
        id: 'cp-85',
        prompt: 'Add opt-out instructions to enable output',
        timestamp: '10:12 AM',
      },
      {
        id: 'cp-86',
        prompt: 'Respect CI environment for telemetry',
        timestamp: '10:30 AM',
      },
      {
        id: 'cp-87',
        prompt: 'Handle network failures gracefully',
        timestamp: '10:48 AM',
      },
      {
        id: 'cp-88',
        prompt: 'Add telemetry disable command',
        timestamp: '11:05 AM',
      },
      {
        id: 'cp-89',
        prompt: 'Test telemetry in isolated environment',
        timestamp: '11:22 AM',
      },
      {
        id: 'cp-90',
        prompt: 'Document telemetry data collected',
        timestamp: '11:40 AM',
      },
    ],
  },
  {
    date: 'Feb 26',
    commit: '9e1f3a5',
    checkpoints: 5,
    message: 'fix: handle missing settings gracefully',
    agent: 'gemini-cli',
    checkpointList: [
      {
        id: 'cp-91',
        prompt: 'Detect missing .bitloops directory',
        timestamp: '02:00 PM',
      },
      {
        id: 'cp-92',
        prompt: 'Return defaults when settings.json absent',
        timestamp: '02:18 PM',
      },
      {
        id: 'cp-93',
        prompt: 'Merge local settings over project settings',
        timestamp: '02:35 PM',
      },
      {
        id: 'cp-94',
        prompt: 'Log warning instead of error for missing files',
        timestamp: '02:52 PM',
      },
      {
        id: 'cp-95',
        prompt: 'Test all settings fallback paths',
        timestamp: '03:10 PM',
      },
    ],
  },
  {
    date: 'Feb 27',
    commit: 'a0b2c4d',
    checkpoints: 8,
    message: 'feat: serve local dashboard bundle',
    agent: 'claude-code',
    checkpointList: [
      {
        id: 'cp-96',
        prompt: 'Add dashboard subcommand to CLI',
        timestamp: '09:00 AM',
      },
      {
        id: 'cp-97',
        prompt: 'Implement TCP listener with tokio',
        timestamp: '09:18 AM',
      },
      {
        id: 'cp-98',
        prompt: 'Serve static files from bundle directory',
        timestamp: '09:35 AM',
      },
      {
        id: 'cp-99',
        prompt: 'Add SPA fallback routing to index.html',
        timestamp: '09:52 AM',
      },
      {
        id: 'cp-100',
        prompt: 'Implement path traversal protection',
        timestamp: '10:10 AM',
      },
      {
        id: 'cp-101',
        prompt: 'Auto-open browser on startup',
        timestamp: '10:28 AM',
      },
      {
        id: 'cp-102',
        prompt: 'Add --no-open and --port flags',
        timestamp: '10:45 AM',
      },
      {
        id: 'cp-103',
        prompt: 'Print styled banner on server start',
        timestamp: '11:02 AM',
      },
    ],
  },
]
