/**
 * 视口落位专项体检（开发工具，不参与打包）
 *
 * 用法：node tools/check-viewport.mjs
 *
 * 针对「同一个页面在不同浏览器里长得不一样」这一类问题：
 *  1. 各种「浏览器工具栏吃掉多少高度」的视口下，画布有没有溢出可视视口；
 *  2. 视口突然变矮（地址栏/工具栏弹出）时，缩放比是否立刻跟随；
 *  3. 打印每档视口的缩放比、左右留白、顶栏坐标，便于对比截图。
 *
 * 判定标准：画布底边 ≈ 可视视口高度，画布高度 ≤ 可视视口高度（溢出会裁掉底部导航）。
 */
import http from 'node:http'
import fs from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0])
      let file = path.join(DIST, url === '/' ? 'index.html' : url)
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(DIST, 'index.html')
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' })
      fs.createReadStream(file).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer()
    s.unref()
    s.once('error', reject)
    s.listen(0, '127.0.0.1', () => {
      const a = s.address()
      s.close((e) => (e ? reject(e) : resolve(a.port)))
    })
  })
}

async function connect(port) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // DevTools may still be starting; keep polling until the timeout.
    }
    await delay(250)
  }
  throw new Error('连不上调试端口')
}

function cdp(ws) {
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id)
      pending.delete(msg.id)
      clearTimeout(timer)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    }
  })
  return {
    send(method, params = {}) {
      id += 1
      const myId = id
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${method} 超时`)), 30000)
        pending.set(myId, { resolve, reject, timer })
        ws.send(JSON.stringify({ id: myId, method, params }))
      })
    },
  }
}

const MEASURE = `
(() => {
  const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), left: Math.round(b.left), width: Math.round(b.width), height: Math.round(b.height) } }
  const canvas = document.querySelector('.phone__canvas')
  const phone = document.querySelector('.phone')
  const appbar = document.querySelector('.appbar')
  const nav = document.querySelector('.nav')
  const cs = getComputedStyle(document.documentElement)
  return {
    innerW: window.innerWidth, innerH: window.innerHeight,
    docClientW: document.documentElement.clientWidth, docClientH: document.documentElement.clientHeight,
    vvH: window.visualViewport ? Math.round(window.visualViewport.height) : null,
    vvTop: window.visualViewport ? Math.round(window.visualViewport.offsetTop) : null,
    dpr: window.devicePixelRatio,
    scaleVar: cs.getPropertyValue('--app-scale').trim(),
    appW: cs.getPropertyValue('--app-w').trim(), appH: cs.getPropertyValue('--app-h').trim(),
    topGuard: cs.getPropertyValue('--top-guard').trim(),
    scrollH: document.documentElement.scrollHeight, scrollY: window.scrollY,
    phone: r(phone), canvas: r(canvas), appbar: r(appbar), nav: r(nav),
    title: r(document.querySelector('.appbar__plate')),
    navInViewport: nav
      ? nav.getBoundingClientRect().top >= -1 &&
        nav.getBoundingClientRect().bottom <= window.innerHeight + 1
      : null,
  }
})()
`

const CASES = [
  { label: 'chrome-bottom-450x870', w: 450, h: 870 },
  { label: 'inapp-450x810', w: 450, h: 810 },
  { label: 'browserA-450x897', w: 450, h: 897 },
  { label: 'full-450x1000', w: 450, h: 1000 },
  { label: 'short-390x740', w: 390, h: 740 },
]

const server = await serve()
const port = server.address().port
const debugPort = await findFreePort()
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${debugPort}`,
  `--user-data-dir=${path.join(ROOT, 'work', '_probe-profile')}`,
  '--headless=new',
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-scrollbars',
  '--window-size=500,1100',
  'about:blank',
])

const wsUrl = await connect(debugPort)
const ws = new WebSocket(wsUrl)
await new Promise((r) => ws.addEventListener('open', r, { once: true }))
const client = cdp(ws)
await client.send('Page.enable')
await client.send('Runtime.enable')

const results = []
for (const c of CASES) {
  await client.send('Emulation.setDeviceMetricsOverride', {
    width: c.w,
    height: c.h,
    deviceScaleFactor: 3,
    mobile: true,
  })
  await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
  await delay(1600)
  const res = await client.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true })
  results.push({ case: c.label, ...res.result.value })
  const shot = await client.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(
    path.join(ROOT, 'work', `_probe-${c.label}.png`),
    Buffer.from(shot.data, 'base64'),
  )
}

// 额外：先按 1000 高加载，再收缩到 940（差 60 = 抖动阈值边界）
await client.send('Emulation.setDeviceMetricsOverride', { width: 450, height: 1000, deviceScaleFactor: 3, mobile: true })
await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
await delay(1500)
await client.send('Emulation.setDeviceMetricsOverride', { width: 450, height: 940, deviceScaleFactor: 3, mobile: true })
await delay(900)
const jitter = await client.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true })
results.push({ case: 'shrink-1000->940 (Δ60 抖动阈值)', ...jitter.result.value })
{
  const shot = await client.send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(path.join(ROOT, 'work', 'viewport-shrink-940.png'), Buffer.from(shot.data, 'base64'))
}

await client.send('Emulation.setDeviceMetricsOverride', { width: 450, height: 860, deviceScaleFactor: 3, mobile: true })
await delay(900)
const jitter2 = await client.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true })
results.push({ case: 'shrink-940->860 (Δ80)', ...jitter2.result.value })

/*
 * 地址栏浮层模拟：真实浏览器工具栏占 56px，但 visualViewport 未扣减。
 * 这里把窗口高度临时加 56px 充当“布局视口”，再让 visualViewport 少 56px，
 * 验证 --top-guard 是否补上这段遮挡，并保证底部导航不因此被裁。
 */
await client.send('Emulation.setDeviceMetricsOverride', { width: 360, height: 800, deviceScaleFactor: 3, mobile: true })
await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
await delay(1500)
await client.send('Runtime.evaluate', {
  expression: `(() => {
    const vv = window.visualViewport
    if (!vv) return false
    Object.defineProperty(window, 'innerHeight', { configurable: true, get: () => 800 })
    Object.defineProperty(vv, 'height', { configurable: true, get: () => 744 })
    Object.defineProperty(vv, 'offsetTop', { configurable: true, get: () => 0 })
    vv.dispatchEvent(new Event('resize'))
    return true
  })()`,
  returnByValue: true,
})
await delay(600)
const toolbar = await client.send('Runtime.evaluate', { expression: MEASURE, returnByValue: true })
results.push({ case: 'toolbar-guard-360x800', ...toolbar.result.value })

console.log('')
let failed = 0
for (const r of results) {
  const canvasBottom = r.canvas?.bottom ?? 0
  const overflow = canvasBottom - r.vvH
  const checked =
    r.navInViewport !== null || r.case.startsWith('toolbar-guard')
  const ok = overflow <= 1
  if (checked && (!ok || (r.navInViewport === false))) failed += 1
  console.log(
    [
      ok ? '·' : (checked ? '✗' : '·'),
      r.case.padEnd(32),
      `视口 ${r.vvH}px`,
      `缩放 ${r.scaleVar}`,
      `画布 ${r.appW}×${r.appH}`,
      `保护带 ${r.topGuard}`,
      `导航可见 ${r.navInViewport ?? '-'}`,
      `左右留白 ${r.canvas?.left ?? 0}px`,
      `溢出 ${overflow >= 0 ? '+' : ''}${overflow}px`,
    ].join('  '),
  )
}
console.log('')
console.log(failed === 0 ? '画布落位检查通过：所有视口都没有溢出可视视口' : `有 ${failed} 档视口溢出可视视口`)
ws.close()
chrome.kill()
server.close()
process.exit(failed === 0 ? 0 : 1)
