import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  clearedSessionCookie,
  readSessionToken,
  sessionCookie,
  usernameKey,
} from './user-auth.mjs'
import { createUserDatabase, UserDataError } from './user-db.mjs'

const MAX_BODY_BYTES = 600 * 1024
const DEFAULT_DB_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
  'seabreeze.sqlite',
)
const LOGIN_WINDOW_MS = 10 * 60 * 1000
const LOGIN_MAX_FAILURES = 6

function sendJson(res, status, body, headers = {}) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(headers)) {
    res.setHeader(name, value)
  }
  res.end(JSON.stringify(body))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      reject(error)
    }
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        fail(new UserDataError('请求内容过大', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      if (settled) return
      try {
        settled = true
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        fail(new UserDataError('请求 JSON 无法解析'))
      }
    })
    req.on('error', fail)
  })
}

function expectedRevisionFromUrl(url) {
  const value = url.searchParams.get('revision')
  return value === null ? undefined : value
}

function isSecureRequest(req) {
  return (
    req.socket?.encrypted === true ||
    req.headers['x-forwarded-proto'] === 'https'
  )
}

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string') return forwarded.split(',')[0].trim()
  return req.socket?.remoteAddress ?? 'unknown'
}

function createLoginLimiter() {
  const attempts = new Map()
  return {
    assertAllowed(key) {
      const entry = attempts.get(key)
      const now = Date.now()
      if (!entry) return
      if (entry.blockedUntil > now) {
        throw new UserDataError('登录尝试过多，请稍后再试', 429)
      }
      if (entry.firstAt + LOGIN_WINDOW_MS <= now) {
        attempts.delete(key)
      }
    },
    recordFailure(key) {
      const now = Date.now()
      const entry = attempts.get(key)
      if (!entry || entry.firstAt + LOGIN_WINDOW_MS <= now) {
        attempts.set(key, { count: 1, firstAt: now, blockedUntil: 0 })
        return
      }
      entry.count += 1
      if (entry.count >= LOGIN_MAX_FAILURES) {
        entry.blockedUntil = now + LOGIN_WINDOW_MS
      }
    },
    clear(key) {
      attempts.delete(key)
    },
  }
}

export function createUserMiddleware(options = {}) {
  const database = options.database ?? createUserDatabase(
    options.dbPath ?? process.env.USER_DB_PATH ?? DEFAULT_DB_PATH,
  )
  const ownsDatabase = !options.database
  const loginLimiter = createLoginLimiter()

  function currentSession(req) {
    const token = readSessionToken(req.headers.cookie)
    return token ? database.findSession(token) : null
  }

  function requireSession(req) {
    const session = currentSession(req)
    if (!session) throw new UserDataError('请先登录游戏账号', 401)
    return session
  }

  async function handle(req, res, url) {
    if (url.pathname === '/api/auth/register' && req.method === 'POST') {
      const body = await readJsonBody(req)
      const result = await database.registerAccount(body)
      sendJson(
        res,
        201,
        { user: result.user },
        {
          'Set-Cookie': sessionCookie(result.token, {
            secure: isSecureRequest(req),
          }),
        },
      )
      return true
    }

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const body = await readJsonBody(req)
      let key = `${clientIp(req)}|unknown`
      try {
        key = `${clientIp(req)}|${usernameKey(body?.username)}`
      } catch {
        /* validation below returns the generic credentials error */
      }
      loginLimiter.assertAllowed(key)
      try {
        const result = await database.loginAccount(body)
        loginLimiter.clear(key)
        sendJson(
          res,
          200,
          { user: result.user },
          {
            'Set-Cookie': sessionCookie(result.token, {
              secure: isSecureRequest(req),
            }),
          },
        )
      } catch (error) {
        loginLimiter.recordFailure(key)
        throw error
      }
      return true
    }

    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      const token = readSessionToken(req.headers.cookie)
      if (token) database.revokeSession(token)
      sendJson(
        res,
        200,
        { loggedOut: true },
        {
          'Set-Cookie': clearedSessionCookie({
            secure: isSecureRequest(req),
          }),
        },
      )
      return true
    }

    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      const session = currentSession(req)
      sendJson(res, 200, { user: session?.user ?? null })
      return true
    }

    if (url.pathname === '/api/me/save' && req.method === 'GET') {
      const session = requireSession(req)
      const result = database.load(session.user.id)
      sendJson(res, 200, result)
      return true
    }

    if (url.pathname === '/api/me/save' && req.method === 'PUT') {
      const session = requireSession(req)
      const body = await readJsonBody(req)
      const result = database.save(session.user.id, body)
      if (result.conflict) {
        sendJson(res, 409, {
          error: '云端存档已有更新版本',
          revision: result.revision,
          state: result.state,
        })
        return true
      }
      sendJson(res, 200, {
        revision: result.revision,
        savedAt: result.savedAt,
        unchanged: result.unchanged,
      })
      return true
    }

    if (url.pathname === '/api/me/save' && req.method === 'DELETE') {
      const session = requireSession(req)
      const result = database.clearSave(
        session.user.id,
        expectedRevisionFromUrl(url),
      )
      if (result.conflict) {
        sendJson(res, 409, {
          error: '云端存档已有更新版本',
          revision: result.revision,
        })
        return true
      }
      sendJson(res, 200, { deleted: true })
      return true
    }

    return false
  }

  async function middleware(req, res, next) {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const isKnownRoute =
      url.pathname.startsWith('/api/auth/') ||
      url.pathname === '/api/me/save' ||
      url.pathname.startsWith('/api/users/')
    if (!isKnownRoute) {
      next()
      return
    }

    if (url.pathname.startsWith('/api/users/')) {
      sendJson(res, 410, { error: '匿名存档接口已停用，请登录游戏账号' })
      return
    }

    if (
      url.pathname === '/api/me/save' &&
      !['GET', 'PUT', 'DELETE'].includes(req.method)
    ) {
      res.setHeader('Allow', 'GET, PUT, DELETE')
      sendJson(res, 405, { error: '不支持该请求方式' })
      return
    }

    try {
      const handled = await handle(req, res, url)
      if (!handled) sendJson(res, 404, { error: '账号接口不存在' })
    } catch (error) {
      const status = error instanceof UserDataError ? error.status : 500
      if (status === 500) console.error('[user-db]', error)
      sendJson(res, status, {
        error: status === 500 ? '用户数据服务暂时不可用' : error.message,
      })
    }
  }

  middleware.close = () => {
    if (ownsDatabase) database.close()
  }
  middleware.database = database
  return middleware
}

export { ACCOUNT_LIMITS } from './user-auth.mjs'
export { DEFAULT_DB_PATH }
