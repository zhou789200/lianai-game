import type {
  GameState,
  GeneratedStory,
  GeneratedStoryBeat,
  GeneratedStoryChoice,
  StoryCacheEntry,
  StorybookChapterDef,
  StoryTrace,
} from './types'
import { buildLocalStory } from '../../shared/localStoryBank.mjs'
import { STORYBOOK_CHAPTERS } from '../data/content'

export const STORY_GENERATE_ENDPOINT = './api/story/generate'
export const STORY_CACHE_LIMIT = 6
export const DYNAMIC_STORY_START_INDEX =
  Math.max(0, ...STORYBOOK_CHAPTERS.map((chapter: StorybookChapterDef) => chapter.index)) + 1

export interface DynamicStoryChapter {
  trace: StoryTrace
  chapterIndex: number
}

export interface StoryGenerationRequest {
  storySeed: string
  playerName: string
  shopName: string
  petName: string
  storyTurn: number
  storyFlags: string[]
  relationships: Array<{
    name: string
    role: string
    value: number
  }>
  memories: Array<{
    title: string
    memoryAnchors: string[]
    clue?: string
    choice: string
    outcome: string
  }>
  continuity: {
    previousTitle: string
    previousScene: string
    previousChoice: string
    previousOutcome: string
    previousClue: string
    previousAnchors: string[]
  } | null
}

interface StoryMemory {
  at: number
  title: string
  scene: string
  memoryAnchors: string[]
  clue?: string
  choice: string
  outcome: string
}

interface FetchStoryOptions {
  signal?: AbortSignal
  fetchImpl?: typeof fetch
}

export interface StoryPrefetch {
  key: string
  cacheKey: string
  promise: Promise<GeneratedStory>
  abort: () => void
}

interface StoryPrefetchOptions {
  fetchImpl?: typeof fetch
}

function hashString(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}

function cleanStorySeed(value: unknown): string {
  return cleanText(value, 80)
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return ''
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => cleanText(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems)
}

function cleanChapterIndex(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  const index = Math.trunc(value)
  return index > 0 && index <= 999 ? index : undefined
}

export function nextDynamicStoryChapterIndex(
  state: Pick<GameState, 'storyTurn'>,
): number {
  return Math.min(
    999,
    DYNAMIC_STORY_START_INDEX + Math.max(0, Math.trunc(state.storyTurn || 0)),
  )
}

/**
 * Dynamic chapters are stored newest-first for generation context. The catalog
 * presents them oldest-first and assigns indexes to legacy traces that predate
 * the chapterIndex field.
 */
export function listDynamicStoryChapters(
  state: Pick<GameState, 'storyTraces' | 'storyTurn'>,
): DynamicStoryChapter[] {
  const traces = [...state.storyTraces].sort((a, b) => a.at - b.at)
  const archivedOffset = Math.max(0, state.storyTurn - traces.length)
  return traces.map((trace, position) => ({
    trace,
    chapterIndex:
      cleanChapterIndex(trace.chapterIndex) ??
      DYNAMIC_STORY_START_INDEX + archivedOffset + position,
  }))
}

function buildStoryMemories(state: GameState): StoryMemory[] {
  const dynamicMemories = state.storyTraces.map((trace) => ({
    at: trace.at,
    title: cleanText(trace.title, 36),
    scene: cleanText(trace.scene, 48),
    memoryAnchors: cleanStringArray(trace.memoryAnchors, 3, 64),
    clue: cleanText(trace.clue, 120),
    choice: cleanText(trace.choice, 100),
    outcome: cleanText(trace.outcome, 160),
  }))
  const staticMemories = (state.storyChoices ?? []).map((record) => {
    const storyFlags = cleanStringArray(record.storyFlags, 3, 64)
    return {
      at: record.at,
      title: `《${cleanText(record.chapterTitle, 34)}》`,
      scene: cleanText(record.scene, 48),
      memoryAnchors: cleanStringArray(
        [record.scene, record.prompt],
        3,
        64,
      ),
      clue: storyFlags.length ? `剧情印记：${storyFlags.join('、')}` : '',
      choice: cleanText(record.optionText, 100),
      outcome: cleanText(record.reply, 160),
    }
  })

  return [...dynamicMemories, ...staticMemories]
    .filter(
      (memory) =>
        memory.title &&
        memory.choice &&
        memory.outcome &&
        Number.isFinite(memory.at),
    )
    .sort((left, right) => right.at - left.at)
    .slice(0, 5)
}

export function buildStoryGenerationRequest(state: GameState): StoryGenerationRequest {
  const allMemories = buildStoryMemories(state)
  const memories = allMemories.map((memory) => ({
    title: memory.title,
    memoryAnchors: memory.memoryAnchors,
    ...(memory.clue ? { clue: memory.clue } : {}),
    choice: memory.choice,
    outcome: memory.outcome,
  }))
  const latest = memories[0]
  const latestMemory = allMemories[0]

  return {
    storySeed: cleanStorySeed(state.storySeed) || 'legacy',
    playerName: cleanText(state.playerName, 20) || '店长',
    shopName: cleanText(state.shopName, 32) || '海风镇宠物咖啡馆',
    petName: cleanText(state.pet.name, 16) || '布丁',
    storyTurn: Math.max(0, Math.min(999, Math.trunc(state.storyTurn || 0))),
    storyFlags: state.storyFlags.map((flag) => cleanText(flag, 64)).filter(Boolean).slice(0, 20),
    relationships: state.relationships
      .filter((relationship) => relationship.met || relationship.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map((relationship) => ({
        name: cleanText(relationship.name, 24),
        role: cleanText(relationship.role, 32),
        value: Math.max(0, Math.min(100, relationship.value)),
      }))
      .filter((relationship) => relationship.name),
    memories,
    continuity: latest
      ? {
          previousTitle: latest.title,
          previousScene: latestMemory?.scene ?? '',
          previousChoice: latest.choice,
          previousOutcome: latest.outcome,
          previousClue: latest.clue ?? '',
          previousAnchors: latest.memoryAnchors,
        }
      : null,
  }
}

/**
 * The key deliberately includes the complete request context, not only the
 * turn. This prevents a stale cache entry from leaking into a different
 * branch or a different save that happens to be on the same chapter number.
 */
export function storyCacheKey(state: GameState): string {
  const request = buildStoryGenerationRequest(state)
  return `story_${hashString(JSON.stringify(request))}`
}

function normalizeBeat(value: unknown): GeneratedStoryBeat | null {
  if (!isRecord(value)) return null
  const type = value.type === 'dialogue' ? 'dialogue' : value.type === 'narration' ? 'narration' : null
  const text = cleanText(value.text, 220)
  if (!type || !text) return null
  if (type === 'narration') return { type, text }

  const speaker = cleanText(value.speaker, 20)
  if (!speaker) return null
  return { type, speaker, text }
}

function normalizeChoice(value: unknown, index: number): GeneratedStoryChoice | null {
  if (!isRecord(value)) return null
  const id = cleanText(value.id, 32) || (index === 0 ? 'choice-a' : 'choice-b')
  const text = cleanText(value.text, 100)
  const reply = cleanText(value.reply, 240)
  const consequence = cleanText(value.consequence, 180)
  if (!text || !reply || !consequence) return null
  return { id, text, reply, consequence }
}

function normalizeStoryCacheEntry(value: unknown): StoryCacheEntry | null {
  if (!isRecord(value) || typeof value.key !== 'string') return null
  const key = cleanText(value.key, 100)
  if (!key) return null
  try {
    return {
      key,
      at:
        typeof value.at === 'number' && Number.isFinite(value.at)
          ? value.at
          : 0,
      story: normalizeGeneratedStory(value.story),
    }
  } catch {
    return null
  }
}

export function normalizeStoryCache(value: unknown): StoryCacheEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const entries: StoryCacheEntry[] = []
  for (const item of value) {
    const entry = normalizeStoryCacheEntry(item)
    if (!entry || seen.has(entry.key)) continue
    seen.add(entry.key)
    entries.push(entry)
    if (entries.length >= STORY_CACHE_LIMIT) break
  }
  return entries
}

export function findCachedGeneratedStory(state: GameState): GeneratedStory | null {
  const key = storyCacheKey(state)
  const entry = state.storyCache.find((item) => item.key === key)
  if (!entry) return null
  try {
    return normalizeGeneratedStory(entry.story)
  } catch {
    return null
  }
}

export function upsertStoryCache(
  value: unknown,
  key: string,
  story: GeneratedStory,
  at = Date.now(),
): StoryCacheEntry[] {
  const normalizedKey = cleanText(key, 100)
  if (!normalizedKey) return normalizeStoryCache(value)
  try {
    const normalizedStory = normalizeGeneratedStory(story)
    const existing = normalizeStoryCache(value)
    return [
      { key: normalizedKey, at, story: normalizedStory },
      ...existing.filter((entry) => entry.key !== normalizedKey),
    ].slice(0, STORY_CACHE_LIMIT)
  } catch {
    return normalizeStoryCache(value)
  }
}

/**
 * Browser-side defense in depth. The server already enforces the schema, but
 * generated text is still untrusted input and must not reach the save unchecked.
 */
export function normalizeGeneratedStory(value: unknown): GeneratedStory {
  if (!isRecord(value)) throw new Error('剧情返回格式不正确')

  const id = cleanText(value.id, 64)
  const source = value.source === 'ai' ? 'ai' : value.source === 'local' ? 'local' : null
  const title = cleanText(value.title, 36)
  const subtitle = cleanText(value.subtitle, 48)
  const scene = cleanText(value.scene, 48)
  const clue = cleanText(value.clue, 140)
  const memoryAnchors = cleanStringArray(value.memoryAnchors, 3, 64)
  const beats = Array.isArray(value.beats)
    ? value.beats.map(normalizeBeat).filter((beat): beat is GeneratedStoryBeat => beat !== null)
    : []
  const choices = Array.isArray(value.choices)
    ? value.choices
        .slice(0, 2)
        .map(normalizeChoice)
        .filter((choice): choice is GeneratedStoryChoice => choice !== null)
    : []
  const choiceIds = new Set(choices.map((choice) => choice.id))

  if (
    !id ||
    !source ||
    !title ||
    !subtitle ||
    !scene ||
    !clue ||
    beats.length < 3 ||
    beats.length > 5 ||
    choices.length !== 2 ||
    choiceIds.size !== choices.length ||
    memoryAnchors.length < 1
  ) {
    throw new Error('剧情内容不完整，请再写一页')
  }

  return {
    id,
    source,
    degraded: value.degraded === true,
    title,
    subtitle,
    scene,
    beats,
    choices,
    memoryAnchors,
    clue,
  }
}

export function normalizeStoryTrace(
  value: unknown,
  fallbackChapterIndex?: number,
): StoryTrace | null {
  if (!isRecord(value)) return null

  const id = cleanText(value.id, 64)
  const title = cleanText(value.title, 36)
  const subtitle = cleanText(value.subtitle, 48)
  const scene = cleanText(value.scene, 48)
  const source =
    value.source === 'ai' ? 'ai' : value.source === 'local' ? 'local' : null
  const choice = cleanText(value.choice, 100)
  const outcome = cleanText(value.outcome, 320)
  const memoryAnchors = cleanStringArray(value.memoryAnchors, 3, 64)
  const clue = cleanText(value.clue, 140)
  const chapterIndex =
    cleanChapterIndex(value.chapterIndex) ?? cleanChapterIndex(fallbackChapterIndex)
  const beats = Array.isArray(value.beats)
    ? value.beats
        .map(normalizeBeat)
        .filter((beat): beat is GeneratedStoryBeat => beat !== null)
        .slice(0, 5)
    : []
  const choices = Array.isArray(value.choices)
    ? value.choices
        .slice(0, 2)
        .map(normalizeChoice)
        .filter((item): item is GeneratedStoryChoice => item !== null)
    : []
  const selectedChoiceId = cleanText(value.selectedChoiceId, 32)

  if (
    !id ||
    typeof value.at !== 'number' ||
    !Number.isFinite(value.at) ||
    !title ||
    !subtitle ||
    !scene ||
    !source ||
    !memoryAnchors.length ||
    !choice ||
    !outcome
  ) {
    return null
  }

  return {
    id,
    at: value.at,
    ...(chapterIndex ? { chapterIndex } : {}),
    title,
    subtitle,
    scene,
    source,
    memoryAnchors,
    ...(clue ? { clue } : {}),
    choice,
    outcome,
    ...(beats.length ? { beats } : {}),
    ...(choices.length === 2 ? { choices } : {}),
    ...(selectedChoiceId ? { selectedChoiceId } : {}),
  }
}

/**
 * Keep the story playable when a dev server is stale or the API is briefly
 * unavailable. This deliberately uses the same shape as a server response so
 * the player never sees a broken page or an implementation-level error.
 */
export function createLocalStoryFallback(
  state: GameState,
  at = Date.now(),
): GeneratedStory {
  const request = buildStoryGenerationRequest(state)
  return buildLocalStory(
    {
      petName: state.pet.name,
      storyTurn: state.storyTurn,
      storySeed: request.storySeed,
      memories: request.memories,
    },
    true,
    at,
  )
}

export async function fetchGeneratedStory(
  state: GameState,
  options: FetchStoryOptions = {},
): Promise<GeneratedStory> {
  const cached = findCachedGeneratedStory(state)
  if (cached) return cached

  try {
    const requestFetch = options.fetchImpl ?? fetch
    const response = await requestFetch(STORY_GENERATE_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildStoryGenerationRequest(state)),
      signal: options.signal,
    })

    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.error === 'string'
          ? cleanText(payload.error, 80)
          : '剧情生成暂时不可用'
      throw new Error(message || '剧情生成暂时不可用')
    }

    return normalizeGeneratedStory(payload)
  } catch (error) {
    if (options.signal?.aborted) throw error
    return createLocalStoryFallback(state)
  }
}

export function storyTraceFromChoice(
  story: GeneratedStory,
  choice: GeneratedStoryChoice,
  at = Date.now(),
  chapterIndex?: number,
): StoryTrace {
  const outcome = [choice.reply, choice.consequence].filter(Boolean).join(' ')
  return {
    id: `trace_${story.id}`,
    at,
    ...(cleanChapterIndex(chapterIndex) ? { chapterIndex } : {}),
    title: story.title,
    subtitle: story.subtitle,
    scene: story.scene,
    source: story.source,
    memoryAnchors: story.memoryAnchors.slice(0, 3),
    clue: story.clue,
    choice: choice.text,
    outcome: outcome.slice(0, 320),
    beats: story.beats.map((beat) => ({ ...beat })),
    choices: story.choices.map((item) => ({ ...item })),
    selectedChoiceId: choice.id,
  }
}

export function appendStoryTrace(
  traces: StoryTrace[],
  trace: StoryTrace,
  maxItems = 30,
): StoryTrace[] {
  if (traces.some((item) => item.id === trace.id)) return traces
  return [trace, ...traces].slice(0, maxItems)
}

export function prepareContinuationState(
  state: GameState,
  story: GeneratedStory,
  choice: GeneratedStoryChoice,
  at = Date.now(),
): GameState {
  const trace = storyTraceFromChoice(story, choice, at)
  const alreadyRecorded = state.storyTraces.some((item) => item.id === trace.id)
  return {
    ...state,
    storyTraces: alreadyRecorded
      ? state.storyTraces
      : appendStoryTrace(state.storyTraces, trace),
    storyTurn: alreadyRecorded ? state.storyTurn : state.storyTurn + 1,
  }
}

export function prefetchStoryAfterChoice(
  state: GameState,
  story: GeneratedStory,
  choice: GeneratedStoryChoice,
  options: FetchStoryOptions = {},
): Promise<GeneratedStory> {
  return fetchGeneratedStory(prepareContinuationState(state, story, choice), options)
}

export function storyPrefetchKey(
  story: GeneratedStory,
  choice: GeneratedStoryChoice,
): string {
  return `${story.id}:${choice.id}`
}

export function createStoryPrefetch(
  state: GameState,
  story: GeneratedStory,
  choice: GeneratedStoryChoice,
  options: StoryPrefetchOptions = {},
): StoryPrefetch {
  const controller = new AbortController()
  const continuationState = prepareContinuationState(state, story, choice)
  const cacheKey = storyCacheKey(continuationState)
  const promise = fetchGeneratedStory(continuationState, {
    fetchImpl: options.fetchImpl,
    signal: controller.signal,
  })

  // The cache can be discarded before the player reaches the next page.
  // Mark the request as handled while still letting an active reader await it.
  void promise.catch(() => undefined)

  return {
    key: storyPrefetchKey(story, choice),
    cacheKey,
    promise,
    abort: () => controller.abort(),
  }
}

export function reuseStoryPrefetch(
  current: StoryPrefetch | null,
  state: GameState,
  story: GeneratedStory,
  choice: GeneratedStoryChoice,
  options: StoryPrefetchOptions = {},
): StoryPrefetch {
  const key = storyPrefetchKey(story, choice)
  if (current?.key === key) return current

  current?.abort()
  return createStoryPrefetch(state, story, choice, options)
}
