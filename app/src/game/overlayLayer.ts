import { useEffect } from 'react'

/**
 * 剧情续页是全屏模态层，但它渲染在 `.app` 内部。
 * `.app` 自带 z-index，会形成层叠上下文，内部再高的 z-index 也压不过
 * `.app` 外面的提示条（--z-toast）。此前用 `.app:has(...)` 提升 `.app` 的
 * 层级，但 :has() 在旧内核（ColorOS 等 Chromium 105 以下）不被支持，
 * 整条规则会被丢弃，遮罩和关闭按钮就会被提示条盖住。
 *
 * 这里改成显式切 class，兼容所有目标内核，行为与 :has() 规则一致。
 */
const OVERLAY_CLASS = 'app--story-overlay'

export function useAppStoryOverlay(active: boolean): void {
  useEffect(() => {
    if (typeof document === 'undefined') return
    const app = document.querySelector<HTMLElement>('.app')
    if (!app) return
    app.classList.toggle(OVERLAY_CLASS, active)
    return () => {
      app.classList.remove(OVERLAY_CLASS)
    }
  }, [active])
}
