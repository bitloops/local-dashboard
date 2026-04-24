import { describe, expect, it } from 'vitest'
import {
  getJsonViewerTheme,
  JSON_VIEWER_DARK_THEME,
  JSON_VIEWER_LIGHT_THEME,
} from './json-viewer-theme'

describe('getJsonViewerTheme', () => {
  it('returns the light theme for light mode', () => {
    expect(getJsonViewerTheme('light')).toBe(JSON_VIEWER_LIGHT_THEME)
  })

  it('returns the dark theme for dark mode', () => {
    expect(getJsonViewerTheme('dark')).toBe(JSON_VIEWER_DARK_THEME)
  })
})
