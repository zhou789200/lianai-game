import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { Clock, Pause, Play, Sparkles, Star, X } from 'lucide-react'
import { useGame } from '../game/GameContext'
import { cafeReducer, computeSettlement, createCafeSession, getStep } from '../game/cafeSession'
import type {
  CafeOrder,
  CafeSessionState,
  CraftStep,
  MaterialId,
  ProcessQuality,
  StationId,
} from '../game/cafeTypes'
import {
  CAFE_RECIPES,
  MATERIALS,
  RATING_LABELS,
  RAW_MATERIALS,
  STATION_DEFS,
  STATION_ORDER,
} from '../data/cafeContent'
import { GameIcon } from '../components/GameIcon'
import { Panel } from '../components/Panel'
import { Modal } from '../components/Modal'
import { UiButton } from '../components/UiButton'
import { CafeTable } from '../components/CafeTable'
import { CafeStation } from '../components/CafeStation'
import { CafeTray } from '../components/CafeTray'
import {
  CafeScenePerformance,
  type CafeSceneCue,
  type CafeSceneCueKind,
} from '../components/CafeScenePerformance'
import { playMeow } from '../game/petVoice'
import { playSfx, type SfxName } from '../game/sfx'

interface DragView {
  kind: 'material' | 'tray' | 'cup'
  x: number
  y: number
  label: string
  icon: string
}

interface DragPayload {
  kind: 'material' | 'tray' | 'cup'
  material?: MaterialId
  orderId?: string
  tableId?: string
  origin?: { x: number; y: number }
}

interface FlyFx {
  id: number
  kind: 'material' | 'plate' | 'serve' | 'clean'
  icon: string
  label: string
  from: { x: number; y: number }
  to: { x: number; y: number }
}

interface BusinessViewProps {
  runId: string
  onExit: () => void
}

function elementCenter(element: Element | null): { x: number; y: number } | null {
  if (!element) return null
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

function shortPreference(label: string | undefined): string {
  if (!label) return ''
  return label.split(/[，,。]/)[0]
}

function hashSeed(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function loadSound(station: StationId, material: MaterialId): SfxName {
  if (station === 'oven') return 'oven'
  if (station === 'machine') return material === 'milk' ? 'steam' : 'brew'
  if (station === 'assembly') {
    if (material === 'ice') return 'bubble'
    if (material === 'syrup') return 'pour'
    return 'plate'
  }
  return 'tap'
}

function processSound(step: CraftStep): SfxName {
  if (step.station === 'oven') return 'oven'
  if (step.station === 'assembly') {
    return step.label.includes('气泡') ? 'bubble' : 'whisk'
  }
  return step.label.includes('奶泡') ? 'steam' : 'brew'
}

export function BusinessView({ runId, onExit }: BusinessViewProps) {
  const { state: game, actions } = useGame()

  const [session, dispatch] = useReducer(
    cafeReducer,
    undefined,
    (): CafeSessionState =>
      createCafeSession({
        runId,
        recipeIds: game.recipes.filter((id) => CAFE_RECIPES[id]),
        equipment: game.equipment,
        seed: hashSeed(runId),
        petName: game.pet.name,
        relationship: pickRelationship(game.relationships),
      }),
  )

  const [focusedOrderId, setFocusedOrderId] = useState<string | null>(null)
  const [confirmExit, setConfirmExit] = useState(false)
  const [dragView, setDragView] = useState<DragView | null>(null)
  const [flyFx, setFlyFx] = useState<FlyFx[]>([])
  const [sceneCue, setSceneCue] = useState<CafeSceneCue | null>(null)
  const dragRef = useRef<DragPayload | null>(null)
  const focusedRef = useRef<string | null>(null)
  const settledRef = useRef<string | null>(null)
  const fxSeqRef = useRef(0)
  const fxTimersRef = useRef<number[]>([])
  const sceneSeqRef = useRef(0)
  const sceneTimerRef = useRef<number | null>(null)
  const seenCustomerIdsRef = useRef<Set<string>>(new Set())
  const previousServedRef = useRef(0)
  const previousDirtyCountRef = useRef(0)
  const previousEventIdRef = useRef<string | null>(null)
  const sessionRewardsRef = useRef({ coins: 0, exp: 0 })

  useEffect(() => {
    const totalCoins = session.coins + session.tips
    const deltaCoins = totalCoins - sessionRewardsRef.current.coins
    const deltaExp = session.exp - sessionRewardsRef.current.exp
    if (deltaCoins <= 0 && deltaExp <= 0) return
    sessionRewardsRef.current = { coins: totalCoins, exp: session.exp }
    actions.recordRunRewards(deltaCoins, deltaExp)
  }, [session.coins, session.tips, session.exp, actions])

  useEffect(() => {
    focusedRef.current = focusedOrderId
  }, [focusedOrderId])

  const triggerSceneCue = useCallback(
    (kind: CafeSceneCueKind, icon?: string, label?: string) => {
      const id = sceneSeqRef.current + 1
      sceneSeqRef.current = id
      setSceneCue({ id, kind, icon, label })
      if (sceneTimerRef.current !== null) {
        window.clearTimeout(sceneTimerRef.current)
      }
      if (kind === 'arrival') playSfx('arrival')
      if (kind === 'order') playSfx('tap')
      if (kind === 'serving') playSfx('serve')
      if (kind === 'cleaning') playSfx('clean')
      if (kind === 'pet') {
        playSfx('cafe-pet')
        playMeow()
      }
      if (kind === 'romance') playSfx('cafe-romance')
      sceneTimerRef.current = window.setTimeout(() => {
        setSceneCue((cue) => (cue?.id === id ? null : cue))
        sceneTimerRef.current = null
      }, 1900)
    },
    [],
  )

  const pushFx = useCallback((fx: Omit<FlyFx, 'id'>) => {
    const id = fxSeqRef.current + 1
    fxSeqRef.current = id
    setFlyFx((items) => [...items, { ...fx, id }])
    const timer = window.setTimeout(() => {
      setFlyFx((items) => items.filter((item) => item.id !== id))
      fxTimersRef.current = fxTimersRef.current.filter((item) => item !== timer)
    }, 980)
    fxTimersRef.current.push(timer)
  }, [])

  useEffect(
    () => () => {
      fxTimersRef.current.forEach((timer) => window.clearTimeout(timer))
      if (sceneTimerRef.current !== null) {
        window.clearTimeout(sceneTimerRef.current)
      }
    },
    [],
  )

  /* ---------------- 场景演出信号 ---------------- */
  useEffect(() => {
    const nextIds = new Set(session.customers.map((customer) => customer.id))
    const arrived = session.customers.find((customer) => !seenCustomerIdsRef.current.has(customer.id))
    session.customers.forEach((customer) => seenCustomerIdsRef.current.add(customer.id))

    if (arrived) {
      triggerSceneCue('arrival', arrived.icon, '')
    }

    for (const id of seenCustomerIdsRef.current) {
      if (!nextIds.has(id)) seenCustomerIdsRef.current.delete(id)
    }
  }, [session.customers, triggerSceneCue])

  useEffect(() => {
    if (session.servedCount > previousServedRef.current) {
      const latestServed = [...session.orders]
        .filter((order) => order.status === 'served')
        .sort((a, b) => (b.servedAt ?? 0) - (a.servedAt ?? 0))[0]
      triggerSceneCue('serving', latestServed?.icon, '')
    }
    previousServedRef.current = session.servedCount
  }, [session.orders, session.servedCount, triggerSceneCue])

  useEffect(() => {
    const dirtyCount = session.tables.filter((table) => table.status === 'dirty').length
    if (dirtyCount < previousDirtyCountRef.current) {
      triggerSceneCue('cleaning', 'Droplets', '')
    }
    previousDirtyCountRef.current = dirtyCount
  }, [session.tables, triggerSceneCue])

  useEffect(() => {
    const event = session.activeEvents[0]
    if (!event || event.id === previousEventIdRef.current) return
    previousEventIdRef.current = event.id
    if (event.kind === 'pet') triggerSceneCue('pet', event.icon)
    if (event.kind === 'romance') triggerSceneCue('romance', event.icon)
  }, [session.activeEvents, triggerSceneCue])

  /* ---------------- 主循环 ---------------- */
  useEffect(() => {
    if (session.phase === 'settled' || session.paused) return
    const timer = window.setInterval(() => dispatch({ type: 'RUN', dt: 0.25 }), 250)
    return () => window.clearInterval(timer)
  }, [session.phase, session.paused])

  /* ---------------- 失焦暂停 ---------------- */
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') dispatch({ type: 'PAUSE', paused: true })
    }
    const onBlur = () => dispatch({ type: 'PAUSE', paused: true })
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('blur', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  /* ---------------- 结算（幂等） ---------------- */
  useEffect(() => {
    if (session.phase !== 'settled') return
    if (settledRef.current === session.runId) return
    settledRef.current = session.runId
    playSfx('settle')
    actions.settleCafe(computeSettlement(session))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.phase, session.runId])

  /* ---------------- 消息自动消失 ---------------- */
  useEffect(() => {
    if (session.messages.length === 0) return
    const last = session.messages[session.messages.length - 1]
    const timer = window.setTimeout(() => dispatch({ type: 'DISMISS_MESSAGE', messageId: last.id }), 3200)
    return () => window.clearTimeout(timer)
  }, [session.messageSeq, session.messages])

  /* ---------------- 订单聚焦 ---------------- */
  const focusedOrder = useMemo<CafeOrder | undefined>(() => {
    const active = session.orders.filter((o) => o.status === 'crafting' || o.status === 'pending')
    if (focusedOrderId) {
      const found = active.find((o) => o.id === focusedOrderId)
      if (found) return found
    }
    return active.find((o) => o.status === 'crafting') ?? active[0]
  }, [session.orders, focusedOrderId])

  const step = focusedOrder ? getStep(focusedOrder) : undefined
  const recipe = focusedOrder ? CAFE_RECIPES[focusedOrder.recipeId] : undefined

  const focusOrder = useCallback(
    (orderId: string) => {
      setFocusedOrderId(orderId)
      const order = session.orders.find((o) => o.id === orderId)
      if (order?.status === 'pending') {
        triggerSceneCue('order', order.icon)
        dispatch({ type: 'ACCEPT', orderId })
      }
    },
    [session.orders, triggerSceneCue],
  )

  /* ---------------- 拖拽 ---------------- */
  const beginDrag = useCallback(
    (
      payload:
        | { kind: 'material'; material: MaterialId }
        | { kind: 'tray'; orderId: string }
        | { kind: 'cup'; tableId: string },
      label: string,
      icon: string,
      e: ReactPointerEvent,
    ) => {
      e.preventDefault()
      const origin = elementCenter(e.currentTarget) ?? undefined
      dragRef.current = { ...payload, origin }
      setDragView({ kind: payload.kind, x: e.clientX, y: e.clientY, label, icon })
    },
    [],
  )

  const applyDrop = useCallback(
    (drop: string, dropped = dragRef.current, targetEl?: HTMLElement | null) => {
      const payload = dropped
      if (!payload) return
      const [scope, id] = drop.split(':')
      const target = elementCenter(targetEl ?? null)

      if (payload.kind === 'tray') {
        if (scope === 'table' && payload.orderId) {
          const order = session.orders.find((item) => item.id === payload.orderId)
          if (order?.tableId === id && payload.origin && target) {
            pushFx({
              kind: 'serve',
              icon: order.icon,
              label: order.name,
              from: payload.origin,
              to: target,
            })
          }
          dispatch({ type: 'SERVE', orderId: payload.orderId, tableId: id })
        }
        return
      }

      // 空杯拖到清洗区
      if (payload.kind === 'cup') {
        if (scope === 'station' && id === 'sink' && payload.tableId) {
          const table = document.querySelector(`[data-table-id="${payload.tableId}"]`)
          const from = elementCenter(table) ?? payload.origin
          if (from && target) {
            pushFx({ kind: 'clean', icon: 'Droplets', label: '空杯', from, to: target })
          }
          dispatch({ type: 'CLEAN', tableId: payload.tableId })
        }
        return
      }

      // 原料拖拽：根据当前聚焦订单的步骤决定语义
      const material = payload.material
      if (!material) return
      const order = session.orders.find((o) => o.id === focusedRef.current)
      const current = order ? getStep(order) : undefined
      if (!order || !current) return

      if (scope !== 'station') return

      if (current.kind === 'load') {
        if (current.material === material && current.station === id && payload.origin && target) {
          pushFx({ kind: 'material', icon: payload.kind === 'material' ? MATERIALS[material].icon : 'Coffee', label: MATERIALS[material].name, from: payload.origin, to: target })
        }
        playSfx(loadSound(id as StationId, material))
        dispatch({ type: 'LOAD', orderId: order.id, material, station: id as StationId })
      } else if (current.kind === 'assemble') {
        if (current.station === id && current.inputs?.includes(material)) {
          if (payload.origin && target) {
            pushFx({ kind: 'material', icon: MATERIALS[material].icon, label: MATERIALS[material].name, from: payload.origin, to: target })
          }
          playSfx('whisk')
          dispatch({ type: 'ASSEMBLE', orderId: order.id, station: id as StationId })
        } else {
          dispatch({ type: 'ASSEMBLE', orderId: order.id, station: id as StationId, material })
        }
      } else if (current.kind === 'plate') {
        if (current.station === id && current.material === material) {
          if (payload.origin && target) {
            pushFx({ kind: 'plate', icon: MATERIALS[material].icon, label: MATERIALS[material].name, from: payload.origin, to: target })
          }
          playSfx('plate')
          dispatch({ type: 'PLATE', orderId: order.id })
        }
      }
    },
    [pushFx, session.orders],
  )

  const applyDropRef = useRef(applyDrop)

  useEffect(() => {
    applyDropRef.current = applyDrop
  }, [applyDrop])

  useEffect(() => {
    const onMove = (e: PointerEvent) =>
      setDragView((d) => (d ? { ...d, x: e.clientX, y: e.clientY } : d))
    const onUp = (e: PointerEvent) => {
      const payload = dragRef.current
      dragRef.current = null
      setDragView(null)
      if (!payload) return
      const el = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest('[data-drop]') as HTMLElement | null
      if (el?.dataset.drop) applyDropRef.current(el.dataset.drop, payload, el)
    }
    const onCancel = () => {
      dragRef.current = null
      setDragView(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [])

  /* ---------------- 点击备选路径 ---------------- */
  const clickStep = useCallback(
    (order: CafeOrder, current: CraftStep) => {
      const target = current.station
        ? document.querySelector(`[data-drop="station:${current.station}"]`)
        : null
      const targetCenter = elementCenter(target)

      if (current.kind === 'load' && current.material && current.station) {
        const source = document.querySelector(`[data-material-id="${current.material}"]`)
        const sourceCenter = elementCenter(source)
        if (sourceCenter && targetCenter) {
          pushFx({
            kind: 'material',
            icon: MATERIALS[current.material].icon,
            label: MATERIALS[current.material].name,
            from: sourceCenter,
            to: targetCenter,
          })
        }
        playSfx(loadSound(current.station, current.material))
        dispatch({ type: 'LOAD', orderId: order.id, material: current.material, station: current.station })
      } else if (current.kind === 'assemble' && current.station) {
        playSfx('whisk')
        dispatch({ type: 'ASSEMBLE', orderId: order.id, station: current.station })
      } else if (current.kind === 'plate') {
        const source = document.querySelector('.cafe-craft__step')
        const sourceCenter = elementCenter(source)
        if (sourceCenter && targetCenter) {
          pushFx({
            kind: 'plate',
            icon: order.icon,
            label: order.name,
            from: sourceCenter,
            to: targetCenter,
          })
        }
        playSfx('plate')
        dispatch({ type: 'PLATE', orderId: order.id })
      }
    },
    [pushFx],
  )

  const serveOrder = useCallback(
    (orderId: string) => {
      const order = session.orders.find((o) => o.id === orderId)
      if (!order) return
      const source = document.querySelector(`[data-order-id="${orderId}"]`)
      const target = document.querySelector(`[data-table-id="${order.tableId}"]`)
      const from = elementCenter(source)
      const to = elementCenter(target)
      if (from && to) {
        pushFx({ kind: 'serve', icon: order.icon, label: order.name, from, to })
      }
      dispatch({ type: 'SERVE', orderId, tableId: order.tableId })
    },
    [pushFx, session.orders],
  )

  /* ---------------- 派生展示值 ---------------- */
  const timeLeft = Math.max(0, Math.ceil(session.duration - session.elapsed))
  const sentiment = session.servedCount > 0 ? Math.round((session.perfectCount / session.servedCount) * 100) : 0
  const servedOrders = session.orders.filter((o) => o.status === 'served')
  const avgSatisfaction = servedOrders.length
    ? servedOrders.reduce((sum, o) => sum + o.satisfaction, 0) / servedOrders.length
    : 0
  const trayOrders = session.tray.items
    .map((id) => session.orders.find((o) => o.id === id))
    .filter((o): o is CafeOrder => Boolean(o))
  const latestMessage = session.messages[session.messages.length - 1]
  const activeEvent = session.activeEvents[0]
  const targetStation = step?.station
  const showTutorial = game.stats.businessRuns === 0

  const materialChips: MaterialId[] = useMemo(() => {
    if (!step) return RAW_MATERIALS
    if (step.kind === 'assemble' && step.inputs) return step.inputs
    if (step.kind === 'plate' && step.material) return [step.material]
    return RAW_MATERIALS
  }, [step])

  const canProcess =
    Boolean(step?.station) &&
    Boolean(focusedOrder) &&
    (session.stations[step!.station!].busy.length < session.stations[step!.station!].capacity ||
      (focusedOrder ? session.stations[step!.station!].busy.includes(focusedOrder.id) : false))

  /* ---------------- 渲染 ---------------- */
  return (
    <div className={`cafe-run${dragView ? ' is-dragging' : ''}`} data-phase={session.phase}>
      <div className="cafe-run__ambience" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
        <i />
      </div>
      <CafeScenePerformance cue={sceneCue} />

      <header className="cafe-run__hud">
        <span className="cafe-run__timer t-num">
          <Clock size={15} /> {timeLeft}s
        </span>
        <span className="cafe-run__chip t-num">
          <GameIcon name="Check" size={13} /> 上菜
          <b key={`served-${session.servedCount}`} className="cafe-run__pop">
            {session.servedCount}
          </b>
          /{session.targetOrders}
        </span>
        <span className="cafe-run__chip t-num">
          <GameIcon name="Star" size={13} /> 好评
          <b key={`sentiment-${sentiment}`} className="cafe-run__pop">
            {sentiment}%
          </b>
        </span>
        <div className="cafe-run__hud-actions">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label={session.paused ? '继续营业' : '暂停营业'}
            onClick={() => {
              playSfx('tap')
              dispatch({ type: 'PAUSE', paused: !session.paused })
            }}
          >
            {session.paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label="提前打烊"
            onClick={() => setConfirmExit(true)}
          >
            <X size={15} />
          </button>
        </div>
      </header>

      <div className="cafe-run__timerbar" aria-hidden="true">
        <i style={{ width: `${Math.max(0, Math.min(100, (timeLeft / session.duration) * 100))}%` }} />
      </div>

      {/* 桌位层 */}
      <section className="cafe-floor" aria-label="店内桌位">
        {session.tables.map((table) => {
          const customer = session.customers.find((c) => c.id === table.customerId)
          const order = session.orders.find((o) => o.customerId === table.customerId)
          const misplacedOrder = session.orders.find(
            (o) => o.status === 'ready' && o.misplacedTableId === table.id,
          )
          return (
            <CafeTable
              key={table.id}
              table={table}
              customer={customer}
              order={order}
              misplacedOrder={misplacedOrder}
              elapsed={session.elapsed}
              focused={Boolean(order && focusedOrder?.id === order.id)}
              draggingTray={Boolean(dragView && dragView.kind === 'tray')}
              onFocusOrder={focusOrder}
              onServe={serveOrder}
              onRecover={(orderId) => dispatch({ type: 'RECOVER_MISPLACED', orderId })}
              onClean={(tableId) => dispatch({ type: 'CLEAN', tableId })}
            />
          )
        })}
      </section>

      {/* 事件 / 消息 */}
      {activeEvent ? (
        <button
          type="button"
          className={`cafe-event cafe-event--${activeEvent.kind}`}
          onClick={() => dispatch({ type: 'DISMISS_EVENT', eventId: activeEvent.id })}
        >
          <GameIcon name={activeEvent.icon} size={16} />
          <span className="cafe-event__body">
            <b>{activeEvent.title}</b>
            <span>{activeEvent.text}</span>
          </span>
        </button>
      ) : null}

      {session.phase === 'closing' ? (
        <div className="cafe-banner">
          <Sparkles size={14} /> 最后收尾
        </div>
      ) : null}

      {/* 订单条 */}
      <section className="cafe-orders" aria-label="订单列表">
        {session.orders.filter((o) => o.status === 'pending' || o.status === 'crafting').length === 0 ? (
          <span className="cafe-orders__empty t-muted">
            <GameIcon name="Coffee" size={13} /> 稍等片刻
          </span>
        ) : null}
        {session.orders
          .filter((o) => o.status === 'pending' || o.status === 'crafting')
          .map((o) => (
            <button
              key={o.id}
              type="button"
              className={`cafe-orderchip cafe-orderchip--${o.status}${
                focusedOrder?.id === o.id ? ' is-focused' : ''
              }`}
              onClick={() => focusOrder(o.id)}
            >
              <GameIcon name={o.icon} size={15} />
              <span className="cafe-orderchip__name">{o.name}</span>
              {o.size > 1 ? <b className="t-num">×{o.size}</b> : null}
              <span className="cafe-orderchip__step t-num">
                {o.status === 'pending' ? '接单' : `${o.stepIndex + 1}/${CAFE_RECIPES[o.recipeId].steps.length}`}
              </span>
            </button>
          ))}
      </section>

      {/* 制作层 */}
      <section className="cafe-counter" aria-label="操作台">
        <Panel className="cafe-craft" tone="coral">
          {focusedOrder && step && recipe ? (
            <>
              <div className="cafe-craft__head">
                <GameIcon name={focusedOrder.icon} size={18} />
                <b>{focusedOrder.name}</b>
                {focusedOrder.size > 1 ? <span className="t-num">×{focusedOrder.size}</span> : null}
                <span className="t-muted">
                  {session.tables.find((t) => t.id === focusedOrder.tableId)?.index} 号桌
                </span>
              </div>
              <p className="cafe-craft__pref t-muted">
                <GameIcon name="Info" size={12} />
                <span>
                  {shortPreference(
                    session.customers.find((c) => c.id === focusedOrder.customerId)?.preferenceLabel,
                  )}
                </span>
              </p>
              <p className="cafe-craft__step">{step.label}</p>
              <div className="cafe-craft__track" aria-hidden="true">
                {recipe.steps.map((item, index) => (
                  <i
                    key={item.id}
                    className={
                      index < focusedOrder.stepIndex
                        ? 'is-done'
                        : index === focusedOrder.stepIndex
                          ? 'is-current'
                          : undefined
                    }
                  />
                ))}
              </div>

              {step.kind === 'choose' && step.options ? (
                <div className="cafe-craft__options">
                  {step.options.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      className="cafe-option"
                      onClick={() => {
                        playSfx('choice')
                        dispatch({ type: 'CHOOSE', orderId: focusedOrder.id, optionId: opt.id })
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              ) : step.kind === 'process' && focusedOrder.pendingQuality ? (
                <div className="cafe-process-recovery" role="alert">
                  <p>
                    <b>
                      {focusedOrder.pendingQuality === 'under'
                        ? step.qualityLabels?.under ?? '火候不足'
                        : step.qualityLabels?.over ?? '操作过头了'}
                    </b>
                    <span>要倒掉重做，还是直接采用这份瑕疵品？</span>
                  </p>
                  <div className="cafe-process-recovery__actions">
                    <button
                      type="button"
                      className="cafe-recovery__retry"
                      onClick={() => dispatch({ type: 'PROCESS_RETRY', orderId: focusedOrder.id })}
                    >
                      倒掉重做
                    </button>
                    <button
                      type="button"
                      className="cafe-recovery__adopt"
                      onClick={() => dispatch({ type: 'PROCESS_ADOPT', orderId: focusedOrder.id })}
                    >
                      直接采用
                      <small>满意度 -{recipe.failureRemedy.acceptPenalty}</small>
                    </button>
                  </div>
                </div>
              ) : step.kind === 'process' && step.gesture ? (
                <ProcessControl
                  key={step.id}
                  gesture={step.gesture}
                  durationMs={step.durationMs ?? 1200}
                  toleranceMs={step.toleranceMs ?? 0}
                  disabled={!canProcess || session.phase === 'settled'}
                  onStart={() => {
                    playSfx(processSound(step))
                    dispatch({ type: 'PROCESS_START', orderId: focusedOrder.id })
                  }}
                  onComplete={() => {
                    playSfx('success')
                    dispatch({ type: 'PROCESS_DONE', orderId: focusedOrder.id })
                  }}
                  onCancel={() => dispatch({ type: 'PROCESS_CANCEL', orderId: focusedOrder.id })}
                  onImperfect={(quality) => {
                    playSfx('error')
                    dispatch({ type: 'PROCESS_IMPERFECT', orderId: focusedOrder.id, quality })
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="cafe-action-btn"
                  onClick={() => clickStep(focusedOrder, step)}
                >
                  <Sparkles size={15} /> {step.short}
                </button>
              )}

              {focusedOrder.message ? <p className="cafe-craft__msg">{focusedOrder.message}</p> : null}
            </>
          ) : (
            <>
              <div className="cafe-craft__idle">
                <GameIcon name="Coffee" size={20} />
                <p>等待新鲜订单</p>
              </div>
              <div className="cafe-craft__util">
                <button
                  type="button"
                  className="cafe-mini"
                  onClick={() => {
                    playSfx('pour')
                    dispatch({ type: 'TIDY' })
                  }}
                >
                  给客人续水
                </button>
                {session.tables.some((t) => t.status === 'dirty') ? (
                  <button
                    type="button"
                    className="cafe-mini cafe-mini--gold"
                    onClick={() => {
                      const t = session.tables.find((x) => x.status === 'dirty')
                      if (t) dispatch({ type: 'CLEAN', tableId: t.id })
                    }}
                  >
                    顺手清理桌面
                  </button>
                ) : null}
              </div>
            </>
          )}
        </Panel>

        <div className="cafe-stations">
          {STATION_ORDER.map((id) => {
            const def = STATION_DEFS[id]
            return (
              <CafeStation
                key={id}
                id={id}
                name={def.name}
                icon={def.icon}
                hint={def.hint}
                station={session.stations[id]}
                active={targetStation === id}
                highlight={Boolean(dragView && dragView.kind === 'material')}
                progress={null}
                processingFocused={Boolean(focusedOrder?.processing && getStep(focusedOrder)?.station === id)}
              />
            )
          })}
        </div>

        {trayOrders.length > 0 ? (
          <CafeTray
            capacity={session.tray.capacity}
            orders={trayOrders}
            focusedId={focusedOrder?.id}
            onFocus={setFocusedOrderId}
            onServe={serveOrder}
            onRecover={(orderId) => dispatch({ type: 'RECOVER_MISPLACED', orderId })}
            onDragStart={(orderId, e) => {
              const order = session.orders.find((o) => o.id === orderId)
              beginDrag(
                { kind: 'tray', orderId },
                order?.name ?? '成品',
                order?.icon ?? 'Coffee',
                e,
              )
            }}
          />
        ) : null}
      </section>

      {/* 原料层 */}
      <section className="cafe-shelf" aria-label="原料架">
        {session.tables
          .filter((t) => t.status === 'dirty')
          .map((t) => (
            <button
              key={`cup-${t.id}`}
              type="button"
              className="cafe-material cafe-material--cup"
              onPointerDown={(e) => beginDrag({ kind: 'cup', tableId: t.id }, `${t.index}号桌空杯`, 'Droplets', e)}
              onClick={() => dispatch({ type: 'CLEAN', tableId: t.id })}
              aria-label={`把${t.index}号桌的空杯拖到清洗区`}
            >
              <GameIcon name="Droplets" size={16} />
              <span>{t.index}号空杯</span>
            </button>
          ))}
        {materialChips.map((id) => {
          const material = MATERIALS[id]
          const isTarget = step?.material === id || step?.inputs?.includes(id)
          return (
            <button
              key={id}
              type="button"
              className={`cafe-material${isTarget ? ' is-target' : ''}`}
              data-material-id={id}
              onPointerDown={(e) => beginDrag({ kind: 'material', material: id }, material.name, material.icon, e)}
              aria-label={`拖拽${material.name}到设备`}
            >
              <GameIcon name={material.icon} size={16} />
              <span>{material.name}</span>
            </button>
          )
        })}
        {showTutorial ? <span className="visually-hidden">拖到设备上，或直接点操作按钮</span> : null}
      </section>

      {latestMessage ? (
        <div className={`cafe-toast cafe-toast--${latestMessage.kind}`} role="status">
          {latestMessage.text}
        </div>
      ) : null}

      {flyFx.length > 0 ? (
        <div className="cafe-fly-layer" aria-hidden="true">
          {flyFx.map((fx) => (
            <span
              key={fx.id}
              className={`cafe-flyfx cafe-flyfx--${fx.kind}`}
              style={
                {
                  '--fx-from-x': `${fx.from.x}px`,
                  '--fx-from-y': `${fx.from.y}px`,
                  '--fx-dx': `${fx.to.x - fx.from.x}px`,
                  '--fx-dy': `${fx.to.y - fx.from.y}px`,
                  '--fx-mid-x': `${fx.from.x + (fx.to.x - fx.from.x) * 0.72}px`,
                  '--fx-mid-y': `${fx.from.y + (fx.to.y - fx.from.y) * 0.72 - 24}px`,
                } as CSSProperties
              }
            >
              <GameIcon name={fx.icon} size={18} />
              <i />
              <i />
              <i />
            </span>
          ))}
        </div>
      ) : null}

      {dragView ? (
        <div
          className="cafe-dragghost"
          style={{ left: dragView.x, top: dragView.y }}
          aria-hidden="true"
        >
          <GameIcon name={dragView.icon} size={18} />
          <span>{dragView.label}</span>
        </div>
      ) : null}

      {session.paused && session.phase !== 'settled' ? (
        <div className="cafe-pause" role="dialog" aria-modal="true" aria-label="已暂停">
          <Pause size={26} />
          <h2>营业已暂停</h2>
          <p>计时和顾客耐心都停住了，准备好了再继续。</p>
          <UiButton variant="primary" icon={<Play size={16} />} onClick={() => dispatch({ type: 'PAUSE', paused: false })}>
            继续营业
          </UiButton>
        </div>
      ) : null}

      {confirmExit ? (
        <Modal
          title="提前打烊？"
          subtitle="已经赚到的收入和小费会保留，但会少一些客户评价。"
          onClose={() => setConfirmExit(false)}
          actions={
            <>
              <UiButton variant="ghost" onClick={() => setConfirmExit(false)}>
                继续营业
              </UiButton>
              <UiButton
                variant="primary"
                onClick={() => {
                  setConfirmExit(false)
                  dispatch({ type: 'CLOSE' })
                }}
              >
                打烊结算
              </UiButton>
            </>
          }
        />
      ) : null}

      {session.phase === 'settled' ? (
        <Modal
          title={computeSettlement(session).perfect ? '完美营业！' : '今天的营业结束了'}
          subtitle={`客户评价：${RATING_LABELS[computeSettlement(session).rating] ?? '慢慢来'}`}
          actions={
            <UiButton variant="primary" icon={<Play size={16} />} onClick={onExit}>
              回到准备页
            </UiButton>
          }
        >
          <div className="result">
            <div className="result__row">
              <span>完成订单</span>
              <strong className="t-num">{session.servedCount}</strong>
            </div>
            <div className="result__row">
              <span>爽约订单</span>
              <strong className="t-num">{session.failedCount}</strong>
            </div>
            <div className="result__row">
              <span>营业收入</span>
              <strong className="t-num">+{session.coins}</strong>
            </div>
            <div className="result__row">
              <span>小费</span>
              <strong className="t-num">+{session.tips}</strong>
            </div>
            <div className="result__row">
              <span>经验</span>
              <strong className="t-num">+{session.exp}</strong>
            </div>
            <div className="result__row">
              <span>顾客满意</span>
              <strong className="result__stars" aria-label={`平均满意度 ${avgSatisfaction.toFixed(1)} / 3`}>
                {[0, 1, 2].map((i) => (
                  <Star
                    key={i}
                    size={13}
                    strokeWidth={2.2}
                    fill={i < Math.round(avgSatisfaction) ? 'currentColor' : 'none'}
                  />
                ))}
                <em>{servedOrders.length ? avgSatisfaction.toFixed(1) : '—'}</em>
              </strong>
            </div>
            {session.petAssisted ? (
              <p className="result__badge">
                <GameIcon name="PawPrint" size={14} /> 布丁在营业里帮了你一次
              </p>
            ) : null}
            {session.romanceCharacterId ? (
              <p className="result__badge">
                <GameIcon name="Heart" size={14} /> 有人专程来看了你的店
              </p>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </div>
  )
}

function pickRelationship(
  relationships: { id: string; name: string; value: number; met: boolean }[],
): { id: string; name: string; value: number } | null {
  if (relationships.length === 0) return null
  const sorted = [...relationships].sort((a, b) => b.value - a.value)
  const chosen = sorted[0]
  return { id: chosen.id, name: chosen.name, value: chosen.value }
}

/* ============================================================
   加工控件：长按 / 滑动 / 分步点击
   ============================================================ */
interface ProcessControlProps {
  gesture: 'hold' | 'swipe' | 'tap'
  durationMs: number
  toleranceMs: number
  disabled: boolean
  onStart: () => void
  onComplete: () => void
  onCancel: () => void
  onImperfect: (quality: ProcessQuality) => void
}

function ProcessControl({
  gesture,
  durationMs,
  toleranceMs,
  disabled,
  onStart,
  onComplete,
  onCancel,
  onImperfect,
}: ProcessControlProps) {
  const [progress, setProgress] = useState(0)
  const progressRef = useRef(0)
  const startedRef = useRef(false)
  const holdingRef = useRef(false)
  const startTimeRef = useRef(0)
  const startXRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const viaPointerRef = useRef(false)
  const downAtRef = useRef(0)
  // 记录最新指针位置（swipe 用）
  const lastXRef = useRef(0)
  const sweetMin = Math.max(1, durationMs - toleranceMs)
  const sweetMax = Math.max(sweetMin, durationMs + toleranceMs)

  const stopLoop = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [])

  useEffect(() => () => stopLoop(), [stopLoop])

  const finish = useCallback(() => {
    stopLoop()
    holdingRef.current = false
    if (!startedRef.current) {
      onStart()
      startedRef.current = true
    }
    progressRef.current = 0
    setProgress(0)
    startedRef.current = false
    onComplete()
  }, [onComplete, onStart, stopLoop])

  const tick = useCallback(() => {
    const update = () => {
      if (!holdingRef.current) return
      const now = performance.now()
      const heldMs = now - startTimeRef.current
      const raw =
        gesture === 'swipe'
          ? Math.abs(lastXRef.current - startXRef.current) / 120
          : heldMs / (gesture === 'hold' ? sweetMax : durationMs)
      const value = Math.max(0, Math.min(1, raw))
      if (value > progressRef.current) {
        progressRef.current = value
        setProgress(value)
      }
      if (gesture === 'swipe' && value >= 1) {
        finish()
        return
      }
      if (gesture === 'hold' && toleranceMs > 0 && heldMs >= sweetMax) {
        holdingRef.current = false
        stopLoop()
        progressRef.current = 1
        setProgress(1)
        startedRef.current = false
        onImperfect('over')
        return
      }
      rafRef.current = window.requestAnimationFrame(update)
    }
    update()
  }, [durationMs, finish, gesture, onImperfect, stopLoop, sweetMax, toleranceMs])

  const ensureStarted = () => {
    if (!startedRef.current) {
      onStart()
      startedRef.current = true
    }
  }

  const onPointerDown = (e: ReactPointerEvent<HTMLButtonElement>) => {
    if (disabled) return
    e.preventDefault()
    viaPointerRef.current = true
    ensureStarted()
    holdingRef.current = true
    downAtRef.current = performance.now()
    startTimeRef.current = performance.now()
    startXRef.current = e.clientX
    lastXRef.current = e.clientX
    tick()
  }

  const onPointerMove = (e: ReactPointerEvent<HTMLButtonElement>) => {
    lastXRef.current = e.clientX
  }

  const onPointerUp = () => {
    if (!holdingRef.current) return
    holdingRef.current = false
    stopLoop()
    if (gesture === 'swipe' && progressRef.current >= 1) return

    const heldMs = performance.now() - downAtRef.current
    if (heldMs < 220) {
      // 轻点兜底：轻轻点一下也算一步，便于单手 / 触屏操作
      const stepAmount = gesture === 'tap' ? 1 : 0.34
      const value = Math.min(1, progressRef.current + stepAmount)
      progressRef.current = value
      setProgress(value)
      if (value >= 1) finish()
      return
    }

    if (gesture === 'hold') {
      startedRef.current = false
      progressRef.current = 0
      setProgress(0)
      if (heldMs < sweetMin) {
        onImperfect('under')
      } else if (heldMs > sweetMax) {
        onImperfect('over')
      } else {
        onComplete()
      }
      return
    }

    // 长按 / 滑动中途松手：释放设备，避免锁死
    if (startedRef.current) {
      onCancel()
      startedRef.current = false
      progressRef.current = 0
      setProgress(0)
    }
  }

  const onClick = () => {
    if (disabled) return
    if (viaPointerRef.current) {
      viaPointerRef.current = false
      return
    }
    ensureStarted()
    const stepAmount = gesture === 'tap' ? 1 : 0.34
    const value = Math.min(1, progressRef.current + stepAmount)
    progressRef.current = value
    setProgress(value)
    if (value >= 1) finish()
  }

  const label = gesture === 'swipe' ? '按住并滑动' : gesture === 'hold' ? '按住不放' : '点按加工'
  const inSweetSpot =
    gesture === 'hold' && toleranceMs > 0 && progress * sweetMax >= sweetMin && progress < 1
  const zoneStart = toleranceMs > 0 ? (sweetMin / sweetMax) * 100 : 0

  return (
    <button
      type="button"
      className={`cafe-process cafe-process--${gesture}${inSweetSpot ? ' is-sweet' : ''}`}
      disabled={disabled}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={onClick}
    >
      {gesture === 'hold' && toleranceMs > 0 ? (
        <span
          className="cafe-process__zone"
          style={{ left: `${zoneStart}%`, width: `${100 - zoneStart}%` }}
          aria-hidden="true"
        />
      ) : null}
      <span className="cafe-process__fill" style={{ width: `${Math.round(progress * 100)}%` }} />
      <span className="cafe-process__label">
        <GameIcon name="Zap" size={15} /> {inSweetSpot ? '时机正好，松手' : label}（
        {Math.round(progress * 100)}%）
      </span>
    </button>
  )
}
