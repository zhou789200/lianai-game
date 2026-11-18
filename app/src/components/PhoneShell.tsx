import type { ReactNode } from 'react'
import { DESIGN_W, useCanvasMetrics } from '../game/viewport'

/**
 * 手机画布容器。
 *
 * 外层 `.phone` 只负责手机壳（尺寸 = 逻辑画布 × 缩放比、圆角、投影），
 * 内层 `.phone__canvas` 固定 430 逻辑宽度，高度由当前可视视口决定，
 * 并用 transform 等比缩放。手机端因此能横向铺满，桌面端仍保持完整手机壳。
 *
 * figure 属性会把「立绘留白区」的高度变量挂到画布上，
 * 让内容层避开场景底图里人物与宠物所在的位置。
 */
export function PhoneShell({
  children,
  figure = null,
  tone = 'default',
}: {
  children: ReactNode
  figure?: 'character' | 'pet' | null
  tone?: 'default' | 'cafe'
}) {
  const metrics = useCanvasMetrics()

  return (
    <div className="stage">
      <div
        className="phone"
        role="application"
        aria-label="海风镇宠物咖啡馆"
        data-figure={figure ?? undefined}
        data-tone={tone}
        style={{
          ['--app-scale' as string]: String(metrics.scale),
          marginTop: metrics.topGuard,
        }}
      >
        <div
          className="phone__canvas"
          style={{
            width: DESIGN_W,
            height: metrics.canvasHeight,
            transform: `scale(${metrics.scale})`,
          }}
        >
          {children}
        </div>
      </div>
      <p className="stage__badge">Breeze Bay · Pet Cafe Prototype</p>
    </div>
  )
}
