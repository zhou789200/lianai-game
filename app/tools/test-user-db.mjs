import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import http from 'node:http'
import {
  UserDataError,
  createUserDatabase,
  validateSavePayload,
  validateUserId,
} from '../server/user-db.mjs'
import { createUserMiddleware } from '../server/user-api.mjs'
import {
  SESSION_COOKIE_NAME,
  hashSessionToken,
} from '../server/user-auth.mjs'

const USER_ID = 'anon_12345678-1234-4234-8234-123456789abc'

function makeState(overrides = {}) {
  const now = Date.now()
  return {
    version: 2,
    createdAt: now - 10_000,
    updatedAt: now,
    playerName: '店长',
    shopName: '海风镇宠物咖啡馆',
    coins: 320,
    stamina: 12,
    staminaMax: 12,
    level: 1,
    exp: 0,
    pet: {
      name: '布丁',
      hunger: 62,
      cleanliness: 70,
      mood: 68,
      intimacy: 12,
      diary: [],
    },
    relationships: [],
    chapterId: 'chapter-1',
    chapterBeat: 0,
    completedChapters: [],
    tasks: [],
    recipes: [],
    decor: [],
    equipment: {},
    stats: {
      businessRuns: 0,
      ordersServed: 0,
      perfectRuns: 0,
      petInteractions: 0,
      choicesMade: 0,
      coinsEarned: 0,
    },
    ...overrides,
  }
}

function sessionCookie(response) {
  const setCookie = response.headers.get('set-cookie')
  assert.ok(setCookie, '响应应设置 Session Cookie')
  const match = setCookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`))
  assert.ok(match?.[1], 'Set-Cookie 应包含 Session token')
  return `${SESSION_COOKIE_NAME}=${match[1]}`
}

function jsonHeaders(cookie) {
  return {
    'Content-Type': 'application/json',
    ...(cookie ? { Cookie: cookie } : {}),
  }
}

async function request(base, pathname, options = {}) {
  return fetch(`${base}${pathname}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}

async function register(base, username, password = 'correct-horse-88') {
  const response = await request(base, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  assert.equal(response.status, 201)
  const payload = await response.json()
  return { user: payload.user, cookie: sessionCookie(response) }
}

async function login(base, username, password = 'correct-horse-88') {
  return request(base, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
}

test('user id validation rejects path-like and short identifiers', () => {
  assert.equal(validateUserId(USER_ID), USER_ID)
  assert.throws(() => validateUserId('../users'), UserDataError)
  assert.throws(() => validateUserId('anon_short'), UserDataError)
})

test('save validation rejects malformed and oversized payloads', () => {
  assert.throws(() => validateSavePayload({}), UserDataError)
  assert.throws(
    () => validateSavePayload({ save: makeState({ playerName: undefined }) }),
    UserDataError,
  )
  assert.throws(
    () =>
      validateSavePayload({
        save: makeState({ shopName: 'x'.repeat(600 * 1024) }),
      }),
    UserDataError,
  )
})

test('save validation accepts legacy saves and enforces bounded state shapes', () => {
  const legacy = makeState()
  for (const key of [
    'storyChapterId',
    'storyChapterBeat',
    'storyBranchId',
    'storyBranchBeat',
    'storyCompletedChapters',
    'storyFlags',
    'storyTraces',
    'storyChoices',
    'storySeed',
    'storyCache',
    'storyTraceId',
    'storyTurn',
    'tasksDate',
    'unlocked',
  ]) {
    delete legacy[key]
  }
  legacy.version = 1

  const payload = validateSavePayload({ save: legacy })
  assert.equal(payload.saveVersion, 1)
  assert.equal(payload.playerName, '店长')

  assert.throws(
    () => validateSavePayload({ save: makeState({ coins: Number.NaN }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ updatedAt: Infinity }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ updatedAt: 1e300 }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ relationships: [null] }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ storyTraces: Array(31).fill({}) }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ storyTraces: [{}] }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ storyChoices: Array(31).fill({}) }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ storyChoices: [{}] }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ storyCache: Array(7).fill({}) }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ storyCache: [{}] }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ completedChapters: ['chapter-1', 1] }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ pet: { ...makeState().pet, diary: [null] } }) }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ equipment: { machine: '3' } }) }),
    UserDataError,
  )
  assert.throws(
    () =>
      validateSavePayload({
        save: makeState({
          equipment: Object.fromEntries(
            Array.from({ length: 65 }, (_, index) => [`machine-${index}`, 1]),
          ),
        }),
      }),
    UserDataError,
  )
  assert.throws(
    () => validateSavePayload({ save: makeState({ tasks: [{ id: 'open_shop', progress: 1 }] }) }),
    UserDataError,
  )
  assert.throws(
    () =>
      validateSavePayload({
        save: makeState({ stats: { ...makeState().stats, coinsEarned: Number.NaN } }),
      }),
    UserDataError,
  )
})

test('save validation sanitizes display names at the persistence boundary', () => {
  const state = makeState({
    playerName: `\u0000${'甲'.repeat(40)}`,
    shopName: `  ${'店'.repeat(40)}  `,
  })
  const payload = validateSavePayload({ save: state })

  assert.equal(payload.playerName, '甲'.repeat(20))
  assert.equal(payload.shopName, '店'.repeat(32))

  const db = createUserDatabase(':memory:')
  try {
    const result = db.save(USER_ID, { save: state, revision: 0 })
    assert.equal(result.revision, 1)
    const user = db.load(USER_ID).user
    assert.equal(user.playerName, payload.playerName)
    assert.equal(user.shopName, payload.shopName)
  } finally {
    db.close()
  }
})

test('database creates, revisions, detects conflicts, and preserves 20 snapshots', () => {
  const db = createUserDatabase(':memory:')
  try {
    assert.equal(db.load(USER_ID), null)

    const firstState = makeState({ coins: 321 })
    const first = db.save(USER_ID, { save: firstState, revision: 0 })
    assert.equal(first.conflict, false)
    assert.equal(first.revision, 1)

    const loaded = db.load(USER_ID)
    assert.equal(loaded.save.revision, 1)
    assert.equal(loaded.save.state.coins, 321)
    assert.equal(loaded.user.playerName, '店长')

    const secondState = makeState({ coins: 400, updatedAt: Date.now() + 1000 })
    const second = db.save(USER_ID, { save: secondState, revision: 1 })
    assert.equal(second.conflict, false)
    assert.equal(second.revision, 2)

    const staleState = makeState({ coins: 999, updatedAt: Date.now() + 2000 })
    const conflict = db.save(USER_ID, { save: staleState, revision: 1 })
    assert.equal(conflict.conflict, true)
    assert.equal(conflict.revision, 2)
    assert.equal(conflict.state.coins, 400)

    for (let revision = 2; revision < 25; revision += 1) {
      const result = db.save(USER_ID, {
        save: makeState({ coins: revision, updatedAt: Date.now() + revision }),
        revision,
      })
      assert.equal(result.conflict, false)
    }
    const versions = db.db
      .prepare(
        'SELECT revision FROM save_versions WHERE user_id = ? ORDER BY revision',
      )
      .all(USER_ID)
    assert.equal(versions.length, 20)
    assert.equal(versions[0].revision, 6)
    assert.equal(versions.at(-1).revision, 25)
  } finally {
    db.close()
  }
})

test('clearSave keeps the account while delete removes it', async () => {
  const db = createUserDatabase(':memory:')
  try {
    const { user, token } = await db.registerAccount({
      username: 'clear-test',
      password: 'correct-horse-88',
    })
    db.save(user.id, { save: makeState({ coins: 777 }), revision: 0 })
    assert.deepEqual(db.clearSave(user.id, 1), {
      conflict: false,
      revision: 0,
    })
    assert.equal(db.load(user.id).save, null)
    assert.equal(db.findSession(token).user.id, user.id)

    db.save(user.id, { save: makeState({ coins: 778 }), revision: 0 })
    assert.deepEqual(db.delete(user.id, 1), {
      conflict: false,
      revision: 0,
    })
    assert.equal(db.load(user.id), null)
  } finally {
    db.close()
  }
})

test('database survives a restart with account and save intact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seabreeze-db-'))
  const filePath = path.join(dir, 'test.sqlite')
  try {
    const firstDb = createUserDatabase(filePath)
    const { token } = await firstDb.registerAccount({
      username: 'restart-user',
      password: 'correct-horse-88',
    })
    const session = firstDb.findSession(token)
    firstDb.save(session.user.id, {
      save: makeState({ coins: 555 }),
      revision: 0,
    })
    firstDb.close()

    const secondDb = createUserDatabase(filePath)
    try {
      const loaded = secondDb.findSession(token)
      assert.ok(loaded)
      assert.equal(secondDb.load(loaded.user.id).save.state.coins, 555)
    } finally {
      secondDb.close()
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

async function startApiServer(
  database = createUserDatabase(':memory:'),
  middlewareOptions = {},
) {
  const middleware = createUserMiddleware({ database, ...middlewareOptions })
  const server = http.createServer((req, res) => {
    middleware(req, res, () => {
      res.statusCode = 404
      res.end('not found')
    }).catch((error) => {
      res.statusCode = 500
      res.end(JSON.stringify({ error: error.message }))
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  return {
    server,
    database,
    close: async () => {
      await new Promise((resolve) => server.close(resolve))
      database.close()
    },
  }
}

test('HTTP account flow supports sessions, isolation, conflicts, and save clearing', async () => {
  const app = await startApiServer()
  const base = `http://127.0.0.1:${app.server.address().port}`
  try {
    let response = await request(base, '/api/auth/me')
    assert.equal(response.status, 200)
    assert.equal((await response.json()).user, null)

    response = await request(base, '/api/me/save')
    assert.equal(response.status, 401)

    const alice = await register(base, 'alice-game')
    const aliceId = alice.user.id
    const aliceCookie = alice.cookie
    assert.equal(alice.user.username, 'alice-game')

    const stored = app.database.db
      .prepare(
        'SELECT password_hash AS passwordHash, password_salt AS passwordSalt FROM users WHERE id = ?',
      )
      .get(aliceId)
    assert.notEqual(stored.passwordHash, 'correct-horse-88')
    assert.ok(stored.passwordHash.length > 64)
    assert.ok(stored.passwordSalt.length >= 32)

    response = await request(base, '/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        username: 'ALICE-GAME',
        password: 'correct-horse-88',
      }),
    })
    assert.equal(response.status, 409)

    response = await login(base, 'ALICE-GAME', 'wrong-password')
    assert.equal(response.status, 401)

    response = await login(base, 'alice-game')
    assert.equal(response.status, 200)
    const secondAliceCookie = sessionCookie(response)
    assert.equal((await response.json()).user.id, aliceId)

    response = await request(base, '/api/me/save', {
      method: 'PUT',
      headers: jsonHeaders(aliceCookie),
      body: JSON.stringify({ save: makeState({ coins: 901 }), revision: 0 }),
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).revision, 1)

    response = await request(base, '/api/me/save', {
      headers: { Cookie: secondAliceCookie },
    })
    assert.equal(response.status, 200)
    const loadedAlice = await response.json()
    assert.equal(loadedAlice.save.state.coins, 901)
    assert.equal(loadedAlice.save.revision, 1)

    response = await request(base, '/api/me/save', {
      method: 'PUT',
      headers: jsonHeaders(secondAliceCookie),
      body: JSON.stringify({
        save: makeState({ coins: 1200, updatedAt: Date.now() + 2000 }),
        revision: 1,
      }),
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).revision, 2)

    response = await request(base, '/api/me/save', {
      method: 'PUT',
      headers: jsonHeaders(aliceCookie),
      body: JSON.stringify({
        save: makeState({ coins: 1, updatedAt: Date.now() + 3000 }),
        revision: 1,
      }),
    })
    assert.equal(response.status, 409)
    const conflict = await response.json()
    assert.equal(conflict.revision, 2)
    assert.equal(conflict.state.coins, 1200)

    const bob = await register(base, 'bob-game')
    response = await request(base, '/api/me/save', {
      headers: { Cookie: bob.cookie },
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).save, null)

    response = await request(base, '/api/auth/logout', {
      method: 'POST',
      headers: { Cookie: aliceCookie },
    })
    assert.equal(response.status, 200)
    response = await request(base, '/api/auth/me', {
      headers: { Cookie: aliceCookie },
    })
    assert.equal((await response.json()).user, null)

    response = await request(base, '/api/me/save?revision=2', {
      method: 'DELETE',
      headers: { Cookie: secondAliceCookie },
    })
    assert.equal(response.status, 200)
    response = await request(base, '/api/me/save', {
      headers: { Cookie: secondAliceCookie },
    })
    assert.equal(response.status, 200)
    assert.equal((await response.json()).save, null)
    response = await request(base, '/api/auth/me', {
      headers: { Cookie: secondAliceCookie },
    })
    assert.equal((await response.json()).user.id, aliceId)

    response = await request(base, `/api/users/${USER_ID}/save`)
    assert.equal(response.status, 410)

    const token = secondAliceCookie.split('=')[1]
    assert.equal(
      app.database.db
        .prepare('SELECT COUNT(*) AS count FROM sessions WHERE token_hash = ?')
        .get(hashSessionToken(token)).count,
      1,
    )
  } finally {
    await app.close()
  }
})

test('login rate limit ignores spoofed forwarding headers by default', async () => {
  const app = await startApiServer()
  const base = `http://127.0.0.1:${app.server.address().port}`
  try {
    await register(base, 'rate-limit-user')

    for (let attempt = 0; attempt < 6; attempt += 1) {
      const response = await request(base, '/api/auth/login', {
        method: 'POST',
        headers: { 'X-Forwarded-For': `203.0.113.${attempt + 1}` },
        body: JSON.stringify({
          username: 'rate-limit-user',
          password: 'wrong-password',
        }),
      })
      assert.equal(response.status, 401)
    }

    const blocked = await request(base, '/api/auth/login', {
      method: 'POST',
      headers: { 'X-Forwarded-For': '203.0.113.200' },
      body: JSON.stringify({
        username: 'rate-limit-user',
        password: 'wrong-password',
      }),
    })
    assert.equal(blocked.status, 429)
  } finally {
    await app.close()
  }
})
