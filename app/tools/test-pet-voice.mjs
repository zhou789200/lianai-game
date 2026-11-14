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

const { nextMeowKind } = await import(pathToFileURL(OUT_FILE).href)

process.on('exit', () => rmSync(OUT_DIR, { recursive: true, force: true }))

const ALL_KINDS = [
  'bright',
  'chirp',
  'double',
  'soft',
  'trill',
  'question',
  'longcall',
  'grumpy',
]

// 注意顺序：第一条依赖「洗牌袋初始为空」，后一条只做不变量校验。
test('every kind shows up once per round of eight draws', () => {
  const firstRound = Array.from({ length: ALL_KINDS.length }, () => nextMeowKind())
  assert.deepEqual([...firstRound].sort(), [...ALL_KINDS].sort(), '第一轮应覆盖全部语气')

  const secondRound = Array.from({ length: ALL_KINDS.length }, () => nextMeowKind())
  assert.deepEqual([...secondRound].sort(), [...ALL_KINDS].sort(), '第二轮同样应覆盖全部语气')
})

test('consecutive meows never repeat the same kind', () => {
  let previous = nextMeowKind()
  for (let i = 0; i < 200; i += 1) {
    const next = nextMeowKind()
    assert.notEqual(next, previous, `第 ${i} 次取到连续重复的 ${next}`)
    previous = next
  }
})
