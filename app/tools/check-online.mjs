/**
 * 线上站点验收（开发工具，不参与打包）
 *
 * 用法：node tools/check-online.mjs [url] [width] [height]
 *   node tools/check-online.mjs                      # 默认验收 https://zljgg.xyz/
 *   node tools/check-online.mjs https://zljgg.xyz/ 390 844
 *
 * 对真实部署做三件事：
 *  1. 记录入口 HTML 引用的资源指纹，确认不是旧版本；
 *  2. 量画布尺寸/比例/缩放比，确认适配逻辑在线上跑起来了；
 *  3. 切页逐帧采样背景覆盖率，确认场景层不会露底。
 */
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

const URL_ARG = process.argv[2] ?? 'https://zljgg.xyz/'
const WIDTH = Number(process.argv[3] ?? 390)
const HEIGHT = Number(process.argv[4] ?? 844)

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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    send(method, params = {}, { timeoutMs = 60_000 } = {}) {
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
window.__probe = {
  samples: [], raf: 0,
  start() {
    this.samples = []
    if (this.raf) cancelAnimationFrame(this.raf)
    const tick = () => {
      const scene = document.querySelector('.scene')
      if (!scene || scene.classList.contains('is-hidden')) {
        this.raf = requestAnimationFrame(tick)
        return
      }
      let dark = 1
      document.querySelectorAll('.scene__bg').forEach((img) => {
        const cs = getComputedStyle(img)
        if (cs.visibility === 'hidden' || cs.display === 'none') return
        dark *= 1 - (parseFloat(cs.opacity) || 0)
      })
      this.samples.push(Math.round((1 - dark) * 1000) / 1000)
      this.raf = requestAnimationFrame(tick)
    }
    tick()
  },
  stop() {
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    const s = this.samples
    if (!s.length) return { frames: 0, minCoverage: null, dipFrames: 0 }
    return {
      frames: s.length,
      minCoverage: Math.min(...s),
      dipFrames: s.filter((v) => v < 0.95).length,
    }
  },
}
'ok'
`

const MEASURE = `
(() => {
  const canvas = document.querySelector('.phone__canvas')
  if (!canvas) return { error: 'no-canvas' }
  const cr = canvas.getBoundingClientRect()
  return {
    viewport: { w: innerWidth, h: innerHeight },
    canvas: {
      width: Math.round(cr.width * 10) / 10,
      height: Math.round(cr.height * 10) / 10,
      ratio: Math.round((cr.width / cr.height) * 10000) / 10000,
    },
    cssVarScale: getComputedStyle(document.documentElement).getPropertyValue('--app-scale').trim(),
    sceneLayers: document.querySelectorAll('.scene__bg').length,
    assets: [...document.querySelectorAll('script[src], link[rel=stylesheet]')].map(
      (n) => (n.getAttribute('src') || n.getAttribute('href') || '').split('/').pop(),
    ),
  }
})()
`

async function main() {
  const chrome = findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge')

  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'seabreeze-online-'))
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

    await client.send('Page.navigate', { url: URL_ARG })
    await sleep(2500)
    await evaluate(
      `localStorage.setItem('seabreeze-pet-cafe.guest-mode','1');
       localStorage.setItem('seabreeze-pet-cafe.intro-seen','1'); 'ok'`,
    )
    await client.send('Page.reload')
    await sleep(3000)
    await evaluate(PROBE)

    const layout = await evaluate(MEASURE)
    console.log(`线上 ${URL_ARG}  @ ${WIDTH}x${HEIGHT}`)
    console.log(`资源: ${(layout.assets || []).join(', ')}`)
    console.log(
      `画布: ${layout.canvas?.width}x${layout.canvas?.height} ratio=${layout.canvas?.ratio} --app-scale=${layout.cssVarScale} 场景层=${layout.sceneLayers}`,
    )

    for (const label of ['宠物', '剧情', '主页']) {
      await evaluate(`window.__probe.start()`)
      const ok = await evaluate(`(() => {
        const items = [...document.querySelectorAll('.nav__item')]
        const t = items.find((b) => b.textContent.includes('${label}'))
        if (!t) return false
        t.click()
        return true
      })()`)
      await sleep(650)
      const probe = await evaluate(`window.__probe.stop()`)
      console.log(
        `→ ${label}: ${ok ? '已切换' : '未找到导航'} 覆盖率最低 ${probe.minCoverage} (掉帧 ${probe.dipFrames}/${probe.frames})`,
      )
    }
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
    await delay(300)
    fs.rmSync(profile, { recursive: true, force: true })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
