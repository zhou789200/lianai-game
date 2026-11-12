import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  ChevronRight,
  Feather,
  LoaderCircle,
  RefreshCw,
  X,
} from 'lucide-react'
import { StoryVoiceButton } from './StoryVoiceButton'
import {
  fetchGeneratedStory,
  nextDynamicStoryChapterIndex,
  prepareContinuationState,
  reuseStoryPrefetch,
  storyCacheKey,
  storyTraceFromChoice,
  type StoryPrefetch,
} from '../game/dynamicStory'
import { useGame } from '../game/GameContext'
import { useTypewriter } from '../game/useTypewriter'
import { useStoryVoice } from '../game/useStoryVoice'
import type {
  GameState,
  GeneratedStory,
  GeneratedStoryChoice,
} from '../game/types'

type DraftState = 'loading' | 'ready' | 'error'

export function StoryDraftSheet({ onClose }: { onClose: () => void }) {
  const { state, actions } = useGame()
  const [draftState, setDraftState] = useState<DraftState>('loading')
  const [story, setStory] = useState<GeneratedStory | null>(null)
  const [selected, setSelected] = useState<GeneratedStoryChoice | null>(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [chapterNumber, setChapterNumber] = useState(() =>
    nextDynamicStoryChapterIndex(state),
  )
  const [error, setError] = useState('')
  const requestRef = useRef<AbortController | null>(null)
  const prefetchRef = useRef<StoryPrefetch | null>(null)

  const loadStory = async (
    sourceState: GameState,
    signal?: AbortSignal,
  ): Promise<GeneratedStory> => {
    const nextStory = await fetchGeneratedStory(sourceState, { signal })
    if (signal?.aborted) return nextStory
    actions.cacheGeneratedStory(storyCacheKey(sourceState), nextStory)
    return nextStory
  }

  const generate = async () => {
    requestRef.current?.abort()
    prefetchRef.current?.abort()
    prefetchRef.current = null
    const controller = new AbortController()
    requestRef.current = controller
    setDraftState('loading')
    setStory(null)
    setSelected(null)
    setPageIndex(0)
    setChapterNumber(nextDynamicStoryChapterIndex(state))
    setError('')

    try {
      const nextStory = await loadStory(state, controller.signal)
      if (controller.signal.aborted) return
      setStory(nextStory)
      setDraftState('ready')
    } catch (reason) {
      if (controller.signal.aborted) return
      setError(reason instanceof Error ? reason.message : '这一页暂时没有写出来')
      setDraftState('error')
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void generate()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      requestRef.current?.abort()
      prefetchRef.current?.abort()
    }
  }, [])

  const prepareNextStory = (
    sourceState: GameState,
    sourceStory: GeneratedStory,
    choice: GeneratedStoryChoice,
  ) => {
    const prefetch = reuseStoryPrefetch(
      prefetchRef.current,
      sourceState,
      sourceStory,
      choice,
    )
    prefetchRef.current = prefetch
    void prefetch.promise.then(
      (nextStory) => {
        actions.cacheGeneratedStory(prefetch.cacheKey, nextStory)
      },
      () => undefined,
    )
    return prefetch
  }

  const choose = (choice: GeneratedStoryChoice) => {
    if (!story || selected) return
    const trace = storyTraceFromChoice(story, choice, Date.now(), chapterNumber)
    actions.rememberStoryTrace(trace)
    void prepareNextStory(state, story, choice)
    setSelected(choice)
  }

  const continueAfterChoice = async () => {
    if (!story || !selected) return
    const prefetch = prepareNextStory(state, story, selected)
    requestRef.current?.abort()
    requestRef.current = null
    setDraftState('loading')
    setError('')

    try {
      const nextStory = await prefetch.promise
      if (prefetchRef.current?.key !== prefetch.key) return
      const continuationState = prepareContinuationState(state, story, selected)
      actions.cacheGeneratedStory(storyCacheKey(continuationState), nextStory)
      prefetchRef.current = null
      setStory(nextStory)
      setSelected(null)
      setPageIndex(0)
      setChapterNumber((current) => Math.min(999, current + 1))
      setDraftState('ready')
    } catch (reason) {
      if (prefetchRef.current?.key !== prefetch.key) return
      prefetchRef.current = null
      setError(reason instanceof Error ? reason.message : '这一页暂时没有接上')
      setDraftState('error')
    }
  }

  const close = () => {
    requestRef.current?.abort()
    prefetchRef.current?.abort()
    prefetchRef.current = null
    onClose()
  }

  const totalPages = story ? story.beats.length + 1 : 5
  const completedPages = selected ? totalPages : pageIndex
  const isChoicePage = Boolean(
    draftState === 'ready' && story && !selected && pageIndex === story.beats.length,
  )
  const currentBeat =
    draftState === 'ready' && story && !selected && pageIndex < story.beats.length
      ? story.beats[pageIndex]
      : null
  const pageText = selected ? selected.reply : currentBeat?.text ?? null
  const pageKey = selected
    ? `outcome-${story?.id ?? 'story'}`
    : `beat-${story?.id ?? 'story'}-${pageIndex}`
  const typed = useTypewriter(pageText, pageKey)
  useStoryVoice(
    pageText,
    selected ? '旁白' : currentBeat?.speaker,
    pageKey,
    draftState === 'ready' && !isChoicePage,
  )
  const tone = selected
    ? 'narration'
    : currentBeat?.type === 'dialogue'
      ? currentBeat.speaker === '你'
        ? 'me'
        : 'character'
      : 'narration'

  const advance = () => {
    if (draftState !== 'ready' || !story || isChoicePage) return
    if (!typed.done) {
      typed.complete()
      return
    }
    if (selected) {
      void continueAfterChoice()
      return
    }
    if (pageIndex < story.beats.length) {
      setPageIndex((current) => current + 1)
    }
  }

  return (
    <div
      className="storybook__draft-layer storybook__draft-layer--reader"
      role="dialog"
      aria-modal="true"
      aria-label="故事续页"
      onClick={(event) => {
        if (event.target === event.currentTarget) close()
      }}
    >
      <section className="storybook__draft storybook__draft--reader">
        {draftState === 'ready' && story ? (
          <header className="storybook__chapterbar storybook__draft-reader-chapterbar">
            <span className="storybook__chapter-index t-num">
              CH.{String(chapterNumber).padStart(2, '0')}
            </span>
            <span className="storybook__chapter-copy">
              <strong>《{story.title}》</strong>
              <small>{story.subtitle}</small>
            </span>
            <span className="storybook__chapter-progress t-num">
              {completedPages}/{totalPages}
            </span>
            <StoryVoiceButton className="storybook__icon-btn storybook__draft-reader-voice story-voice-btn--compact" />
            <button
              type="button"
              className="storybook__icon-btn storybook__draft-reader-close"
              onClick={close}
              aria-label="关闭故事续页"
            >
              <X size={14} />
            </button>
          </header>
        ) : (
          <header className="storybook__draft-reader-minihead">
            <span>
              <Feather size={15} />
              故事续页
            </span>
            <div className="storybook__draft-reader-minihead-actions">
              <StoryVoiceButton className="storybook__icon-btn storybook__draft-reader-voice" />
              <button
                type="button"
                className="storybook__icon-btn storybook__draft-reader-close"
                onClick={close}
                aria-label="关闭故事续页"
              >
                <X size={14} />
              </button>
            </div>
          </header>
        )}

        <div
          className="storybook__content storybook__draft-reader-content"
          aria-live="polite"
          role={!isChoicePage && draftState === 'ready' ? 'button' : undefined}
          tabIndex={!isChoicePage && draftState === 'ready' ? 0 : undefined}
          onClick={advance}
          onKeyDown={(event) => {
            if (isChoicePage) return
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              advance()
            }
          }}
        >
          {draftState === 'loading' ? (
            <div className="storybook__draft-reader-state">
              <span className="storybook__draft-loader" aria-hidden="true">
                <LoaderCircle size={24} />
              </span>
              <strong>下一页正在展开</strong>
            </div>
          ) : null}

          {draftState === 'error' ? (
            <div className="storybook__draft-reader-state">
              <span className="storybook__draft-error-icon" aria-hidden="true">
                <RefreshCw size={20} />
              </span>
              <strong>这一页暂时没有接上</strong>
              <p>{error}</p>
              <button type="button" className="storybook__draft-secondary" onClick={generate}>
                <RefreshCw size={15} />
                再翻一次
              </button>
            </div>
          ) : null}

          {isChoicePage && story ? (
            <div className="storybook__draft-reader-choice">
              <p>接下来怎么做？</p>
              <div className="storybook__draft-reader-options">
                {story.choices.map((choice, index) => (
                  <button
                    key={choice.id}
                    type="button"
                    className="storybook__draft-reader-option"
                    style={{ '--draft-option-index': index } as CSSProperties}
                    onClick={() => choose(choice)}
                  >
                    <span className="storybook__draft-option-mark">
                      {index === 0 ? 'A' : 'B'}
                    </span>
                    <span>{choice.text}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {draftState === 'ready' && story && !isChoicePage ? (
            <div
              className={`storybook__speech storybook__draft-reader-beat storybook__speech--${tone}${
                selected ? ' storybook__draft-reader-outcome' : ''
              }`}
            >
              <span className="storybook__speaker">
                {selected ? '选择之后' : currentBeat?.speaker ?? '旁白'}
              </span>
              <p>
                {typed.visible}
                {typed.done ? null : <i className="storybook__caret" aria-hidden="true" />}
              </p>
            </div>
          ) : null}
        </div>

        {draftState === 'ready' && story ? (
          <footer className="storybook__footer storybook__draft-reader-footer">
            <div
              className="storybook__pips"
              aria-label={`剧情进度 ${completedPages}/${totalPages}`}
            >
              {Array.from({ length: totalPages }, (_, index) => (
                <span
                  key={index}
                  className={`storybook__pip${
                    index < completedPages
                      ? ' is-done'
                      : index === completedPages && !selected
                        ? ' is-current'
                        : ''
                  }`}
                />
              ))}
            </div>
            {!isChoicePage ? (
              <button
                type="button"
                className="storybook__next"
                onClick={(event) => {
                  event.stopPropagation()
                  advance()
                }}
                aria-label={
                  selected
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
        ) : null}
      </section>
    </div>
  )
}
