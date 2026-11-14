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
 */
export const DESIGN_W = 430
export const DESIGN_H = 932

/** 桌面端给手机壳留出的四周留白（物理像素） */
const DESKTOP_PAD = 18

/** 移动端地址栏收放带来的高度抖动阈值，小于它不重算，避免画布跟着跳 */
const HEIGHT_JITTER = 60

export interface CanvasMetrics {
  scale: number
  width: number
  height: number
}

function readViewport() {
  const w = Math.round(window.innerWidth || document.documentElement.clientWidth || DESIGN_W)
  const h = Math.round(window.innerHeight || document.documentElement.clientHeight || DESIGN_H)
  return { w, h }
}

export function computeMetrics(w: number, h: number): CanvasMetrics {
  const pad = w <= 480 ? 0 : DESKTOP_PAD
  const raw = Math.min((w - pad * 2) / DESIGN_W, (h - pad * 2) / DESIGN_H)
  const scale = Number.isFinite(raw) && raw > 0 ? raw : 1
  return {
    scale: Math.round(scale * 1e4) / 1e4,
    width: Math.round(DESIGN_W * scale),
    height: Math.round(DESIGN_H * scale),
  }
}

export function applyCanvasVars(metrics: CanvasMetrics) {
  const root = document.documentElement
  root.style.setProperty('--app-scale', String(metrics.scale))
  root.style.setProperty('--app-w', `${metrics.width}px`)
  root.style.setProperty('--app-h', `${metrics.height}px`)
}

/** 首帧渲染前同步写入，避免画布先按 fallback 尺寸出现再跳变。 */
export function syncCanvasVars(): CanvasMetrics {
  const { w, h } = readViewport()
  const metrics = computeMetrics(w, h)
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
    if (typeof window === 'undefined') return { scale: 1, width: DESIGN_W, height: DESIGN_H }
    const { w, h } = readViewport()
    return computeMetrics(w, h)
  })

  useEffect(() => {
    let prev = readViewport()
    let frame = 0

    const measure = () => {
      frame = 0
      const next = readViewport()
      const widthChanged = Math.abs(next.w - prev.w) > 1
      // 地址栏收放会让 innerHeight 变化几十像素，忽略它，画布不跟着缩放。
      const heightChanged = Math.abs(next.h - prev.h) > HEIGHT_JITTER
      if (!widthChanged && !heightChanged) return
      prev = next
      setMetrics(computeMetrics(next.w, next.h))
    }

    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(measure)
    }

    applyCanvasVars(computeMetrics(prev.w, prev.h))
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    window.visualViewport?.addEventListener('resize', schedule)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('orientationchange', schedule)
      window.visualViewport?.removeEventListener('resize', schedule)
    }
  }, [])

  useEffect(() => {
    applyCanvasVars(metrics)
  }, [metrics])

  return metrics
}
