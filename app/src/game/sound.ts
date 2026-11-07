/* ============================================================
   声音总开关
   ------------------------------------------------------------
   单独存一个 localStorage 键，不放进游戏存档：
   这样「重置存档」不会把玩家的静音选择一起重置。
   ============================================================ */

const SOUND_KEY = 'seabreeze-pet-cafe.sound'
const SOUND_EVENT = 'seabreeze:sound-change'

let cached: boolean | null = null

export function isSoundEnabled(): boolean {
  if (cached !== null) return cached
  try {
    cached = window.localStorage.getItem(SOUND_KEY) !== 'off'
  } catch {
    cached = true
  }
  return cached
}

export function setSoundEnabled(next: boolean): void {
  cached = next
  try {
    window.localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
  } catch {
    /* 隐私模式下 localStorage 不可用：本次会话内仍然生效 */
  }
  window.dispatchEvent(new Event(SOUND_EVENT))
}

export function onSoundChange(listener: () => void): () => void {
  window.addEventListener(SOUND_EVENT, listener)
  return () => window.removeEventListener(SOUND_EVENT, listener)
}
