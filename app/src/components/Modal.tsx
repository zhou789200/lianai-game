import type { ReactNode } from 'react'

export interface ModalProps {
  title: string
  subtitle?: string
  onClose?: () => void
  children?: ReactNode
  actions?: ReactNode
}

export function Modal({ title, subtitle, onClose, children, actions }: ModalProps) {
  return (
    <div
      className="modal-layer"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget && onClose) onClose()
      }}
    >
      <div className="modal">
        <h2 className="modal__title">{title}</h2>
        {subtitle ? <p className="modal__sub">{subtitle}</p> : null}
        {children ? <div className="modal__body">{children}</div> : null}
        {actions ? <div className="modal__actions">{actions}</div> : null}
      </div>
    </div>
  )
}
