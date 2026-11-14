import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Coins,
  Flame,
  Heart,
  Info,
  Play,
  Sparkles,
  Star,
  Wrench,
  X,
} from 'lucide-react'
import { DECOR, EQUIPMENT, RECIPES } from '../data/content'
import { CAFE_RECIPES } from '../data/cafeContent'
import { deriveFromEquipment } from '../game/cafeSession'
import { equipmentCost, useGame } from '../game/GameContext'
import { playMeow } from '../game/petVoice'
import { playSfx, type SfxName } from '../game/sfx'
import { BUSINESS_STAMINA_COST } from '../game/storage'
import {
  CafeActors,
  type CafeActorCue,
  type CafeActorKind,
  type CafeActorMode,
} from './CafeActors'
import { GameIcon } from './GameIcon'
import { UiButton } from './UiButton'

type FxKind =
  | 'coffee'
  | 'pastry'
  | 'sparkle'
  | 'heart'
  | 'ring'
  | 'fish'
  | 'flower'
  | 'paw'
  | 'clock'

const SCENE_SPOTS = [
  { id: 'profile', label: '查看店长资料', x: 11.2, y: 6.8, width: 72, height: 72, fx: 'heart', icon: 'Smile', text: '今天也把店照顾得很好' },
  { id: 'title', label: '查看咖啡馆名片', x: 34.2, y: 5.3, width: 138, height: 62, fx: 'sparkle', icon: 'Store', text: '海风镇宠物咖啡馆正在营业' },
  { id: 'rating', label: '查看店铺声望', x: 53.8, y: 4.3, width: 108, height: 34, fx: 'sparkle', icon: 'Star', text: '客人对这家店越来越熟悉了' },
  { id: 'progress', label: '查看当前经验进度', x: 51.2, y: 6.5, width: 150, height: 32, fx: 'ring', icon: 'TrendingUp', text: '再服务几桌就能继续升级' },
  { id: 'pause', label: '打开营业准备', x: 77.5, y: 5.7, width: 66, height: 66, fx: 'ring', icon: 'Play', text: '营业准备已经打开' },
  { id: 'close', label: '查看今日经营简报', x: 91.4, y: 5.7, width: 68, height: 68, fx: 'ring', icon: 'ClipboardList', text: '今天的账本翻开了' },
  { id: 'bench', label: '更换暖光壁灯', x: 8.5, y: 21.2, width: 82, height: 110, fx: 'sparkle', icon: 'Lamp', text: '暖光壁灯把墙边照成了蜂蜜色' },
  { id: 'wallpaper', label: '更换海面挂画', x: 8.5, y: 31.5, width: 82, height: 110, fx: 'sparkle', icon: 'Frame', text: '新挂画让窗边更明亮了' },
  { id: 'lamp', label: '更换黄铜吊灯', x: 8.5, y: 42.1, width: 82, height: 110, fx: 'sparkle', icon: 'Lamp', text: '吊灯亮起来的时候最好看' },
  { id: 'menu', label: '打开菜单研发', x: 25.6, y: 19, width: 122, height: 118, fx: 'sparkle', icon: 'ClipboardList', text: '菜单板轻轻翻了一页' },
  { id: 'gift', label: '拆开客人送的心意', x: 76.8, y: 15.3, width: 70, height: 70, fx: 'heart', icon: 'Gift', text: '客人留下了一份谢礼' },
  { id: 'clock', label: '查看营业时间', x: 91.8, y: 15.1, width: 70, height: 70, fx: 'clock', icon: 'Clock', text: '时间还充足，可以慢慢招待' },
  { id: 'cake', label: '查看今日甜点', x: 91.8, y: 25.1, width: 70, height: 70, fx: 'pastry', icon: 'Cake', text: '草莓蛋糕今天也很受欢迎' },
  { id: 'fish', label: '查看招牌料理', x: 91.8, y: 33.9, width: 70, height: 70, fx: 'fish', icon: 'Fish', text: '海风烤鱼已经列入今日推荐' },
  { id: 'red-heart', label: '查看熟客心意', x: 91.8, y: 43.5, width: 70, height: 70, fx: 'heart', icon: 'HeartHandshake', text: '熟客把这里当成了常来的地方' },
  { id: 'croissant', label: '试烤可颂', x: 37.5, y: 35.8, width: 66, height: 66, fx: 'pastry', icon: 'Croissant', text: '可颂在烤箱里鼓了起来' },
  { id: 'little-heart', label: '查看窗边留言', x: 48, y: 39.8, width: 56, height: 56, fx: 'heart', icon: 'Heart', text: '窗边留下了一句温柔的留言' },
  { id: 'hanging-clock', label: '查看墙边小钟', x: 73.7, y: 28.8, width: 58, height: 58, fx: 'clock', icon: 'Clock', text: '小钟正好走到午后' },
  { id: 'hanging-plant', label: '更换垂吊绿植', x: 70.2, y: 24, width: 72, height: 90, fx: 'flower', icon: 'Leaf', text: '垂下来的叶子被海风吹得轻轻摆动' },
  { id: 'machine', label: '查看咖啡机', x: 19, y: 49.4, width: 116, height: 132, fx: 'coffee', icon: 'Coffee', text: '咖啡机开始预热' },
  { id: 'bar-machine', label: '查看吧台咖啡机', x: 63, y: 55.2, width: 82, height: 120, fx: 'coffee', icon: 'Coffee', text: '吧台咖啡机发出轻轻的研磨声' },
  { id: 'oven', label: '查看石板烤箱', x: 20, y: 60.5, width: 104, height: 116, fx: 'pastry', icon: 'Flame', text: '石板烤箱正在慢慢升温' },
  { id: 'flowers', label: '更换陶土花盆', x: 9.5, y: 56.9, width: 98, height: 128, fx: 'flower', icon: 'Flower2', text: '花瓣上还挂着一点海风' },
  { id: 'cat', label: '和布丁玩耍', x: 27.5, y: 66.2, width: 102, height: 108, fx: 'paw', icon: 'PawPrint', text: '布丁贴过来蹭了蹭你' },
  { id: 'cat-tree', label: '添置猫爬架', x: 42, y: 73.9, width: 92, height: 116, fx: 'sparkle', icon: 'TreePine', text: '猫爬架换成了布丁更喜欢的那一款' },
  { id: 'tray', label: '接过刚做好的甜点', x: 50.5, y: 77.9, width: 82, height: 100, fx: 'pastry', icon: 'Croissant', text: '后厨把热乎的甜点端出来了' },
  { id: 'bear', label: '查看宠物玩具', x: 10, y: 84.1, width: 78, height: 78, fx: 'paw', icon: 'PawPrint', text: '布丁的小玩具都收在这里' },
  { id: 'dish', label: '查看出餐台', x: 91.5, y: 83.8, width: 78, height: 78, fx: 'pastry', icon: 'Utensils', text: '出餐台上的餐点已经摆好了' },
  { id: 'table-left', label: '招待窗边客人', x: 55.5, y: 47.7, width: 86, height: 86, fx: 'ring', icon: 'Utensils', text: '窗边客人正向你招手' },
  { id: 'table-mid', label: '招待中间那桌客人', x: 77.5, y: 55.4, width: 92, height: 92, fx: 'ring', icon: 'Utensils', text: '中间那桌客人正在等餐' },
  { id: 'table-front', label: '招待前排客人', x: 82.3, y: 81.7, width: 98, height: 98, fx: 'ring', icon: 'Utensils', text: '前排客人正在等餐' },
  { id: 'bar-vase', label: '更换白瓷花瓶', x: 16, y: 95.1, width: 58, height: 64, fx: 'flower', icon: 'Amphora', text: '白瓷花瓶摆上了吧台' },
  { id: 'bar-cup', label: '更换手绘杯具', x: 32.1, y: 95.1, width: 58, height: 64, fx: 'coffee', icon: 'Coffee', text: '新的杯具已经摆好' },
  { id: 'bar-crate', label: '更换藤编收纳箱', x: 48, y: 95.1, width: 58, height: 64, fx: 'sparkle', icon: 'Package', text: '收纳箱换成了更合适的尺寸' },
  { id: 'bar-pot', label: '更换铜制手冲壶', x: 63.8, y: 95.1, width: 58, height: 64, fx: 'coffee', icon: 'CookingPot', text: '手冲壶擦得亮亮的' },
  { id: 'bar-chair', label: '更换原木餐椅', x: 79.6, y: 95.1, width: 58, height: 64, fx: 'sparkle', icon: 'Armchair', text: '餐椅和店内风格更搭了' },
  { id: 'bar-sofa', label: '更换绒面沙发', x: 92.1, y: 95.1, width: 58, height: 64, fx: 'sparkle', icon: 'Sofa', text: '沙发区的座位更舒服了' },
] as const

type SpotId = (typeof SCENE_SPOTS)[number]['id']
const SPOT_BY_ID = Object.fromEntries(SCENE_SPOTS.map((spot) => [spot.id, spot])) as Record<
  SpotId,
  (typeof SCENE_SPOTS)[number]
>

const FX_SOUND: Record<FxKind, SfxName> = {
  coffee: 'brew',
  pastry: 'oven',
  sparkle: 'sparkle',
  heart: 'heart',
  ring: 'tap',
  fish: 'bubble',
  flower: 'flutter',
  paw: 'cafe-pet',
  clock: 'tick',
}

/**
 * 可购买装饰的入口表：点哪一个就买哪一件。
 * 之前所有入口都指向「下一件未购装饰」，所以底部那一排按钮永远弹出同一件东西。
 */
const DECOR_SPOT: Partial<Record<SpotId, string>> = {
  'bar-vase': 'vase',
  'bar-cup': 'teacups',
  'bar-crate': 'crate',
  'bar-pot': 'pourover',
  'bar-chair': 'chair',
  'bar-sofa': 'sofa',
  flowers: 'flowerpot',
  'hanging-plant': 'hangingplant',
  lamp: 'pendantlamp',
  wallpaper: 'seapainting',
  bench: 'warmlight',
  'cat-tree': 'cattree',
}

interface ActorTarget {
  actor: CafeActorKind
  id: string
  spot: SpotId
  x: number
  y: number
  mode: Exclude<CafeActorMode, 'idle'>
  radius: number
}

const ACTOR_TARGETS: Record<CafeActorKind, readonly ActorTarget[]> = {
  barista: [
    { actor: 'barista', id: 'machine', spot: 'machine', x: 24, y: 61, mode: 'work', radius: 13 },
    { actor: 'barista', id: 'oven', spot: 'oven', x: 28, y: 72, mode: 'work', radius: 12 },
    {
      actor: 'barista',
      id: 'bar-machine',
      spot: 'bar-machine',
      x: 68,
      y: 68,
      mode: 'work',
      radius: 13,
    },
  ],
  cat: [
    { actor: 'cat', id: 'table-left', spot: 'table-left', x: 52, y: 60, mode: 'visit', radius: 12 },
    { actor: 'cat', id: 'table-mid', spot: 'table-mid', x: 72, y: 68, mode: 'visit', radius: 13 },
    {
      actor: 'cat',
      id: 'table-front',
      spot: 'table-front',
      x: 79,
      y: 84,
      mode: 'visit',
      radius: 10,
    },
    { actor: 'cat', id: 'cat-tree', spot: 'cat-tree', x: 39, y: 80, mode: 'visit', radius: 10 },
    { actor: 'cat', id: 'cat', spot: 'cat', x: 18, y: 83, mode: 'visit', radius: 11 },
    { actor: 'cat', id: 'bear', spot: 'bear', x: 18, y: 84, mode: 'visit', radius: 9 },
  ],
}

type DrawerState =
  | { kind: 'equipment'; id: string }
  | { kind: 'menu'; id: string }
  | { kind: 'decor'; id: string; spot: SpotId }
  | { kind: 'overview'; title: string; text: string }
  | { kind: 'start' }
  | null

interface FxState {
  id: number
  spot: SpotId
  kind: FxKind
  text: string
}

export interface CafePlaySceneProps {
  canStart: boolean
  onStart: () => void
}

function SheetFrame({
  title,
  icon,
  children,
  onClose,
}: {
  title: string
  icon: ReactNode
  children: ReactNode
  onClose: () => void
}) {
  return (
    <section className="cafe-play__sheet" role="dialog" aria-label={title}>
      <header className="cafe-play__sheet-head">
        <span className="cafe-play__sheet-title">
          {icon}
          <strong>{title}</strong>
        </span>
        <button
          type="button"
          className="cafe-play__sheet-close"
          aria-label="关闭操作面板"
          onClick={onClose}
        >
          <X size={17} />
        </button>
      </header>
      {children}
    </section>
  )
}

export function CafePlayScene({ canStart, onStart }: CafePlaySceneProps) {
  const { state, actions } = useGame()
  const [drawer, setDrawer] = useState<DrawerState>(null)
  const [fx, setFx] = useState<FxState | null>(null)
  const [actorCue, setActorCue] = useState<CafeActorCue | null>(null)
  const fxTimer = useRef<number | null>(null)
  const fxSeed = useRef(0)
  const actorCueSeed = useRef(0)

  useEffect(
    () => () => {
      if (fxTimer.current !== null) window.clearTimeout(fxTimer.current)
    },
    [],
  )

  const derived = deriveFromEquipment(state.equipment)
  const menuCount = state.recipes.filter((id) => CAFE_RECIPES[id]).length
  const nextRecipe =
    RECIPES.find((recipe) => !state.recipes.includes(recipe.id)) ?? RECIPES[RECIPES.length - 1]
  const triggerFx = (spot: SpotId, text: string, duration = 2100) => {
    const kind = SPOT_BY_ID[spot].fx
    playSfx(FX_SOUND[kind])
    if (kind === 'paw') playMeow()
    fxSeed.current += 1
    setFx({ id: fxSeed.current, spot, kind, text })
    if (fxTimer.current !== null) window.clearTimeout(fxTimer.current)
    fxTimer.current = window.setTimeout(() => setFx(null), duration)
  }

  const cueActor = (
    actor: CafeActorKind,
    targetId: string,
    x: number,
    y: number,
    mode: Exclude<CafeActorMode, 'idle'>,
    duration = 1900,
  ) => {
    actorCueSeed.current += 1
    setActorCue({
      id: actorCueSeed.current,
      actor,
      targetId,
      x,
      y,
      mode,
      duration,
    })
  }

  const runActorTarget = (target: ActorTarget) => {
    cueActor(target.actor, target.id, target.x, target.y, target.mode)
    triggerFx(target.spot, SPOT_BY_ID[target.spot].text)
  }

  const findActorTarget = (actor: CafeActorKind, x: number, y: number) => {
    let nearest: ActorTarget | null = null
    let nearestDistance = Number.POSITIVE_INFINITY

    for (const target of ACTOR_TARGETS[actor]) {
      const distance = Math.hypot((x - target.x) * 0.55, y - target.y)
      if (distance <= target.radius && distance < nearestDistance) {
        nearest = target
        nearestDistance = distance
      }
    }

    return nearest
  }

  const runActorAtSpot = (actor: CafeActorKind, spot: SpotId, fallbackText?: string) => {
    const target = ACTOR_TARGETS[actor].find((item) => item.spot === spot)
    if (target) {
      runActorTarget(target)
      return
    }
    triggerFx(spot, fallbackText ?? SPOT_BY_ID[spot].text)
  }

  const openEquipment = (id: string, text: string) => {
    runActorAtSpot('barista', id === 'machine' ? 'machine' : 'oven', text)
    setDrawer({ kind: 'equipment', id })
  }

  const playWithPet = (spot: SpotId) => {
    runActorAtSpot('cat', spot, '布丁追着逗乐的东西跑了一圈')
  }

  const interactWithTable = (spot: SpotId) => {
    runActorAtSpot('cat', spot)
  }

  const handleActorDrop = (actor: CafeActorKind, x: number, y: number) => {
    const target = findActorTarget(actor, x, y)
    if (target) runActorTarget(target)
  }

  const showOverview = (title: string, text: string, spot: SpotId) => {
    triggerFx(spot, text)
    setDrawer({ kind: 'overview', title, text })
  }

  const openDecor = (spot: SpotId) => {
    const decorId = DECOR_SPOT[spot]
    if (!decorId) {
      triggerFx(spot, SPOT_BY_ID[spot].text)
      return
    }
    triggerFx(spot, SPOT_BY_ID[spot].text)
    setDrawer({ kind: 'decor', id: decorId, spot })
  }

  const openMenu = (spot: SpotId) => {
    triggerFx(spot, SPOT_BY_ID[spot].text)
    setDrawer({ kind: 'menu', id: nextRecipe.id })
  }

  const handleSpot = (spot: SpotId) => {
    switch (spot) {
      case 'profile':
      case 'title':
        showOverview(
          '咖啡馆名片',
          `Lv.${state.level} · 魅力 ${state.decor.length} · 熟客关系 ${state.relationships[0]?.value ?? 0}`,
          spot,
        )
        return
      case 'rating':
      case 'progress':
      case 'close':
        showOverview(
          '今日经营简报',
          `已上架 ${menuCount} 款菜单，完成 ${state.stats.ordersServed} 单，累计赚到 ${state.stats.coinsEarned} 金币。`,
          spot,
        )
        return
      case 'pause':
      case 'dish':
        triggerFx(spot, SPOT_BY_ID[spot].text)
        setDrawer({ kind: 'start' })
        return
      case 'bench':
      case 'wallpaper':
      case 'lamp':
      case 'bar-vase':
      case 'bar-crate':
      case 'bar-chair':
      case 'bar-sofa':
      case 'bar-cup':
      case 'bar-pot':
      case 'flowers':
      case 'hanging-plant':
      case 'cat-tree':
        openDecor(spot)
        return
      case 'menu':
        openMenu(spot)
        return
      case 'machine':
        openEquipment('machine', SPOT_BY_ID[spot].text)
        return
      case 'oven':
        openEquipment('oven', SPOT_BY_ID[spot].text)
        return
      case 'bar-machine':
        runActorAtSpot('barista', spot)
        return
      case 'cat':
      case 'bear':
        playWithPet(spot)
        return
      case 'table-left':
      case 'table-mid':
      case 'table-front':
        interactWithTable(spot)
        return
      case 'gift':
        triggerFx(spot, SPOT_BY_ID[spot].text)
        showOverview('客人的心意', '窗台上的礼盒来自今天最早到店的那位客人。', spot)
        return
      case 'clock':
      case 'hanging-clock':
        showOverview('营业时间', `准备页目标：服务 ${derived.targetOrders} 位客人，限时 ${derived.duration} 秒。`, spot)
        return
      default:
        triggerFx(spot, SPOT_BY_ID[spot].text)
    }
  }

  const renderSheet = () => {
    if (!drawer) return null

    if (drawer.kind === 'equipment') {
      const def = EQUIPMENT.find((item) => item.id === drawer.id) ?? EQUIPMENT[0]
      const level = state.equipment[def.id] ?? 1
      const maxed = level >= def.maxLevel
      const cost = equipmentCost(def.id, level + 1)
      const affordable = state.coins >= cost
      const isMachine = def.id === 'machine'

      return (
        <SheetFrame
          title={def.name}
          icon={<GameIcon name={def.icon} size={17} />}
          onClose={() => setDrawer(null)}
        >
          <div className="cafe-play__sheet-stats">
            <span>
              <Star size={13} /> Lv.{level}
            </span>
            <span>
              <Wrench size={13} /> {maxed ? '已满级' : `${cost} 金币`}
            </span>
          </div>
          <div className="cafe-play__sheet-actions">
            <UiButton
              variant="cream"
              icon={isMachine ? <GameIcon name="Coffee" size={16} /> : <Flame size={16} />}
              onClick={() =>
                triggerFx(
                  isMachine ? 'machine' : 'oven',
                  isMachine ? '一份浓缩完成了' : '可颂在烤箱里鼓了起来',
                )
              }
            >
              {isMachine ? '试做一杯' : '试烤一炉'}
            </UiButton>
            <UiButton
              variant={affordable && !maxed ? 'gold' : 'ghost'}
              disabled={maxed || !affordable}
              icon={<Coins size={15} />}
              onClick={() => {
                const result = actions.upgradeEquipment(def.id)
                if (result.ok) {
                  triggerFx(
                    isMachine ? 'machine' : 'oven',
                    `${def.name}升到 Lv.${level + 1}`,
                  )
                }
              }}
            >
              {maxed ? '已满级' : affordable ? '升级' : '金币不足'}
            </UiButton>
          </div>
        </SheetFrame>
      )
    }

    if (drawer.kind === 'menu') {
      const owned = state.recipes.includes(drawer.id)
      const levelOk = state.level >= nextRecipe.unlockLevel
      const affordable = state.coins >= nextRecipe.unlockCost
      const handcraft = CAFE_RECIPES[nextRecipe.id]

      return (
        <SheetFrame
          title="菜单研发"
          icon={<GameIcon name="CupSoda" size={17} />}
          onClose={() => setDrawer(null)}
        >
          <div className="cafe-play__recipe">
            <span className="cafe-play__recipe-icon">
              <GameIcon name={nextRecipe.icon} size={22} />
            </span>
            <span>
              <strong>{nextRecipe.name}</strong>
              <small>
                {handcraft?.steps.length ?? nextRecipe.craftStep} 步手作 · 售价 {nextRecipe.price}
              </small>
            </span>
          </div>
          <div className="cafe-play__sheet-actions">
            <UiButton
              variant={owned ? 'ghost' : affordable && levelOk ? 'sea' : 'ghost'}
              disabled={owned || !levelOk || !affordable}
              icon={<GameIcon name="CupSoda" size={16} />}
              onClick={() => {
                const result = actions.researchRecipe(nextRecipe.id)
                if (result.ok) {
                  triggerFx('menu', `新品「${nextRecipe.name}」上架了`)
                  setDrawer(null)
                }
              }}
            >
              {owned ? '已研发' : !levelOk ? `需要 Lv.${nextRecipe.unlockLevel}` : '研发'}
            </UiButton>
            <span className="cafe-play__sheet-cost">
              <Coins size={14} /> {nextRecipe.unlockCost}
            </span>
          </div>
        </SheetFrame>
      )
    }

    if (drawer.kind === 'decor') {
      const decor = DECOR.find((item) => item.id === drawer.id) ?? DECOR[0]
      const owned = state.decor.includes(decor.id)
      const levelOk = state.level >= decor.unlockLevel
      const affordable = state.coins >= decor.cost

      return (
        <SheetFrame
          title="添置装饰"
          icon={<Sparkles size={17} />}
          onClose={() => setDrawer(null)}
        >
          <div className="cafe-play__recipe">
            <span className="cafe-play__recipe-icon cafe-play__recipe-icon--decor">
              <GameIcon name={decor.icon} size={22} />
            </span>
            <span>
              <strong>{decor.name}</strong>
              <small>{decor.desc}</small>
            </span>
          </div>
          <div className="cafe-play__sheet-stats">
            <span>
              <Sparkles size={13} /> 魅力 +{decor.charm}
            </span>
            <span>
              <Wrench size={13} /> {owned ? '已布置' : `需要 Lv.${decor.unlockLevel}`}
            </span>
          </div>
          <div className="cafe-play__sheet-actions">
            <UiButton
              variant={owned ? 'ghost' : affordable && levelOk ? 'gold' : 'ghost'}
              disabled={owned || !levelOk || !affordable}
              icon={<Sparkles size={16} />}
              onClick={() => {
                const result = actions.buyDecor(decor.id)
                if (result.ok) {
                  triggerFx(drawer.spot, `${decor.name}已经摆进店里`)
                  setDrawer(null)
                }
              }}
            >
              {owned
                ? '已拥有'
                : !levelOk
                  ? `需要 Lv.${decor.unlockLevel}`
                  : !affordable
                    ? '金币不足'
                    : '摆放'}
            </UiButton>
            <span className="cafe-play__sheet-cost">
              <Coins size={14} /> {decor.cost}
            </span>
          </div>
        </SheetFrame>
      )
    }

    if (drawer.kind === 'overview') {
      return (
        <SheetFrame title={drawer.title} icon={<Info size={17} />} onClose={() => setDrawer(null)}>
          <p className="cafe-play__sheet-copy">{drawer.text}</p>
        </SheetFrame>
      )
    }

    return (
      <SheetFrame title="开门营业" icon={<Play size={17} />} onClose={() => setDrawer(null)}>
        <p className="cafe-play__sheet-copy">客人已经在门外排队，准备好就开门。</p>
        <UiButton
          variant="gold"
          block
          disabled={!canStart}
          icon={<Play size={16} />}
          onClick={onStart}
        >
          开始营业
        </UiButton>
      </SheetFrame>
    )
  }

  const renderFx = () => {
    if (!fx) return null
    const spot = SPOT_BY_ID[fx.spot]

    return (
      <div
        key={fx.id}
        className={`cafe-play__fx cafe-play__fx--${fx.kind}`}
        style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
        aria-hidden="true"
      >
        {fx.kind === 'coffee' ? (
          <>
            <i className="cafe-fx__steam cafe-fx__steam--a" />
            <i className="cafe-fx__steam cafe-fx__steam--b" />
            <i className="cafe-fx__steam cafe-fx__steam--c" />
            <i className="cafe-fx__bean cafe-fx__bean--a" />
            <i className="cafe-fx__bean cafe-fx__bean--b" />
            <i className="cafe-fx__bean cafe-fx__bean--c" />
          </>
        ) : null}

        {fx.kind === 'pastry' ? (
          <>
            <i className="cafe-fx__heat cafe-fx__heat--a" />
            <i className="cafe-fx__heat cafe-fx__heat--b" />
            <i className="cafe-fx__heat cafe-fx__heat--c" />
          </>
        ) : null}

        {fx.kind === 'sparkle' ? (
          <>
            <i className="cafe-fx__spark cafe-fx__spark--a" />
            <i className="cafe-fx__spark cafe-fx__spark--b" />
            <i className="cafe-fx__spark cafe-fx__spark--c" />
            <i className="cafe-fx__spark cafe-fx__spark--d" />
          </>
        ) : null}

        {fx.kind === 'heart' ? (
          <>
            <span className="cafe-fx__heart cafe-fx__heart--a">
              <Heart size={19} />
            </span>
            <span className="cafe-fx__heart cafe-fx__heart--b">
              <Heart size={14} />
            </span>
          </>
        ) : null}

        {fx.kind === 'ring' ? (
          <>
            <i className="cafe-fx__ring cafe-fx__ring--a" />
            <i className="cafe-fx__ring cafe-fx__ring--b" />
            <i className="cafe-fx__spark cafe-fx__spark--c" />
          </>
        ) : null}

        {fx.kind === 'fish' ? (
          <>
            <i className="cafe-fx__bubble cafe-fx__bubble--a" />
            <i className="cafe-fx__bubble cafe-fx__bubble--b" />
            <i className="cafe-fx__bubble cafe-fx__bubble--c" />
          </>
        ) : null}

        {fx.kind === 'flower' ? (
          <>
            <i className="cafe-fx__petal cafe-fx__petal--a" />
            <i className="cafe-fx__petal cafe-fx__petal--b" />
            <i className="cafe-fx__petal cafe-fx__petal--c" />
            <i className="cafe-fx__petal cafe-fx__petal--d" />
            <i className="cafe-fx__petal cafe-fx__petal--e" />
          </>
        ) : null}

        {fx.kind === 'paw' ? (
          <>
            <span className="cafe-fx__paw cafe-fx__paw--a">
              <GameIcon name="PawPrint" size={15} />
            </span>
            <span className="cafe-fx__paw cafe-fx__paw--b">
              <GameIcon name="PawPrint" size={12} />
            </span>
            <span className="cafe-fx__heart cafe-fx__heart--b">
              <Heart size={13} />
            </span>
          </>
        ) : null}

        {fx.kind === 'clock' ? (
          <>
            <i className="cafe-fx__ring cafe-fx__ring--a" />
            <i className="cafe-fx__ring cafe-fx__ring--b" />
          </>
        ) : null}

        <span className={`cafe-fx__emblem cafe-fx__emblem--${fx.kind}`}>
          <GameIcon name={spot.icon} size={fx.kind === 'sparkle' ? 19 : 21} />
        </span>
      </div>
    )
  }

  return (
    <section className="cafe-play">
      <div
        className={`cafe-play__world${fx ? ` is-fx-${fx.spot}` : ''}`}
        aria-label="可互动的咖啡店经营场景"
      >
        <img
          className="cafe-play__bg"
          src="art/scene-cafe-shop-clean.webp"
          alt="暮色海景宠物咖啡馆内景"
          aria-hidden="true"
          draggable={false}
        />
        <div className="cafe-play__wash" aria-hidden="true" />
        <div className="cafe-play__ambient" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>

        {SCENE_SPOTS.map((spot) => (
          <button
            key={spot.id}
            type="button"
            className={`cafe-hotspot${fx?.spot === spot.id ? ' is-active' : ''}`}
            data-spot={spot.id}
            aria-label={spot.label}
            style={{
              left: `${spot.x}%`,
              top: `${spot.y}%`,
              width: spot.width,
              height: spot.height,
            }}
            onClick={() => handleSpot(spot.id)}
          />
        ))}

        <CafeActors cue={actorCue} onDrop={handleActorDrop} />

        {renderFx()}

        {fx ? (
          <span className="visually-hidden" role="status">
            {fx.text}
          </span>
        ) : null}

        {renderSheet()}
      </div>

      <div className="cafe-play__action-row">
        <UiButton
          className="cafe-play__start"
          variant="gold"
          icon={<Play size={17} />}
          disabled={!canStart}
          onClick={onStart}
        >
          {state.stamina < BUSINESS_STAMINA_COST
            ? `体力不足（需要 ${BUSINESS_STAMINA_COST}）`
            : `开始营业 · 消耗 ${BUSINESS_STAMINA_COST} 体力`}
        </UiButton>
      </div>
    </section>
  )
}
