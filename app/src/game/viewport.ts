import { useEffect, useState } from 'react'

/**
 * 画布适配（唯一入口）
 * ============================================================
 * 所有页面都排在一块 430 宽的逻辑画布上，再由 `--app-scale`
 * 整体等比缩放到当前屏幕。桌面端保持 430×932 手机壳比例；手机端
 * 按宽度铺满，并把逻辑高度扩展/收缩到可视视口，避免长屏左右留边。
 * 这样：
 *   · 不再依赖 dvh / vw / svh 等各浏览器支持度不一的视口单位；
 *   · 手机端没有横向空带；
 *   · 字号、间距和触控尺寸保持统一，不会被屏幕比例拉扁；
 *   · 桌面端仍以完整手机画布居中展示。
 *
 * JS 只负责算出缩放比，并把结果写成 CSS 变量：
 *   --app-scale  缩放比（1 = 430×932 原始尺寸）
 *   --app-w/h    画布在屏幕上的像素尺寸
 *   --app-canvas-h 画布内部的逻辑高度（手机端随视口变化）
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
 * 视口「变大」后的收敛延迟。
 *
 * 地址栏 / 底部工具条收起会让可用高度变高，画布必须跟着长高，
 * 否则底部会露出一条页面底色。但这些收起动作是逐帧动画，
 * 事件触发时读到的是中间值：直接跟会让画布被连续缩放好几次。
 * 因此变大只登记候选值，等 200ms 没有新的变化再一次性应用；
 * 视口「变小」仍然立刻跟随——否则画布比屏幕高，上下会被裁。
 */
const GROW_SETTLE_MS = 200

/** 地址栏收放动画的收敛时间，视口变化后再补测几次拿到最终值 */
const RECHECK_DELAYS = [60, 200, 460]

/**
 * 浏览器工具栏顶部保护带。
 *
 * 默认必须为 0：ColorOS 自带浏览器的布局视口已经扣过地址栏，
 * 再用「布局视口 - 可视视口」推算会把页面整体下移，上下露底。
 * 只有确认某些浏览器真的把地址栏浮在页面上、visualViewport 又不报
 * offsetTop 时，才通过 URL 参数 ?topguard=<px> 做单机型微调。
 */
const MIN_TOP_GUARD = 12
const MAX_TOP_GUARD = 72

function readTopGuard() {
  if (typeof window === 'undefined') return 0
  const requested = Number(new URLSearchParams(window.location.search).get('topguard'))
  if (!Number.isFinite(requested) || requested < MIN_TOP_GUARD) return 0
  return Math.min(Math.round(requested), MAX_TOP_GUARD)
}

export interface CanvasMetrics {
  scale: number
  width: number
  height: number
  /** 画布内部的逻辑高度；手机端由可视视口除以缩放比得到 */
  canvasHeight: number
  /** 可视视口高度（浏览器工具栏之外真正能画的高度） */
  viewportH: number
  /** 可视视口在布局视口中的纵向偏移（iOS 键盘/滚动时非 0） */
  viewportTop: number
  /** 浏览器工具栏遮挡的顶部保护带（物理像素） */
  topGuard: number
}

function readViewport() {
  const vv = typeof window === 'undefined' ? null : window.visualViewport
  const w = Math.round(vv?.width || window.innerWidth || document.documentElement.clientWidth || DESIGN_W)
  const h = Math.round(vv?.height || window.innerHeight || document.documentElement.clientHeight || DESIGN_H)
  const top = Math.round(vv?.offsetTop || 0)
  const topGuard = readTopGuard()
  return { w, h, top, topGuard }
}

export function computeMetrics(w: number, h: number, top = 0, topGuard = 0): CanvasMetrics {
  const pad = w <= 480 ? 0 : DESKTOP_PAD
  const mobile = w <= 480
  const raw = mobile
    ? (w - pad * 2) / DESIGN_W
    : Math.min((w - pad * 2) / DESIGN_W, (h - pad * 2) / DESIGN_H)
  const scale = Number.isFinite(raw) && raw > 0 ? raw : 1
  const guard = mobile ? Math.max(0, topGuard) : 0
  const canvasHeight = mobile
    ? Math.max(1, (h - pad * 2 - guard) / scale)
    : DESIGN_H
  return {
    scale: Math.round(scale * 1e4) / 1e4,
    width: mobile ? w - pad * 2 : Math.round(DESIGN_W * scale),
    height: mobile ? h - pad * 2 - guard : Math.round(DESIGN_H * scale),
    canvasHeight: Math.round(canvasHeight * 1e2) / 1e2,
    viewportH: h,
    viewportTop: top,
    topGuard: guard,
  }
}

export function applyCanvasVars(metrics: CanvasMetrics) {
  const root = document.documentElement
  root.style.setProperty('--app-scale', String(metrics.scale))
  root.style.setProperty('--app-w', `${metrics.width}px`)
  root.style.setProperty('--app-h', `${metrics.height}px`)
  root.style.setProperty('--app-canvas-h', `${metrics.canvasHeight}px`)
  root.style.setProperty('--vv-h', `${metrics.viewportH}px`)
  root.style.setProperty('--vv-top', `${metrics.viewportTop}px`)
  root.style.setProperty('--top-guard', `${metrics.topGuard}px`)
}

/** 首帧渲染前同步写入，避免画布先按 fallback 尺寸出现再跳变。 */
export function syncCanvasVars(): CanvasMetrics {
  const { w, h, top, topGuard } = readViewport()
  const metrics = computeMetrics(w, h, top, topGuard)
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
      return {
        scale: 1,
        width: DESIGN_W,
        height: DESIGN_H,
        canvasHeight: DESIGN_H,
        viewportH: DESIGN_H,
        viewportTop: 0,
        topGuard: 0,
      }
    }
    const { w, h, top, topGuard } = readViewport()
    return computeMetrics(w, h, top, topGuard)
  })

  useEffect(() => {
    let prev = readViewport()
    let frame = 0
    const timers = new Set<number>()
    let growTimer = 0
    let pendingGrow: ReturnType<typeof readViewport> | null = null

    const measure = () => {
      frame = 0
      const next = readViewport()
      const widthChanged = Math.abs(next.w - prev.w) > 1
      // 收缩一定跟随（否则画布比视口高会被裁）；
      // 变大等动画收敛后再跟随，避免画布被连续缩放。
      const shrank = next.h < prev.h - 1 || next.w < prev.w - 1
      const grew = next.h > prev.h + 1
      const moved = next.top !== prev.top
      const guardChanged = next.topGuard !== prev.topGuard
      if (widthChanged || shrank || moved || guardChanged) {
        if (growTimer) {
          window.clearTimeout(growTimer)
          growTimer = 0
          pendingGrow = null
        }
        prev = next
        setMetrics(computeMetrics(next.w, next.h, next.top, next.topGuard))
        return
      }
      if (!grew) return
      // 只登记，不立刻重排；等这轮收放动画结束再应用最终高度。
      pendingGrow = next
      if (growTimer) window.clearTimeout(growTimer)
      growTimer = window.setTimeout(() => {
        growTimer = 0
        const settled = pendingGrow
        pendingGrow = null
        if (!settled) return
        const latest = readViewport()
        if (latest.h < settled.h - 1) return
        prev = latest
        setMetrics(computeMetrics(latest.w, latest.h, latest.top, latest.topGuard))
      }, GROW_SETTLE_MS)
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

    applyCanvasVars(computeMetrics(prev.w, prev.h, prev.top, prev.topGuard))
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.addEventListener('pageshow', schedule)
    window.addEventListener('focus', schedule)
    window.visualViewport?.addEventListener('resize', schedule)
    window.visualViewport?.addEventListener('scroll', schedule)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      if (growTimer) window.clearTimeout(growTimer)
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
