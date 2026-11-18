/**
 * 稳定绘制模式（low-power）判定回归测试。
 *
 * Run: npm test  (tools/test-low-power.mjs)
 *
 * 重点防止两类回归：
 *  1. ColorOS 等厂商浏览器（UA 谎报高版本 Chrome）必须降级；
 *  2. 现代旗舰 Android（Chrome 110+、内存充足）不能被误降级。
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import esbuild from 'esbuild'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = mkdtempSync(path.join(tmpdir(), 'low-power-test-'))

await esbuild.build({
  entryPoints: {
    lowPower: path.join(ROOT, 'src', 'game', 'lowPower.ts'),
  },
  outdir: OUT_DIR,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  logLevel: 'silent',
})

const lowPower = await import(pathToFileURL(path.join(OUT_DIR, 'lowPower.js')).href)

const { shouldUseLowPower } = lowPower

// 真机 OPPO PEMT00（Android 13 / ColorOS 浏览器）的 UA 特征：
// 上报 Chrome/115，但实际仍使用旧合成器。
const colorOS =
  'Mozilla/5.0 (Linux; U; Android 13; zh-cn; PEMT00 Build/TP1A.220905.001) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/115.0.5790.168 Mobile Safari/537.36 HeyTapBrowser/40.10.6.9'
const flagship =
  'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.163 Mobile Safari/537.36'
const desktopChrome =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

test('vendor browsers stay in stable mode even when UA claims a new Chrome', () => {
  assert.equal(
    shouldUseLowPower({ userAgent: colorOS, deviceMemory: 8, hardwareConcurrency: 8 }),
    true,
  )
})

test('modern flagship Android with Chrome 110+ keeps full effects', () => {
  assert.equal(
    shouldUseLowPower({ userAgent: flagship, deviceMemory: 8, hardwareConcurrency: 8 }),
    false,
  )
})

test('desktop browsers are never downgraded by the Android rules', () => {
  assert.equal(
    shouldUseLowPower({ userAgent: desktopChrome, deviceMemory: 8, hardwareConcurrency: 8 }),
    false,
  )
})

test('low memory or very few cores still downgrades', () => {
  assert.equal(
    shouldUseLowPower({ userAgent: flagship, deviceMemory: 2, hardwareConcurrency: 8 }),
    true,
  )
  assert.equal(
    shouldUseLowPower({ userAgent: flagship, deviceMemory: 8, hardwareConcurrency: 2 }),
    true,
  )
})

test('old chromium on a 4GB Android device downgrades', () => {
  const oldChrome =
    'Mozilla/5.0 (Linux; Android 12; Pixel 4a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.5195.136 Mobile Safari/537.36'
  assert.equal(
    shouldUseLowPower({ userAgent: oldChrome, deviceMemory: 4, hardwareConcurrency: 8 }),
    true,
  )
})

test('old chromium on a large-memory device is not downgraded', () => {
  const oldChrome =
    'Mozilla/5.0 (Linux; Android 12; Pixel 4a) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/105.0.5195.136 Mobile Safari/537.36'
  assert.equal(
    shouldUseLowPower({ userAgent: oldChrome, deviceMemory: 12, hardwareConcurrency: 8 }),
    false,
  )
})

test('legacy webview (wv + old chromium) downgrades', () => {
  const webview =
    'Mozilla/5.0 (Linux; Android 9; MI 8 Build/PQ3A.190705.08211506; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/74.0.3729.136 Mobile Safari/537.36'
  assert.equal(
    shouldUseLowPower({ userAgent: webview, deviceMemory: 4, hardwareConcurrency: 8 }),
    true,
  )
})

test('unknown signals fall back to full effects', () => {
  assert.equal(
    shouldUseLowPower({ userAgent: flagship, deviceMemory: undefined, hardwareConcurrency: undefined }),
    false,
  )
})

process.once('exit', () => rmSync(OUT_DIR, { recursive: true, force: true }))
