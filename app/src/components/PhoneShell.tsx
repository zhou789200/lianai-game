import type { ReactNode } from 'react'

/**
 * 桌面端居中显示的手机画布。
 * 竖屏比例固定为 430 x 932，宽度在 375~430 之间自适应；
 * 小屏设备直接铺满视口，保证 375x812 起的可用性。
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
  return (
    <div className="stage">
      <div
        className="phone"
        role="application"
        aria-label="海风镇宠物咖啡馆"
        data-figure={figure ?? undefined}
        data-tone={tone}
      >
        {children}
      </div>
      <p className="stage__badge">Breeze Bay · Pet Cafe Prototype</p>
    </div>
  )
}
