import { useState } from 'react'
import { BookOpen, ChevronRight, X } from 'lucide-react'
import { useTypewriter } from '../game/useTypewriter'
import { useStoryVoice } from '../game/useStoryVoice'
import type { GeneratedStoryBeat, StoryTrace } from '../game/types'
import { StoryVoiceButton } from './StoryVoiceButton'

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
}: {
  trace: StoryTrace
  chapterIndex: number
  onContinueLatest?: () => void
  onOpenNext?: () => void
  onClose: () => void
  voiceEnabled?: boolean
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
  useStoryVoice(
    page.beat.text,
    page.speaker ?? (page.beat.type === 'dialogue' ? page.beat.speaker : '旁白'),
    pageKey,
    voiceEnabled,
  )
  const tone =
    page.beat.type === 'dialogue'
      ? page.beat.speaker === '你'
        ? 'me'
        : 'character'
      : 'narration'
  const isLastPage = pageIndex >= pages.length - 1
  const primaryAction = onOpenNext
    ? { label: '查看下一章', run: onOpenNext }
    : onContinueLatest
      ? { label: '继续下一情节', run: onContinueLatest }
      : null

  const advance = () => {
    if (!typed.done) {
      typed.complete()
      return
    }
    if (!isLastPage) setPageIndex((current) => current + 1)
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
          onClick={advance}
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
                aria-label="返回剧情本"
              >
                <BookOpen size={16} />
                <span>返回剧情本</span>
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
