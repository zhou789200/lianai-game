import {
  CHARACTERS,
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
 */

/** 咖啡店玩法里直接写死路径的图（未登记在 manifest） */
const CAFE_SHOP_ART = [
  'art/scene-cafe-shop-clean.webp',
  'art/cafe-barista-front.png',
  'art/cafe-barista-side.png',
  'art/cafe-barista-back.png',
  'art/cafe-cat-front.png',
  'art/cafe-cat-side.png',
  'art/cafe-cat-back.png',
]

let started = false

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

  const seen = new Set<string>()
  const queue: string[] = []
  const push = (src: string) => {
    if (!src || seen.has(src)) return
    seen.add(src)
    queue.push(src)
  }

  Object.values(CHARACTERS).forEach((a) => push(a.src))
  Object.values(PETS).forEach((a) => push(a.src))
  Object.values(PROPS).forEach((a) => push(a.src))
  ;[PET_FEED_HANDS, PET_PLAY_HANDS, PET_GROOM_HANDS, PET_PHOTO_HANDS].forEach((a) => push(a.src))
  CAFE_SHOP_ART.forEach(push)

  let cursor = 0
  let running = 0

  const pump = () => {
    while (running < CONCURRENCY && cursor < queue.length) {
      const src = queue[cursor]
      cursor += 1
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
