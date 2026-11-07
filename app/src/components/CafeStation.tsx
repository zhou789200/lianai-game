import { GameIcon } from './GameIcon'
import type { CafeStationState, StationId } from '../game/cafeTypes'

export interface CafeStationProps {
  id: StationId
  name: string
  icon: string
  hint: string
  station: CafeStationState
  /** 当前聚焦订单的下一步是否指向本设备 */
  active: boolean
  /** 正在拖拽时，本设备是否可接收 */
  highlight: boolean
  /** 设备自身的加工进度（0..1），null 表示空闲 */
  progress: number | null
  /** 本设备当前加工的订单是否就是聚焦订单 */
  processingFocused: boolean
}

export function CafeStation({
  id,
  name,
  icon,
  hint,
  station,
  active,
  highlight,
  progress,
  processingFocused,
}: CafeStationProps) {
  const busy = station.busy.length
  const occupied = busy >= station.capacity
  const pips = Math.max(station.capacity, 1)

  return (
    <div
      className={`cafe-station cafe-station--${id}${active ? ' is-active' : ''}${
        highlight ? ' is-highlight' : ''
      }${occupied ? ' is-occupied' : ''}${busy > 0 ? ' is-busy' : ''}${
        processingFocused ? ' is-processing' : ''
      }`}
      data-drop={`station:${id}`}
      aria-label={`${name}，${occupied ? '占用中' : '空闲'}`}
    >
      <span className="cafe-station__fx" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="cafe-station__icon">
        <GameIcon name={icon} size={18} />
      </span>
      <span className="cafe-station__name">
        {name}
        <i className="cafe-station__level t-num">Lv.{station.level}</i>
      </span>
      <span className="visually-hidden">{hint}</span>

      <div className="cafe-station__pips" aria-hidden="true">
        {Array.from({ length: pips }).map((_, i) => (
          <span key={i} className={`cafe-pip${i < busy ? ' is-on' : ''}`} />
        ))}
      </div>

      {progress !== null ? (
        <span className="cafe-station__progress" aria-hidden="true">
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      ) : null}

      {occupied ? (
        <span className="cafe-station__busy" aria-label="设备占用中">
          <GameIcon name="Clock" size={10} />
        </span>
      ) : null}
      {processingFocused && progress === null ? (
        <span className="cafe-station__busy cafe-station__busy--own" aria-label="加工中">
          <GameIcon name="Sparkles" size={10} />
        </span>
      ) : null}
    </div>
  )
}
