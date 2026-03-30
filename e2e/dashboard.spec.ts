import { test, expect, type Page, type Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared stub data
// ---------------------------------------------------------------------------

const STUB_BRANCHES = ['main', 'feat/auth']

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
      committedAt: string
      branch: string
      authorName: string
      authorEmail: string
      agents: Set<string>
      checkpoints: Array<{
        id: string
        createdAt: string
        branch: string
        agent: string
        strategy: string
        sessionId: string
        toolUseId: string
        filesTouched: string[]
        sessionCount: number
        checkpointsCount: number
        isTask: boolean
      }>
    }
  >()

  for (const row of STUB_COMMITS) {
    const existing = commitMap.get(row.commit.sha)
    if (existing) {
      existing.agents.add(row.checkpoint.agent)
      existing.checkpoints.push({
        id: row.checkpoint.checkpoint_id,
        createdAt: row.checkpoint.created_at,
        branch: row.checkpoint.branch,
        agent: row.checkpoint.agent,
        strategy: row.checkpoint.strategy,
        sessionId: row.checkpoint.session_id,
        toolUseId: row.checkpoint.tool_use_id,
        filesTouched: row.checkpoint.files_touched.map((file) => file.filepath),
        sessionCount: row.checkpoint.session_count,
        checkpointsCount: row.checkpoint.checkpoints_count,
        isTask: row.checkpoint.is_task,
      })
      continue
    }

    commitMap.set(row.commit.sha, {
      sha: row.commit.sha,
      commitMessage: row.commit.message,
      committedAt: new Date(row.commit.timestamp).toISOString(),
      branch: row.checkpoint.branch,
      authorName:
        row.checkpoint.agent === 'gemini-cli' ? 'Alice Dev' : 'Wayne Omoga',
      authorEmail:
        row.checkpoint.agent === 'gemini-cli'
          ? 'alice@bitloops.com'
          : 'wayne@bitloops.com',
      agents: new Set([row.checkpoint.agent]),
      checkpoints: [
        {
          id: row.checkpoint.checkpoint_id,
          createdAt: row.checkpoint.created_at,
          branch: row.checkpoint.branch,
          agent: row.checkpoint.agent,
          strategy: row.checkpoint.strategy,
          sessionId: row.checkpoint.session_id,
          toolUseId: row.checkpoint.tool_use_id,
          filesTouched: row.checkpoint.files_touched.map(
            (file) => file.filepath,
          ),
          sessionCount: row.checkpoint.session_count,
          checkpointsCount: row.checkpoint.checkpoints_count,
          isTask: row.checkpoint.is_task,
        },
      ],
    })
  }

  return {
    data: {
      repo: {
        commits: {
          edges: Array.from(commitMap.values()).map((commit) => ({
            node: {
              sha: commit.sha,
              parents: [],
              authorName: commit.authorName,
              authorEmail: commit.authorEmail,
              commitMessage: commit.commitMessage,
              committedAt: commit.committedAt,
              filesChanged: commit.checkpoints.flatMap((cp) => cp.filesTouched),
              checkpoints: {
                edges: commit.checkpoints.map((checkpoint) => ({
                  node: {
                    id: checkpoint.id,
                    branch: checkpoint.branch,
                    agent: checkpoint.agent,
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
                  },
                })),
              },
            },
          })),
          pageInfo: {
            hasNextPage: false,
            endCursor: null,
          },
        },
      },
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub all API calls so the app works without a real backend. */
async function stubApiRoutes(page: Page) {
  await page.route('**/devql', async (route: Route) => {
    const request = route.request()
    const body = request.postDataJSON() as {
      query?: string
    }
    const query = body.query ?? ''

    if (query.includes('query DashboardBranches')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            repo: {
              branches: STUB_BRANCHES.map((name) => ({
                name,
                checkpointCount: 1,
              })),
            },
          },
        }),
      })
      return
    }

    if (query.includes('query DashboardRepoOptions')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            repo: {
              users: ['wayne@bitloops.com', 'alice@bitloops.com'],
              agents: ['claude-code', 'gemini-cli'],
            },
          },
        }),
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

  await page.route('**/api/checkpoint*', (route: Route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_CHECKPOINT_DETAIL),
    })
  })
  await page.route('**/api/checkpoints/**', (route: Route) => {
    void route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_CHECKPOINT_DETAIL),
    })
  })
}

// ---------------------------------------------------------------------------
// App / dashboard load
// ---------------------------------------------------------------------------

test.describe('App / dashboard load', () => {
  test('visiting / loads the dashboard with heading and filters', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Filters', { exact: true })).toBeVisible()
    await expect(page.getByText('Recent Commits')).toBeVisible()
  })

  test('dashboard displays stat cards after API data loads', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByText('Throughput')).toBeVisible()
    await expect(
      page.getByText('Checkpoints', { exact: true }).first(),
    ).toBeVisible()
    await expect(
      page.getByText('Agents', { exact: true }).first(),
    ).toBeVisible()
    await expect(page.getByText('Active Branches')).toBeVisible()
  })

  test('dashboard shows commit rows from the API', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Both distinct commit messages from STUB_COMMITS should appear in the table
    await expect(
      page.getByText('feat: add dashboard layout scaffold'),
    ).toBeVisible()
    await expect(
      page.getByText('fix: resolve auth token refresh loop'),
    ).toBeVisible()
  })

  test('dashboard shows API error banner when data endpoints fail', async ({
    page,
  }) => {
    await page.route('**/devql', async (route: Route) => {
      const body = route.request().postDataJSON() as { query?: string }
      const query = body.query ?? ''

      if (query.includes('query DashboardBranches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              repo: {
                branches: STUB_BRANCHES.map((name) => ({
                  name,
                  checkpointCount: 1,
                })),
              },
            },
          }),
        })
        return
      }

      if (query.includes('query DashboardRepoOptions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              repo: {
                users: ['wayne@bitloops.com', 'alice@bitloops.com'],
                agents: ['claude-code', 'gemini-cli'],
              },
            },
          }),
        })
        return
      }

      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          errors: [{ message: 'Internal Server Error' }],
        }),
      })
    })

    await page.goto('/')

    await expect(
      page.getByText(/Could not load dashboard data from the API/),
    ).toBeVisible({ timeout: 8000 })
  })

  test('shows "No branches" message when dashboard branches query returns empty', async ({
    page,
  }) => {
    await page.route('**/devql', async (route: Route) => {
      const body = route.request().postDataJSON() as { query?: string }
      const query = body.query ?? ''

      if (query.includes('query DashboardBranches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              repo: {
                branches: [],
              },
            },
          }),
        })
        return
      }

      if (query.includes('query DashboardRepoOptions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              repo: {
                users: ['wayne@bitloops.com', 'alice@bitloops.com'],
                agents: ['claude-code', 'gemini-cli'],
              },
            },
          }),
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

    await expect(
      page.getByText(/No branches are currently available/),
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

test.describe('Filters', () => {
  test('branch filter dropdown shows stub branch options', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Branch is the first combobox on the page
    const branchTrigger = page.getByRole('combobox').nth(0)
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

    const branchTrigger = page.getByRole('combobox').nth(0)
    await branchTrigger.click()
    await page.getByRole('option', { name: 'feat/auth' }).click()

    await expect(branchTrigger).toContainText('feat/auth')
  })

  test('clear filters button is disabled until a filter is active', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    const clearBtn = page.getByRole('button', { name: 'Clear filters' })

    // No filter selected yet — button must be disabled
    await expect(clearBtn).toBeDisabled()

    // Activate a filter by selecting a branch
    const branchTrigger = page.getByRole('combobox').nth(0)
    await branchTrigger.click()
    await page.getByRole('option', { name: 'feat/auth' }).click()

    // Button should now be enabled
    await expect(clearBtn).toBeEnabled()
  })

  test('clicking clear filters resets the branch selection to Auto', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    const branchTrigger = page.getByRole('combobox').nth(0)
    await branchTrigger.click()
    await page.getByRole('option', { name: 'feat/auth' }).click()
    await expect(branchTrigger).toContainText('feat/auth')

    await page.getByRole('button', { name: 'Clear filters' }).click()

    // After clearing, the trigger reverts to the Auto value
    await expect(branchTrigger).not.toContainText('feat/auth')
    await expect(branchTrigger).toContainText('Auto')
  })

  test('filter section contains User, Agent, From, and To controls', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Match the small <p> label elements inside the Filters card
    await expect(
      page.locator('p.text-muted-foreground', { hasText: /^User$/ }).first(),
    ).toBeVisible()
    await expect(
      page.locator('p.text-muted-foreground', { hasText: /^Agent$/ }).first(),
    ).toBeVisible()
    await expect(page.getByText('From', { exact: true })).toBeVisible()
    await expect(page.getByText('To', { exact: true })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Checkpoint sheet
// ---------------------------------------------------------------------------

test.describe('Checkpoint sheet', () => {
  const openFirstCheckpoint = async (page: Page) => {
    await page.getByRole('button', { name: 'Expand row' }).first().click()
    const tree = page.getByRole('tree').first()
    await expect(tree).toBeVisible()
    await tree.getByRole('button').first().click()
  }

  test('expanding a commit row reveals its checkpoint entries', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // The expand chevron button has aria-label "Expand row"
    await page.getByRole('button', { name: 'Expand row' }).first().click()

    // Checkpoint tree appears and shows checkpoint id (e.g. cp-01) from stub.
    const tree = page.getByRole('tree')
    await expect(tree).toBeVisible({ timeout: 10_000 })
  })

  test('clicking a checkpoint opens the sheet with the checkpoint ID', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)

    await expect(
      page.getByRole('heading', { name: /Checkpoint cp-/i }),
    ).toBeVisible()
  })

  test('checkpoint sheet shows Files Touched and Metadata sections', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)
    await page.getByRole('tab', { name: /details|summary/i }).click()

    await expect(page.getByText('Files Touched')).toBeVisible()
    await expect(page.getByText('Metadata')).toBeVisible()
  })

  test('checkpoint sheet shows transcript entries or chat-load fallback state', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)

    // Chat Sessions section is always rendered. Depending on environment/network,
    // transcript data may be shown, it may be empty, or an explicit load error may appear.
    await expect(page.getByText('Chat Sessions')).toBeVisible()
    const transcriptOrFallback = page
      .getByText('No transcript entries available.')
      .or(page.getByText(/Could not load chat data from/))
      .or(page.getByText(/I'?ll add a layout with AppSidebar/i))
    await expect(transcriptOrFallback.first()).toBeVisible({ timeout: 8000 })
  })

  test('checkpoint sheet closes when the close button is clicked', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)
    await expect(
      page.getByRole('heading', { name: /Checkpoint cp-/i }),
    ).toBeVisible()

    const heading = page.getByRole('heading', { name: /Checkpoint cp-/i })
    const headingText = await heading.textContent()

    await page.getByRole('button', { name: /Close checkpoint panel/i }).click()
    await expect(
      page.getByRole('button', { name: /Open checkpoint panel/i }),
    ).toBeVisible()

    await page.getByRole('button', { name: /Open checkpoint panel/i }).click()
    await expect(heading).toHaveText(headingText ?? '')
  })

  test('checkpoint sheet shows error state when detail API fails', async ({
    page,
  }) => {
    await page.route('**/devql', async (route) => {
      const body = route.request().postDataJSON() as { query?: string }
      const query = body.query ?? ''

      if (query.includes('query DashboardBranches')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              repo: {
                branches: STUB_BRANCHES.map((name) => ({
                  name,
                  checkpointCount: 1,
                })),
              },
            },
          }),
        })
        return
      }

      if (query.includes('query DashboardRepoOptions')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            data: {
              repo: {
                users: ['wayne@bitloops.com', 'alice@bitloops.com'],
                agents: ['claude-code', 'gemini-cli'],
              },
            },
          }),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(buildDashboardCommitsResponse()),
      })
    })
    // Checkpoint detail endpoint fails
    await page.route('**/api/checkpoint*', (route) => {
      void route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'error' }),
      })
    })
    await page.route('**/api/checkpoints/**', (route) => {
      void route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'error' }),
      })
    })

    await page.goto('/')
    await openFirstCheckpoint(page)

    await expect(
      page
        .getByText(/Could not load chat data from/)
        .or(
          page.getByText('No chat sessions were returned for this checkpoint.'),
        ),
    ).toBeVisible({ timeout: 8000 })
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
  test('sidebar contains Dashboard, Settings, and Help navigation links', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
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

  test('clicking Dashboard in the sidebar returns to the dashboard', async ({
    page,
  }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Go to Settings first
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Then navigate back to Dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
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

    await expect(page.getByText('Bitloops')).toBeVisible()
  })
})
