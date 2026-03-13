/**
 * Configure Monaco to use locally bundled workers (no CDN).
 * Must be imported before any code that loads Monaco.
 */
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'

declare global {
  interface Window {
    MonacoEnvironment?: {
      getWorker: (_: unknown, label: string) => Worker
    }
  }
}

window.MonacoEnvironment = {
  getWorker: (source: unknown, label: string) => {
    void source
    void label
    // GraphQL and plain text use the generic editor worker (bundled locally)
    return new EditorWorker()
  },
}
