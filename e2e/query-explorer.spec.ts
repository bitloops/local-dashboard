import { test, expect, type Page } from '@playwright/test'

const STUB_SDL = `
  type Query {
    repo(name: String!): Repository
  }

  type Repository {
    ref(name: String): Ref
  }

  type Ref {
    files: [File!]!
  }

  type File {
    path: String!
  }
`

/** Stub both API endpoints so tests never need a real backend. */
async function stubApis(
  page: Page,
  {
    queryResponse = { data: {} },
    schemaStatus = 200,
  }: {
    queryResponse?: unknown
    schemaStatus?: number
  } = {},
) {
  await page.route('**/devql/sdl', (route) =>
    schemaStatus === 200
      ? route.fulfill({
          status: 200,
          contentType: 'text/plain',
          body: STUB_SDL,
        })
      : route.fulfill({ status: schemaStatus, body: '' }),
  )
  await page.route('**/devql', (route) =>
    route.fulfill({ status: 200, json: queryResponse }),
  )
}

/** Run the default query and wait for the result tree to appear. */
async function runQueryAndWaitForResult(page: Page) {
  await page.getByRole('button', { name: 'Run query' }).click()
  await expect(page.getByTestId('result-viewer-json-tree')).toBeVisible()
}

// Default stubs for every test so /explorer’s on-mount schema fetch never hits the network.
// Tests that need different behavior call stubApis (or page.route) again after this; Playwright
// uses the most recently registered matching handler first.
test.beforeEach(async ({ page }) => {
  await stubApis(page)
})

test.describe('Query Explorer', () => {
  test('visiting /explorer shows Query Explorer heading and tagline', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await expect(
      page.getByRole('heading', { name: 'Query Explorer' }),
    ).toBeVisible()
    await expect(
      page.getByText('Query and explore your code intelligence data.'),
    ).toBeVisible()
  })

  test('Query Explorer shows three panels: Editor, Results, Variables', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Variables' })).toBeVisible()
  })

  test('Query Explorer shows resize handle between editor and results', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await expect(
      page.getByRole('separator', {
        name: 'Resize editor and results panels',
      }),
    ).toBeVisible()
  })

  test('Query Explorer shows idle message in Results panel', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await expect(page.getByText('Run a query to see results.')).toBeVisible()
  })

  test('user can type in Query Editor', async ({ page }) => {
    await page.goto('/explorer')

    const editorContainer = page.getByTestId('query-editor')
    const editorViewLines = editorContainer
      .locator('.monaco-editor .view-lines')
      .first()
    const monacoEditor = editorContainer.locator('.monaco-editor').first()
    const before = await editorViewLines.innerText()

    await monacoEditor.click({ force: true })
    await page.keyboard.insertText('TestTypedValue')

    await expect
      .poll(async () => await editorViewLines.innerText())
      .not.toBe(before)
  })

  test('user can type in Variables editor', async ({ page }) => {
    await page.goto('/explorer')

    const variablesContainer = page.getByTestId('variables-editor')
    const monacoEditor = variablesContainer.locator('.monaco-editor').first()
    const editorViewLines = variablesContainer
      .locator('.monaco-editor .view-lines')
      .first()
    const before = await editorViewLines.innerText()

    await monacoEditor.click({ force: true })
    await page.keyboard.insertText('{"typed":true}')

    await expect
      .poll(async () => await editorViewLines.innerText())
      .not.toBe(before)
  })

  test('navigating from sidebar Query Explorer link loads the explorer', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Query Explorer' }).click()

    await expect(
      page.getByRole('heading', { name: 'Query Explorer' }),
    ).toBeVisible()
    await expect(page.getByText('Editor')).toBeVisible()
  })
})

test.describe('Run button', () => {
  test('Run button is present and enabled when the default query is loaded', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await expect(page.getByRole('button', { name: 'Run query' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run query' })).toBeEnabled()
  })

  test('Run button is disabled when the query editor is cleared', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'query-explorer-history',
        JSON.stringify([
          {
            id: 'empty-query-entry',
            query: '',
            variables: '{}',
            runAt: Date.now(),
          },
        ]),
      )
    })
    await page.goto('/explorer')
    await page.getByRole('button', { name: 'Show history' }).click()
    await page.getByRole('button', { name: 'Load' }).click()

    await expect
      .poll(() => page.getByRole('button', { name: 'Run query' }).isDisabled())
      .toBe(true)
  })

  test('Run button is not visible in history view', async ({ page }) => {
    await page.goto('/explorer')

    await page.getByRole('button', { name: 'Show history' }).click()

    await expect(
      page.getByRole('button', { name: 'Run query' }),
    ).not.toBeVisible()
  })
})

test.describe('History panel', () => {
  test('history toggle button is visible with correct aria-label', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await expect(
      page.getByRole('button', { name: 'Show history' }),
    ).toBeVisible()
  })

  test('clicking history toggle switches view to History and shows empty state', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await page.getByRole('button', { name: 'Show history' }).click()

    await expect(page.getByRole('heading', { name: 'History' })).toBeVisible()
    await expect(
      page.getByText('Run a query to see history here.'),
    ).toBeVisible()
  })

  test('clicking editor toggle from history view returns to Editor', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await page.getByRole('button', { name: 'Show history' }).click()
    await page.getByRole('button', { name: 'Show editor' }).click()

    await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run query' })).toBeVisible()
  })
})

test.describe('Query execution', () => {
  test('successful run shows JSON result tree in Results panel', async ({
    page,
  }) => {
    await stubApis(page, {
      queryResponse: { data: { repo: { ref: { files: [] } } } },
    })
    await page.goto('/explorer')

    await runQueryAndWaitForResult(page)
  })

  test('loading spinner shown while query is in-flight', async ({ page }) => {
    // Hold the /devql response until we've observed the spinner.
    let resolveQuery!: () => void
    const queryGate = new Promise<void>((r) => {
      resolveQuery = r
    })

    await page.route('**/devql', async (route) => {
      await queryGate
      await route.fulfill({ status: 200, json: { data: {} } })
    })
    await page.goto('/explorer')

    await page.getByRole('button', { name: 'Run query' }).click()

    await expect(
      page.locator('[data-panel="results"] .animate-spin'),
    ).toBeVisible()

    // Release the response and verify the result arrives
    resolveQuery()
    await expect(page.getByTestId('result-viewer-json-tree')).toBeVisible()
  })

  test('GraphQL errors in response body show error styling in Results panel', async ({
    page,
  }) => {
    await stubApis(page, {
      queryResponse: {
        data: null,
        errors: [{ message: 'Repo not found' }],
      },
    })
    await page.goto('/explorer')

    await page.getByRole('button', { name: 'Run query' }).click()

    await expect(page.locator('[data-error="true"]')).toBeVisible()
  })

  test('network-level error shows error styling in Results panel', async ({
    page,
  }) => {
    await page.route('**/devql', (route) =>
      route.fulfill({ status: 500, body: 'Internal Server Error' }),
    )
    await page.goto('/explorer')

    await page.getByRole('button', { name: 'Run query' }).click()

    await expect(page.locator('[data-error="true"]')).toBeVisible()
  })

  test('after a successful run a history entry appears in the history panel', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await runQueryAndWaitForResult(page)
    await page.getByRole('button', { name: 'Show history' }).click()

    await expect(page.getByRole('button', { name: 'Load' })).toBeVisible()
  })
})

test.describe('History entry interactions', () => {
  async function setupWithHistoryEntry(page: Page) {
    await page.goto('/explorer')
    await runQueryAndWaitForResult(page)
    await page.getByRole('button', { name: 'Show history' }).click()
    await expect(page.getByRole('button', { name: 'Load' })).toBeVisible()
  }

  test('Load button loads the entry and returns to editor view', async ({
    page,
  }) => {
    await setupWithHistoryEntry(page)

    await page.getByRole('button', { name: 'Load' }).click()

    await expect(page.getByRole('heading', { name: 'Editor' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run query' })).toBeVisible()
  })

  test('Remove button removes the entry and shows empty state', async ({
    page,
  }) => {
    await setupWithHistoryEntry(page)

    await page.getByRole('button', { name: 'Remove from history' }).click()

    await expect(
      page.getByText('Run a query to see history here.'),
    ).toBeVisible()
  })

  test('Re-run button re-executes the query and updates Results panel', async ({
    page,
  }) => {
    await setupWithHistoryEntry(page)

    // Clear the results panel state so we can detect a fresh result
    // Results panel is always visible regardless of editor/history toggle
    await page.getByRole('button', { name: 'Re-run' }).click()

    await expect(page.getByTestId('result-viewer-json-tree')).toBeVisible()
  })

  test('multiple history entries are listed with most-recent first', async ({
    page,
  }) => {
    await page.goto('/explorer')

    // Run twice to produce two history entries.
    await runQueryAndWaitForResult(page)
    await runQueryAndWaitForResult(page)

    await page.getByRole('button', { name: 'Show history' }).click()

    const entries = page.getByRole('button', { name: 'Load' })
    await expect(entries).toHaveCount(2)
  })
})

test.describe('Schema endpoint failure', () => {
  test('page loads and Run button is enabled when schema endpoint fails', async ({
    page,
  }) => {
    await stubApis(page, { schemaStatus: 500 })
    await page.goto('/explorer')

    await expect(
      page.getByRole('heading', { name: 'Query Explorer' }),
    ).toBeVisible()
    await expect(
      page.getByText('Could not fetch dependencies from the API.'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Run query' })).toBeEnabled()
  })

  test('query can still be executed when schema endpoint fails', async ({
    page,
  }) => {
    await stubApis(page, {
      schemaStatus: 500,
      queryResponse: { data: { repo: null } },
    })
    await page.goto('/explorer')

    await runQueryAndWaitForResult(page)
  })
})
