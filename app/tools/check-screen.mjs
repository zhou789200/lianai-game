/**
 * 适配 / 闪屏专项体检（开发工具，不参与打包）
 *
 * 用法：node tools/check-screen.mjs
 *
 * 输出三类硬指标：
 *  1. 不同视口下画布的比例、铺满情况、归一化后的版式坐标是否一致；
 *  2. 切换页面期间是否还会产生新的场景图请求（闪屏的加载侧原因）；
 *  3. 切换页面期间背景层的逐帧覆盖率（闪屏的绘制侧原因），
 *     覆盖率掉到 1 以下说明有一瞬间露出了 CSS 底色。
 */
import http from 'node:http'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createStoryMiddleware } from '../server/story-api.mjs'
import { createStoryVoiceMiddleware } from '../server/story-voice-api.mjs'
import { createUserMiddleware } from '../server/user-api.mjs'
import { createUserDatabase } from '../server/user-db.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const OUT = path.join(ROOT, 'work', 'canvas-audit.json')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
}

const VIEWPORTS = [
  { label: 'android-360x800', width: 360, height: 800 },
  { label: 'iphone-390x844', width: 390, height: 844 },
  { label: 'desktop-1440x900', width: 1440, height: 900 },
]

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
  return candidates.find((p) => fs.existsSync(p))
}

function serve() {
  return new Promise((resolve) => {
    const storyMiddleware = createStoryMiddleware()
    const storyVoiceMiddleware = createStoryVoiceMiddleware({
      synthesize: async () => Buffer.from([0xff, 0xf3, 0xa4, 0xc4, ...Buffer.alloc(256)]),
    })
    const userDatabase = createUserDatabase(':memory:')
    const userMiddleware = createUserMiddleware({ database: userDatabase })
    const server = http.createServer((req, res) => {
      userMiddleware(req, res, () => {
        storyMiddleware(req, res, () => {
          storyVoiceMiddleware(req, res, () => {
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
        })
      }).catch(() => {
        if (!res.headersSent) res.writeHead(500)
        res.end('{}')
      })
    })
    server.once('close', () => userDatabase.close())
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
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })
}

async function connect(debugPort) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* 等浏览器起来 */
    }
    await sleep(250)
  }
  throw new Error('无法连接到浏览器调试端口')
}

function cdp(ws) {
  let id = 0
  const pending = new Map()
  const events = []
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, timer } = pending.get(msg.id)
      pending.delete(msg.id)
      clearTimeout(timer)
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
    } else if (msg.method) {
      events.push(msg)
    }
  })
  return {
    events,
    send(method, params = {}, { timeoutMs = 45_000 } = {}) {
      id += 1
      const myId = id
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!pending.has(myId)) return
          pending.delete(myId)
          reject(new Error(`${method} 超时`))
        }, timeoutMs)
        pending.set(myId, { resolve, reject, timer })
        ws.send(JSON.stringify({ id: myId, method, params }))
      })
    },
  }
}

/* ---------- 页面内探针：逐帧记录背景层覆盖率 ---------- */
const PROBE_INSTALL = `
window.__probe = {
  samples: [],
  raf: 0,
  start() {
    this.samples = []
    if (this.raf) cancelAnimationFrame(this.raf)
    const tick = () => {
      const scene = document.querySelector('.scene')
      // 沉浸式玩法会主动隐藏场景层，那是设计行为，不参与露底统计
      if (!scene || scene.classList.contains('is-hidden')) {
        this.samples.push(null)
        this.raf = requestAnimationFrame(tick)
        return
      }
      let dark = 1
      document.querySelectorAll('.scene__bg').forEach((img) => {
        const cs = getComputedStyle(img)
        if (cs.visibility === 'hidden' || cs.display === 'none') return
        const o = parseFloat(cs.opacity) || 0
        dark *= 1 - o
      })
      this.samples.push(Math.round((1 - dark) * 1000) / 1000)
      this.raf = requestAnimationFrame(tick)
    }
    tick()
  },
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    const s = this.samples.filter((v) => typeof v === 'number')
    if (!s.length) return { frames: 0, minCoverage: null, maxCoverage: null, dipFrames: 0 }
    return {
      frames: s.length,
      minCoverage: Math.min(...s),
      maxCoverage: Math.max(...s),
      dipFrames: s.filter((v) => v < 0.95).length,
    }
  },
}
'ok'
`

/* ---------- 页面内测量：画布 + 归一化版式坐标 ---------- */
const MEASURE = `
(() => {
  const canvas = document.querySelector('.phone__canvas')
  if (!canvas) return { error: 'no-canvas' }
  const cr = canvas.getBoundingClientRect()
  const scale = cr.width / 430
  const at = (sel) => {
    const el = document.querySelector(sel)
    if (!el) return null
    const r = el.getBoundingClientRect()
    if (!r.width && !r.height) return null
    return {
      x: Math.round(((r.left - cr.left) / scale) * 10) / 10,
      y: Math.round(((r.top - cr.top) / scale) * 10) / 10,
      w: Math.round((r.width / scale) * 10) / 10,
      h: Math.round((r.height / scale) * 10) / 10,
    }
  }
  return {
    viewport: { w: innerWidth, h: innerHeight, dpr: devicePixelRatio },
    canvas: {
      left: Math.round(cr.left * 10) / 10,
      top: Math.round(cr.top * 10) / 10,
      width: Math.round(cr.width * 10) / 10,
      height: Math.round(cr.height * 10) / 10,
      ratio: Math.round((cr.width / cr.height) * 10000) / 10000,
    },
    scale: Math.round(scale * 10000) / 10000,
    cssVarScale: getComputedStyle(document.documentElement).getPropertyValue('--app-scale').trim(),
    fillsViewport:
      Math.abs(cr.width - innerWidth) < 2 || Math.abs(cr.height - innerHeight) < 2,
    overflowsViewport: cr.width > innerWidth + 1 || cr.height > innerHeight + 1,
    appbar: at('.appbar'),
    nav: at('.nav'),
    screen: at('.screen'),
    safeTop: getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim(),
    safeBottom: getComputedStyle(document.documentElement).getPropertyValue('--safe-bottom').trim(),
  }
})()
`

async function main() {
  const chrome = findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge')

  const server = await serve()
  const port = server.address().port
  const url = `http://127.0.0.1:${port}/`
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'seabreeze-check-'))
  const debugPort = await findFreePort()

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
  const report = { generatedAt: new Date().toISOString(), viewports: [] }

  try {
    const wsUrl = await connect(debugPort)
    ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    const client = cdp(ws)
    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Network.enable')

    const evaluate = async (expression) => {
      const res = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      return res.result?.value
    }

    for (const vp of VIEWPORTS) {
      await client.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: vp.width < 600,
      })
      await client.send('Emulation.setSafeAreaInsetsOverride', {
        insets: { top: 47, right: 0, bottom: 34, left: 0 },
      })
      await client.send('Page.navigate', { url })
      await sleep(1200)
      // 跳过账号选择与新手说明，直接进主界面
      await evaluate(
        `localStorage.setItem('seabreeze-pet-cafe.guest-mode','1');
         localStorage.setItem('seabreeze-pet-cafe.intro-seen','1'); 'ok'`,
      )
      await client.send('Page.reload')
      await sleep(2600)
      await evaluate(PROBE_INSTALL)

      const layout = await evaluate(MEASURE)

      // 逐页切换，收集图片请求与背景覆盖率
      const steps = ['宠物', '剧情', '主页', '咖啡店', '主页']
      const transitions = []
      for (const label of steps) {
        const before = client.events.length
        await evaluate(`window.__probe.start()`)
        const clicked = await evaluate(`(() => {
          const items = [...document.querySelectorAll('.nav__item')]
          const target = items.find((b) => b.textContent.includes('${label}'))
          if (!target) return false
          target.click()
          return true
        })()`)
        await sleep(620)
        const probe = await evaluate(`window.__probe.stop()`)
        const imageReqs = client.events
          .slice(before)
          .filter(
            (e) =>
              e.method === 'Network.requestWillBeSent' &&
              (e.params?.type === 'Image' || /\.(webp|png|jpe?g)(\?|$)/.test(e.params?.request?.url ?? '')),
          )
          .map((e) => (e.params.request.url.split('/').pop() ?? '').split('?')[0])
        transitions.push({ to: label, clicked, probe, imageRequests: imageReqs })
      }

      // 快速连点：模拟用户不停地切页，检查极端节奏下背景层会不会露底
      await evaluate(`window.__probe.start()`)
      for (const label of ['宠物', '剧情', '主页', '宠物', '主页']) {
        await evaluate(`(() => {
          const t = [...document.querySelectorAll('.nav__item')].find((b) => b.textContent.includes('${label}'))
          if (t) t.click()
        })()`)
        await sleep(70)
      }
      await sleep(450)
      const rapid = await evaluate(`window.__probe.stop()`)

      const layoutAfter = await evaluate(MEASURE)
      report.viewports.push({
        label: vp.label,
        requested: { width: vp.width, height: vp.height },
        layout,
        layoutAfterNavigation: layoutAfter,
        transitions,
        rapidSwitch: rapid,
      })
      console.log(
        `[${vp.label}] canvas ${layout.canvas?.width}x${layout.canvas?.height} ratio=${layout.canvas?.ratio} scale=${layout.scale} 铺满=${layout.fillsViewport} 溢出=${layout.overflowsViewport}`,
      )
      for (const t of transitions) {
        console.log(
          `   → ${t.to}: 覆盖率最低 ${t.probe.minCoverage} (掉帧 ${t.probe.dipFrames}/${t.probe.frames}) 新图片请求 ${t.imageRequests.length} 张${t.imageRequests.length ? ' ' + t.imageRequests.join(',') : ''}`,
        )
      }
      console.log(
        `   快速连点: 覆盖率最低 ${rapid.minCoverage} (掉帧 ${rapid.dipFrames}/${rapid.frames})`,
      )
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2))
    console.log(`\n报告已写入 ${OUT}`)
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
    server.closeAllConnections?.()
    await delay(300)
    fs.rmSync(profile, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
