/* ============================================================
   R3 营业会话 —— 纯逻辑状态机
   ------------------------------------------------------------
   所有订单、设备、桌位、托盘和事件都只允许通过本文件的
   reducer / action 修改；组件只读取派生值并派发动作。
   不依赖 React、DOM 或随机数全局状态（随机序列保存在 state.rngState）。
   ============================================================ */
import {
  CAFE_RECIPES,
  CUSTOMER_BY_ID,
  CUSTOMER_EVENT_LINES,
  EQUIPMENT_EVENT_LINES,
  MATERIALS,
  PET_ASSIST_LINES,
  PET_SETTLE_DIARY,
  ROMANCE_DIALOGUE,
  ROMANCE_ICONS,
  ratingFromScore,
} from '../data/cafeContent'
import type {
  CafeAction,
  CafeActiveEvent,
  CafeCustomer,
  CafeCustomerDef,
  CafeMessage,
  CafeOrder,
  CafeRecipeDef,
  CafeScheduledEvent,
  CafeSessionConfig,
  CafeSessionState,
  CafeSettleSummary,
  CafeStationState,
  CafeTable,
  CraftStep,
  CustomerKind,
  StationId,
} from './cafeTypes'

/* ============================================================
   可复现随机数（mulberry32）
   ============================================================ */
function nextSeed(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return { value, seed: t }
}

function roll(rng: { rngState: number }): number {
  const r = nextSeed(rng.rngState)
  rng.rngState = r.seed
  return r.value
}

/* ============================================================
   难度 / 升级映射：设备等级 → 玩法变化（不是简单百分比）
   ============================================================ */
interface Derived {
  duration: number
  maxOrders: number
  trayCapacity: number
  targetOrders: number
  tipBonus: number
  cleanTip: number
  customerWeights: Record<CustomerKind, number>
  stations: Record<StationId, CafeStationState>
}

export function deriveFromEquipment(equipment: Record<string, number>): Derived {
  const machine = equipment.machine ?? 1
  const oven = equipment.oven ?? 1
  const counter = equipment.counter ?? 1
  const signboard = equipment.signboard ?? 1

  const duration = 120 + (counter >= 3 ? 10 : 0) + (signboard >= 4 ? 10 : 0)

  const stations: Record<StationId, CafeStationState> = {
    machine: {
      id: 'machine',
      level: machine,
      // 3 级解锁双份并行萃取
      capacity: machine >= 3 ? 2 : 1,
      busy: [],
      speed: machine >= 4 ? 0.6 : machine >= 2 ? 0.82 : 1,
    },
    oven: {
      id: 'oven',
      level: oven,
      // 3 级解锁双批烘焙
      capacity: oven >= 3 ? 2 : 1,
      busy: [],
      speed: oven >= 2 ? 0.75 : 1,
    },
    assembly: { id: 'assembly', level: 1, capacity: 2, busy: [], speed: 1 },
    tray: {
      id: 'tray',
      level: counter,
      capacity: 1 + (counter - 1),
      busy: [],
      speed: 1,
    },
    sink: { id: 'sink', level: 1, capacity: 2, busy: [], speed: 1 },
  }

  // 招牌升级改变顾客结构与客流
  const weights: Record<CustomerKind, number> = {
    officeWorker: 30,
    tourist: 26,
    catLover: 22,
    regular: 22,
  }
  if (signboard >= 2) {
    weights.tourist += 12
    weights.regular += 8
  }
  if (signboard >= 3) {
    weights.catLover += 14
  }
  if (signboard >= 4) {
    weights.regular += 12
  }

  return {
    duration,
    maxOrders: 2 + (counter - 1) + (signboard >= 3 ? 1 : 0),
    trayCapacity: 1 + (counter - 1),
    targetOrders: 6,
    tipBonus: (signboard - 1) * 2 + (machine >= 5 ? 1 : 0) + (oven >= 5 ? 2 : 0),
    cleanTip: 2 + (signboard >= 4 ? 2 : 0),
    customerWeights: weights,
    stations,
  }
}

/* ============================================================
   会话创建
   ============================================================ */
const TABLE_COUNT = 4

function createTables(): CafeTable[] {
  return Array.from({ length: TABLE_COUNT }, (_, i) => ({
    id: `t${i + 1}`,
    index: i + 1,
    status: 'empty' as const,
    hasEmptyCup: false,
  }))
}

function scheduleEvents(
  duration: number,
  hasRelationship: boolean,
  rng: { rngState: number },
): CafeScheduledEvent[] {
  const events: CafeScheduledEvent[] = []

  events.push({
    id: 'pet-1',
    kind: 'pet',
    at: Math.round(30 + roll(rng) * 14),
    fired: false,
  })

  if (hasRelationship) {
    events.push({
      id: 'romance-1',
      kind: 'romance',
      at: Math.round(66 + roll(rng) * 24),
      fired: false,
    })
  }

  let t = 12 + roll(rng) * 6
  let n = 0
  while (t < duration - 16 && n < 6) {
    const kind = n % 3 === 2 ? 'equipment' : 'customer'
    events.push({ id: `ev-${n}`, kind, at: Math.round(t), fired: false })
    t += 22 + roll(rng) * 7
    n += 1
  }

  return events
}

export function createCafeSession(config: CafeSessionConfig): CafeSessionState {
  const d = deriveFromEquipment(config.equipment)
  const rng = { rngState: config.seed }
  const events = scheduleEvents(d.duration, Boolean(config.relationship), rng)

  return {
    runId: config.runId,
    phase: 'running',
    duration: d.duration,
    elapsed: 0,
    tables: createTables(),
    customers: [],
    orders: [],
    stations: d.stations,
    tray: { capacity: d.trayCapacity, items: [] },
    scheduled: events,
    activeEvents: [],
    messages: [],
    config,
    maxOrders: d.maxOrders,
    targetOrders: d.targetOrders,
    customerWeights: d.customerWeights,
    tipBonus: d.tipBonus,
    cleanTip: d.cleanTip,
    servedCount: 0,
    failedCount: 0,
    coins: 0,
    tips: 0,
    exp: 0,
    perfectCount: 0,
    lastActionAt: 0,
    nextArrivalAt: 5,
    spawnIndex: 0,
    rngState: rng.rngState,
    settleId: null,
    petAssisted: false,
    petIntimacyGain: 0,
    petMoodGain: 0,
    romanceGain: 0,
    idleHinted: false,
    messageSeq: 0,
    log: ['开门营业，风铃响了一声。'],
    paused: false,
    closingAt: null,
  }
}

/* ============================================================
   查询辅助（导出供组件 / 测试使用）
   ============================================================ */
export function getRecipe(recipeId: string): CafeRecipeDef | undefined {
  return CAFE_RECIPES[recipeId]
}

export function getStep(order: CafeOrder): CraftStep | undefined {
  const recipe = CAFE_RECIPES[order.recipeId]
  if (!recipe) return undefined
  return recipe.steps[order.stepIndex]
}

export function isOrderActive(order: CafeOrder): boolean {
  return order.status !== 'served' && order.status !== 'failed'
}

export function canUseStation(state: CafeSessionState, station: StationId): boolean {
  const s = state.stations[station]
  return s.busy.length < s.capacity
}

/* ============================================================
   内部工具
   ============================================================ */
function patchOrder(
  orders: CafeOrder[],
  orderId: string,
  patch: Partial<CafeOrder>,
): CafeOrder[] {
  return orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o))
}

function patchTable(tables: CafeTable[], tableId: string, patch: Partial<CafeTable>): CafeTable[] {
  return tables.map((t) => (t.id === tableId ? { ...t, ...patch } : t))
}

function patchCustomer(
  customers: CafeCustomer[],
  customerId: string,
  patch: Partial<CafeCustomer>,
): CafeCustomer[] {
  return customers.map((c) => (c.id === customerId ? { ...c, ...patch } : c))
}

function freeStation(
  stations: Record<StationId, CafeStationState>,
  station: StationId,
  orderId: string,
): Record<StationId, CafeStationState> {
  return {
    ...stations,
    [station]: { ...stations[station], busy: stations[station].busy.filter((id) => id !== orderId) },
  }
}

function withMessage(
  state: CafeSessionState,
  kind: CafeMessage['kind'],
  text: string,
): CafeSessionState {
  const seq = state.messageSeq + 1
  return {
    ...state,
    messageSeq: seq,
    messages: [...state.messages, { id: seq, kind, text }].slice(-6),
    log: [...state.log, text].slice(-60),
  }
}

function chooseCustomerKind(rng: { rngState: number }, weights: Record<CustomerKind, number>): CustomerKind {
  const entries = Object.entries(weights) as [CustomerKind, number][]
  const total = entries.reduce((sum, [, w]) => sum + w, 0)
  let value = roll(rng) * total
  let picked: CustomerKind = entries[0][0]
  for (const [kind, w] of entries) {
    value -= w
    if (value <= 0) {
      picked = kind
      break
    }
  }
  return picked
}

function chooseRecipeId(
  rng: { rngState: number },
  recipeIds: string[],
  customer: CafeCustomerDef,
  spawnIndex: number,
): string {
  const pool = recipeIds.filter((id) => CAFE_RECIPES[id])
  if (pool.length === 0) return 'latte'
  // 开局先轮换菜单，保证玩家能体验到已解锁的不同做法。
  if (spawnIndex < pool.length) return pool[spawnIndex]
  if (pool.includes(customer.preferredRecipe) && roll(rng) < 0.55) {
    return customer.preferredRecipe
  }
  return pool[Math.min(pool.length - 1, Math.floor(roll(rng) * pool.length))]
}

function spawnCustomer(state: CafeSessionState): CafeSessionState {
  const freeTable = state.tables.find((t) => t.status === 'empty')
  if (!freeTable) return { ...state, nextArrivalAt: state.elapsed + 1.5 }

  const activeOrders = state.orders.filter(isOrderActive).length
  if (activeOrders >= state.maxOrders) {
    return { ...state, nextArrivalAt: state.elapsed + 2 }
  }

  const rng = { rngState: state.rngState }
  const kind = chooseCustomerKind(rng, state.customerWeights)
  const def = CUSTOMER_BY_ID[kind]
  const recipeId = chooseRecipeId(rng, state.config.recipeIds, def, state.spawnIndex)
  const recipe = CAFE_RECIPES[recipeId]
  const size = roll(rng) < 0.28 ? 2 : 1
  const customerId = `c${state.spawnIndex + 1}`
  const orderId = `o${state.spawnIndex + 1}`

  const customer: CafeCustomer = {
    id: customerId,
    kind,
    name: def.name,
    icon: def.icon,
    tableId: freeTable.id,
    status: 'ordering',
    patience: def.patience,
    patienceMax: def.patience,
    mood: 70,
    arrivedAt: state.elapsed,
    preferenceLabel: def.preference,
    helpedByPet: false,
  }

  const order: CafeOrder = {
    id: orderId,
    recipeId,
    name: recipe.name,
    icon: recipe.icon,
    customerId,
    tableId: freeTable.id,
    size,
    stepIndex: 0,
    status: 'pending',
    holdProgress: 0,
    processing: false,
    preferenceMatched: false,
    satisfaction: 0,
    qualityPenalty: 0,
    wrongTablePenalty: 0,
    baseCoins: recipe.price * size,
    baseExp: recipe.exp * size + (size > 1 ? 1 : 0),
    createdAt: state.elapsed,
    message: `${def.name}：一份${size > 1 ? '双份' : ''}${recipe.name}，谢谢。`,
  }

  const arrivalInterval = 12 + roll(rng) * 7 - (state.config.equipment.signboard ?? 1) * 0.5

  return withMessage(
    {
      ...state,
      customers: [...state.customers, customer],
      orders: [...state.orders, order],
      tables: patchTable(state.tables, freeTable.id, {
        status: 'ordering',
        customerId,
        orderId,
      }),
      spawnIndex: state.spawnIndex + 1,
      nextArrivalAt: state.elapsed + Math.max(8, arrivalInterval),
      rngState: rng.rngState,
    },
    'info',
    `${def.name}走进了店里，坐到了 ${freeTable.index} 号桌。`,
  )
}

/* ============================================================
   结算摘要
   ============================================================ */
export function computeSettlement(state: CafeSessionState): CafeSettleSummary {
  const servedOrders = state.orders.filter((o) => o.status === 'served')
  const avgSat =
    servedOrders.length > 0
      ? servedOrders.reduce((sum, o) => sum + o.satisfaction, 0) / servedOrders.length
      : 0
  const rawRating = 1 + (avgSat / 3) * 4 - state.failedCount * 0.3
  const rating = ratingFromScore(rawRating)
  const perfect = state.failedCount === 0 && state.servedCount >= state.targetOrders

  return {
    runId: state.runId,
    served: state.servedCount,
    failed: state.failedCount,
    coins: state.coins,
    tips: state.tips,
    exp: state.exp,
    rating,
    perfect,
    petAssisted: state.petAssisted,
    petIntimacyGain: state.petIntimacyGain,
    petMoodGain: state.petMoodGain,
    diary: state.petAssisted
      ? PET_SETTLE_DIARY[state.spawnIndex % PET_SETTLE_DIARY.length]
      : undefined,
    romanceCharacterId: state.romanceCharacterId,
    romanceGain: state.romanceGain,
    events: state.log.filter((l) => l.includes('布丁') || l.includes('林澈') || l.includes('顾淮')),
    log: state.log,
  }
}

/* ============================================================
   事件
   ============================================================ */
function fireEvent(state: CafeSessionState, event: CafeScheduledEvent): CafeSessionState {
  const now = state.elapsed

  if (event.kind === 'pet') {
    const waiting = [...state.customers]
      .filter((c) => c.status === 'ordering' || c.status === 'waiting' || c.status === 'seated')
      .sort((a, b) => a.patience / a.patienceMax - b.patience / b.patienceMax)
    const target = waiting[0]
    const line = PET_ASSIST_LINES[state.spawnIndex % PET_ASSIST_LINES.length]
    const active: CafeActiveEvent = {
      id: event.id,
      kind: 'pet',
      title: line.title,
      icon: 'PawPrint',
      text: line.text,
      createdAt: now,
      expiresAt: now + 6,
    }
    let customers = state.customers
    if (target) {
      customers = patchCustomer(customers, target.id, {
        patience: Math.min(target.patienceMax, target.patience + 10),
        helpedByPet: true,
      })
    }
    return withMessage(
      {
        ...state,
        customers,
        activeEvents: [...state.activeEvents, active],
        petAssisted: true,
        petIntimacyGain: state.petIntimacyGain + 2,
        petMoodGain: state.petMoodGain + 1,
      },
      'pet',
      target ? `${line.title}，${target.name}的耐心恢复了一些。` : line.title,
    )
  }

  if (event.kind === 'romance' && state.config.relationship) {
    const rel = state.config.relationship
    const info = ROMANCE_DIALOGUE[rel.id] ?? ROMANCE_DIALOGUE.linche
    const tier = rel.value >= 50 ? 'high' : rel.value >= 20 ? 'mid' : 'low'
    const text = info.lines[tier]
    const gain = tier === 'high' ? 5 : tier === 'mid' ? 4 : 3
    const active: CafeActiveEvent = {
      id: event.id,
      kind: 'romance',
      title: `${info.speaker}来了`,
      icon: ROMANCE_ICONS[rel.id] ?? 'Heart',
      text,
      speaker: info.speaker,
      createdAt: now,
      expiresAt: now + 8,
    }
    return withMessage(
      {
        ...state,
        activeEvents: [...state.activeEvents, active],
        romanceCharacterId: rel.id,
        romanceGain: state.romanceGain + gain,
      },
      'romance',
      `${info.speaker}推门进来，和你说了一句话。`,
    )
  }

  if (event.kind === 'equipment') {
    const line = EQUIPMENT_EVENT_LINES[state.spawnIndex % EQUIPMENT_EVENT_LINES.length]
    const active: CafeActiveEvent = {
      id: event.id,
      kind: 'equipment',
      title: line.title,
      icon: line.icon,
      text: line.text,
      createdAt: now,
      expiresAt: now + 5,
    }
    return { ...state, activeEvents: [...state.activeEvents, active] }
  }

  // 顾客小事件：不改变经济，只提供氛围与线索
  const line = CUSTOMER_EVENT_LINES[state.spawnIndex % CUSTOMER_EVENT_LINES.length]
  const active: CafeActiveEvent = {
    id: event.id,
    kind: 'customer',
    title: '店里的小事',
    icon: line.icon,
    text: line.text,
    createdAt: now,
    expiresAt: now + 5,
  }
  return { ...state, activeEvents: [...state.activeEvents, active] }
}

function fireDueEvents(state: CafeSessionState): CafeSessionState {
  let next = state
  for (const event of state.scheduled) {
    if (!event.fired && state.elapsed >= event.at) {
      next = fireEvent(next, event)
      next = {
        ...next,
        scheduled: next.scheduled.map((e) => (e.id === event.id ? { ...e, fired: true } : e)),
      }
    }
  }
  return next
}

/* ============================================================
   顾客离店 / 桌位流转
   ============================================================ */
function resolveDepartures(state: CafeSessionState): CafeSessionState {
  let next = state
  for (const customer of state.customers) {
    if (customer.status === 'served' && customer.leaveAt && state.elapsed >= customer.leaveAt) {
      next = {
        ...next,
        customers: patchCustomer(next.customers, customer.id, { status: 'satisfied' }),
        tables: patchTable(next.tables, customer.tableId, {
          status: 'dirty',
          customerId: undefined,
          orderId: undefined,
          hasEmptyCup: true,
        }),
      }
    } else if (
      customer.status === 'impatient' &&
      customer.leaveAt &&
      state.elapsed >= customer.leaveAt
    ) {
      next = {
        ...next,
        customers: patchCustomer(next.customers, customer.id, { status: 'left' }),
        tables: patchTable(next.tables, customer.tableId, {
          status: 'dirty',
          customerId: undefined,
          orderId: undefined,
          hasEmptyCup: true,
        }),
      }
    }
  }
  return next
}

/* ============================================================
   主 reducer
   ============================================================ */
export function cafeReducer(state: CafeSessionState, action: CafeAction): CafeSessionState {
  switch (action.type) {
    case 'PAUSE':
      return { ...state, paused: action.paused }

    case 'DISMISS_EVENT':
      return { ...state, activeEvents: state.activeEvents.filter((e) => e.id !== action.eventId) }

    case 'DISMISS_MESSAGE':
      return { ...state, messages: state.messages.filter((m) => m.id !== action.messageId) }

    case 'ACCEPT': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'pending') return state
      const customer = state.customers.find((c) => c.id === order.customerId)
      let next: CafeSessionState = {
        ...state,
        orders: patchOrder(state.orders, order.id, { status: 'crafting', message: undefined }),
        customers: customer
          ? patchCustomer(state.customers, customer.id, { status: 'waiting' })
          : state.customers,
        tables: patchTable(state.tables, order.tableId, { status: 'waiting' }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      next = withMessage(next, 'info', `接下了 ${order.name} 的订单。`)
      return next
    }

    case 'LOAD': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'crafting') return state
      const step = getStep(order)
      if (!step || step.kind !== 'load') return state
      if (step.material !== action.material) {
        return withMessage(
          state,
          'error',
          `这一步需要「${step.material ? MATERIALS[step.material].name : '原料'}」。`,
        )
      }
      if (step.station !== action.station) {
        const name = step.station ? STATION_NAMES[step.station] : '设备'
        return withMessage(state, 'error', `应该把原料放到${name}。`)
      }
      const next: CafeSessionState = {
        ...state,
        orders: patchOrder(state.orders, order.id, {
          stepIndex: order.stepIndex + 1,
          holdProgress: 0,
          message: undefined,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      return next
    }

    case 'PROCESS_START': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'crafting' || order.processing || order.pendingQuality) return state
      const step = getStep(order)
      if (!step || step.kind !== 'process' || !step.station) return state
      const station = state.stations[step.station]
      if (station.busy.length >= station.capacity) {
        return withMessage(state, 'error', `${STATION_NAMES[step.station]}正忙，先处理别的事。`)
      }
      return {
        ...state,
        stations: {
          ...state.stations,
          [step.station]: { ...station, busy: [...station.busy, order.id] },
        },
        orders: patchOrder(state.orders, order.id, {
          processing: true,
          processStartedAt: state.elapsed,
          holdProgress: 0,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
    }

    case 'PROCESS_DONE': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || !order.processing) return state
      const step = getStep(order)
      if (!step || step.kind !== 'process' || !step.station) return state
      const stations = freeStation(state.stations, step.station, order.id)
      return {
        ...state,
        stations,
        orders: patchOrder(state.orders, order.id, {
          processing: false,
          processStartedAt: undefined,
          holdProgress: 1,
          pendingQuality: undefined,
          stepIndex: order.stepIndex + 1,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
    }

    case 'PROCESS_CANCEL': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || !order.processing) return state
      const step = getStep(order)
      const station = step?.station
      return {
        ...state,
        stations: station ? freeStation(state.stations, station, order.id) : state.stations,
        orders: patchOrder(state.orders, order.id, {
          processing: false,
          processStartedAt: undefined,
          holdProgress: 0,
        }),
        lastActionAt: state.elapsed,
      }
    }

    case 'PROCESS_IMPERFECT': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || !order.processing) return state
      const step = getStep(order)
      if (!step || step.kind !== 'process' || !step.station) return state
      const qualityLabel =
        action.quality === 'under'
          ? step.qualityLabels?.under ?? '火候不足'
          : step.qualityLabels?.over ?? '操作过头了'
      const next: CafeSessionState = {
        ...state,
        stations: freeStation(state.stations, step.station, order.id),
        orders: patchOrder(state.orders, order.id, {
          processing: false,
          processStartedAt: undefined,
          pendingQuality: action.quality,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      return withMessage(next, 'error', `${qualityLabel}，可以重做，也可以直接采用。`)
    }

    case 'PROCESS_RETRY': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || !order.pendingQuality) return state
      const next: CafeSessionState = {
        ...state,
        orders: patchOrder(state.orders, order.id, {
          pendingQuality: undefined,
          holdProgress: 0,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      return withMessage(next, 'info', '倒掉重做，这次看准时机再松手。')
    }

    case 'PROCESS_ADOPT': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || !order.pendingQuality) return state
      const recipe = CAFE_RECIPES[order.recipeId]
      if (!recipe) return state
      const penalty = recipe.failureRemedy.acceptPenalty
      const next: CafeSessionState = {
        ...state,
        orders: patchOrder(state.orders, order.id, {
          pendingQuality: undefined,
          holdProgress: 1,
          qualityPenalty: Math.min(100, order.qualityPenalty + penalty),
          stepIndex: order.stepIndex + 1,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      return withMessage(next, 'info', `瑕疵品继续使用，最终满意度 -${penalty}。`)
    }

    case 'ASSEMBLE': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'crafting') return state
      const step = getStep(order)
      if (!step || step.kind !== 'assemble') return state
      if (step.station !== action.station) {
        const name = step.station ? STATION_NAMES[step.station] : '装配台'
        return withMessage(state, 'error', `要去${name}组装。`)
      }
      if (action.material && !step.inputs?.includes(action.material)) {
        const inputs = step.inputs?.map((id) => MATERIALS[id].name).join('、') ?? '对应原料'
        return withMessage(state, 'error', `这里要放${inputs}。`)
      }
      return {
        ...state,
        orders: patchOrder(state.orders, order.id, {
          stepIndex: order.stepIndex + 1,
          message: undefined,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
    }

    case 'CHOOSE': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'crafting') return state
      const step = getStep(order)
      if (!step || step.kind !== 'choose' || !step.options) return state
      const option = step.options.find((o) => o.id === action.optionId)
      if (!option) return state
      const matched = state.config.recipeIds.includes(order.recipeId)
        ? Boolean(option.matchesPreference)
        : false
      return {
        ...state,
        orders: patchOrder(state.orders, order.id, {
          stepIndex: order.stepIndex + 1,
          selectedOptionId: option.id,
          preferenceMatched: order.preferenceMatched || matched,
          message: undefined,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
    }

    case 'PLATE': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'crafting') return state
      const step = getStep(order)
      if (!step || step.kind !== 'plate') return state
      if (state.tray.items.length >= state.tray.capacity) {
        return withMessage(state, 'error', '托盘满了，先把做好的饮品送到桌上。')
      }
      return {
        ...state,
        tray: { ...state.tray, items: [...state.tray.items, order.id] },
        orders: patchOrder(state.orders, order.id, {
          status: 'ready',
          stepIndex: order.stepIndex + 1,
          message: undefined,
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
    }

    case 'SERVE': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'ready' || !state.tray.items.includes(order.id)) return state
      if (order.misplacedTableId) {
        if (action.tableId === order.tableId) {
          return withMessage(state, 'error', '先把放错的成品取回托盘，再送到正确的桌位。')
        }
        if (action.tableId !== order.misplacedTableId) {
          return withMessage(state, 'error', '成品还放在错误桌，先把它取回来。')
        }
        const remaining = Math.max(0, Math.ceil((order.misplacedUntil ?? state.elapsed) - state.elapsed))
        return withMessage(state, 'info', `这杯放错桌了，还剩 ${remaining} 秒可以取回。`)
      }
      if (order.tableId !== action.tableId) {
        const next: CafeSessionState = {
          ...state,
          orders: patchOrder(state.orders, order.id, {
            misplacedTableId: action.tableId,
            misplacedUntil: state.elapsed + 3,
          }),
          lastActionAt: state.elapsed,
          idleHinted: false,
        }
        const wrongTable = state.tables.find((table) => table.id === action.tableId)
        return withMessage(
          next,
          'error',
          `放错到 ${wrongTable?.index ?? '?'} 号桌了，3 秒内取回不会扣分。`,
        )
      }
      const customer = state.customers.find((c) => c.id === order.customerId)
      if (!customer) return state
      const def = CUSTOMER_BY_ID[customer.kind]
      const recipe = CAFE_RECIPES[order.recipeId]

      const fast = state.elapsed - customer.arrivedAt <= customer.patienceMax * 0.5
      const baseSatisfaction =
        (fast ? 34 : 0) +
        (def.preferredRecipe === order.recipeId ? 33 : 0) +
        (order.preferenceMatched ? 33 : 0)
      const totalPenalty = Math.min(100, order.qualityPenalty + order.wrongTablePenalty)
      const adjustedSatisfaction = Math.max(0, baseSatisfaction - totalPenalty)
      const satisfaction = Math.max(1, Math.min(3, Math.round(adjustedSatisfaction / 33.4)))

      const tip =
        Math.round(order.baseCoins * (def.tipMult - 1) * (satisfaction / 3)) + state.tipBonus
      const exp = order.baseExp

      const next: CafeSessionState = {
        ...state,
        orders: patchOrder(state.orders, order.id, {
          status: 'served',
          satisfaction,
          servedAt: state.elapsed,
        }),
        tray: { ...state.tray, items: state.tray.items.filter((id) => id !== order.id) },
        customers: patchCustomer(state.customers, customer.id, {
          status: 'served',
          leaveAt: state.elapsed + 4,
          mood: Math.min(100, customer.mood + satisfaction * 8),
        }),
        tables: patchTable(state.tables, order.tableId, { status: 'served', hasEmptyCup: true }),
        servedCount: state.servedCount + 1,
        perfectCount: state.perfectCount + (satisfaction >= 3 ? 1 : 0),
        coins: state.coins + order.baseCoins,
        tips: state.tips + tip,
        exp: state.exp + exp,
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      const label = satisfaction >= 3 ? '非常满意' : satisfaction === 2 ? '很满意' : '还行'
      // 把加分明细写进提示：玩家能看懂这一单为什么是 1/2/3 星
      const reasons = [
        fast ? '上菜快' : null,
        def.preferredRecipe === order.recipeId ? '合口味' : null,
        order.preferenceMatched ? '命中偏好' : null,
        order.qualityPenalty > 0 ? `操作瑕疵 -${order.qualityPenalty}` : null,
        order.wrongTablePenalty > 0 ? `上错桌 -${order.wrongTablePenalty}` : null,
      ].filter((reason): reason is string => Boolean(reason))
      const reasonText = reasons.length > 0 ? `（${reasons.join(' + ')}）` : ''
      return withMessage(
        next,
        'success',
        `${recipe.name}送到了 ${state.tables.find((t) => t.id === order.tableId)?.index} 号桌，${customer.name}${label}${reasonText}${tip > 0 ? `，小费 +${tip}` : ''}。`,
      )
    }

    case 'RECOVER_MISPLACED': {
      const order = state.orders.find((o) => o.id === action.orderId)
      if (!order || order.status !== 'ready' || !order.misplacedTableId) return state
      return withMessage(
        {
          ...state,
          orders: patchOrder(state.orders, order.id, {
            misplacedTableId: undefined,
            misplacedUntil: undefined,
          }),
          lastActionAt: state.elapsed,
          idleHinted: false,
        },
        'success',
        '成品已经取回托盘，没有扣分。',
      )
    }

    case 'CLEAN': {
      const table = state.tables.find((t) => t.id === action.tableId)
      if (!table || (table.status !== 'dirty' && !table.hasEmptyCup)) return state
      const next: CafeSessionState = {
        ...state,
        tables: patchTable(state.tables, table.id, {
          status: 'empty',
          customerId: undefined,
          orderId: undefined,
          hasEmptyCup: false,
        }),
        tips: state.tips + state.cleanTip,
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      return withMessage(next, 'success', `${table.index} 号桌收拾干净了，小费 +${state.cleanTip}。`)
    }

    case 'TIDY': {
      const waiting = [...state.customers]
        .filter((c) => c.status === 'ordering' || c.status === 'waiting' || c.status === 'seated')
        .sort((a, b) => a.patience / a.patienceMax - b.patience / b.patienceMax)
      const target = waiting[0]
      if (!target) {
        return { ...state, lastActionAt: state.elapsed, idleHinted: false }
      }
      const next: CafeSessionState = {
        ...state,
        customers: patchCustomer(state.customers, target.id, {
          patience: Math.min(target.patienceMax, target.patience + 6),
        }),
        lastActionAt: state.elapsed,
        idleHinted: false,
      }
      return withMessage(next, 'info', `你给${target.name}续了水，客人看起来放松了一点。`)
    }

    case 'CLOSE':
    case 'SETTLE': {
      if (state.phase === 'settled') return state
      return { ...state, phase: 'settled', settleId: state.runId, paused: false }
    }

    case 'RUN':
      return runTick(state, action.dt)

    default:
      return state
  }
}

const STATION_NAMES: Record<StationId, string> = {
  machine: '咖啡机',
  oven: '烤箱',
  assembly: '装配台',
  tray: '托盘',
  sink: '清洗区',
}

/* ============================================================
   时间推进
   ============================================================ */
function runTick(state: CafeSessionState, dt: number): CafeSessionState {
  if (state.phase === 'settled' || state.phase === 'idle') return state
  if (state.paused) return state

  const elapsed = state.elapsed + dt
  let next: CafeSessionState = { ...state, elapsed }

  // 活跃事件到期
  next = {
    ...next,
    activeEvents: next.activeEvents.filter((e) => elapsed < e.expiresAt),
  }

  if (next.phase === 'running') {
    // 耐心衰减与失败判定
    const customers = next.customers.map((c) => {
      if (c.status === 'ordering' || c.status === 'waiting' || c.status === 'seated') {
        const patience = c.patience - dt
        if (patience <= 0) {
          return { ...c, patience: 0, status: 'impatient' as const, leaveAt: elapsed + 1.5 }
        }
        return { ...c, patience }
      }
      return c
    })
    next = { ...next, customers }

    // 失败的订单：耐心耗尽且尚未上菜
    for (const customer of next.customers) {
      if (customer.status === 'impatient') {
        const order = next.orders.find(
          (o) => o.customerId === customer.id && (o.status === 'pending' || o.status === 'crafting' || o.status === 'ready'),
        )
        if (order) {
          next = {
            ...next,
            orders: patchOrder(next.orders, order.id, {
              status: 'failed',
              message: '客人等太久离开了',
              pendingQuality: undefined,
              misplacedTableId: undefined,
              misplacedUntil: undefined,
            }),
            tray: { ...next.tray, items: next.tray.items.filter((id) => id !== order.id) },
            failedCount: next.failedCount + 1,
          }
          next = withMessage(next, 'error', `${customer.name}等太久离开了，这一单没有小费。`)
        }
      }
    }

    // 上错桌 3 秒窗口：超时后扣分并把成品放回托盘
    for (const order of next.orders) {
      if (
        order.status === 'ready' &&
        order.misplacedTableId &&
        order.misplacedUntil !== undefined &&
        elapsed >= order.misplacedUntil
      ) {
        const wrongTable = next.tables.find((table) => table.id === order.misplacedTableId)
        next = {
          ...next,
          orders: patchOrder(next.orders, order.id, {
            misplacedTableId: undefined,
            misplacedUntil: undefined,
            wrongTablePenalty: Math.max(order.wrongTablePenalty, 30),
          }),
        }
        next = withMessage(
          next,
          'error',
          `${wrongTable?.index ?? '错误'} 号桌拒收了这份${order.name}，成品已放回托盘，满意度 -30。`,
        )
      }
    }

    // 加工超时保护（组件失焦时不会卡住设备）
    for (const order of next.orders) {
      if (order.processing && order.processStartedAt !== undefined) {
        const step = getStep(order)
        const limit = ((step?.durationMs ?? 1500) / 1000) * 2 + 3
        if (elapsed - order.processStartedAt > limit) {
          const station = step?.station
          next = {
            ...next,
            stations: station ? freeStation(next.stations, station, order.id) : next.stations,
            orders: patchOrder(next.orders, order.id, {
              processing: false,
              processStartedAt: undefined,
              holdProgress: 0,
            }),
          }
        }
      }
    }

    // 到店
    while (next.elapsed >= next.nextArrivalAt && next.spawnIndex < 10 && next.elapsed < next.duration - 22) {
      const before = next.spawnIndex
      next = spawnCustomer(next)
      if (next.spawnIndex === before) break
    }

    // 事件
    next = fireDueEvents(next)

    // 8 秒空闲提示
    if (!next.idleHinted && elapsed - next.lastActionAt >= 8) {
      next = { ...next, idleHinted: true }
      next = withMessage(next, 'info', '没有新订单的话，可以擦擦桌子、续点水，或者先把原料准备好。')
    }

    // 进入收尾
    if (elapsed >= next.duration) {
      next = { ...next, phase: 'closing', closingAt: elapsed }
    }
  } else if (next.phase === 'closing') {
    const activeOrders = next.orders.filter(isOrderActive)
    const waiting = next.customers.filter(
      (c) => c.status === 'ordering' || c.status === 'waiting' || c.status === 'seated',
    )
    const graceOver = next.closingAt !== null && elapsed - next.closingAt >= 8
    if ((activeOrders.length === 0 && waiting.length === 0) || graceOver) {
      next = { ...next, phase: 'settled', settleId: next.runId }
    }
  }

  next = resolveDepartures(next)

  // 桌上没有客人却还标着占用时，自动回收，避免死锁
  next = {
    ...next,
    tables: next.tables.map((t) => {
      if (t.customerId && !next.customers.some((c) => c.id === t.customerId)) {
        return { ...t, customerId: undefined, orderId: undefined }
      }
      return t
    }),
  }

  return next
}

/** 运行中的实时结果预览（结算弹窗使用正式 computeSettlement） */
export function previewCoins(state: CafeSessionState): number {
  return state.coins + state.tips
}
