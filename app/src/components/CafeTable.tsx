import { GameIcon } from './GameIcon'
import { Star } from 'lucide-react'
import type { CafeCustomer, CafeOrder, CafeTable as CafeTableState } from '../game/cafeTypes'

export interface CafeTableProps {
  table: CafeTableState
  customer?: CafeCustomer
  order?: CafeOrder
  misplacedOrder?: CafeOrder
  elapsed: number
  focused: boolean
  draggingTray: boolean
  onFocusOrder: (orderId: string) => void
  onServe: (orderId: string, tableId: string) => void
  onRecover: (orderId: string) => void
  onClean: (tableId: string) => void
}

const STATUS_LABEL: Record<CafeTableState['status'], string> = {
  empty: '空桌',
  seated: '有人',
  ordering: '点单中',
  waiting: '等餐中',
  served: '已上菜',
  dirty: '待清理',
}

export function CafeTable({
  table,
  customer,
  order,
  misplacedOrder,
  elapsed,
  focused,
  draggingTray,
  onFocusOrder,
  onServe,
  onRecover,
  onClean,
}: CafeTableProps) {
  const patiencePct = customer ? Math.max(0, Math.min(1, customer.patience / customer.patienceMax)) : 0
  const patienceTone = patiencePct < 0.25 ? 'danger' : patiencePct < 0.55 ? 'warn' : 'ok'
  const canDrop = draggingTray && order?.status === 'ready' && order.tableId === table.id
  const recoverIn = misplacedOrder
    ? Math.max(0, (misplacedOrder.misplacedUntil ?? elapsed) - elapsed)
    : 0

  // 顾客现在到底在说什么：点单 / 等待 / 快没耐心 / 上菜后的真实评价
  const bubble = (() => {
    if (misplacedOrder) {
      return {
        text: `这不是我的，${recoverIn.toFixed(1)}s 内取回`,
        tone: 'warn' as const,
      }
    }
    if (!order) return null
    if (order.status === 'served') {
      if (order.satisfaction >= 3) return { text: '就是这个味道！太好啦～', tone: 'happy' as const }
      if (order.satisfaction === 2) return { text: '很好吃，谢谢你～', tone: 'happy' as const }
      return { text: '还不错，谢谢。', tone: 'ok' as const }
    }
    if (order.status === 'failed') return { text: '等太久啦，我先走了…', tone: 'sad' as const }
    if (order.status === 'ready') return { text: '好香呀！', tone: 'happy' as const }
    if (order.status === 'pending') return { text: `一份${order.name}，谢谢～`, tone: 'order' as const }
    if (patienceTone === 'danger') return { text: '有点等不及啦…', tone: 'warn' as const }
    return { text: customer?.preferenceLabel ?? '慢慢来，不着急～', tone: 'pref' as const }
  })()

  const handleClick = () => {
    if (order && (order.status === 'pending' || order.status === 'crafting')) {
      onFocusOrder(order.id)
    }
  }

  return (
    <article
      className={`cafe-table cafe-table--${table.status}${focused ? ' is-focused' : ''}${
        canDrop ? ' is-drop' : ''
      }${misplacedOrder ? ' has-misplaced' : ''}`}
      data-table-id={table.id}
      data-misplaced-order-id={misplacedOrder?.id}
      data-drop={draggingTray ? `table:${table.id}` : undefined}
      onClick={handleClick}
    >
      <header className="cafe-table__head">
        <span className="cafe-table__index t-num">{table.index}</span>
        <span className="cafe-table__customer">
          {customer ? customer.name : misplacedOrder ? '放错桌' : STATUS_LABEL[table.status]}
        </span>
      </header>

      <span
        key={customer?.id ?? table.status}
        className={`cafe-table__avatar cafe-table__avatar--${customer?.status ?? table.status}`}
        aria-hidden="true"
      >
        <span className="cafe-table__avatar-ring" />
        <GameIcon name={customer?.icon ?? (table.status === 'dirty' ? 'Droplets' : 'Armchair')} size={21} />
        {customer ? <i className="cafe-table__mood-dot" /> : null}
      </span>

      {customer ? (
        <div className={`cafe-table__patience cafe-table__patience--${patienceTone}`}>
          <span className="cafe-table__patience-bar">
            <i style={{ width: `${patiencePct * 100}%` }} />
          </span>
          <span className="cafe-table__patience-num t-num">{Math.ceil(customer.patience)}s</span>
        </div>
      ) : null}

      {bubble ? (
        <p
          key={`${misplacedOrder?.id ?? order?.id}-${order?.status}-${order?.satisfaction}`}
          className={`cafe-table__bubble cafe-table__bubble--${bubble.tone}`}
        >
          <GameIcon name={misplacedOrder?.icon ?? order?.icon ?? 'MessageCircle'} size={12} />
          <span className="cafe-table__bubble-text">
            {bubble.text}
            {order && order.size > 1 && order.status !== 'served' ? (
              <b className="t-num"> ×{order.size}</b>
            ) : null}
          </span>
          {order?.status === 'served' ? (
            <span className="cafe-table__stars" aria-label={`满意度 ${order.satisfaction} / 3`}>
              {[0, 1, 2].map((i) => (
                <Star
                  key={i}
                  size={11}
                  strokeWidth={2.2}
                  fill={i < order.satisfaction ? 'currentColor' : 'none'}
                />
              ))}
            </span>
          ) : null}
        </p>
      ) : (
        <p className="cafe-table__order cafe-table__order--quiet t-muted">
          <GameIcon name={table.hasEmptyCup ? 'Droplets' : 'Sparkles'} size={12} />
          <span>{table.hasEmptyCup ? '收杯' : '空闲'}</span>
        </p>
      )}

      {order?.status === 'served' ? (
        <span key={`reward-${order.id}`} className="cafe-table__reward" aria-hidden="true">
          +{order.baseCoins}
        </span>
      ) : null}

      <div className="cafe-table__actions">
        {misplacedOrder ? (
          <button
            type="button"
            className="cafe-mini cafe-mini--recover"
            onClick={() => onRecover(misplacedOrder.id)}
          >
            取回
          </button>
        ) : null}
        {order && order.status === 'pending' ? (
          <button type="button" className="cafe-mini cafe-mini--sea" onClick={() => onFocusOrder(order.id)}>
            接单
          </button>
        ) : null}
        {order && order.status === 'ready' ? (
          <button type="button" className="cafe-mini cafe-mini--gold" onClick={() => onServe(order.id, table.id)}>
            上菜
          </button>
        ) : null}
        {table.status === 'dirty' ? (
          <button type="button" className="cafe-mini" onClick={() => onClean(table.id)}>
            清理
          </button>
        ) : null}
        {order && order.status === 'failed' ? (
          <span className="cafe-table__failed">已离开</span>
        ) : null}
      </div>
    </article>
  )
}
