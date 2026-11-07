import type { ReactNode } from 'react'
import { GameIcon } from './GameIcon'

export interface PanelProps {
  title?: string
  icon?: string
  hint?: ReactNode
  tone?: 'paper' | 'sea' | 'coral'
  className?: string
  children: ReactNode
}

export function Panel({ title, icon, hint, tone = 'paper', className, children }: PanelProps) {
  const toneClass = tone === 'paper' ? '' : `panel--${tone}`
  return (
    <section className={['panel', toneClass, className ?? ''].filter(Boolean).join(' ')}>
      {title ? (
        <header className="panel__head">
          {icon ? <GameIcon name={icon} size={18} /> : null}
          <h2 className="panel__title">{title}</h2>
          {hint ? <span className="panel__hint">{hint}</span> : null}
        </header>
      ) : null}
      {children}
    </section>
  )
}

export function SectionLabel({ icon, children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="section-label">
      {icon ? <GameIcon name={icon} size={15} /> : null}
      <span>{children}</span>
    </div>
  )
}
