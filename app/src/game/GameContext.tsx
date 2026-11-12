import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  BUSINESS_STAMINA_COST,
  SAVE_VERSION,
  STAMINA_REGEN_MS,
  clearAccountState,
  clearSave,
  createInitialState,
  createInitialTasks,
  expForLevel,
  loadAccountState,
  loadState,
  parseGameState,
  reconcileAbandonedRun,
  saveAccountState,
  saveState,
  todayKey,
} from './storage'
import {
  CHAPTERS,
  DECOR,
  EQUIPMENT,
  PET_ACTIONS,
  RECIPES,
  STORYBOOK_CHAPTERS,
  TASKS,
} from '../data/content'
import { RATING_LABELS } from '../data/cafeContent'
import { appendStoryTrace, upsertStoryCache } from './dynamicStory'
import {
  applyRomanceChoice,
  applyStoryProgression,
  applyStorybookChoice,
  pendingStoryChoices,
  skipRomanceChapter,
  skipStorybookChapter,
  type StoryProgressionResult,
} from './storyProgression'
import {
  AuthenticationRequiredError,
  UserDataConflictError,
  deleteRemoteSave,
  getCurrentAccount,
  loadRemoteSave,
  loginAccount as loginGameAccount,
  logoutAccount as logoutGameAccount,
  registerAccount as registerGameAccount,
  saveRemoteState,
  type AccountConflict,
  type AccountUser,
  type UserDataStatus,
} from './userData'
import { chapterAvailable, chapterRequirementText } from './story'
import {
  getActiveStorybookBranch,
  storybookChapterAvailable,
  storybookChapterRequirementText,
} from './storybook'
import { playPetActionSfx, playSfx } from './sfx'
import type { CafeSettleSummary } from './cafeTypes'
import type {
  GameState,
  Notice,
  NoticeKind,
  Reward,
  GeneratedStory,
  StoryOption,
  StoryTrace,
} from './types'

/* ============================================================
   Runtime：notices 属于运行时状态，不写入存档
   ============================================================ */
interface Runtime {
  state: GameState
  notices: Notice[]
}

export interface ActionResult {
  ok: boolean
  message: string
}

type Action =
  | { type: 'hydrate'; state: GameState }
  | { type: 'reset' }
  | { type: 'tick' }
  | { type: 'notice'; kind: NoticeKind; title: string; text?: string }
  | { type: 'dismissNotice'; id: string }
  | { type: 'reward'; reward: Reward; silent?: boolean }
  | { type: 'spendStamina'; amount: number }
  | { type: 'serveOrder'; coins: number; exp: number }
  | { type: 'settleBusiness'; served: number; total: number; perfect: boolean }
  | { type: 'upgradeEquipment'; id: string; cost: number }
  | { type: 'researchRecipe'; id: string; cost: number }
  | { type: 'buyDecor'; id: string; cost: number }
  | {
      type: 'petAction'
      actionId: string
      cost: number
      staminaCost: number
      effects: Partial<Record<'hunger' | 'cleanliness' | 'mood' | 'intimacy', number>>
      diaryText: string
      icon: string
    }
  | { type: 'advanceStory' }
  | { type: 'completeChapter'; skipped?: boolean }
  | { type: 'selectChapter'; id: string }
  | { type: 'chooseStory'; option: StoryOption; chapterId: string; characterId: string }
  | { type: 'advanceStorybook' }
  | { type: 'completeStorybookChapter'; skipped?: boolean }
  | { type: 'selectStorybookChapter'; id: string }
  | { type: 'chooseStorybook'; option: StoryOption }
  | { type: 'selectStoryTrace'; id: string }
  | { type: 'rememberStoryTrace'; trace: StoryTrace }
  | { type: 'cacheGeneratedStory'; key: string; story: GeneratedStory }
  | { type: 'claimTask'; id: string; coins: number; exp: number }
  | { type: 'bumpTask'; id: string; amount: number }
  | { type: 'beginCafeRun'; runId: string }
  | { type: 'recordRunRewards'; coins: number; exp: number }
  | { type: 'clearRecoveredRunRewards' }
  | { type: 'settleCafe'; summary: CafeSettleSummary }

let noticeSeed = 0
function makeNotice(kind: NoticeKind, title: string, text?: string): Notice {
  noticeSeed += 1
  return { id: `n${Date.now().toString(36)}${noticeSeed}`, kind, title, text }
}

const clamp = (v: number, min = 0, max = 100) => Math.max(min, Math.min(max, v))

function mergeStoryFlags(current: string[], next?: string[]): string[] {
  if (!next?.length) return current
  return [...new Set([...current, ...next])]
}

function applyProgressionRewards(
  state: GameState,
  progression: StoryProgressionResult | null,
): GameState {
  if (!progression) return state
  return progression.rewards.reduce(
    (nextState, reward) => applyReward(nextState, reward),
    state,
  )
}

function applyStoryProgressionWithRewards(
  state: GameState,
  progression: StoryProgressionResult,
): GameState {
  const shouldApplyRewards = pendingStoryChoices(state, progression).length > 0
  const nextState = applyStoryProgression(state, progression)
  return shouldApplyRewards
    ? applyProgressionRewards(nextState, progression)
    : nextState
}

/** 统一处理经验与升级 */
function applyReward(state: GameState, reward: Reward): GameState {
  let next = { ...state }
  switch (reward.kind) {
    case 'coins':
      next.coins = Math.max(0, next.coins + reward.amount)
      if (reward.amount > 0) {
        next.stats = { ...next.stats, coinsEarned: next.stats.coinsEarned + reward.amount }
      }
      break
    case 'stamina':
      next.stamina = clamp(next.stamina + reward.amount, 0, next.staminaMax)
      break
    case 'petIntimacy':
      next.pet = { ...next.pet, intimacy: clamp(next.pet.intimacy + reward.amount) }
      break
    case 'petMood':
      next.pet = { ...next.pet, mood: clamp(next.pet.mood + reward.amount) }
      break
    case 'exp': {
      next.exp = next.exp + reward.amount
      while (next.exp >= expForLevel(next.level)) {
        next.exp -= expForLevel(next.level)
        next.level += 1
        next.staminaMax += 1
        next.stamina = clamp(next.stamina + 2, 0, next.staminaMax)
      }
      break
    }
  }
  next.updatedAt = Date.now()
  return next
}

function addNoticeAndMaybeLevel(
  runtime: Runtime,
  nextState: GameState,
  notices: Notice[],
): Runtime {
  if (nextState.level > runtime.state.level) {
    notices.push(
      makeNotice(
        'reward',
        `店铺升到 ${nextState.level} 级`,
        '体力上限提升，菜单与装饰里有新的东西可以解锁了。',
      ),
    )
  }
  return { state: nextState, notices }
}

function reducer(runtime: Runtime, action: Action): Runtime {
  const s = runtime.state

  switch (action.type) {
    case 'hydrate':
      return { state: action.state, notices: runtime.notices }

    case 'reset':
      return { state: createInitialState(), notices: [makeNotice('info', '已重置存档', '回到了开店的第一天。')] }

    case 'notice':
      return { ...runtime, notices: [...runtime.notices, makeNotice(action.kind, action.title, action.text)] }

    case 'dismissNotice':
      return { ...runtime, notices: runtime.notices.filter((n) => n.id !== action.id) }

    case 'tick': {
      const now = Date.now()
      let next = { ...s }
      let changed = false

      // 体力自然回复
      if (next.stamina < next.staminaMax) {
        const elapsed = now - next.staminaRegenAt
        const gained = Math.floor(elapsed / STAMINA_REGEN_MS)
        if (gained > 0) {
          next.stamina = clamp(next.stamina + gained, 0, next.staminaMax)
          next.staminaRegenAt = next.staminaRegenAt + gained * STAMINA_REGEN_MS
          changed = true
        }
      } else {
        next.staminaRegenAt = now
      }

      // 每日任务刷新
      const key = todayKey()
      if (next.tasksDate !== key) {
        next.tasks = createInitialTasks()
        next.tasksDate = key
        changed = true
      }

      if (!changed) return runtime
      next = { ...next, updatedAt: now }
      return { state: next, notices: runtime.notices }
    }

    case 'reward': {
      const nextState = applyReward(s, action.reward)
      const notices = [...runtime.notices]
      if (!action.silent && action.reward.amount !== 0) {
        const label =
          action.reward.kind === 'coins'
            ? `${action.reward.amount > 0 ? '+' : ''}${action.reward.amount} 金币`
            : action.reward.kind === 'exp'
              ? `${action.reward.amount > 0 ? '+' : ''}${action.reward.amount} 经验`
              : null
        if (label) notices.push(makeNotice('reward', label))
      }
      return addNoticeAndMaybeLevel(runtime, nextState, notices)
    }

    case 'spendStamina': {
      const nextState = {
        ...s,
        stamina: clamp(s.stamina - action.amount, 0, s.staminaMax),
        updatedAt: Date.now(),
      }
      return { state: nextState, notices: runtime.notices }
    }

    case 'serveOrder': {
      let nextState = applyReward(s, { kind: 'coins', amount: action.coins })
      nextState = applyReward(nextState, { kind: 'exp', amount: action.exp })
      nextState = {
        ...nextState,
        stats: { ...nextState.stats, ordersServed: nextState.stats.ordersServed + 1 },
      }
      const tasks = bumpTasks(nextState.tasks, 'serve_orders', 1)
      nextState = { ...nextState, tasks, updatedAt: Date.now() }
      return addNoticeAndMaybeLevel(runtime, nextState, [...runtime.notices])
    }

    case 'settleBusiness': {
      let nextState: GameState = {
        ...s,
        stats: {
          ...s.stats,
          businessRuns: s.stats.businessRuns + 1,
          perfectRuns: s.stats.perfectRuns + (action.perfect ? 1 : 0),
        },
        tasks: bumpTasks(s.tasks, 'open_shop', 1),
        updatedAt: Date.now(),
      }
      if (action.perfect) {
        nextState = applyReward(nextState, { kind: 'coins', amount: 60 })
        nextState = applyReward(nextState, { kind: 'exp', amount: 12 })
      }
      return addNoticeAndMaybeLevel(runtime, nextState, [...runtime.notices])
    }

    case 'upgradeEquipment': {
      const level = (s.equipment[action.id] ?? 0) + 1
      const nextState: GameState = {
        ...s,
        coins: Math.max(0, s.coins - action.cost),
        equipment: { ...s.equipment, [action.id]: level },
        tasks: bumpTasks(s.tasks, 'upgrade_once', 1),
        updatedAt: Date.now(),
      }
      const def = EQUIPMENT.find((e) => e.id === action.id)
      return {
        state: nextState,
        notices: [
          ...runtime.notices,
          makeNotice('success', `${def?.name ?? '设备'} 升到 Lv.${level}`, def?.effects[level - 1]),
        ],
      }
    }

    case 'researchRecipe': {
      const def = RECIPES.find((r) => r.id === action.id)
      const nextState: GameState = {
        ...s,
        coins: Math.max(0, s.coins - action.cost),
        recipes: [...s.recipes, action.id],
        unlocked: [...s.unlocked, `recipe:${action.id}`],
        updatedAt: Date.now(),
      }
      return {
        state: nextState,
        notices: [...runtime.notices, makeNotice('success', `研发出「${def?.name ?? '新品'}」`, '已经可以出现在营业订单里了。')],
      }
    }

    case 'buyDecor': {
      const def = DECOR.find((d) => d.id === action.id)
      const nextState: GameState = {
        ...s,
        coins: Math.max(0, s.coins - action.cost),
        decor: [...s.decor, action.id],
        unlocked: [...s.unlocked, `decor:${action.id}`],
        tasks: bumpTasks(s.tasks, 'upgrade_once', 1),
        updatedAt: Date.now(),
      }
      return {
        state: nextState,
        notices: [
          ...runtime.notices,
          makeNotice('success', `添置了「${def?.name ?? '装饰'}」`, `门店魅力 +${def?.charm ?? 0}`),
        ],
      }
    }

    case 'petAction': {
      const p = s.pet
      const nextState: GameState = {
        ...s,
        coins: Math.max(0, s.coins - action.cost),
        stamina: clamp(s.stamina - action.staminaCost, 0, s.staminaMax),
        pet: {
          ...p,
          hunger: clamp(p.hunger + (action.effects.hunger ?? 0)),
          cleanliness: clamp(p.cleanliness + (action.effects.cleanliness ?? 0)),
          mood: clamp(p.mood + (action.effects.mood ?? 0)),
          intimacy: clamp(p.intimacy + (action.effects.intimacy ?? 0)),
          diary: [
            { id: `d${Date.now().toString(36)}`, at: Date.now(), icon: action.icon, text: action.diaryText },
            ...p.diary,
          ].slice(0, 40),
        },
        stats: { ...s.stats, petInteractions: s.stats.petInteractions + 1 },
        tasks: bumpTasks(s.tasks, 'pet_care', 1),
        updatedAt: Date.now(),
      }
      return addNoticeAndMaybeLevel(runtime, nextState, [...runtime.notices])
    }

    case 'selectChapter': {
      const chapter = CHAPTERS.find((c) => c.id === action.id)
      if (!chapter) return runtime
      return {
        state: { ...s, chapterId: chapter.id, chapterBeat: 0, updatedAt: Date.now() },
        notices: runtime.notices,
      }
    }

    case 'advanceStory': {
      const nextState = { ...s, chapterBeat: s.chapterBeat + 1, updatedAt: Date.now() }
      return { state: nextState, notices: runtime.notices }
    }

    case 'completeChapter': {
      const chapter = CHAPTERS.find((c) => c.id === s.chapterId)
      if (!chapter) return runtime
      const already = s.completedChapters.includes(chapter.id)
      const progression =
        action.skipped && !already ? skipRomanceChapter(s, chapter) : null
      let nextState: GameState = {
        ...s,
        completedChapters: already ? s.completedChapters : [...s.completedChapters, chapter.id],
        updatedAt: Date.now(),
      }
      if (progression) nextState = applyStoryProgression(nextState, progression)
      const idx = CHAPTERS.findIndex((c) => c.id === chapter.id)
      const candidate = CHAPTERS[idx + 1]
      const canMoveOn = candidate ? chapterAvailable(nextState, candidate) : false
      nextState = {
        ...nextState,
        chapterBeat: 0,
        chapterId: candidate && canMoveOn ? candidate.id : chapter.id,
      }
      const notices = [...runtime.notices]
      if (!already) {
        nextState = applyReward(nextState, { kind: 'coins', amount: chapter.rewardCoins })
        nextState = applyReward(nextState, { kind: 'exp', amount: chapter.rewardExp })
        notices.push(
          makeNotice(
            'reward',
            action.skipped ? `跳过《${chapter.title}》` : `读完《${chapter.title}》`,
            `+${chapter.rewardCoins} 金币 · +${chapter.rewardExp} 经验`,
          ),
        )
      }
      if (candidate && !canMoveOn) {
        notices.push(
          makeNotice(
            'info',
            `《${candidate.title}》暂未解锁`,
            chapterRequirementText(nextState, candidate) ?? undefined,
          ),
        )
      }
      return addNoticeAndMaybeLevel(runtime, nextState, notices)
    }

    case 'chooseStory': {
      const chapter = CHAPTERS.find(
        (item) => item.id === action.chapterId && item.id === s.chapterId,
      )
      if (!chapter) return runtime
      const progression = applyRomanceChoice(s, chapter, action.option.id, false)
      if (!progression) return runtime
      const nextState = applyStoryProgressionWithRewards(s, progression)
      const rel = nextState.relationships.find((r) => r.id === chapter.characterId)
      const delta = progression.relationshipChanges.find(
        (item) => item.characterId === chapter.characterId,
      )?.delta ?? 0
      const notices = [...runtime.notices]
      if (delta !== 0 && rel) {
        notices.push(
          makeNotice(delta > 0 ? 'success' : 'info', `${rel.name} 关系 ${delta > 0 ? '+' : ''}${delta}`, `当前关系值 ${rel.value}`),
        )
      }
      return addNoticeAndMaybeLevel(runtime, nextState, notices)
    }

    case 'selectStorybookChapter': {
      const chapter = STORYBOOK_CHAPTERS.find((item) => item.id === action.id)
      if (!chapter) return runtime
      return {
        state: {
          ...s,
          storyChapterId: chapter.id,
          storyChapterBeat: 0,
          storyBranchId: null,
          storyBranchBeat: 0,
          storyTraceId: null,
          updatedAt: Date.now(),
        },
        notices: runtime.notices,
      }
    }

    case 'advanceStorybook': {
      const chapter = STORYBOOK_CHAPTERS.find((item) => item.id === s.storyChapterId)
      if (!chapter) return runtime
      const branch = getActiveStorybookBranch(s)
      if (branch) {
        const branchFinished = s.storyBranchBeat + 1 >= branch.beats.length
        return {
          state: {
            ...s,
            storyChapterBeat: branchFinished ? s.storyChapterBeat + 1 : s.storyChapterBeat,
            storyBranchId: branchFinished ? null : branch.id,
            storyBranchBeat: branchFinished ? 0 : s.storyBranchBeat + 1,
            updatedAt: Date.now(),
          },
          notices: runtime.notices,
        }
      }
      return {
        state: {
          ...s,
          storyChapterBeat: s.storyChapterBeat + 1,
          updatedAt: Date.now(),
        },
        notices: runtime.notices,
      }
    }

    case 'completeStorybookChapter': {
      const chapter = STORYBOOK_CHAPTERS.find((item) => item.id === s.storyChapterId)
      if (!chapter) return runtime
      const already = s.storyCompletedChapters.includes(chapter.id)
      const progression =
        action.skipped && !already ? skipStorybookChapter(s, chapter) : null
      const index = STORYBOOK_CHAPTERS.findIndex((item) => item.id === chapter.id)
      const candidate = STORYBOOK_CHAPTERS[index + 1]
      const completedChapters = already
        ? s.storyCompletedChapters
        : [...s.storyCompletedChapters, chapter.id]

      let nextState: GameState = {
        ...s,
        storyTraceId: null,
        storyCompletedChapters: completedChapters,
        storyFlags: already
          ? s.storyFlags
          : mergeStoryFlags(s.storyFlags, chapter.unlockStoryFlags),
        updatedAt: Date.now(),
      }
      if (progression) {
        nextState = applyStoryProgressionWithRewards(nextState, progression)
      }
      const canMoveOn = candidate
        ? storybookChapterAvailable(nextState, candidate)
        : false
      nextState = {
        ...nextState,
        storyChapterBeat: 0,
        storyBranchId: null,
        storyBranchBeat: 0,
        storyChapterId: candidate && canMoveOn ? candidate.id : chapter.id,
      }
      const notices = [...runtime.notices]
      if (!already) {
        nextState = applyReward(nextState, { kind: 'coins', amount: chapter.rewardCoins })
        nextState = applyReward(nextState, { kind: 'exp', amount: chapter.rewardExp })
        notices.push(
          makeNotice(
            'reward',
            action.skipped ? `跳过《${chapter.title}》` : `读完《${chapter.title}》`,
            `+${chapter.rewardCoins} 金币 · +${chapter.rewardExp} 经验`,
          ),
        )
      }
      if (candidate && !canMoveOn) {
        notices.push(
          makeNotice(
            'info',
            `《${candidate.title}》暂未解锁`,
            storybookChapterRequirementText(
              nextState,
              candidate,
            ) ?? undefined,
          ),
        )
      }
      return addNoticeAndMaybeLevel(runtime, nextState, notices)
    }

    case 'chooseStorybook': {
      const chapter = STORYBOOK_CHAPTERS.find(
        (item) => item.id === s.storyChapterId,
      )
      if (!chapter) return runtime
      const progression = applyStorybookChoice(s, chapter, action.option.id, false)
      if (!progression) return runtime
      const nextState = applyStoryProgressionWithRewards(s, progression)
      return addNoticeAndMaybeLevel(runtime, nextState, [...runtime.notices])
    }

    case 'selectStoryTrace': {
      if (!s.storyTraces.some((trace) => trace.id === action.id)) return runtime
      if (s.storyTraceId === action.id) return runtime
      return {
        state: { ...s, storyTraceId: action.id, updatedAt: Date.now() },
        notices: runtime.notices,
      }
    }

    case 'rememberStoryTrace': {
      const alreadyRecorded = s.storyTraces.some((trace) => trace.id === action.trace.id)
      if (alreadyRecorded) {
        if (s.storyTraceId === action.trace.id) return runtime
        return {
          state: { ...s, storyTraceId: action.trace.id, updatedAt: Date.now() },
          notices: runtime.notices,
        }
      }
      return {
        state: {
          ...s,
          storyTraces: appendStoryTrace(s.storyTraces, action.trace),
          storyTraceId: action.trace.id,
          storyTurn: s.storyTurn + 1,
          stats: { ...s.stats, choicesMade: s.stats.choicesMade + 1 },
          tasks: bumpTasks(s.tasks, 'story_step', 1),
          updatedAt: Date.now(),
        },
        notices: runtime.notices,
      }
    }

    case 'cacheGeneratedStory': {
      const storyCache = upsertStoryCache(
        s.storyCache,
        action.key,
        action.story,
      )
      if (
        storyCache.length === s.storyCache.length &&
        storyCache.every(
          (entry, index) =>
            entry.key === s.storyCache[index]?.key &&
            entry.at === s.storyCache[index]?.at &&
            JSON.stringify(entry.story) ===
              JSON.stringify(s.storyCache[index]?.story),
        )
      ) {
        return runtime
      }
      return {
        state: { ...s, storyCache, updatedAt: Date.now() },
        notices: runtime.notices,
      }
    }

    case 'claimTask': {
      let nextState: GameState = {
        ...s,
        tasks: s.tasks.map((t) => (t.id === action.id ? { ...t, claimed: true } : t)),
        updatedAt: Date.now(),
      }
      nextState = applyReward(nextState, { kind: 'coins', amount: action.coins })
      nextState = applyReward(nextState, { kind: 'exp', amount: action.exp })
      const def = TASKS.find((t) => t.id === action.id)
      return addNoticeAndMaybeLevel(runtime, nextState, [
        ...runtime.notices,
        makeNotice('reward', `任务完成：${def?.name ?? '每日任务'}`, `+${action.coins} 金币 · +${action.exp} 经验`),
      ])
    }

    case 'bumpTask': {
      const nextState = { ...s, tasks: bumpTasks(s.tasks, action.id, action.amount), updatedAt: Date.now() }
      return { state: nextState, notices: runtime.notices }
    }

    case 'beginCafeRun': {
      if (s.activeRunId) return runtime
      const nextState: GameState = {
        ...s,
        activeRunId: action.runId,
        stamina: clamp(s.stamina - BUSINESS_STAMINA_COST, 0, s.staminaMax),
        pendingRunRewards: null,
        updatedAt: Date.now(),
      }
      return { state: nextState, notices: runtime.notices }
    }

    case 'recordRunRewards': {
      const nextPending = {
        coins: (s.pendingRunRewards?.coins ?? 0) + action.coins,
        exp: (s.pendingRunRewards?.exp ?? 0) + action.exp,
      }
      return {
        state: { ...s, pendingRunRewards: nextPending, updatedAt: Date.now() },
        notices: runtime.notices,
      }
    }

    case 'clearRecoveredRunRewards':
      return { state: { ...s, recoveredRunRewards: null }, notices: runtime.notices }

    case 'settleCafe': {
      const sum = action.summary
      // 幂等：同一 runId 只发奖一次（重复触发 / 刷新都不重复发）
      if (s.lastSettledRunId === sum.runId) return runtime

      let nextState: GameState = {
        ...s,
        activeRunId: null,
        lastSettledRunId: sum.runId,
        lastBusiness: {
          at: Date.now(),
          served: sum.served,
          failed: sum.failed,
          rating: sum.rating,
          coins: sum.coins + sum.tips,
        },
        pendingRunRewards: null,
        stats: {
          ...s.stats,
          businessRuns: s.stats.businessRuns + 1,
          ordersServed: s.stats.ordersServed + sum.served,
          perfectRuns: s.stats.perfectRuns + (sum.perfect ? 1 : 0),
        },
        tasks: bumpTasks(bumpTasks(s.tasks, 'open_shop', 1), 'serve_orders', sum.served),
        updatedAt: Date.now(),
      }

      nextState = applyReward(nextState, { kind: 'coins', amount: sum.coins + sum.tips })
      nextState = applyReward(nextState, { kind: 'exp', amount: sum.exp })
      if (sum.petIntimacyGain) {
        nextState = applyReward(nextState, { kind: 'petIntimacy', amount: sum.petIntimacyGain })
      }
      if (sum.petMoodGain) {
        nextState = applyReward(nextState, { kind: 'petMood', amount: sum.petMoodGain })
      }
      if (sum.diary) {
        nextState = {
          ...nextState,
          pet: {
            ...nextState.pet,
            diary: [
              { id: `d${Date.now().toString(36)}`, at: Date.now(), icon: 'PawPrint', text: sum.diary },
              ...nextState.pet.diary,
            ].slice(0, 40),
          },
        }
      }
      if (sum.romanceCharacterId && sum.romanceGain) {
        nextState = {
          ...nextState,
          relationships: nextState.relationships.map((r) =>
            r.id === sum.romanceCharacterId
              ? { ...r, met: true, value: clamp(r.value + sum.romanceGain) }
              : r,
          ),
        }
      }

      const notices = [
        ...runtime.notices,
        makeNotice(
          sum.perfect ? 'reward' : 'success',
          `营业结束 · ${RATING_LABELS[sum.rating] ?? '慢慢来'}`,
          `上菜 ${sum.served} 单，收入 ${sum.coins + sum.tips} 金币，经验 +${sum.exp}`,
        ),
      ]
      return addNoticeAndMaybeLevel(runtime, nextState, notices)
    }

    default:
      return runtime
  }
}

function bumpTasks(tasks: GameState['tasks'], id: string, amount: number): GameState['tasks'] {
  const def = TASKS.find((t) => t.id === id)
  if (!def) return tasks
  return tasks.map((t) =>
    t.id === id ? { ...t, progress: Math.min(def.target, t.progress + amount) } : t,
  )
}

/* ============================================================
   Context
   ============================================================ */
interface GameContextValue {
  state: GameState
  notices: Notice[]
  lastSavedAt: number | null
  saveError: string | null
  userData: UserDataStatus
  authReady: boolean
  authBusy: boolean
  expToNext: number
  charm: number
  dismissNotice: (id: string) => void
  pushNotice: (kind: NoticeKind, title: string, text?: string) => void
  actions: {
    resetGame: () => Promise<void>
    registerWithAccount: (username: string, password: string) => Promise<AccountUser>
    loginWithAccount: (username: string, password: string) => Promise<AccountUser>
    logoutFromAccount: () => Promise<void>
    resolveAccountConflict: (strategy: 'keep-local' | 'use-remote') => Promise<void>
    tick: () => void
    grantCoins: (amount: number, silent?: boolean) => void
    serveOrder: (coins: number, exp: number) => void
    settleBusiness: (served: number, total: number, perfect: boolean) => void
    recordRunRewards: (coins: number, exp: number) => void
    startBusiness: () => ActionResult
    beginCafeRun: (runId: string) => ActionResult
    settleCafe: (summary: CafeSettleSummary) => ActionResult
    upgradeEquipment: (id: string) => ActionResult
    researchRecipe: (id: string) => ActionResult
    buyDecor: (id: string) => ActionResult
    petAction: (id: 'feed' | 'play' | 'groom' | 'photo') => ActionResult
    advanceStory: () => ActionResult
    completeChapter: (skipped?: boolean) => void
    selectChapter: (id: string) => void
    chooseStoryOption: (option: StoryOption) => ActionResult
    advanceStorybook: () => ActionResult
    completeStorybookChapter: (skipped?: boolean) => ActionResult
    selectStorybookChapter: (id: string) => void
    chooseStorybookOption: (option: StoryOption) => ActionResult
    selectStoryTrace: (id: string) => void
    rememberStoryTrace: (trace: StoryTrace) => void
    cacheGeneratedStory: (key: string, story: GeneratedStory) => void
    claimTask: (id: string) => ActionResult
  }
}

const GameContext = createContext<GameContextValue | null>(null)

export function equipmentCost(id: string, level: number): number {
  const def = EQUIPMENT.find((e) => e.id === id)
  if (!def) return 0
  return Math.round(def.baseCost * Math.pow(def.costGrowth, level - 1))
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [runtime, dispatch] = useReducer(reducer, undefined, () => {
    const loaded = loadState()
    return {
      state: loaded ? reconcileAbandonedRun(loaded) : createInitialState(),
      notices: [],
    }
  })
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [userData, setUserData] = useState<UserDataStatus>(() => ({
    user: null,
    revision: 0,
    source: 'local',
    lastSyncedAt: null,
    error: null,
    syncBlocked: false,
    conflict: null,
  }))
  const [authReady, setAuthReady] = useState(false)
  const [authBusy, setAuthBusy] = useState(false)
  const [syncReady, setSyncReady] = useState(false)
  const revisionRef = useRef(0)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const accountRef = useRef<AccountUser | null>(null)
  const stateRef = useRef(runtime.state)
  const persistenceModeRef = useRef<'guest' | 'account' | 'switching'>('switching')
  const requestEpochRef = useRef(0)
  const syncBlockedRef = useRef(false)
  const conflictRef = useRef<AccountConflict | null>(null)

  useEffect(() => {
    stateRef.current = runtime.state
  }, [runtime.state])

  const activateGuest = useCallback((message: string | null = null) => {
    requestEpochRef.current += 1
    accountRef.current = null
    persistenceModeRef.current = 'guest'
    revisionRef.current = 0
    syncBlockedRef.current = false
    conflictRef.current = null
    const guest = loadState()
    dispatch({
      type: 'hydrate',
      state: guest ? reconcileAbandonedRun(guest) : createInitialState(),
    })
    setUserData({
      user: null,
      revision: 0,
      source: 'local',
      lastSyncedAt: null,
      error: message,
      syncBlocked: false,
      conflict: null,
    })
    setSaveError(message)
  }, [])

  // 启动时只恢复当前会话对应的存档。游客与账号不会比较时间戳后互相覆盖。
  useEffect(() => {
    let cancelled = false

    const boot = async () => {
      try {
        const current = await getCurrentAccount()
        if (cancelled) return
        if (!current) {
          activateGuest()
          setSyncReady(true)
          setAuthReady(true)
          return
        }

        persistenceModeRef.current = 'switching'
        accountRef.current = current
        setUserData((state) => ({ ...state, user: current, error: null }))

        let remote: Awaited<ReturnType<typeof loadRemoteSave>> = null
        let remoteError: string | null = null
        try {
          remote = await loadRemoteSave()
        } catch (error) {
          if (error instanceof AuthenticationRequiredError) throw error
          remoteError =
            error instanceof Error ? error.message : '账号存档读取失败'
        }
        if (cancelled) return

        const remoteState = remote?.state ? parseGameState(remote.state) : null
        const cachedState = loadAccountState(current.id)
        const restored = remoteState ?? cachedState ?? createInitialState()
        const revision = remote?.revision ?? 0
        const restoredState = reconcileAbandonedRun(restored)

        revisionRef.current = revision
        syncBlockedRef.current = false
        conflictRef.current = null
        saveAccountState(current.id, restoredState)
        dispatch({ type: 'hydrate', state: restoredState })
        persistenceModeRef.current = 'account'
        setUserData({
          user: current,
          revision,
          source: remoteState ? 'remote' : 'local',
          lastSyncedAt: remoteState ? Date.now() : null,
          error: remoteError,
          syncBlocked: false,
          conflict: null,
        })
        setSaveError(
          remoteError ? `${remoteError}，当前使用账号本地缓存` : null,
        )
        setSyncReady(true)
        setAuthReady(true)
      } catch (error) {
        if (cancelled) return
        const message =
          error instanceof Error ? error.message : '账号服务暂时不可用'
        activateGuest(`${message}，已进入游客模式`)
        setSyncReady(true)
        setAuthReady(true)
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [activateGuest])

  // 游客只写游客缓存；账号写独立缓存并串行同步到 SQLite。
  useEffect(() => {
    if (!syncReady || persistenceModeRef.current === 'switching') return

    const snapshot = runtime.state
    const mode = persistenceModeRef.current
    const account = mode === 'account' ? accountRef.current : null
    const epoch = requestEpochRef.current
    const localOk =
      mode === 'account' && account
        ? saveAccountState(account.id, snapshot)
        : saveState(snapshot)

    if (localOk) {
      setLastSavedAt(Date.now())
      setSaveError(null)
    } else {
      setSaveError('存档写入失败，请检查浏览器存储权限')
    }

    if (!account) return
    const timer = window.setTimeout(() => {
      if (
        requestEpochRef.current !== epoch ||
        persistenceModeRef.current !== 'account' ||
        accountRef.current?.id !== account.id ||
        syncBlockedRef.current
      ) {
        return
      }

      saveQueueRef.current = saveQueueRef.current
        .then(async () => {
          if (
            requestEpochRef.current !== epoch ||
            persistenceModeRef.current !== 'account' ||
            accountRef.current?.id !== account.id ||
            syncBlockedRef.current
          ) {
            return
          }

          try {
            const result = await saveRemoteState(
              snapshot,
              revisionRef.current,
            )
            if (requestEpochRef.current !== epoch) return
            revisionRef.current = result.revision
            syncBlockedRef.current = false
            conflictRef.current = null
            setUserData((current) => ({
              ...current,
              revision: result.revision,
              source: 'remote',
              lastSyncedAt: Date.now(),
              error: null,
              syncBlocked: false,
              conflict: null,
            }))
            setSaveError(null)
          } catch (error) {
            if (requestEpochRef.current !== epoch) return
            if (error instanceof UserDataConflictError) {
              const conflictState =
                error.state && typeof error.state === 'object'
                  ? parseGameState(error.state)
                  : null
              revisionRef.current = error.revision
              syncBlockedRef.current = true
              conflictRef.current = {
                revision: error.revision,
                state: conflictState,
              }
              const message =
                '本机与云端进度不一致，自动同步已暂停。请选择保留本机或采用云端。'
              setUserData((current) => ({
                ...current,
                revision: error.revision,
                source: 'local',
                error: message,
                syncBlocked: true,
                conflict: conflictRef.current,
              }))
              setSaveError(message)
              return
            }

            if (error instanceof AuthenticationRequiredError) {
              activateGuest('游戏账号登录已失效，请重新登录')
              return
            }

            const message =
              error instanceof Error ? error.message : '用户数据库连接失败'
            setUserData((current) => ({
              ...current,
              source: 'local',
              error: message,
              syncBlocked: false,
              conflict: null,
            }))
            setSaveError(`${message}，当前使用账号本地缓存`)
          }
        })
        .catch((error: unknown) => {
          console.error('[user-data] save queue failed', error)
        })
    }, 320)

    return () => window.clearTimeout(timer)
  }, [runtime.state, syncReady, userData.user?.id, activateGuest])

  const loginWithAccount = useCallback(
    async (username: string, password: string) => {
      if (accountRef.current) return accountRef.current
      const previousMode = persistenceModeRef.current
      const epoch = requestEpochRef.current + 1
      requestEpochRef.current = epoch
      persistenceModeRef.current = 'switching'
      setAuthBusy(true)
      setSaveError(null)

      try {
        const user = await loginGameAccount(username, password)
        let remote: Awaited<ReturnType<typeof loadRemoteSave>> = null
        let remoteError: string | null = null
        try {
          remote = await loadRemoteSave()
        } catch (error) {
          if (error instanceof AuthenticationRequiredError) throw error
          remoteError =
            error instanceof Error ? error.message : '账号存档读取失败'
        }
        if (requestEpochRef.current !== epoch) {
          throw new Error('登录状态已变化，请重试')
        }
        const remoteState = remote?.state ? parseGameState(remote.state) : null
        const cachedState = loadAccountState(user.id)
        const restored = remoteState ?? cachedState ?? createInitialState()
        const revision = remote?.revision ?? 0
        const restoredState = reconcileAbandonedRun(restored)

        accountRef.current = user
        revisionRef.current = revision
        syncBlockedRef.current = false
        conflictRef.current = null
        saveAccountState(user.id, restoredState)
        dispatch({ type: 'hydrate', state: restoredState })
        persistenceModeRef.current = 'account'
        setUserData({
          user,
          revision,
          source: remoteState ? 'remote' : 'local',
          lastSyncedAt: remoteState ? Date.now() : null,
          error: remoteError,
          syncBlocked: false,
          conflict: null,
        })
        setLastSavedAt(Date.now())
        if (remoteError) {
          setSaveError(`${remoteError}，当前使用账号本地缓存`)
        }
        return user
      } catch (error) {
        if (requestEpochRef.current === epoch) {
          persistenceModeRef.current = previousMode
        }
        const message =
          error instanceof Error ? error.message : '登录失败，请稍后重试'
        setSaveError(message)
        throw error
      } finally {
        setAuthBusy(false)
      }
    },
    [],
  )

  const registerWithAccount = useCallback(
    async (username: string, password: string) => {
      if (accountRef.current) return accountRef.current
      const guestSnapshot = reconcileAbandonedRun(stateRef.current)
      const previousMode = persistenceModeRef.current
      const epoch = requestEpochRef.current + 1
      requestEpochRef.current = epoch
      persistenceModeRef.current = 'switching'
      setAuthBusy(true)
      setSaveError(null)

      let user: AccountUser | null = null
      try {
        user = await registerGameAccount(username, password)
        let revision = 0
        let syncMessage: string | null = null
        try {
          const result = await saveRemoteState(guestSnapshot, 0)
          revision = result.revision
        } catch (error) {
          syncMessage =
            error instanceof Error
              ? error.message
              : '游客进度暂时无法同步到账号'
        }
        if (requestEpochRef.current !== epoch) {
          throw new Error('注册状态已变化，请重试')
        }

        accountRef.current = user
        revisionRef.current = revision
        syncBlockedRef.current = false
        conflictRef.current = null
        saveAccountState(user.id, guestSnapshot)
        dispatch({ type: 'hydrate', state: guestSnapshot })
        persistenceModeRef.current = 'account'
        setUserData({
          user,
          revision,
          source: syncMessage ? 'local' : 'remote',
          lastSyncedAt: syncMessage ? null : Date.now(),
          error: syncMessage,
          syncBlocked: false,
          conflict: null,
        })
        setLastSavedAt(Date.now())
        if (syncMessage) setSaveError(`${syncMessage}，已保存在账号本地缓存`)
        return user
      } catch (error) {
        if (!user && requestEpochRef.current === epoch) {
          persistenceModeRef.current = previousMode
        }
        const message =
          error instanceof Error ? error.message : '注册失败，请稍后重试'
        setSaveError(message)
        throw error
      } finally {
        setAuthBusy(false)
      }
    },
    [],
  )

  const logoutFromAccount = useCallback(async () => {
    const current = accountRef.current
    if (!current) {
      activateGuest()
      return
    }
    if (syncBlockedRef.current || conflictRef.current) {
      throw new Error('请先处理本机与云端的存档冲突')
    }

    const mode = persistenceModeRef.current
    setAuthBusy(true)
    persistenceModeRef.current = 'switching'
    try {
      await saveQueueRef.current
      if (!syncBlockedRef.current && mode === 'account') {
        try {
          const result = await saveRemoteState(
            reconcileAbandonedRun(stateRef.current),
            revisionRef.current,
          )
          revisionRef.current = result.revision
        } catch (error) {
          if (error instanceof UserDataConflictError) {
            const conflictState =
              error.state && typeof error.state === 'object'
                ? parseGameState(error.state)
                : null
            const conflict = {
              revision: error.revision,
              state: conflictState,
            }
            revisionRef.current = error.revision
            syncBlockedRef.current = true
            conflictRef.current = conflict
            const message =
              '云端存档刚刚发生变化，尚未退出账号。请先处理存档冲突。'
            setUserData((state) => ({
              ...state,
              revision: error.revision,
              source: 'local',
              error: message,
              syncBlocked: true,
              conflict,
            }))
            setSaveError(message)
            throw new Error(message)
          }
          // 其他云端错误不阻止退出；账号本地缓存仍保留最新进度。
        }
      }
      await logoutGameAccount()
      activateGuest()
    } catch (error) {
      persistenceModeRef.current = mode
      const message =
        error instanceof Error ? error.message : '退出账号失败，请稍后重试'
      setSaveError(message)
      throw error
    } finally {
      setAuthBusy(false)
    }
  }, [activateGuest])

  const resolveAccountConflict = useCallback(
    async (strategy: 'keep-local' | 'use-remote') => {
      const account = accountRef.current
      const conflict = conflictRef.current
      if (!account || !conflict) {
        throw new Error('当前没有待处理的存档冲突')
      }

      setAuthBusy(true)
      setSaveError(null)
      try {
        await saveQueueRef.current

        if (strategy === 'keep-local') {
          const localSnapshot = reconcileAbandonedRun(stateRef.current)
          try {
            const result = await saveRemoteState(
              localSnapshot,
              conflict.revision,
            )
            revisionRef.current = result.revision
          } catch (error) {
            if (error instanceof UserDataConflictError) {
              const latestState =
                error.state && typeof error.state === 'object'
                  ? parseGameState(error.state)
                  : null
              const latestConflict = {
                revision: error.revision,
                state: latestState,
              }
              revisionRef.current = error.revision
              conflictRef.current = latestConflict
              syncBlockedRef.current = true
              const message = '云端又出现了新进度，请重新选择要保留的版本'
              setUserData((current) => ({
                ...current,
                revision: error.revision,
                source: 'local',
                error: message,
                syncBlocked: true,
                conflict: latestConflict,
              }))
              setSaveError(message)
              throw new Error(message)
            }
            throw error
          }

          saveAccountState(account.id, localSnapshot)
          syncBlockedRef.current = false
          conflictRef.current = null
          setUserData((current) => ({
            ...current,
            revision: revisionRef.current,
            source: 'remote',
            lastSyncedAt: Date.now(),
            error: null,
            syncBlocked: false,
            conflict: null,
          }))
          setSaveError(null)
          setLastSavedAt(Date.now())
          return
        }

        const remote = await loadRemoteSave()
        const remoteState = remote?.state ? parseGameState(remote.state) : null
        if ((remote?.revision ?? 0) !== conflict.revision) {
          const latestConflict = {
            revision: remote?.revision ?? 0,
            state: remoteState,
          }
          revisionRef.current = latestConflict.revision
          conflictRef.current = latestConflict
          syncBlockedRef.current = true
          const message = '云端进度在查看期间又有更新，请重新确认'
          setUserData((current) => ({
            ...current,
            revision: latestConflict.revision,
            source: 'local',
            error: message,
            syncBlocked: true,
            conflict: latestConflict,
          }))
          setSaveError(message)
          throw new Error(message)
        }

        const restored = reconcileAbandonedRun(
          remoteState ?? createInitialState(),
        )
        saveAccountState(account.id, restored)
        revisionRef.current = conflict.revision
        conflictRef.current = null
        syncBlockedRef.current = false
        dispatch({ type: 'hydrate', state: restored })
        setUserData((current) => ({
          ...current,
          revision: conflict.revision,
          source: remoteState ? 'remote' : 'local',
          lastSyncedAt: remoteState ? Date.now() : null,
          error: null,
          syncBlocked: false,
          conflict: null,
        }))
        setSaveError(null)
        setLastSavedAt(Date.now())
      } catch (error) {
        const message =
          error instanceof Error ? error.message : '存档冲突处理失败'
        if (!(error instanceof UserDataConflictError)) setSaveError(message)
        throw error instanceof Error ? error : new Error(message)
      } finally {
        setAuthBusy(false)
      }
    },
    [],
  )

  // 体力回复 / 每日任务刷新
  useEffect(() => {
    dispatch({ type: 'tick' })
    const timer = window.setInterval(() => dispatch({ type: 'tick' }), 15_000)
    return () => window.clearInterval(timer)
  }, [])

  const state = runtime.state

  const recoveredRunRewards = state.recoveredRunRewards
  useEffect(() => {
    if (!recoveredRunRewards) return
    const { coins, exp } = recoveredRunRewards
    if (coins > 0 || exp > 0) {
      dispatch({ type: 'reward', reward: { kind: 'coins', amount: coins } })
      dispatch({ type: 'reward', reward: { kind: 'exp', amount: exp }, silent: true })
      dispatch({
        type: 'notice',
        kind: 'reward',
        title: '营业中断结算',
        text: `已保留 +${coins} 金币 · +${exp} 经验`,
      })
    }
    dispatch({ type: 'clearRecoveredRunRewards' })
  }, [recoveredRunRewards])

  const pushNotice = useCallback(
    (kind: NoticeKind, title: string, text?: string) => dispatch({ type: 'notice', kind, title, text }),
    [],
  )

  const dismissNotice = useCallback((id: string) => dispatch({ type: 'dismissNotice', id }), [])

  const actions = useMemo<GameContextValue['actions']>(() => {
    const fail = (message: string): ActionResult => {
      playSfx('error')
      return { ok: false, message }
    }
    const done = (message: string): ActionResult => ({ ok: true, message })

    return {
      resetGame: async () => {
        const account = accountRef.current
        const mode = persistenceModeRef.current
        if (!account || mode !== 'account') {
          clearSave()
          dispatch({ type: 'reset' })
          return
        }
        if (syncBlockedRef.current || conflictRef.current) {
          throw new Error('请先处理本机与云端的存档冲突')
        }

        persistenceModeRef.current = 'switching'
        requestEpochRef.current += 1
        try {
          await saveQueueRef.current
          await deleteRemoteSave(revisionRef.current)
          clearAccountState(account.id)
          revisionRef.current = 0
          syncBlockedRef.current = false
          conflictRef.current = null
          dispatch({ type: 'reset' })
          persistenceModeRef.current = 'account'
          setUserData((current) => ({
            ...current,
            revision: 0,
            source: 'remote',
            lastSyncedAt: Date.now(),
            error: null,
            syncBlocked: false,
            conflict: null,
          }))
          setSaveError(null)
        } catch (error) {
          persistenceModeRef.current = mode
          const conflict =
            error instanceof UserDataConflictError
              ? {
                  revision: error.revision,
                  state:
                    error.state && typeof error.state === 'object'
                      ? parseGameState(error.state)
                      : null,
                }
              : conflictRef.current
          if (conflict) {
            revisionRef.current = conflict.revision
            conflictRef.current = conflict
            syncBlockedRef.current = true
          }
          const message =
            error instanceof UserDataConflictError
              ? '账号存档已在其他设备更新，请选择保留本机或采用云端'
              : error instanceof Error
                ? error.message
                : '账号存档重置失败'
          setUserData((current) => ({
            ...current,
            revision: conflict?.revision ?? current.revision,
            source: 'local',
            error: message,
            syncBlocked: !!conflict || current.syncBlocked,
            conflict,
          }))
          setSaveError(message)
          throw new Error(message)
        }
      },
      registerWithAccount,
      loginWithAccount,
      logoutFromAccount,
      resolveAccountConflict,
      tick: () => dispatch({ type: 'tick' }),
      grantCoins: (amount, silent = false) =>
        dispatch({ type: 'reward', reward: { kind: 'coins', amount }, silent }),
      serveOrder: (coins, exp) => dispatch({ type: 'serveOrder', coins, exp }),
      settleBusiness: (served, total, perfect) =>
        dispatch({ type: 'settleBusiness', served, total, perfect }),
    recordRunRewards: (coins, exp) => dispatch({ type: 'recordRunRewards', coins, exp }),
      beginCafeRun: (runId) => {
        if (state.activeRunId) {
          return fail('已经有一局营业正在进行中')
        }
        if (state.stamina < BUSINESS_STAMINA_COST) {
          const msg = `体力不足，营业需要 ${BUSINESS_STAMINA_COST} 点体力`
          dispatch({ type: 'notice', kind: 'error', title: '体力不足', text: msg })
          return fail(msg)
        }
        dispatch({ type: 'beginCafeRun', runId })
        playSfx('start')
        return done('ok')
      },
      settleCafe: (summary) => {
        dispatch({ type: 'settleCafe', summary })
        return done('ok')
      },

      startBusiness: () => {
        if (state.stamina < BUSINESS_STAMINA_COST) {
          const msg = `体力不足，营业需要 ${BUSINESS_STAMINA_COST} 点体力`
          dispatch({ type: 'notice', kind: 'error', title: '体力不足', text: msg })
          return fail(msg)
        }
        dispatch({ type: 'spendStamina', amount: BUSINESS_STAMINA_COST })
        playSfx('start')
        return done('ok')
      },

      upgradeEquipment: (id) => {
        const level = state.equipment[id] ?? 0
        const def = EQUIPMENT.find((e) => e.id === id)
        if (!def) return fail('找不到该设备')
        if (level >= def.maxLevel) return fail('已经是最高等级了')
        const cost = equipmentCost(id, level + 1)
        if (state.coins < cost) {
          const msg = `金币不足，还差 ${cost - state.coins} 金币`
          dispatch({ type: 'notice', kind: 'error', title: '金币不足', text: msg })
          return fail(msg)
        }
        dispatch({ type: 'upgradeEquipment', id, cost })
        playSfx('unlock')
        return done('ok')
      },

      researchRecipe: (id) => {
        const def = RECIPES.find((r) => r.id === id)
        if (!def) return fail('找不到该配方')
        if (state.recipes.includes(id)) return fail('这款已经研发过了')
        if (state.level < def.unlockLevel) {
          const msg = `需要店铺等级 ${def.unlockLevel} 才能研发`
          dispatch({ type: 'notice', kind: 'error', title: '等级不足', text: msg })
          return fail(msg)
        }
        if (state.coins < def.unlockCost) {
          const msg = `金币不足，还差 ${def.unlockCost - state.coins} 金币`
          dispatch({ type: 'notice', kind: 'error', title: '金币不足', text: msg })
          return fail(msg)
        }
        dispatch({ type: 'researchRecipe', id, cost: def.unlockCost })
        playSfx('unlock')
        return done('ok')
      },

      buyDecor: (id) => {
        const def = DECOR.find((d) => d.id === id)
        if (!def) return fail('找不到该装饰')
        if (state.decor.includes(id)) return fail('已经买过了')
        if (state.level < def.unlockLevel) {
          const msg = `需要店铺等级 ${def.unlockLevel} 才能购买`
          dispatch({ type: 'notice', kind: 'error', title: '等级不足', text: msg })
          return fail(msg)
        }
        if (state.coins < def.cost) {
          const msg = `金币不足，还差 ${def.cost - state.coins} 金币`
          dispatch({ type: 'notice', kind: 'error', title: '金币不足', text: msg })
          return fail(msg)
        }
        dispatch({ type: 'buyDecor', id, cost: def.cost })
        playSfx('sparkle')
        return done('ok')
      },

      petAction: (id) => {
        const def = PET_ACTIONS.find((a) => a.id === id)
        if (!def) return fail('找不到该互动')
        if (state.coins < def.cost) {
          const msg = `金币不足，还差 ${def.cost - state.coins} 金币`
          dispatch({ type: 'notice', kind: 'error', title: '金币不足', text: msg })
          return fail(msg)
        }
        if (state.stamina < def.staminaCost) {
          const msg = '体力不足，先休息一会儿'
          dispatch({ type: 'notice', kind: 'error', title: '体力不足', text: msg })
          return fail(msg)
        }
        const diaryText = def.diary[Math.floor(Math.random() * def.diary.length)]
        dispatch({
          type: 'petAction',
          actionId: def.id,
          cost: def.cost,
          staminaCost: def.staminaCost,
          effects: def.effects,
          diaryText,
          icon: def.icon,
        })
        playPetActionSfx(def.id)
        return done(diaryText)
      },

      advanceStory: () => {
        const chapter = CHAPTERS.find((c) => c.id === state.chapterId)
        if (!chapter) return fail('找不到章节')
        if (state.chapterBeat >= chapter.beats.length) return fail('本章已经读完了')
        const beat = chapter.beats[state.chapterBeat]
        if (beat.type === 'choice') return fail('请先做出选择')
        dispatch({ type: 'advanceStory' })
        playSfx('page')
        return done('ok')
      },

      completeChapter: (skipped = false) => dispatch({ type: 'completeChapter', skipped }),

      selectChapter: (id) => dispatch({ type: 'selectChapter', id }),

      chooseStoryOption: (option) => {
        const chapter = CHAPTERS.find((c) => c.id === state.chapterId)
        if (!chapter) return fail('找不到章节')
        const beat = chapter.beats[state.chapterBeat]
        if (!beat || beat.type !== 'choice') return fail('当前不是选择节点')
        dispatch({
          type: 'chooseStory',
          option,
          chapterId: chapter.id,
          characterId: chapter.characterId,
        })
        playSfx('choice')
        return done('ok')
      },

      advanceStorybook: () => {
        const chapter = STORYBOOK_CHAPTERS.find((c) => c.id === state.storyChapterId)
        if (!chapter) return fail('找不到剧情本章节')
        const branch = getActiveStorybookBranch(state)
        if (!branch) {
          if (state.storyChapterBeat >= chapter.beats.length) return fail('本章已经读完了')
          const beat = chapter.beats[state.storyChapterBeat]
          if (beat.type === 'choice') return fail('请先做出选择')
        }
        dispatch({ type: 'advanceStorybook' })
        playSfx('page')
        return done('ok')
      },

      completeStorybookChapter: (skipped = false) => {
        const chapter = STORYBOOK_CHAPTERS.find((item) => item.id === state.storyChapterId)
        if (!chapter) return fail('找不到剧情本章节')
        if (state.storyCompletedChapters.includes(chapter.id)) {
          return fail('这一章已经完成了')
        }
        if (!storybookChapterAvailable(state, chapter)) {
          return fail('这一章还没有解锁')
        }
        dispatch({ type: 'completeStorybookChapter', skipped })
        playSfx('reward')
        return done('ok')
      },

      selectStorybookChapter: (id) => dispatch({ type: 'selectStorybookChapter', id }),

      selectStoryTrace: (id) => dispatch({ type: 'selectStoryTrace', id }),

      chooseStorybookOption: (option) => {
        const chapter = STORYBOOK_CHAPTERS.find((c) => c.id === state.storyChapterId)
        if (!chapter) return fail('找不到剧情本章节')
        if (state.storyBranchId) return fail('当前正处于剧情分支中')
        const beat = chapter.beats[state.storyChapterBeat]
        if (!beat || beat.type !== 'choice') return fail('当前不是选择节点')
        if (!beat.options.some((item) => item.id === option.id)) {
          return fail('这个选项不属于当前节点')
        }
        dispatch({ type: 'chooseStorybook', option })
        playSfx('choice')
        return done('ok')
      },

      rememberStoryTrace: (trace) => dispatch({ type: 'rememberStoryTrace', trace }),

      cacheGeneratedStory: (key, story) =>
        dispatch({ type: 'cacheGeneratedStory', key, story }),

      claimTask: (id) => {
        const def = TASKS.find((t) => t.id === id)
        const t = state.tasks.find((x) => x.id === id)
        if (!def || !t) return fail('找不到该任务')
        if (t.claimed) return fail('奖励已经领取过了')
        if (t.progress < def.target) return fail('任务还没完成')
        dispatch({ type: 'claimTask', id, coins: def.rewardCoins, exp: def.rewardExp })
        playSfx('coin')
        return done('ok')
      },
    }
  }, [
    state,
    activateGuest,
    loginWithAccount,
    logoutFromAccount,
    registerWithAccount,
    resolveAccountConflict,
  ])

  const value = useMemo<GameContextValue>(
    () => ({
      state,
      notices: runtime.notices,
      lastSavedAt,
      saveError,
      userData,
      authReady,
      authBusy,
      expToNext: expForLevel(state.level),
      charm: state.decor.reduce((sum, id) => sum + (DECOR.find((d) => d.id === id)?.charm ?? 0), 0),
      dismissNotice,
      pushNotice,
      actions,
    }),
    [
      state,
      runtime.notices,
      lastSavedAt,
      saveError,
      userData,
      authReady,
      authBusy,
      dismissNotice,
      pushNotice,
      actions,
    ],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame 必须在 GameProvider 内部使用')
  return ctx
}

export { BUSINESS_STAMINA_COST, SAVE_VERSION }
