import { useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

export interface ModalProps {
  title: string
  subtitle?: string
  onClose?: () => void
  children?: ReactNode
  actions?: ReactNode
  initialFocusRef?: React.RefObject<HTMLElement | null>
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  actions,
  initialFocusRef,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closeHandlerRef = useRef(onClose)
  closeHandlerRef.current = onClose

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    if (!dialog) return
    const restoreFocus = () => previousFocus?.focus()

    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => !element.hasAttribute('hidden'))

    const initialFocus = initialFocusRef?.current ?? closeRef.current
    if (initialFocus) initialFocus.focus()
    else dialog.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeHandlerRef.current) {
        event.preventDefault()
        restoreFocus()
        closeHandlerRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusable()
      if (items.length === 0) {
        event.preventDefault()
        dialog.focus()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || !dialog.contains(document.activeElement))
      ) {
        event.preventDefault()
        first.focus()
      }
    }

    dialog.addEventListener('keydown', handleKeyDown)
    return () => {
      dialog.removeEventListener('keydown', handleKeyDown)
      restoreFocus()
    }
  }, [])

  return (
    <div
      className="modal-layer"
      onClick={(event) => {
        if (event.target === event.currentTarget && onClose) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        {onClose ? (
          <button
            ref={closeRef}
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label={`关闭${title}`}
          >
            <X size={17} />
          </button>
        ) : null}
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        {subtitle ? <p className="modal__sub">{subtitle}</p> : null}
        {children ? <div className="modal__body">{children}</div> : null}
        {actions ? <div className="modal__actions">{actions}</div> : null}
      </div>
    </div>
  )
}
