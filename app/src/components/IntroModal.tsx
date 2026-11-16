import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Coffee,
  Home,
  Settings,
  Sparkles,
} from 'lucide-react'
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import type { ViewKey } from '../game/types'
import { UiButton } from './UiButton'

interface TourStep {
  title: string
  text: string
  view: ViewKey
  target: string
  Icon: typeof Home
}

const STEPS: TourStep[] = [
  {
    title: '从这里开始第一天',
    text: '「准备营业」赚取金币和经验；也可以先陪布丁玩。底部的五个入口，可以随时切换主要功能。',
    view: 'home',
    target: '[data-tour="home-actions"]',
    Icon: Home,
  },
  {
    title: '经营你的咖啡馆',
    text: '点击「开始营业」进入接单与制作挑战。平时还能升级设备、研发菜单和布置店铺；去「宠物」页可喂食、玩耍和梳毛。',
    view: 'cafe',
    target: '[data-tour="cafe-start"]',
    Icon: Coffee,
  },
  {
    title: '翻开剧情与恋爱主线',
    text: '「剧情本」是可以逐页阅读的独立故事。点击对白继续，遇到选择时作出回应；底部「恋爱」页记录你与林澈的主线进度。',
    view: 'story',
    target: '[data-tour="story-book"]',
    Icon: BookOpen,
  },
  {
    title: '领取每日奖励',
    text: '回到主页打开「今日安排」，查看任务进度并领取奖励。顶部会显示金币、体力和关系值，合理分配体力再开始营业。',
    view: 'home',
    target: '[data-tour="daily-tasks"]',
    Icon: Sparkles,
  },
  {
    title: '进度与声音都在这里',
    text: '右上角进入设置，可管理账号与存档、调整音乐和剧情朗读。游客进度保存在当前浏览器，创建账号后可跨设备恢复。',
    view: 'home',
    target: '[data-tour="settings"]',
    Icon: Settings,
  },
]

interface Rect {
  left: number
  top: number
  width: number
  height: number
}

interface IntroModalProps {
  onClose: () => void
  onNavigate: (view: ViewKey) => void
}

export function IntroModal({ onClose, onNavigate }: IntroModalProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<Rect | null>(null)
  const [cardTop, setCardTop] = useState(16)
  const rootRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const nextRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const step = STEPS[stepIndex]
  const StepIcon = step.Icon
  const isLast = stepIndex === STEPS.length - 1

  useLayoutEffect(() => {
    onNavigate(step.view)
  }, [onNavigate, step.view])

  useLayoutEffect(() => {
    const measure = () => {
      const root = rootRef.current
      const target = document.querySelector<HTMLElement>(step.target)
      if (!root || !target) return
      const rootBox = root.getBoundingClientRect()
      const targetBox = target.getBoundingClientRect()
      // 浏览器小数像素缩放、页面切换后的布局更新会让
      // rootBox 偶尔仍是旧值。用画布实际宽度取得真实缩放比，
      // 高亮框始终与目标按钮的当前屏幕矩形对齐。
      const canvas = root.closest('.phone__canvas')
      const canvasBox = canvas?.getBoundingClientRect()
      const scale = canvasBox && canvas?.clientWidth
        ? canvasBox.width / canvas.clientWidth
        : rootBox.width / root.clientWidth || 1
      const origin = canvasBox ?? rootBox
      const next = {
        left: (targetBox.left - origin.left) / scale,
        top: (targetBox.top - origin.top) / scale,
        width: targetBox.width / scale,
        height: targetBox.height / scale,
      }
      const cardHeight = (cardRef.current?.getBoundingClientRect().height ?? 230) / scale
      const below = next.top + next.height + 16
      const above = next.top - cardHeight - 16
      setSpotlight(next)
      setCardTop(
        next.top < root.clientHeight * 0.48
          ? Math.min(below, root.clientHeight - cardHeight - 16)
          : Math.max(16, above),
      )
    }

    // 场景切换后部分控件还有入场位移，仅监听尺寸会漏掉位置变化。
    // 引导期间逐帧同步位置；矩形不变时不触发 React 更新。
    let frame = 0
    let previous: Rect | null = null
    const sync = () => {
      const root = rootRef.current
      const target = document.querySelector<HTMLElement>(step.target)
      if (root && target) {
        const canvas = root.closest('.phone__canvas')
        const canvasBox = canvas?.getBoundingClientRect()
        const targetBox = target.getBoundingClientRect()
        const scale = canvasBox && canvas?.clientWidth
          ? canvasBox.width / canvas.clientWidth
          : 1
        const origin = canvasBox ?? root.getBoundingClientRect()
        const next = {
          left: (targetBox.left - origin.left) / scale,
          top: (targetBox.top - origin.top) / scale,
          width: targetBox.width / scale,
          height: targetBox.height / scale,
        }
        if (!previous || (Object.keys(next) as Array<keyof Rect>).some(
          (key) => Math.abs(next[key] - previous![key]) > 0.01,
        )) {
          previous = next
          measure()
        }
      }
      frame = window.requestAnimationFrame(sync)
    }
    frame = window.requestAnimationFrame(sync)
    const observer = new ResizeObserver(measure)
    if (rootRef.current) observer.observe(rootRef.current)
    const target = document.querySelector<HTMLElement>(step.target)
    if (target) observer.observe(target)
    window.addEventListener('resize', measure)
    window.visualViewport?.addEventListener('resize', measure)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      window.visualViewport?.removeEventListener('resize', measure)
    }
  }, [step.target, stepIndex])

  useEffect(() => {
    nextRef.current?.focus()
  }, [stepIndex])

  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return
      const items = Array.from(
        card.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
      )
      const first = items[0]
      const last = items[items.length - 1]
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    card.addEventListener('keydown', handleKeyDown)
    return () => card.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const spotlightStyle = spotlight
    ? ({
        left: spotlight.left - 6,
        top: spotlight.top - 6,
        width: spotlight.width + 12,
        height: spotlight.height + 12,
      } as CSSProperties)
    : undefined

  return (
    <div ref={rootRef} className="tour" aria-label="新手引导">
      <div className="tour__guard" aria-hidden="true" />
      {spotlight ? (
        <>
          <div className="tour__shade tour__shade--top" style={{ height: spotlight.top - 6 }} aria-hidden="true" />
          <div className="tour__shade tour__shade--bottom" style={{ top: spotlight.top + spotlight.height + 6 }} aria-hidden="true" />
          <div className="tour__shade tour__shade--left" style={{ top: spotlight.top - 6, width: spotlight.left - 6, height: spotlight.height + 12 }} aria-hidden="true" />
          <div className="tour__shade tour__shade--right" style={{ top: spotlight.top - 6, left: spotlight.left + spotlight.width + 6, height: spotlight.height + 12 }} aria-hidden="true" />
          <div className="tour__spotlight" style={spotlightStyle} aria-hidden="true" />
        </>
      ) : null}
      <div
        ref={cardRef}
        className="tour__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        style={{ top: cardTop, visibility: spotlight ? 'visible' : 'hidden' }}
      >
        <div className="tour__topline">
          <span className="tour__count t-num">
            新手引导 · {stepIndex + 1}/{STEPS.length}
          </span>
          <button type="button" className="tour__skip" onClick={onClose}>
            跳过
          </button>
        </div>
        <div className="tour__heading">
          <span className="tour__icon" aria-hidden="true">
            <StepIcon size={20} />
          </span>
          <h2 id={titleId}>{step.title}</h2>
        </div>
        <p id={descriptionId} className="tour__text" aria-live="polite">
          {step.text}
        </p>
        <div className="tour__progress" aria-label={`第 ${stepIndex + 1} 步，共 ${STEPS.length} 步`}>
          {STEPS.map((item, index) => (
            <i key={item.title} className={index === stepIndex ? 'is-active' : ''} />
          ))}
        </div>
        <div className="tour__actions">
          {stepIndex > 0 ? (
            <UiButton
              variant="ghost"
              icon={<ArrowLeft size={16} />}
              onClick={() => setStepIndex((index) => index - 1)}
            >
              上一步
            </UiButton>
          ) : (
            <span />
          )}
          <UiButton
            ref={nextRef}
            variant="primary"
            icon={isLast ? undefined : <ArrowRight size={16} />}
            onClick={() => {
              if (isLast) onClose()
              else setStepIndex((index) => index + 1)
            }}
          >
            {isLast ? '开始游戏' : '下一步'}
          </UiButton>
        </div>
      </div>
    </div>
  )
}
