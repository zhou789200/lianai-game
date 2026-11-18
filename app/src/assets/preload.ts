import {
  PETS,
  PET_FEED_HANDS,
  PET_GROOM_HANDS,
  PET_PHOTO_HANDS,
  PET_PLAY_HANDS,
  PROPS,
} from './manifest'

/**
 * 美术资源预热（唯一入口）
 * ============================================================
 * 场景底图由 SceneRenderer 常驻，不需要在这里重复处理。
 * 这里负责其余「按需挂载、挂载时才会去解码」的图片：
 * 立绘、宠物、装饰、宠物互动双手、咖啡店玩法的吧台与猫。
 *
 * 逐张串行、只在浏览器空闲时加载，不抢首屏带宽；
 * 加载完成后浏览器会保留解码缓存，之后任何页面插入 <img>
 * 都能立刻出图，不会先闪一下空白。
 *
 * 弱网保护：预热是「锦上添花」，首屏才是命脉。用户开了省流量、
 * 或当前网络是 2G/3G 时直接放弃预热——否则这批图会把本就可怜的
 * 带宽全占满，首屏反而迟迟出不来（弱网实测踩过这个坑）。
 */

/**
 * 咖啡店玩法专用图（未登记在 manifest）。
 * 这批图合计约 1MB，只会在进入咖啡店后用到；首页预热它们
 * 会跟首屏抢带宽（弱网下表现为主页迟迟出图），因此改为进店时再加载。
 */
export const CAFE_SHOP_ART = [
  'art/scene-cafe-shop-clean.webp',
  'art/cafe-barista-front.webp',
  'art/cafe-barista-side.webp',
  'art/cafe-barista-back.webp',
  'art/cafe-cat-front.webp',
  'art/cafe-cat-side.webp',
  'art/cafe-cat-back.webp',
]

/** 咖啡店专用图的预热入口：由 CafeView 在首次挂载时调用。 */
export function preloadCafeArt() {
  queueArt(CAFE_SHOP_ART)
}

/** Network Information API 在部分内核里没有，按可选处理 */
interface NetworkInformationLike {
  saveData?: boolean
  effectiveType?: string
}

/**
 * 是否应当跳过预热。
 * 判据取「用户意图」（saveData）优先于「网络类型」，
 * 省流量模式是用户明确的表态，无条件尊重。
 */
function shouldSkipPreload(): boolean {
  const conn = (
    navigator as Navigator & { connection?: NetworkInformationLike }
  ).connection
  if (!conn) return false
  if (conn.saveData) return true
  const type = conn.effectiveType
  return type === 'slow-2g' || type === '2g' || type === '3g'
}

let started = false
const queued = new Set<string>()
let running = 0

/**
 * 首屏优先级闸门。
 * 场景底图（当前页）是最先要看的画面，立绘/宠物/装饰只是「下一个页面的准备」。
 * 之前用固定延迟预热，2G/弱网下会和场景图抢同一段带宽，反而拖慢首屏。
 * 现在改为：SceneRenderer 报告首屏场景图解码完成后才放行预热；
 * 若图片加载失败或极慢，App 侧还有兜底放行，不会把预热永久卡死。
 */
let releaseGate: (() => void) | null = null
const preloadGate = new Promise<void>((resolve) => {
  releaseGate = resolve
})

/** SceneRenderer / App 在首屏稳定后调用，只需调用一次 */
export function releasePreloadGate() {
  releaseGate?.()
  releaseGate = null
}

/** 等待首屏闸门；已放行时立即返回 */
export function waitForPreloadGate(): Promise<void> {
  return preloadGate
}

/** 预热队列：调用方只提交要加载的资源，调度统一在这里做 */
function queueArt(sources: readonly string[]) {
  if (typeof window === 'undefined') return
  if (shouldSkipPreload()) return

  const pending: string[] = []
  for (const src of sources) {
    if (!src || queued.has(src)) continue
    queued.add(src)
    pending.push(src)
  }

  const pump = () => {
    while (running < CONCURRENCY && pending.length > 0) {
      const src = pending.shift()
      if (!src) return
      running += 1
      const img = new Image()
      img.decoding = 'async'
      const settle = () => {
        running -= 1
        pump()
      }
      img.onload = settle
      img.onerror = settle
      img.src = src
    }
  }

  idle(pump)
}

/** 同时最多预热几张，避免一次把带宽打满、影响首屏交互 */
const CONCURRENCY = 3

function idle(fn: () => void) {
  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
    }
  ).requestIdleCallback
  if (typeof ric === 'function') {
    ric(fn, { timeout: 1200 })
    return
  }
  window.setTimeout(fn, 160)
}

export function preloadArt() {
  if (started || typeof window === 'undefined') return
  started = true

  void preloadGate.then(() => {
    queueArt([
      ...Object.values(PETS).map((a) => a.src),
      ...Object.values(PROPS).map((a) => a.src),
      PET_FEED_HANDS.src,
      PET_PLAY_HANDS.src,
      PET_GROOM_HANDS.src,
      PET_PHOTO_HANDS.src,
    ])
  })
}
