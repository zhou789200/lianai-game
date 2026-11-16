import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const music = await readFile(new URL('../src/game/homeBgm.ts', import.meta.url), 'utf8')

test('background music belongs to the game root and follows the cafe run', () => {
  assert.match(app, /const release = startHomeBgm\(\)/)
  assert.match(app, /setBackgroundMusicContext\(inRun \? 'cafe' : 'home'\)/)
  assert.match(music, /id: 'afternoon-cafe'/)
  assert.match(music, /context: 'cafe'/)
})

test('music changes retain mobile audio unlock and cancel stale switch timers', () => {
  assert.match(music, /const canResume = audioUnlocked/)
  assert.match(music, /if \(canResume && session\) handleUserGesture\(\)/)
  assert.match(music, /if \(switchTimer !== null\) window.clearTimeout\(switchTimer\)/)
})
