import { useLayoutEffect, useMemo, useState } from 'react'
import {
  BookOpen,
  Check,
  ChevronRight,
  Clock,
  Heart,
  Lock,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react'
import { useGame } from '../game/GameContext'
import { playSfx } from '../game/sfx'
import { CHAPTERS, chapterAvailable, chapterRequirementText, getChapter } from '../game/story'
import { listDynamicStoryChapters } from '../game/dynamicStory'
import { useTypewriter } from '../game/useTypewriter'
import { Modal } from '../components/Modal'
import { StoryArchiveSheet } from '../components/StoryArchiveSheet'
import { StoryDraftSheet } from '../components/StoryDraftSheet'
import { StoryVoiceButton } from '../components/StoryVoiceButton'
import { UiButton } from '../components/UiButton'
import { useStoryAutoAdvance, useStoryVoice } from '../game/useStoryVoice'
import type { StoryChoice } from '../game/types'

interface ReplyState {
  scope: string
  text: string
  optionText: string
  delta: number
}

/**
 * 恋爱主线：与「剧情本」完全分开的一套进度。
 * 会推进与角色的关系值，解锁下一章；不读写剧情本字段。
 */
export function RomanceView() {
  const { state, actions, pushNotice, notices, dismissNotice } = useGame()
  const [reply, setReply] = useState<ReplyState | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [continuationOpen, setContinuationOpen] = useState(false)

  const chapter = getChapter(state.chapterId)
  const dynamicChapters = listDynamicStoryChapters(state, 'romance')
  const activeDynamicIndex = state.romanceTraceId
    ? dynamicChapters.findIndex(({ trace }) => trace.id === state.romanceTraceId)
    : -1
  const activeDynamicChapter =
    activeDynamicIndex >= 0 ? dynamicChapters[activeDynamicIndex] : null
  const nextDynamicChapter =
    activeDynamicIndex >= 0 && activeDynamicIndex < dynamicChapters.length - 1
      ? dynamicChapters[activeDynamicIndex + 1]
      : null
  const character = useMemo(
    () => state.relationships.find((item) => item.id === chapter?.characterId),
    [chapter?.characterId, state.relationships],
  )

  const available = chapter ? chapterAvailable(state, chapter) : false
  const requirement = chapter ? chapterRequirementText(state, chapter) : ''
  const totalBeats = chapter?.beats.length ?? 0
  const finished = state.chapterBeat >= totalBeats
  const beat = chapter && !finished ? chapter.beats[state.chapterBeat] : null
  const completed = chapter ? state.completedChapters.includes(chapter.id) : false
  const progress = Math.min(state.chapterBeat, totalBeats)
  const bond = character?.value ?? 0
  const replyScope = chapter?.id ?? 'none'
  const activeReply = reply?.scope === replyScope ? reply : null
  const readerOpen = Boolean(activeDynamicChapter) || continuationOpen

  useLayoutEffect(() => {
    if (!readerOpen) return
    notices.forEach((notice) => dismissNotice(notice.id))
    // 章节奖励提示只属于上一页；进入续写或回看后不能压住新章节标题。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readerOpen])

  const pageKey = activeReply
    ? `reply-${activeReply.scope}`
    : finished
      ? `end-${chapter?.id ?? 'none'}`
      : `beat-${beat?.id ?? 'none'}`

  const storyText = activeReply
    ? activeReply.text
    : finished
      ? null
      : beat?.type === 'narration' || beat?.type === 'dialogue'
        ? beat.text
        : null

  const typed = useTypewriter(storyText, pageKey)
  const voiceEnabled =
    available &&
    !activeDynamicChapter &&
    !catalogOpen &&
    !confirmSkip &&
    !continuationOpen
  const voice = useStoryVoice(
    storyText,
    activeReply || beat?.type !== 'dialogue' ? '旁白' : beat.speaker,
    pageKey,
    voiceEnabled,
  )
  const waitingForChoice = beat?.type === 'choice' && !activeReply
  const { cancel: cancelAutoAdvance } = useStoryAutoAdvance({
    onAdvance: () => onContinue(true),
    pageKey,
    allowed:
      voiceEnabled &&
      !activeDynamicChapter &&
      !finished &&
      !waitingForChoice,
    textComplete: typed.done,
    voiceFinished: voice.finished,
    pageVisible: voiceEnabled,
  })

  if (!chapter && !activeDynamicChapter) {
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

  function onContinue(automatic = false) {
    if (activeDynamicChapter) {
      setContinuationOpen(true)
      return
    }
    if (!available) return
    cancelAutoAdvance()
    if (automatic && (!typed.done || waitingForChoice || !voice.finished)) return
    if (activeReply) {
      playSfx('page')
      setReply(null)
      return
    }
    if (finished) {
      if (automatic) return
      if (!completed) {
        actions.completeChapter(false)
        playSfx('reward')
      }
      setContinuationOpen(true)
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
    if (activeReply) return
    const option = choice.options.find((item) => item.id === optionId)
    if (!option) return
    const result = actions.chooseStoryOption(option)
    if (!result.ok) {
      pushNotice('error', '选择没有生效', result.message)
      return
    }
    setReply({
      scope: replyScope,
      text: option.reply,
      optionText: option.text,
      delta: option.effects.relationship ?? 0,
    })
  }

  const catOpen = catalogOpen && available
  const nextLabel = activeReply ? '继续' : finished ? '继续往后写' : '继续'
  const displayChapter = activeDynamicChapter
    ? {
        index: activeDynamicChapter.chapterIndex,
        title: activeDynamicChapter.trace.title,
        subtitle: activeDynamicChapter.trace.subtitle,
        scene: activeDynamicChapter.trace.scene,
      }
    : chapter
  const displayCharacter = activeDynamicChapter
    ? state.relationships.find((item) => item.met || item.value > 0) ?? character
    : character
  const displayBond = activeDynamicChapter
    ? displayCharacter?.value ?? bond
    : bond

  return (
    <div
      className={`screen screen--romance${
        readerOpen ? ' screen--romance-flowing' : ''
      }`}
    >
      {/* ---------- 章节信息 ---------- */}
      {displayChapter && !readerOpen ? <section className="panel story-head">
        <div className="story-head__row">
          <span className="story-head__index t-num">
            CH.{String(displayChapter.index).padStart(2, '0')}
          </span>
          <div className="story-head__title-wrap">
            <h2 className="story-head__title">《{displayChapter.title}》</h2>
            <p className="story-head__sub">{displayChapter.subtitle}</p>
          </div>
          <div className="story-head__actions">
            <StoryVoiceButton className="story-head__menu" />
            <button
              type="button"
              className="story-head__menu"
              onClick={() => {
                playSfx('tap')
                setCatalogOpen(true)
              }}
              aria-label="打开章节目录"
              title="章节目录"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <p className="story-head__scene">
          <Clock size={13} />
          {displayChapter.scene}
        </p>

        <div className="story-head__bond">
          <span className="story-head__bond-name">
            <Heart size={13} />
            {displayCharacter?.name ?? '他'} · {displayCharacter?.role ?? '未登场'}
          </span>
          <span className="story-head__bond-value t-num">关系值 {displayBond}</span>
        </div>
        <div
          className="story-head__track"
          role="progressbar"
          aria-label="关系值"
          aria-valuenow={displayBond}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="story-head__fill"
            style={{ width: `${Math.min(100, displayBond)}%` }}
          />
        </div>
        {!activeDynamicChapter ? <div className="story-head__progress">
          <span className="story-head__progress-label">本章进度</span>
          <span className="t-num">
            {progress}/{totalBeats}
          </span>
        </div> : null}
      </section> : null}

      {/* ---------- 演出 / 对白 ---------- */}
      {!readerOpen ? <div className="story-stage" aria-live="polite">
        {!available ? (
          <div className="story-narration story-narration--lock">
            <span className="story__lock">
              <Lock size={15} /> 这一段还没到
            </span>
            <p className="story__lock-hint">{requirement ?? '继续经营和互动后再来看看。'}</p>
          </div>
        ) : activeReply ? (
          <div className="story-reply">
            <div className="story-reply__head">
              <span className="story-reply__label">你说了</span>
              <span className="story-reply__option">{activeReply.optionText}</span>
            </div>
            <p className="story-reply__text">
              {typed.visible}
              {typed.done ? null : <i className="storybook__caret" aria-hidden="true" />}
            </p>
            {activeReply.delta !== 0 ? (
              <span className="story-reply__delta">
                <Sparkles size={13} />
                {character?.name ?? '角色'} 关系 {activeReply.delta > 0 ? '+' : ''}
                {activeReply.delta}
              </span>
            ) : null}
          </div>
        ) : finished ? (
          <div className="story-end">
            <span className="story-end__icon">
              {completed ? <Check size={20} /> : <Sparkles size={20} />}
            </span>
            <strong className="story-end__title">{completed ? '这一章已经读过了' : '本章结束'}</strong>
            {!completed && chapter ? (
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
      </div> : null}

      {/* ---------- 操作 ---------- */}
      {!readerOpen ? <div className="story-controls">
        {available && beat?.type !== 'choice' ? (
          <UiButton
            variant="primary"
            block
            icon={<ChevronRight size={16} />}
            onClick={() => onContinue()}
          >
            {nextLabel}
          </UiButton>
        ) : null}
        <UiButton
          variant="ghost"
          block
          icon={<SkipForward size={15} />}
          disabled={!available || completed}
          onClick={() => {
            playSfx('tap')
            setConfirmSkip(true)
          }}
        >
          {completed ? '本章已完成' : '跳过本章'}
        </UiButton>
      </div> : null}

      {/* ---------- 章节目录 ---------- */}
      {catalogOpen ? (
        <div
          className="storybook__catalog-layer"
          role="dialog"
          aria-modal="true"
          aria-label="恋爱章节目录"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCatalogOpen(false)
          }}
        >
          <section className="storybook__catalog">
            <header className="storybook__catalog-head">
              <span className="storybook__catalog-title">
                <Heart size={17} />
                恋爱章节目录
              </span>
              <button
                type="button"
                className="storybook__icon-btn"
                onClick={() => {
                  playSfx('tap')
                  setCatalogOpen(false)
                }}
                aria-label="关闭恋爱章节目录"
              >
                <X size={16} />
              </button>
            </header>

            <div className="storybook__catalog-list">
              {CHAPTERS.map((item) => {
                const isCurrent =
                  state.romanceTraceId === null && item.id === state.chapterId
                const done = state.completedChapters.includes(item.id)
                const open = chapterAvailable(state, item)
                const itemProgress =
                  done || !isCurrent
                    ? 0
                    : Math.min(state.chapterBeat, item.beats.length)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`storybook__catalog-item${
                      isCurrent ? ' is-current' : ''
                    }${done ? ' is-done' : ''}`}
                    disabled={!open}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={() => {
                      if (!isCurrent) {
                        actions.selectChapter(item.id)
                        playSfx('page')
                      } else {
                        playSfx('tap')
                      }
                      setCatalogOpen(false)
                    }}
                  >
                    <span className="storybook__catalog-index t-num">
                      CH.{String(item.index).padStart(2, '0')}
                    </span>
                    <span className="storybook__catalog-copy">
                      <strong>《{item.title}》</strong>
                      <small>
                        {done
                          ? '已读完'
                          : isCurrent
                            ? `${itemProgress}/${item.beats.length}`
                            : open
                              ? item.subtitle
                              : chapterRequirementText(state, item)}
                      </small>
                    </span>
                    {done ? (
                      <Check size={16} className="storybook__catalog-state" />
                    ) : open ? (
                      <ChevronRight size={16} className="storybook__catalog-state" />
                    ) : (
                      <Lock size={15} className="storybook__catalog-state" />
                    )}
                  </button>
                )
              })}

              {dynamicChapters.length ? (
                <div className="storybook__catalog-divider" aria-hidden="true">
                  <span>后续篇章</span>
                </div>
              ) : null}

              {dynamicChapters.map(({ trace, chapterIndex }) => (
                <button
                  key={trace.id}
                  type="button"
                  className={`storybook__catalog-item storybook__catalog-item--continuation${
                    trace.id === state.romanceTraceId ? ' is-current' : ''
                  }`}
                  aria-current={
                    trace.id === state.romanceTraceId ? 'page' : undefined
                  }
                  onClick={() => {
                    if (trace.id !== state.romanceTraceId) {
                      actions.selectStoryTrace(trace.id)
                      playSfx('page')
                    } else {
                      playSfx('tap')
                    }
                    setCatalogOpen(false)
                  }}
                >
                  <span className="storybook__catalog-index t-num">
                    CH.{String(chapterIndex).padStart(2, '0')}
                  </span>
                  <span className="storybook__catalog-copy">
                    <strong>《{trace.title}》</strong>
                    <small>
                      {trace.id === state.romanceTraceId
                        ? '正在阅读'
                        : trace.subtitle}
                    </small>
                  </span>
                  {trace.id === state.romanceTraceId ? (
                    <BookOpen size={16} className="storybook__catalog-state" />
                  ) : (
                    <ChevronRight size={16} className="storybook__catalog-state" />
                  )}
                </button>
              ))}
            </div>
          </section>
        </div>
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
                  playSfx('reward')
                  if (chapter?.id === CHAPTERS[CHAPTERS.length - 1]?.id) {
                    setContinuationOpen(true)
                  }
                }}
              >
                确认跳过
              </UiButton>
            </>
          }
        />
      ) : null}

      {activeDynamicChapter && !continuationOpen ? (
        <StoryArchiveSheet
          key={activeDynamicChapter.trace.id}
          trace={activeDynamicChapter.trace}
          chapterIndex={activeDynamicChapter.chapterIndex}
          readerMode="romance"
          character={displayCharacter}
          voiceEnabled={!catalogOpen && !continuationOpen}
          returnLabel="返回恋爱"
          onContinueLatest={
            activeDynamicIndex === dynamicChapters.length - 1
              ? () => setContinuationOpen(true)
              : undefined
          }
          onOpenNext={
            nextDynamicChapter
              ? () => actions.selectStoryTrace(nextDynamicChapter.trace.id)
              : undefined
          }
          onClose={() => setCatalogOpen(true)}
        />
      ) : null}

      {continuationOpen ? (
        <StoryDraftSheet
          thread="romance"
          onClose={() => setContinuationOpen(false)}
        />
      ) : null}
    </div>
  )
}
