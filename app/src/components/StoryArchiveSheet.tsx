import { useState } from 'react'
import { BookOpen, ChevronRight, X } from 'lucide-react'
import { RomanceStoryReader } from './RomanceStoryReader'
import { useTypewriter } from '../game/useTypewriter'
import { useStoryAutoAdvance, useStoryVoice } from '../game/useStoryVoice'
import type {
  GeneratedStoryBeat,
  Relationship,
  StoryTrace,
} from '../game/types'
import { StoryVoiceButton } from './StoryVoiceButton'
import { UiButton } from './UiButton'

interface ArchivePage {
  key: string
  beat: GeneratedStoryBeat
  choice?: string
  speaker?: string
}

export function StoryArchiveSheet({
  trace,
  chapterIndex,
  onContinueLatest,
  onOpenNext,
  onClose,
  voiceEnabled = true,
  returnLabel = '返回剧情本',
  readerMode = 'overlay',
  character,
}: {
  trace: StoryTrace
  chapterIndex: number
  onContinueLatest?: () => void
  onOpenNext?: () => void
  onClose: () => void
  voiceEnabled?: boolean
  returnLabel?: string
  readerMode?: 'overlay' | 'romance'
  character?: Relationship
}) {
  const [pageIndex, setPageIndex] = useState(0)
  const selectedChoice = trace.choices?.find(
    (choice) => choice.id === trace.selectedChoiceId,
  )
  const resultText =
    [selectedChoice?.reply, selectedChoice?.consequence].filter(Boolean).join(' ') ||
    trace.outcome
  const storyBeats: GeneratedStoryBeat[] = trace.beats?.length
    ? trace.beats
    : [{ type: 'narration', text: resultText }]
  const pages: ArchivePage[] = [
    ...storyBeats.map((beat, index) => ({
      key: `beat-${index}`,
      beat,
    })),
    {
      key: 'outcome',
      beat: {
        type: 'narration',
        text: resultText,
      },
      choice: selectedChoice?.text ?? trace.choice,
      speaker: '选择之后',
    },
  ]
  const page = pages[Math.min(pageIndex, pages.length - 1)]
  const pageKey = `${trace.id}-${page.key}`
  const typed = useTypewriter(page.beat.text, pageKey)
  const isLastPage = pageIndex >= pages.length - 1
  const voice = useStoryVoice(
    page.beat.text,
    page.speaker ?? (page.beat.type === 'dialogue' ? page.beat.speaker : '旁白'),
    pageKey,
    voiceEnabled,
  )
  const autoAdvanceEnabled = voiceEnabled && !isLastPage

  function advancePage(automatic = false) {
    if (automatic && (!typed.done || !voice.finished || isLastPage)) return
    if (!typed.done) {
      typed.complete()
      return
    }
    if (!isLastPage) setPageIndex((current) => current + 1)
  }

  const { cancel: cancelAutoAdvance } = useStoryAutoAdvance({
    onAdvance: () => advancePage(true),
    pageKey,
    allowed: autoAdvanceEnabled,
    textComplete: typed.done,
    voiceFinished: voice.finished,
    pageVisible: voiceEnabled,
  })
  const tone =
    page.beat.type === 'dialogue'
      ? page.beat.speaker === '你'
        ? 'me'
        : 'character'
      : 'narration'
  const primaryAction = onOpenNext
    ? { label: '查看下一章', run: onOpenNext }
    : onContinueLatest
      ? { label: '继续下一情节', run: onContinueLatest }
      : null

  function advance(automatic = false) {
    cancelAutoAdvance()
    advancePage(automatic)
  }

  if (readerMode === 'romance') {
    return (
      <RomanceStoryReader
        chapterIndex={chapterIndex}
        title={trace.title}
        subtitle={trace.subtitle}
        scene={trace.scene}
        character={character}
        completedPages={pageIndex}
        totalPages={pages.length}
        onClose={onClose}
        closeLabel="关闭章节回看"
        ariaLabel={`阅读《${trace.title}》`}
        controls={
          <>
            {!isLastPage ? (
              <UiButton
                variant="primary"
                block
                icon={<ChevronRight size={16} />}
                onClick={() => advance()}
              >
                {typed.done ? '继续' : '显示完整句子'}
              </UiButton>
            ) : primaryAction ? (
              <UiButton
                variant="primary"
                block
                icon={<ChevronRight size={16} />}
                onClick={primaryAction.run}
              >
                {primaryAction.label}
              </UiButton>
            ) : null}
            <UiButton variant="ghost" block onClick={onClose}>
              {returnLabel}
            </UiButton>
          </>
        }
      >
        <div
          className="story-stage__content"
          role={!isLastPage ? 'button' : undefined}
          tabIndex={!isLastPage ? 0 : undefined}
          onClick={() => {
            if (!isLastPage) advance()
          }}
          onKeyDown={(event) => {
            if (isLastPage) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              advance()
            }
          }}
        >
          {page.choice ? (
            <div className="story-reply story-reader-outcome">
              <div className="story-reply__head">
                <span className="story-reply__label">你说了</span>
                <span className="story-reply__option">{page.choice}</span>
              </div>
              <p className="story-reply__text">
                {typed.visible}
                {typed.done ? null : (
                  <i className="storybook__caret" aria-hidden="true" />
                )}
              </p>
            </div>
          ) : tone === 'me' ? (
            <div className="story-bubble story-bubble--me">
              <span className="story-bubble__speaker">
                {page.beat.type === 'dialogue' ? page.beat.speaker : '你'}
              </span>
              <p className="story-bubble__text">
                {typed.visible}
                {typed.done ? null : (
                  <i className="storybook__caret" aria-hidden="true" />
                )}
              </p>
            </div>
          ) : tone === 'character' ? (
            <div className="story-bubble">
              <span className="story-bubble__speaker">
                {page.beat.type === 'dialogue' ? page.beat.speaker : '他'}
              </span>
              <p className="story-bubble__text">
                {typed.visible}
                {typed.done ? null : (
                  <i className="storybook__caret" aria-hidden="true" />
                )}
              </p>
            </div>
          ) : (
            <div className="story-narration story-reader-narration">
              <p className="story-bubble__text">
                {typed.visible}
                {typed.done ? null : (
                  <i className="storybook__caret" aria-hidden="true" />
                )}
              </p>
            </div>
          )}
        </div>
      </RomanceStoryReader>
    )
  }

  return (
    <div
      className="storybook__draft-layer storybook__draft-layer--reader"
      role="dialog"
      aria-modal="true"
      aria-label={`阅读《${trace.title}》`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="storybook__draft storybook__draft--reader storybook__archive">
        <header className="storybook__chapterbar storybook__draft-reader-chapterbar">
          <span className="storybook__chapter-index t-num">
            CH.{String(chapterIndex).padStart(2, '0')}
          </span>
          <span className="storybook__chapter-copy">
            <strong>《{trace.title}》</strong>
            <small>{trace.subtitle}</small>
          </span>
          <span className="storybook__chapter-progress t-num">
            {pageIndex}/{pages.length}
          </span>
          <StoryVoiceButton className="storybook__icon-btn storybook__draft-reader-voice" />
          <button
            type="button"
            className="storybook__icon-btn storybook__draft-reader-close"
            onClick={onClose}
            aria-label="关闭章节回看"
          >
            <X size={14} />
          </button>
        </header>

        <div
          className="storybook__content storybook__draft-reader-content"
          role="button"
          tabIndex={0}
          aria-live="polite"
          onClick={() => advance()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              advance()
            }
          }}
        >
          <div className="storybook__archive-page">
            {page.choice ? (
              <span className="storybook__reply-option">{page.choice}</span>
            ) : null}
            <div
              className={`storybook__speech storybook__draft-reader-beat storybook__speech--${tone}`}
            >
              <span className="storybook__speaker">
                {page.speaker ??
                  (page.beat.type === 'dialogue'
                    ? page.beat.speaker
                    : '旁白')}
              </span>
              <p>
                {typed.visible}
                {typed.done ? null : <i className="storybook__caret" aria-hidden="true" />}
              </p>
            </div>
          </div>
        </div>

        <footer
          className={`storybook__footer storybook__draft-reader-footer${
            isLastPage ? ' storybook__archive-footer--actions' : ''
          }`}
        >
          <div
            className="storybook__pips"
            aria-label={`回看进度 ${pageIndex}/${pages.length}`}
          >
            {Array.from({ length: pages.length }, (_, index) => (
              <span
                key={index}
                className={`storybook__pip${
                  index < pageIndex ? ' is-done' : index === pageIndex ? ' is-current' : ''
                }`}
              />
            ))}
          </div>
          {isLastPage ? (
            <div
              className={`storybook__archive-actions${
                primaryAction ? '' : ' storybook__archive-actions--single'
              }`}
            >
              <button
                type="button"
                className="storybook__archive-return"
                onClick={(event) => {
                  event.stopPropagation()
                  onClose()
                }}
                aria-label={returnLabel}
              >
                <BookOpen size={16} />
                <span>{returnLabel}</span>
              </button>
              {primaryAction ? (
                <button
                  type="button"
                  className="storybook__archive-action"
                  onClick={(event) => {
                    event.stopPropagation()
                    primaryAction.run()
                  }}
                  aria-label={primaryAction.label}
                >
                  <span>{primaryAction.label}</span>
                  <ChevronRight size={16} />
                </button>
              ) : null}
            </div>
          ) : (
            <button
              type="button"
              className="storybook__next"
              onClick={(event) => {
                event.stopPropagation()
                advance()
              }}
              aria-label={typed.done ? '翻到下一页' : '显示完整句子'}
            >
              <ChevronRight size={18} />
            </button>
          )}
        </footer>
      </section>
    </div>
  )
}
