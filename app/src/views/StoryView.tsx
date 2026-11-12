import { useEffect, useState, type CSSProperties } from 'react'
import { BookOpen, Check, ChevronRight, Lock, SkipForward, Sparkles, X } from 'lucide-react'
import { useGame } from '../game/GameContext'
import { playSfx } from '../game/sfx'
import {
  STORYBOOK_CHAPTERS,
  getActiveStorybookBranch,
  getStorybookChapter,
  storybookProgress,
  storybookTotalBeats,
  storybookChapterAvailable,
  storybookChapterRequirementText,
} from '../game/storybook'
import { listDynamicStoryChapters } from '../game/dynamicStory'
import { useTypewriter } from '../game/useTypewriter'
import { Modal } from '../components/Modal'
import { StoryArchiveSheet } from '../components/StoryArchiveSheet'
import { StoryDraftSheet } from '../components/StoryDraftSheet'
import { StoryVoiceButton } from '../components/StoryVoiceButton'
import { UiButton } from '../components/UiButton'
import { useStoryVoice } from '../game/useStoryVoice'
import type { StoryChoice } from '../game/types'

interface ReplyState {
  text: string
  optionText: string
}

/**
 * 独立剧情本：只推进 storyChapterBeat，不动恋爱关系值，也不动恋爱章节。
 * 视觉上是一本可以翻页的书，和恋爱主线的对话框完全是两个东西。
 */
export function StoryView() {
  const { state, actions, pushNotice } = useGame()
  const [reply, setReply] = useState<ReplyState | null>(null)
  const [catalogOpen, setCatalogOpen] = useState(false)
  const [confirmSkip, setConfirmSkip] = useState(false)
  const [continuationOpen, setContinuationOpen] = useState(false)

  const chapter = getStorybookChapter(state.storyChapterId)
  const dynamicChapters = listDynamicStoryChapters(state)
  const activeDynamicIndex = state.storyTraceId
    ? dynamicChapters.findIndex(({ trace }) => trace.id === state.storyTraceId)
    : -1
  const activeDynamicChapter =
    activeDynamicIndex >= 0 ? dynamicChapters[activeDynamicIndex] : null
  const nextDynamicChapter =
    activeDynamicIndex >= 0 && activeDynamicIndex < dynamicChapters.length - 1
      ? dynamicChapters[activeDynamicIndex + 1]
      : null

  useEffect(() => {
    setReply(null)
  }, [state.storyChapterId, state.storyTraceId])

  if (!chapter) {
    return (
      <div className="screen screen--storybook">
        <div className="storybook__missing">
          <BookOpen size={24} />
          <strong>剧情本缺失</strong>
        </div>
      </div>
    )
  }

  const available = storybookChapterAvailable(state, chapter)
  const requirement = storybookChapterRequirementText(state, chapter)
  const activeBranch = getActiveStorybookBranch(state)
  const totalBeats = storybookTotalBeats(chapter, state)
  const branchBeat = activeBranch ? activeBranch.beats[state.storyBranchBeat] : null
  const finished =
    !activeBranch && !branchBeat && state.storyChapterBeat >= chapter.beats.length
  const beat = activeBranch
    ? branchBeat
    : finished
      ? null
      : chapter.beats[state.storyChapterBeat]
  const completed = state.storyCompletedChapters.includes(chapter.id)
  const progress = storybookProgress(chapter, state)

  const pageKey = reply
    ? `reply-${chapter.id}-${state.storyChapterBeat}`
    : finished
      ? `end-${chapter.id}`
      : activeBranch
        ? `branch-${activeBranch.id}-${state.storyBranchBeat}`
        : `beat-${beat?.id ?? 'none'}`

  const storyText = reply
    ? reply.text
    : finished
      ? null
      : beat?.type === 'narration' || beat?.type === 'dialogue'
        ? beat.text
        : null

  const typed = useTypewriter(storyText, pageKey)
  useStoryVoice(
    storyText,
    reply || beat?.type !== 'dialogue' ? '旁白' : beat.speaker,
    pageKey,
    available &&
      !activeDynamicChapter &&
      !catalogOpen &&
      !confirmSkip &&
      !continuationOpen,
  )

  const onContinue = () => {
    if (!available) return
    if (reply) {
      playSfx('page')
      setReply(null)
      return
    }
    if (finished) {
      actions.completeStorybookChapter(false)
      setContinuationOpen(true)
      return
    }
    if (!beat) return
    if (beat.type === 'choice') {
      pushNotice('info', '先做个选择', '这一段还在等你回应。')
      return
    }
    if (!typed.done) {
      typed.complete()
      return
    }
    const result = actions.advanceStorybook()
    if (!result.ok) pushNotice('error', '无法继续', result.message)
  }

  const onChoose = (choice: StoryChoice, optionId: string) => {
    if (reply) return
    const option = choice.options.find((item) => item.id === optionId)
    if (!option) return
    const result = actions.chooseStorybookOption(option)
    if (!result.ok) {
      pushNotice('error', '选择没有生效', result.message)
      return
    }
    setReply({ text: option.reply, optionText: option.text })
  }

  const tone = reply
    ? 'reply'
    : finished
      ? 'end'
      : beat?.type === 'choice'
        ? 'choice'
        : beat?.type === 'dialogue' && beat.speaker === '你'
          ? 'me'
          : beat?.type === 'dialogue'
            ? 'character'
            : 'narration'

  const pageInteractive = available && (reply !== null || beat?.type !== 'choice')

  return (
    <div
      className={`screen screen--storybook${
        activeDynamicChapter ? ' screen--storybook--reading' : ''
      }`}
    >
      <div
        className={`storybook__topbar${
          activeDynamicChapter ? ' storybook__topbar--reading' : ''
        }`}
      >
        <button
          type="button"
          className="storybook__brand"
          onClick={() => setCatalogOpen(true)}
          aria-label="打开章节目录"
        >
          <BookOpen size={15} />
          <span>剧情本</span>
        </button>
        {!activeDynamicChapter ? (
          <>
            <span className="storybook__top-progress t-num">
              CH.{chapter.index} · {progress}/{totalBeats}
            </span>
            <StoryVoiceButton />
            <button
              type="button"
              className="storybook__icon-btn"
              onClick={() => setConfirmSkip(true)}
              disabled={!available || completed}
              aria-label={completed ? '本章已完成' : '跳过本章'}
              title={completed ? '本章已完成' : '跳过本章'}
            >
              <SkipForward size={16} />
            </button>
          </>
        ) : null}
      </div>

      {!activeDynamicChapter ? (
        <>
          <div className="storybook__space" aria-hidden="true">
            <span className="storybook__spark storybook__spark--a" />
            <span className="storybook__spark storybook__spark--b" />
            <span className="storybook__spark storybook__spark--c" />
          </div>

          <section
            key={pageKey}
            className={`storybook__page storybook__page--${tone}`}
            role={pageInteractive ? 'button' : undefined}
            tabIndex={pageInteractive ? 0 : undefined}
            aria-live="polite"
            onClick={() => {
              if (pageInteractive) onContinue()
            }}
            onKeyDown={(event) => {
              if (!pageInteractive) return
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                onContinue()
              }
            }}
          >
            <span className="storybook__spine" aria-hidden="true" />
            <span className="storybook__page-curl" aria-hidden="true" />

            <header className="storybook__chapterbar">
              <span className="storybook__chapter-index t-num">CH.{chapter.index}</span>
              <span className="storybook__chapter-copy">
                <strong>《{chapter.title}》</strong>
                <small>{chapter.subtitle}</small>
              </span>
              <span className="storybook__chapter-progress t-num">
                {progress}/{totalBeats}
              </span>
            </header>

            <div className="storybook__content">
              {!available ? (
                <div className="storybook__locked">
                  <span className="storybook__locked-icon">
                    <Lock size={19} />
                  </span>
                  <strong>这一章还没翻开</strong>
                  <p>{requirement ?? '读完上一章再回来。'}</p>
                </div>
              ) : reply ? (
                <div className="storybook__reply">
                  <span className="storybook__reply-option">{reply.optionText}</span>
                  <p>
                    {typed.visible}
                    {typed.done ? null : (
                      <i className="storybook__caret" aria-hidden="true" />
                    )}
                  </p>
                </div>
              ) : finished ? (
                <div className="storybook__finish">
                  <span className="storybook__finish-icon">
                    {completed ? <Check size={22} /> : <Sparkles size={22} />}
                  </span>
                  <strong>{completed ? '这一章已读完' : '本章结束'}</strong>
                  {!completed ? (
                    <p>
                      +{chapter.rewardCoins} 金币 · +{chapter.rewardExp} 经验
                    </p>
                  ) : null}
                </div>
              ) : beat?.type === 'choice' ? (
                <div className="storybook__choice">
                  <p className="storybook__choice-prompt">{beat.prompt}</p>
                  <div className="storybook__options">
                    {beat.options.map((option, index) => (
                      <button
                        key={option.id}
                        type="button"
                        className="storybook__option"
                        style={{ '--option-index': index } as CSSProperties}
                        onClick={() => onChoose(beat, option.id)}
                      >
                        <span>{option.text}</span>
                        <ChevronRight size={16} />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className={`storybook__speech storybook__speech--${tone}`}>
                  {beat?.type === 'dialogue' ? (
                    <span className="storybook__speaker">{beat.speaker}</span>
                  ) : (
                    <span className="storybook__speaker">旁白</span>
                  )}
                  <p>
                    {typed.visible}
                    {typed.done ? null : (
                      <i className="storybook__caret" aria-hidden="true" />
                    )}
                  </p>
                </div>
              )}
            </div>

            <footer className="storybook__footer">
              <div
                className="storybook__pips"
                aria-label={`本章进度 ${progress}/${totalBeats}`}
              >
                {Array.from({ length: totalBeats }, (_, index) => (
                  <span
                    key={index}
                    className={`storybook__pip${
                      index < progress ? ' is-done' : index === progress ? ' is-current' : ''
                    }`}
                  />
                ))}
              </div>
              {available && (reply || beat?.type !== 'choice') ? (
                <button
                  type="button"
                  className="storybook__next"
                  onClick={(event) => {
                    event.stopPropagation()
                    onContinue()
                  }}
                  aria-label={
                    reply
                      ? '继续'
                      : finished
                        ? '继续下一情节'
                        : typed.done
                          ? '翻到下一页'
                          : '显示完整句子'
                  }
                >
                  <ChevronRight size={18} />
                </button>
              ) : null}
            </footer>
          </section>
        </>
      ) : null}

      {catalogOpen ? (
        <div
          className="storybook__catalog-layer"
          role="dialog"
          aria-modal="true"
          aria-label="章节目录"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCatalogOpen(false)
          }}
        >
          <section className="storybook__catalog">
            <header className="storybook__catalog-head">
              <span className="storybook__catalog-title">
                <BookOpen size={17} />
                章节目录
              </span>
              <button
                type="button"
                className="storybook__icon-btn"
                onClick={() => {
                  playSfx('tap')
                  setCatalogOpen(false)
                }}
                aria-label="关闭章节目录"
              >
                <X size={16} />
              </button>
            </header>

            <div className="storybook__catalog-list">
              {STORYBOOK_CHAPTERS.map((item) => {
                const isCurrent =
                  state.storyTraceId === null && item.id === state.storyChapterId
                const done = state.storyCompletedChapters.includes(item.id)
                const open = storybookChapterAvailable(state, item)
                const itemProgress =
                  done || !isCurrent ? 0 : storybookProgress(item, state)
                const itemTotal = storybookTotalBeats(item, state)
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
                        actions.selectStorybookChapter(item.id)
                        playSfx('page')
                      } else {
                        playSfx('tap')
                      }
                      setCatalogOpen(false)
                    }}
                  >
                    <span className="storybook__catalog-index t-num">CH.{item.index}</span>
                    <span className="storybook__catalog-copy">
                      <strong>《{item.title}》</strong>
                      <small>
                        {done
                          ? '已读完'
                          : isCurrent
                            ? `${itemProgress}/${itemTotal}`
                            : open
                              ? item.subtitle
                              : storybookChapterRequirementText(state, item)}
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
                    trace.id === state.storyTraceId ? ' is-current' : ''
                  }`}
                  aria-current={trace.id === state.storyTraceId ? 'page' : undefined}
                  onClick={() => {
                    if (trace.id !== state.storyTraceId) {
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
                      {trace.id === state.storyTraceId ? '正在阅读' : trace.subtitle}
                    </small>
                  </span>
                  {trace.id === state.storyTraceId ? (
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

      {confirmSkip ? (
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
                  const result = actions.completeStorybookChapter(true)
                  if (
                    result.ok &&
                    STORYBOOK_CHAPTERS[STORYBOOK_CHAPTERS.length - 1]?.id ===
                    chapter.id
                  ) {
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

      {activeDynamicChapter ? (
        <StoryArchiveSheet
          key={activeDynamicChapter.trace.id}
          trace={activeDynamicChapter.trace}
          chapterIndex={activeDynamicChapter.chapterIndex}
          voiceEnabled={!catalogOpen && !continuationOpen}
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
          onClose={() => {
            setCatalogOpen(true)
          }}
        />
      ) : null}

      {continuationOpen ? (
        <StoryDraftSheet onClose={() => setContinuationOpen(false)} />
      ) : null}
    </div>
  )
}
