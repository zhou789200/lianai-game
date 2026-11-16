import type { ReactNode } from 'react'
import { Clock, Heart, X } from 'lucide-react'
import { StoryVoiceButton } from './StoryVoiceButton'

export interface RomanceReaderCharacter {
  name: string
  role: string
  value: number
}

interface RomanceStoryReaderProps {
  chapterIndex: number
  title: string
  subtitle: string
  scene: string
  character?: RomanceReaderCharacter
  completedPages: number
  totalPages: number
  onClose: () => void
  closeLabel: string
  ariaLabel: string
  children: ReactNode
  controls: ReactNode
}

/**
 * 恋爱续写共用主页面骨架，让静态章节和后续生成章节保持同一种阅读节奏。
 */
export function RomanceStoryReader({
  chapterIndex,
  title,
  subtitle,
  scene,
  character,
  completedPages,
  totalPages,
  onClose,
  closeLabel,
  ariaLabel,
  children,
  controls,
}: RomanceStoryReaderProps) {
  const bond = character?.value ?? 0

  return (
    <div
      className="romance-story-reader screen--romance-reader"
      aria-label={ariaLabel}
    >
      <section className="panel story-head">
        <div className="story-head__row">
          <span className="story-head__index t-num">
            CH.{String(chapterIndex).padStart(2, '0')}
          </span>
          <div className="story-head__title-wrap">
            <h2 className="story-head__title">《{title}》</h2>
            <p className="story-head__sub">{subtitle}</p>
          </div>
          <div className="story-head__actions">
            <StoryVoiceButton className="story-head__menu" />
            <button
              type="button"
              className="story-head__menu"
              onClick={onClose}
              aria-label={closeLabel}
              title={closeLabel}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <p className="story-head__scene">
          <Clock size={13} />
          {scene}
        </p>

        <div className="story-head__bond">
          <span className="story-head__bond-name">
            <Heart size={13} />
            {character?.name ?? '他'} · {character?.role ?? '未完待续'}
          </span>
          <span className="story-head__bond-value t-num">关系值 {bond}</span>
        </div>
        <div
          className="story-head__track"
          role="progressbar"
          aria-label="关系值"
          aria-valuenow={bond}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="story-head__fill"
            style={{ width: `${Math.min(100, bond)}%` }}
          />
        </div>
        <div className="story-head__progress">
          <span className="story-head__progress-label">本章进度</span>
          <span className="t-num">
            {completedPages}/{totalPages}
          </span>
        </div>
      </section>

      <div
        className="story-stage story-stage--romance-reader"
        aria-live="polite"
      >
        {children}
      </div>

      <div className="story-controls">{controls}</div>
    </div>
  )
}
