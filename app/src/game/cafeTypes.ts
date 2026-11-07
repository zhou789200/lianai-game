/* ============================================================
   R3 互动营业 —— 领域类型
   ------------------------------------------------------------
   本文件只描述「一局营业」会话的领域模型，不依赖 React，
   也不修改《游戏状态类型定义》里已有的存档结构。
   所有字段命名使用 camelCase，页面展示文案由内容层提供。
   ============================================================ */

/** 营业会话阶段 */
export type CafePhase = 'idle' | 'opening' | 'running' | 'closing' | 'settled'

/** 五类制作设施 */
export type StationId = 'machine' | 'oven' | 'assembly' | 'tray' | 'sink'

/** 原料 / 中间产物 / 成品 */
export type MaterialId =
  | 'cup'
  | 'milk'
  | 'coffeeBean'
  | 'ice'
  | 'syrup'
  | 'soda'
  | 'croissant'
  | 'butter'
  | 'garnish'
  | 'espresso'
  | 'foam'
  | 'latte'
  | 'pastry'
  | 'cooler'

export type MaterialRole = 'raw' | 'intermediate' | 'final'

export interface MaterialDef {
  id: MaterialId
  name: string
  icon: string
  role: MaterialRole
  /** 只在哪些步骤里作为可选原料出现；不填表示任何需要它的步骤都能取用 */
  hint?: string
}

/** 单步交互类型 */
export type StepKind = 'load' | 'process' | 'assemble' | 'choose' | 'plate'

/** 加工手势（长按 / 滑动 / 轻点） */
export type GestureKind = 'hold' | 'swipe' | 'tap'

/** 长按产物的偏差方向 */
export type ProcessQuality = 'under' | 'over'

export interface StepOption {
  id: string
  label: string
  /** 该选项是否命中顾客偏好 */
  matchesPreference?: boolean
}

export interface CraftStep {
  id: string
  kind: StepKind
  /** 完整操作提示（气泡 / 旁白） */
  label: string
  /** 按钮上的短提示 */
  short: string
  station?: StationId
  /** load 步骤需要拖动的原料 */
  material?: MaterialId
  /** assemble 步骤需要的中间产物 */
  inputs?: MaterialId[]
  gesture?: GestureKind
  /** 长按 / 滑动需要的时间，毫秒 */
  durationMs?: number
  /** 长按容差，毫秒 */
  toleranceMs?: number
  /** 长按偏差时使用的配方专属文案 */
  qualityLabels?: {
    under: string
    over: string
  }
  options?: StepOption[]
}

export interface CafeRecipeDef {
  id: string
  name: string
  icon: string
  price: number
  exp: number
  primaryStation: StationId
  failureRemedy: {
    retryAllowed: boolean
    retryCostCoins: number
    /** 直接采用瑕疵品的满意度扣减，取值 0–100 */
    acceptPenalty: number
  }
  /** 4 至 6 个有效动作 */
  steps: CraftStep[]
}

/* ---------------- 顾客 ---------------- */

export type CustomerKind = 'officeWorker' | 'tourist' | 'catLover' | 'regular'

export interface CafeCustomerDef {
  id: CustomerKind
  name: string
  icon: string
  /** 耐心值，单位秒 */
  patience: number
  /** 小费倍率 */
  tipMult: number
  /** 偏好说明（展示用） */
  preference: string
  preferredRecipe: string
  preferredOption?: string
  /** 出现权重，会被招牌升级修正 */
  weight: number
  accent: 'sea' | 'gold' | 'coral' | 'rose'
}

export type CustomerStatus =
  | 'entering'
  | 'seated'
  | 'ordering'
  | 'waiting'
  | 'served'
  | 'satisfied'
  | 'impatient'
  | 'left'

export type TableStatus = 'empty' | 'seated' | 'ordering' | 'waiting' | 'served' | 'dirty'

export type OrderStatus = 'pending' | 'crafting' | 'ready' | 'served' | 'failed'

export interface CafeCustomer {
  id: string
  kind: CustomerKind
  name: string
  icon: string
  tableId: string
  status: CustomerStatus
  patience: number
  patienceMax: number
  mood: number
  arrivedAt: number
  /** 满意 / 不耐烦后离店的时间点 */
  leaveAt?: number
  preferenceLabel: string
  /** 本次到店是否已经因宠物协助受益 */
  helpedByPet: boolean
}

export interface CafeTable {
  id: string
  index: number
  status: TableStatus
  customerId?: string
  orderId?: string
  /** 上菜后留下的空杯，需要拖到清洗区 */
  hasEmptyCup: boolean
}

export interface CafeOrder {
  id: string
  recipeId: string
  name: string
  icon: string
  customerId: string
  tableId: string
  /** 单杯 1 / 双份 2 */
  size: number
  stepIndex: number
  status: OrderStatus
  /** 长按 / 滑动进度 0..1，仅用于渲染，权威进度在组件 */
  holdProgress: number
  /** 设备是否正被本单占用 */
  processing: boolean
  processStartedAt?: number
  selectedOptionId?: string
  /** 是否命中顾客偏好 */
  preferenceMatched: boolean
  /** 0..3，上菜时计算 */
  satisfaction: number
  /** 已采用瑕疵品的满意度扣减，取值 0–100 */
  qualityPenalty: number
  /** 上错桌超时产生的满意度扣减，取值 0–100 */
  wrongTablePenalty: number
  /** 长按超差后等待玩家选择重做或采用 */
  pendingQuality?: ProcessQuality
  /** 成品暂放在错误桌，及取回截止时间（会话秒） */
  misplacedTableId?: string
  misplacedUntil?: number
  baseCoins: number
  baseExp: number
  createdAt: number
  servedAt?: number
  message?: string
}

export interface CafeStationState {
  id: StationId
  level: number
  /** 可并行占用数（升级改变容量） */
  capacity: number
  /** 正在占用设备的订单 id */
  busy: string[]
  /** 加工耗时倍率（升级缩短） */
  speed: number
}

export interface CafeTrayState {
  capacity: number
  /** 已装盘待上菜的订单 id */
  items: string[]
}

/* ---------------- 事件 ---------------- */

export type CafeEventKind = 'pet' | 'romance' | 'customer' | 'equipment' | 'hint'

export interface CafeScheduledEvent {
  id: string
  kind: CafeEventKind
  /** 触发时间点（会话秒） */
  at: number
  fired: boolean
  payload?: {
    customerId?: string
    characterId?: string
    title?: string
    text?: string
    icon?: string
    speaker?: string
  }
}

export interface CafeActiveEvent {
  id: string
  kind: CafeEventKind
  title: string
  icon: string
  text: string
  speaker?: string
  createdAt: number
  expiresAt: number
}

export interface CafeMessage {
  id: number
  kind: 'info' | 'error' | 'success' | 'pet' | 'romance'
  text: string
}

/* ---------------- 会话 ---------------- */

export interface CafeSessionConfig {
  runId: string
  /** 已解锁且拥有手作配方的菜单 id */
  recipeIds: string[]
  /** 设备等级：machine / oven / counter / signboard */
  equipment: Record<string, number>
  seed: number
  petName: string
  relationship: { id: string; name: string; value: number } | null
}

export interface CafeSessionState {
  runId: string
  phase: CafePhase
  duration: number
  elapsed: number
  tables: CafeTable[]
  customers: CafeCustomer[]
  orders: CafeOrder[]
  stations: Record<StationId, CafeStationState>
  tray: CafeTrayState
  scheduled: CafeScheduledEvent[]
  activeEvents: CafeActiveEvent[]
  messages: CafeMessage[]
  config: CafeSessionConfig
  /** 同时可处理的订单上限（吧台升级改变） */
  maxOrders: number
  /** 完美营业需要完成的订单数 */
  targetOrders: number
  /** 顾客出现权重（招牌升级改变顾客结构） */
  customerWeights: Record<CustomerKind, number>
  /** 每单固定小费加成 */
  tipBonus: number
  /** 清理一次桌面得到的小费 */
  cleanTip: number
  servedCount: number
  failedCount: number
  coins: number
  tips: number
  exp: number
  perfectCount: number
  /** 玩家最近一次有效操作的会话时间，用于 8 秒空闲提示 */
  lastActionAt: number
  nextArrivalAt: number
  spawnIndex: number
  rngState: number
  settleId: string | null
  petAssisted: boolean
  petIntimacyGain: number
  petMoodGain: number
  romanceCharacterId?: string
  romanceGain: number
  idleHinted: boolean
  messageSeq: number
  log: string[]
  paused: boolean
  closingAt: number | null
}

export interface CafeSettleSummary {
  runId: string
  served: number
  failed: number
  coins: number
  tips: number
  exp: number
  rating: number
  perfect: boolean
  petAssisted: boolean
  petIntimacyGain: number
  petMoodGain: number
  diary?: string
  romanceCharacterId?: string
  romanceGain: number
  events: string[]
  log: string[]
}

export type CafeAction =
  | { type: 'RUN'; dt: number }
  | { type: 'PAUSE'; paused: boolean }
  | { type: 'ACCEPT'; orderId: string }
  | { type: 'LOAD'; orderId: string; material: MaterialId; station: StationId }
  | { type: 'PROCESS_START'; orderId: string }
  | { type: 'PROCESS_DONE'; orderId: string }
  | { type: 'PROCESS_CANCEL'; orderId: string }
  | { type: 'PROCESS_IMPERFECT'; orderId: string; quality: ProcessQuality }
  | { type: 'PROCESS_RETRY'; orderId: string }
  | { type: 'PROCESS_ADOPT'; orderId: string }
  | { type: 'ASSEMBLE'; orderId: string; station: StationId; material?: MaterialId }
  | { type: 'CHOOSE'; orderId: string; optionId: string }
  | { type: 'PLATE'; orderId: string }
  | { type: 'SERVE'; orderId: string; tableId: string }
  | { type: 'RECOVER_MISPLACED'; orderId: string }
  | { type: 'CLEAN'; tableId: string }
  | { type: 'TIDY' }
  | { type: 'DISMISS_EVENT'; eventId: string }
  | { type: 'DISMISS_MESSAGE'; messageId: number }
  | { type: 'CLOSE' }
  | { type: 'SETTLE' }
