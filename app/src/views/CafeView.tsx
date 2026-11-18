import { useEffect } from 'react'
import { useGame } from '../game/GameContext'
import { BUSINESS_STAMINA_COST } from '../game/storage'
import { CAFE_RECIPES } from '../data/cafeContent'
import { CafePlayScene } from '../components/CafePlayScene'
import { preloadCafeArt } from '../assets/preload'

function makeRunId(): string {
  return `run-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e6).toString(36)}`
}

export interface CafeViewProps {
  onStart: (runId: string) => void
}

export function CafeView({ onStart }: CafeViewProps) {
  const { state, actions, pushNotice } = useGame()

  // 咖啡店专用图（约 1MB）只在真正进店时预热，不占主页首屏带宽。
  useEffect(() => {
    preloadCafeArt()
  }, [])

  const menuRecipes = state.recipes.filter((id) => CAFE_RECIPES[id])
  const canStart = state.stamina >= BUSINESS_STAMINA_COST && menuRecipes.length > 0

  const startBusiness = () => {
    if (menuRecipes.length === 0) {
      pushNotice('error', '还没有菜单', '先去「菜单研发」解锁至少一款手作饮品。')
      return
    }
    const runId = makeRunId()
    const result = actions.beginCafeRun(runId)
    if (result.ok) onStart(runId)
  }

  return (
    <div className="screen screen--cafe scroll">
      <CafePlayScene canStart={canStart} onStart={startBusiness} />
    </div>
  )
}
