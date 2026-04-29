type IdleDeadlineLike = {
  didTimeout: boolean
  timeRemaining: () => number
}

type IdleCallback = (deadline: IdleDeadlineLike) => void

type IdleWindow = Window &
  typeof globalThis & {
    requestIdleCallback?: (
      callback: IdleCallback,
      options?: {
        timeout?: number
      },
    ) => number
    cancelIdleCallback?: (handle: number) => void
  }

export function scheduleIdleTask(callback: () => void, timeout = 120) {
  if (typeof window === 'undefined') {
    return () => {}
  }

  const idleWindow = window as IdleWindow

  if (typeof idleWindow.requestIdleCallback === 'function') {
    const handle = idleWindow.requestIdleCallback(() => callback(), {
      timeout,
    })

    return () => {
      idleWindow.cancelIdleCallback?.(handle)
    }
  }

  const handle = window.setTimeout(callback, 0)
  return () => {
    window.clearTimeout(handle)
  }
}
