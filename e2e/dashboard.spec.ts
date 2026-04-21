import { test, expect, type Page, type Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared stub data
// ---------------------------------------------------------------------------

const STUB_BRANCHES = ['main', 'feat/auth']
const STUB_REPOSITORIES = ['bitloops/local-dashboard', 'bitloops/another-repo']

const STUB_COMMITS = [
  {
    commit: {
      sha: 'a3f1c2d000000000000000000000000000000000',
      message: 'feat: add dashboard layout scaffold',
      timestamp: 1739527200000,
    },
    checkpoint: {
      checkpoint_id: 'cp-01',
      created_at: '2025-02-14T10:12:00Z',
      branch: 'main',
      agent: 'claude-code',
      strategy: 'task',
      session_id: 'sess-01',
      tool_use_id: '',
      files_touched: [
        { filepath: 'src/App.tsx', additionsCount: 42, deletionsCount: 8 },
        {
          filepath: 'src/components/layout/app-sidebar.tsx',
          additionsCount: 120,
          deletionsCount: 15,
        },
        {
          filepath: 'src/components/ui/sidebar.tsx',
          additionsCount: 0,
          deletionsCount: 3,
        },
        {
          filepath: 'src/styles/globals.css',
          additionsCount: 12,
          deletionsCount: 0,
        },
      ],
      session_count: 2,
      checkpoints_count: 4,
      is_task: true,
    },
  },
  {
    commit: {
      sha: 'a3f1c2d000000000000000000000000000000000',
      message: 'feat: add dashboard layout scaffold',
      timestamp: 1739527200000,
    },
    checkpoint: {
      checkpoint_id: 'cp-02',
      created_at: '2025-02-14T10:28:00Z',
      branch: 'main',
      agent: 'claude-code',
      strategy: 'task',
      session_id: 'sess-01',
      tool_use_id: '',
      files_touched: [
        {
          filepath: 'src/styles/globals.css',
          additionsCount: 3,
          deletionsCount: 1,
        },
      ],
      session_count: 1,
      checkpoints_count: 4,
      is_task: true,
    },
  },
  {
    commit: {
      sha: 'b7e9a010000000000000000000000000000000',
      message: 'fix: resolve auth token refresh loop',
      timestamp: 1739613600000,
    },
    checkpoint: {
      checkpoint_id: 'cp-05',
      created_at: '2025-02-15T09:15:00Z',
      branch: 'main',
      agent: 'gemini-cli',
      strategy: 'prompt',
      session_id: 'sess-02',
      tool_use_id: '',
      files_touched: [
        { filepath: 'src/lib/auth.ts', additionsCount: 20, deletionsCount: 5 },
      ],
      session_count: 1,
      checkpoints_count: 7,
      is_task: false,
    },
  },
]

function buildDashboardCommitsResponse() {
  const commitMap = new Map<
    string,
    {
      sha: string
      commitMessage: string
      timestamp: number
      authorName: string
      authorEmail: string
      checkpoints: Array<{
        checkpointId: string
        createdAt: string
        branch: string
        agent: string
        strategy: string
        sessionId: string
        toolUseId: string
        filesTouched: Array<{
          filepath: string
          additionsCount: number
          deletionsCount: number
        }>
        sessionCount: number
        checkpointsCount: number
        isTask: boolean
      }>
    }
  >()

  for (const row of STUB_COMMITS) {
    const existing = commitMap.get(row.commit.sha)
    if (existing) {
      existing.checkpoints.push({
        checkpointId: row.checkpoint.checkpoint_id,
        createdAt: row.checkpoint.created_at,
        branch: row.checkpoint.branch,
        agent: row.checkpoint.agent,
        strategy: row.checkpoint.strategy,
        sessionId: row.checkpoint.session_id,
        toolUseId: row.checkpoint.tool_use_id,
        filesTouched: row.checkpoint.files_touched,
        sessionCount: row.checkpoint.session_count,
        checkpointsCount: row.checkpoint.checkpoints_count,
        isTask: row.checkpoint.is_task,
      })
      continue
    }

    commitMap.set(row.commit.sha, {
      sha: row.commit.sha,
      commitMessage: row.commit.message,
      timestamp: row.commit.timestamp,
      authorName:
        row.checkpoint.agent === 'gemini-cli' ? 'Alice Dev' : 'Wayne Omoga',
      authorEmail:
        row.checkpoint.agent === 'gemini-cli'
          ? 'alice@bitloops.com'
          : 'wayne@bitloops.com',
      checkpoints: [
        {
          checkpointId: row.checkpoint.checkpoint_id,
          createdAt: row.checkpoint.created_at,
          branch: row.checkpoint.branch,
          agent: row.checkpoint.agent,
          strategy: row.checkpoint.strategy,
          sessionId: row.checkpoint.session_id,
          toolUseId: row.checkpoint.tool_use_id,
          filesTouched: row.checkpoint.files_touched,
          sessionCount: row.checkpoint.session_count,
          checkpointsCount: row.checkpoint.checkpoints_count,
          isTask: row.checkpoint.is_task,
        },
      ],
    })
  }

  return {
    data: {
      commits: Array.from(commitMap.values()).map((commit) => {
        const checkpoints = commit.checkpoints.map((checkpoint) => ({
          checkpointId: checkpoint.checkpointId,
          branch: checkpoint.branch,
          strategy: checkpoint.strategy,
          filesTouched: checkpoint.filesTouched,
          checkpointsCount: checkpoint.checkpointsCount,
          sessionCount: checkpoint.sessionCount,
          sessionId: checkpoint.sessionId,
          agents: [checkpoint.agent],
          firstPromptPreview: '',
          createdAt: checkpoint.createdAt,
          isTask: checkpoint.isTask,
          toolUseId: checkpoint.toolUseId,
          tokenUsage: null,
        }))

        return {
          commit: {
            sha: commit.sha,
            parents: [],
            authorName: commit.authorName,
            authorEmail: commit.authorEmail,
            timestamp: commit.timestamp,
            message: commit.commitMessage,
            filesTouched: commit.checkpoints.flatMap(
              (checkpoint) => checkpoint.filesTouched,
            ),
          },
          checkpoint: checkpoints[0],
          checkpoints,
        }
      }),
    },
  }
}

/** GraphQL nodes for `interactionSessions` / session detail `summary` (matches STUB_COMMITS sessions). */
function buildStubInteractionSessionNodes() {
  return [
    {
      sessionId: 'sess-01',
      branch: 'main',
      actor: null,
      agentType: 'claude-code',
      model: null,
      firstPrompt: 'feat: add dashboard layout scaffold',
      startedAt: '2025-02-14T10:12:00.000Z',
      endedAt: null,
      lastEventAt: null,
      turnCount: 2,
      checkpointCount: 4,
      tokenUsage: null,
      filePaths: [] as string[],
      toolUses: [] as Array<Record<string, unknown>>,
      linkedCheckpoints: [
        {
          checkpointId: 'cp-01',
          commitSha: 'a3f1c2d000000000000000000000000000000000',
          name: 'Wayne Omoga',
          email: 'wayne@bitloops.com',
          committedAt: '2025-02-14T10:12:00Z',
        },
        {
          checkpointId: 'cp-02',
          commitSha: 'a3f1c2d000000000000000000000000000000000',
          name: 'Wayne Omoga',
          email: 'wayne@bitloops.com',
          committedAt: '2025-02-14T10:28:00Z',
        },
      ],
      latestCommitAuthor: null,
    },
    {
      sessionId: 'sess-02',
      branch: 'main',
      actor: null,
      agentType: 'gemini-cli',
      model: null,
      firstPrompt: 'fix: resolve auth token refresh loop',
      startedAt: '2025-02-15T09:15:00.000Z',
      endedAt: null,
      lastEventAt: null,
      turnCount: 1,
      checkpointCount: 7,
      tokenUsage: null,
      filePaths: [] as string[],
      toolUses: [] as Array<Record<string, unknown>>,
      linkedCheckpoints: [
        {
          checkpointId: 'cp-05',
          commitSha: 'b7e9a010000000000000000000000000000000',
          name: 'Alice Dev',
          email: 'alice@bitloops.com',
          committedAt: '2025-02-15T09:15:00Z',
        },
      ],
      latestCommitAuthor: null,
    },
  ]
}

function buildDashboardInteractionSessionsResponse() {
  return {
    data: {
      interactionSessions: buildStubInteractionSessionNodes(),
    },
  }
}

function buildDashboardInteractionSessionDetailResponse(sessionId?: string) {
  const nodes = buildStubInteractionSessionNodes()
  const summary =
    nodes.find((n) => n.sessionId === sessionId) ?? nodes[0] ?? null
  return {
    data: {
      interactionSession: summary
        ? {
            summary,
            turns: [] as Array<Record<string, unknown>>,
            rawEvents: [] as Array<Record<string, unknown>>,
          }
        : null,
    },
  }
}

function buildDashboardRepositoriesResponse() {
  return {
    data: {
      repositories: STUB_REPOSITORIES.map((identity, index) => {
        const [, name] = identity.split('/')
        return {
          repoId: `repo-${index + 1}`,
          identity,
          name,
          organization: 'bitloops',
          provider: 'github',
          defaultBranch: 'main',
        }
      }),
    },
  }
}

function buildDashboardBranchesResponse(branches = STUB_BRANCHES) {
  return {
    data: {
      branches: branches.map((branch) => ({
        branch,
        checkpointCommits: 1,
      })),
    },
  }
}

function buildDashboardUsersResponse() {
  return {
    data: {
      users: [
        {
          key: 'wayne@bitloops.com',
          name: 'Wayne Omoga',
          email: 'wayne@bitloops.com',
        },
        {
          key: 'alice@bitloops.com',
          name: 'Alice Dev',
          email: 'alice@bitloops.com',
        },
      ],
    },
  }
}

function buildDashboardAgentsResponse() {
  return {
    data: {
      agents: [{ key: 'claude-code' }, { key: 'gemini-cli' }],
    },
  }
}

const STUB_CHECKPOINT_DETAIL = {
  branch: 'main',
  checkpoint_id: 'cp-01',
  checkpoints_count: 4,
  files_touched: [
    { filepath: 'src/App.tsx', additionsCount: 42, deletionsCount: 8 },
    {
      filepath: 'src/components/layout/app-sidebar.tsx',
      additionsCount: 120,
      deletionsCount: 15,
    },
    {
      filepath: 'src/components/ui/sidebar.tsx',
      additionsCount: 0,
      deletionsCount: 3,
    },
    {
      filepath: 'src/styles/globals.css',
      additionsCount: 12,
      deletionsCount: 0,
    },
  ],
  session_count: 2,
  strategy: 'task',
  token_usage: {
    input_tokens: 12500,
    output_tokens: 3200,
    cache_read_tokens: 4000,
    cache_creation_tokens: 800,
    api_call_count: 12,
  },
  sessions: [
    {
      agent: 'claude-code',
      context_text:
        'React 19 app with Vite. Use Tailwind and shadcn/ui. The sidebar should collapse on small screens.',
      created_at: '2025-02-14T10:12:00Z',
      is_task: true,
      metadata_json: JSON.stringify({
        model: 'claude-sonnet-4',
        temperature: 0.2,
        max_tokens: 4096,
      }),
      prompts_text:
        'Create the basic layout with sidebar and header. Use the existing AppSidebar component and add a main content area.',
      session_id: 'sess-01',
      session_index: 0,
      tool_use_id: '',
      transcript_jsonl: [
        JSON.stringify({
          role: 'user',
          content: 'Create the basic layout with sidebar and header.',
        }),
        JSON.stringify({
          role: 'assistant',
          content:
            "I'll add a layout with AppSidebar and a main content area using the existing components.",
        }),
        JSON.stringify({
          role: 'tool',
          content: 'Created src/App.tsx with Layout and SidebarInset.',
        }),
        JSON.stringify({
          role: 'user',
          content: 'Make the sidebar collapsible on mobile.',
        }),
        JSON.stringify({
          role: 'assistant',
          content:
            'Adding a collapsible wrapper and breakpoint-based visibility.',
        }),
      ].join('\n'),
    },
    {
      agent: 'claude-code',
      context_text:
        'Follow-up: layout is done. User wants theme toggle in the header.',
      created_at: '2025-02-14T10:28:00Z',
      is_task: false,
      metadata_json: JSON.stringify({
        model: 'claude-sonnet-4',
        parent_session_id: 'sess-01',
      }),
      prompts_text:
        'Add a theme switch (light/dark) in the header. Use the ThemeSwitch component if it exists.',
      session_id: 'sess-01',
      session_index: 1,
      tool_use_id: 'theme_switch',
      transcript_jsonl: [
        JSON.stringify({
          role: 'user',
          content: 'Add a theme switch in the header.',
        }),
        JSON.stringify({
          role: 'assistant',
          content:
            "I'll add ThemeSwitch to the header and ensure the provider wraps the app.",
        }),
        JSON.stringify({
          role: 'tool',
          content: 'Updated Header and main.tsx.',
        }),
      ].join('\n'),
    },
  ],
}

function buildDashboardCheckpointDetailResponse() {
  return {
    data: {
      checkpoint: {
        checkpointId: STUB_CHECKPOINT_DETAIL.checkpoint_id,
        strategy: STUB_CHECKPOINT_DETAIL.strategy,
        branch: STUB_CHECKPOINT_DETAIL.branch,
        checkpointsCount: STUB_CHECKPOINT_DETAIL.checkpoints_count,
        filesTouched: STUB_CHECKPOINT_DETAIL.files_touched,
        sessionCount: STUB_CHECKPOINT_DETAIL.session_count,
        tokenUsage: STUB_CHECKPOINT_DETAIL.token_usage
          ? {
              inputTokens: STUB_CHECKPOINT_DETAIL.token_usage.input_tokens,
              outputTokens: STUB_CHECKPOINT_DETAIL.token_usage.output_tokens,
              cacheCreationTokens:
                STUB_CHECKPOINT_DETAIL.token_usage.cache_creation_tokens,
              cacheReadTokens:
                STUB_CHECKPOINT_DETAIL.token_usage.cache_read_tokens,
              apiCallCount: STUB_CHECKPOINT_DETAIL.token_usage.api_call_count,
            }
          : null,
        sessions: STUB_CHECKPOINT_DETAIL.sessions.map((session) => ({
          sessionIndex: session.session_index,
          sessionId: session.session_id,
          agent: session.agent,
          createdAt: session.created_at,
          isTask: session.is_task,
          toolUseId: session.tool_use_id,
          metadataJson: session.metadata_json,
          transcriptJsonl: session.transcript_jsonl,
          promptsText: session.prompts_text,
          contextText: session.context_text,
        })),
      },
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub all dashboard and query-explorer calls so the app works without a real backend. */
async function stubApiRoutes(page: Page) {
  await page.route('**/devql/dashboard', async (route: Route) => {
    const request = route.request()
    const body = request.postDataJSON() as {
      query?: string
      variables?: { sessionId?: string }
    }
    const query = body.query ?? ''

    if (query.includes('query DashboardRepositories')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardRepositoriesResponse()),
      })
      return
    }

    if (query.includes('query DashboardBranches')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardBranchesResponse()),
      })
      return
    }

    if (query.includes('query DashboardUsers')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardUsersResponse()),
      })
      return
    }

    if (query.includes('query DashboardAgents')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardAgentsResponse()),
      })
      return
    }

    if (query.includes('query DashboardInteractionSessions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardInteractionSessionsResponse()),
      })
      return
    }

    if (query.includes('query DashboardInteractionSessionDetail')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          buildDashboardInteractionSessionDetailResponse(
            body.variables?.sessionId,
          ),
        ),
      })
      return
    }

    if (query.includes('query DashboardCommits')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardCommitsResponse()),
      })
      return
    }

    if (query.includes('query DashboardCheckpointDetail')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardCheckpointDetailResponse()),
      })
      return
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    })
  })

  await page.route('**/devql/global', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: {} }),
    })
  })
}

// ---------------------------------------------------------------------------
// Sessions helpers
// ---------------------------------------------------------------------------

const FIRST_SESSION_PROMPT = 'feat: add dashboard layout scaffold'
const SECOND_SESSION_PROMPT = 'fix: resolve auth token refresh loop'

async function runSessionsQuery(page: Page) {
  await page.getByRole('button', { name: 'Run query' }).click()
  await expect(page.getByText(FIRST_SESSION_PROMPT)).toBeVisible()
}

async function selectFirstStubSession(page: Page) {
  await runSessionsQuery(page)
  await page.getByText(FIRST_SESSION_PROMPT, { exact: false }).first().click()
}

// ---------------------------------------------------------------------------
// App / sessions load
// ---------------------------------------------------------------------------

test.describe('App / sessions load', () => {
  test('visiting / loads the sessions page with filters, editor, and table', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'Sessions', level: 1 }),
    ).toBeVisible()
    await expect(
      page.getByText('Run queries against session data.'),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible()
    await expect(page.getByTestId('sessions-variables-repo')).toBeVisible()
    await expect(page.getByTestId('sessions-variables-branch')).toBeVisible()
    await expect(
      page.getByText('No sessions for current filters.'),
    ).toBeVisible()
  })

  test('running the sessions query shows session prompt rows from the API', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await runSessionsQuery(page)

    await expect(page.getByText(FIRST_SESSION_PROMPT)).toBeVisible()
    await expect(page.getByText(SECOND_SESSION_PROMPT)).toBeVisible()
  })

  test('sessions query errors render inline on the page', async ({ page }) => {
    await page.route('**/devql/dashboard', async (route: Route) => {
      const body = route.request().postDataJSON() as { query?: string }
      const query = body.query ?? ''

      if (query.includes('query DashboardRepositories')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardRepositoriesResponse()),
        })
        return
      }

      if (query.includes('query DashboardBranches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardBranchesResponse()),
        })
        return
      }

      if (query.includes('query DashboardUsers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardUsersResponse()),
        })
        return
      }

      if (query.includes('query DashboardAgents')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardAgentsResponse()),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          errors: [{ message: 'Internal Server Error' }],
        }),
      })
    })

    await page.goto('/')
    await page.getByRole('button', { name: 'Run query' }).click()

    await expect(page.getByRole('alert')).toContainText('Internal Server Error')
  })

  test('branch selector stays disabled when the branches query returns no rows', async ({
    page,
  }) => {
    await page.route('**/devql/dashboard', async (route: Route) => {
      const routeBody = route.request().postDataJSON() as {
        query?: string
        variables?: { sessionId?: string }
      }
      const query = routeBody.query ?? ''

      if (query.includes('query DashboardRepositories')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardRepositoriesResponse()),
        })
        return
      }

      if (query.includes('query DashboardBranches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardBranchesResponse([])),
        })
        return
      }

      if (query.includes('query DashboardUsers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardUsersResponse()),
        })
        return
      }

      if (query.includes('query DashboardAgents')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardAgentsResponse()),
        })
        return
      }

      if (query.includes('query DashboardInteractionSessions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardInteractionSessionsResponse()),
        })
        return
      }

      if (query.includes('query DashboardInteractionSessionDetail')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            buildDashboardInteractionSessionDetailResponse(
              routeBody.variables?.sessionId,
            ),
          ),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardCommitsResponse()),
      })
    })

    await page.goto('/')

    const repoTrigger = page.getByTestId('sessions-variables-repo')
    const branchTrigger = page.getByTestId('sessions-variables-branch')

    await expect(repoTrigger).toContainText('Auto')
    await expect(branchTrigger).toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

test.describe('Filters', () => {
  test('repo selector shows repository options from the dashboard API', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    const repoTrigger = page.getByTestId('sessions-variables-repo')
    await expect(repoTrigger).toContainText('Auto')
    await repoTrigger.click()

    await expect(page.getByRole('option', { name: /Auto/ })).toBeVisible()
    await expect(
      page.getByRole('option', {
        name: 'bitloops/local-dashboard',
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('option', { name: 'bitloops/another-repo', exact: true }),
    ).toBeVisible()
  })

  test('branch filter dropdown shows stub branch options', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    const branchTrigger = page.getByTestId('sessions-variables-branch')
    await expect(branchTrigger).toBeEnabled()
    await branchTrigger.click()

    await expect(page.getByRole('option', { name: /Auto/ })).toBeVisible()
    await expect(
      page.getByRole('option', { name: 'main', exact: true }),
    ).toBeVisible()
    await expect(page.getByRole('option', { name: 'feat/auth' })).toBeVisible()
  })

  test('selecting a branch updates the branch trigger label', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    const branchTrigger = page.getByTestId('sessions-variables-branch')
    await expect(branchTrigger).toBeEnabled()
    await branchTrigger.click()
    await page.getByRole('option', { name: 'feat/auth' }).click()

    await expect(branchTrigger).toContainText('feat/auth')
  })

  test('selecting a repo updates the repo trigger label', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    const repoTrigger = page.getByTestId('sessions-variables-repo')
    await expect(repoTrigger).toContainText('Auto')
    await repoTrigger.click()
    await page.getByRole('option', { name: 'bitloops/another-repo' }).click()

    await expect(repoTrigger).toContainText('bitloops/another-repo')
  })

  test('selecting a repo is reflected in the sessions query variables', async ({
    page,
  }) => {
    const observedRepos: string[] = []

    await page.route('**/devql/dashboard', async (route: Route) => {
      const body = route.request().postDataJSON() as {
        query?: string
        variables?: { repoId?: string; sessionId?: string }
      }
      const query = body.query ?? ''
      const repo = body.variables?.repoId ?? null

      if (query.includes('query DashboardInteractionSessions') && repo) {
        observedRepos.push(repo)
      }

      if (query.includes('query DashboardRepositories')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardRepositoriesResponse()),
        })
        return
      }

      if (query.includes('query DashboardBranches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardBranchesResponse()),
        })
        return
      }

      if (query.includes('query DashboardUsers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardUsersResponse()),
        })
        return
      }

      if (query.includes('query DashboardAgents')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardAgentsResponse()),
        })
        return
      }

      if (query.includes('query DashboardInteractionSessions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardInteractionSessionsResponse()),
        })
        return
      }

      if (query.includes('query DashboardInteractionSessionDetail')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            buildDashboardInteractionSessionDetailResponse(
              body.variables?.sessionId,
            ),
          ),
        })
        return
      }

      if (query.includes('query DashboardCommits')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardCommitsResponse()),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ data: {} }),
      })
    })

    await page.goto('/')

    observedRepos.length = 0

    const repoTrigger = page.getByTestId('sessions-variables-repo')
    await expect(repoTrigger).toContainText('Auto')
    await repoTrigger.click()
    await page.getByRole('option', { name: 'bitloops/another-repo' }).click()
    await runSessionsQuery(page)

    await expect.poll(() => observedRepos.includes('repo-2')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Session detail
// ---------------------------------------------------------------------------

test.describe('Session detail', () => {
  test('selecting a session row opens the session sidebar', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await selectFirstStubSession(page)

    await expect(
      page.getByRole('button', { name: 'Close session panel' }),
    ).toBeVisible({ timeout: 10_000 })
  })

  test('sidebar details tab shows summary metrics and first prompt', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await selectFirstStubSession(page)

    await expect(page.getByText('Tool calls')).toBeVisible()
    await expect(
      page.getByText('No token usage data for this session.'),
    ).toBeVisible()
    await expect(page.getByText('First prompt')).toBeVisible()
    await expect(page.getByText(FIRST_SESSION_PROMPT).last()).toBeVisible()
  })

  test('sidebar turns tab shows the empty state from the stub detail', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await selectFirstStubSession(page)
    await page.getByRole('tab', { name: 'Turns' }).click()

    await expect(page.getByText('No turns.')).toBeVisible()
  })

  test('sidebar tool use tab shows the empty state from the stub detail', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await selectFirstStubSession(page)
    await page.getByRole('tab', { name: 'Tool use' }).click()

    await expect(page.getByText('No tool use entries.')).toBeVisible()
  })

  test('session detail errors are shown inline in the sidebar', async ({
    page,
  }) => {
    await page.route('**/devql/dashboard', async (route) => {
      const routeBody = route.request().postDataJSON() as {
        query?: string
        variables?: { sessionId?: string }
      }
      const query = routeBody.query ?? ''

      if (query.includes('query DashboardRepositories')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardRepositoriesResponse()),
        })
        return
      }

      if (query.includes('query DashboardBranches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardBranchesResponse()),
        })
        return
      }

      if (query.includes('query DashboardUsers')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardUsersResponse()),
        })
        return
      }

      if (query.includes('query DashboardAgents')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardAgentsResponse()),
        })
        return
      }

      if (query.includes('query DashboardInteractionSessions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(buildDashboardInteractionSessionsResponse()),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: null,
          errors: [{ message: 'Failed to load session detail.' }],
        }),
      })
    })

    await page.goto('/')
    await selectFirstStubSession(page)

    await expect(page.getByText('Failed to load session detail.')).toBeVisible({
      timeout: 8000,
    })
  })

  test('close session panel hides the sidebar', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await selectFirstStubSession(page)
    const closeButton = page.getByRole('button', {
      name: 'Close session panel',
    })
    const viewportWidth = await page.evaluate(() => window.innerWidth)
    await closeButton.click()

    await expect
      .poll(async () => (await closeButton.boundingBox())?.x ?? 0)
      .toBeGreaterThan(viewportWidth)
  })
})

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

test.describe('Settings', () => {
  test('navigating to /settings shows the Settings heading and description', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')
    await page.getByRole('link', { name: 'Settings' }).click()

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(
      page.getByText('Customize theme and display options.'),
    ).toBeVisible()
  })

  test('settings page renders the Appearance sub-section', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')
    await page.getByRole('link', { name: 'Settings' }).click()

    await expect(
      page.getByRole('heading', { name: 'Appearance' }),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test('sidebar contains Sessions, Query Explorer, Settings, and Help navigation links', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Sessions' })).toBeVisible()
    await expect(
      page.getByRole('link', { name: 'Query Explorer' }),
    ).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Help' })).toBeVisible()
  })

  test('clicking Settings in the sidebar loads the settings page', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await page.getByRole('link', { name: 'Settings' }).click()

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('clicking Sessions in the sidebar returns to the sessions page', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    await page.getByRole('link', { name: 'Sessions' }).click()
    await expect(
      page.getByRole('heading', { name: 'Sessions', level: 1 }),
    ).toBeVisible()
  })

  test('clicking Help in the sidebar shows the Coming Soon page', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await page.getByRole('link', { name: 'Help' }).click()

    await expect(
      page.getByRole('heading', { name: /Coming Soon/i }),
    ).toBeVisible()
  })

  test('sidebar team switcher shows the Bitloops brand name', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(
      page.getByRole('button', { name: 'Bitloops Local Dashboard' }),
    ).toBeVisible()
  })
})
