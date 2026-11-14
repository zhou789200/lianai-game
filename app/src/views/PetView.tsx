import { useEffect, useRef, useState } from 'react'
import { Coins } from 'lucide-react'
import { useGame } from '../game/GameContext'
import { PET_ACTIONS } from '../data/content'
import {
  PET_FEED_HANDS,
  PET_GROOM_HANDS,
  PET_PHOTO_HANDS,
  PET_PLAY_HANDS,
  petAsset,
} from '../assets/manifest'
import { playMeow } from '../game/petVoice'
import { GameIcon } from '../components/GameIcon'
import { Panel, SectionLabel } from '../components/Panel'
import { StatBar } from '../components/StatBar'
import { UiButton } from '../components/UiButton'
import type { PetActionDef } from '../game/types'

function formatTime(at: number): string {
  const d = new Date(at)
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** 点一下小猫会得到的一句「反应」：cry 会飘在头顶，line 落在状态条上 */
const PET_REACTIONS = [
  { cry: '喵～', icon: 'Heart', line: '布丁仰起头看你' },
  { cry: '咪——', icon: 'Smile', line: '布丁眯起眼睛蹭了蹭你' },
  { cry: '喵呜', icon: 'HeartHandshake', line: '布丁把下巴搁在你手心里' },
  { cry: '呼噜呼噜', icon: 'PawPrint', line: '布丁踩了踩你的手背' },
  { cry: '喵！', icon: 'Smile', line: '布丁甩了甩尾巴尖' },
]

const CARE_CAPTIONS: Record<PetActionDef['id'], string> = {
  feed: '你把刚拌好的猫饭轻轻放到布丁面前',
  play: '你晃了晃逗猫棒，布丁立刻抬起了头',
  groom: '你顺着布丁的背毛慢慢梳下去',
  photo: '你举起相机，布丁正好看向镜头',
}

const CARE_HANDS = {
  feed: PET_FEED_HANDS,
  play: PET_PLAY_HANDS,
  groom: PET_GROOM_HANDS,
  photo: PET_PHOTO_HANDS,
} satisfies Record<PetActionDef['id'], typeof PET_FEED_HANDS>

function CareHand({ action }: { action: PetActionDef['id'] }) {
  return (
    <img
      className={`pet-care-act__image pet-care-act__image--${action}`}
      src={CARE_HANDS[action].src}
      alt=""
      draggable={false}
    />
  )
}

export function PetView() {
  const { state, actions, pushNotice } = useGame()
  const [pending, setPending] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<{ icon: string; text: string; at: number } | null>(null)
  const [careMoment, setCareMoment] = useState<{
    id: PetActionDef['id']
    seq: number
  } | null>(null)

  const { pet } = state

  const [reaction, setReaction] = useState<{ id: number; cry: string; icon: string; line: string } | null>(
    null,
  )
  const reactionTimer = useRef<number | null>(null)
  const reactionSeq = useRef(0)
  const lastReaction = useRef(-1)
  const cardRef = useRef<HTMLDivElement>(null)
  const careTimer = useRef<number | null>(null)
  const careSeq = useRef(0)
  const actionTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
      if (careTimer.current !== null) window.clearTimeout(careTimer.current)
      if (actionTimer.current !== null) window.clearTimeout(actionTimer.current)
    },
    [],
  )

  /** 撸猫：叫一声 + 歪头，不消耗体力也不改数值，纯互动 */
  const petTheCat = () => {
    if (careMoment) return
    // 不指定语气：每点一下都换一种叫声，比反复播同一段更像真猫
    playMeow()
    // 不连续抽到同一句，手感更像真猫
    let index = Math.floor(Math.random() * PET_REACTIONS.length)
    if (index === lastReaction.current) index = (index + 1) % PET_REACTIONS.length
    lastReaction.current = index

    const id = reactionSeq.current + 1
    reactionSeq.current = id
    setReaction({ id, ...PET_REACTIONS[index] })
    if (reactionTimer.current !== null) window.clearTimeout(reactionTimer.current)
    reactionTimer.current = window.setTimeout(() => {
      setReaction((current) => (current?.id === id ? null : current))
      reactionTimer.current = null
    }, 1600)
  }

  // 立绘与一句话状态都跟着数值走：心情低会背过身，饿/脏会先提示照料
  const pose = petAsset(pet.mood)
  const petStatus =
    pet.hunger < 35
      ? { icon: 'Fish', text: `${pet.name}守着空碗，尾巴一下一下拍地板` }
      : pet.cleanliness < 35
        ? { icon: 'Droplets', text: `${pet.name}的毛有点乱，正等着你梳一梳` }
        : pet.mood < 35
          ? { icon: 'CloudRain', text: `${pet.name}背对着你，好像不太开心` }
          : pet.mood >= 70
            ? { icon: 'Smile', text: `${pet.name}今天心情很好，正在窗边晒太阳` }
            : { icon: 'PawPrint', text: `${pet.name}趴在窗台上打盹` }

  const doAction = (def: PetActionDef) => {
    if (pending) return
    cardRef.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })

    const seq = careSeq.current + 1
    careSeq.current = seq
    setCareMoment({ id: def.id, seq })
    if (careTimer.current !== null) window.clearTimeout(careTimer.current)
    careTimer.current = window.setTimeout(() => {
      setCareMoment((current) => (current?.seq === seq ? null : current))
      careTimer.current = null
    }, 2200)

    setPending(def.id)
    // 短暂的“互动中”状态，给玩家真实的加载反馈
    if (actionTimer.current !== null) window.clearTimeout(actionTimer.current)
    actionTimer.current = window.setTimeout(() => {
      const r = actions.petAction(def.id)
      setPending(null)
      if (!r.ok) {
        pushNotice('error', '互动没有成功', r.message)
        actionTimer.current = null
        return
      }
      // 四种照料都从 8 种叫声里随机轮转取一声，点哪个按钮都不会重复上一声
      playMeow()
      setFeedback({ icon: def.icon, text: r.message, at: Date.now() })
      actionTimer.current = null
    }, 620)
  }

  const disabledReason = (def: PetActionDef): string | null => {
    if (state.coins < def.cost) return `还差 ${def.cost - state.coins} 金币`
    if (state.stamina < def.staminaCost) return '体力不足'
    return null
  }

  return (
    <div className="screen screen--pet scroll">
      {/* ---------- 宠物档案 ---------- */}
      <div ref={cardRef} className="pet-card-wrap">
        <Panel tone="sea" className="pet-card">
        {/* ---------- 宠物立绘 ---------- */}
        <button
          type="button"
          className={[
            'pet-hero',
            reaction ? 'pet-hero--react' : '',
            careMoment ? `pet-hero--performing pet-hero--${careMoment.id}` : '',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={petTheCat}
          aria-label={`摸摸${pet.name}，它会叫一声`}
        >
          <span className="pet-hero__halo" aria-hidden="true" />
          {/* 只保留一张猫图；动作变化时整体重挂载，避免旧动画帧残留在画面上。 */}
          <span className="pet-hero__body">
            <img
              className="pet-hero__img"
              key={`${pose.id}-${reaction?.id ?? careMoment?.seq ?? 'idle'}`}
              src={pose.src}
              alt=""
              draggable={false}
            />
          </span>
          {reaction ? (
            <span className="pet-hero__bubble" aria-hidden="true">
              {reaction.cry}
            </span>
          ) : null}
          {reaction ? (
            <span className="pet-hero__hearts" aria-hidden="true">
              <GameIcon name="Heart" size={11} />
              <GameIcon name="Heart" size={9} />
              <GameIcon name="Heart" size={12} />
            </span>
          ) : null}
          {careMoment ? (
            <span
              className={`pet-care-act pet-care-act--${careMoment.id}`}
              key={careMoment.seq}
              aria-hidden="true"
            >
              <CareHand action={careMoment.id} />
              <span className="pet-care-act__glow" />
              {careMoment.id === 'photo' ? <span className="pet-care-act__flash" /> : null}
            </span>
          ) : null}
          <span className="pet-hero__note" role="status">
            <GameIcon name={reaction ? reaction.icon : petStatus.icon} size={13} />
            {reaction ? reaction.line : careMoment ? CARE_CAPTIONS[careMoment.id] : petStatus.text}
          </span>
        </button>

        <div className="pet-card__top">
          <div className="pet-card__id">
            <h2 className="pet-card__name">{pet.name}</h2>
            <p className="pet-card__meta">
              {pet.breed} · {pet.age}
            </p>
            <div className="pet-card__tags">
              <span className="tag tag--coral">亲密度 {pet.intimacy}</span>
              <span className="tag">互动 {state.stats.petInteractions} 次</span>
            </div>
          </div>
        </div>

        <div className="pet-card__stats">
          <StatBar icon="Fish" label="饱食" value={pet.hunger} tone="hunger" />
          <StatBar icon="Droplets" label="清洁" value={pet.cleanliness} tone="clean" />
          <StatBar icon="Smile" label="心情" value={pet.mood} tone="mood" />
          <StatBar icon="Heart" label="亲密度" value={pet.intimacy} tone="intimacy" />
        </div>
        </Panel>
      </div>

      {/* ---------- 互动 ---------- */}
      <SectionLabel icon="Sparkles">今天想做什么</SectionLabel>

      <div className="pet-actions">
        {PET_ACTIONS.map((def) => {
          const reason = disabledReason(def)
          const isLoading = pending === def.id
          return (
            <article key={def.id} className="pet-action">
              {/* head 用两行网格：图标只跟标题那一行居中，描述单独占第二行，
                  这样图标圆心与标题中线严格对齐，不会随描述行数上下漂 */}
              <div className="pet-action__head">
                <span className="pet-action__icon" aria-hidden="true">
                  <GameIcon name={def.icon} size={19} />
                </span>
                <h3 className="pet-action__name">{def.name}</h3>
                <p className="pet-action__desc">{def.desc}</p>
              </div>

              <div className="pet-action__costs">
                {def.cost > 0 ? (
                  <span className={`tag t-num${state.coins < def.cost ? ' tag--locked' : ''}`}>
                    <Coins size={12} /> {def.cost}
                  </span>
                ) : (
                  <span className="tag tag--gold">免费</span>
                )}
                {def.staminaCost > 0 ? (
                  <span
                    className={`tag t-num${state.stamina < def.staminaCost ? ' tag--locked' : ''}`}
                  >
                    <GameIcon name="Zap" size={12} /> {def.staminaCost}
                  </span>
                ) : null}
              </div>

              <UiButton
                variant={reason ? 'ghost' : 'sea'}
                size="sm"
                block
                loading={isLoading}
                disabled={!!reason || pending !== null}
                onClick={() => doAction(def)}
              >
                {isLoading ? '互动中…' : reason ?? def.name}
              </UiButton>
            </article>
          )
        })}
      </div>

      {/* ---------- 即时反馈 ---------- */}
      {feedback ? (
        <div className="pet-feedback" role="status">
          <span className="pet-feedback__icon">
            <GameIcon name={feedback.icon} size={16} />
          </span>
          <div>
            <strong>布丁的反应</strong>
            <p>{feedback.text}</p>
          </div>
        </div>
      ) : null}

      {/* ---------- 宠物日记 ---------- */}
      <Panel title="宠物日记" icon="BookOpen" hint={`${pet.diary.length} 条`}>
        {pet.diary.length === 0 ? (
          <p className="empty">还没有记录。和布丁互动一次就会写下一条日记。</p>
        ) : (
          <ul className="diary">
            {pet.diary.slice(0, 8).map((d) => (
              <li key={d.id} className="diary__item">
                <span className="diary__icon">
                  <GameIcon name={d.icon} size={15} />
                </span>
                <div className="diary__body">
                  <p className="diary__text">{d.text}</p>
                  <span className="diary__time t-num">{formatTime(d.at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
