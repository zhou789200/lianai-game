import { STAMINA_REGEN_MS } from './storage'
import type { GameState } from './types'

/**
 * 体力数值域：扣体力与自然回复都在这里，便于单测锁定边界。
 * 规则：满体力时不累计回复进度；一旦扣体力，回复计时从扣的那一刻重新开始。
 */

const clampTo = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

/**
 * 扣体力。
 * 若扣之前体力是满的，说明满体力期间的计时没有意义，必须把起点重置到现在；
 * 否则下一次 tick 会把“满体力待了多久”一次性折算成体力，
 * 等于每次花掉的体力马上又被补满。
 */
export function spendStamina(state: GameState, amount: number, now = Date.now()): GameState {
  const wasFull = state.stamina >= state.staminaMax
  return {
    ...state,
    stamina: clampTo(state.stamina - amount, 0, state.staminaMax),
    staminaRegenAt: wasFull ? now : state.staminaRegenAt,
    updatedAt: now,
  }
}

export interface StaminaRegen {
  stamina: number
  staminaRegenAt: number
}

/**
 * 按经过时间恢复体力。
 * 返回 null 表示没有任何变化，调用方据此避免每个 tick 都生成新 state。
 */
export function regenerateStamina(state: GameState, now = Date.now()): StaminaRegen | null {
  if (state.stamina >= state.staminaMax) return null
  const elapsed = now - state.staminaRegenAt
  if (!Number.isFinite(elapsed)) return null
  const gained = Math.floor(elapsed / STAMINA_REGEN_MS)
  if (gained <= 0) return null
  return {
    stamina: clampTo(state.stamina + gained, 0, state.staminaMax),
    staminaRegenAt: state.staminaRegenAt + gained * STAMINA_REGEN_MS,
  }
}
