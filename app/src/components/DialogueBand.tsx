import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { playSfx } from '../game/sfx'

/**
 * 剧情旁白条：把「说明性文字」改成一句可逐字浮现的剧情台词。
 * - 逐字打字机效果，点一下立刻显示全句，再点一下换下一句
 * - 尊重系统「减弱动态效果」偏好，直接显示整句
 */

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export interface DialogueBandProps {
  lines: string[]
  speaker?: string
  tone?: 'narration' | 'pet' | 'character'
  action?: ReactNode
}

export function DialogueBand({ lines, speaker, tone = 'narration', action }: DialogueBandProps) {
  const reduced = usePrefersReducedMotion()
  const [index, setIndex] = useState(0)
  const [typing, setTyping] = useState({ key: '', count: 0 })

  const text = lines[index] ?? ''
  const lineKey = `${index}\u0000${text}`
  const shown = reduced ? text.length : typing.key === lineKey ? typing.count : 0
  const done = shown >= text.length

  useEffect(() => {
    if (!text || reduced) return
    let i = 0
    const id = window.setInterval(() => {
      i += 1
      setTyping({ key: lineKey, count: i })
      if (i >= text.length) window.clearInterval(id)
    }, 46)
    return () => window.clearInterval(id)
  }, [lineKey, reduced, text])

  const advance = useCallback(() => {
    if (!done) {
      setTyping({ key: lineKey, count: text.length })
      return
    }
    if (lines.length > 1) {
      playSfx('page')
      setIndex((v) => (v + 1) % lines.length)
    }
  }, [done, lineKey, text.length, lines.length])

  return (
    <div
      className={`dlg dlg--${tone}`}
      role="button"
      tabIndex={0}
      onClick={advance}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          advance()
        }
      }}
    >
      {speaker ? <span className="dlg__speaker">{speaker}</span> : null}
      <p className="dlg__text">
        <span>{text.slice(0, shown)}</span>
        {done ? null : <span className="dlg__caret" aria-hidden="true" />}
      </p>
      {done && lines.length > 1 ? (
        <span className="dlg__more" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      ) : null}
      {action ? <div className="dlg__action">{action}</div> : null}
    </div>
  )
}
