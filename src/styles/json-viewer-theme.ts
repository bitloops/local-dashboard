/**
 * Custom themes for @andypf/json-viewer.
 * Transparent background with default Base16 palette for icons, keys, strings, numbers, etc.
 */

export type JsonViewerTheme = Record<string, string>

/** Light: transparent bg + default-light palette (grays and accent colors) */
export const JSON_VIEWER_LIGHT_THEME: JsonViewerTheme = {
  base00: 'transparent',
  base01: '#e8e8e8',
  base02: '#d8d8d8',
  base03: '#b8b8b8',
  base04: '#585858',
  base05: '#383838',
  base06: '#282828',
  base07: '#181818',
  base08: '#ab4642',
  base09: '#dc9656',
  base0A: '#ab4642',
  base0B: '#a1b56c',
  base0C: '#86c1b9',
  base0D: '#7cafc2',
  base0E: '#ba8baf',
  base0F: '#a16946',
}

/** Dark: transparent bg + default-dark palette (grays and accent colors) */
export const JSON_VIEWER_DARK_THEME: JsonViewerTheme = {
  base00: 'transparent',
  base01: '#282828',
  base02: '#383838',
  base03: '#585858',
  base04: '#b8b8b8',
  base05: '#d8d8d8',
  base06: '#e8e8e8',
  base07: '#f8f8f8',
  base08: '#ab4642',
  base09: '#dc9656',
  base0A: '#ab4642',
  base0B: '#a1b56c',
  base0C: '#86c1b9',
  base0D: '#7cafc2',
  base0E: '#ba8baf',
  base0F: '#a16946',
}

export function getJsonViewerTheme(mode: 'light' | 'dark'): JsonViewerTheme {
  return mode === 'dark' ? JSON_VIEWER_DARK_THEME : JSON_VIEWER_LIGHT_THEME
}
