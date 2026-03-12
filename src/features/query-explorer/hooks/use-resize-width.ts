import { useCallback, useEffect, useRef, useState } from 'react'

export type UseResizeWidthOptions = {
  defaultWidth: number
  minWidth: number
  maxWidth: number
}

export function useResizeWidth({
  defaultWidth,
  minWidth,
  maxWidth,
}: UseResizeWidthOptions) {
  const [width, setWidth] = useState(defaultWidth)
  const dragCleanupRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) {
        dragCleanupRef.current()
        dragCleanupRef.current = null
      }
    }
  }, [])

  const onResizeStart = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidth = width
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'

      const onPointerMove = (ev: PointerEvent) => {
        const delta = ev.clientX - startX
        setWidth(Math.min(maxWidth, Math.max(minWidth, startWidth + delta)))
      }

      const cleanup = () => {
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        document.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerup', cleanup)
        dragCleanupRef.current = null
      }

      dragCleanupRef.current = cleanup
      document.addEventListener('pointermove', onPointerMove)
      document.addEventListener('pointerup', cleanup)
    },
    [width, minWidth, maxWidth],
  )

  return [width, onResizeStart] as const
}
