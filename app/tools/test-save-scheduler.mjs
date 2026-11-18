/**
 * 存档节流调度器回归测试。
 *
 * Run: npm test  (tools/test-save-scheduler.mjs)
 *
 * 节流最怕两类 bug：连续修改被丢最后一笔、卸载时没落盘。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'save-scheduler-test-'))

await esbuild.build({
  entryPoints: {
    saveScheduler: path.join(ROOT, 'src', 'game', 'saveScheduler.ts'),
  },
  outdir: OUT_DIR,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'silent',
})

const { createSaveScheduler } = await import(
  pathToFileURL(path.join(OUT_DIR, 'saveScheduler.js')).href
)

/** 可控时钟：记录所有 setTimeout，手动推进 */
function fakeClock() {
  let nextId = 1
  const timers = new Map()
  return {
    setTimer(fn, ms) {
      const id = nextId++
      timers.set(id, { fn, ms })
      return id
    },
    clearTimer(id) {
      timers.delete(id)
    },
    /** 触发全部到期计时器（这里只有一层，直接全部执行） */
    runAll() {
      const due = [...timers.entries()]
      timers.clear()
      for (const [, { fn }] of due) fn()
    },
    pending: () => timers.size,
  }
}

test('writes once after the delay even if state changes repeatedly', () => {
  const clock = fakeClock()
  let writes = 0
  const scheduler = createSaveScheduler(() => writes++, 400, clock.setTimer, clock.clearTimer)

  scheduler.schedule()
  scheduler.schedule()
  scheduler.schedule()
  assert.equal(writes, 0, '延迟期间不应写盘')
  assert.equal(clock.pending(), 1, '连续修改只保留一个计时器')

  clock.runAll()
  assert.equal(writes, 1, '合并后的多次修改只写一次')
})

test('flush writes immediately and cancels the pending timer', () => {
  const clock = fakeClock()
  let writes = 0
  const scheduler = createSaveScheduler(() => writes++, 400, clock.setTimer, clock.clearTimer)

  scheduler.schedule()
  scheduler.flush()
  assert.equal(writes, 1, 'flush 必须立刻落盘')
  assert.equal(clock.pending(), 0, 'flush 后不应再有待执行计时器')

  clock.runAll()
  assert.equal(writes, 1, '计时器已取消，不应重复写')
})

test('flush without changes does not write', () => {
  const clock = fakeClock()
  let writes = 0
  const scheduler = createSaveScheduler(() => writes++, 400, clock.setTimer, clock.clearTimer)

  scheduler.flush()
  assert.equal(writes, 0)
})

test('a change after flush schedules a new write', () => {
  const clock = fakeClock()
  let writes = 0
  const scheduler = createSaveScheduler(() => writes++, 400, clock.setTimer, clock.clearTimer)

  scheduler.schedule()
  scheduler.flush()
  scheduler.schedule()
  clock.runAll()
  assert.equal(writes, 2)
})

test('cancel drops pending changes', () => {
  const clock = fakeClock()
  let writes = 0
  const scheduler = createSaveScheduler(() => writes++, 400, clock.setTimer, clock.clearTimer)

  scheduler.schedule()
  scheduler.cancel()
  clock.runAll()
  assert.equal(writes, 0)
})
