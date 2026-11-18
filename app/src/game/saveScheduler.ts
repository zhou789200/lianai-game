/**
 * 存档写入节流。
 *
 * 此前每次 state 变化都会同步 `JSON.stringify` 整个存档并写 localStorage：
 * 营业中每一单都会触发一次，存量大（storyTraces / storyCache）时会在主线程
 * 产生可感知的卡顿。这里把写入合并到一次，并保证：
 *   · 首次修改最多等待 delay 毫秒后落盘；
 *   · 连续修改时不会无限延后（每次修改都会刷新计时）；
 *   · flush() 立即补齐（页面隐藏 / 卸载 / 切换账号前调用）。
 */
export interface SaveScheduler {
  schedule: () => void
  flush: () => void
  cancel: () => void
}

export function createSaveScheduler(
  write: () => void,
  delayMs = 400,
  setTimer: (fn: () => void, ms: number) => number = (fn, ms) =>
    window.setTimeout(fn, ms),
  clearTimer: (id: number) => void = (id) => window.clearTimeout(id),
): SaveScheduler {
  let timer: number | null = null
  let dirty = false

  const clear = () => {
    if (timer !== null) {
      clearTimer(timer)
      timer = null
    }
  }

  const flush = () => {
    clear()
    if (!dirty) return
    dirty = false
    write()
  }

  return {
    schedule() {
      dirty = true
      clear()
      timer = setTimer(() => {
        timer = null
        if (!dirty) return
        dirty = false
        write()
      }, delayMs)
    },
    flush,
    cancel() {
      clear()
      dirty = false
    },
  }
}
