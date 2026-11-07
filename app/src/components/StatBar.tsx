import { GameIcon } from './GameIcon'

export interface StatBarProps {
  icon: string
  label: string
  value: number
  max?: number
  /** 数值后缀，例如 /100 */
  showMax?: boolean
  tone?: 'hunger' | 'clean' | 'mood' | 'intimacy' | 'exp' | 'rel' | 'time'
  hint?: string
}

/** 带图标与数值的数值条，颜色 + 文本双重表达，不单靠颜色传达状态。 */
export function StatBar({
  icon,
  label,
  value,
  max = 100,
  showMax = false,
  tone = 'hunger',
  hint,
}: StatBarProps) {
  const safeMax = max <= 0 ? 1 : max
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100))
  const rounded = Math.round(value)

  return (
    <div className={`stat stat--${tone}`}>
      <span className="stat__icon">
        <GameIcon name={icon} size={16} />
      </span>
      <div className="stat__body">
        <div className="stat__label">
          <span>{label}</span>
          {hint ? <span className="t-muted">{hint}</span> : null}
        </div>
        <div
          className="stat__track"
          role="progressbar"
          aria-label={label}
          aria-valuenow={rounded}
          aria-valuemin={0}
          aria-valuemax={safeMax}
        >
          <div className="stat__fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="stat__value t-num">
        {showMax ? `${rounded}/${safeMax}` : rounded}
      </span>
    </div>
  )
}
