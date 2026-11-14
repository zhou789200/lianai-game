/**
 * 「今日安排」领取奖励闪屏体检（开发工具，不参与打包）
 *
 * 用法：node tools/check-claim.mjs
 *
 * 把存档里的任务全部置为可领取，打开面板后点击领取，
 * 逐帧记录：弹窗位置/高度、滚动位置、领奖提示条高度、
 * 每张任务卡片的 Y 坐标和不透明度，以及 layout-shift 与长任务。
 * 用来判断「点一下领取就闪」到底是布局跳动、状态瞬时变化，还是重绘。
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
const OUT = path.join(ROOT, 'work', 'claim-audit.json')
const WIDTH = Number(process.argv[2] ?? 390)
const HEIGHT = Number(process.argv[3] ?? 844)

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
}

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

const PROBE = `
(() => {
  const snap = () => {
    const modal = document.querySelector('.modal')
    const strip = document.querySelector('.notice-strip')
    const cards = [...document.querySelectorAll('.task-card')]
    const r = modal ? modal.getBoundingClientRect() : null
    return {
      t: Math.round(performance.now() * 10) / 10,
      modalTop: r ? Math.round(r.top * 10) / 10 : null,
      modalH: r ? Math.round(r.height * 10) / 10 : null,
      scrollTop: modal ? Math.round(modal.scrollTop * 10) / 10 : null,
      scrollH: modal ? modal.scrollHeight : null,
      stripH: strip ? Math.round(strip.getBoundingClientRect().height * 10) / 10 : 0,
      cards: cards.map((c) => ({
        y: Math.round(c.getBoundingClientRect().top * 10) / 10,
        o: getComputedStyle(c).opacity,
      })),
    }
  }
  window.__claim = {
    samples: [],
    shifts: [],
    longs: [],
    raf: 0,
    start() {
      this.samples = []
      this.shifts = []
      this.longs = []
      try {
        new PerformanceObserver((l) => {
          l.getEntries().forEach((e) =>
            this.shifts.push({
              value: Math.round(e.value * 10000) / 10000,
              at: Math.round(e.startTime),
              nodes: (e.sources || []).map((s) => (s.node && s.node.className) || '?'),
            }),
          )
        }).observe({ type: 'layout-shift', buffered: false })
      } catch {}
      try {
        new PerformanceObserver((l) => {
          l.getEntries().forEach((e) => this.longs.push(Math.round(e.duration)))
        }).observe({ type: 'longtask', buffered: false })
      } catch {}
      const tick = () => {
        this.samples.push(snap())
        this.raf = requestAnimationFrame(tick)
      }
      this.samples.push(snap())
      this.raf = requestAnimationFrame(tick)
    },
    stop() {
      if (this.raf) cancelAnimationFrame(this.raf)
      this.raf = 0
      return { samples: this.samples, shifts: this.shifts, longs: this.longs }
    },
    clickClaim() {
      const btn = [...document.querySelectorAll('.task-card button')].find(
        (b) => b.textContent.trim() === '可领取',
      )
      if (!btn) return false
      btn.click()
      return true
    },
  }
  return 'ok'
})()
`

async function main() {
  const chrome = findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge')

  const server = await serve()
  const url = `http://127.0.0.1:${server.address().port}/`
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'seabreeze-claim-'))
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
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 2,
      mobile: true,
    })

    const evaluate = async (expression) => {
      const res = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      return res.result?.value
    }

    await client.send('Page.navigate', { url })
    await sleep(1300)
    await evaluate(
      `localStorage.setItem('seabreeze-pet-cafe.guest-mode','1');
       localStorage.setItem('seabreeze-pet-cafe.intro-seen','1'); 'ok'`,
    )
    await client.send('Page.reload')
    await sleep(2400)

    // 让存档里的任务全部处于「可领取」
    const patched = await evaluate(`(() => {
      const raw = localStorage.getItem('seabreeze-pet-cafe.save')
      if (!raw) return 'no-save'
      const s = JSON.parse(raw)
      s.tasks = (s.tasks || []).map((t) => ({ ...t, progress: 99, claimed: false }))
      localStorage.setItem('seabreeze-pet-cafe.save', JSON.stringify(s))
      return s.tasks.length
    })()`)
    if (patched === 'no-save') throw new Error('没有找到存档，无法构造可领取状态')
    await client.send('Page.reload')
    await sleep(2400)
    await evaluate(PROBE)

    const opened = await evaluate(`(() => {
      const label = document.querySelector('.home2__quest-label')
      const btn = label && label.closest('button')
      if (!btn) return false
      btn.click()
      return true
    })()`)
    if (!opened) throw new Error('找不到「今日安排」入口')
    await sleep(700)

    const before = await evaluate(`(() => {
      const modal = document.querySelector('.modal')
      const cards = [...document.querySelectorAll('.task-card')]
      return {
        claimable: cards.filter((c) => [...c.querySelectorAll('button')].some((b) => b.textContent.trim() === '可领取')).length,
        modalH: modal ? Math.round(modal.getBoundingClientRect().height) : null,
        stripVisible: !!document.querySelector('.notice-strip'),
      }
    })()`)

    await evaluate(`window.__claim.start()`)
    const clicked = await evaluate(`window.__claim.clickClaim()`)
    await sleep(900)
    const result = await evaluate(`window.__claim.stop()`)

    const shot = async (name) => {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' })
      const dir = path.join(ROOT, 'work', 'screenshots')
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, `${name}.png`), Buffer.from(data, 'base64'))
    }
    await shot('claim-after')
    const after = await evaluate(`(() => {
      const modal = document.querySelector('.modal')
      return {
        modalH: modal ? Math.round(modal.getBoundingClientRect().height) : null,
        stripVisible: !!document.querySelector('.notice-strip'),
      }
    })()`)

    const samples = result.samples
    const first = samples[0]
    const last = samples[samples.length - 1]
    const maxDeltaY = Math.max(
      ...samples.map((s) => Math.abs((s.cards[0]?.y ?? 0) - (first.cards[0]?.y ?? 0))),
    )
    const opacitySeq = [...new Set(samples.map((s) => s.cards[0]?.o))]
    const modalHTop = {
      min: Math.min(...samples.map((s) => s.modalTop ?? 0)),
      max: Math.max(...samples.map((s) => s.modalTop ?? 0)),
    }

    const report = {
      generatedAt: new Date().toISOString(),
      viewport: { width: WIDTH, height: HEIGHT },
      before,
      clicked,
      after,
      frames: samples.length,
      firstCardMovePx: Math.round(maxDeltaY * 10) / 10,
      modalTopRangePx: Math.round((modalHTop.max - modalHTop.min) * 10) / 10,
      modalHeightBefore: first.modalH,
      modalHeightAfter: last.modalH,
      stripHBefore: first.stripH,
      stripHAfter: last.stripH,
      firstCardOpacityTimeline: opacitySeq,
      layoutShifts: result.shifts,
      longTasksMs: result.longs,
      sampleHead: samples.slice(0, 6),
      sampleTail: samples.slice(-4),
    }

    fs.mkdirSync(path.dirname(OUT), { recursive: true })
    fs.writeFileSync(OUT, JSON.stringify(report, null, 2))

    console.log(`视口 ${WIDTH}x${HEIGHT}  可领取 ${before.claimable} 个`)
    console.log(
      `弹窗高度 ${first.modalH} → ${last.modalH}（变化 ${(last.modalH ?? 0) - (first.modalH ?? 0)}px）`,
    )
    console.log(`领奖提示条高度 ${first.stripH} → ${last.stripH}`)
    console.log(`第一张卡片纵向位移 ${report.firstCardMovePx}px，弹窗顶端位移 ${report.modalTopRangePx}px`)
    console.log(`第一张卡片 opacity 序列 ${opacitySeq.join(' → ')}`)
    console.log(`layout-shift ${result.shifts.length} 次`, JSON.stringify(result.shifts.slice(0, 5)))
    console.log(`长任务 ${result.longs.length} 个`, result.longs.slice(0, 5))
    console.log(`采样 ${samples.length} 帧，报告 ${OUT}`)
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
