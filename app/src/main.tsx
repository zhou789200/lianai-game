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
import App from './App'
import { syncCanvasVars } from './game/viewport'

const container = document.getElementById('root')
if (!container) {
  throw new Error('找不到 #root 挂载节点')
}

// 首帧前先把画布缩放比写进 CSS 变量，避免挂载瞬间按 fallback 尺寸闪一下。
syncCanvasVars()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
