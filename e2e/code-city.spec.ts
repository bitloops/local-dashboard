import { expect, test, type Locator } from '@playwright/test'

async function expectCodeCityCanvasRendered(sceneCard: Locator) {
  await expect(sceneCard).toBeVisible()

  const canvas = sceneCard.locator('canvas')
  if ((await canvas.count()) === 0) {
    await expect(sceneCard).toContainText('WebGL unavailable')
    return
  }

  await expect(canvas).toBeVisible()

  await expect
    .poll(
      async () =>
        canvas.evaluate((node) => {
          const canvasElement = node as HTMLCanvasElement
          const context =
            canvasElement.getContext('webgl2') ??
            canvasElement.getContext('webgl') ??
            canvasElement.getContext('experimental-webgl')

          if (context == null) {
            return false
          }

          const gl = context as WebGLRenderingContext
          const width = gl.drawingBufferWidth
          const height = gl.drawingBufferHeight

          if (width === 0 || height === 0) {
            return false
          }

          const samples = [
            [0.5, 0.5],
            [0.35, 0.4],
            [0.65, 0.4],
            [0.45, 0.62],
            [0.58, 0.7],
          ]

          for (const [xRatio, yRatio] of samples) {
            const pixel = new Uint8Array(4)
            gl.readPixels(
              Math.floor(width * xRatio),
              Math.floor(height * yRatio),
              1,
              1,
              gl.RGBA,
              gl.UNSIGNED_BYTE,
              pixel,
            )

            const [red, green, blue, alpha] = pixel
            const isBlankWhite =
              alpha === 0 || (red > 245 && green > 245 && blue > 245)

            if (!isBlankWhite) {
              return true
            }
          }

          return false
        }),
      {
        timeout: 15_000,
      },
    )
    .toBe(true)
}

test('Code Atlas loads a fixture, searches, toggles overlays, and updates the inspector', async ({
  page,
}) => {
  const runtimeErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      runtimeErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    runtimeErrors.push(error.message)
  })

  await page.goto('/code-city')

  await expect(page.getByRole('heading', { name: 'Code Atlas' })).toBeVisible()
  await expectCodeCityCanvasRendered(page.getByTestId('code-city-scene-card'))

  await page.getByTestId('code-city-search-input').fill('order-aggregate')
  await page
    .getByRole('button', {
      name: /order-aggregate\.ts\s+src\/domain\/order-aggregate\.ts/i,
    })
    .click()

  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'Selected building',
  )
  await expect(page.getByTestId('code-city-inspector')).toContainText(
    'src/domain/order-aggregate.ts',
  )

  const overlaysToggle = page.getByTestId('code-city-toggle-overlays')
  await expect(overlaysToggle).toHaveAttribute('aria-pressed', 'true')
  await overlaysToggle.click()
  await expect(overlaysToggle).toHaveAttribute('aria-pressed', 'false')

  await page.getByTestId('code-city-preset-select').click()
  await page.getByRole('option', { name: 'World view' }).click()
  await expect(page.getByTestId('code-city-scene-card')).toBeVisible()

  expect(runtimeErrors).toEqual([])
})
