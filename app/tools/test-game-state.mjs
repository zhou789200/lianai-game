/**
 * 体力数值域与存档边界的单元测试。
 *
 * Run: npm test  (tools/test-game-state.mjs)
 *
 * 领域代码是 TypeScript，这里用 Vite 自带的那份 esbuild 打包后按 ESM 载入，
 * 不引入新依赖，也不改动打包产物。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'game-state-test-'))

await esbuild.build({
  entryPoints: {
    content: path.join(ROOT, 'src', 'data', 'content.ts'),
    stamina: path.join(ROOT, 'src', 'game', 'stamina.ts'),
    storage: path.join(ROOT, 'src', 'game', 'storage.ts'),
  },
  outdir: OUT_DIR,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'silent',
})

const content = await import(pathToFileURL(path.join(OUT_DIR, 'content.js')).href)
const stamina = await import(pathToFileURL(path.join(OUT_DIR, 'stamina.js')).href)
const storage = await import(pathToFileURL(path.join(OUT_DIR, 'storage.js')).href)

process.on('exit', () => rmSync(OUT_DIR, { recursive: true, force: true }))

const REGEN_MS = storage.STAMINA_REGEN_MS

function fullState(now = 1_790_000_000_000) {
  return { ...storage.createInitialState(), staminaRegenAt: now, updatedAt: now }
}

/* ---------------- 体力：扣减 ---------------- */

test('spending stamina from a full bar restarts the regen clock', () => {
  const now = 1_790_000_000_000
  const state = fullState(now)

  // 满体力待了两小时，期间计时起点一直是两小时前
  const stale = { ...state, staminaRegenAt: now - 2 * 60 * 60 * 1000 }
  const spent = stamina.spendStamina(stale, storage.BUSINESS_STAMINA_COST, now)

  assert.equal(spent.stamina, state.staminaMax - storage.BUSINESS_STAMINA_COST)
  assert.equal(spent.staminaRegenAt, now, '扣体力后计时起点必须重置')

  // 结算这一步：立刻 tick 不应该把两小时折算成体力补回来
  const regen = stamina.regenerateStamina(spent, now + 1_000)
  assert.equal(regen, null, '刚扣完体力不应立刻回满')
  assert.equal(spent.stamina, state.staminaMax - storage.BUSINESS_STAMINA_COST)
})

test('spending stamina while not full keeps the accumulated progress', () => {
  const now = 1_790_000_000_000
  const state = { ...fullState(now), stamina: 8, staminaRegenAt: now - REGEN_MS / 2 }

  const spent = stamina.spendStamina(state, 2, now)
  assert.equal(spent.stamina, 6)
  assert.equal(spent.staminaRegenAt, now - REGEN_MS / 2)
})

test('spending never drops stamina below zero', () => {
  const now = 1_790_000_000_000
  const state = { ...fullState(now), stamina: 1 }
  assert.equal(stamina.spendStamina(state, 4, now).stamina, 0)
})

/* ---------------- 体力：回复 ---------------- */

test('regeneration converts elapsed time into stamina points', () => {
  const now = 1_790_000_000_000
  const state = { ...fullState(now), stamina: 6, staminaRegenAt: now }

  const one = stamina.regenerateStamina(state, now + REGEN_MS)
  assert.equal(one.stamina, 7)
  assert.equal(one.staminaRegenAt, now + REGEN_MS)

  // 不足一个周期不回复，也不推进计时起点
  assert.equal(stamina.regenerateStamina(state, now + REGEN_MS - 1), null)
})

test('regeneration stops at the maximum and reports no change when full', () => {
  const now = 1_790_000_000_000
  const nearlyFull = { ...fullState(now), stamina: 11, staminaRegenAt: now }
  const capped = stamina.regenerateStamina(nearlyFull, now + REGEN_MS * 10)
  assert.equal(capped.stamina, nearlyFull.staminaMax)

  const full = fullState(now)
  assert.equal(stamina.regenerateStamina(full, now + REGEN_MS * 10), null)
})

test('regeneration ignores a regen clock that sits in the future', () => {
  const now = 1_790_000_000_000
  const state = { ...fullState(now), stamina: 3, staminaRegenAt: now + 60_000 }
  assert.equal(stamina.regenerateStamina(state, now), null)
})

/* ---------------- 存档：中断恢复 ---------------- */

test('abandoned run refunds stamina once and never pays out rewards', () => {
  const base = storage.createInitialState()
  const running = {
    ...base,
    stamina: base.stamina - storage.BUSINESS_STAMINA_COST,
    activeRunId: 'run-abandoned',
    pendingRunRewards: { coins: 180, exp: 40 },
  }

  const recovered = storage.reconcileAbandonedRun(running)
  assert.equal(recovered.activeRunId, null)
  assert.equal(recovered.stamina, base.stamina)
  assert.equal(recovered.pendingRunRewards, null)
  assert.equal(recovered.recoveredRunRewards, null, '中断的中营业不应结转收益')
  assert.equal(recovered.coins, base.coins)
  assert.equal(recovered.stats.coinsEarned, base.stats.coinsEarned)

  // 再次进入首页不应该重复退还体力
  const again = storage.reconcileAbandonedRun(recovered)
  assert.equal(again.stamina, base.stamina)
})

/* ---------------- 存档：边界收敛 ---------------- */

test('save normalization clamps corrupt and out-of-range values', () => {
  const now = Date.now()
  const dirty = {
    ...storage.createInitialState(),
    coins: Number.NaN,
    stamina: 999,
    staminaMax: 12,
    staminaRegenAt: now + 86_400_000,
    chapterBeat: -5,
    pet: { ...storage.createInitialState().pet, mood: 1e9 },
    stats: { businessRuns: Number.NaN, ordersServed: -3 },
  }

  const parsed = storage.parseGameState(dirty)
  assert.ok(parsed, '畸形存档应被收敛而不是整份判废')
  assert.equal(parsed.coins, 0)
  assert.equal(parsed.stamina, 12)
  assert.equal(parsed.chapterBeat, 0)
  assert.ok(parsed.staminaRegenAt <= Date.now(), '回复起点不应落在未来')
  assert.equal(parsed.pet.mood, 100)
  assert.equal(parsed.stats.businessRuns, 0)
  assert.equal(parsed.stats.ordersServed, 0)
  assert.equal(parsed.stats.coinsEarned, 0)
})

test('chapter beat is clamped to the chapter length', () => {
  const base = storage.createInitialState()
  const parsed = storage.parseGameState({ ...base, chapterBeat: 9999 })
  const chapter = content.CHAPTERS.find((item) => item.id === parsed.chapterId)
  assert.equal(parsed.chapterBeat, chapter.beats.length)
})

test('unknown chapter id falls back to the first chapter', () => {
  const base = storage.createInitialState()
  const parsed = storage.parseGameState({ ...base, chapterId: 'chapter-removed', chapterBeat: 2 })
  assert.equal(parsed.chapterId, content.CHAPTERS[0].id)
  assert.equal(parsed.chapterBeat, 2)
})

test('save without chapterBeat is recovered instead of discarded', () => {
  const base = storage.createInitialState()
  const legacy = { ...base, version: 1 }
  delete legacy.chapterBeat

  const parsed = storage.parseGameState(legacy)
  assert.ok(parsed, '缺 chapterBeat 的旧档应补 0，而不是整份丢弃')
  assert.equal(parsed.chapterBeat, 0)
  assert.equal(parsed.version, storage.SAVE_VERSION)
})
