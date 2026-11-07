import { GameIcon } from './GameIcon'
import type { CafeOrder } from '../game/cafeTypes'

export interface CafeTrayProps {
  capacity: number
  orders: CafeOrder[]
  focusedId?: string
  onFocus: (orderId: string) => void
  onServe: (orderId: string) => void
  onRecover: (orderId: string) => void
  onDragStart: (orderId: string, event: React.PointerEvent) => void
}

export function CafeTray({
  capacity,
  orders,
  focusedId,
  onFocus,
  onServe,
  onRecover,
  onDragStart,
}: CafeTrayProps) {
  return (
    <div className="cafe-tray" aria-label="出餐托盘">
      <header className="cafe-tray__head">
        <GameIcon name="ClipboardList" size={14} />
        <span>出餐托盘</span>
        <span className="cafe-tray__count t-num">
          {orders.length}/{capacity}
        </span>
      </header>
      <div className="cafe-tray__slots">
        {Array.from({ length: capacity }).map((_, i) => {
          const order = orders[i]
          if (!order) {
            return <span key={i} className="cafe-tray__slot" aria-hidden="true" />
          }
          return (
            <div
              key={order.id}
              className={`cafe-tray__item is-new${focusedId === order.id ? ' is-focused' : ''}${
                order.misplacedTableId ? ' is-misplaced' : ''
              }`}
              data-order-id={order.id}
            >
              <button
                type="button"
                className="cafe-tray__grab"
                onPointerDown={(e) => onDragStart(order.id, e)}
                onClick={() => onFocus(order.id)}
              >
                <GameIcon name={order.icon} size={16} />
                <span className="cafe-tray__item-name">{order.name}</span>
              </button>
              {order.misplacedTableId ? (
                <button
                  type="button"
                  className="cafe-tray__serve cafe-tray__serve--recover"
                  onClick={() => onRecover(order.id)}
                >
                  取回
                </button>
              ) : (
                <button type="button" className="cafe-tray__serve" onClick={() => onServe(order.id)}>
                  上菜
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
