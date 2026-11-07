import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'gold' | 'sea' | 'cream' | 'ghost'

export interface UiButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'md' | 'sm'
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

/**
 * 统一按钮：具备正常 / 按下 / 禁用 / 加载状态，最小触控高度 44px（sm 为辅助操作）。
 */
export function UiButton({
  variant = 'cream',
  size = 'md',
  block = false,
  loading = false,
  icon,
  children,
  className,
  type = 'button',
  disabled,
  ...rest
}: UiButtonProps) {
  const classes = [
    'btn',
    `btn--${variant}`,
    size === 'sm' ? 'btn--sm' : '',
    block ? 'btn--block' : '',
    loading ? 'btn--loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn__spinner" aria-hidden="true" /> : icon}
      <span>{children}</span>
    </button>
  )
}
