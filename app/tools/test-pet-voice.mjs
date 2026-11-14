/**
 * 猫叫语气轮转的单元测试。
 *
 * Run: npm test  (tools/test-pet-voice.mjs)
 *
 * 只测「选哪种叫法」的纯逻辑；真实合成需要 Web Audio，在浏览器里由 E2E 覆盖。
 * petVoice 通过 esbuild 从 TS 源码载入，不新增依赖。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'pet-voice-test-'))
const OUT_FILE = path.join(OUT_DIR, 'petVoice.mjs')

await esbuild.build({
  entryPoints: [path.join(ROOT, 'src', 'game', 'petVoice.ts')],
  outfile: OUT_FILE,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'silent',
})

const { nextMeowKind, CARE_MEOWS } = await import(pathToFileURL(OUT_FILE).href)

process.on('exit', () => rmSync(OUT_DIR, { recursive: true, force: true }))

/** 参与随机轮转的 8 种「喵」 */
const ROTATION_KINDS = [
  'bright',
  'chirp',
  'double',
  'soft',
  'trill',
  'question',
  'longcall',
  'grumpy',
]

/** 加上不参与轮转的呼噜，构成全部可用音色 */
const ALL_KINDS = [...ROTATION_KINDS, 'purr']

// 注意顺序：第一条依赖「洗牌袋初始为空」，后一条只做不变量校验。
test('every kind shows up once per round of eight draws', () => {
  const firstRound = Array.from({ length: ROTATION_KINDS.length }, () => nextMeowKind())
  assert.deepEqual([...firstRound].sort(), [...ROTATION_KINDS].sort(), '第一轮应覆盖全部语气')

  const secondRound = Array.from({ length: ROTATION_KINDS.length }, () => nextMeowKind())
  assert.deepEqual([...secondRound].sort(), [...ROTATION_KINDS].sort(), '第二轮同样应覆盖全部语气')
})

test('consecutive meows never repeat the same kind', () => {
  let previous = nextMeowKind()
  for (let i = 0; i < 200; i += 1) {
    const next = nextMeowKind()
    assert.notEqual(next, previous, `第 ${i} 次取到连续重复的 ${next}`)
    previous = next
  }
})

test('the random rotation never picks the purr', () => {
  for (let i = 0; i < 50; i += 1) {
    assert.notEqual(nextMeowKind(), 'purr', '呼噜只该由梳毛这类动作触发')
  }
})

test('the four care actions each use a different meow', () => {
  assert.deepEqual(Object.keys(CARE_MEOWS).sort(), ['feed', 'groom', 'photo', 'play'])

  const kinds = Object.values(CARE_MEOWS)
  assert.equal(new Set(kinds).size, kinds.length, '喂食/玩耍/梳毛/拍照 不能共用同一种叫声')
  for (const kind of kinds) {
    assert.ok(ALL_KINDS.includes(kind), `${kind} 不是已定义的语气`)
  }
  assert.equal(CARE_MEOWS.groom, 'purr', '梳毛应该是打呼噜，不是喵')
})
