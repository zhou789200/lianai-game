import { useEffect, useState } from 'react'

/**
 * 画布适配（唯一入口）
 * ============================================================
 * 所有页面都排在一块 430×932 的逻辑画布上，再由 `--app-scale`
 * 整体等比缩放到当前屏幕。这样：
 *   · 不再依赖 dvh / vw / svh 等各浏览器支持度不一的视口单位；
 *   · 手机、平板、桌面窗口看到的版式、字号、留白完全一致；
 *   · 画布比例固定，不会被视口比例拉扁或拉长。
 *
 * JS 只负责算出缩放比，并把结果写成 CSS 变量：
 *   --app-scale  缩放比（1 = 430×932 原始尺寸）
 *   --app-w/h    画布在屏幕上的像素尺寸
 *   --vv-h/top   浏览器「可视视口」的高度与偏移，给 .stage 定位用
 *
 * 为什么要visualViewport：
 *   手机浏览器（Chrome / 微信 X5 / 夸克 / UC / 各家自带浏览器）的地址栏、
 *   工具栏有的占位、有的浮在页面上、有的滑动时自动收起。`innerHeight`
 *   在不同内核里含义并不一致，`visualViewport` 才是「真正看得见的那块」。
 *   以它为准，画布才不会一半被地址栏压住、一半被工具栏切掉。
 */
export const DESIGN_W = 430
export const DESIGN_H = 932

/** 桌面端给手机壳留出的四周留白（物理像素） */
const DESKTOP_PAD = 18

/**
 * 视口「变大」时的抖动阈值。
 * 地址栏收起会让可用高度突然变高，这种情况不重算，避免画布忽大忽小；
 * 但视口「变小」必须立刻跟随——否则画布会比屏幕高，上下被裁。
 */
const GROW_JITTER = 60

/** 地址栏收放动画的收敛时间，视口变化后再补测几次拿到最终值 */
const RECHECK_DELAYS = [60, 200, 460]

export interface CanvasMetrics {
  scale: number
  width: number
  height: number
  /** 可视视口高度（浏览器工具栏之外真正能画的高度） */
  viewportH: number
  /** 可视视口在布局视口中的纵向偏移（iOS 键盘/滚动时非 0） */
  viewportTop: number
}

function readViewport() {
  const vv = typeof window === 'undefined' ? null : window.visualViewport
  const w = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || DESIGN_W)
  const h = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || DESIGN_H)
  const top = Math.round(vv?.offsetTop || 0)
  return { w, h, top }
}

export function computeMetrics(w: number, h: number, top = 0): CanvasMetrics {
  const pad = w <= 480 ? 0 : DESKTOP_PAD
  const raw = Math.min((w - pad * 2) / DESIGN_W, (h - pad * 2) / DESIGN_H)
  const scale = Number.isFinite(raw) && raw > 0 ? raw : 1
  return {
    scale: Math.round(scale * 1e4) / 1e4,
    width: Math.round(DESIGN_W * scale),
    height: Math.round(DESIGN_H * scale),
    viewportH: h,
    viewportTop: top,
  }
}

export function applyCanvasVars(metrics: CanvasMetrics) {
  const root = document.documentElement
  root.style.setProperty('--app-scale', String(metrics.scale))
  root.style.setProperty('--app-w', `${metrics.width}px`)
  root.style.setProperty('--app-h', `${metrics.height}px`)
  root.style.setProperty('--vv-h', `${metrics.viewportH}px`)
  root.style.setProperty('--vv-top', `${metrics.viewportTop}px`)
}

/** 首帧渲染前同步写入，避免画布先按 fallback 尺寸出现再跳变。 */
export function syncCanvasVars(): CanvasMetrics {
  const { w, h, top } = readViewport()
  const metrics = computeMetrics(w, h, top)
  applyCanvasVars(metrics)
  return metrics
}

/**
 * 视口坐标 → 画布逻辑坐标。
 * 画布被整体缩放过，指针事件的 clientX/clientY 和
 * getBoundingClientRect() 都是屏幕物理像素，直接拿去给画布内的
 * 绝对定位元素用会偏移，统一在这里换算一次。
 */
export function toCanvasPoint(x: number, y: number): { x: number; y: number } {
  const canvas = document.querySelector<HTMLElement>('.phone__canvas')
  if (!canvas) return { x, y }
  const rect = canvas.getBoundingClientRect()
  const scale = rect.width / DESIGN_W || 1
  return { x: (x - rect.left) / scale, y: (y - rect.top) / scale }
}

export function useCanvasMetrics(): CanvasMetrics {
  const [metrics, setMetrics] = useState<CanvasMetrics>(() => {
    if (typeof window === 'undefined') {
      return { scale: 1, width: DESIGN_W, height: DESIGN_H, viewportH: DESIGN_H, viewportTop: 0 }
    }
    const { w, h, top } = readViewport()
    return computeMetrics(w, h, top)
  })

  useEffect(() => {
    let prev = readViewport()
    let frame = 0
    const timers = new Set<number>()

    const measure = () => {
      frame = 0
      const next = readViewport()
      const widthChanged = Math.abs(next.w - prev.w) > 1
      // 收缩一定跟随（否则画布比视口高会被裁）；
      // 变大只有在超过阈值时才重算，避免地址栏动画导致画布反复缩放。
      const shrank = next.h < prev.h - 1 || next.w < prev.w - 1
      const grewALot = next.h - prev.h > GROW_JITTER
      const moved = next.top !== prev.top
      if (!widthChanged && !shrank && !grewALot && !moved) return
      prev = next
      setMetrics(computeMetrics(next.w, next.h, next.top))
    }

    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
      // 地址栏收起/弹出有动画，事件触发时拿到的常是中间值，补测几次收敛
      for (const delay of RECHECK_DELAYS) {
        const timer = window.setTimeout(() => {
          timers.delete(timer)
          measure()
        }, delay)
        timers.add(timer)
      }
    }

    applyCanvasVars(computeMetrics(prev.w, prev.h, prev.top))
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.addEventListener('pageshow', schedule)
    window.addEventListener('focus', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      timers.forEach((t) => window.clearTimeout(t))
      timers.clear()
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.removeEventListener('pageshow', schedule)
      window.removeEventListener('focus', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
      window.visualViewport?.removeEventListener('scroll', schedule)
    }
  }, [])

  useEffect(() => {
    applyCanvasVars(metrics)
  }, [metrics])

  return metrics
}
