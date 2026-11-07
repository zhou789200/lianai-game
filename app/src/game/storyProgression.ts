import { TASKS } from '../data/content'
import type {
  ChapterDef,
  GameState,
  Reward,
  StoryChoice,
  StoryChoiceRecord,
  StoryOption,
  StorybookChapterDef,
} from './types'

export const STORY_CHOICE_LIMIT = 30

export interface StoryProgressionResult {
  chapterBeat: number
  storyChapterBeat: number
  storyBranchId: string | null
  storyBranchBeat: number
  choicesMade: number
  records: StoryChoiceRecord[]
  relationshipChanges: Array<{ characterId: string; delta: number }>
  rewards: Reward[]
  storyFlags: string[]
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function cleanFlags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map((flag) => cleanText(flag, 64)).filter(Boolean))].slice(0, 20)
}

function emptyProgression(state: Pick<
  GameState,
  'chapterBeat' | 'storyChapterBeat' | 'storyBranchId' | 'storyBranchBeat'
>): StoryProgressionResult {
  return {
    chapterBeat: state.chapterBeat,
    storyChapterBeat: state.storyChapterBeat,
    storyBranchId: state.storyBranchId,
    storyBranchBeat: state.storyBranchBeat,
    choicesMade: 0,
    records: [],
    relationshipChanges: [],
    rewards: [],
    storyFlags: [],
  }
}

function addReward(result: StoryProgressionResult, reward: Reward): void {
  if (!Number.isFinite(reward.amount) || reward.amount === 0) return
  result.rewards.push({ ...reward, amount: Math.trunc(reward.amount) })
}

function addRelationship(result: StoryProgressionResult, characterId: string, delta: number): void {
  if (!Number.isFinite(delta) || delta === 0) return
  const existing = result.relationshipChanges.find((item) => item.characterId === characterId)
  if (existing) {
    existing.delta += Math.trunc(delta)
  } else {
    result.relationshipChanges.push({ characterId, delta: Math.trunc(delta) })
  }
}

export function storyChoiceKey(
  record: Pick<StoryChoiceRecord, 'source' | 'chapterId' | 'beatId'>,
): string {
  return `${record.source}:${record.chapterId}:${record.beatId}`
}

export function pendingStoryChoices(
  state: Pick<GameState, 'storyChoices'>,
  progression: StoryProgressionResult,
): StoryChoiceRecord[] {
  const existingKeys = new Set((state.storyChoices ?? []).map(storyChoiceKey))
  const records: StoryChoiceRecord[] = []

  for (const record of progression.records) {
    const key = storyChoiceKey(record)
    if (existingKeys.has(key)) continue
    existingKeys.add(key)
    records.push(record)
  }
  return records
}

export function normalizeStoryChoice(value: unknown): StoryChoiceRecord | null {
  if (!isRecord(value)) return null
  const source =
    value.source === 'romance' ? 'romance' : value.source === 'storybook' ? 'storybook' : null
  const chapterId = cleanText(value.chapterId, 64)
  const chapterTitle = cleanText(value.chapterTitle, 48)
  const scene = cleanText(value.scene, 64)
  const beatId = cleanText(value.beatId, 64)
  const prompt = cleanText(value.prompt, 160)
  const optionId = cleanText(value.optionId, 64)
  const optionText = cleanText(value.optionText, 120)
  const reply = cleanText(value.reply, 240)
  const at = typeof value.at === 'number' && Number.isFinite(value.at) ? value.at : 0
  if (!source || !chapterId || !chapterTitle || !beatId || !optionId || !optionText || !at) {
    return null
  }

  const characterId = cleanText(value.characterId, 64)
  const branchId = cleanText(value.branchId, 64)
  const storyFlags = cleanFlags(value.storyFlags)
  return {
    id:
      cleanText(value.id, 96) ||
      `${source}:${chapterId}:${beatId}`,
    at,
    source,
    chapterId,
    chapterTitle,
    scene,
    beatId,
    prompt,
    optionId,
    optionText,
    reply,
    skipped: value.skipped === true,
    ...(characterId ? { characterId } : {}),
    ...(branchId ? { branchId } : {}),
    ...(storyFlags.length ? { storyFlags } : {}),
  }
}

export function appendStoryChoice(
  choices: StoryChoiceRecord[],
  choice: StoryChoiceRecord,
  maxItems = STORY_CHOICE_LIMIT,
): StoryChoiceRecord[] {
  const key = storyChoiceKey(choice)
  if (choices.some((item) => item.id === choice.id || storyChoiceKey(item) === key)) {
    return choices
  }
  return [choice, ...choices].slice(0, maxItems)
}

export function normalizeStoryChoices(
  value: unknown,
  maxItems = STORY_CHOICE_LIMIT,
): StoryChoiceRecord[] {
  if (!Array.isArray(value)) return []
  const normalized: StoryChoiceRecord[] = []
  const keys = new Set<string>()
  for (const item of value) {
    const record = normalizeStoryChoice(item)
    if (!record) continue
    const key = storyChoiceKey(record)
    if (keys.has(key)) continue
    keys.add(key)
    normalized.push(record)
    if (normalized.length >= maxItems) break
  }
  return normalized
}

function choiceRecord(
  source: StoryChoiceRecord['source'],
  chapter: Pick<ChapterDef, 'id' | 'title' | 'scene'> & { characterId?: string },
  beat: StoryChoice,
  option: StoryOption,
  skipped: boolean,
  at: number,
  storyFlags?: string[],
): StoryChoiceRecord {
  return {
    id: `${source}:${chapter.id}:${beat.id}`,
    at,
    source,
    chapterId: chapter.id,
    chapterTitle: chapter.title,
    scene: chapter.scene,
    beatId: beat.id,
    prompt: beat.prompt,
    optionId: option.id,
    optionText: option.text,
    reply: option.reply,
    skipped,
    ...(chapter.characterId ? { characterId: chapter.characterId } : {}),
    ...(option.branch?.id ? { branchId: option.branch.id } : {}),
    ...(storyFlags?.length ? { storyFlags } : {}),
  }
}

export function applyRomanceChoice(
  state: GameState,
  chapter: ChapterDef,
  optionId: string,
  skipped: boolean,
  at = Date.now(),
): StoryProgressionResult | null {
  if (state.chapterId !== chapter.id) return null
  const beat = chapter.beats[state.chapterBeat]
  if (!beat || beat.type !== 'choice') return null
  const option = beat.options.find((item) => item.id === optionId)
  if (!option) return null

  const result = emptyProgression(state)
  result.chapterBeat = state.chapterBeat + 1
  result.choicesMade = 1
  addRelationship(result, chapter.characterId, option.effects.relationship ?? 0)
  result.records.push(choiceRecord('romance', chapter, beat, option, skipped, at))
  return result
}

export function skipRomanceChapter(
  state: GameState,
  chapter: ChapterDef,
  at = Date.now(),
): StoryProgressionResult | null {
  if (state.chapterId !== chapter.id) return null
  if (state.completedChapters.includes(chapter.id)) return null
  const result = emptyProgression(state)
  let recordOffset = 0

  while (result.chapterBeat < chapter.beats.length) {
    const beat = chapter.beats[result.chapterBeat]
    if (beat.type !== 'choice') {
      result.chapterBeat += 1
      continue
    }
    const option = beat.options[0]
    if (!option) return null
    addRelationship(result, chapter.characterId, option.effects.relationship ?? 0)
    result.choicesMade += 1
    result.records.push(
      choiceRecord('romance', chapter, beat, option, true, at + recordOffset++),
    )
    result.chapterBeat += 1
  }

  return result.records.length ? result : null
}

function findBranch(
  chapter: StorybookChapterDef,
  branchId: string | null,
) {
  if (!branchId) return undefined
  for (const beat of chapter.beats) {
    if (beat.type !== 'choice') continue
    const option = beat.options.find((item) => item.branch?.id === branchId)
    if (option?.branch) return option.branch
  }
  return undefined
}

function applyStorybookEffects(
  result: StoryProgressionResult,
  option: StoryOption,
): void {
  const effects = option.effects
  if (effects.coins) addReward(result, { kind: 'coins', amount: effects.coins })
  if (effects.exp) addReward(result, { kind: 'exp', amount: effects.exp })
  if (effects.petIntimacy) {
    addReward(result, { kind: 'petIntimacy', amount: effects.petIntimacy })
  }
  if (effects.petMood) {
    addReward(result, { kind: 'petMood', amount: effects.petMood })
  }
  if (effects.storyFlags?.length) {
    result.storyFlags = [...new Set([...result.storyFlags, ...effects.storyFlags])]
  }
}

export function applyStorybookChoice(
  state: GameState,
  chapter: StorybookChapterDef,
  optionId: string,
  skipped: boolean,
  at = Date.now(),
): StoryProgressionResult | null {
  if (state.storyChapterId !== chapter.id || state.storyBranchId) return null
  const beat = chapter.beats[state.storyChapterBeat]
  if (!beat || beat.type !== 'choice') return null
  const option = beat.options.find((item) => item.id === optionId)
  if (!option) return null

  const result = emptyProgression(state)
  result.choicesMade = 1
  result.storyChapterBeat = option.branch ? state.storyChapterBeat : state.storyChapterBeat + 1
  result.storyBranchId = option.branch?.id ?? null
  result.storyBranchBeat = 0
  applyStorybookEffects(result, option)
  result.records.push(
    choiceRecord(
      'storybook',
      chapter,
      beat,
      option,
      skipped,
      at,
      option.effects.storyFlags,
    ),
  )
  return result
}

export function skipStorybookChapter(
  state: GameState,
  chapter: StorybookChapterDef,
  at = Date.now(),
): StoryProgressionResult | null {
  if (state.storyChapterId !== chapter.id) return null
  if (state.storyCompletedChapters.includes(chapter.id)) return null
  const result = emptyProgression(state)
  let recordOffset = 0

  while (true) {
    if (result.storyBranchId) {
      const branch = findBranch(chapter, result.storyBranchId)
      if (!branch) return null
      if (result.storyBranchBeat + 1 < branch.beats.length) {
        result.storyBranchBeat += 1
      } else {
        result.storyBranchId = null
        result.storyBranchBeat = 0
        result.storyChapterBeat += 1
      }
      continue
    }

    if (result.storyChapterBeat >= chapter.beats.length) break
    const beat = chapter.beats[result.storyChapterBeat]
    if (beat.type !== 'choice') {
      result.storyChapterBeat += 1
      continue
    }

    const option = beat.options[0]
    if (!option) return null
    result.choicesMade += 1
    applyStorybookEffects(result, option)
    result.records.push(
      choiceRecord(
        'storybook',
        chapter,
        beat,
        option,
        true,
        at + recordOffset++,
        option.effects.storyFlags,
      ),
    )
    if (option.branch) {
      result.storyBranchId = option.branch.id
      result.storyBranchBeat = 0
    } else {
      result.storyChapterBeat += 1
    }
  }

  return result.records.length ? result : null
}

function bumpStoryTask(
  tasks: GameState['tasks'],
  amount: number,
): GameState['tasks'] {
  const definition = TASKS.find((task) => task.id === 'story_step')
  if (!definition || amount <= 0) return tasks
  return tasks.map((task) =>
    task.id === 'story_step'
      ? { ...task, progress: Math.min(definition.target, task.progress + amount) }
      : task,
  )
}

/** 写入不涉及经验升级结算的剧情状态；奖励由 reducer 再统一结算。 */
export function applyStoryProgression(
  state: GameState,
  progression: StoryProgressionResult,
): GameState {
  const existingChoices = state.storyChoices ?? []
  const newRecords = pendingStoryChoices(state, progression)
  let storyChoices = existingChoices
  for (const record of newRecords) {
    storyChoices = appendStoryChoice(storyChoices, record)
  }
  const appliedChoices = newRecords.length
  const appliedFlags = progression.storyFlags
  const moved =
    state.chapterBeat !== progression.chapterBeat ||
    state.storyChapterBeat !== progression.storyChapterBeat ||
    state.storyBranchId !== progression.storyBranchId ||
    state.storyBranchBeat !== progression.storyBranchBeat
  const gainedFlags = appliedFlags.some((flag) => !state.storyFlags.includes(flag))

  // 已记录过的选择再次被点击时仍需推进当前阅读位置，只是不再重复结算。
  if (!appliedChoices && !moved && !gainedFlags) return state

  return {
    ...state,
    chapterBeat: progression.chapterBeat,
    storyChapterBeat: progression.storyChapterBeat,
    storyBranchId: progression.storyBranchId,
    storyBranchBeat: progression.storyBranchBeat,
    storyChoices,
    storyFlags: [...new Set([...state.storyFlags, ...appliedFlags])],
    stats: {
      ...state.stats,
      choicesMade: state.stats.choicesMade + appliedChoices,
    },
    tasks: bumpStoryTask(state.tasks, appliedChoices),
    relationships: appliedChoices
      ? state.relationships.map((relationship) => {
          const change = progression.relationshipChanges.find(
            (item) => item.characterId === relationship.id,
          )
          return change
            ? {
                ...relationship,
                met: true,
                value: clamp(relationship.value + change.delta),
              }
            : relationship
        })
      : state.relationships,
    updatedAt: Date.now(),
  }
}
