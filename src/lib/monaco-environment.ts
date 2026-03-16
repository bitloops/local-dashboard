/**
 * Configure Monaco to use locally bundled workers (no CDN).
 * Must be imported before any code that loads Monaco.
 */
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker.js?worker'
import GraphQLWorker from 'monaco-graphql/esm/graphql.worker.js?worker'

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
    if (label === 'graphql') {
      return new GraphQLWorker()
    }
    return new EditorWorker()
  },
}
