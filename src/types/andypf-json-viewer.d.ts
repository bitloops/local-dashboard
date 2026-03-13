declare module '@andypf/json-viewer/dist/esm/react/JsonViewer' {
  import type { ComponentType } from 'react'
  type JsonViewerProps = {
    data?: object
    theme?: string | Record<string, string>
    expanded?: number | boolean
    showDataTypes?: boolean
    showToolbar?: boolean
    showCopy?: boolean
    showSize?: boolean
    indent?: number
    expandIconType?: string
  }
  const JsonViewer: ComponentType<JsonViewerProps>
  export default JsonViewer
}
