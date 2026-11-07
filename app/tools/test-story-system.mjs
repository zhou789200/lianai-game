import assert from 'node:assert/strict'
import http from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'
import {
  createStoryMiddleware,
  generateStory,
  modelStoryToResponse,
  sanitizeGenerationRequest,
} from '../server/story-api.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'story-system-test-'))

await esbuild.build({
  entryPoints: {
    content: path.join(ROOT, 'src', 'data', 'content.ts'),
    dynamicStory: path.join(ROOT, 'src', 'game', 'dynamicStory.ts'),
    story: path.join(ROOT, 'src', 'game', 'story.ts'),
    storyProgression: path.join(ROOT, 'src', 'game', 'storyProgression.ts'),
    storage: path.join(ROOT, 'src', 'game', 'storage.ts'),
  },
  outdir: OUT_DIR,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'silent',
})

const dynamicStory = await import(pathToFileURL(path.join(OUT_DIR, 'dynamicStory.js')).href)
const storyProgression = await import(
  pathToFileURL(path.join(OUT_DIR, 'storyProgression.js')).href
)
const content = await import(pathToFileURL(path.join(OUT_DIR, 'content.js')).href)
const story = await import(pathToFileURL(path.join(OUT_DIR, 'story.js')).href)
const storage = await import(pathToFileURL(path.join(OUT_DIR, 'storage.js')).href)

process.on('exit', () => rmSync(OUT_DIR, { recursive: true, force: true }))

function trace(index, chapterIndex) {
  return {
    id: `trace-${index}`,
    at: 1_790_000_000_000 + index,
    ...(chapterIndex ? { chapterIndex } : {}),
    title: `番外 ${index}`,
    subtitle: '海风经过吧台',
    scene: '傍晚 · 咖啡馆',
    source: index % 2 === 0 ? 'ai' : 'local',
    memoryAnchors: [`锚点 ${index}`],
    clue: `线索 ${index}`,
    choice: `选择 ${index}`,
    outcome: `结果 ${index}`,
  }
}

function generatedStory() {
  return {
    id: 'story-test-1',
    source: 'local',
    degraded: false,
    title: '只给猫点的单',
    subtitle: '没有写进菜单的那一杯',
    scene: '打烊前二十分钟 · 吧台',
    beats: [
      { type: 'narration', text: '布丁把点单卡推到灯下。' },
      { type: 'dialogue', speaker: '顾淮', text: '它今天第二次拦这张单了。' },
      { type: 'narration', text: '门外没有风，风铃却轻轻响了一声。' },
    ],
    choices: [
      {
        id: 'choice-a',
        text: '照着布丁停留的位置做一杯温牛奶',
        reply: '杯子刚放下，风铃就响了。',
        consequence: '顾淮记住了你的判断。',
      },
      {
        id: 'choice-b',
        text: '把点单卡收进抽屉',
        reply: '布丁轻轻叫了一声。',
        consequence: '这张点单卡会成为下一条线索。',
      },
    ],
    memoryAnchors: ['没有落款的点单卡'],
    clue: '点单卡背面有一道蓝色印痕。',
  }
}

test('v1 saves migrate to v3 and receive empty dynamic and static story records', () => {
  const current = storage.createInitialState()
  const legacy = { ...current, version: 1 }
  delete legacy.storyTraces
  delete legacy.storyChoices
  delete legacy.storyTurn
  delete legacy.storyTraceId
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === storage.SAVE_KEY ? JSON.stringify(legacy) : null),
    },
  }

  try {
    const loaded = storage.loadState()
    assert.equal(loaded.version, storage.SAVE_VERSION)
    assert.deepEqual(loaded.storyTraces, [])
    assert.deepEqual(loaded.storyChoices, [])
    assert.equal(loaded.storyTurn, 0)
    assert.equal(loaded.storyTraceId, null)
  } finally {
    delete globalThis.window
  }
})

test('v2 saves receive an empty static story choice list', () => {
  const current = storage.createInitialState()
  const legacy = { ...current, version: 2 }
  delete legacy.storyChoices
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === storage.SAVE_KEY ? JSON.stringify(legacy) : null),
    },
  }

  try {
    const loaded = storage.loadState()
    assert.equal(loaded.version, storage.SAVE_VERSION)
    assert.deepEqual(loaded.storyChoices, [])
  } finally {
    delete globalThis.window
  }
})

test('initial state starts on a static chapter and valid current traces survive loading', () => {
  const current = storage.createInitialState()
  assert.equal(current.storyTraceId, null)

  const first = trace(0)
  const second = trace(1)
  const saved = {
    ...current,
    storyTraces: [second, first],
    storyTurn: 2,
    storyTraceId: first.id,
  }
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === storage.SAVE_KEY ? JSON.stringify(saved) : null),
    },
  }

  try {
    const loaded = storage.loadState()
    assert.equal(loaded.storyTraceId, first.id)
  } finally {
    delete globalThis.window
  }
})

test('loading clears a current trace that no longer exists', () => {
  const current = storage.createInitialState()
  const saved = {
    ...current,
    storyTraces: [trace(0)],
    storyTurn: 1,
    storyTraceId: 'trace-missing',
  }
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === storage.SAVE_KEY ? JSON.stringify(saved) : null),
    },
  }

  try {
    const loaded = storage.loadState()
    assert.equal(loaded.storyTraceId, null)
  } finally {
    delete globalThis.window
  }
})

test('loaded story traces keep the newest 30 valid records', () => {
  const current = storage.createInitialState()
  const saved = {
    ...current,
    storyTraces: Array.from({ length: 35 }, (_, index) => trace(index)),
  }
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === storage.SAVE_KEY ? JSON.stringify(saved) : null),
    },
  }

  try {
    const loaded = storage.loadState()
    assert.equal(loaded.storyTraces.length, 30)
    assert.equal(loaded.storyTraces[0].id, 'trace-0')
    assert.equal(loaded.storyTraces[29].id, 'trace-29')
  } finally {
    delete globalThis.window
  }
})

test('generation requests contain only five structured memories', () => {
  const state = storage.createInitialState()
  state.storyFlags = ['story:blue-seal']
  state.storyTurn = 7
  state.relationships[0] = { ...state.relationships[0], met: true, value: 41 }
  state.storyTraces = Array.from({ length: 7 }, (_, index) => trace(index)).reverse()

  const request = dynamicStory.buildStoryGenerationRequest(state)
  assert.equal(request.memories.length, 5)
  assert.equal(request.memories[0].choice, '选择 6')
  assert.deepEqual(request.storyFlags, ['story:blue-seal'])
  assert.equal(request.relationships[0].value, 41)
  assert.equal(request.storyTurn, 7)
  assert.equal(request.continuity.previousTitle, '番外 6')
  assert.equal(request.continuity.previousScene, '傍晚 · 咖啡馆')
  assert.equal(request.continuity.previousChoice, '选择 6')
  assert.equal(request.continuity.previousOutcome, '结果 6')
  assert.equal(request.continuity.previousClue, '线索 6')
  assert.deepEqual(request.continuity.previousAnchors, ['锚点 6'])
})

test('story traces deduplicate by id and enforce the 30 item cap', () => {
  const first = trace(0)
  const duplicate = { ...first, outcome: '不应覆盖旧结果' }
  const withoutDuplicate = dynamicStory.appendStoryTrace([first], duplicate)
  assert.equal(withoutDuplicate.length, 1)
  assert.equal(withoutDuplicate[0].outcome, first.outcome)

  const existing = Array.from({ length: 30 }, (_, index) => trace(index))
  const appended = dynamicStory.appendStoryTrace(existing, trace(30))
  assert.equal(appended.length, 30)
  assert.equal(appended[0].id, 'trace-30')
  assert.equal(appended[29].id, 'trace-28')
})

test('client validation rejects malformed stories and converts a choice to memory', () => {
  const valid = generatedStory()
  assert.deepEqual(dynamicStory.normalizeGeneratedStory(valid), valid)

  assert.throws(
    () => dynamicStory.normalizeGeneratedStory({ ...valid, choices: valid.choices.slice(0, 1) }),
    /剧情内容不完整/,
  )
  assert.throws(
    () => dynamicStory.normalizeGeneratedStory({ ...valid, beats: valid.beats.slice(0, 2) }),
    /剧情内容不完整/,
  )

  const memory = dynamicStory.storyTraceFromChoice(valid, valid.choices[0], 123)
  assert.equal(memory.id, 'trace_story-test-1')
  assert.equal(memory.at, 123)
  assert.equal(memory.choice, valid.choices[0].text)
  assert.match(memory.outcome, /顾淮记住了你的判断/)
  assert.deepEqual(memory.beats, valid.beats)
  assert.deepEqual(memory.choices, valid.choices)
  assert.equal(memory.selectedChoiceId, 'choice-a')
})

test('dynamic chapters start after static chapters and keep a stable catalog order', () => {
  const state = storage.createInitialState()
  assert.equal(dynamicStory.DYNAMIC_STORY_START_INDEX, 3)
  assert.equal(dynamicStory.nextDynamicStoryChapterIndex(state), 3)

  state.storyTurn = 2
  state.storyTraces = [trace(1), trace(0)]
  assert.equal(dynamicStory.nextDynamicStoryChapterIndex(state), 5)
  assert.deepEqual(
    dynamicStory
      .listDynamicStoryChapters(state)
      .map((chapter) => ({
        id: chapter.trace.id,
        index: chapter.chapterIndex,
      })),
    [
      { id: 'trace-0', index: 3 },
      { id: 'trace-1', index: 4 },
    ],
  )

  const story = generatedStory()
  const firstChapter = dynamicStory.storyTraceFromChoice(
    story,
    story.choices[0],
    456,
    3,
  )
  assert.equal(firstChapter.chapterIndex, 3)
  assert.equal(firstChapter.beats.length, 3)
  assert.equal(firstChapter.choices.length, 2)
})

test('saved dynamic chapters preserve their snapshot and fill missing legacy indexes', () => {
  const current = storage.createInitialState()
  const story = generatedStory()
  const snapshot = dynamicStory.storyTraceFromChoice(story, story.choices[0], 123, 3)
  const saved = {
    ...current,
    storyTurn: 2,
    storyTraces: [trace(1), snapshot],
  }
  globalThis.window = {
    localStorage: {
      getItem: (key) => (key === storage.SAVE_KEY ? JSON.stringify(saved) : null),
    },
  }

  try {
    const loaded = storage.loadState()
    assert.equal(loaded.storyTraces[0].chapterIndex, 4)
    assert.equal(loaded.storyTraces[1].title, '只给猫点的单')
    assert.equal(loaded.storyTraces[1].chapterIndex, 3)
    assert.deepEqual(loaded.storyTraces[1].beats, story.beats)
    assert.deepEqual(loaded.storyTraces[1].choices, story.choices)
    assert.equal(loaded.storyTraces[1].selectedChoiceId, 'choice-a')
    assert.deepEqual(
      dynamicStory
        .listDynamicStoryChapters(loaded)
        .map((chapter) => chapter.chapterIndex),
      [3, 4],
    )
  } finally {
    delete globalThis.window
  }
})

test('choice prefetch starts immediately, carries continuity, and reuses its promise', async () => {
  const state = storage.createInitialState()
  state.storyTurn = 4
  state.storyTraces = [trace(3)]
  const story = generatedStory()
  const nextStory = {
    ...generatedStory(),
    id: 'story-test-2',
    title: '风铃响过之后',
    subtitle: '杯子留在灯下',
    scene: '打烊前十分钟 · 吧台',
  }
  let calls = 0
  let capturedRequest = null
  const fetchImpl = async (_url, init) => {
    calls += 1
    capturedRequest = JSON.parse(String(init.body))
    return new Response(JSON.stringify(nextStory), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const prefetch = dynamicStory.createStoryPrefetch(state, story, story.choices[0], {
    fetchImpl,
  })
  assert.equal(calls, 1)
  assert.equal(prefetch.key, 'story-test-1:choice-a')

  const reused = dynamicStory.reuseStoryPrefetch(
    prefetch,
    state,
    story,
    story.choices[0],
    { fetchImpl },
  )
  assert.strictEqual(reused, prefetch)
  assert.strictEqual(reused.promise, prefetch.promise)
  assert.equal(calls, 1)

  const generated = await reused.promise
  assert.equal(generated.title, '风铃响过之后')
  assert.equal(capturedRequest.storyTurn, 5)
  assert.equal(capturedRequest.continuity.previousChoice, story.choices[0].text)
  assert.equal(
    capturedRequest.continuity.previousOutcome,
    `${story.choices[0].reply} ${story.choices[0].consequence}`,
  )
  assert.equal(capturedRequest.continuity.previousClue, story.clue)
})

test('romance skip applies defaults from the current beat and unlocks what the relationship allows', () => {
  let state = storage.createInitialState()
  const firstChapter = content.CHAPTERS.find((chapter) => chapter.id === 'ch1')
  const secondChapter = content.CHAPTERS.find((chapter) => chapter.id === 'ch2')
  assert.ok(firstChapter)
  assert.ok(secondChapter)

  const firstSkip = storyProgression.skipRomanceChapter(state, firstChapter, 100)
  assert.ok(firstSkip)
  state = storyProgression.applyStoryProgression(state, firstSkip)
  assert.equal(state.chapterBeat, firstChapter.beats.length)
  assert.equal(state.storyChoices.length, 1)
  assert.equal(state.storyChoices[0].optionId, 'ch1-b5-a')
  assert.equal(state.storyChoices[0].skipped, true)
  assert.equal(state.relationships.find((item) => item.id === 'linche').value, 11)
  assert.equal(story.chapterAvailable(state, secondChapter), false)

  const duplicate = storyProgression.applyStoryProgression(state, firstSkip)
  assert.equal(duplicate.storyChoices.length, 1)
  assert.equal(duplicate.relationships.find((item) => item.id === 'linche').value, 11)
  assert.equal(
    duplicate.stats.choicesMade,
    state.stats.choicesMade,
  )
  assert.equal(storyProgression.skipRomanceChapter(state, firstChapter), null)

  state = {
    ...state,
    chapterId: 'ch2',
    chapterBeat: 0,
    completedChapters: ['ch1'],
    relationships: state.relationships.map((item) =>
      item.id === 'linche' ? { ...item, value: 12 } : item,
    ),
  }
  const secondSkip = storyProgression.skipRomanceChapter(state, secondChapter, 200)
  assert.ok(secondSkip)
  state = storyProgression.applyStoryProgression(state, secondSkip)
  assert.deepEqual(
    state.storyChoices
      .filter((record) => record.chapterId === 'ch2')
      .sort((left, right) => left.at - right.at)
      .map((record) => record.optionId),
    ['ch2-b3-a', 'ch2-b5-a'],
  )
  assert.equal(state.relationships.find((item) => item.id === 'linche').value, 30)
})

test('a manual romance choice is preserved and only the remaining nodes use defaults', () => {
  const chapter = content.CHAPTERS.find((item) => item.id === 'ch2')
  assert.ok(chapter)
  let state = {
    ...storage.createInitialState(),
    chapterId: 'ch2',
    chapterBeat: 2,
    completedChapters: ['ch1'],
    relationships: storage
      .createInitialState()
      .relationships.map((item) => (item.id === 'linche' ? { ...item, value: 12 } : item)),
  }
  const manual = storyProgression.applyRomanceChoice(state, chapter, 'ch2-b3-b', false, 300)
  assert.ok(manual)
  state = storyProgression.applyStoryProgression(state, manual)
  const skipped = storyProgression.skipRomanceChapter(state, chapter, 400)
  assert.ok(skipped)
  state = storyProgression.applyStoryProgression(state, skipped)

  assert.equal(state.storyChoices[0].optionId, 'ch2-b5-a')
  assert.equal(state.storyChoices[1].optionId, 'ch2-b3-b')
  assert.equal(state.storyChoices[1].skipped, false)
  assert.equal(state.relationships.find((item) => item.id === 'linche').value, 33)
})

test('storybook skip follows the default branch and settles each reward once', () => {
  let state = {
    ...storage.createInitialState(),
    storyChapterId: 'sb2',
    storyChapterBeat: 0,
    storyCompletedChapters: ['sb1'],
  }
  const chapter = content.STORYBOOK_CHAPTERS.find((item) => item.id === 'sb2')
  assert.ok(chapter)
  const initialCoins = state.coins
  const initialExp = state.exp

  const skipped = storyProgression.skipStorybookChapter(state, chapter, 500)
  assert.ok(skipped)
  state = storyProgression.applyStoryProgression(state, skipped)
  assert.equal(state.storyChapterBeat, chapter.beats.length)
  assert.equal(state.storyBranchId, null)
  assert.equal(state.storyBranchBeat, 0)
  assert.deepEqual(
    state.storyChoices.map((record) => record.optionId),
    ['sb2-b3-a'],
  )
  assert.ok(state.storyFlags.includes('story:knocked-on-door'))
  assert.deepEqual(skipped.rewards, [{ kind: 'exp', amount: 10 }])
  assert.equal(state.coins, initialCoins)
  assert.equal(state.exp, initialExp)
  assert.equal(state.tasks.find((task) => task.id === 'story_step').progress, 1)

  const duplicate = storyProgression.applyStoryProgression(state, skipped)
  assert.equal(duplicate.storyChoices.length, 1)
  assert.equal(duplicate.coins, state.coins)
  assert.equal(duplicate.exp, state.exp)
  assert.equal(
    duplicate.tasks.find((task) => task.id === 'story_step').progress,
    state.tasks.find((task) => task.id === 'story_step').progress,
  )
  assert.equal(storyProgression.skipStorybookChapter(state, chapter), null)
})

test('rechoosing a recorded storybook option enters its branch without duplicate rewards', () => {
  const chapter = content.STORYBOOK_CHAPTERS.find((item) => item.id === 'sb2')
  assert.ok(chapter)
  let state = {
    ...storage.createInitialState(),
    storyChapterId: 'sb2',
    storyCompletedChapters: ['sb1'],
  }
  const skipped = storyProgression.skipStorybookChapter(state, chapter, 500)
  assert.ok(skipped)
  state = storyProgression.applyStoryProgression(state, skipped)

  // 跳过后回到本章开头重读时，选项仍保留在历史里。
  state = {
    ...state,
    storyChapterBeat: 2,
    storyBranchId: null,
    storyBranchBeat: 0,
  }
  const expBefore = state.exp
  const choicesBefore = state.storyChoices.length
  const madeBefore = state.stats.choicesMade
  const taskBefore = state.tasks.find((task) => task.id === 'story_step').progress

  const replay = storyProgression.applyStorybookChoice(
    state,
    chapter,
    'sb2-b3-a',
    false,
    600,
  )
  assert.ok(replay)
  state = storyProgression.applyStoryProgression(state, replay)

  assert.equal(state.storyChapterBeat, 2)
  assert.equal(state.storyBranchId, 'sb2-door')
  assert.equal(state.storyBranchBeat, 0)
  assert.equal(state.storyChoices.length, choicesBefore)
  assert.equal(state.exp, expBefore)
  assert.equal(state.stats.choicesMade, madeBefore)
  assert.equal(
    state.tasks.find((task) => task.id === 'story_step').progress,
    taskBefore,
  )
})

test('static story choices are sent as structured continuity memories', () => {
  const state = storage.createInitialState()
  state.storyChoices = [
    {
      id: 'storybook:sb1:sb1-b3',
      at: 600,
      source: 'storybook',
      chapterId: 'sb1',
      chapterTitle: '灯塔旧信',
      scene: '清晨六点 · 海堤尽头',
      beatId: 'sb1-b3',
      prompt: '这封信该怎么处理？',
      optionId: 'sb1-b3-a',
      optionText: '先送回邮局查地址',
      reply: '阿岚把信夹进防水袋。',
      skipped: true,
      storyFlags: ['story:letter-to-post'],
    },
  ]

  const request = dynamicStory.buildStoryGenerationRequest(state)
  assert.equal(request.memories.length, 1)
  assert.equal(request.memories[0].title, '《灯塔旧信》')
  assert.equal(request.memories[0].choice, '先送回邮局查地址')
  assert.equal(request.memories[0].outcome, '阿岚把信夹进防水袋。')
  assert.ok(request.memories[0].memoryAnchors.includes('这封信该怎么处理？'))
  assert.match(request.memories[0].clue, /story:letter-to-post/)
  assert.equal(request.continuity.previousTitle, '《灯塔旧信》')
  assert.equal(request.continuity.previousScene, '清晨六点 · 海堤尽头')
})

test('client serves a local next page when the story API is unavailable', async () => {
  const state = storage.createInitialState()
  state.pet.name = '团子'
  state.storyTraces = [trace(1)]
  state.storyTurn = 1

  const story = await dynamicStory.fetchGeneratedStory(state, {
    fetchImpl: async () => new Response('not found', { status: 404 }),
  })

  assert.equal(story.source, 'local')
  assert.equal(story.degraded, true)
  assert.equal(story.beats.length, 4)
  assert.equal(story.choices.length, 2)
  assert.equal(story.title, '雨伞上的旧车票')
  assert.match(story.beats[2].text, /番外 1/)
  assert.match(story.beats[2].text, /团子/)
  assert.doesNotMatch(story.clue, /旁边，多了一道今天才出现的水痕/)
})

test('local fallback advances to a different page on the next story turn', () => {
  const state = storage.createInitialState()
  state.storyTraces = [trace(0)]
  state.storyTurn = 1

  const first = dynamicStory.createLocalStoryFallback(state, 100)
  state.storyTraces = [trace(1), ...state.storyTraces]
  state.storyTurn += 1
  const second = dynamicStory.createLocalStoryFallback(state, 200)

  assert.notEqual(first.id, second.id)
  assert.notEqual(first.title, second.title)
  assert.notEqual(first.clue, second.clue)
  assert.doesNotMatch(second.clue, new RegExp(first.clue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
})

test('local fallback keeps the first 24 chapters distinct', () => {
  const state = storage.createInitialState()
  const stories = Array.from({ length: 24 }, (_, storyTurn) => {
    state.storyTurn = storyTurn
    state.storyTraces = storyTurn > 0 ? [trace(storyTurn - 1)] : []
    return dynamicStory.createLocalStoryFallback(state, 1_790_100_000_000 + storyTurn)
  })

  assert.equal(new Set(stories.map((story) => story.title)).size, 24)
  assert.equal(new Set(stories.map((story) => story.beats[0].text)).size, 24)
  assert.equal(new Set(stories.map((story) => story.clue)).size, 24)
  assert.equal(stories[23].title, '雨停前最后一桌')
  assert.equal(stories[23].source, 'local')
})

test('server sanitizes oversized input and rejects non-object bodies', () => {
  const long = '海'.repeat(400)
  const request = sanitizeGenerationRequest({
    playerName: long,
    shopName: long,
    petName: long,
    storyFlags: Array.from({ length: 30 }, (_, index) => `${index}-${long}`),
    relationships: Array.from({ length: 9 }, (_, index) => ({
      name: `${index}-${long}`,
      role: long,
      value: 500,
    })),
    memories: Array.from({ length: 9 }, (_, index) => ({
      title: `${index}-${long}`,
      memoryAnchors: [long, long, long, long],
      clue: long,
      choice: long,
      outcome: long,
    })),
    continuity: {
      previousTitle: long,
      previousScene: long,
      previousChoice: long,
      previousOutcome: long,
      previousClue: long,
      previousAnchors: [long, long, long, long],
    },
  })

  assert.equal(request.playerName.length, 20)
  assert.equal(request.shopName.length, 32)
  assert.equal(request.petName.length, 16)
  assert.equal(request.storyFlags.length, 20)
  assert.equal(request.relationships.length, 4)
  assert.equal(request.relationships[0].value, 100)
  assert.equal(request.memories.length, 5)
  assert.equal(request.memories[0].memoryAnchors.length, 3)
  assert.equal(request.memories[0].outcome.length, 160)
  assert.equal(request.continuity.previousTitle.length, 36)
  assert.equal(request.continuity.previousScene.length, 48)
  assert.equal(request.continuity.previousChoice.length, 100)
  assert.equal(request.continuity.previousOutcome.length, 160)
  assert.equal(request.continuity.previousClue.length, 120)
  assert.equal(request.continuity.previousAnchors.length, 3)

  assert.throws(() => sanitizeGenerationRequest(null), (error) => error.status === 400)
  assert.throws(() => sanitizeGenerationRequest('not-json'), (error) => error.status === 400)
})

test('server falls back locally without a key and after model failure', async () => {
  const body = {
    playerName: '店长',
    shopName: '海风镇宠物咖啡馆',
    petName: '布丁',
    memories: [],
  }

  const local = await generateStory(body, { apiKey: '' })
  assert.equal(local.source, 'local')
  assert.equal(local.degraded, false)
  assert.equal(local.choices.length, 2)
  assert.equal(local.title, '只给猫点的单')

  const nextLocal = await generateStory({ ...body, storyTurn: 1 }, { apiKey: '' })
  assert.equal(nextLocal.source, 'local')
  assert.notEqual(nextLocal.title, local.title)
  assert.notEqual(nextLocal.clue, local.clue)

  const degraded = await generateStory(body, {
    apiKey: 'test-key',
    fetchImpl: async () => new Response('upstream error', { status: 503 }),
  })
  assert.equal(degraded.source, 'local')
  assert.equal(degraded.degraded, true)
  assert.equal(degraded.choices.length, 2)
})

test('server sends a compatible chat completion request and accepts model JSON', async () => {
  const modelStory = {
    ...generatedStory(),
    beats: ['布丁把点单卡推到灯下。', '林澈低头看了看那张卡。', '门外传来一声很轻的铃响。'],
    choices: ['照着布丁停留的位置做一杯温牛奶', '把点单卡先收进抽屉'],
  }
  delete modelStory.id
  delete modelStory.source
  delete modelStory.degraded
  let capturedUrl = ''
  let capturedBody = null

  const story = await generateStory(
    {
      playerName: '店长',
      shopName: '海风镇宠物咖啡馆',
      petName: '布丁',
      storyTurn: 23,
      memories: [trace(23)],
      continuity: {
        previousTitle: trace(23).title,
        previousScene: trace(23).scene,
        previousChoice: trace(23).choice,
        previousOutcome: trace(23).outcome,
        previousClue: trace(23).clue,
        previousAnchors: trace(23).memoryAnchors,
      },
    },
    {
      apiKey: 'test-key',
      baseUrl: 'https://llm.example',
      model: 'glm-test',
      fetchImpl: async (url, init) => {
        capturedUrl = String(url)
        capturedBody = JSON.parse(String(init.body))
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: JSON.stringify(modelStory) } }],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      },
    },
  )

  assert.equal(capturedUrl, 'https://llm.example/v1/chat/completions')
  assert.equal(capturedBody.model, 'glm-test')
  assert.equal(capturedBody.response_format.type, 'json_object')
  assert.equal(capturedBody.messages[0].role, 'system')
  assert.match(capturedBody.messages[0].content, /上一幕的紧接后续/)
  assert.match(capturedBody.messages[1].content, /选择 23/)
  assert.equal(story.source, 'ai')
  assert.equal(story.degraded, false)
  assert.equal(story.title, modelStory.title)
  assert.equal(story.beats[0].type, 'narration')
  assert.match(story.choices[0].reply, /布丁/)
  assert.ok(story.choices[0].consequence)
})

test('server normalizes string-encoded story fields and partial choices', () => {
  const story = modelStoryToResponse({
    title: '旧伞立在门边',
    subtitle: '雨停之前',
    scene: '傍晚 · 门廊',
    beats: JSON.stringify([
      '布丁绕着旧伞走了一圈。',
      { type: 'dialogue', speaker: '林澈', content: '这把伞不是店里的。' },
      { type: 'narration', line: '伞尖慢慢积起一小圈水。' },
    ]),
    choices: JSON.stringify([
      { text: '先把伞收起来', consequence: '门边空出了一小块地方。' },
      { label: '等失主回来', result: '你把伞留在了门边。' },
    ]),
    memoryAnchors: '旧伞、门廊水痕',
    clue: '伞柄上系着一根褪色红线。',
  })

  assert.equal(story.source, 'ai')
  assert.equal(story.beats.length, 3)
  assert.equal(story.beats[1].type, 'dialogue')
  assert.equal(story.beats[1].speaker, '林澈')
  assert.equal(story.choices.length, 2)
  assert.equal(story.choices[0].text, '先把伞收起来')
  assert.ok(story.choices[0].reply)
  assert.equal(story.choices[1].text, '等失主回来')
  assert.equal(story.choices[1].reply, '你把伞留在了门边。')
  assert.deepEqual(story.memoryAnchors, ['旧伞', '门廊水痕'])
})

async function withStoryServer(run) {
  const middleware = createStoryMiddleware()
  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.end('not found')
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  try {
    return await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
}

test('middleware rejects wrong methods and invalid JSON, then serves the local draft', async () => {
  const previousKey = process.env.OPENAI_API_KEY
  delete process.env.OPENAI_API_KEY

  try {
    await withStoryServer(async (baseUrl) => {
      const getResponse = await fetch(`${baseUrl}/api/story/generate`)
      assert.equal(getResponse.status, 405)

      const invalidResponse = await fetch(`${baseUrl}/api/story/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{broken',
      })
      assert.equal(invalidResponse.status, 400)

      const response = await fetch(`${baseUrl}/api/story/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: '店长', petName: '布丁', memories: [] }),
      })
      assert.equal(response.status, 200)
      const story = await response.json()
      assert.equal(story.source, 'local')
      assert.equal(story.title, '只给猫点的单')
      assert.equal(story.choices.length, 2)
    })
  } finally {
    if (previousKey === undefined) delete process.env.OPENAI_API_KEY
    else process.env.OPENAI_API_KEY = previousKey
  }
})
