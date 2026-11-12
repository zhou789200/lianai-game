import fs from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import {
  createPasswordRecord,
  createSessionToken,
  hashSessionToken,
  SESSION_TTL_MS,
  validateCredentials,
  verifyPassword,
} from './user-auth.mjs'

const MAX_SAVE_BYTES = 512 * 1024
const MAX_PLAYER_NAME_LENGTH = 20
const MAX_SHOP_NAME_LENGTH = 32
const MAX_COLLECTION_ITEMS = 400
const MAX_TEXT_LENGTH = 4096
const MAX_TIMESTAMP = 8_640_000_000_000_000
const MAX_EQUIPMENT_ITEMS = 64
const MIN_SAVE_VERSION = 1
const MAX_SAVE_VERSION = 4
const STORY_TRACE_LIMIT = 30
const STORY_CHOICE_LIMIT = 30
const STORY_CACHE_LIMIT = 6
const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{16,64}$/
const SAVE_STAT_KEYS = [
  'businessRuns',
  'ordersServed',
  'perfectRuns',
  'petInteractions',
  'choicesMade',
  'coinsEarned',
]

export class UserDataError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'UserDataError'
    this.status = status
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateUserId(value) {
  if (typeof value !== 'string' || !USER_ID_PATTERN.test(value)) {
    throw new UserDataError('用户标识格式不正确')
  }
  return value
}

function cleanName(value, maxLength, fallback) {
  if (typeof value !== 'string') return fallback
  const cleaned = value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
  return cleaned || fallback
}

function requireFiniteNumber(value, message) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new UserDataError(message)
  }
  return value
}

function requireTimestamp(value, message) {
  requireFiniteNumber(value, message)
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_TIMESTAMP) {
    throw new UserDataError(message)
  }
  return value
}

function requireText(value, message, maxLength = MAX_TEXT_LENGTH) {
  if (typeof value !== 'string' || value.length > maxLength) {
    throw new UserDataError(message)
  }
  return value
}

function requireNonEmptyText(value, message, maxLength = MAX_TEXT_LENGTH) {
  requireText(value, message, maxLength)
  if (!value.trim()) throw new UserDataError(message)
  return value
}

function requireOptionalText(value, message, maxLength = MAX_TEXT_LENGTH) {
  if (value === undefined || value === null) return
  requireText(value, message, maxLength)
}

function requireRecord(value, message) {
  if (!isRecord(value)) throw new UserDataError(message)
  return value
}

function requireArray(value, message, maxItems = MAX_COLLECTION_ITEMS) {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new UserDataError(message)
  }
  return value
}

function requireStringArray(
  value,
  message,
  maxItems = MAX_COLLECTION_ITEMS,
  maxItemLength = MAX_TEXT_LENGTH,
) {
  for (const item of requireArray(value, message, maxItems)) {
    requireText(item, message, maxItemLength)
  }
}

function requireOptionalStringArray(
  value,
  message,
  maxItems = MAX_COLLECTION_ITEMS,
  maxItemLength = MAX_TEXT_LENGTH,
) {
  if (value === undefined || value === null) return
  requireStringArray(value, message, maxItems, maxItemLength)
}

function requireStringUnion(value, allowed, message) {
  if (!allowed.includes(value)) throw new UserDataError(message)
  return value
}

function validateStoryBeat(value, message) {
  const beat = requireRecord(value, message)
  requireStringUnion(beat.type, ['narration', 'dialogue'], message)
  requireNonEmptyText(beat.text, message, 220)
  if (beat.type === 'dialogue') requireNonEmptyText(beat.speaker, message, 20)
}

function validateGeneratedStoryChoice(value, message) {
  const choice = requireRecord(value, message)
  requireNonEmptyText(choice.id, message, 32)
  requireNonEmptyText(choice.text, message, 100)
  requireNonEmptyText(choice.reply, message, 240)
  requireNonEmptyText(choice.consequence, message, 180)
}

function validateGeneratedStory(value, message) {
  const story = requireRecord(value, message)
  requireNonEmptyText(story.id, message, 64)
  requireStringUnion(story.source, ['ai', 'local'], message)
  if (story.degraded !== undefined && typeof story.degraded !== 'boolean') {
    throw new UserDataError(message)
  }
  requireNonEmptyText(story.title, message, 36)
  requireNonEmptyText(story.subtitle, message, 48)
  requireNonEmptyText(story.scene, message, 48)
  requireNonEmptyText(story.clue, message, 140)
  requireStringArray(story.memoryAnchors, message, 3, 64)
  const beats = requireArray(story.beats, message, 5)
  for (const beat of beats) validateStoryBeat(beat, message)
  if (beats.length < 3) throw new UserDataError(message)
  const choices = requireArray(story.choices, message, 2)
  for (const choice of choices) validateGeneratedStoryChoice(choice, message)
  if (choices.length !== 2) throw new UserDataError(message)
}

function validateStoryTrace(value, message) {
  const trace = requireRecord(value, message)
  requireNonEmptyText(trace.id, message, 64)
  requireTimestamp(trace.at, message)
  requireNonEmptyText(trace.title, message, 36)
  requireNonEmptyText(trace.subtitle, message, 48)
  requireNonEmptyText(trace.scene, message, 48)
  requireStringUnion(trace.source, ['ai', 'local'], message)
  requireArray(trace.memoryAnchors, message, 3)
  if (trace.memoryAnchors.length < 1) throw new UserDataError(message)
  for (const anchor of trace.memoryAnchors) {
    requireNonEmptyText(anchor, message, 64)
  }
  requireOptionalText(trace.clue, message, 140)
  requireNonEmptyText(trace.choice, message, 100)
  requireNonEmptyText(trace.outcome, message, 320)
  if (trace.chapterIndex !== undefined) {
    requireFiniteNumber(trace.chapterIndex, message)
  }
  if (trace.beats !== undefined) {
    const beats = requireArray(trace.beats, message, 5)
    for (const beat of beats) validateStoryBeat(beat, message)
  }
  if (trace.choices !== undefined) {
    const choices = requireArray(trace.choices, message, 2)
    for (const choice of choices) validateGeneratedStoryChoice(choice, message)
  }
  requireOptionalText(trace.selectedChoiceId, message, 32)
}

function validateStoryChoice(value, message) {
  const choice = requireRecord(value, message)
  requireNonEmptyText(choice.id, message, 96)
  requireTimestamp(choice.at, message)
  requireStringUnion(choice.source, ['romance', 'storybook'], message)
  requireNonEmptyText(choice.chapterId, message, 64)
  requireNonEmptyText(choice.chapterTitle, message, 48)
  requireOptionalText(choice.scene, message, 64)
  requireNonEmptyText(choice.beatId, message, 64)
  requireOptionalText(choice.prompt, message, 160)
  requireNonEmptyText(choice.optionId, message, 64)
  requireNonEmptyText(choice.optionText, message, 120)
  requireOptionalText(choice.reply, message, 240)
  if (typeof choice.skipped !== 'boolean') throw new UserDataError(message)
  requireOptionalText(choice.characterId, message, 64)
  requireOptionalText(choice.branchId, message, 64)
  if (choice.storyFlags !== undefined) {
    requireStringArray(choice.storyFlags, message, 64, 64)
  }
}

function validateStoryCacheEntry(value, message) {
  const entry = requireRecord(value, message)
  requireNonEmptyText(entry.key, message, 100)
  requireTimestamp(entry.at, message)
  validateGeneratedStory(entry.story, message)
}

function validateSaveState(state) {
  const message = '存档内容格式不正确'
  if (!isRecord(state)) throw new UserDataError('缺少游戏存档')
  if (
    typeof state.version !== 'number' ||
    !Number.isSafeInteger(state.version) ||
    state.version < MIN_SAVE_VERSION ||
    state.version > MAX_SAVE_VERSION
  ) {
    throw new UserDataError('存档版本不正确')
  }
  requireTimestamp(state.updatedAt, '存档更新时间不正确')
  requireText(state.playerName, '存档缺少玩家资料')
  requireText(state.shopName, '存档缺少玩家资料')

  // Base fields mirror the client's load gate. Newer story and business fields
  // are optional so that declarative v1-v4 migrations remain usable.
  if (state.createdAt !== undefined) requireTimestamp(state.createdAt, message)
  requireFiniteNumber(state.coins, message)
  requireFiniteNumber(state.stamina, message)
  requireFiniteNumber(state.staminaMax, message)
  if (state.staminaRegenAt !== undefined) requireTimestamp(state.staminaRegenAt, message)
  requireFiniteNumber(state.level, message)
  requireFiniteNumber(state.exp, message)

  const pet = requireRecord(state.pet, message)
  requireText(pet.name, message, 64)
  requireOptionalText(pet.breed, message)
  requireOptionalText(pet.age, message)
  requireFiniteNumber(pet.intimacy, message)
  requireFiniteNumber(pet.hunger, message)
  requireFiniteNumber(pet.cleanliness, message)
  requireFiniteNumber(pet.mood, message)
  for (const entry of requireArray(pet.diary, message)) {
    const diaryEntry = requireRecord(entry, message)
    requireText(diaryEntry.id, message)
    requireTimestamp(diaryEntry.at, message)
    requireText(diaryEntry.icon, message)
    requireText(diaryEntry.text, message)
  }

  for (const relationship of requireArray(state.relationships, message)) {
    const record = requireRecord(relationship, message)
    requireText(record.id, message)
    requireText(record.name, message)
    requireText(record.role, message)
    requireText(record.note, message)
    requireFiniteNumber(record.value, message)
    if (typeof record.met !== 'boolean') throw new UserDataError(message)
  }

  requireText(state.chapterId, message)
  requireFiniteNumber(state.chapterBeat, message)
  requireStringArray(state.completedChapters, message)

  if (state.storyChapterId !== undefined) {
    requireText(state.storyChapterId, message)
    if (!state.storyChapterId) throw new UserDataError(message)
  }
  if (state.storyChapterBeat !== undefined) requireFiniteNumber(state.storyChapterBeat, message)
  requireOptionalText(state.storyBranchId, message)
  if (state.storyBranchBeat !== undefined) requireFiniteNumber(state.storyBranchBeat, message)
  requireOptionalStringArray(state.storyCompletedChapters, message)
  requireOptionalStringArray(state.storyFlags, message)
  if (state.storyTraces !== undefined && state.storyTraces !== null) {
    const traces = requireArray(state.storyTraces, message, STORY_TRACE_LIMIT)
    for (const trace of traces) validateStoryTrace(trace, message)
  }
  if (state.storyChoices !== undefined && state.storyChoices !== null) {
    const choices = requireArray(state.storyChoices, message, STORY_CHOICE_LIMIT)
    for (const choice of choices) validateStoryChoice(choice, message)
  }
  requireOptionalText(state.storySeed, message)
  if (state.storyCache !== undefined && state.storyCache !== null) {
    const cache = requireArray(state.storyCache, message, STORY_CACHE_LIMIT)
    for (const entry of cache) validateStoryCacheEntry(entry, message)
  }
  requireOptionalText(state.storyTraceId, message)
  if (state.storyTurn !== undefined) requireFiniteNumber(state.storyTurn, message)

  for (const task of requireArray(state.tasks, message)) {
    const record = requireRecord(task, message)
    requireText(record.id, message)
    requireFiniteNumber(record.progress, message)
    if (typeof record.claimed !== 'boolean') throw new UserDataError(message)
  }
  requireOptionalText(state.tasksDate, message)
  requireOptionalStringArray(state.unlocked, message)
  const equipment = requireRecord(state.equipment, message)
  if (Object.keys(equipment).length > MAX_EQUIPMENT_ITEMS) {
    throw new UserDataError(message)
  }
  for (const [key, value] of Object.entries(equipment)) {
    requireText(key, message, 64)
    requireFiniteNumber(value, message)
  }
  requireStringArray(state.recipes, message)
  requireStringArray(state.decor, message)
  const stats = requireRecord(state.stats, message)
  for (const key of SAVE_STAT_KEYS) requireFiniteNumber(stats[key], message)

  requireOptionalText(state.activeRunId, message)
  requireOptionalText(state.lastSettledRunId, message)
  if (state.lastBusiness !== undefined && state.lastBusiness !== null) {
    const business = requireRecord(state.lastBusiness, message)
    for (const key of ['at', 'served', 'failed', 'rating', 'coins']) {
      requireFiniteNumber(business[key], message)
    }
  }
  for (const key of ['pendingRunRewards', 'recoveredRunRewards']) {
    const value = state[key]
    if (value === undefined || value === null) continue
    const reward = requireRecord(value, message)
    requireFiniteNumber(reward.coins, message)
    requireFiniteNumber(reward.exp, message)
  }
}

export function validateSavePayload(body) {
  if (!isRecord(body)) throw new UserDataError('存档内容格式不正确')
  if (!isRecord(body.save)) throw new UserDataError('缺少游戏存档')

  const state = body.save
  validateSaveState(state)

  let serialized
  try {
    serialized = JSON.stringify(state)
  } catch {
    throw new UserDataError('存档内容格式不正确')
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_SAVE_BYTES) {
    throw new UserDataError('存档内容过大', 413)
  }

  return {
    state,
    serialized,
    playerName: cleanName(state.playerName, MAX_PLAYER_NAME_LENGTH, '店长'),
    shopName: cleanName(state.shopName, MAX_SHOP_NAME_LENGTH, '海风镇宠物咖啡馆'),
    saveVersion: state.version,
    clientUpdatedAt: Math.trunc(state.updatedAt),
  }
}

function parseExpectedRevision(value) {
  if (value === undefined || value === null || value === '') return null
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new UserDataError('存档修订号不正确')
  }
  return number
}

export class UserDatabase {
  constructor(filePath) {
    this.filePath = filePath
    if (filePath !== ':memory:') {
      fs.mkdirSync(path.dirname(filePath), { recursive: true })
    }
    this.db = new DatabaseSync(filePath)
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;')
    this.migrate()
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        player_name TEXT NOT NULL,
        shop_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );
    `)

    const columns = new Set(
      this.db.prepare('PRAGMA table_info(users)').all().map((column) => column.name),
    )
    const additions = [
      ['username', 'TEXT'],
      ['username_key', 'TEXT'],
      ['password_hash', 'TEXT'],
      ['password_salt', 'TEXT'],
      ["account_type", "TEXT NOT NULL DEFAULT 'guest'"],
    ]
    for (const [name, type] of additions) {
      if (!columns.has(name)) {
        this.db.exec(`ALTER TABLE users ADD COLUMN ${name} ${type}`)
      }
    }

    this.db.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS users_username_key_unique
        ON users(username_key)
        WHERE username_key IS NOT NULL;

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS sessions_user_id
        ON sessions(user_id);

      CREATE INDEX IF NOT EXISTS sessions_expires_at
        ON sessions(expires_at);

      CREATE TABLE IF NOT EXISTS game_saves (
        user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
        save_version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        client_updated_at INTEGER NOT NULL,
        saved_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS save_versions (
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL,
        save_version INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        client_updated_at INTEGER NOT NULL,
        saved_at TEXT NOT NULL,
        PRIMARY KEY (user_id, revision)
      );

      CREATE INDEX IF NOT EXISTS save_versions_saved_at
        ON save_versions(user_id, saved_at DESC);
    `)
    this.db
      .prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)')
      .run(1, new Date().toISOString())
    this.db
      .prepare('INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES (?, ?)')
      .run(2, new Date().toISOString())
  }

  async registerAccount({ username, password }) {
    const credentials = validateCredentials(username, password)
    const exists = this.db
      .prepare('SELECT 1 FROM users WHERE username_key = ?')
      .get(credentials.usernameKey)
    if (exists) {
      throw new UserDataError('这个游戏账号已经被使用', 409)
    }

    const { passwordHash, passwordSalt } = await createPasswordRecord(credentials.password)
    const id = `usr_${randomUUID()}`
    const now = new Date().toISOString()
    try {
      this.db
        .prepare(`
          INSERT INTO users(
            id, player_name, shop_name, created_at, updated_at, last_seen_at,
            username, username_key, password_hash, password_salt, account_type
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'account')
        `)
        .run(
          id,
          credentials.username,
          '海风镇宠物咖啡馆',
          now,
          now,
          now,
          credentials.username,
          credentials.usernameKey,
          passwordHash,
          passwordSalt,
        )
    } catch (error) {
      if (String(error?.code ?? '').includes('SQLITE_CONSTRAINT')) {
        throw new UserDataError('这个游戏账号已经被使用', 409)
      }
      throw error
    }

    return this.issueSession(id)
  }

  async loginAccount({ username, password }) {
    let credentials
    try {
      credentials = validateCredentials(username, password)
    } catch {
      throw new UserDataError('游戏账号或密码不正确', 401)
    }
    const row = this.db
      .prepare(`
        SELECT id, password_hash AS passwordHash, password_salt AS passwordSalt
        FROM users
        WHERE username_key = ?
      `)
      .get(credentials.usernameKey)
    if (
      !row ||
      !(await verifyPassword(credentials.password, row.passwordHash, row.passwordSalt))
    ) {
      throw new UserDataError('游戏账号或密码不正确', 401)
    }
    return this.issueSession(row.id)
  }

  issueSession(userId) {
    validateUserId(userId)
    const token = createSessionToken()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + SESSION_TTL_MS)
    const nowIso = now.toISOString()
    this.db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(nowIso)
    this.db
      .prepare(`
        INSERT INTO sessions(token_hash, user_id, created_at, expires_at, last_seen_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .run(
        hashSessionToken(token),
        userId,
        nowIso,
        expiresAt.toISOString(),
        nowIso,
      )
    this.db
      .prepare('UPDATE users SET last_seen_at = ?, updated_at = ? WHERE id = ?')
      .run(nowIso, nowIso, userId)
    const user = this.load(userId)?.user
    if (!user) throw new UserDataError('游戏账号不存在', 404)
    return { token, expiresAt: expiresAt.toISOString(), user }
  }

  findSession(token) {
    const tokenHash = hashSessionToken(token)
    if (!tokenHash) return null
    const now = new Date().toISOString()
    const row = this.db
      .prepare(`
        SELECT
          s.user_id AS userId,
          s.expires_at AS expiresAt,
          u.id,
          u.username,
          u.player_name AS playerName,
          u.shop_name AS shopName,
          u.account_type AS accountType,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          u.last_seen_at AS lastSeenAt
        FROM sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token_hash = ? AND s.expires_at > ?
      `)
      .get(tokenHash, now)
    if (!row) return null
    this.db
      .prepare('UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?')
      .run(now, tokenHash)
    this.db
      .prepare('UPDATE users SET last_seen_at = ? WHERE id = ?')
      .run(now, row.userId)
    return {
      user: {
        id: row.id,
        username: row.username,
        playerName: row.playerName,
        shopName: row.shopName,
        accountType: row.accountType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastSeenAt: now,
      },
      expiresAt: row.expiresAt,
    }
  }

  revokeSession(token) {
    const tokenHash = hashSessionToken(token)
    if (tokenHash) {
      this.db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    }
  }

  load(userId) {
    validateUserId(userId)
    const row = this.db
      .prepare(`
        SELECT
          u.id,
          u.username,
          u.player_name AS playerName,
          u.shop_name AS shopName,
          u.account_type AS accountType,
          u.created_at AS createdAt,
          u.updated_at AS updatedAt,
          u.last_seen_at AS lastSeenAt,
          s.revision,
          s.save_version AS saveVersion,
          s.state_json AS stateJson,
          s.client_updated_at AS clientUpdatedAt,
          s.saved_at AS savedAt
        FROM users u
        LEFT JOIN game_saves s ON s.user_id = u.id
        WHERE u.id = ?
      `)
      .get(userId)

    if (!row) return null
    if (!row.stateJson) {
      return {
        user: {
          id: row.id,
          username: row.username,
          playerName: row.playerName,
          shopName: row.shopName,
          accountType: row.accountType,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          lastSeenAt: row.lastSeenAt,
        },
        save: null,
      }
    }

    let state
    try {
      state = JSON.parse(row.stateJson)
    } catch {
      throw new UserDataError('数据库中的存档已损坏', 500)
    }
    return {
      user: {
        id: row.id,
        username: row.username,
        playerName: row.playerName,
        shopName: row.shopName,
        accountType: row.accountType,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastSeenAt: row.lastSeenAt,
      },
      save: {
        revision: row.revision,
        saveVersion: row.saveVersion,
        clientUpdatedAt: row.clientUpdatedAt,
        savedAt: row.savedAt,
        state,
      },
    }
  }

  loadCurrent(userId) {
    const result = this.load(userId)
    return result ?? { user: null, save: null }
  }

  save(userId, body) {
    validateUserId(userId)
    const payload = validateSavePayload(body)
    const expectedRevision = parseExpectedRevision(body.revision)
    const now = new Date().toISOString()

    this.db.exec('BEGIN IMMEDIATE')
    try {
      this.db
        .prepare(`
          INSERT INTO users(id, player_name, shop_name, created_at, updated_at, last_seen_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            player_name = excluded.player_name,
            shop_name = excluded.shop_name,
            updated_at = excluded.updated_at,
            last_seen_at = excluded.last_seen_at
        `)
        .run(
          userId,
          payload.playerName,
          payload.shopName,
          now,
          now,
          now,
        )

      const current = this.db
        .prepare('SELECT revision, state_json AS stateJson FROM game_saves WHERE user_id = ?')
        .get(userId)
      const currentRevision = current?.revision ?? 0

      if (expectedRevision !== null && expectedRevision !== currentRevision) {
        this.db.exec('ROLLBACK')
        let currentState = null
        try {
          currentState = current?.stateJson ? JSON.parse(current.stateJson) : null
        } catch {
          currentState = null
        }
        return {
          conflict: true,
          revision: currentRevision,
          state: currentState,
        }
      }

      if (current) {
        const stored = this.db
          .prepare('SELECT state_json AS stateJson FROM game_saves WHERE user_id = ?')
          .get(userId)
        if (stored?.stateJson === payload.serialized) {
          this.db.exec('COMMIT')
          return {
            conflict: false,
            unchanged: true,
            revision: currentRevision,
            savedAt: this.load(userId)?.save?.savedAt ?? now,
          }
        }
      }

      const nextRevision = currentRevision + 1
      this.db
        .prepare(`
          INSERT INTO game_saves(
            user_id, revision, save_version, state_json, client_updated_at, saved_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            revision = excluded.revision,
            save_version = excluded.save_version,
            state_json = excluded.state_json,
            client_updated_at = excluded.client_updated_at,
            saved_at = excluded.saved_at
        `)
        .run(
          userId,
          nextRevision,
          payload.saveVersion,
          payload.serialized,
          payload.clientUpdatedAt,
          now,
        )
      this.db
        .prepare(`
          INSERT INTO save_versions(
            user_id, revision, save_version, state_json, client_updated_at, saved_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(
          userId,
          nextRevision,
          payload.saveVersion,
          payload.serialized,
          payload.clientUpdatedAt,
          now,
        )

      // 每名玩家保留最近 20 个快照，防止本地数据库无限增长。
      this.db
        .prepare(`
          DELETE FROM save_versions
          WHERE user_id = ?
            AND revision NOT IN (
              SELECT revision FROM save_versions
              WHERE user_id = ?
              ORDER BY revision DESC
              LIMIT 20
            )
        `)
        .run(userId, userId)

      this.db.exec('COMMIT')
      return {
        conflict: false,
        unchanged: false,
        revision: nextRevision,
        savedAt: now,
      }
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* transaction may already be closed */
      }
      throw error
    }
  }

  delete(userId, expectedRevision) {
    validateUserId(userId)
    const revision = parseExpectedRevision(expectedRevision)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.db
        .prepare('SELECT revision FROM game_saves WHERE user_id = ?')
        .get(userId)
      const currentRevision = current?.revision ?? 0
      if (revision !== null && revision !== currentRevision) {
        this.db.exec('ROLLBACK')
        return { conflict: true, revision: currentRevision }
      }
      this.db.prepare('DELETE FROM users WHERE id = ?').run(userId)
      this.db.exec('COMMIT')
      return { conflict: false, revision: 0 }
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* transaction may already be closed */
      }
      throw error
    }
  }

  clearSave(userId, expectedRevision) {
    validateUserId(userId)
    const revision = parseExpectedRevision(expectedRevision)
    this.db.exec('BEGIN IMMEDIATE')
    try {
      const current = this.db
        .prepare('SELECT revision FROM game_saves WHERE user_id = ?')
        .get(userId)
      const currentRevision = current?.revision ?? 0
      if (revision !== null && revision !== currentRevision) {
        this.db.exec('ROLLBACK')
        return { conflict: true, revision: currentRevision }
      }
      this.db.prepare('DELETE FROM save_versions WHERE user_id = ?').run(userId)
      this.db.prepare('DELETE FROM game_saves WHERE user_id = ?').run(userId)
      this.db
        .prepare('UPDATE users SET updated_at = ?, last_seen_at = ? WHERE id = ?')
        .run(new Date().toISOString(), new Date().toISOString(), userId)
      this.db.exec('COMMIT')
      return { conflict: false, revision: 0 }
    } catch (error) {
      try {
        this.db.exec('ROLLBACK')
      } catch {
        /* transaction may already be closed */
      }
      throw error
    }
  }

  close() {
    this.db.close()
  }
}

export function createUserDatabase(filePath) {
  return new UserDatabase(filePath)
}

export const USER_DB_LIMITS = {
  maxSaveBytes: MAX_SAVE_BYTES,
  maxPlayerNameLength: MAX_PLAYER_NAME_LENGTH,
  maxShopNameLength: MAX_SHOP_NAME_LENGTH,
}
