import { memo, useEffect, useState, type CSSProperties } from 'react'
import { DECOR } from '../data/content'
import { PROPS, SCENES } from '../assets/manifest'
import type { SceneAsset, SceneKey } from '../assets/manifest'
import { GameIcon } from './GameIcon'

export type SceneVariant = 'home' | 'business' | 'cafe' | 'pet' | 'story'

/** 已购装饰在场景层中的固定安全位（避开顶栏 / 立绘区 / 底部导航） */
const PROP_SLOT: Record<string, { left?: string; right?: string; top?: string; bottom?: string }> = {
  flowerpot: { left: '3%', bottom: '46%' },
  hangingplant: { right: '4%', top: '14%' },
  pendantlamp: { left: '12%', top: '2%' },
  seapainting: { left: '4%', top: '24%' },
  cattree: { right: '4%', bottom: '45%' },
  warmlight: { right: '14%', top: '2%' },
  vase: { left: '22%', top: '2%' },
  teacups: { right: '22%', top: '2%' },
  crate: { left: '4%', top: '12%' },
  pourover: { right: '4%', bottom: '26%' },
  chair: { left: '4%', bottom: '12%' },
  sofa: { right: '4%', bottom: '12%' },
}

type ArtStatus = 'loading' | 'ready' | 'missing'

/**
 * 位图加载状态：缺失或加载失败都收敛为 missing，渲染层据此回退。
 */
function useArt(asset?: SceneAsset) {
  const source = asset?.src
  const [loadedSource, setLoadedSource] = useState<string | null>(null)
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const status: ArtStatus = !source
    ? 'missing'
    : loadedSource === source
      ? 'ready'
      : failedSource === source
        ? 'missing'
        : 'loading'

  return {
    status,
    onLoad: () => setLoadedSource(source ?? null),
    onError: () => setFailedSource(source ?? null),
  }
}

/* ============================================================
   BackgroundLayer —— 场景底图
   五张场景图**常驻**叠在同一个层里，切页只切换 opacity。
   这样底图不会被卸载重建、也不会重新走一遍加载状态，
   从根上消除「切页 → 底色一闪 → 再淡入」的屏闪。
   每张图解码完成前不参与绘制，所以首屏仍然有完整的 CSS 场景兜底。

   加载时机：当前页立即加载，其余四张等首屏稳定后再按顺序补。
   五张图合计约 1.5MB，若和首屏 JS/CSS 同时抢带宽，
   弱网下会明显拖慢首屏；延迟加载后首屏只付一张图的代价，
   而补图通常在用户点进下一个页面前就完成了，仍不会露底。
   ============================================================ */
const SCENE_ORDER: SceneKey[] = ['home', 'business', 'cafe', 'pet', 'story']

/** 除当前页外，其余场景图的补载延迟（毫秒） */
const SCENE_WARM_DELAY = 1600

function SceneArt({
  asset,
  active,
  warm,
}: {
  asset: SceneAsset
  active: boolean
  warm: boolean
}) {
  const [ready, setReady] = useState(false)
  // 当前页立刻加载；其余场景等首屏稳定后再补。
  // 切到某页时 active 变 true，React 会直接补上 src 开始下载，
  // 不需要等 warm，用户快速点页也能第一时间出图。
  const wanted = active || warm

  return (
    <img
      className={`scene__bg${ready ? ' is-ready' : ''}${active ? ' is-active' : ''}`}
      src={wanted ? asset.src : undefined}
      alt=""
      aria-hidden="true"
      draggable={false}
      decoding="async"
      onLoad={() => setReady(true)}
    />
  )
}

function BackgroundLayer({ view }: { view: SceneVariant }) {
  const [warm, setWarm] = useState(false)

  useEffect(() => {
    // 首屏（当前页场景图解码）稳定后再补其余场景，避免抢首屏带宽。
    const timer = window.setTimeout(() => setWarm(true), SCENE_WARM_DELAY)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="scene__bg-layer">
      <CssScene />
      <div className="scene__bg-stack">
        {SCENE_ORDER.map((key) => (
          <SceneArt key={key} asset={SCENES[key]} active={key === view} warm={warm} />
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   PropLayer —— 已购装饰（固定安全位，不遮挡操作区）
   ============================================================ */
function PropMarker({ id }: { id: string }) {
  const def = DECOR.find((d) => d.id === id)
  const slot = PROP_SLOT[id]
  const asset = PROPS[id]
  const { status, onLoad, onError } = useArt(asset)

  if (!def || !slot) return null

  return (
    <span
      className={`scene-prop${status === 'ready' ? ' scene-prop--art' : ''}`}
      style={slot}
      title={def.name}
    >
      {status === 'ready' && asset ? (
        <img
          className="scene-prop__img"
          src={asset.src}
          alt={def.name}
          draggable={false}
          onLoad={onLoad}
          onError={onError}
        />
      ) : (
        <GameIcon name={def.icon} size={17} />
      )}
    </span>
  )
}

function PropLayer({ decor }: { decor: string[] }) {
  if (decor.length === 0) return null
  return (
    <div className="scene__props" aria-hidden="true">
      {decor.map((id) => (
        <PropMarker key={id} id={id} />
      ))}
    </div>
  )
}

/* ============================================================
   AtmosphereLayer —— 暖光 / 纸纹 / 暗角（保留既有 CSS 叠加）
   ============================================================ */
function AtmosphereLayer() {
  return (
    <div className="scene__atmosphere" aria-hidden="true">
      <div className="scene__rays" />
      <div className="scene__sweep" />
      <div className="scene__warm" />
      <div className="scene__texture" />
      <div className="scene__vignette" />
    </div>
  )
}

/* ============================================================
   SceneFx —— 生活感的浮尘与飘叶
   位置由固定序列生成，保证每次渲染一致，不使用随机数。
   ============================================================ */
const FX_MOTES = Array.from({ length: 16 }, (_, i) => {
  const k = (i * 37) % 100
  const j = (i * 61) % 100
  return {
    left: 4 + (k % 92),
    bottom: 6 + (j % 58),
    size: 3 + ((i * 13) % 6),
    delay: -((i * 1.7) % 12),
    duration: 11 + ((i * 29) % 9),
    drift: (i % 2 === 0 ? 1 : -1) * (12 + ((i * 7) % 22)),
  }
})

const FX_PETALS = Array.from({ length: 5 }, (_, i) => ({
  left: 8 + ((i * 53) % 80),
  delay: -((i * 3.1) % 10),
  duration: 14 + ((i * 41) % 10),
  drift: (i % 2 === 0 ? 1 : -1) * (26 + ((i * 17) % 26)),
}))

function SceneFx() {
  return (
    <div className="scene__fx" aria-hidden="true">
      {FX_MOTES.map((m, i) => (
        <span
          key={`mote-${i}`}
          className="scene__mote"
          style={{
            left: `${m.left}%`,
            bottom: `${m.bottom}%`,
            width: `${m.size}px`,
            height: `${m.size}px`,
            animationDelay: `${m.delay}s`,
            animationDuration: `${m.duration}s`,
            '--fx-drift': `${m.drift}px`,
          } as CSSProperties}
        />
      ))}
      {FX_PETALS.map((p, i) => (
        <span
          key={`petal-${i}`}
          className="scene__petal"
          style={{
            left: `${p.left}%`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            '--fx-drift': `${p.drift}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

/* ============================================================
   CSS 场景底：纯 CSS 构成，不嵌入任何参考图位图，也不含假 UI 文字。
   位图缺失时它就是最终画面；位图就绪时它是过渡底与氛围底。
   ============================================================ */
function CssScene() {
  return (
    <div className="scene__css" aria-hidden="true">
      <div className="scene__room" />
      <div className="scene__win">
        <div className="scene__sky" />
        <div className="scene__clouds" />
        <div className="scene__sea" />
        <div className="scene__village" />
        <div className="scene__sun" />
        <div className="scene__glow" />
      </div>
      <div className="scene__vine scene__vine--l" />
      <div className="scene__vine scene__vine--r" />
      <div className="scene__lamp" />
      <div className="scene__curtain" />
      <div className="scene__plant scene__plant--l" />
      <div className="scene__plant scene__plant--r" />
      <div className="scene__cushion" />
      <div className="scene__counter" />
      <div className="scene__wainscot" />
    </div>
  )
}

/* ============================================================
   SceneRenderer —— 可插拔场景渲染器
   BackgroundLayer → PropLayer → Character/PetLayer → AtmosphereLayer
   ============================================================ */
export interface SceneRendererProps {
  view: SceneVariant
  decor?: string[]
  /** 沉浸式玩法（咖啡店）自己铺满画面时传 true：只隐藏、不卸载，返回时不再重新解码 */
  hidden?: boolean
}

export function SceneRendererBase({ view, decor = [], hidden = false }: SceneRendererProps) {
  return (
    <div
      className={`scene scene--${view}${hidden ? ' is-hidden' : ''}`}
      aria-hidden="true"
    >
      <BackgroundLayer view={view} />
      <PropLayer decor={decor} />
      <SceneFx />
      <AtmosphereLayer />
    </div>
  )
}

/**
 * 场景层有 5 张底图 + 二十多个常驻动画节点，重渲染成本不低。
 * view / decor / hidden 不变时直接跳过：领取奖励、加金币这类
 * 与场景无关的状态更新就不必让整层重新 diff 一遍。
 */
export const SceneRenderer = memo(SceneRendererBase)
