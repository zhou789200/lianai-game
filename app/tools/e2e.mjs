/**
 * 原型 E2E 冒烟脚本（开发工具，不参与打包）
 *
 * 作用：用无头 Chrome 打开构建产物，依次点击五个导航、驱动一遍营业关卡，
 *      收集控制台错误并截图，作为“可运行”的运行证据。
 *
 * 用法：node tools/e2e.mjs [width] [height] [suffix]
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
const OUT = path.join(ROOT, 'work', 'screenshots')

const WIDTH = Number(process.argv[2] ?? 430)
const HEIGHT = Number(process.argv[3] ?? 932)
const SUFFIX = process.argv[4] ?? `${WIDTH}x${HEIGHT}`
/**
 * 截图采样率。移动端 2x 便于查文字细节；桌面视口再乘 2 会得到 2880×1800
 * 的截画面，本机无头 Chrome 在这种尺寸下 captureScreenshot 会一直不返回，
 * 因此超过 400 万像素的输出统一降到 1x。
 */
const DEVICE_SCALE = WIDTH * HEIGHT * 4 > 4_000_000 ? 1 : 2
const STORY_SKIP_AUDIT =
  process.env.STORY_SKIP_AUDIT === '1' ||
  process.argv.includes('--story-skip-audit')
const STORY_REPLAY_AUDIT = process.argv.includes('--story-replay-audit')
const GLOBAL_TIMEOUT_MS = 10 * 60 * 1000
const PROCESS_EXIT_TIMEOUT_MS = 5_000

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json',
}

function findChrome() {
  const candidates = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  return candidates.find((p) => fs.existsSync(p))
}

function serve() {
  return new Promise((resolve) => {
    const storyMiddleware = createStoryMiddleware()
    // E2E 不依赖外网，返回极短的合法 MP3 占位音频，同时仍走真实播放链路。
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
            res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream' })
            fs.createReadStream(file).pipe(res)
          })
        })
      }).catch((error) => {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' })
        }
        res.end(JSON.stringify({ error: error instanceof Error ? error.message : 'test server error' }))
      })
    })
    server.once('close', () => userDatabase.close())
    server.listen(0, '127.0.0.1', () => resolve(server))
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function closeHttpServer(server) {
  return new Promise((resolve) => {
    if (!server.listening) {
      resolve()
      return
    }
    server.close(() => resolve())
    server.closeAllConnections?.()
  })
}

async function stopBrowser(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return

  const waitForExit = async () => {
    if (child.exitCode !== null || child.signalCode !== null) return true
    try {
      await Promise.race([
        new Promise((resolve) => child.once('exit', resolve)),
        delay(PROCESS_EXIT_TIMEOUT_MS).then(() => {
          throw new Error('browser exit timeout')
        }),
      ])
      return true
    } catch {
      return false
    }
  }

  if (process.platform === 'win32' && child.pid) {
    const result = spawnSync(
      'taskkill',
      ['/pid', String(child.pid), '/T', '/F'],
      { stdio: 'ignore', windowsHide: true },
    )
    if (result.error && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
    }
    await waitForExit()
    return
  }

  child.kill('SIGTERM')
  if (await waitForExit()) return
  child.kill('SIGKILL')
  await waitForExit()
}

async function connect(debugPort) {
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${debugPort}/json/list`)
      ).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch {
      /* 等 Chrome 起来 */
    }
    await sleep(250)
  }
  throw new Error('无法连接到 Chrome 调试端口')
}

function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close((error) => {
        if (error) reject(error)
        else resolve(port)
      })
    })
  })
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
        // 单条 CDP 命令必须有超时：截图 / 求值任何一步卡住，
        // 否则只能等 10 分钟硬超时，看不出卡在哪一步。
        const timer = setTimeout(() => {
          if (!pending.has(myId)) return
          pending.delete(myId)
          reject(new Error(`${method} 超时（${timeoutMs}ms 未返回）`))
        }, timeoutMs)
        pending.set(myId, { resolve, reject, timer })
        ws.send(JSON.stringify({ id: myId, method, params }))
      })
    },
  }
}

async function main() {
  const chrome = findChrome()
  if (!chrome) throw new Error('找不到 Chrome / Edge')

  fs.mkdirSync(OUT, { recursive: true })
  const server = await serve()
  const port = server.address().port
  const url = `http://127.0.0.1:${port}/`

  // 浏览器配置目录放在系统临时目录：每次运行独立一份，既不污染仓库，
  // 也不会因为后缀不同而在 work/ 下越积越多（历史上堆积过 60+ 个、1.3GB）。
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), `seabreeze-e2e-${SUFFIX}-`))
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
      `--window-size=${WIDTH},${HEIGHT}`,
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const errors = []
  let client
  let ws
  let cleanupStarted = false
  let globalTimer
  const cleanup = async () => {
    if (cleanupStarted) return
    cleanupStarted = true
    if (globalTimer) clearTimeout(globalTimer)
    try {
      ws?.close()
    } catch {
      /* ignore */
    }
    await Promise.allSettled([stopBrowser(child), closeHttpServer(server)])
    // 本次运行的浏览器配置目录用完即删，避免每次验收都在 work/ 下留下 20MB 残留。
    // Windows 上浏览器退出后句柄释放有延迟，需要重试几次。
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        fs.rmSync(profile, { recursive: true, force: true })
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 300))
      }
    }
  }
  let rejectGlobalTimeout
  const globalTimeout = new Promise((_, reject) => {
    rejectGlobalTimeout = reject
  })
  globalTimer = setTimeout(() => {
    rejectGlobalTimeout(new Error(`E2E 超过 ${GLOBAL_TIMEOUT_MS / 60_000} 分钟硬超时`))
  }, GLOBAL_TIMEOUT_MS)
  process.once('SIGINT', () => {
    cleanup().finally(() => process.exit(130))
  })
  process.once('SIGTERM', () => {
    cleanup().finally(() => process.exit(143))
  })
  try {
    await Promise.race([
      (async () => {
    const wsUrl = await connect(debugPort)
    ws = new WebSocket(wsUrl)
    await new Promise((res, rej) => {
      ws.addEventListener('open', res, { once: true })
      ws.addEventListener('error', rej, { once: true })
    })
    client = cdp(ws)

    await client.send('Page.enable')
    await client.send('Runtime.enable')
    await client.send('Log.enable')
    await client.send('Emulation.setDeviceMetricsOverride', {
      width: WIDTH,
      height: HEIGHT,
      deviceScaleFactor: DEVICE_SCALE,
      mobile: WIDTH < 600,
    })

    await client.send('Page.navigate', { url })
    await sleep(2200)

    const evaluate = async (expression) => {
      const res = await client.send('Runtime.evaluate', {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })
      return res.result?.value
    }

    const shoot = async (name) => {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' })
      fs.writeFileSync(path.join(OUT, `${SUFFIX}-${name}.png`), Buffer.from(data, 'base64'))
    }

    const waitForSelector = async (selector, timeout = 5000) => {
      const startedAt = Date.now()
      while (Date.now() - startedAt < timeout) {
        if (await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`)) return true
        await sleep(100)
      }
      return false
    }

    const completeDraftText = async (containerSelector) => {
      for (let step = 0; step < 16; step += 1) {
        const state = await evaluate(`(() => {
          const container = document.querySelector(${JSON.stringify(containerSelector)});
          if (!container) return { ready: false, caret: false };
          return {
            ready: true,
            caret: !!container.querySelector('.storybook__caret'),
            next: !!document.querySelector(
              '.storybook__draft-reader-footer .storybook__next',
            ),
          };
        })()`)
        if (state?.ready && !state.caret) return true
        if (state?.next) {
          await evaluate(`document.querySelector(
            '.storybook__draft-reader-footer .storybook__next',
          )?.click()`)
        }
        await sleep(100)
      }
      return false
    }

    const clickTopLayerNext = async () => {
      return evaluate(`(() => {
        const layers = [...document.querySelectorAll('.storybook__draft-layer')];
        const layer = layers[layers.length - 1];
        const next = layer?.querySelector(
          '.storybook__draft-reader-footer .storybook__next',
        );
        if (next) next.click();
        return {
          clicked: !!next,
          label: next?.getAttribute('aria-label') ?? '',
          layerCount: layers.length,
        };
      })()`)
    }

    const accountGateReady = await waitForSelector('.account-form', 5000)
    const guestStarted = await evaluate(`(() => {
      const b = [...document.querySelectorAll('.account-guest-link')].find(
        (x) => x.textContent.includes('先以游客试玩'),
      );
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(400)

    // 关掉开场说明
    const introStarted = await evaluate(`(() => {
      const b = [...document.querySelectorAll('.modal .btn')].find(
        (x) => x.textContent.includes('开始第一天'),
      );
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(400)

    if (!accountGateReady || !guestStarted || !introStarted) {
      throw new Error(
        `首次进入流程不完整: accountGate=${accountGateReady}, guest=${guestStarted}, intro=${introStarted}`,
      )
    }

    const navCount = await evaluate(`document.querySelectorAll('.nav__item').length`)
    const clickNav = async (label) => {
      await evaluate(`(() => {
        const b = [...document.querySelectorAll('.nav__item')].find(x => x.textContent.includes(${JSON.stringify(label)}));
        if (b) b.click();
        return !!b;
      })()`)
      await sleep(500)
    }

    const clickNavAtCenter = async (label) => {
      const result = await evaluate(`(() => {
        const button = [...document.querySelectorAll('.nav__item')].find(
          (item) => item.textContent.includes(${JSON.stringify(label)}),
        );
        if (!button) return { found: false };
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        if (hit) hit.closest('.nav__item')?.click();
        return {
          found: true,
          hitNav: hit === button || hit?.closest('.nav__item') === button,
          hitClass: hit?.getAttribute('class') ?? '',
          x,
          y,
        };
      })()`)
      await sleep(500)
      return result
    }

    const auditStoryNav = async () => {
      const auditErrors = []
      const expectedScreen = {
        主页: '.screen--home',
        剧情: '.screen--storybook',
        咖啡店: '.screen--cafe',
        宠物: '.screen--pet',
        恋爱: '.screen--romance',
      }
      const routeChecks = []

      for (const label of ['剧情', '主页', '剧情', '咖啡店', '宠物', '恋爱']) {
        const clicked = await clickNavAtCenter(label)
        const screenVisible = await waitForSelector(expectedScreen[label], 1600)
        const geometry = await evaluate(`(() => {
          const button = [...document.querySelectorAll('.nav__item')].find(
            (item) => item.textContent.includes(${JSON.stringify(label)}),
          );
          if (!button) return null;
          const rect = button.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const hit = document.elementFromPoint(x, y);
          return {
            hitNav: hit === button || hit?.closest('.nav__item') === button,
            inViewport:
              x >= 0 && y >= 0 && x <= innerWidth && y <= innerHeight,
          };
        })()`)
        routeChecks.push({ label, screenVisible, ...clicked, ...geometry })
        if (
          !clicked?.found ||
          !clicked?.hitNav ||
          !screenVisible ||
          !geometry?.hitNav ||
          !geometry?.inViewport
        ) {
          auditErrors.push(`${label} 导航不可用: ${JSON.stringify(routeChecks.at(-1))}`)
        }
      }

      await clickNavAtCenter('剧情')
      const storyRestored = await waitForSelector('.screen--storybook', 1600)
      if (!storyRestored) auditErrors.push('切回剧情页后没有恢复剧情本')

      return { auditErrors, routeChecks, storyRestored }
    }

    /* ---------- 已记录选项重读审计 ---------- */
    if (STORY_REPLAY_AUDIT) {
      const auditErrors = []
      const stateBefore = await evaluate(`(() => {
        const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
        save.storyChapterId = 'sb2';
        save.storyChapterBeat = 2;
        save.storyBranchId = null;
        save.storyBranchBeat = 0;
        save.storyTraceId = null;
        save.storyCompletedChapters = ['sb1'];
        save.storyFlags = [
          ...new Set([...(save.storyFlags ?? []), 'story:knocked-on-door']),
        ];
        save.storyChoices = [{
          id: 'storybook:sb2:sb2-b3',
          at: Date.now(),
          source: 'storybook',
          chapterId: 'sb2',
          chapterTitle: '猫知道的路',
          scene: '午后三点 · 旧街尽头',
          beatId: 'sb2-b3',
          prompt: '巷口传来收音机的杂音。',
          optionId: 'sb2-b3-a',
          optionText: '敲门问问',
          reply: '门后的人认得那枚蓝色火漆，也认得信上的名字。',
          skipped: true,
          branchId: 'sb2-door',
          storyFlags: ['story:knocked-on-door'],
        }];
        localStorage.setItem('seabreeze-pet-cafe.save', JSON.stringify(save));
        return {
          coins: save.coins,
          exp: save.exp,
          choicesMade: save.stats.choicesMade,
          taskProgress:
            save.tasks.find((task) => task.id === 'story_step')?.progress ?? null,
          choiceCount: save.storyChoices.length,
        };
      })()`)

      await evaluate(`location.reload()`)
      await sleep(2200)
      await clickNav('剧情')
      const replayOptionVisible = await waitForSelector(
        '.storybook__options .storybook__option',
        5000,
      )
      const clickedReplayOption = await evaluate(`(() => {
        const button = [...document.querySelectorAll('.storybook__option')].find(
          (item) => item.textContent?.includes('敲门问问'),
        );
        if (button && !button.disabled) button.click();
        return !!button && !button.disabled;
      })()`)
      const replayReplyReady = await waitForSelector('.storybook__reply', 2500)
      let replyText = ''
      for (let step = 0; step < 40; step += 1) {
        replyText = await evaluate(
          `document.querySelector('.storybook__reply p')?.textContent?.trim() ?? ''`,
        )
        if (replyText.includes('蓝色火漆')) break
        await sleep(100)
      }
      await sleep(250)
      const stateAfter = await evaluate(`(() => {
        const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
        return {
          storyChapterBeat: save.storyChapterBeat,
          storyBranchId: save.storyBranchId,
          storyBranchBeat: save.storyBranchBeat,
          coins: save.coins,
          exp: save.exp,
          choicesMade: save.stats.choicesMade,
          taskProgress:
            save.tasks.find((task) => task.id === 'story_step')?.progress ?? null,
          choiceCount: save.storyChoices.length,
        };
      })()`)

      if (!replayOptionVisible || !clickedReplayOption || !replayReplyReady) {
        auditErrors.push(
          `已记录选项无法再次点击: ${JSON.stringify({
            replayOptionVisible,
            clickedReplayOption,
            replayReplyReady,
          })}`,
        )
      }
      if (!replyText.includes('蓝色火漆')) {
        auditErrors.push(`重读选项没有显示分支回应: ${replyText}`)
      }
      if (
        stateAfter?.storyChapterBeat !== 2 ||
        stateAfter?.storyBranchId !== 'sb2-door' ||
        stateAfter?.storyBranchBeat !== 0
      ) {
        auditErrors.push(`重读选项没有进入剧情分支: ${JSON.stringify(stateAfter)}`)
      }
      if (
        stateAfter?.coins !== stateBefore?.coins ||
        stateAfter?.exp !== stateBefore?.exp ||
        stateAfter?.choicesMade !== stateBefore?.choicesMade ||
        stateAfter?.taskProgress !== stateBefore?.taskProgress ||
        stateAfter?.choiceCount !== stateBefore?.choiceCount
      ) {
        auditErrors.push(
          `重读已记录选项重复结算: ${JSON.stringify({
            before: stateBefore,
            after: stateAfter,
          })}`,
        )
      }

      for (const event of client.events) {
        if (event.method === 'Runtime.exceptionThrown') {
          auditErrors.push(
            event.params?.exceptionDetails?.exception?.description ?? 'exception',
          )
        }
        if (
          event.method === 'Runtime.consoleAPICalled' &&
          event.params?.type === 'error'
        ) {
          auditErrors.push(
            (event.params.args ?? [])
              .map((arg) => arg.value ?? arg.description)
              .join(' '),
          )
        }
        if (
          event.method === 'Log.entryAdded' &&
          event.params?.entry?.level === 'error'
        ) {
          auditErrors.push(event.params.entry.text)
        }
      }

      await shoot('00-story-replay-audit')
      console.log(`[${SUFFIX}] 重读前: ${JSON.stringify(stateBefore)}`)
      console.log(`[${SUFFIX}] 重读后: ${JSON.stringify(stateAfter)}`)
      console.log(`[${SUFFIX}] 重读回应: ${replyText}`)
      console.log(
        `[${SUFFIX}] 已记录选项重读审计错误: ${
          auditErrors.length ? auditErrors.join(' || ') : '(无)'
        }`,
      )
      if (auditErrors.length) process.exitCode = 1
      return
    }

    /* ---------- 跳过章节专项审计 ---------- */
    if (STORY_SKIP_AUDIT) {
      const auditErrors = []
      const readSkipDialog = () =>
        evaluate(`(() => {
          const layer = document.querySelector('.modal-layer');
          if (!layer) return null;
          return {
            title: layer.querySelector('.modal__title')?.textContent?.trim() ?? '',
            subtitle: layer.querySelector('.modal__sub')?.textContent?.trim() ?? '',
            buttons: [...layer.querySelectorAll('.modal__actions .btn')].map(
              (button) => button.textContent?.trim() ?? '',
            ),
          };
        })()`)
      const confirmSkip = async () => {
        const clicked = await evaluate(`(() => {
          const button = [...document.querySelectorAll('.modal__actions .btn')].find(
            (item) => item.textContent?.trim() === '确认跳过',
          );
          if (button && !button.disabled) button.click();
          return !!button && !button.disabled;
        })()`)
        await sleep(450)
        return clicked
      }

      await clickNav('恋爱')
      const openedRomanceSkip = await evaluate(`(() => {
        const button = [...document.querySelectorAll('.story-controls .btn')].find(
          (item) => item.textContent?.includes('跳过本章'),
        );
        if (button && !button.disabled) button.click();
        return !!button && !button.disabled;
      })()`)
      const romanceDialogReady = await waitForSelector('.modal-layer', 1800)
      const romanceDialog = await readSkipDialog()
      const romanceSkipConfirmed = await confirmSkip()
      const romanceSave = await evaluate(`(() => {
        try {
          const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
          const choice = (save?.storyChoices ?? []).find(
            (item) => item.source === 'romance' && item.chapterId === 'ch1',
          );
          return {
            completed: save?.completedChapters?.includes('ch1') ?? false,
            chapterId: save?.chapterId ?? '',
            chapterBeat: save?.chapterBeat ?? null,
            relationship:
              save?.relationships?.find((item) => item.id === 'linche')?.value ?? null,
            choice: choice
              ? {
                  optionId: choice.optionId,
                  skipped: choice.skipped,
                  beatId: choice.beatId,
                }
              : null,
            storyTraceCount: save?.storyTraces?.length ?? null,
          };
        } catch {
          return null;
        }
      })()`)

      await clickNav('剧情')
      const openedFirstStorybookSkip = await evaluate(`(() => {
        const button = document.querySelector(
          '.storybook__icon-btn[aria-label="跳过本章"]',
        );
        if (button && !button.disabled) button.click();
        return !!button && !button.disabled;
      })()`)
      const storybookDialogReady = await waitForSelector('.modal-layer', 1800)
      const storybookDialog = await readSkipDialog()
      const firstStorybookSkipConfirmed = await confirmSkip()
      for (let step = 0; step < 20; step += 1) {
        const advanced = await evaluate(`(() => {
          try {
            const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
            return save?.storyChapterId === 'sb2';
          } catch {
            return false;
          }
        })()`)
        if (advanced) break
        await sleep(100)
      }
      const afterFirstStorybookSkip = await evaluate(`(() => {
        try {
          const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
          return {
            storyChapterId: save?.storyChapterId ?? '',
            completed: save?.storyCompletedChapters ?? [],
            choices: (save?.storyChoices ?? []).map((choice) => ({
              chapterId: choice.chapterId,
              beatId: choice.beatId,
              optionId: choice.optionId,
              skipped: choice.skipped,
            })),
            storyFlags: save?.storyFlags ?? [],
          };
        } catch {
          return null;
        }
      })()`)

      const installedRequestRecorder = await evaluate(`(() => {
        if (!window.__storySkipOriginalFetch) {
          window.__storySkipOriginalFetch = window.fetch.bind(window);
          window.__storySkipAuditRequests = [];
          window.fetch = (input, init) => {
            if (
              String(input).includes('/api/story/generate') &&
              typeof init?.body === 'string'
            ) {
              try {
                window.__storySkipAuditRequests.push(JSON.parse(init.body));
              } catch {
                /* 忽略无法解析的非剧情请求 */
              }
            }
            return window.__storySkipOriginalFetch(input, init);
          };
        }
        return true;
      })()`)

      const openedSecondStorybookSkip = await evaluate(`(() => {
        const button = document.querySelector(
          '.storybook__icon-btn[aria-label="跳过本章"]',
        );
        if (button && !button.disabled) button.click();
        return !!button && !button.disabled;
      })()`)
      const secondDialogReady = await waitForSelector('.modal-layer', 1800)
      const secondStorybookDialog = await readSkipDialog()
      const secondStorybookSkipConfirmed = await confirmSkip()
      const draftOpenedAfterSkip = await waitForSelector(
        '.storybook__draft-layer[aria-label="故事续页"]',
        5000,
      )
      let generationRequestCount = 0
      for (let step = 0; step < 30; step += 1) {
        generationRequestCount = await evaluate(
          `window.__storySkipAuditRequests?.length ?? 0`,
        )
        if (generationRequestCount > 0) break
        await sleep(100)
      }
      const storybookSave = await evaluate(`(() => {
        try {
          const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
          const choices = save?.storyChoices ?? [];
          const secondChoice = choices.find(
            (item) => item.source === 'storybook' && item.chapterId === 'sb2',
          );
          return {
            storyChapterId: save?.storyChapterId ?? '',
            completed: save?.storyCompletedChapters ?? [],
            chapterBeat: save?.storyChapterBeat ?? null,
            branchId: save?.storyBranchId ?? null,
            branchBeat: save?.storyBranchBeat ?? null,
            storyFlags: save?.storyFlags ?? [],
            storyTraceCount: save?.storyTraces?.length ?? null,
            choiceCount: choices.length,
            secondChoice: secondChoice
              ? {
                  beatId: secondChoice.beatId,
                  optionId: secondChoice.optionId,
                  branchId: secondChoice.branchId ?? '',
                  skipped: secondChoice.skipped,
                  storyFlags: secondChoice.storyFlags ?? [],
                }
              : null,
          };
        } catch {
          return null;
        }
      })()`)
      const generationRequest = await evaluate(`(() => {
        const requests = window.__storySkipAuditRequests ?? [];
        const request = requests[requests.length - 1];
        return {
          count: requests.length,
          memories: request?.memories ?? [],
          storyFlags: request?.storyFlags ?? [],
          continuity: request?.continuity ?? null,
        };
      })()`)
      await sleep(250)
      await shoot('00-story-skip-audit')
      const closeButtonHitAudit = await evaluate(`(() => {
        const layers = [...document.querySelectorAll('.storybook__draft-layer')];
        const topLayer = layers[layers.length - 1];
        const button = topLayer?.querySelector('.storybook__draft-reader-close');
        if (!button) {
          return {
            buttonPresent: false,
            toastCount: document.querySelectorAll('.toast').length,
          };
        }
        const rect = button.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const hit = document.elementFromPoint(x, y);
        return {
          buttonPresent: true,
          buttonLabel: button.getAttribute('aria-label') ?? '',
          toastCount: document.querySelectorAll('.toast').length,
          hitInsideButton: hit === button || !!hit?.closest(
            '.storybook__draft-reader-close',
          ),
          hitClass: hit?.getAttribute('class') ?? '',
          center: { x, y },
        };
      })()`)

      const confirmCopy =
        '未完成的选择会自动采用第一个选项，已做出的选择会保留，后续剧情仍会承接这些结果。'
      if (
        !openedRomanceSkip ||
        !romanceDialogReady ||
        romanceDialog?.title !== '跳过这一章？' ||
        romanceDialog?.subtitle !== confirmCopy ||
        !romanceDialog?.buttons?.includes('继续阅读') ||
        !romanceDialog?.buttons?.includes('确认跳过')
      ) {
        auditErrors.push(
          `恋爱页跳过确认不完整: ${JSON.stringify({
            openedRomanceSkip,
            romanceDialogReady,
            romanceDialog,
          })}`,
        )
      }
      if (
        !romanceSkipConfirmed ||
        !romanceSave?.completed ||
        romanceSave?.chapterId !== 'ch1' ||
        romanceSave?.chapterBeat !== 0 ||
        romanceSave?.relationship !== 11 ||
        romanceSave?.choice?.optionId !== 'ch1-b5-a' ||
        romanceSave?.choice?.beatId !== 'ch1-b5' ||
        romanceSave?.choice?.skipped !== true ||
        romanceSave?.storyTraceCount !== 0
      ) {
        auditErrors.push(`恋爱页跳过存档不正确: ${JSON.stringify(romanceSave)}`)
      }
      if (
        !openedFirstStorybookSkip ||
        !storybookDialogReady ||
        storybookDialog?.subtitle !== confirmCopy ||
        !firstStorybookSkipConfirmed ||
        afterFirstStorybookSkip?.storyChapterId !== 'sb2' ||
        !afterFirstStorybookSkip?.completed?.includes('sb1') ||
        !afterFirstStorybookSkip?.storyFlags?.includes('story:letter-to-post')
      ) {
        auditErrors.push(
          `剧情本第一章跳过不正确: ${JSON.stringify({
            openedFirstStorybookSkip,
            storybookDialogReady,
            storybookDialog,
            firstStorybookSkipConfirmed,
            afterFirstStorybookSkip,
          })}`,
        )
      }
      if (
        !installedRequestRecorder ||
        !openedSecondStorybookSkip ||
        !secondDialogReady ||
        secondStorybookDialog?.subtitle !== confirmCopy ||
        !secondStorybookSkipConfirmed ||
        !draftOpenedAfterSkip
      ) {
        auditErrors.push(
          `剧情本末章跳过或续页打开失败: ${JSON.stringify({
            installedRequestRecorder,
            openedSecondStorybookSkip,
            secondDialogReady,
            secondStorybookDialog,
            secondStorybookSkipConfirmed,
            draftOpenedAfterSkip,
          })}`,
        )
      }
      if (
        !storybookSave?.completed?.includes('sb1') ||
        !storybookSave?.completed?.includes('sb2') ||
        storybookSave?.storyChapterId !== 'sb2' ||
        storybookSave?.chapterBeat !== 0 ||
        storybookSave?.branchId !== null ||
        storybookSave?.branchBeat !== 0 ||
        !storybookSave?.storyFlags?.includes('story:knocked-on-door') ||
        !storybookSave?.storyFlags?.includes('story:old-harbor-address') ||
        storybookSave?.storyTraceCount !== 0 ||
        storybookSave?.choiceCount !== 3 ||
        storybookSave?.secondChoice?.beatId !== 'sb2-b3' ||
        storybookSave?.secondChoice?.optionId !== 'sb2-b3-a' ||
        storybookSave?.secondChoice?.branchId !== 'sb2-door' ||
        storybookSave?.secondChoice?.skipped !== true ||
        !storybookSave?.secondChoice?.storyFlags?.includes(
          'story:knocked-on-door',
        )
      ) {
        auditErrors.push(`剧情本默认分支存档不正确: ${JSON.stringify(storybookSave)}`)
      }
      const catMemory = generationRequest?.memories?.find((memory) =>
        memory?.title?.includes('猫知道的路'),
      )
      const lighthouseMemory = generationRequest?.memories?.find((memory) =>
        memory?.title?.includes('灯塔旧信'),
      )
      if (
        generationRequestCount < 1 ||
        generationRequest?.count !== generationRequestCount ||
        catMemory?.choice !== '敲门问问' ||
        !catMemory?.clue?.includes('story:knocked-on-door') ||
        lighthouseMemory?.choice !== '先送回邮局查地址' ||
        !lighthouseMemory?.clue?.includes('story:letter-to-post') ||
        generationRequest?.continuity?.previousTitle !== '《猫知道的路》'
      ) {
        auditErrors.push(
          `跳过后的生成请求没有承接静态选择: ${JSON.stringify(generationRequest)}`,
        )
      }
      if (
        !closeButtonHitAudit?.buttonPresent ||
        closeButtonHitAudit?.buttonLabel !== '关闭故事续页' ||
        closeButtonHitAudit?.toastCount < 1 ||
        !closeButtonHitAudit?.hitInsideButton
      ) {
        auditErrors.push(
          `提示条遮挡续页关闭按钮: ${JSON.stringify(closeButtonHitAudit)}`,
        )
      }

      for (const event of client.events) {
        if (event.method === 'Runtime.exceptionThrown') {
          auditErrors.push(
            event.params?.exceptionDetails?.exception?.description ?? 'exception',
          )
        }
        if (
          event.method === 'Runtime.consoleAPICalled' &&
          event.params?.type === 'error'
        ) {
          auditErrors.push(
            (event.params.args ?? [])
              .map((arg) => arg.value ?? arg.description)
              .join(' '),
          )
        }
        if (
          event.method === 'Log.entryAdded' &&
          event.params?.entry?.level === 'error'
        ) {
          auditErrors.push(event.params.entry.text)
        }
      }

      console.log(`[${SUFFIX}] 恋爱跳过: ${JSON.stringify(romanceSave)}`)
      console.log(
        `[${SUFFIX}] 剧情本第一章跳过: ${JSON.stringify(afterFirstStorybookSkip)}`,
      )
      console.log(`[${SUFFIX}] 剧情本默认分支: ${JSON.stringify(storybookSave)}`)
      console.log(
        `[${SUFFIX}] 跳过后续写记忆: ${JSON.stringify(generationRequest)}`,
      )
      console.log(
        `[${SUFFIX}] 续页关闭按钮命中: ${JSON.stringify(closeButtonHitAudit)}`,
      )
      console.log(
        `[${SUFFIX}] 跳过章节审计错误: ${
          auditErrors.length ? auditErrors.join(' || ') : '(无)'
        }`,
      )
      if (auditErrors.length) process.exitCode = 1
      return
    }

    const shots = []
    await shoot('01-home')
    shots.push('01-home')

    const openedQuestSheet = await evaluate(`(() => {
      const button = document.querySelector('.home2__quest');
      if (button) button.click();
      return !!button;
    })()`)
    const questSheetReady = await waitForSelector('.modal__title', 1800)
    const questCardAudit = await evaluate(`(() => {
      const modal = document.querySelector('.modal');
      const cards = [...document.querySelectorAll('.task-card')];
      return {
        title: modal?.querySelector('.modal__title')?.textContent?.trim() ?? '',
        viewportWidth: innerWidth,
        modalWidth: modal?.getBoundingClientRect().width ?? 0,
        count: cards.length,
        horizontalOverflow: modal
          ? modal.scrollWidth > modal.clientWidth + 1
          : null,
        cards: cards.map((card) => {
          const title = card.querySelector('.task-card__title');
          const rect = title?.getBoundingClientRect();
          let lines = 0;
          if (title) {
            const range = document.createRange();
            range.selectNodeContents(title);
            lines = new Set(
              [...range.getClientRects()].map((item) => Math.round(item.top)),
            ).size;
          }
          return {
            text: title?.textContent?.trim() ?? '',
            width: rect?.width ?? 0,
            height: rect?.height ?? 0,
            lines,
            cardOverflow: card.scrollWidth > card.clientWidth + 1,
          };
        }),
      };
    })()`)
    await shoot('01a-quest-sheet')
    shots.push('01a-quest-sheet')

    const questContentClose = await evaluate(`(() => {
      const modal = document.querySelector('.modal');
      if (!modal) return { found: false };
      const rect = modal.getBoundingClientRect();
      return {
        found: true,
        x: rect.left + rect.width / 2,
        y: rect.top + 46,
      };
    })()`)
    if (questContentClose?.found) {
      await client.send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: questContentClose.x,
        y: questContentClose.y,
        button: 'left',
        buttons: 1,
        clickCount: 1,
      })
      await client.send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: questContentClose.x,
        y: questContentClose.y,
        button: 'left',
        buttons: 0,
        clickCount: 1,
      })
    }
    await sleep(300)
    const questContentCloseResult = await evaluate(`(() => ({
      modalOpen: !!document.querySelector('.modal[role="dialog"]'),
      homeVisible: !!document.querySelector('.screen--home'),
    }))()`)
    await sleep(250)

    const homeStorybookEntry = await evaluate(`(() => {
      const entry = document.querySelector('.home2__chapter-book');
      const card = entry?.closest('.home2__chapter');
      return {
        visible: !!entry,
        text: entry?.textContent?.trim() ?? '',
        cardLabel: card?.getAttribute('aria-label') ?? '',
        progress:
          card?.querySelector('.home2__chapter-progress')?.textContent?.trim() ?? '',
      };
    })()`)
    const homePetJump = await evaluate(`(() => {
      const button = document.querySelector('.home2__act--sea');
      if (!button) return { found: false };
      const rect = button.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const hit = document.elementFromPoint(x, y);
      const hitButton = hit === button || hit?.closest('.home2__act--sea') === button;
      if (hitButton) hit.closest('.home2__act--sea')?.click();
      return {
        found: true,
        label: button.textContent?.trim() ?? '',
        hitButton,
        hitClass: hit?.getAttribute('class') ?? '',
      };
    })()`)
    const homePetScreenReady = await waitForSelector('.screen--pet', 1800)
    await clickNav('主页')
    const homeRestoredAfterPetJump = await waitForSelector('.screen--home', 1800)

    await clickNav('剧情')
    const storyTypingReady = await waitForSelector('.storybook__speech p', 1800)
    const storyTypingSample = await evaluate(`(async () => {
      const element = document.querySelector('.storybook__speech p');
      if (!element) return null;
      const samples = [];
      const startedAt = performance.now();
      let previous = -1;
      while (performance.now() - startedAt < 1200) {
        const length = (element.textContent ?? '').replace(/\u200b/g, '').length;
        if (length !== previous) {
          samples.push({ at: performance.now() - startedAt, length });
          previous = length;
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
      const elapsed = samples.at(-1)?.at - samples[0]?.at;
      const typedCharacters = samples.at(-1)?.length - samples[0]?.length;
      return {
        samples,
        first: samples.find((sample) => sample.length > 0)?.at ?? null,
        last: samples.at(-1)?.length ?? 0,
        estimatedMsPerCharacter:
          elapsed > 0 && typedCharacters > 0 ? elapsed / typedCharacters : null,
      };
    })()`)
    await shoot('01b-story-typing')
    shots.push('01b-story-typing')
    await clickNav('主页')

    if (questCardAudit?.title !== '今日安排') {
      throw new Error(
        `今日安排未打开: ${JSON.stringify({
          openedQuestSheet,
          questSheetReady,
          questCardAudit,
        })}`,
      )
    }
    if (
      !questSheetReady ||
      questCardAudit.count < 1 ||
      questCardAudit.horizontalOverflow ||
      questCardAudit.cards.some(
        (card) =>
          card.lines !== 1 ||
          card.cardOverflow,
      )
    ) {
      throw new Error(`今日安排任务卡排版异常: ${JSON.stringify(questCardAudit)}`)
    }
    if (
      !questContentClose?.found ||
      questContentCloseResult.modalOpen ||
      !questContentCloseResult.homeVisible
    ) {
      throw new Error(
        `今日安排内容区点击未能返回主页: ${JSON.stringify({
          questContentClose,
          questContentCloseResult,
        })}`,
      )
    }
    if (!storyTypingReady || !storyTypingSample?.estimatedMsPerCharacter) {
      throw new Error(`剧情打字采样失败: ${JSON.stringify(storyTypingSample)}`)
    }
    if (
      storyTypingSample.estimatedMsPerCharacter < 60 ||
      storyTypingSample.estimatedMsPerCharacter > 85
    ) {
      throw new Error(
        `剧情打字速度异常: ${JSON.stringify(storyTypingSample)}`,
      )
    }
    console.log(`[${SUFFIX}] 任务卡审计: ${JSON.stringify(questCardAudit)}`)
    console.log(
      `[${SUFFIX}] 今日安排空白区关闭: ${JSON.stringify(questContentCloseResult)}`,
    )
    console.log(`[${SUFFIX}] 剧情打字审计: ${JSON.stringify(storyTypingSample)}`)

    /* ---------- 营业关卡（咖啡店） ---------- */
    await clickNav('咖啡店')
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('.btn')].find(x => x.textContent.includes('开始营业'));
      if (b) b.click(); return !!b;
    })()`)
    await sleep(700)

    // 走一遍完整循环：接单 → 互动制作 → 上菜 → 清理。
    // 每次点击单独 await，让 React 完成一次渲染。
    const clickBusinessTarget = async (selector, label) => {
      const hit = await evaluate(`(() => {
        const b = document.querySelector(${JSON.stringify(selector)});
        if (b && !b.disabled) { b.click(); return ${JSON.stringify(label)}; }
        return null;
      })()`)
      await sleep(90)
      return hit
    }
    const interactions = []
    for (let i = 0; i < 140; i += 1) {
      const hit =
        (await clickBusinessTarget('.cafe-table__actions .cafe-mini--sea', '接单')) ??
        (await clickBusinessTarget('.cafe-craft__options .cafe-option', '选择')) ??
        (await clickBusinessTarget('.cafe-craft .cafe-action-btn', '制作')) ??
        (await clickBusinessTarget('.cafe-craft .cafe-process:not(:disabled)', '加工')) ??
        (await clickBusinessTarget('.cafe-tray__serve', '上菜')) ??
        (await clickBusinessTarget('.cafe-table--dirty .cafe-mini', '清理'))
      if (hit) interactions.push(hit)
    }
    await sleep(500)
    await shoot('02-business')
    shots.push('02-business')

    // 提前结束 → 结算弹窗（含加载态）
    await evaluate(`(() => {
      const b = document.querySelector('.cafe-run__hud-actions .icon-btn:last-child');
      if (b) b.click(); return !!b;
    })()`)
    await sleep(300)
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('.modal .btn')].find(x => x.textContent.includes('打烊结算'));
      if (b) b.click(); return !!b;
    })()`)
    await sleep(1400)
    await shoot('03-business-result')
    shots.push('03-business-result')
    const resultModal = await evaluate(`(() => {
      const btn = [...document.querySelectorAll('.modal .btn')].find(x => x.textContent.includes('回到准备页'));
      return btn ? { text: btn.textContent, disabled: btn.disabled } : null;
    })()`)
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('.modal .btn')].find(x => x.textContent.includes('回到准备页'));
      if (b) b.click(); return !!b;
    })()`)
    await sleep(300)

    /* ---------- 咖啡馆经营 ---------- */
    await clickNav('咖啡店')
    await shoot('04-cafe-equipment')
    shots.push('04-cafe-equipment')

    if (process.env.CAFE_ACTOR_AUDIT === '1') {
      const dragActorTo = async (actor, targetX, targetY) => {
        const geometry = await evaluate(`(() => {
          const world = document.querySelector('.cafe-play__world').getBoundingClientRect();
          const actor = document.querySelector('[data-actor="${actor}"]').getBoundingClientRect();
          return {
            world: { left: world.left, top: world.top, width: world.width, height: world.height },
            actor: {
              x: actor.left + actor.width * 0.5,
              y: actor.top + actor.height * 0.58,
            },
          };
        })()`)
        const target = {
          x: geometry.world.left + geometry.world.width * (targetX / 100),
          y: geometry.world.top + geometry.world.height * (targetY / 100),
        }
        await client.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          x: geometry.actor.x,
          y: geometry.actor.y,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        })
        await client.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          x: target.x,
          y: target.y,
          button: 'left',
          buttons: 1,
        })
        await sleep(120)
        await client.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          x: target.x,
          y: target.y,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        })
      }

      await dragActorTo('barista', 24, 61)
      await sleep(920)
      const baristaMode = await evaluate(
        `document.querySelector('[data-actor="barista"]')?.dataset.mode`,
      )
      await shoot('05-actor-machine')
      shots.push('05-actor-machine')

      await dragActorTo('cat', 72, 68)
      await sleep(920)
      const catMode = await evaluate(`document.querySelector('[data-actor="cat"]')?.dataset.mode`)
      await shoot('06-actor-customer')
      shots.push('06-actor-customer')

      console.log(
        `[${SUFFIX}] 角色拖拽审计: ${JSON.stringify({ baristaMode, catMode })}`,
      )
      if (baristaMode !== 'work' || catMode !== 'visit') {
        throw new Error(
          `角色拖拽未触发目标动作: barista=${baristaMode}, cat=${catMode}`,
        )
      }
    }

    if (process.env.CAFE_HOTSPOT_AUDIT === '1') {
      const audit = await evaluate(`(async () => {
        const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
        const stamina = () => {
          try { return JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save')).stamina }
          catch { return null }
        };
        const staminaBefore = stamina();
        const buttons = [...document.querySelectorAll('.cafe-hotspot')];
        const tableIds = new Set(['table-left', 'table-mid', 'table-front']);
        const ordered = [
          ...buttons.filter((button) => !tableIds.has(button.dataset.spot)),
          ...buttons.filter((button) => tableIds.has(button.dataset.spot)),
        ];
        const misses = [];
        for (const button of ordered) {
          button.click();
          await sleep(55);
          const spot = button.dataset.spot;
          const feedback =
            document.querySelector('.cafe-play__fx') ||
            document.querySelector('.cafe-play__sheet');
          if (!feedback) misses.push(spot);
        }
        await sleep(220);
        return {
          total: ordered.length,
          checked: ordered.length - misses.length,
          misses,
          staminaBefore,
          staminaAfter: stamina(),
        };
      })()`)
      console.log(`[${SUFFIX}] 经营热区审计: ${JSON.stringify(audit)}`)
      if (audit?.misses?.length) {
        throw new Error(`经营热区无反馈: ${audit.misses.join(', ')}`)
      }
      if (audit?.staminaBefore !== audit?.staminaAfter) {
        throw new Error(`点击场景图标消耗了体力: ${audit.staminaBefore} -> ${audit.staminaAfter}`)
      }
      return
    }

    const clickTab = async (label) => {
      await evaluate(`(() => {
        const t = [...document.querySelectorAll('.tabs__item')].find(x => x.textContent.includes(${JSON.stringify(label)}));
        if (t) t.click(); return !!t;
      })()`)
      await sleep(350)
    }
    await clickTab('菜单')
    await shoot('05-cafe-menu')
    shots.push('05-cafe-menu')
    await clickTab('装饰')
    await shoot('06-cafe-decor')
    shots.push('06-cafe-decor')

    /* ---------- 宠物互动 ---------- */
    await clickNav('宠物')
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('.pet-action .btn')][0];
      if (b) b.click(); return !!b;
    })()`)
    await sleep(1100)
    await shoot('07-pet')
    shots.push('07-pet')

    /* ---------- 恋爱主线 ---------- */
    await clickNav('恋爱')
    const clickContinue = async () => {
      await evaluate(`(() => {
        const b = [...document.querySelectorAll('.btn')].find(x => x.textContent.includes('继续'));
        if (b) b.click(); return !!b;
      })()`)
      await sleep(360)
    }
    for (let i = 0; i < 12; i += 1) await clickContinue()
    await shoot('08-story-choice')
    shots.push('08-story-choice')

    await evaluate(`(() => {
      const b = document.querySelector('.story-option');
      if (b) { b.click(); return b.textContent; }
      return null;
    })()`)
    await sleep(450)
    await shoot('09-story-reply')
    shots.push('09-story-reply')

    /* ---------- 章节末尾无缝续写 ---------- */
    await clickNav('剧情')
    let continuationTriggered = null
    for (let step = 0; step < 30; step += 1) {
      const pageState = await evaluate(`(() => {
        if (document.querySelector('.storybook__draft')) {
          return { kind: 'draft' };
        }
        const option = document.querySelector('.storybook__option');
        if (option) return { kind: 'option' };
        const next = document.querySelector('.storybook__next:not(:disabled)');
        if (next) return { kind: 'next' };
        const page = document.querySelector('.storybook__page[role="button"]');
        if (page) return { kind: 'page' };
        return {
          kind: 'waiting',
          page: document.querySelector('.storybook__page')?.innerText ?? '',
        };
      })()`)

      if (pageState?.kind === 'draft') {
        continuationTriggered = { ok: true, step }
        break
      }

      if (pageState?.kind === 'option') {
        await evaluate(`document.querySelector('.storybook__option')?.click()`)
      } else if (pageState?.kind === 'next') {
        await evaluate(`document.querySelector('.storybook__next:not(:disabled)')?.click()`)
      } else if (pageState?.kind === 'page') {
        await evaluate(`document.querySelector('.storybook__page[role="button"]')?.click()`)
      }
      await sleep(220)
    }
    if (!continuationTriggered) {
      continuationTriggered = await evaluate(`({
        ok: false,
        page: document.querySelector('.storybook__page')?.innerText ?? '',
        draft: !!document.querySelector('.storybook__draft'),
      })`)
    }
    const draftReady = await waitForSelector('.storybook__draft-reader-beat', 6000)
    await evaluate(`(() => {
      const next = document.querySelector(
        '.storybook__draft-reader-footer .storybook__next',
      );
      if (next?.getAttribute('aria-label') === '显示完整句子') {
        next.click();
        return true;
      }
      return false;
    })()`)
    for (let step = 0; step < 12; step += 1) {
      const label = await evaluate(`document.querySelector(
        '.storybook__draft-reader-footer .storybook__next',
      )?.getAttribute('aria-label') ?? ''`)
      if (label === '翻到下一页') break
      await sleep(100)
    }
    await sleep(160)
    await shoot('10-story-continuation-ready')
    shots.push('10-story-continuation-ready')

    const draftGeometry = await evaluate(`(() => {
      const layer = document.querySelector('.storybook__draft-layer');
      const draft = document.querySelector('.storybook__draft');
      if (!layer || !draft) return null;
      const rect = draft.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight },
        rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
        optionCount: document.querySelectorAll('.storybook__draft-reader-option').length,
        paragraphCount: document.querySelectorAll('.storybook__draft-reader-beat p').length,
        title:
          document.querySelector(
            '.storybook__draft-reader-chapterbar .storybook__chapter-copy strong',
          )?.textContent ?? '',
        progress:
          document.querySelector('.storybook__draft-reader-chapterbar .storybook__chapter-progress')
            ?.textContent ?? '',
        pipCount: document.querySelectorAll('.storybook__draft-reader-footer .storybook__pip').length,
        horizontalOverflow: document.documentElement.scrollWidth > innerWidth,
        visibleText: document.querySelector('.storybook__draft')?.innerText ?? '',
      };
    })()`)

    const advanceDraftToChoice = async () => {
      for (let step = 0; step < 20; step += 1) {
        const state = await evaluate(`(() => ({
          choice: !!document.querySelector('.storybook__draft-reader-option'),
          nextLabel:
            document.querySelector(
              '.storybook__draft-reader-footer .storybook__next',
            )?.getAttribute('aria-label') ?? '',
          title:
            document.querySelector(
              '.storybook__draft-reader-chapterbar .storybook__chapter-copy strong',
            )?.textContent ?? '',
        }))()`)
        if (state?.choice) return state
        if (state?.nextLabel) {
          await evaluate(`document.querySelector(
            '.storybook__draft-reader-footer .storybook__next',
          )?.click()`)
        }
        await sleep(180)
      }
      return null
    }

    const firstChoiceReady = await advanceDraftToChoice()
    await sleep(180)
    await shoot('10b-story-continuation-choice')
    shots.push('10b-story-continuation-choice')

    const storyRequestCount = async () =>
      evaluate(`performance.getEntriesByType('resource').filter(
        (entry) => entry.name.includes('/api/story/generate'),
      ).length`)
    const requestsBeforeChoice = await storyRequestCount()
    const choseDraft = await evaluate(`(() => {
      const b = document.querySelector('.storybook__draft-reader-option');
      if (b) b.click();
      return !!b;
    })()`)
    const outcomeReady = await waitForSelector('.storybook__draft-reader-outcome', 2500)
    await completeDraftText('.storybook__draft-reader-outcome')
    await sleep(160)
    await shoot('11-story-continuation-outcome')
    shots.push('11-story-continuation-outcome')

    const firstDraftOutcome = await evaluate(`(() => ({
      title:
        document.querySelector(
          '.storybook__draft-reader-chapterbar .storybook__chapter-copy strong',
        )?.textContent ?? '',
      text: document.querySelector('.storybook__draft-reader-outcome p')?.textContent ?? '',
    }))()`)
    let requestsAfterChoice = requestsBeforeChoice
    for (let step = 0; step < 50; step += 1) {
      requestsAfterChoice = await storyRequestCount()
      if (requestsAfterChoice > requestsBeforeChoice) break
      await sleep(200)
    }

    const continueToNextStory = async () => {
      for (let step = 0; step < 12; step += 1) {
        const state = await evaluate(`(() => {
          const layers = [...document.querySelectorAll('.storybook__draft-layer')];
          const layer = layers[layers.length - 1];
          return {
            title:
              layer
                ?.querySelector('.storybook__draft-reader-chapterbar .storybook__chapter-copy strong')
                ?.textContent ?? '',
            loading: !!layer?.querySelector('.storybook__draft-reader-state'),
            nextLabel:
              layer
                ?.querySelector('.storybook__draft-reader-footer .storybook__next')
                ?.getAttribute('aria-label') ?? '',
          };
        })()`)
        if (state?.title && state.title !== firstDraftOutcome?.title && !state.loading) return true
        if (state?.nextLabel) {
          await clickTopLayerNext()
        }
        await sleep(220)
      }
      return false
    }

    const continuedToNextPage = await continueToNextStory()
    const requestsAfterContinue = await storyRequestCount()
    const secondDraftReady = await waitForSelector('.storybook__draft-reader-beat', 6000)
    const secondDraftTitle = await evaluate(
      `(() => {
        const layers = [...document.querySelectorAll('.storybook__draft-layer')];
        const layer = layers[layers.length - 1];
        return layer?.querySelector(
          '.storybook__draft-reader-chapterbar .storybook__chapter-copy strong',
        )?.textContent ?? '';
      })()`,
    )
    const secondChoiceReady = await advanceDraftToChoice()
    const storyCacheBeforeSecondChoice = await evaluate(`(() => {
      try {
        const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
        return {
          length: Array.isArray(save?.storyCache) ? save.storyCache.length : 0,
          storyTurn: save?.storyTurn ?? 0,
        };
      } catch {
        return null;
      }
    })()`)
    const choseSecondDraft = await evaluate(`(() => {
      const b = document.querySelector('.storybook__draft-reader-option');
      if (b) b.click();
      return !!b;
    })()`)
    const secondOutcomeReady = await waitForSelector('.storybook__draft-reader-outcome', 2500)
    await completeDraftText('.storybook__draft-reader-outcome')
    await sleep(160)
    await shoot('12-story-second-outcome')
    shots.push('12-story-second-outcome')
    const secondDraftOutcome = await evaluate(`(() => ({
      title: (() => {
        const layers = [...document.querySelectorAll('.storybook__draft-layer')];
        const layer = layers[layers.length - 1];
        return layer?.querySelector(
          '.storybook__draft-reader-chapterbar .storybook__chapter-copy strong',
        )?.textContent ?? '';
      })(),
      text: (() => {
        const layers = [...document.querySelectorAll('.storybook__draft-layer')];
        const layer = layers[layers.length - 1];
        return layer?.querySelector('.storybook__draft-reader-outcome p')?.textContent ?? '';
      })(),
    }))()`)
    let persistedContinuationCache = null
    for (let step = 0; step < 50; step += 1) {
      persistedContinuationCache = await evaluate(`(() => {
        try {
          const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
          const cache = Array.isArray(save?.storyCache) ? save.storyCache : [];
          const latestTrace = save?.storyTraces?.[0] ?? null;
          return {
            length: cache.length,
            storyTurn: save?.storyTurn ?? 0,
            storyTraceId: save?.storyTraceId ?? null,
            latestTraceTitle: latestTrace?.title ?? '',
            top: cache[0]
              ? {
                  key: cache[0].key,
                  at: cache[0].at,
                  title: cache[0].story?.title ?? '',
                  id: cache[0].story?.id ?? '',
                }
              : null,
          };
        } catch {
          return null;
        }
      })()`)
      if (
        (persistedContinuationCache?.length ?? 0) >
          (storyCacheBeforeSecondChoice?.length ?? 0) &&
        persistedContinuationCache?.top?.key &&
        persistedContinuationCache?.top?.title
      ) {
        break
      }
      await sleep(200)
    }

    const storyTraceAudit = await evaluate(`(() => {
      try {
        const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
        const traces = save?.storyTraces ?? [];
        return {
          count: traces.length,
          storyTurn: save?.storyTurn ?? 0,
          storyTraceId: save?.storyTraceId ?? null,
          ids: traces.slice(0, 2).map((trace) => trace.id),
          titles: traces.slice(0, 2).map((trace) => trace.title),
          first: traces[0]
            ? {
                title: traces[0].title,
                chapterIndex: traces[0].chapterIndex,
                choice: traces[0].choice,
                outcome: traces[0].outcome,
                clue: traces[0].clue,
                beatCount: traces[0].beats?.length ?? 0,
                choiceCount: traces[0].choices?.length ?? 0,
                selectedChoiceId: traces[0].selectedChoiceId,
              }
            : null,
        };
      } catch {
        return null;
      }
    })()`)
    const topDraftClosed = await evaluate(`(() => {
      const layers = [...document.querySelectorAll('.storybook__draft-layer')];
      const topLayer = layers[layers.length - 1];
      const button = topLayer?.querySelector('.storybook__draft-reader-close');
      if (button) button.click();
      return {
        layerCount: layers.length,
        ariaLabel: topLayer?.getAttribute('aria-label') ?? '',
        closed: !!button,
      };
    })()`)
    await sleep(260)
    const openedCatalogFromArchive = await evaluate(`(() => {
      const button = document.querySelector(
        '.storybook__archive .storybook__draft-reader-close',
      );
      if (button) button.click();
      return !!button;
    })()`)
    const catalogReady = await waitForSelector('.storybook__catalog', 2500)
    await shoot('13-story-catalog')
    shots.push('13-story-catalog')
    const dynamicCatalogAudit = await evaluate(`(() => {
      const items = [...document.querySelectorAll('.storybook__catalog-item--continuation')];
      return {
        count: items.length,
        currentIndex:
          items
            .find((item) => item.getAttribute('aria-current') === 'page')
            ?.querySelector('.storybook__catalog-index')?.textContent?.trim() ?? '',
        staticCurrentCount: document.querySelectorAll(
          '.storybook__catalog-item:not(.storybook__catalog-item--continuation)[aria-current="page"]',
        ).length,
        chapters: items.map((item) => ({
          index: item.querySelector('.storybook__catalog-index')?.textContent?.trim() ?? '',
          title: item.querySelector('.storybook__catalog-copy strong')?.textContent?.trim() ?? '',
        })),
      };
    })()`)
    const openedFirstDynamicChapter = await evaluate(`(() => {
      const item = document.querySelector('.storybook__catalog-item--continuation');
      if (item) item.click();
      return !!item;
    })()`)
    const archiveReady = await waitForSelector('.storybook__archive', 2500)
    await sleep(450)
    const storyNavAudit = await auditStoryNav()
    const archiveAudit = await evaluate(`(() => ({
      chapter:
        document.querySelector(
          '.storybook__archive .storybook__chapter-index',
        )?.textContent?.trim() ?? '',
      title:
        document.querySelector(
          '.storybook__archive .storybook__chapter-copy strong',
        )?.textContent?.trim() ?? '',
      hasText: !!document.querySelector('.storybook__archive .storybook__speech p'),
      progress:
        document.querySelector(
          '.storybook__archive .storybook__chapter-progress',
        )?.textContent?.trim() ?? '',
      staticPageVisible: !!document.querySelector('.storybook__page'),
    }))()`)
    await shoot('13a-story-reader-entry')
    shots.push('13a-story-reader-entry')
    const openedCatalogFromReaderTopbar = await evaluate(`(() => {
      const button = document.querySelector(
        '.storybook__topbar--reading .storybook__brand',
      );
      if (button) button.click();
      return {
        visible: !!button,
        label: button?.getAttribute('aria-label') ?? '',
      };
    })()`)
    const readerCatalogReady = await waitForSelector('.storybook__catalog', 2500)
    const readerTopbarCatalogAudit = await evaluate(`(() => ({
      catalogOpen: !!document.querySelector('.storybook__catalog'),
      currentIndex:
        document.querySelector(
          '.storybook__catalog-item--continuation[aria-current="page"] .storybook__catalog-index',
        )?.textContent?.trim() ?? '',
      brandVisible:
        !!document.querySelector('.storybook__topbar--reading .storybook__brand'),
    }))()`)
    const readerCatalogClosed = await evaluate(`(() => {
      const button = document.querySelector(
        '.storybook__catalog-head .storybook__icon-btn',
      );
      if (button) button.click();
      return !!button;
    })()`)
    await sleep(220)
    const readerRestoredAudit = await evaluate(`(() => ({
      catalogOpen: !!document.querySelector('.storybook__catalog'),
      brandVisible:
        !!document.querySelector('.storybook__topbar--reading .storybook__brand'),
      chapter:
        document.querySelector(
          '.storybook__archive .storybook__chapter-index',
        )?.textContent?.trim() ?? '',
      title:
        document.querySelector(
          '.storybook__archive .storybook__chapter-copy strong',
        )?.textContent?.trim() ?? '',
      staticPageVisible: !!document.querySelector('.storybook__page'),
    }))()`)

    const advanceArchivePage = async () => {
      const before = await evaluate(`document.querySelector(
        '.storybook__archive .storybook__chapter-progress',
      )?.textContent?.trim() ?? ''`)
      for (let step = 0; step < 8; step += 1) {
        const state = await evaluate(`(() => {
          const layers = [...document.querySelectorAll('.storybook__draft-layer')];
          const layer = layers[layers.length - 1];
          const archive = layer?.querySelector('.storybook__archive');
          return {
            progress:
              archive?.querySelector('.storybook__chapter-progress')?.textContent?.trim() ?? '',
            hasEndActions: !!archive?.querySelector('.storybook__archive-return'),
            caret: !!archive?.querySelector('.storybook__caret'),
            nextLabel:
              archive
                ?.querySelector('.storybook__draft-reader-footer .storybook__next')
                ?.getAttribute('aria-label') ?? '',
          };
        })()`)
        if (state?.progress && state.progress !== before) return state.progress
        if (state?.hasEndActions || !state?.nextLabel) return state?.progress ?? before
        await clickTopLayerNext()
        await sleep(120)
      }
      return before
    }

    const preservedProgress = await advanceArchivePage()
    const closedArchiveToCatalog = await evaluate(`(() => {
      const button = document.querySelector(
        '.storybook__archive .storybook__draft-reader-close',
      );
      if (button) button.click();
      return !!button;
    })()`)
    const catalogRestored = await waitForSelector('.storybook__catalog', 2500)
    const catalogAfterReopen = await evaluate(`(() => {
      const items = [...document.querySelectorAll('.storybook__catalog-item--continuation')];
      return {
        currentIndex:
          items
            .find((item) => item.getAttribute('aria-current') === 'page')
            ?.querySelector('.storybook__catalog-index')?.textContent?.trim() ?? '',
        staticCurrentCount: document.querySelectorAll(
          '.storybook__catalog-item:not(.storybook__catalog-item--continuation)[aria-current="page"]',
        ).length,
      };
    })()`)
    const catalogClosed = await evaluate(`(() => {
      const button = document.querySelector(
        '.storybook__catalog-head .storybook__icon-btn',
      );
      if (button) button.click();
      return !!button;
    })()`)
    await sleep(220)
    const restoredArchiveAudit = await evaluate(`(() => ({
      catalogOpen: !!document.querySelector('.storybook__catalog'),
      chapter:
        document.querySelector(
          '.storybook__archive .storybook__chapter-index',
        )?.textContent?.trim() ?? '',
      title:
        document.querySelector(
          '.storybook__archive .storybook__chapter-copy strong',
        )?.textContent?.trim() ?? '',
      progress:
        document.querySelector(
          '.storybook__archive .storybook__chapter-progress',
        )?.textContent?.trim() ?? '',
      staticPageVisible: !!document.querySelector('.storybook__page'),
    }))()`)

    const advanceArchiveToEnd = async () => {
      for (let step = 0; step < 18; step += 1) {
        const state = await evaluate(`(() => {
          const layers = [...document.querySelectorAll('.storybook__draft-layer')];
          const layer = layers[layers.length - 1];
          const archive = layer?.querySelector('.storybook__archive');
          return {
            returnVisible: !!archive?.querySelector('.storybook__archive-return'),
            primaryLabel:
              archive?.querySelector('.storybook__archive-action')?.textContent?.trim() ?? '',
            returnLabel:
              archive?.querySelector('.storybook__archive-return')?.textContent?.trim() ?? '',
            progress:
              archive?.querySelector('.storybook__chapter-progress')?.textContent?.trim() ?? '',
            nextVisible: !!archive?.querySelector(
              '.storybook__draft-reader-footer .storybook__next',
            ),
          };
        })()`)
        if (state?.returnVisible) return state
        if (state?.nextVisible) {
          await clickTopLayerNext()
        }
        await sleep(120)
      }
      return null
    }

    const firstChapterEndAudit = await advanceArchiveToEnd()
    await shoot('13b-story-catalog-archive-end')
    shots.push('13b-story-catalog-archive-end')
    const openedNextDynamicChapter = await evaluate(`(() => {
      const button = document.querySelector('.storybook__archive-action');
      if (button) button.click();
      return button?.textContent?.trim() ?? '';
    })()`)
    await sleep(220)
    const nextArchiveAudit = await evaluate(`(() => ({
      chapter:
        document.querySelector(
          '.storybook__archive .storybook__chapter-index',
        )?.textContent?.trim() ?? '',
      title:
        document.querySelector(
          '.storybook__archive .storybook__chapter-copy strong',
        )?.textContent?.trim() ?? '',
      progress:
        document.querySelector(
          '.storybook__archive .storybook__chapter-progress',
        )?.textContent?.trim() ?? '',
    }))()`)
    const secondChapterEndAudit = await advanceArchiveToEnd()
    await shoot('13b-story-catalog-archive')
    shots.push('13b-story-catalog-archive')
    await shoot('13c-story-catalog-latest-end')
    shots.push('13c-story-catalog-latest-end')
    const cacheBeforeRefresh = await evaluate(`(() => {
      try {
        const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
        const cache = Array.isArray(save?.storyCache) ? save.storyCache : [];
        return {
          length: cache.length,
          storyTurn: save?.storyTurn ?? 0,
          storyTraceId: save?.storyTraceId ?? null,
          top: cache[0]
            ? {
                key: cache[0].key,
                at: cache[0].at,
                title: cache[0].story?.title ?? '',
                id: cache[0].story?.id ?? '',
              }
            : null,
        };
      } catch {
        return null;
      }
    })()`)
    await client.send('Page.reload', { ignoreCache: true })
    await sleep(2200)
    const refreshedShellReady = await waitForSelector('.nav__item', 5000)
    await clickNav('剧情')
    const refreshedArchiveReady = await waitForSelector('.storybook__archive', 5000)
    const refreshedArchiveAudit = await evaluate(`(() => ({
      chapter:
        document.querySelector(
          '.storybook__archive .storybook__chapter-index',
        )?.textContent?.trim() ?? '',
      title:
        document.querySelector(
          '.storybook__archive .storybook__chapter-copy strong',
        )?.textContent?.trim() ?? '',
      cache: (() => {
        try {
          const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
          const cache = Array.isArray(save?.storyCache) ? save.storyCache : [];
          return {
            length: cache.length,
            storyTurn: save?.storyTurn ?? 0,
            storyTraceId: save?.storyTraceId ?? null,
            top: cache[0]
              ? {
                  key: cache[0].key,
                  at: cache[0].at,
                  title: cache[0].story?.title ?? '',
                  id: cache[0].story?.id ?? '',
                }
              : null,
          };
        } catch {
          return null;
        }
      })(),
    }))()`)
    const refreshedChapterEndAudit = await advanceArchiveToEnd()
    const requestsBeforeRefreshedContinue = await storyRequestCount()
    const continuedFromArchive = await evaluate(`(() => {
      const button = document.querySelector('.storybook__archive-action');
      if (button) button.click();
      return button?.textContent?.trim() ?? '';
    })()`)
    const continuationLayerReady = await waitForSelector(
      '.storybook__draft-layer[aria-label="故事续页"]',
      2500,
    )
    let cachedContinuationReady = false
    for (let step = 0; step < 25; step += 1) {
      cachedContinuationReady = await evaluate(`(() => {
        const layers = [...document.querySelectorAll('.storybook__draft-layer')];
        const topLayer = layers[layers.length - 1];
        return (
          topLayer?.getAttribute('aria-label') === '故事续页' &&
          !!topLayer.querySelector(
            '.storybook__draft-reader-chapterbar .storybook__chapter-copy strong',
          )
        );
      })()`)
      if (cachedContinuationReady) break
      await sleep(200)
    }
    const cachedContinuationTitle = await evaluate(`(() => {
      const layers = [...document.querySelectorAll('.storybook__draft-layer')];
      const topLayer = layers[layers.length - 1];
      return topLayer?.querySelector(
        '.storybook__draft-reader-chapterbar .storybook__chapter-copy strong',
      )?.textContent?.trim() ?? '';
    })()`)
    let requestsAfterRefreshedContinue = requestsBeforeRefreshedContinue
    for (let step = 0; step < 20; step += 1) {
      await sleep(100)
      requestsAfterRefreshedContinue = await storyRequestCount()
      if (requestsAfterRefreshedContinue > requestsBeforeRefreshedContinue) break
    }
    const cacheAfterRefreshedContinue = await evaluate(`(() => {
      try {
        const save = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
        const cache = Array.isArray(save?.storyCache) ? save.storyCache : [];
        return {
          length: cache.length,
          storyTurn: save?.storyTurn ?? 0,
          storyTraceId: save?.storyTraceId ?? null,
          top: cache[0]
            ? {
                key: cache[0].key,
                at: cache[0].at,
                title: cache[0].story?.title ?? '',
                id: cache[0].story?.id ?? '',
              }
            : null,
        };
      } catch {
        return null;
      }
    })()`)
    await shoot('13d-story-cache-after-refresh')
    shots.push('13d-story-cache-after-refresh')
    await sleep(180)
    const continuationLayerAudit = await evaluate(`(() => {
      const layers = [...document.querySelectorAll('.storybook__draft-layer')];
      const topLayer = layers[layers.length - 1];
      const hit = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return {
        count: layers.length,
        ariaLabel: topLayer?.getAttribute('aria-label') ?? '',
        topmost:
          !!topLayer &&
          !!hit?.closest('.storybook__draft-layer') &&
          hit.closest('.storybook__draft-layer') === topLayer,
        loadingOrReady: !!topLayer?.querySelector(
          '.storybook__draft-reader-state, .storybook__draft-reader-beat',
        ),
      };
    })()`)
    await evaluate(`(() => {
      const layers = [...document.querySelectorAll('.storybook__draft-layer')];
      const topLayer = layers[layers.length - 1];
      topLayer?.querySelector('.storybook__draft-reader-close')?.click();
    })()`)
    await sleep(180)
    const savedStoryTraceId = await evaluate(`(() => {
      try {
        return JSON.parse(
          localStorage.getItem('seabreeze-pet-cafe.save'),
        )?.storyTraceId ?? null;
      } catch {
        return null;
      }
    })()`)

    if (!continuationTriggered?.ok) {
      errors.push(`章节末尾没有自动进入续页: ${JSON.stringify(continuationTriggered)}`)
    }
    if (!draftReady) errors.push('下一情节生成后没有出现简洁阅读页')
    if (!firstChoiceReady) errors.push('逐段阅读后没有进入剧情选择')
    if (!choseDraft) errors.push('下一情节的选择没有写入')
    if (!outcomeReady) errors.push('选择下一情节后没有出现结果页')
    if (requestsAfterChoice <= requestsBeforeChoice) {
      errors.push('选择后没有启动下一章后台预生成')
    }
    if (!continuedToNextPage) errors.push('结果页没有继续生成下一情节')
    if (requestsAfterContinue !== requestsAfterChoice) {
      errors.push('继续下一情节没有命中预生成缓存，产生了重复请求')
    }
    if (!secondDraftReady) errors.push('继续后没有出现新的简洁阅读页')
    if (!secondChoiceReady) errors.push('第二篇剧情没有进入选择')
    if (!choseSecondDraft) errors.push('第二次剧情选择没有写入')
    if (!secondOutcomeReady) errors.push('第二次剧情选择后没有出现结果页')
    if ((storyTraceAudit?.count ?? 0) < 2) errors.push('连续两段剧情没有写入 storyTraces')
    if ((storyTraceAudit?.storyTurn ?? 0) < 2) errors.push('剧情推进计数没有增长')
    if (
      (persistedContinuationCache?.length ?? 0) <=
        (storyCacheBeforeSecondChoice?.length ?? 0) ||
      (persistedContinuationCache?.storyTurn ?? 0) <=
        (storyCacheBeforeSecondChoice?.storyTurn ?? 0) ||
      !persistedContinuationCache?.top?.key?.startsWith('story_') ||
      !persistedContinuationCache?.top?.id ||
      !persistedContinuationCache?.top?.title
    ) {
      errors.push(
        `第二次选择后没有写入持久续章缓存: ${JSON.stringify({
          storyCacheBeforeSecondChoice,
          persistedContinuationCache,
        })}`,
      )
    }
    if (persistedContinuationCache?.latestTraceTitle !== storyTraceAudit?.first?.title) {
      errors.push(
        `持久续章缓存没有记录最新剧情痕迹: ${JSON.stringify({
          latestTraceTitle: persistedContinuationCache?.latestTraceTitle,
          expected: storyTraceAudit?.first?.title,
        })}`,
      )
    }
    if (storyNavAudit?.auditErrors?.length) {
      errors.push(...storyNavAudit.auditErrors)
    }
    if (!storyNavAudit?.storyRestored) {
      errors.push('剧情页主入口切换审计没有恢复到剧情页')
    }
    if (storyTraceAudit?.first?.chapterIndex !== 4) {
      errors.push(`最新动态章节序号应接着剧情本为 CH.04，实际 ${storyTraceAudit?.first?.chapterIndex}`)
    }
    if ((storyTraceAudit?.first?.beatCount ?? 0) < 3) {
      errors.push('动态剧情没有保存完整正文快照')
    }
    if (
      storyTraceAudit?.first?.choiceCount !== 2 ||
      !storyTraceAudit?.first?.selectedChoiceId
    ) {
      errors.push('动态剧情没有保存选择快照')
    }
    if (dynamicCatalogAudit?.count !== 2) {
      errors.push(`剧情本目录应收录全部 2 个动态章节，实际 ${dynamicCatalogAudit?.count ?? 0} 个`)
    }
    if (
      dynamicCatalogAudit?.chapters?.[0]?.index !== 'CH.03' ||
      dynamicCatalogAudit?.chapters?.[1]?.index !== 'CH.04'
    ) {
      errors.push(`动态章节序号没有连续补入剧情本: ${JSON.stringify(dynamicCatalogAudit?.chapters)}`)
    }
    if (
      dynamicCatalogAudit?.chapters?.[0]?.title !== firstDraftOutcome?.title ||
      dynamicCatalogAudit?.chapters?.[1]?.title !== secondDraftOutcome?.title
    ) {
      errors.push(`剧情本目录标题与生成章节不一致: ${JSON.stringify(dynamicCatalogAudit?.chapters)}`)
    }
    if (!openedFirstDynamicChapter || !archiveReady) {
      errors.push('点击剧情本中的动态章节后没有打开正文回看')
    }
    if (!topDraftClosed?.closed || topDraftClosed?.ariaLabel !== '故事续页') {
      errors.push(`关闭最新续页时没有准确命中顶层: ${JSON.stringify(topDraftClosed)}`)
    }
    if (!openedCatalogFromArchive || !catalogReady) {
      errors.push('关闭动态章节回看后没有打开章节目录')
    }
    if (
      dynamicCatalogAudit?.currentIndex !== 'CH.04' ||
      dynamicCatalogAudit?.staticCurrentCount !== 0
    ) {
      errors.push(`目录当前项标识错误: ${JSON.stringify(dynamicCatalogAudit)}`)
    }
    if (
      archiveAudit?.chapter !== 'CH.03' ||
      archiveAudit?.title !== firstDraftOutcome?.title ||
      !archiveAudit?.hasText ||
      archiveAudit?.staticPageVisible
    ) {
      errors.push(`动态章节回看内容不完整: ${JSON.stringify(archiveAudit)}`)
    }
    if (
      !openedCatalogFromReaderTopbar?.visible ||
      openedCatalogFromReaderTopbar?.label !== '打开章节目录' ||
      !readerCatalogReady ||
      !readerTopbarCatalogAudit?.catalogOpen ||
      readerTopbarCatalogAudit?.currentIndex !== 'CH.03'
    ) {
      errors.push(
        `动态章节左上角剧情本入口不可用: ${JSON.stringify({
          openedCatalogFromReaderTopbar,
          readerCatalogReady,
          readerTopbarCatalogAudit,
        })}`,
      )
    }
    if (
      !readerCatalogClosed ||
      readerRestoredAudit?.catalogOpen ||
      !readerRestoredAudit?.brandVisible ||
      readerRestoredAudit?.chapter !== 'CH.03' ||
      readerRestoredAudit?.title !== firstDraftOutcome?.title ||
      readerRestoredAudit?.staticPageVisible
    ) {
      errors.push(
        `关闭动态章节目录后没有恢复原阅读页: ${JSON.stringify(readerRestoredAudit)}`,
      )
    }
    if (
      !closedArchiveToCatalog ||
      !catalogRestored ||
      catalogAfterReopen?.currentIndex !== 'CH.03' ||
      catalogAfterReopen?.staticCurrentCount !== 0
    ) {
      errors.push(`关闭目录前没有保留动态章节选中态: ${JSON.stringify(catalogAfterReopen)}`)
    }
    if (
      !catalogClosed ||
      restoredArchiveAudit?.catalogOpen ||
      restoredArchiveAudit?.chapter !== 'CH.03' ||
      restoredArchiveAudit?.title !== firstDraftOutcome?.title ||
      restoredArchiveAudit?.progress !== preservedProgress ||
      restoredArchiveAudit?.staticPageVisible
    ) {
      errors.push(`关闭章节目录后没有恢复原动态章节: ${JSON.stringify(restoredArchiveAudit)}`)
    }
    if (
      firstChapterEndAudit?.primaryLabel !== '查看下一章' ||
      firstChapterEndAudit?.returnLabel !== '返回剧情本'
    ) {
      errors.push(`旧动态章节末页入口不正确: ${JSON.stringify(firstChapterEndAudit)}`)
    }
    if (
      openedNextDynamicChapter !== '查看下一章' ||
      nextArchiveAudit?.chapter !== 'CH.04' ||
      nextArchiveAudit?.title !== secondDraftOutcome?.title
    ) {
      errors.push(`动态章节无法顺序续读: ${JSON.stringify(nextArchiveAudit)}`)
    }
    if (
      secondChapterEndAudit?.primaryLabel !== '继续下一情节' ||
      secondChapterEndAudit?.returnLabel !== '返回剧情本'
    ) {
      errors.push(`最新动态章节末页缺少后续剧情入口: ${JSON.stringify(secondChapterEndAudit)}`)
    }
    if (
      !refreshedShellReady ||
      !refreshedArchiveReady ||
      refreshedArchiveAudit?.chapter !== 'CH.04' ||
      refreshedArchiveAudit?.title !== secondDraftOutcome?.title
    ) {
      errors.push(
        `刷新后没有恢复最新动态章节: ${JSON.stringify({
          refreshedShellReady,
          refreshedArchiveReady,
          refreshedArchiveAudit,
          expectedTitle: secondDraftOutcome?.title,
        })}`,
      )
    }
    if (
      cacheBeforeRefresh?.top?.key !== persistedContinuationCache?.top?.key ||
      cacheBeforeRefresh?.top?.id !== persistedContinuationCache?.top?.id ||
      cacheBeforeRefresh?.top?.key !== refreshedArchiveAudit?.cache?.top?.key ||
      cacheBeforeRefresh?.top?.id !== refreshedArchiveAudit?.cache?.top?.id ||
      cacheBeforeRefresh?.top?.title !== refreshedArchiveAudit?.cache?.top?.title ||
      cacheBeforeRefresh?.storyTraceId !== refreshedArchiveAudit?.cache?.storyTraceId
    ) {
      errors.push(
        `刷新前后持久剧情缓存不一致: ${JSON.stringify({
          persistedContinuationCache,
          cacheBeforeRefresh,
          cacheAfterRefresh: refreshedArchiveAudit?.cache,
        })}`,
      )
    }
    if (refreshedChapterEndAudit?.primaryLabel !== '继续下一情节') {
      errors.push(
        `刷新后的动态章节末页缺少后续剧情入口: ${JSON.stringify(refreshedChapterEndAudit)}`,
      )
    }
    if (
      !cachedContinuationReady ||
      cachedContinuationTitle !== `《${cacheBeforeRefresh?.top?.title ?? ''}》`
    ) {
      errors.push(
        `刷新后没有从持久缓存打开续页: ${JSON.stringify({
          cachedContinuationReady,
          cachedContinuationTitle,
          expectedTitle: `《${cacheBeforeRefresh?.top?.title ?? ''}》`,
        })}`,
      )
    }
    if (requestsAfterRefreshedContinue !== requestsBeforeRefreshedContinue) {
      errors.push(
        `刷新后继续读取没有命中持久缓存: ${JSON.stringify({
          requestsBeforeRefreshedContinue,
          requestsAfterRefreshedContinue,
        })}`,
      )
    }
    if (
      cacheAfterRefreshedContinue?.length !== cacheBeforeRefresh?.length ||
      cacheAfterRefreshedContinue?.top?.key !== cacheBeforeRefresh?.top?.key ||
      cacheAfterRefreshedContinue?.top?.id !== cacheBeforeRefresh?.top?.id
    ) {
      errors.push(
        `读取持久缓存后改写了缓存条目: ${JSON.stringify({
          cacheBeforeRefresh,
          cacheAfterRefreshedContinue,
        })}`,
      )
    }
    if (
      continuedFromArchive !== '继续下一情节' ||
      !continuationLayerReady ||
      continuationLayerAudit?.ariaLabel !== '故事续页' ||
      !continuationLayerAudit?.topmost ||
      !continuationLayerAudit?.loadingOrReady
    ) {
      errors.push(`继续下一情节没有显示在回看层上方: ${JSON.stringify(continuationLayerAudit)}`)
    }
    if (savedStoryTraceId !== storyTraceAudit?.ids?.[0]) {
      errors.push(
        `动态章节阅读位置没有持久化: ${JSON.stringify({
          savedStoryTraceId,
          latestTraceId: storyTraceAudit?.ids?.[0],
        })}`,
      )
    }
    if (secondDraftTitle === firstDraftOutcome?.title) {
      errors.push(`连续两次生成了同一篇剧情: ${secondDraftTitle}`)
    }
    if ((draftGeometry?.paragraphCount ?? 0) !== 1) {
      errors.push(`续页首屏应只显示一段剧情，实际 ${draftGeometry?.paragraphCount ?? 0} 段`)
    }
    if ((draftGeometry?.optionCount ?? 0) !== 0) {
      errors.push('续页首屏不应同时展开选择')
    }
    if ((draftGeometry?.pipCount ?? 0) < 4) errors.push('续页缺少分段进度点')
    if (draftGeometry?.horizontalOverflow) errors.push('剧情续页造成页面横向溢出')
    if (/AI|人工智能|大模型|番外|本地试写/.test(draftGeometry?.visibleText ?? '')) {
      errors.push('剧情续页泄露了模型来源文案')
    }
    if (
      draftGeometry &&
      (draftGeometry.rect.left < -1 ||
        draftGeometry.rect.right > draftGeometry.viewport.width + 1 ||
        draftGeometry.rect.top < -1 ||
        draftGeometry.rect.bottom > draftGeometry.viewport.height + 1)
    ) {
      errors.push(`剧情续页超出视口: ${JSON.stringify(draftGeometry)}`)
    }

    /* ---------- 存档与设置 ---------- */
    await evaluate(`(() => {
      const b = document.querySelector('.appbar__actions .icon-btn:last-child');
      if (!b) return false;
      b.focus();
      b.click();
      return true;
    })()`)
    await sleep(400)
    await shoot('14-settings')
    shots.push('14-settings')

    const settingsFocusAudit = await evaluate(`(() => {
      const dialog = document.querySelector('.modal[role="dialog"]');
      const close = dialog?.querySelector('.modal__close');
      const active = document.activeElement;
      const focusables = dialog
        ? [...dialog.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
          )]
        : [];
      return {
        labeledBy:
          dialog?.getAttribute('aria-labelledby') ===
          dialog?.querySelector('.modal__title')?.id,
        initialCloseFocus: active === close,
        firstIsClose: focusables[0] === close,
        lastLabel: focusables.at(-1)?.getAttribute('aria-label') ?? '',
      };
    })()`)
    if (
      !settingsFocusAudit?.labeledBy ||
      !settingsFocusAudit?.initialCloseFocus ||
      !settingsFocusAudit?.firstIsClose
    ) {
      errors.push(`设置弹窗焦点初始化不正确: ${JSON.stringify(settingsFocusAudit)}`)
    }

    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Tab',
      code: 'Tab',
      modifiers: 8,
    })
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Tab',
      code: 'Tab',
      modifiers: 8,
    })
    const reverseTabAudit = await evaluate(`(() => {
      const dialog = document.querySelector('.modal[role="dialog"]');
      const focusables = dialog
        ? [...dialog.querySelectorAll(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
          )]
        : [];
      return {
        trapped: dialog?.contains(document.activeElement) ?? false,
        onLast: document.activeElement === focusables.at(-1),
        activeLabel: document.activeElement?.getAttribute('aria-label') ?? '',
      };
    })()`)
    if (
      !reverseTabAudit?.trapped ||
      !reverseTabAudit?.onLast ||
      (reverseTabAudit?.activeLabel &&
        reverseTabAudit.activeLabel !== settingsFocusAudit?.lastLabel)
    ) {
      errors.push(`设置弹窗反向焦点循环不正确: ${JSON.stringify(reverseTabAudit)}`)
    }

    await client.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key: 'Escape',
      code: 'Escape',
    })
    await client.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: 'Escape',
      code: 'Escape',
    })
    await sleep(250)
    const escapeCloseAudit = await evaluate(`(() => ({
      closed: !document.querySelector('.modal[role="dialog"]'),
      focusClass: document.activeElement?.className ?? '',
      focusLabel: document.activeElement?.getAttribute('aria-label') ?? '',
    }))()`)
    if (
      !escapeCloseAudit?.closed ||
      !String(escapeCloseAudit?.focusClass).includes('icon-btn')
    ) {
      errors.push(`Escape 关闭设置后未恢复触发按钮: ${JSON.stringify(escapeCloseAudit)}`)
    }
    console.log(`[${SUFFIX}] 设置弹窗键盘审计: ${JSON.stringify({
      settingsFocusAudit,
      reverseTabAudit,
      escapeCloseAudit,
    })}`)

    await evaluate(`(() => {
      const b = document.querySelector('.appbar__actions .icon-btn:last-child');
      if (b) b.click(); return !!b;
    })()`)
    await sleep(400)

    // 存档是否真的写进了 localStorage
    const saved = await evaluate(`!!localStorage.getItem('seabreeze-pet-cafe.save')`)
    const coins = await evaluate(`(() => {
      try { return JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save')).coins } catch { return null }
    })()`)
    const stats = await evaluate(`(() => {
      try {
        const s = JSON.parse(localStorage.getItem('seabreeze-pet-cafe.save'));
        return { ordersServed: s.stats.ordersServed, petInteractions: s.stats.petInteractions, diary: s.pet.diary.length, rel: s.relationships[0].value };
      } catch { return null }
    })()`)

    const guestAudit = await evaluate(`(() => ({
      identity:
        document.querySelector('.account-identity__copy strong')?.textContent?.trim() ?? '',
      badge:
        document.querySelector('.account-identity__badge')?.textContent?.trim() ?? '',
      guestKey: !!localStorage.getItem('seabreeze-pet-cafe.save'),
      guestMode: localStorage.getItem('seabreeze-pet-cafe.guest-mode'),
      accountKeys: Object.keys(localStorage).filter((key) =>
        key.startsWith('seabreeze-pet-cafe.account.'),
      ),
    }))()`)

    const openedCreateAccount = await evaluate(`(() => {
      const b = [...document.querySelectorAll('.btn')].find(
        (x) => x.textContent.includes('创建账号并保存进度'),
      );
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(250)
    const accountUsername = `e2e_${SUFFIX.replace(/[^a-z0-9_-]/gi, '_')}_${Date.now()
      .toString(36)
      .slice(-7)}`
    const filledRegisterForm = await evaluate(`(() => {
      const values = [
        ${JSON.stringify(accountUsername)},
        'Seabreeze-e2e-88',
        'Seabreeze-e2e-88',
      ];
      const inputs = [...document.querySelectorAll('.account-form input')];
      if (inputs.length !== values.length) return false;
      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        'value',
      )?.set;
      inputs.forEach((input, index) => {
        setValue?.call(input, values[index]);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      document.querySelector('.account-form button[type="submit"]')?.click();
      return true;
    })()`)
    let registrationSettled = false
    for (let step = 0; step < 50; step += 1) {
      registrationSettled = await evaluate(`(() => {
        const accountKey = Object.keys(localStorage).find((key) =>
          key.startsWith('seabreeze-pet-cafe.account.'),
        );
        return !document.querySelector('.account-form') && !!accountKey;
      })()`)
      if (registrationSettled) break
      await sleep(160)
    }
    await evaluate(`document.querySelector(
      '.appbar__actions .icon-btn:last-child',
    )?.click()`)
    await waitForSelector('.account-identity', 3000)
    const registeredAudit = await evaluate(`(() => ({
      identity:
        document.querySelector('.account-identity__copy strong')?.textContent?.trim() ?? '',
      badge:
        document.querySelector('.account-identity__badge')?.textContent?.trim() ?? '',
      guestKey: !!localStorage.getItem('seabreeze-pet-cafe.save'),
      accountKeys: Object.keys(localStorage).filter((key) =>
        key.startsWith('seabreeze-pet-cafe.account.'),
      ),
    }))()`)

    await client.send('Page.reload', { ignoreCache: true })
    await sleep(2200)
    const headerRestored = await waitForSelector('.appbar__actions', 5000)
    await evaluate(`document.querySelector(
      '.appbar__actions .icon-btn:last-child',
    )?.click()`)
    await sleep(350)
    const sessionAudit = await evaluate(`(() => ({
      identity:
        document.querySelector('.account-identity__copy strong')?.textContent?.trim() ?? '',
      badge:
        document.querySelector('.account-identity__badge')?.textContent?.trim() ?? '',
      guestKey: !!localStorage.getItem('seabreeze-pet-cafe.save'),
      accountKeys: Object.keys(localStorage).filter((key) =>
        key.startsWith('seabreeze-pet-cafe.account.'),
      ),
    }))()`)
    const logoutClicked = await evaluate(`(() => {
      const b = [...document.querySelectorAll('.btn')].find(
        (x) => x.textContent.includes('退出账号'),
      );
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(900)
    const logoutAudit = await evaluate(`(() => ({
      identity:
        document.querySelector('.account-identity__copy strong')?.textContent?.trim() ?? '',
      badge:
        document.querySelector('.account-identity__badge')?.textContent?.trim() ?? '',
      guestKey: !!localStorage.getItem('seabreeze-pet-cafe.save'),
      guestMode: localStorage.getItem('seabreeze-pet-cafe.guest-mode'),
      accountKeys: Object.keys(localStorage).filter((key) =>
        key.startsWith('seabreeze-pet-cafe.account.'),
      ),
    }))()`)
    await evaluate(`(() => {
      const b = [...document.querySelectorAll('.modal .btn')].find(
        (x) => x.textContent.includes('关闭'),
      );
      if (b) b.click();
      return !!b;
    })()`)
    await sleep(250)
    if ((stats?.ordersServed ?? 0) < 1) errors.push('营业流程没有完成任何订单')
    if (
      guestAudit?.identity !== '游客试玩' ||
      guestAudit?.badge !== '游客' ||
      !guestAudit?.guestKey ||
      guestAudit?.guestMode !== '1' ||
      guestAudit?.accountKeys?.length
    ) {
      errors.push(`游客存档状态不正确: ${JSON.stringify(guestAudit)}`)
    }
    if (!openedCreateAccount || !filledRegisterForm || !registrationSettled) {
      errors.push('无法从游客设置页完成账号注册')
    }
    if (
      registeredAudit?.identity !== accountUsername ||
      registeredAudit?.badge !== '已同步' ||
      !registeredAudit?.guestKey ||
      registeredAudit?.accountKeys?.length !== 1
    ) {
      errors.push(`创建账号后没有保留游客档并建立账号缓存: ${JSON.stringify(registeredAudit)}`)
    }
    if (
      !headerRestored ||
      sessionAudit?.identity !== accountUsername ||
      sessionAudit?.badge !== '已同步' ||
      !sessionAudit?.guestKey ||
      sessionAudit?.accountKeys?.length !== 1
    ) {
      errors.push(`刷新后没有恢复账号 Session: ${JSON.stringify(sessionAudit)}`)
    }
    if (
      !logoutClicked ||
      logoutAudit?.identity !== '游客试玩' ||
      logoutAudit?.badge !== '游客' ||
      !logoutAudit?.guestKey ||
      logoutAudit?.guestMode !== '1'
    ) {
      errors.push(`退出账号后没有恢复游客档: ${JSON.stringify(logoutAudit)}`)
    }
    if (!resultModal) errors.push('营业结束后未出现结算弹窗')
    if (
      !homeStorybookEntry?.visible ||
      homeStorybookEntry?.text !== '剧情本' ||
      !homeStorybookEntry?.cardLabel?.startsWith('打开剧情本：') ||
      !homeStorybookEntry?.progress
    ) {
      errors.push(`主页剧情本入口不明显: ${JSON.stringify(homeStorybookEntry)}`)
    }
    if (
      !homePetJump?.found ||
      !homePetJump?.hitButton ||
      !homePetScreenReady ||
      !homeRestoredAfterPetJump
    ) {
      errors.push(
        `主页宠物快捷入口未跳转到宠物页: ${JSON.stringify({
          homePetJump,
          homePetScreenReady,
          homeRestoredAfterPetJump,
        })}`,
      )
    }

    for (const ev of client.events) {
      if (ev.method === 'Runtime.exceptionThrown') {
        errors.push(ev.params?.exceptionDetails?.exception?.description ?? 'exception')
      }
      if (ev.method === 'Runtime.consoleAPICalled' && ev.params?.type === 'error') {
        errors.push((ev.params.args ?? []).map((a) => a.value ?? a.description).join(' '))
      }
      if (ev.method === 'Log.entryAdded' && ev.params?.entry?.level === 'error') {
        errors.push(ev.params.entry.text)
      }
    }

    console.log(`[${SUFFIX}] 视口 ${WIDTH}x${HEIGHT}`)
    console.log(`[${SUFFIX}] 导航项数量: ${navCount}`)
    console.log(`[${SUFFIX}] 营业交互次数: ${interactions.length}`)
    console.log(`[${SUFFIX}] 结算弹窗按钮: ${JSON.stringify(resultModal)}`)
    console.log(`[${SUFFIX}] 存档已写入: ${saved} / 金币 ${coins}`)
    console.log(`[${SUFFIX}] 关键状态: ${JSON.stringify(stats)}`)
    console.log(`[${SUFFIX}] 剧情续页: ${JSON.stringify(draftGeometry)}`)
    console.log(`[${SUFFIX}] 剧情痕迹: ${JSON.stringify(storyTraceAudit)}`)
    console.log(
      `[${SUFFIX}] 剧情持久缓存: ${JSON.stringify({
        storyCacheBeforeSecondChoice,
        persistedContinuationCache,
      })}`,
    )
    console.log(
      `[${SUFFIX}] 刷新恢复: ${JSON.stringify({
        cacheBeforeRefresh,
        refreshedArchiveAudit,
        refreshedChapterEndAudit,
        cachedContinuationTitle,
        requestsBeforeRefreshedContinue,
        requestsAfterRefreshedContinue,
        cacheAfterRefreshedContinue,
      })}`,
    )
    console.log(`[${SUFFIX}] 剧情页导航切换: ${JSON.stringify(storyNavAudit?.routeChecks ?? [])}`)
    console.log(
      `[${SUFFIX}] 主页宠物快捷入口: ${JSON.stringify({
        homePetJump,
        homePetScreenReady,
        homeRestoredAfterPetJump,
      })}`,
    )
    console.log(`[${SUFFIX}] 控制台错误: ${errors.length ? errors.join(' || ') : '(无)'}`)
    console.log(`[${SUFFIX}] 截图: ${shots.join(', ')}`)
    if (errors.length) process.exitCode = 1
      })(),
      globalTimeout,
    ])
  } finally {
    await cleanup()
  }
}

main().catch((e) => {
  console.error('E2E FAILED:', e)
  process.exit(1)
})
