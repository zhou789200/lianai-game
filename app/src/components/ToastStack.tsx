import { useEffect } from 'react'
import { GameIcon } from './GameIcon'
import type { Notice } from '../game/types'

const KIND_ICON: Record<Notice['kind'], string> = {
  success: 'Check',
  error: 'AlertCircle',
  info: 'Info',
  reward: 'Sparkles',
}

function Toast({ notice, onDismiss }: { notice: Notice; onDismiss: (id: string) => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(notice.id), 3200)
    return () => window.clearTimeout(timer)
  }, [notice.id, onDismiss])

  return (
    <div className={`toast toast--${notice.kind}`} role="status">
      <span className="toast__icon">
        <GameIcon name={KIND_ICON[notice.kind]} size={13} />
      </span>
      <div>
        <div className="toast__title">{notice.title}</div>
        {notice.text ? <div className="toast__text">{notice.text}</div> : null}
      </div>
    </div>
  )
}

export function ToastStack({
  notices,
  onDismiss,
}: {
  notices: Notice[]
  onDismiss: (id: string) => void
}) {
  if (notices.length === 0) return null
  return (
    <div className="toasts" aria-live="polite">
      {notices.slice(-3).map((n) => (
        <Toast key={n.id} notice={n} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
