import { useMemo } from 'react'
import { PawPrint } from 'lucide-react'
import { useGame } from '../game/GameContext'
import { GameIcon } from './GameIcon'
import { Modal } from './Modal'
import { Panel, SectionLabel } from './Panel'
import { StatBar } from './StatBar'
import { UiButton } from './UiButton'
import { DECOR, RHYTHM, STORYBOOK_CHAPTERS, TASKS } from '../data/content'
import { CHAPTERS } from '../game/story'
import type { ViewKey } from '../game/types'

const RHYTHM_ICON_VIEW: Record<string, ViewKey> = {
  business: 'business',
  cafe: 'cafe',
  pet: 'pet',
  romance: 'romance',
  story: 'story',
}

function currentSlotIndex(): number {
  const h = new Date().getHours()
  if (h < 12) return 0
  if (h < 17) return 1
  if (h < 21) return 2
  return 3
}

/**
 * 今日安排：把主界面原本堆叠的节奏 / 宠物状态 / 任务 / 成长收进一个抽屉，
 * 让主界面只剩场景与剧情。功能与旧版完全一致。
 */
export function QuestSheet({
  onClose,
  onNavigate,
}: {
  onClose: () => void
  onNavigate: (v: ViewKey) => void
}) {
  const { state, actions, expToNext, charm, pushNotice } = useGame()
  const slotIndex = currentSlotIndex()

  const claimable = useMemo(
    () =>
      TASKS.map((def) => ({ def, t: state.tasks.find((x) => x.id === def.id) })).filter(
        (x) => x.t && !x.t.claimed && x.t.progress >= x.def.target,
      ),
    [state.tasks],
  )

  const go = (v: ViewKey) => {
    onClose()
    onNavigate(v)
  }

  return (
    <Modal title="今日安排" subtitle="节奏、布丁、任务与成长都在这里" onClose={onClose}>
      {/* ---------- 今日节奏 ---------- */}
      <Panel title="今日节奏" icon="Clock" hint={RHYTHM[slotIndex].label}>
        <div className="rhythm">
          {RHYTHM.map((r, i) => (
            <button
              key={r.id}
              type="button"
              className={`rhythm__item${i === slotIndex ? ' is-now' : ''}`}
              onClick={() => go(RHYTHM_ICON_VIEW[r.view])}
              aria-label={`${r.label} ${r.time} ${r.desc}`}
            >
              <GameIcon name={r.icon} size={16} />
              <span className="rhythm__label">{r.label}</span>
              <span className="rhythm__time t-num">{r.time}</span>
            </button>
          ))}
        </div>
        <p className="hero__text" style={{ marginTop: 8 }}>
          {RHYTHM[slotIndex].desc}
        </p>
      </Panel>

      {/* ---------- 布丁状态 ---------- */}
      <Panel title={`${state.pet.name} 的状态`} icon="PawPrint" tone="sea" hint={`Lv.${state.level} · 魅力 ${charm}`}>
        <div className="pet-mini">
          <div className="pet-avatar" aria-hidden="true">
            <PawPrint size={26} />
          </div>
          <div className="pet-mini__body">
            <StatBar icon="Fish" label="饱食" value={state.pet.hunger} tone="hunger" />
            <StatBar icon="Droplets" label="清洁" value={state.pet.cleanliness} tone="clean" />
            <StatBar icon="Smile" label="心情" value={state.pet.mood} tone="mood" />
            <StatBar icon="Heart" label="亲密度" value={state.pet.intimacy} tone="intimacy" />
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 10 }}>
          <UiButton variant="sea" size="sm" icon={<PawPrint size={14} />} onClick={() => go('pet')}>
            去找布丁
          </UiButton>
        </div>
      </Panel>

      {/* ---------- 每日任务 ---------- */}
      <SectionLabel icon="ClipboardList">每日任务</SectionLabel>
      {claimable.length > 0 ? (
        <div className="notice-strip">
          <GameIcon name="Award" size={15} />
          <span>有 {claimable.length} 个任务可以领奖了</span>
        </div>
      ) : null}
      <div className="task-list">
        {TASKS.map((def) => {
          const t = state.tasks.find((x) => x.id === def.id) ?? { id: def.id, progress: 0, claimed: false }
          const done = t.progress >= def.target
          const canClaim = done && !t.claimed
          let label = '未完成'
          if (t.claimed) label = '已领取'
          else if (canClaim) label = '可领取'

          return (
            <article key={def.id} className={`task-card${t.claimed ? ' is-claimed' : ''}`}>
              <span className="task-card__icon">
                <GameIcon name={def.icon} size={17} />
              </span>
              <div className="task-card__body">
                <div className="task-card__head">
                  <h3 className="task-card__title">{def.name}</h3>
                  <span className="task-card__reward t-num">
                    +{def.rewardCoins} 金币 · +{def.rewardExp} 经验
                  </span>
                </div>
                <p className="task-card__desc">{def.desc}</p>
                <div className="task-card__progress">
                  <div className="task-card__track">
                    <div
                      className="task-card__fill"
                      style={{ width: `${Math.min(100, (t.progress / def.target) * 100)}%` }}
                    />
                  </div>
                  <span className="task-card__count t-num">
                    {Math.min(t.progress, def.target)}/{def.target}
                  </span>
                </div>
              </div>
              <UiButton
                variant={canClaim ? 'primary' : 'ghost'}
                size="sm"
                disabled={!canClaim}
                onClick={() => {
                  const r = actions.claimTask(def.id)
                  if (!r.ok) pushNotice('error', '领取失败', r.message)
                }}
              >
                {label}
              </UiButton>
            </article>
          )
        })}
      </div>

      {/* ---------- 成长 ---------- */}
      <Panel title="成长与解锁" icon="TrendingUp" hint={`魅力 ${charm}`}>
        <StatBar
          icon="Star"
          label={`店铺等级 Lv.${state.level}`}
          value={state.exp}
          max={expToNext}
          showMax
          tone="exp"
        />
        <div className="unlock-row">
          <span className="tag tag--gold">已研发菜单 {state.recipes.length}/6</span>
          <span className="tag">
            已购装饰 {state.decor.length}/{DECOR.length}
          </span>
          <span className="tag tag--coral">
            恋爱 {state.completedChapters.length}/{CHAPTERS.length}
          </span>
          <span className="tag">
            剧情 {state.storyCompletedChapters.length}/{STORYBOOK_CHAPTERS.length}
          </span>
        </div>
      </Panel>
    </Modal>
  )
}
