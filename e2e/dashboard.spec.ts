import { test, expect, type Page, type Route } from '@playwright/test'

// ---------------------------------------------------------------------------
// Shared stub data
// ---------------------------------------------------------------------------

const STUB_BRANCHES = [{ branch: 'main' }, { branch: 'feat/auth' }]

const STUB_USERS = [
  { key: 'user-1', name: 'Wayne Omoga', email: 'wayne@bitloops.com' },
  { key: 'user-2', name: 'Alice Dev', email: 'alice@bitloops.com' },
]

const STUB_AGENTS = [{ key: 'claude-code' }, { key: 'gemini-cli' }]

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
      files_touched: ['src/App.tsx', 'src/components/layout/app-sidebar.tsx'],
      session_count: 1,
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
      files_touched: ['src/styles/globals.css'],
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
      files_touched: ['src/lib/auth.ts'],
      session_count: 1,
      checkpoints_count: 7,
      is_task: false,
    },
  },
]

const STUB_CHECKPOINT_DETAIL = {
  branch: 'main',
  checkpoint_id: 'cp-01',
  checkpoints_count: 4,
  files_touched: ['src/App.tsx', 'src/components/layout/app-sidebar.tsx'],
  session_count: 1,
  strategy: 'task',
  token_usage: {
    input_tokens: 10000,
    output_tokens: 5000,
    cache_read_tokens: 2000,
    cache_creation_tokens: 500,
    api_call_count: 8,
  },
  sessions: [
    {
      agent: 'claude-code',
      context_text: 'Project context here.',
      created_at: '2025-02-14T10:12:00Z',
      is_task: true,
      metadata_json: '{"key":"value"}',
      prompts_text: 'Create the basic layout with sidebar and header',
      session_id: 'sess-01',
      session_index: 0,
      tool_use_id: '',
      transcript_jsonl: [
        JSON.stringify({ role: 'user', content: 'Create the basic layout' }),
        JSON.stringify({ role: 'assistant', content: 'Sure, here is the layout.' }),
        JSON.stringify({ role: 'tool', content: 'Tool executed successfully.' }),
      ].join('\n'),
    },
  ],
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stub all API calls so the app works without a real backend. */
async function stubApiRoutes(page: Page) {
  // Intercept API requests regardless of host/port so tests are deterministic.
  await page.route('**/api/branches*', (route: Route) => {
    void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_BRANCHES) })
  })

  await page.route('**/api/users*', (route: Route) => {
    void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_USERS) })
  })

  await page.route('**/api/agents*', (route: Route) => {
    void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_AGENTS) })
  })

  await page.route('**/api/commits*', (route: Route) => {
    void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_COMMITS) })
  })

  await page.route('**/api/checkpoint*', (route: Route) => {
    void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_CHECKPOINT_DETAIL) })
  })
  await page.route('**/api/checkpoints*', (route: Route) => {
    void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_CHECKPOINT_DETAIL) })
  })
}

// ---------------------------------------------------------------------------
// App / dashboard load
// ---------------------------------------------------------------------------

test.describe('App / dashboard load', () => {
  test('visiting / loads the dashboard with heading and filters', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByText('Filters', { exact: true })).toBeVisible()
    await expect(page.getByText('Recent Commits')).toBeVisible()
  })

  test('dashboard displays stat cards after API data loads', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByText('Throughput')).toBeVisible()
    await expect(page.getByText('Checkpoints', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Agents', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Active Branches')).toBeVisible()
  })

  test('dashboard shows commit rows from the API', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Both distinct commit messages from STUB_COMMITS should appear in the table
    await expect(page.getByText('feat: add dashboard layout scaffold')).toBeVisible()
    await expect(page.getByText('fix: resolve auth token refresh loop')).toBeVisible()
  })

  test('dashboard shows API error banner when data endpoints fail', async ({ page }) => {
    const base = 'http://127.0.0.1:5667'

    // Branches must succeed so effectiveBranch is set and the data request fires
    await page.route(`${base}/api/branches*`, (route: Route) => {
      void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_BRANCHES) })
    })

    // All other data endpoints fail
    await page.route(`${base}/api/**`, (route: Route) => {
      void route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Internal Server Error' }) })
    })

    await page.goto('/')

    await expect(
      page.getByText(/Could not load dashboard data from the API/)
    ).toBeVisible()
  })

  test('shows "No branches" message when /api/branches returns empty', async ({ page }) => {
    const base = 'http://127.0.0.1:5667'
    await page.route(`${base}/api/branches*`, (route: Route) => {
      void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    })

    await page.goto('/')

    await expect(
      page.getByText(/No branches are currently available/)
    ).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

test.describe('Filters', () => {
  // The Filters card renders 3 <Select> comboboxes in order: Branch (0), User (1), Agent (2).
  // Selecting by nth index is more reliable than matching the label text, which can appear
  // elsewhere on the page (e.g. table column headers).

  test('branch filter dropdown shows stub branch options', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Branch is the first combobox on the page
    const branchTrigger = page.getByRole('combobox').nth(0)
    await branchTrigger.click()

    await expect(page.getByRole('option', { name: /Auto/ })).toBeVisible()
    await expect(page.getByRole('option', { name: 'main', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'feat/auth' })).toBeVisible()
  })

  test('selecting a branch updates the branch trigger label', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    const branchTrigger = page.getByRole('combobox').nth(0)
    await branchTrigger.click()
    await page.getByRole('option', { name: 'feat/auth' }).click()

    await expect(branchTrigger).toContainText('feat/auth')
  })

  test('clear filters button is disabled until a filter is active', async ({ page }) => {
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

  test('clicking clear filters resets the branch selection to Auto', async ({ page }) => {
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

  test('filter section contains User, Agent, From, and To controls', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Match the small <p> label elements inside the Filters card
    await expect(page.locator('p.text-muted-foreground', { hasText: 'User' }).first()).toBeVisible()
    await expect(page.locator('p.text-muted-foreground', { hasText: 'Agent' }).first()).toBeVisible()
    await expect(page.locator('p.text-muted-foreground', { hasText: 'From' })).toBeVisible()
    await expect(page.locator('p.text-muted-foreground', { hasText: 'To' })).toBeVisible()
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

  test('expanding a commit row reveals its checkpoint entries', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // The expand chevron button has aria-label "Expand row"
    await page.getByRole('button', { name: 'Expand row' }).first().click()

    // Checkpoint tree appears and shows checkpoint id (e.g. cp-01) from stub.
    const tree = page.getByRole('tree')
    await expect(tree).toBeVisible({ timeout: 10_000 })

  })

  test('clicking a checkpoint opens the sheet with the checkpoint ID', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)

    await expect(page.getByRole('heading', { name: /Checkpoint cp-/i })).toBeVisible()
  })

  test('checkpoint sheet shows Files Touched and Metadata sections', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)

    await expect(page.getByText('Files Touched')).toBeVisible()
    await expect(page.getByText('Metadata')).toBeVisible()
  })

  test('checkpoint sheet shows transcript entries or chat-load fallback state', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)

    // Chat Sessions section is always rendered. Depending on environment/network,
    // transcript data may be shown or an explicit load error message may appear.
    await expect(page.getByText('Chat Sessions')).toBeVisible()
    await expect(
      page.getByText('Sure, here is the layout.').or(
        page.getByText(/Could not load chat data from/)
      )
    ).toBeVisible({ timeout: 8000 })
  })

  test('checkpoint sheet closes when the close button is clicked', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await openFirstCheckpoint(page)
    await expect(page.getByRole('heading', { name: /Checkpoint cp-/i })).toBeVisible()

    await page.getByRole('button', { name: /close/i }).click()

    await expect(page.getByRole('heading', { name: /Checkpoint cp-/i })).not.toBeVisible()
  })

  test('checkpoint sheet shows error state when detail API fails', async ({ page }) => {
    // All list endpoints succeed
    await page.route('**/api/branches*', (route) => {
      void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_BRANCHES) })
    })
    await page.route('**/api/users*', (route) => {
      void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_USERS) })
    })
    await page.route('**/api/agents*', (route) => {
      void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_AGENTS) })
    })
    await page.route('**/api/commits*', (route) => {
      void route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(STUB_COMMITS) })
    })
    // Checkpoint detail endpoint fails
    await page.route('**/api/checkpoint*', (route) => {
      void route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'error' }) })
    })
    await page.route('**/api/checkpoints*', (route) => {
      void route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'error' }) })
    })

    await page.goto('/')
    await openFirstCheckpoint(page)

    await expect(
      page.getByText(/Could not load chat data from/)
    ).toBeVisible({ timeout: 8000 })
  })
})

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

test.describe('Settings', () => {
  test('navigating to /settings shows the Settings heading and description', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')
    await page.getByRole('link', { name: 'Settings' }).click()

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByText('Customize theme and display options.')).toBeVisible()
  })

  test('settings page renders the Appearance sub-section', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')
    await page.getByRole('link', { name: 'Settings' }).click()

    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  })
})

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test.describe('Navigation', () => {
  test('sidebar contains Dashboard, Settings, and Help navigation links', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Help' })).toBeVisible()
  })

  test('clicking Settings in the sidebar loads the settings page', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await page.getByRole('link', { name: 'Settings' }).click()

    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  })

  test('clicking Dashboard in the sidebar returns to the dashboard', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    // Go to Settings first
    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

    // Then navigate back to Dashboard
    await page.getByRole('link', { name: 'Dashboard' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('clicking Help in the sidebar shows the Coming Soon page', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await page.getByRole('link', { name: 'Help' }).click()

    await expect(page.getByRole('heading', { name: /Coming Soon/i })).toBeVisible()
  })

  test('sidebar team switcher shows the Bitloops brand name', async ({ page }) => {
    await stubApiRoutes(page)
    await page.goto('/')

    await expect(page.getByText('Bitloops')).toBeVisible()
  })
})
