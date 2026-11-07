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

const container = document.getElementById('root')
if (!container) {
  throw new Error('找不到 #root 挂载节点')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
