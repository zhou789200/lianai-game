/* ============================================================
   声音总开关与全局音量
   ------------------------------------------------------------
   两个偏好单独存 localStorage，不放进游戏存档：
   这样「重置存档」不会把玩家的静音或音量选择一起重置。
   音量是总开关开启时使用的目标音量，0 等同于静音。
   ============================================================ */

const SOUND_KEY = 'seabreeze-pet-cafe.sound'
const VOLUME_KEY = 'seabreeze-pet-cafe.sound-volume'
const SOUND_EVENT = 'seabreeze:sound-change'
const VOLUME_EVENT = 'seabreeze:sound-volume-change'
const DEFAULT_VOLUME = 0.8

let cachedEnabled: boolean | null = null
let cachedVolume: number | null = null

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_VOLUME
  return Math.min(1, Math.max(0, value))
}

function readStoredVolume(): number {
  try {
    const stored = window.localStorage.getItem(VOLUME_KEY)
    return stored === null ? DEFAULT_VOLUME : clampVolume(Number(stored))
  } catch {
    return DEFAULT_VOLUME
  }
}

export function isSoundEnabled(): boolean {
  if (cachedEnabled !== null) return cachedEnabled
  try {
    cachedEnabled = window.localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    cachedEnabled = true
  }
  return cachedEnabled
}

export function setSoundEnabled(next: boolean): void {
  cachedEnabled = next
  try {
    window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
  } catch {
    /* 隐私模式下 localStorage 不可用：本次会话内仍然生效 */
  }
  window.dispatchEvent(new Event(SOUND_EVENT))
}

/** 返回总开关开启时使用的音量，范围 0–1。 */
export function getSoundVolume(): number {
  if (cachedVolume === null) cachedVolume = readStoredVolume()
  return cachedVolume
}

export function setSoundVolume(next: number): void {
  const volume = clampVolume(next)
  cachedVolume = volume
  try {
    window.localStorage.setItem(VOLUME_KEY, String(volume))
  } catch {
    /* 隐私模式下 localStorage 不可用：本次会话内仍然生效 */
  }
  window.dispatchEvent(new Event(VOLUME_EVENT))
}

/** 当前实际可听的音量；总开关关闭时严格为 0。 */
export function getEffectiveSoundVolume(): number {
  return isSoundEnabled() ? getSoundVolume() : 0
}

export function onSoundChange(listener: () => void): () => void {
  window.addEventListener(SOUND_EVENT, listener)
  return () => window.removeEventListener(SOUND_EVENT, listener)
}

export function onSoundVolumeChange(listener: () => void): () => void {
  window.addEventListener(VOLUME_EVENT, listener)
  return () => window.removeEventListener(VOLUME_EVENT, listener)
}
