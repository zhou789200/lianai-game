import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronRight, Clock, Heart, Lock, SkipForward, Sparkles } from 'lucide-react'
import { useGame } from '../game/GameContext'
import { CHAPTERS, chapterAvailable, chapterRequirementText, getChapter } from '../game/story'
import { useTypewriter } from '../game/useTypewriter'
import { Modal } from '../components/Modal'
import { UiButton } from '../components/UiButton'
import type { StoryChoice } from '../game/types'

interface ReplyState {
  text: string
  optionText: string
  delta: number
}

/**
 * 恋爱主线：与「剧情本」完全分开的一套进度。
 * 会推进与角色的关系值，解锁下一章；不读写剧情本字段。
 */
export function RomanceView() {
  const { state, actions, pushNotice } = useGame()
  const [reply, setReply] = useState<ReplyState | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)

  const chapter = getChapter(state.chapterId)
  const character = useMemo(
    () => state.relationships.find((item) => item.id === chapter?.characterId),
    [chapter?.characterId, state.relationships],
  )

  useEffect(() => {
    setReply(null)
  }, [state.chapterId])

  if (!chapter) {
    return (
      <div className="screen screen--romance">
        <div className="story-end">
          <span className="story-end__icon">
            <Heart size={18} />
          </span>
          <strong className="story-end__title">还没遇到谁</strong>
          <p className="story-end__text">先在店里忙起来，故事会慢慢找上门。</p>
        </div>
      </div>
    )
  }

  const available = chapterAvailable(state, chapter)
  const requirement = chapterRequirementText(state, chapter)
  const totalBeats = chapter.beats.length
  const finished = state.chapterBeat >= totalBeats
  const beat = finished ? null : chapter.beats[state.chapterBeat]
  const completed = state.completedChapters.includes(chapter.id)
  const progress = Math.min(state.chapterBeat, totalBeats)
  const bond = character?.value ?? 0

  const pageKey = reply
    ? `reply-${chapter.id}-${state.chapterBeat}`
    : finished
      ? `end-${chapter.id}`
      : `beat-${beat?.id ?? 'none'}`

  const storyText = reply
    ? reply.text
    : finished
      ? null
      : beat?.type === 'narration' || beat?.type === 'dialogue'
        ? beat.text
        : null

  const typed = useTypewriter(storyText, pageKey)

  const onContinue = () => {
    if (!available) return
    if (reply) {
      setReply(null)
      return
    }
    if (finished) {
      actions.completeChapter(false)
      return
    }
    if (!beat) return
    if (beat.type === 'choice') return
    if (!typed.done) {
      typed.complete()
      return
    }
    const result = actions.advanceStory()
    if (!result.ok) pushNotice('error', '无法继续', result.message)
  }

  const onChoose = (choice: StoryChoice, optionId: string) => {
    if (reply) return
    const option = choice.options.find((item) => item.id === optionId)
    if (!option) return
    const result = actions.chooseStoryOption(option)
    if (!result.ok) {
      pushNotice('error', '选择没有生效', result.message)
      return
    }
    setReply({ text: option.reply, optionText: option.text, delta: option.effects.relationship ?? 0 })
  }

  const catOpen = catalogOpen && available
  const nextLabel = reply ? '继续' : finished ? (completed ? '回到章节' : '完成本章') : '继续'

  return (
    <div className="screen screen--romance">
      {/* ---------- 章节信息 ---------- */}
      <section className="panel story-head">
        <div className="story-head__row">
          <span className="story-head__index t-num">CH.{chapter.index}</span>
          <div className="story-head__title-wrap">
            <h2 className="story-head__title">《{chapter.title}》</h2>
            <p className="story-head__sub">{chapter.subtitle}</p>
          </div>
          <button
            type="button"
            className="story-head__menu"
            onClick={() => setCatalogOpen(true)}
            aria-label="打开章节目录"
            title="章节目录"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        <p className="story-head__scene">
          <Clock size={13} />
          {chapter.scene}
        </p>

        <div className="story-head__bond">
          <span className="story-head__bond-name">
            <Heart size={13} />
            {character?.name ?? '他'} · {character?.role ?? '未登场'}
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
          <div className="story-head__fill" style={{ width: `${Math.min(100, bond)}%` }} />
        </div>
        <div className="story-head__progress">
          <span className="story-head__progress-label">本章进度</span>
          <span className="t-num">
            {progress}/{totalBeats}
          </span>
        </div>
      </section>

      {/* ---------- 演出 / 对白 ---------- */}
      <div className="story-stage" aria-live="polite">
        {!available ? (
          <div className="story-narration story-narration--lock">
            <span className="story__lock">
              <Lock size={15} /> 这一段还没到
            </span>
            <p className="story__lock-hint">{requirement ?? '继续经营和互动后再来看看。'}</p>
          </div>
        ) : reply ? (
          <div className="story-reply">
            <div className="story-reply__head">
              <span className="story-reply__label">你说了</span>
              <span className="story-reply__option">{reply.optionText}</span>
            </div>
            <p className="story-reply__text">
              {typed.visible}
              {typed.done ? null : <i className="storybook__caret" aria-hidden="true" />}
            </p>
            {reply.delta !== 0 ? (
              <span className="story-reply__delta">
                <Sparkles size={13} />
                {character?.name ?? '角色'} 关系 {reply.delta > 0 ? '+' : ''}
                {reply.delta}
              </span>
            ) : null}
          </div>
        ) : finished ? (
          <div className="story-end">
            <span className="story-end__icon">
              {completed ? <Check size={20} /> : <Sparkles size={20} />}
            </span>
            <strong className="story-end__title">{completed ? '这一章已经读过了' : '本章结束'}</strong>
            {!completed ? (
              <p className="story-end__text">
                +{chapter.rewardCoins} 金币 · +{chapter.rewardExp} 经验
              </p>
            ) : null}
          </div>
        ) : beat?.type === 'choice' ? (
          <div className="story-choice">
            <p className="story-choice__prompt">
              <Sparkles size={14} />
              {beat.prompt}
            </p>
            <div className="story-choice__options">
              {beat.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className="story-option"
                  onClick={() => onChoose(beat, option.id)}
                >
                  <span>{option.text}</span>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </div>
        ) : beat?.type === 'dialogue' && beat.speaker === '你' ? (
          <div className="story-bubble story-bubble--me">
            <span className="story-bubble__speaker">{beat.speaker}</span>
            <p className="story-bubble__text">
              {typed.visible}
              {typed.done ? null : <i className="storybook__caret" aria-hidden="true" />}
            </p>
          </div>
        ) : beat?.type === 'dialogue' ? (
          <div className="story-bubble">
            <span className="story-bubble__speaker">{beat.speaker}</span>
            <p className="story-bubble__text">
              {typed.visible}
              {typed.done ? null : <i className="storybook__caret" aria-hidden="true" />}
            </p>
          </div>
        ) : (
          <div className="story-narration">
            <p className="story-bubble__text">
              {typed.visible}
              {typed.done ? null : <i className="storybook__caret" aria-hidden="true" />}
            </p>
          </div>
        )}
      </div>

      {/* ---------- 操作 ---------- */}
      <div className="story-controls">
        {available && beat?.type !== 'choice' ? (
          <UiButton variant="primary" block icon={<ChevronRight size={16} />} onClick={onContinue}>
            {nextLabel}
          </UiButton>
        ) : null}
        <UiButton
          variant="ghost"
          block
          icon={<SkipForward size={15} />}
          disabled={!available || completed}
          onClick={() => setConfirmSkip(true)}
        >
          {completed ? '本章已完成' : '跳过本章'}
        </UiButton>
      </div>

      {/* ---------- 章节目录 ---------- */}
      {catalogOpen ? (
        <Modal title="恋爱章节目录" subtitle="换一段故事继续" onClose={() => setCatalogOpen(false)}>
          <div className="chapter-list">
            {CHAPTERS.map((item) => {
              const isCurrent = item.id === state.chapterId
              const done = state.completedChapters.includes(item.id)
              const open = chapterAvailable(state, item)
              const itemProgress =
                done || !isCurrent ? 0 : Math.min(state.chapterBeat, item.beats.length)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`chapter-item${isCurrent ? ' is-current' : ''}`}
                  disabled={!open}
                  aria-current={isCurrent ? 'page' : undefined}
                  onClick={() => {
                    if (!isCurrent) actions.selectChapter(item.id)
                    setCatalogOpen(false)
                  }}
                >
                  <span className="chapter-item__index t-num">CH.{item.index}</span>
                  <span className="chapter-item__body">
                    <span className="chapter-item__title">《{item.title}》</span>
                    <span className="chapter-item__sub">
                      {done
                        ? '已读完'
                        : isCurrent
                          ? `${itemProgress}/${item.beats.length}`
                          : open
                            ? item.subtitle
                            : chapterRequirementText(state, item)}
                    </span>
                  </span>
                  {done ? (
                    <Check size={16} />
                  ) : open ? (
                    <ChevronRight size={16} />
                  ) : (
                    <Lock size={15} />
                  )}
                </button>
              )
            })}
          </div>
        </Modal>
      ) : null}

      {/* ---------- 跳过确认 ---------- */}
      {confirmSkip && !catOpen ? (
        <Modal
          title="跳过这一章？"
          subtitle="未完成的选择会自动采用第一个选项，已做出的选择会保留，后续剧情仍会承接这些结果。"
          onClose={() => setConfirmSkip(false)}
          actions={
            <>
              <UiButton variant="ghost" onClick={() => setConfirmSkip(false)}>
                继续阅读
              </UiButton>
              <UiButton
                variant="primary"
                onClick={() => {
                  setConfirmSkip(false)
                  actions.completeChapter(true)
                }}
              >
                确认跳过
              </UiButton>
            </>
          }
        />
      ) : null}
    </div>
  )
}
