/**
 * 美术资产清单（Art Layer · 唯一入口）
 * ============================================================
 * 资产统一放置在 `app/public/art/`，运行时以相对路径引用，
 * 组件只允许通过本清单取图，禁止硬编码路径。
 *
 * 资源由主美（Codex）另行生成；当前可能尚未产出，
 * SceneRenderer 会在图片缺失或加载失败时自动回退到 CSS 场景，
 * 不会出现破图或空白（详见 SceneRenderer 的降级策略）。
 */

export type SceneAssetKind = 'scene' | 'character' | 'pet' | 'prop'

export interface SceneAsset {
  id: string
  kind: SceneAssetKind
  /** 相对 public 根目录的路径，例如 art/scene-home.webp */
  src: string
  /** 无障碍描述，供 <img alt> 使用 */
  alt: string
}

/** 五个主场景视图键 */
export type SceneKey = 'home' | 'business' | 'cafe' | 'pet' | 'story'

const asset = (id: string, kind: SceneAssetKind, file: string, alt: string): SceneAsset => ({
  id,
  kind,
  src: `art/${file}`,
  alt,
})

/* ---------------- 场景底图（1600×2848 @2x） ---------------- */
export const SCENES: Record<SceneKey, SceneAsset> = {
  home: asset('scene-home', 'scene', 'scene-home.webp', '海风镇宠物咖啡馆 · 主界面全景'),
  business: asset('scene-business', 'scene', 'scene-business.webp', '咖啡馆营业中的大厅'),
  cafe: asset('scene-cafe', 'scene', 'scene-cafe.webp', '咖啡馆经营 · 装修与陈设'),
  pet: asset('scene-pet', 'scene', 'scene-pet.webp', '窗边软座 · 与宠物相处'),
  story: asset('scene-story', 'scene', 'scene-story.webp', '傍晚吧台 · 剧情本'),
}

/* ---------------- 角色立绘（900×1400 透明底） ---------------- */
export const CHARACTERS: Record<string, SceneAsset> = {
  'linche-calm': asset('linche-calm', 'character', 'char-linche-calm.webp', '林澈 · 平静'),
  'linche-smile': asset('linche-smile', 'character', 'char-linche-smile.webp', '林澈 · 微笑'),
  'guhuai-calm': asset('guhuai-calm', 'character', 'char-guhuai-calm.webp', '顾淮 · 平静'),
}

/* ---------------- 宠物立绘（透明底 PNG，与咖啡店场景里的布丁同一套拆件） ---------------- */
export const PETS: Record<string, SceneAsset> = {
  'pudding-front': asset('pudding-front', 'pet', 'cafe-cat-front.png', '布丁 · 端坐着看你'),
  'pudding-side': asset('pudding-side', 'pet', 'cafe-cat-side.png', '布丁 · 侧身张望'),
  'pudding-back': asset('pudding-back', 'pet', 'cafe-cat-back.png', '布丁 · 背对着你'),
}

/** 喂食演出专用的女主人双手端碗素材 */
export const PET_FEED_HANDS = asset(
  'pet-feed-hands',
  'character',
  'pet-owner-hands-feed-v2.png',
  '女主人双手端着猫碗喂布丁',
)

/** 玩耍演出专用的女主人持逗猫棒素材 */
export const PET_PLAY_HANDS = asset(
  'pet-play-hands',
  'character',
  'pet-owner-hands-play-v1.png',
  '女主人握着逗猫棒陪布丁玩',
)

/** 梳毛演出专用的女主人持梳子素材 */
export const PET_GROOM_HANDS = asset(
  'pet-groom-hands',
  'character',
  'pet-owner-hands-groom-v1.png',
  '女主人握着软毛刷给布丁梳毛',
)

/** 拍照演出专用的女主人双手持相机素材 */
export const PET_PHOTO_HANDS = asset(
  'pet-photo-hands',
  'character',
  'pet-owner-hands-photo-v1.png',
  '女主人双手举着相机给布丁拍照',
)

/**
 * 按心情挑一张宠物立绘：
 * 心情低是背影、心情好是正面、其余用侧身，让数值变化在画面上看得出来。
 */
export function petAsset(mood: number): SceneAsset {
  if (mood < 35) return PETS['pudding-back']
  if (mood >= 60) return PETS['pudding-front']
  return PETS['pudding-side']
}

/* ---------------- 道具 / 装饰（512×512 透明底） ---------------- */
export const PROPS: Record<string, SceneAsset> = {
  flowerpot: asset('flowerpot', 'prop', 'prop-flowerpot.webp', '陶土花盆'),
  hangingplant: asset('hangingplant', 'prop', 'prop-hangingplant.webp', '垂吊绿植'),
  pendantlamp: asset('pendantlamp', 'prop', 'prop-pendantlamp.webp', '黄铜吊灯'),
  seapainting: asset('seapainting', 'prop', 'prop-seapainting.webp', '海面挂画'),
  cattree: asset('cattree', 'prop', 'prop-cattree.webp', '猫爬架'),
  warmlight: asset('warmlight', 'prop', 'prop-warmlight.webp', '暖光壁灯'),
}

/** 剧情角色 → 立绘 的兜底映射（章节未配立绘时使用） */
export function characterAsset(characterId?: string): SceneAsset | undefined {
  if (!characterId) return CHARACTERS['linche-calm']
  return (
    CHARACTERS[`${characterId}-calm`] ??
    Object.values(CHARACTERS).find((a) => a.id.startsWith(characterId))
  )
}
