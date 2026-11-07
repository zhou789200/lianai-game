/* ============================================================
   R3 营业内容配置
   ------------------------------------------------------------
   这里是纯数据：配方、原料、顾客、设施、事件文案与营收规则。
   实现层只读取本文件，不允许把内容硬编码进组件。
   ============================================================ */
import type {
  CafeCustomerDef,
  CafeRecipeDef,
  MaterialDef,
  MaterialId,
  StationId,
} from '../game/cafeTypes'

/* ---------------- 原料 / 中间产物 / 成品 ---------------- */

export const MATERIALS: Record<MaterialId, MaterialDef> = {
  cup: { id: 'cup', name: '干净杯子', icon: 'Coffee', role: 'raw', hint: '饮品的第一步' },
  milk: { id: 'milk', name: '鲜奶壶', icon: 'Droplets', role: 'raw', hint: '打奶泡用' },
  coffeeBean: { id: 'coffeeBean', name: '咖啡豆', icon: 'Bean', role: 'raw' },
  ice: { id: 'ice', name: '冰块', icon: 'IceCreamCone', role: 'raw' },
  syrup: { id: 'syrup', name: '柑橘糖浆', icon: 'Droplets', role: 'raw' },
  soda: { id: 'soda', name: '气泡水阀', icon: 'CupSoda', role: 'raw' },
  croissant: { id: 'croissant', name: '可颂面团', icon: 'Croissant', role: 'raw' },
  butter: { id: 'butter', name: '黄油', icon: 'Cake', role: 'raw' },
  garnish: { id: 'garnish', name: '柑橘片', icon: 'Leaf', role: 'raw' },
  espresso: { id: 'espresso', name: '浓缩咖啡', icon: 'Coffee', role: 'intermediate' },
  foam: { id: 'foam', name: '海盐奶泡', icon: 'Droplets', role: 'intermediate' },
  latte: { id: 'latte', name: '海盐拿铁', icon: 'Coffee', role: 'final' },
  pastry: { id: 'pastry', name: '黄油可颂', icon: 'Croissant', role: 'final' },
  cooler: { id: 'cooler', name: '柑橘气泡水', icon: 'CupSoda', role: 'final' },
}

/* ---------------- 三种手作配方 ---------------- */

export const CAFE_RECIPES: Record<string, CafeRecipeDef> = {
  latte: {
    id: 'latte',
    name: '海盐拿铁',
    icon: 'Coffee',
    price: 18,
    exp: 3,
    primaryStation: 'machine',
    failureRemedy: { retryAllowed: true, retryCostCoins: 0, acceptPenalty: 20 },
    steps: [
      {
        id: 'latte-1',
        kind: 'load',
        label: '把干净杯子拖到咖啡机',
        short: '放杯子',
        station: 'machine',
        material: 'cup',
      },
      {
        id: 'latte-2',
        kind: 'process',
        label: '长按咖啡机萃取浓缩',
        short: '萃取',
        station: 'machine',
        gesture: 'hold',
        durationMs: 1400,
        toleranceMs: 300,
        qualityLabels: { under: '萃取不足', over: '过萃了' },
      },
      {
        id: 'latte-3',
        kind: 'load',
        label: '把鲜奶壶拖到蒸汽口',
        short: '放奶壶',
        station: 'machine',
        material: 'milk',
      },
      {
        id: 'latte-4',
        kind: 'process',
        label: '滑动打发海盐奶泡',
        short: '打奶泡',
        station: 'machine',
        gesture: 'swipe',
        durationMs: 1100,
      },
      {
        id: 'latte-5',
        kind: 'assemble',
        label: '把浓缩和奶泡拖到装配台组装',
        short: '组装',
        station: 'assembly',
        inputs: ['espresso', 'foam'],
      },
      {
        id: 'latte-6',
        kind: 'plate',
        label: '把海盐拿铁拖到托盘',
        short: '装托盘',
        station: 'tray',
        material: 'latte',
      },
    ],
  },
  croissant: {
    id: 'croissant',
    name: '黄油可颂',
    icon: 'Croissant',
    price: 22,
    exp: 4,
    primaryStation: 'oven',
    failureRemedy: { retryAllowed: true, retryCostCoins: 0, acceptPenalty: 25 },
    steps: [
      {
        id: 'croissant-1',
        kind: 'load',
        label: '把可颂面团放进烤箱',
        short: '入烤箱',
        station: 'oven',
        material: 'croissant',
      },
      {
        id: 'croissant-2',
        kind: 'process',
        label: '长按烤箱完成烘焙',
        short: '烘焙',
        station: 'oven',
        gesture: 'hold',
        durationMs: 1600,
        toleranceMs: 400,
        qualityLabels: { under: '烘焙不足', over: '烤过头了' },
      },
      {
        id: 'croissant-3',
        kind: 'choose',
        label: '按顾客要求选择加料',
        short: '选加料',
        options: [
          { id: 'butter', label: '抹黄油', matchesPreference: true },
          { id: 'plain', label: '原味' },
          { id: 'warm', label: '再加热一下' },
        ],
      },
      {
        id: 'croissant-4',
        kind: 'plate',
        label: '把烤好的可颂拖到托盘',
        short: '装托盘',
        station: 'tray',
        material: 'pastry',
      },
    ],
  },
  soda: {
    id: 'soda',
    name: '柑橘气泡水',
    icon: 'CupSoda',
    price: 26,
    exp: 4,
    primaryStation: 'assembly',
    failureRemedy: { retryAllowed: true, retryCostCoins: 0, acceptPenalty: 15 },
    steps: [
      {
        id: 'soda-1',
        kind: 'load',
        label: '把杯子放到装配台',
        short: '放杯子',
        station: 'assembly',
        material: 'cup',
      },
      {
        id: 'soda-2',
        kind: 'load',
        label: '加入冰块',
        short: '加冰',
        station: 'assembly',
        material: 'ice',
      },
      {
        id: 'soda-3',
        kind: 'load',
        label: '倒入柑橘糖浆',
        short: '加糖浆',
        station: 'assembly',
        material: 'syrup',
      },
      {
        id: 'soda-4',
        kind: 'process',
        label: '滑动气泡水阀完成注入',
        short: '注气泡',
        station: 'assembly',
        gesture: 'swipe',
        durationMs: 1200,
      },
      {
        id: 'soda-5',
        kind: 'choose',
        label: '选择是否加一片柑橘装饰',
        short: '加装饰',
        options: [
          { id: 'garnish', label: '加柑橘片', matchesPreference: true },
          { id: 'none', label: '不加装饰' },
        ],
      },
      {
        id: 'soda-6',
        kind: 'plate',
        label: '把气泡水拖到托盘',
        short: '装托盘',
        station: 'tray',
        material: 'cooler',
      },
    ],
  },
}

/** 需要展示在原料槽上的原料（按步骤出现） */
export const RAW_MATERIALS: MaterialId[] = [
  'cup',
  'milk',
  'coffeeBean',
  'ice',
  'syrup',
  'soda',
  'croissant',
  'butter',
  'garnish',
]

/* ---------------- 顾客 ---------------- */

export const CAFE_CUSTOMERS: CafeCustomerDef[] = [
  {
    id: 'officeWorker',
    name: '上班族',
    icon: 'Clock',
    patience: 42,
    tipMult: 1.1,
    preference: '赶时间，出餐越快小费越高',
    preferredRecipe: 'latte',
    weight: 30,
    accent: 'sea',
  },
  {
    id: 'tourist',
    name: '游客',
    icon: 'Camera',
    patience: 68,
    tipMult: 1,
    preference: '喜欢好看的装饰',
    preferredRecipe: 'soda',
    preferredOption: 'garnish',
    weight: 26,
    accent: 'gold',
  },
  {
    id: 'catLover',
    name: '猫爱好者',
    icon: 'PawPrint',
    patience: 56,
    tipMult: 1.15,
    preference: '喜欢布丁，宠物协助时特别开心',
    preferredRecipe: 'croissant',
    weight: 22,
    accent: 'rose',
  },
  {
    id: 'regular',
    name: '熟客',
    icon: 'HeartHandshake',
    patience: 54,
    tipMult: 1.25,
    preference: '口味固定，连续正确服务提升评价',
    preferredRecipe: 'latte',
    preferredOption: 'butter',
    weight: 22,
    accent: 'coral',
  },
]

export const CUSTOMER_BY_ID: Record<string, CafeCustomerDef> = Object.fromEntries(
  CAFE_CUSTOMERS.map((c) => [c.id, c]),
)

/* ---------------- 设施 ---------------- */

export const STATION_DEFS: Record<StationId, { id: StationId; name: string; icon: string; hint: string }> = {
  machine: { id: 'machine', name: '咖啡机', icon: 'CookingPot', hint: '萃取与奶泡' },
  oven: { id: 'oven', name: '烤箱', icon: 'Flame', hint: '批量烘焙' },
  assembly: { id: 'assembly', name: '装配台', icon: 'Utensils', hint: '组装与装饰' },
  tray: { id: 'tray', name: '托盘', icon: 'ClipboardList', hint: '成品暂存' },
  sink: { id: 'sink', name: '清洗区', icon: 'Droplets', hint: '回收空杯' },
}

export const STATION_ORDER: StationId[] = ['machine', 'oven', 'assembly', 'tray', 'sink']

/* ---------------- 营业氛围 / 事件文案 ---------------- */

export const WEATHER_LINES = [
  '海风把风铃吹得叮当响，午后的光落在吧台上。',
  '窗外有海鸥掠过，店里飘着黄油和咖啡的味道。',
  '门口的风铃响了一声，又有客人推门进来。',
  '布丁在窗台换了三个姿势，最后决定继续睡。',
]

export const CUSTOMER_EVENT_LINES = [
  { icon: 'Smile', text: '靠窗那桌在讨论等会儿去看海，看起来心情不错。' },
  { icon: 'CloudRain', text: '外面飘起小雨，客人说慢慢来，不用着急。' },
  { icon: 'Camera', text: '有人举起相机，拍下了吧台上的那杯饮品。' },
  { icon: 'Info', text: '有人问起今日限定，你指了指菜单最上面那行。' },
]

export const EQUIPMENT_EVENT_LINES = [
  { icon: 'Zap', title: '咖啡机预热完成', text: '机器发出均匀的轻响，现在出杯会稳一点。' },
  { icon: 'Wind', title: '烤箱热气散开', text: '黄油的味道从后厨飘到了大厅。' },
]

export const PET_ASSIST_LINES = [
  { title: '布丁在提醒你', text: '它跳上最着急那桌的椅子，蹭了蹭客人，帮你争取了一点时间。' },
  { title: '布丁递来了东西', text: '它把滑到桌角的餐巾推了回来，客人都笑了。' },
]

export const PET_SETTLE_DIARY = [
  '今天店里最忙的时候，我帮忙安抚了等得最久的那桌客人。',
  '我把一条餐巾推回了桌角，那位客人摸了摸我的头。',
]

export interface RomanceLine {
  low: string
  mid: string
  high: string
}

export const ROMANCE_DIALOGUE: Record<string, { speaker: string; role: string; lines: RomanceLine }> = {
  linche: {
    speaker: '林澈',
    role: '咖啡师',
    lines: {
      low: '店长，我路过，看见还亮着灯……需要帮忙吗？',
      mid: '今天我不用上班，正好来坐一会儿。给我留个靠窗的位置吧。',
      high: '我来得早，就把吧台擦了一遍。你忙你的，我看着店。',
    },
  },
  guhuai: {
    speaker: '顾淮',
    role: '兽医',
    lines: {
      low: '例行路过，顺便看看布丁。它最近精神不错。',
      mid: '这杯算我的。你照顾店，我照顾猫，分工明确。',
      high: '打烊后别急着走，我在门口等你，一起回去。',
    },
  },
}

export const ROMANCE_ICONS: Record<string, string> = {
  linche: 'Coffee',
  guhuai: 'Heart',
}

/* ---------------- 结算评价 ---------------- */

export const RATING_LABELS: Record<number, string> = {
  1: '手忙脚乱',
  2: '勉强应付',
  3: '有条不紊',
  4: '行云流水',
  5: '海风镇名店',
}

export function ratingFromScore(score: number): number {
  return Math.max(1, Math.min(5, Math.round(score)))
}
