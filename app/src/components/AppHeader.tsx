import { ChevronRight, Coins, Star, Zap } from 'lucide-react'
import { useGame } from '../game/GameContext'
import { GameIcon } from './GameIcon'

export interface AppHeaderProps {
  onOpenSettings: () => void
  onOpenRomance?: () => void
}

/**
 * 悬浮顶栏：头像 / 店名星标 / 金币与设置。
 * 不再铺满整宽的底色，而是把小面积描边控件浮在场景之上，
 * 与参考图的「圆头像 + 名牌 + 右侧圆钮」结构一致。
 */
export function AppHeader({ onOpenSettings, onOpenRomance }: AppHeaderProps) {
  const { state } = useGame()
  const mainRel = state.relationships[0]
  const stars = Math.max(1, Math.min(5, state.level))

  return (
    <header className="appbar">
      <div className="appbar__row">
        <button
          type="button"
          className="appbar__avatar"
          onClick={onOpenRomance}
          aria-label="打开恋爱主线"
          title="恋爱主线"
        >
          <GameIcon name="Heart" size={20} />
        </button>

        <div className="appbar__plate">
          <div className="appbar__title-row">
            <h1 className="appbar__name">{state.shopName}</h1>
            <span className="appbar__stars" aria-label={`店铺等级 ${state.level} 星`}>
              {Array.from({ length: stars }).map((_, i) => (
                <Star key={i} size={10} fill="currentColor" strokeWidth={0} />
              ))}
            </span>
          </div>
          <p className="appbar__sub">
            Lv.{state.level} · 魅力 {state.decor.length > 0 ? '在线' : '待布置'}
          </p>
        </div>

        <div className="appbar__actions">
          <span className="appbar__coin" title={`金币 ${state.coins}`}>
            <Coins size={14} />
            <b className="t-num">{state.coins}</b>
          </span>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={onOpenSettings}
            aria-label="打开存档与设置"
            title="存档与设置"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="appbar__res">
        <span className="chip chip--stamina">
          <span className="chip__icon">
            <Zap size={12} />
          </span>
          <span className="t-num">
            {state.stamina}/{state.staminaMax}
          </span>
          <span className="chip__sub">体力</span>
        </span>
        <span className="chip chip--rel">
          <span className="chip__icon">
            <GameIcon name="Heart" size={12} />
          </span>
          <span className="t-num">{mainRel?.value ?? 0}</span>
          <span className="chip__sub">{mainRel?.name ?? '关系'}</span>
        </span>
      </div>
    </header>
  )
}
