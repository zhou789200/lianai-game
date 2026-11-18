import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/tokens.css'
import './styles/base.css'
import './styles/scene.css'
import './styles/ui.css'
import './styles/views.css'
import './styles/cafe-run.css'
import './styles/cafe-play-scene.css'
import './styles/cafe-show.css'
import './styles/motion.css'
import './styles/low-power.css'
import App from './App'
import { syncCanvasVars } from './game/viewport'
import { initLowPowerMode } from './game/lowPower'

const container = document.getElementById('root')
if (!container) {
  throw new Error('找不到 #root 挂载节点')
}

// 厂商浏览器长按会弹「选择复制 / 标记广告 / 页面内查找」，营业里的长按加工
// 会被这个原生菜单盖住并中断。CSS 的 touch-callout 在部分内核里不生效，
// 这里兜底拦掉上下文菜单，只放行输入框和显式标记为可选择的区域。
const SELECTABLE = 'input, textarea, [contenteditable="true"], .is-selectable'

document.addEventListener(
  'contextmenu',
  (event) => {
    const target = event.target as HTMLElement | null
    if (target?.closest(SELECTABLE)) return
    event.preventDefault()
  },
  { passive: false },
)

// CSS 的 user-select 在少数厂商内核里对长按无效，这里再拦一次选择起点
document.addEventListener('selectstart', (event) => {
  const target = event.target as HTMLElement | null
  if (target?.closest(SELECTABLE)) return
  event.preventDefault()
})

// 首帧前先把画布缩放比写进 CSS 变量，避免挂载瞬间按 fallback 尺寸闪一下。
initLowPowerMode()
syncCanvasVars()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
