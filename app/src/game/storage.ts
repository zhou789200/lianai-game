import {
  CHAPTERS,
  CHARACTERS,
  RECIPES,
  STORYBOOK_CHAPTERS,
  TASKS,
} from '../data/content'
import {
  DYNAMIC_STORY_START_INDEX,
  normalizeStoryCache,
  normalizeStoryTrace,
} from './dynamicStory'
import { normalizeStoryChoices } from './storyProgression'
import type { GameState, TaskState } from './types'

export const SAVE_KEY = 'seabreeze-pet-cafe.save'
export const ACCOUNT_SAVE_PREFIX = 'seabreeze-pet-cafe.account.'
export const GUEST_MODE_KEY = 'seabreeze-pet-cafe.guest-mode'
export const INTRO_SEEN_KEY = 'seabreeze-pet-cafe.intro-seen'
export const SAVE_VERSION = 4
const SUPPORTED_SAVE_VERSIONS = new Set([1, 2, 3, 4])

export const STAMINA_REGEN_MS = 90_000 // 每 90 秒回复 1 点体力
export const BUSINESS_STAMINA_COST = 4

export function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = `${date.getMonth() + 1}`.padStart(2, '0')
  const d = `${date.getDate()}`.padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function expForLevel(level: number): number {
  return 90 + (level - 1) * 70
}

export function createInitialTasks(): TaskState[] {
  return TASKS.map((t) => ({ id: t.id, progress: 0, claimed: false }))
}

function createStorySeed(now = Date.now()): string {
  return `seed_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function stableStorySeed(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `seed_migrated_${(hash >>> 0).toString(36)}`
}

function cleanStorySeed(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
}

export function createInitialState(): GameState {
  const now = Date.now()
  return {
    version: SAVE_VERSION,
    createdAt: now,
    updatedAt: now,

    playerName: '店长',
    shopName: '海风镇宠物咖啡馆',

    coins: 320,
    stamina: 12,
    staminaMax: 12,
    staminaRegenAt: now,

    level: 1,
    exp: 0,

    pet: {
      name: '布丁',
      breed: '橘白猫',
      age: '两岁半',
      intimacy: 12,
      hunger: 62,
      cleanliness: 70,
      mood: 68,
      diary: [
        {
          id: 'diary-welcome',
          at: now,
          icon: 'PawPrint',
          text: '搬进海风镇的第一天。窗台上有一块晒得到太阳的地方，我先占了。',
        },
      ],
    },

    relationships: CHARACTERS.map((c) => ({
      id: c.id,
      name: c.name,
      role: c.role,
      note: c.note,
      value: c.id === 'linche' ? 6 : 0,
      met: c.id === 'linche',
    })),

    chapterId: CHAPTERS[0].id,
    chapterBeat: 0,
    completedChapters: [],

    storyChapterId: STORYBOOK_CHAPTERS[0].id,
    storyChapterBeat: 0,
    storyBranchId: null,
    storyBranchBeat: 0,
    storyCompletedChapters: [],
    storyFlags: [],
    storyTraces: [],
    storyChoices: [],
    storySeed: createStorySeed(now),
    storyCache: [],
    storyTraceId: null,
    storyTurn: 0,

    tasks: createInitialTasks(),
    tasksDate: todayKey(),

    unlocked: ['recipe:latte', 'recipe:croissant'],
    equipment: { machine: 1, oven: 1, counter: 1, signboard: 1 },
    recipes: RECIPES.filter((r) => r.unlockCost === 0).map((r) => r.id),
    decor: [],

    stats: {
      businessRuns: 0,
      ordersServed: 0,
      perfectRuns: 0,
      petInteractions: 0,
      choicesMade: 0,
      coinsEarned: 0,
    },

    activeRunId: null,
    lastSettledRunId: null,
    lastBusiness: null,
    pendingRunRewards: null,
  }
}

/* ---------- 存档读写 ---------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isGameState(value: unknown): value is GameState {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    !SUPPORTED_SAVE_VERSIONS.has(value.version)
  ) {
    return false
  }
  if (
    typeof value.coins !== 'number' ||
    typeof value.stamina !== 'number' ||
    typeof value.staminaMax !== 'number' ||
    typeof value.level !== 'number' ||
    typeof value.exp !== 'number' ||
    typeof value.chapterId !== 'string' ||
    typeof value.chapterBeat !== 'number'
  ) {
    return false
  }
  if (
    !isRecord(value.pet) ||
    typeof value.pet.hunger !== 'number' ||
    typeof value.pet.cleanliness !== 'number' ||
    typeof value.pet.mood !== 'number' ||
    typeof value.pet.intimacy !== 'number' ||
    !Array.isArray(value.pet.diary)
  ) {
    return false
  }
  return (
    Array.isArray(value.relationships) &&
    Array.isArray(value.completedChapters) &&
    Array.isArray(value.tasks) &&
    Array.isArray(value.recipes) &&
    Array.isArray(value.decor) &&
    isRecord(value.equipment) &&
    isRecord(value.stats)
  )
}

export function loadState(): GameState | null {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    return parseGameState(JSON.parse(raw))
  } catch {
    return null
  }
}

/** 校验来自 localStorage 或用户数据库的完整游戏存档。 */
export function parseGameState(value: unknown): GameState | null {
  // 旧版或不完整存档：回退到初始状态，避免脏数据导致页面崩溃。
  return isGameState(value) ? normalizeState(value) : null
}

/** 兼容旧存档：补齐 R3 新增字段 */
function normalizeState(state: GameState): GameState {
  const hasKnownStoryChapter =
    typeof state.storyChapterId === 'string' &&
    STORYBOOK_CHAPTERS.some((chapter) => chapter.id === state.storyChapterId)
  const chapter = STORYBOOK_CHAPTERS.find((item) => item.id === state.storyChapterId)
  const storedBranchId = typeof state.storyBranchId === 'string' ? state.storyBranchId : null
  const hasKnownStoryBranch = chapter?.beats.some(
    (beat) =>
      beat.type === 'choice' &&
      beat.options.some((option) => option.branch?.id === storedBranchId),
  )
  const rawStoryTraces = Array.isArray(state.storyTraces) ? state.storyTraces : []
  const validStoryTraces = rawStoryTraces
    .map((trace) => normalizeStoryTrace(trace))
    .filter((trace): trace is GameState['storyTraces'][number] => trace !== null)
  const storyTurn = Math.max(
    typeof state.storyTurn === 'number' && Number.isFinite(state.storyTurn)
      ? Math.trunc(state.storyTurn)
      : 0,
    validStoryTraces.length,
  )
  const retainedTraces = validStoryTraces.slice(0, 30)
  const archivedOffset = Math.max(0, storyTurn - retainedTraces.length)
  const storyTraces = retainedTraces.map((trace, index) => ({
    ...trace,
    chapterIndex:
      trace.chapterIndex ??
      DYNAMIC_STORY_START_INDEX + archivedOffset + (retainedTraces.length - 1 - index),
  }))
  const storedStoryTraceId =
    typeof state.storyTraceId === 'string' ? state.storyTraceId : null
  const storyTraceId = retainedTraces.some((trace) => trace.id === storedStoryTraceId)
    ? storedStoryTraceId
    : null
  const storyChoices = normalizeStoryChoices(state.storyChoices)
  const storedStorySeed = cleanStorySeed(state.storySeed)
  const migrationSeedSource = [
    typeof state.createdAt === 'number' ? state.createdAt : 0,
    storyTurn,
    storyChoices.map((choice) => choice.id).join(','),
    retainedTraces.map((trace) => trace.id).join(','),
  ].join('|')
  const storySeed = storedStorySeed || stableStorySeed(migrationSeedSource)
  const storyCache = normalizeStoryCache(state.storyCache)

  return {
    ...state,
    version: SAVE_VERSION,
    storyChapterId: hasKnownStoryChapter ? state.storyChapterId : STORYBOOK_CHAPTERS[0].id,
    storyChapterBeat:
      typeof state.storyChapterBeat === 'number' && state.storyChapterBeat >= 0
        ? state.storyChapterBeat
        : 0,
    storyBranchId: hasKnownStoryBranch ? storedBranchId : null,
    storyBranchBeat:
      typeof state.storyBranchBeat === 'number' && state.storyBranchBeat >= 0
        ? state.storyBranchBeat
        : 0,
    storyCompletedChapters: Array.isArray(state.storyCompletedChapters)
      ? state.storyCompletedChapters
      : [],
    storyFlags: Array.isArray(state.storyFlags)
      ? state.storyFlags.filter((flag): flag is string => typeof flag === 'string')
      : [],
    storyTraces,
    storyChoices,
    storySeed,
    storyCache,
    storyTraceId,
    storyTurn: Math.max(0, storyTurn),
    activeRunId: state.activeRunId ?? null,
    lastSettledRunId: state.lastSettledRunId ?? null,
    lastBusiness: state.lastBusiness ?? null,
    pendingRunRewards:
      state.pendingRunRewards && typeof state.pendingRunRewards === 'object'
        ? {
            coins: typeof state.pendingRunRewards.coins === 'number' ? state.pendingRunRewards.coins : 0,
            exp: typeof state.pendingRunRewards.exp === 'number' ? state.pendingRunRewards.exp : 0,
          }
        : null,
  }
}

/**
 * 刷新 / 崩溃后归还未结算营业占用的体力，避免“体力被扣但没结算”。
 * 营业中的临时状态不入档，因此这里只做归还，不发放任何收益。
 */
export function reconcileAbandonedRun(state: GameState): GameState {
  if (!state.activeRunId) return normalizeState(state)
  const pending = state.pendingRunRewards ?? { coins: 0, exp: 0 }
  const recovered: GameState = {
    ...state,
    activeRunId: null,
    stamina: Math.min(state.staminaMax, state.stamina + BUSINESS_STAMINA_COST),
    updatedAt: Date.now(),
  }
  return { ...recovered, pendingRunRewards: null, recoveredRunRewards: pending }
}

export function saveState(state: GameState): boolean {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    return true
  } catch {
    return false
  }
}

export function clearSave(): void {
  try {
    window.localStorage.removeItem(SAVE_KEY)
  } catch {
    /* 忽略：隐私模式等场景下 localStorage 不可用 */
  }
}

export function hasGuestSave(): boolean {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null
  } catch {
    return false
  }
}

/** 新用户是否已经明确选择“先以游客试玩”。 */
export function hasChosenGuestMode(): boolean {
  try {
    return window.localStorage.getItem(GUEST_MODE_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberGuestMode(): void {
  try {
    window.localStorage.setItem(GUEST_MODE_KEY, '1')
  } catch {
    /* 本次会话仍可继续试玩 */
  }
}

export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(INTRO_SEEN_KEY) === '1'
  } catch {
    return false
  }
}

export function rememberIntroSeen(): void {
  try {
    window.localStorage.setItem(INTRO_SEEN_KEY, '1')
  } catch {
    /* 本次会话仍可关闭开场说明 */
  }
}

/**
 * 账号存档在浏览器里保留一份独立缓存，仅用于数据库暂时不可用或
 * 同一账号下次恢复时兜底。它不会与游客存档共用键。
 */
export function loadAccountState(accountId: string): GameState | null {
  try {
    const raw = window.localStorage.getItem(`${ACCOUNT_SAVE_PREFIX}${accountId}`)
    if (!raw) return null
    const cached: unknown = JSON.parse(raw)
    if (!isRecord(cached) || cached.accountId !== accountId) return null
    return parseGameState(cached.state)
  } catch {
    return null
  }
}

export function saveAccountState(accountId: string, state: GameState): boolean {
  try {
    window.localStorage.setItem(
      `${ACCOUNT_SAVE_PREFIX}${accountId}`,
      JSON.stringify({ accountId, state }),
    )
    return true
  } catch {
    return false
  }
}

export function clearAccountState(accountId: string): void {
  try {
    window.localStorage.removeItem(`${ACCOUNT_SAVE_PREFIX}${accountId}`)
  } catch {
    /* 忽略：隐私模式等场景下 localStorage 不可用 */
  }
}
