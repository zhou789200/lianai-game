import { BookOpen, Heart, Home, PawPrint, Store } from 'lucide-react'
import { useGame } from '../game/GameContext'
import type { ViewKey } from '../game/types'

interface NavItem {
  key: ViewKey
  label: string
  Icon: typeof Home
}

const ITEMS: NavItem[] = [
  { key: 'home', label: '主页', Icon: Home },
  { key: 'story', label: '剧情', Icon: BookOpen },
  { key: 'cafe', label: '咖啡店', Icon: Store },
  { key: 'pet', label: '宠物', Icon: PawPrint },
  { key: 'romance', label: '恋爱', Icon: Heart },
]

export interface BottomNavProps {
  active: ViewKey
  onChange: (view: ViewKey) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  const { state } = useGame()

  // 红点：有未领取的每日任务时提示
  const hasClaimable = state.tasks.some((t) => !t.claimed && t.progress > 0)

  return (
    <nav className="nav" aria-label="主导航">
      {ITEMS.map(({ key, label, Icon }) => {
        const isActive = active === key
        const showBadge = key === 'home' && hasClaimable
        const accessibleLabel = showBadge ? `${label}，有可领取奖励` : label
        return (
          <button
            key={key}
            type="button"
            className={`nav__item${isActive ? ' is-active' : ''}`}
            onClick={() => onChange(key)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={accessibleLabel}
            title={accessibleLabel}
          >
            <span className="nav__icon">
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            </span>
            <span className="nav__text">{label}</span>
            {showBadge ? <span className="nav__badge" aria-hidden="true" /> : null}
          </button>
        )
      })}
    </nav>
  )
}
