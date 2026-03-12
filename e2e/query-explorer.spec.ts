import { test, expect } from '@playwright/test'

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

  test('Query Explorer shows three panels: Query Editor, Results, Variables', async ({
    page,
  }) => {
    await page.goto('/explorer')

    await expect(
      page.getByRole('heading', { name: 'Query Editor' }),
    ).toBeVisible()
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

  test('user can type in Query Editor textarea', async ({ page }) => {
    await page.goto('/explorer')

    const editor = page.getByRole('textbox', { name: 'GraphQL query' })
    await editor.fill('query { id }')

    await expect(editor).toHaveValue('query { id }')
  })

  test('user can type in Variables textarea', async ({ page }) => {
    await page.goto('/explorer')

    const variablesInput = page.getByRole('textbox', {
      name: 'Query variables JSON',
    })
    await variablesInput.fill('{"key": "value"}')

    await expect(variablesInput).toHaveValue('{"key": "value"}')
  })

  test('navigating from sidebar Query Explorer link loads the explorer', async ({
    page,
  }) => {
    await page.goto('/')

    await page.getByRole('link', { name: 'Query Explorer' }).click()

    await expect(
      page.getByRole('heading', { name: 'Query Explorer' }),
    ).toBeVisible()
    await expect(page.getByText('Query Editor')).toBeVisible()
  })
})
