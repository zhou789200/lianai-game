/**
 * 小屏适配专项探针（开发工具，不参与打包）
 *
 * 用法：node tools/check-small-screens.mjs
 *
 * 面向「手机浏览器打开显示不全」：覆盖 320×568 到 390×740 的矮屏，
 * 逐档检查画布是否溢出、底部导航是否在可视区，以及剧情本卡片是否越界。
 * 截图写到 work/screenshots/，JSON 报告写到 work/small-screen-audit.json。
 */
import http from 'node:http'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const OUT_DIR = path.join(ROOT, 'work', 'screenshots')
const OUT_JSON = path.join(ROOT, 'work', 'small-screen-audit.json')

const CASES = [
  { label: '320x568', width: 320, height: 568 },
  { label: '360x650', width: 360, height: 650 },
  { label: '360x720', width: 360, height: 720 },
  { label: '360x800', width: 360, height: 800 },
  { label: '390x740', width: 390, height: 740 },
  { label: '390x844', width: 390, height: 844 },
]

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
}

function findChrome() {
  const candidates =
    process.platform === 'win32'
      ? [
          'C:/Program Files/Google/Chrome/Application/chrome.exe',
          'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
          'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
          'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
        ]
      : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser']
  return candidates.find((candidate) => fs.existsSync(candidate))
}

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url ?? '/').split('?')[0])
      let file = path.join(DIST, url === '/' ? 'index.html' : url)
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(DIST, 'index.html')
      }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
      })
      fs.createReadStream(file).pipe(res)
    })
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      server.close((error) => (error ? reject(error) : resolve(address.port)))
    })
  })
}

async function connect(debugPort) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
      const page = list.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* 浏览器仍在启动 */
    }
    await delay(250)
  }
  throw new Error('无法连接到浏览器调试端口')
}

function cdp(ws) {
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject, timer } = pending.get(message.id)
    pending.delete(message.id)
    clearTimeout(timer)
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)
  })
  return {
    send(method, params = {}, { timeoutMs = 30_000 } = {}) {
      id += 1
      const messageId = id
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(messageId)
          reject(new Error(`${method} 超时`))
        }, timeoutMs)
        pending.set(messageId, { resolve, reject, timer })
        ws.send(JSON.stringify({ id: messageId, method, params }))
      })
    },
  }
}

const MEASURE = `(() => {
  const rect = (element) => {
    if (!element) return null
    const box = element.getBoundingClientRect()
    return {
      left: Math.round(box.left * 10) / 10,
      top: Math.round(box.top * 10) / 10,
      right: Math.round(box.right * 10) / 10,
      bottom: Math.round(box.bottom * 10) / 10,
      width: Math.round(box.width * 10) / 10,
      height: Math.round(box.height * 10) / 10,
    }
  }
  const canvas = document.querySelector('.phone__canvas')
  const nav = document.querySelector('.nav')
  const page = document.querySelector('.storybook__page')
  const options = [...document.querySelectorAll('.storybook__option')]
  const screen = document.querySelector('.screen--storybook')
  const inViewport = (box) =>
    !!box && box.top >= -1 && box.bottom <= innerHeight + 1
  return {
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    canvas: rect(canvas),
    nav: rect(nav),
    navInViewport: inViewport(rect(nav)),
    screen: rect(screen),
    storyPage: rect(page),
    storyOptions: options.map(rect),
    storyOptionsInViewport: options.length > 0 && options.every((item) => inViewport(rect(item))),
    pageOverflow: page ? Math.max(0, rect(page).bottom - innerHeight) : null,
    css: {
      scale: getComputedStyle(document.documentElement).getPropertyValue('--app-scale').trim(),
      vvHeight: getComputedStyle(document.documentElement).getPropertyValue('--vv-h').trim(),
      canvasHeight: getComputedStyle(document.documentElement).getPropertyValue('--app-canvas-h').trim(),
    },
  }
})()`

const OPEN_STORY = `(() => {
  const button = [...document.querySelectorAll('.nav__item')].find(
    (item) => item.textContent.includes('剧情'),
  )
  button?.click()
  return !!button
})()`

const SET_CHOICE_BEAT = `(() => {
  const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save') ?? '{}')
  save.storyChapterId = 'sb2'
  save.storyChapterBeat = 2
  save.storyBranchId = null
  save.storyBranchBeat = 0
  save.storyTraceId = null
  save.storyCompletedChapters = Array.from(new Set([...(save.storyCompletedChapters ?? []), 'sb1']))
  localStorage.setItem('seabreeze-pet-cafe.save', JSON.stringify(save))
  return true
})()`

async function main() {
  const chrome = findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge')
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const server = await serve()
  const port = server.address().port
  const debugPort = await findFreePort()
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'seabreeze-small-'))
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  let ws
  const report = { generatedAt: new Date().toISOString(), cases: [] }
  let failed = 0

  try {
    ws = new WebSocket(await connect(debugPort))
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    const client = cdp(ws)
    await client.send('Page.enable')
    await client.send('Runtime.enable')

    const evaluate = async (expression) => {
      const result = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      return result.result?.value
    }

    for (const entry of CASES) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: entry.width,
        height: entry.height,
        deviceScaleFactor: 2,
        mobile: true,
      })
      await client.send('Page.navigate', { url: `http://127.0.0.1:${port}/` })
      await delay(1200)
      await evaluate(
        `localStorage.setItem('seabreeze-pet-cafe.guest-mode','1');
         localStorage.setItem('seabreeze-pet-cafe.intro-seen','1'); 'ok'`,
      )
      await client.send('Page.reload')
      await delay(1600)

      const home = await evaluate(MEASURE)
      const homeShot = await client.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(
        path.join(OUT_DIR, `small-${entry.label}-home.png`),
        Buffer.from(homeShot.data, 'base64'),
      )

      await evaluate(OPEN_STORY)
      await delay(700)
      await evaluate(SET_CHOICE_BEAT)
      await client.send('Page.reload')
      await delay(1600)
      await evaluate(OPEN_STORY)
      await delay(700)
      const story = await evaluate(MEASURE)
      let storyLatest = story
      for (let attempt = 0; attempt < 30 && storyLatest.storyOptions.length === 0; attempt += 1) {
        await delay(150)
        storyLatest = await evaluate(MEASURE)
      }
      const storyShot = await client.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(
        path.join(OUT_DIR, `small-${entry.label}-story.png`),
        Buffer.from(storyShot.data, 'base64'),
      )

      const canvasBottom = home.canvas?.bottom ?? 0
      const canvasOverflow = Math.max(0, canvasBottom - entry.height)
      const passed =
        canvasOverflow <= 1 &&
        home.navInViewport &&
        storyLatest.storyOptions.length >= 2 &&
        storyLatest.storyOptionsInViewport
      if (!passed) failed += 1

      report.cases.push({
        label: entry.label,
        requested: { width: entry.width, height: entry.height },
        home,
        story: storyLatest,
        passed,
      })
      console.log(
        [
          passed ? '✓' : '✗',
          entry.label.padEnd(9),
          `画布 ${home.canvas?.width}x${home.canvas?.height}`,
          `溢出 ${canvasOverflow}px`,
          `导航可见 ${home.navInViewport}`,
          `剧情项 ${storyLatest.storyOptions.length}`,
          `剧情项可见 ${storyLatest.storyOptionsInViewport}`,
          `卡片溢出 ${storyLatest.pageOverflow ?? '-'}px`,
        ].join('  '),
      )
    }

    fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2))
    console.log(`\n报告：${OUT_JSON}`)
  } finally {
    try {
      ws?.close()
    } catch {
      /* ignore */
    }
    if (child.pid && child.exitCode === null) {
      spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      })
    }
    server.close()
  }

  process.exit(failed === 0 ? 0 : 1)
}

await main()
