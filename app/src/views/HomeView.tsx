import { useEffect, useMemo, useState } from 'react'
import { BookOpen, ChevronRight, Coffee, PawPrint, Sparkles } from 'lucide-react'
import { useGame } from '../game/GameContext'
import { DialogueBand } from '../components/DialogueBand'
import { QuestSheet } from '../components/QuestSheet'
import { RHYTHM, TASKS } from '../data/content'
import { startHomeBgm } from '../game/homeBgm'
import { getCurrentStorybookChapter, storybookProgress } from '../game/storybook'
import type { ViewKey } from '../game/types'

function currentSlotIndex(): number {
  const h = new Date().getHours()
  if (h < 12) return 0
  if (h < 17) return 1
  if (h < 21) return 2
  return 3
}

/**
 * 主界面：以场景和剧情为主体。
 * 说明性文字全部收进「今日安排」抽屉，这里只保留一句可逐字浮现的旁白，
 * 以及最该做的两件事。
 */
export function HomeView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { state } = useGame()
  const [sheet, setSheet] = useState(false)

  useEffect(() => startHomeBgm(), [])

  const storyChapter = getCurrentStorybookChapter(state)
  const slotIndex = currentSlotIndex()
  const slot = RHYTHM[slotIndex]

  const petUrgent =
    state.pet.hunger < 35
      ? '布丁围着空碗转了两圈，尾巴尖轻轻扫过地板。'
      : state.pet.cleanliness < 35
        ? '布丁的毛有点乱了，它歪着头看你，像在等你拿起梳子。'
        : state.pet.mood < 35
          ? '布丁趴在窗台上，连最喜欢的纸箱都没什么兴趣。'
          : null

  const lines = useMemo(() => {
    const out: string[] = []
    if (petUrgent) out.push(petUrgent)
    out.push(`${slot.label}。${slot.desc}。`)
    out.push('窗外的海面很亮，风铃被海风吹得叮当响。')
    if (state.pet.intimacy >= 24) {
      out.push(`布丁蹭了蹭你的脚踝，发出一点满足的呼噜声。`)
    } else {
      out.push('布丁坐在窗边，多陪陪它，它会慢慢亲近你。')
    }
    if (state.coins < 60) {
      out.push('账本上的数字有点单薄，也许该多开一会儿店。')
    }
    return out
  }, [petUrgent, slot.label, slot.desc, state.pet.intimacy, state.coins])

  const speaker = petUrgent ? state.pet.name : '旁白'
  const tone = petUrgent ? 'pet' : 'narration'

  const petLabel =
    state.pet.hunger < 35 ? '喂布丁' : state.pet.cleanliness < 35 ? '给布丁梳毛' : '陪布丁玩'

  const claimable = TASKS.filter((def) => {
    const t = state.tasks.find((x) => x.id === def.id)
    return t && !t.claimed && t.progress >= def.target
  }).length
  const taskTotal = TASKS.length
  const taskDone = TASKS.filter((def) => {
    const t = state.tasks.find((x) => x.id === def.id)
    return t?.claimed
  }).length

  const storyChapterProgress = storyChapter ? storybookProgress(storyChapter, state) : 0

  return (
    <div className="screen screen--home">
      <button
        type="button"
        className={`home2__quest${claimable > 0 ? ' is-hot' : ''}`}
        onClick={() => setSheet(true)}
      >
        <Sparkles size={14} />
        <span className="home2__quest-label">今日安排</span>
        <b className="t-num">
          {taskDone}/{taskTotal}
        </b>
        {claimable > 0 ? <i className="home2__quest-dot" aria-hidden="true" /> : null}
      </button>

      <div className="home2__grow" />

      <button
        type="button"
        className="home2__chapter"
        aria-label={`打开剧情本：${storyChapter?.title ?? '灯塔旧信'}`}
        onClick={() => onNavigate('story')}
      >
        <span className="home2__chapter-index t-num">CH.{storyChapter?.index ?? 1}</span>
        <span className="home2__chapter-body">
          <span className="home2__chapter-title">《{storyChapter?.title ?? '灯塔旧信'}》</span>
          <span className="home2__chapter-sub">{storyChapter?.subtitle ?? ''}</span>
        </span>
        <span className="home2__chapter-entry">
          <span className="home2__chapter-book">
            <BookOpen size={13} />
            剧情本
          </span>
          <span className="home2__chapter-progress t-num">
            {storyChapterProgress}/{storyChapter?.beats.length ?? 0}
          </span>
        </span>
        <ChevronRight size={16} className="home2__chapter-arrow" />
      </button>

      <DialogueBand lines={lines} speaker={speaker} tone={tone} />

      <div className="home2__actions">
        <button
          type="button"
          className="home2__act home2__act--primary"
          onClick={() => onNavigate('cafe')}
        >
          <span className="home2__act-icon">
            <Coffee size={20} />
          </span>
          <span className="home2__act-label">准备营业</span>
        </button>
        <button
          type="button"
          className="home2__act home2__act--sea"
          onClick={() => onNavigate('pet')}
        >
          <span className="home2__act-icon">
            <PawPrint size={20} />
          </span>
          <span className="home2__act-label">{petLabel}</span>
        </button>
      </div>

      {sheet ? (
        <QuestSheet onClose={() => setSheet(false)} onNavigate={onNavigate} />
      ) : null}
    </div>
  )
}
