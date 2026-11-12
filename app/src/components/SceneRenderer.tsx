import { useState, type CSSProperties } from 'react'
import { DECOR } from '../data/content'
import { PROPS, SCENES } from '../assets/manifest'
import type { SceneAsset } from '../assets/manifest'
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
   始终先铺 CSS 场景作为底与兜底，位图就绪后再叠上去，
   因此图片缺失 / 加载失败时不会破图或空白。
   ============================================================ */
function BackgroundLayer({ view }: { view: SceneVariant }) {
  const asset = SCENES[view]
  const { status, onLoad, onError } = useArt(asset)

  return (
    <div className="scene__bg-layer">
      <CssScene />
      {status !== 'missing' ? (
        <img
          className={`scene__bg${status === 'ready' ? ' is-ready' : ''}`}
          src={asset.src}
          alt=""
          aria-hidden="true"
          draggable={false}
          onLoad={onLoad}
          onError={onError}
        />
      ) : null}
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
}

export function SceneRenderer({ view, decor = [] }: SceneRendererProps) {
  return (
    <div className={`scene scene--${view}`} aria-hidden="true">
      <BackgroundLayer view={view} />
      <PropLayer decor={decor} />
      <SceneFx />
      <AtmosphereLayer />
    </div>
  )
}
