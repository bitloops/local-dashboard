/**
 * Dashboard-matching themes for Monaco Editor.
 * Colors aligned with src/styles/theme.css (light/dark).
 * --editor-bg = primary (query), --editor-bg-secondary = variables panel.
 */
import type * as Monaco from 'monaco-editor'

const FALLBACKS = {
  lightPrimaryBg: '#ffffff',
  darkPrimaryBg: '#0f172a',
} as const

/** Primary editor (query): --editor-bg */
const LIGHT_BASE: Monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': FALLBACKS.lightPrimaryBg,
    'editor.foreground': '#1e293b',
    'editorLineNumber.foreground': '#94a3b8',
    'editor.selectionBackground': '#e2e8f0',
    'editorCursor.foreground': '#7404e4',
  },
}

/** Primary editor (query): --editor-bg */
const DARK_BASE: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': FALLBACKS.darkPrimaryBg,
    'editor.foreground': '#f8fafc',
    'editorLineNumber.foreground': '#64748b',
    'editor.selectionBackground': '#1e293b',
    'editorCursor.foreground': '#7404e4',
  },
}

export const DASHBOARD_LIGHT_THEME = 'dashboard-light'
export const DASHBOARD_DARK_THEME = 'dashboard-dark'
export const DASHBOARD_LIGHT_VARIABLES_THEME = 'dashboard-light-variables'
export const DASHBOARD_DARK_VARIABLES_THEME = 'dashboard-dark-variables'

export function defineDashboardThemes(monaco: typeof Monaco): void {
  /* Fully transparent so wrapper divs (--editor-bg / --editor-bg-secondary) show through */
  const transparent = '#00000000'
  const light: Monaco.editor.IStandaloneThemeData = {
    ...LIGHT_BASE,
    colors: {
      ...LIGHT_BASE.colors,
      'editor.background': transparent,
    },
  }
  const dark: Monaco.editor.IStandaloneThemeData = {
    ...DARK_BASE,
    colors: {
      ...DARK_BASE.colors,
      'editor.background': transparent,
    },
  }
  const lightVariables: Monaco.editor.IStandaloneThemeData = {
    ...LIGHT_BASE,
    colors: {
      ...LIGHT_BASE.colors,
      'editor.background': transparent,
    },
  }
  const darkVariables: Monaco.editor.IStandaloneThemeData = {
    ...DARK_BASE,
    colors: {
      ...DARK_BASE.colors,
      'editor.background': transparent,
    },
  }

  monaco.editor.defineTheme(DASHBOARD_LIGHT_THEME, light)
  monaco.editor.defineTheme(DASHBOARD_DARK_THEME, dark)
  monaco.editor.defineTheme(DASHBOARD_LIGHT_VARIABLES_THEME, lightVariables)
  monaco.editor.defineTheme(DASHBOARD_DARK_VARIABLES_THEME, darkVariables)
}
