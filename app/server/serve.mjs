/**
 * 生产服务器：静态资源 + 三个 API 中间件。
 *
 * 为什么不用 `vite preview`：preview 依赖 vite（devDependency），
 * 启动时要加载整个打包器，内存占用高。小内存机器（<512MB）上直接
 * 用 node:http 提供 dist 更稳，也不再需要把 vite 装到线上。
 *
 * 用法：node server/serve.mjs（PORT 默认 4173，HOST 默认 0.0.0.0）
 */
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStoryMiddleware } from './story-api.mjs'
import { createStoryVoiceMiddleware } from './story-voice-api.mjs'
import { createUserMiddleware } from './user-api.mjs'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const DIST = path.join(ROOT, 'dist')

/** 极简 .env 读取：只补未设置的键，和 vite loadEnv 的行为对齐 */
function loadEnvFiles() {
  for (const name of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const file = path.join(ROOT, name)
    if (!existsSync(file)) continue
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
      if (process.env[key] === undefined) process.env[key] = value
    }
  }
}

loadEnvFiles()

const PORT = Number(process.env.PORT ?? 4173)
const HOST = process.env.HOST ?? '0.0.0.0'

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
}

const userMiddleware = createUserMiddleware()
const apiChain = [
  createStoryMiddleware(),
  createStoryVoiceMiddleware(),
  userMiddleware,
]

/** 依次交给 API 中间件；都不处理时才落到静态资源 */
function runApi(req, res, done) {
  let index = 0
  const next = () => {
    const middleware = apiChain[index]
    index += 1
    if (!middleware) {
      done()
      return
    }
    middleware(req, res, next)
  }
  next()
}

function sendFile(res, filePath, status = 200) {
  const ext = path.extname(filePath).toLowerCase()
  const isHashedAsset = filePath.includes(`${path.sep}assets${path.sep}`)
  res.writeHead(status, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    // 带指纹的产物可以长缓存，入口 HTML 必须每次校验，否则更新后拿到旧页面
    'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  createReadStream(filePath).pipe(res)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

  runApi(req, res, () => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Method Not Allowed')
      return
    }

    // 防目录穿越：解析后必须仍在 dist 内
    const decoded = decodeURIComponent(url.pathname)
    const target = path.join(DIST, path.normalize(decoded))
    if (!target.startsWith(DIST)) {
      res.writeHead(403).end('Forbidden')
      return
    }

    if (existsSync(target) && statSync(target).isFile()) {
      sendFile(res, target)
      return
    }

    // SPA 兜底
    sendFile(res, path.join(DIST, 'index.html'))
  })
})

server.listen(PORT, HOST, () => {
  console.log(`seabreeze serving ${DIST} on http://${HOST}:${PORT}`)
})

let closing = false
function shutdown(signal) {
  if (closing) return
  closing = true
  console.log(`${signal} received, shutting down`)
  server.close(() => {
    try {
      userMiddleware.close?.()
    } catch {
      /* 关闭失败不影响退出 */
    }
    process.exit(0)
  })
  // 长连接（语音合成）可能挂住，最多等 5 秒
  setTimeout(() => process.exit(0), 5000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
