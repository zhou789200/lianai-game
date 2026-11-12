/**
 * 宠物照料动画截帧工具（开发工具，不参与打包）
 *
 * 用法：node tools/capture-pet-animation.mjs [width] [height] [suffix]
 * 输出：work/screenshots/<suffix>-pet-<action>-<progress>.png
 */
import fs from 'node:fs'
import http from 'node:http'
import net from 'node:net'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist')
const OUT = path.join(ROOT, 'work', 'screenshots')
const WIDTH = Number(process.argv[2] ?? 430)
const HEIGHT = Number(process.argv[3] ?? 932)
const SUFFIX = process.argv[4] ?? `${WIDTH}x${HEIGHT}`
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function findChrome() {
  return [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ].find((candidate) => fs.existsSync(candidate))
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

async function waitForDebugger(debugPort) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()
      const page = targets.find((target) => target.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      // Chrome 仍在启动。
    }
    await sleep(250)
  }
  throw new Error('无法连接到 Chrome 调试端口')
}

function createCdp(ws) {
  let id = 0
  const pending = new Map()
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result)
  })
  return {
    send(method, params = {}) {
      id += 1
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject })
        ws.send(JSON.stringify({ id, method, params }))
      })
    },
  }
}

async function main() {
  const chrome = findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge')

  const server = http.createServer((request, response) => {
    const pathname = decodeURIComponent((request.url ?? '/').split('?')[0])
    let file = path.join(DIST, pathname === '/' ? 'index.html' : pathname)
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(DIST, 'index.html')
    }
    response.writeHead(200, {
      'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    })
    fs.createReadStream(file).pipe(response)
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))

  const profile = path.join(ROOT, 'work', `.chrome-${SUFFIX}-pet-animation`)
  fs.rmSync(profile, { recursive: true, force: true })
  const debugPort = await findFreePort()
  const browser = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--hide-scrollbars',
      `--remote-debugging-port=${debugPort}`,
      `--user-data-dir=${profile}`,
      `--window-size=${WIDTH},${HEIGHT}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  try {
    const ws = new WebSocket(await waitForDebugger(debugPort))
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true })
      ws.addEventListener('error', reject, { once: true })
    })
    const cdp = createCdp(ws)
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: 2,
      mobile: WIDTH < 600,
    })
    await cdp.send('Page.navigate', {
      url: `http://127.0.0.1:${server.address().port}/`,
    })
    await sleep(1800)

    const evaluate = async (expression) => {
      const result = await cdp.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      return result.result?.value
    }

    await evaluate(`(() => {
      localStorage.setItem('seabreeze-pet-cafe.guest-mode', '1');
      localStorage.setItem('seabreeze-pet-cafe.intro-seen', '1');
      localStorage.setItem('seabreeze-pet-cafe.save', JSON.stringify({
        version: 3,
        playerName: '测试玩家',
        day: 3,
        coins: 999,
        stamina: 30,
        pet: {
          name: '布丁',
          breed: '橘白猫',
          age: '两岁半',
          hunger: 68,
          cleanliness: 92,
          mood: 100,
          intimacy: 100,
        },
      }));
    })()`)
    await cdp.send('Page.reload')
    await sleep(1500)

    const petNavClicked = await evaluate(`(() => {
      const button = [...document.querySelectorAll('.nav__item')].find(
        (item) => item.textContent.includes('宠物'),
      );
      if (button) button.click();
      return !!button;
    })()`)
    await sleep(700)
    await evaluate(`document.querySelector('.pet-card-wrap')?.scrollIntoView({ block: 'start' })`)
    await sleep(300)

    fs.mkdirSync(OUT, { recursive: true })
    const capture = async (action, delay) => {
      const clicked = await evaluate(`(() => {
        const button = [...document.querySelectorAll('.pet-action')].find(
          (card) => card.querySelector('.pet-action__name')?.textContent?.trim() === ${JSON.stringify({
            feed: '喂食',
            groom: '梳毛',
          }[action])},
        )?.querySelector('.btn');
        if (button) button.click();
        return !!button;
      })()`)
      await sleep(delay)
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(
        path.join(OUT, `${SUFFIX}-pet-${action}-${delay}ms.png`),
        Buffer.from(data, 'base64'),
      )
      await sleep(2300)
      return clicked
    }

    const results = {
      petNavClicked,
      feed10: await capture('feed', 220),
      feed45: await capture('feed', 990),
      feed88: await capture('feed', 1940),
      groom10: await capture('groom', 220),
      groom45: await capture('groom', 990),
      groom88: await capture('groom', 1940),
    }
    console.log(JSON.stringify(results, null, 2))
    ws.close()
  } finally {
    browser.kill()
    await new Promise((resolve) => server.close(resolve))
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
