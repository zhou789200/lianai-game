import { BookOpen, Heart, Home, PawPrint, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useGame } from '../game/GameContext'
import { todayKey } from '../game/storage'
import type { ViewKey } from '../game/types'

/** 红点说明气泡：每天最多提示一次，避免反复打扰 */
const TIP_SEEN_KEY = 'seabreeze-pet-cafe.nav-badge-tip'

function shouldShowTipToday(): boolean {
  try {
    return window.localStorage.getItem(TIP_SEEN_KEY) !== todayKey()
  } catch {
    // 隐私模式下 localStorage 不可用：只在本次会话里提示
    return true
  }
}

function rememberTipSeen(): void {
  try {
    window.localStorage.setItem(TIP_SEEN_KEY, todayKey())
  } catch {
    /* 忽略：下次还会提示一次，不影响功能 */
  }
}

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

  // 红点：有进度但还没领取的每日任务（奖励需要回主页的「今日安排」里领）
  const hasClaimable = state.tasks.some((t) => !t.claimed && t.progress > 0)

  // 红点第一次亮起时，用一条气泡把含义说明白：手机上既没有 hover，
  // title 也看不到，只留一个圆点玩家猜不出是什么。
  const [tipEligible] = useState(shouldShowTipToday)
  const [tipDismissed, setTipDismissed] = useState(false)
  const showTip = hasClaimable && tipEligible && !tipDismissed

  useEffect(() => {
    if (!showTip) return
    rememberTipSeen()
    const timer = window.setTimeout(() => setTipDismissed(true), 6000)
    return () => window.clearTimeout(timer)
  }, [showTip])

  return (
    <nav className="nav" aria-label="主导航">
      {ITEMS.map(({ key, label, Icon }) => {
        const isActive = active === key
        const showBadge = key === 'home' && hasClaimable
        const accessibleLabel = showBadge
          ? `${label}，今日安排里有奖励可领`
          : label
        return (
          <button
            key={key}
            type="button"
            className={`nav__item${isActive ? ' is-active' : ''}`}
            onClick={() => {
              setTipDismissed(true)
              onChange(key)
            }}
            aria-current={isActive ? 'page' : undefined}
            aria-label={accessibleLabel}
            title={accessibleLabel}
          >
            <span className="nav__icon">
              <Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
            </span>
            <span className="nav__text">{label}</span>
            {showBadge ? <span className="nav__badge" aria-hidden="true" /> : null}
            {showBadge && showTip ? (
              <span className="nav__tip" role="status">
                主页有奖可领
              </span>
            ) : null}
          </button>
        )
      })}
    </nav>
  )
}
