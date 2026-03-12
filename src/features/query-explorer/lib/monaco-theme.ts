/**
 * Dashboard-matching themes for Monaco Editor.
 * Colors aligned with src/styles/theme.css (light/dark).
 */
import type * as Monaco from 'monaco-editor'

const LIGHT: Monaco.editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#1e293b',
    'editorLineNumber.foreground': '#94a3b8',
    'editor.selectionBackground': '#e2e8f0',
    'editorCursor.foreground': '#7404e4',
  },
}

const DARK: Monaco.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: {
    'editor.background': '#0f172a',
    'editor.foreground': '#f8fafc',
    'editorLineNumber.foreground': '#64748b',
    'editor.selectionBackground': '#1e293b',
    'editorCursor.foreground': '#7404e4',
  },
}

export const DASHBOARD_LIGHT_THEME = 'dashboard-light'
export const DASHBOARD_DARK_THEME = 'dashboard-dark'

export function defineDashboardThemes(monaco: typeof Monaco): void {
  monaco.editor.defineTheme(DASHBOARD_LIGHT_THEME, LIGHT)
  monaco.editor.defineTheme(DASHBOARD_DARK_THEME, DARK)
}
