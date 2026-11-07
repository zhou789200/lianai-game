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
const USER_ID_PATTERN = /^[a-zA-Z0-9_-]{16,64}$/

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

export function validateSavePayload(body) {
  if (!isRecord(body)) throw new UserDataError('存档内容格式不正确')
  if (!isRecord(body.save)) throw new UserDataError('缺少游戏存档')

  const state = body.save
  if (typeof state.version !== 'number' || !Number.isSafeInteger(state.version) || state.version < 1) {
    throw new UserDataError('存档版本不正确')
  }
  if (typeof state.updatedAt !== 'number' || !Number.isFinite(state.updatedAt)) {
    throw new UserDataError('存档更新时间不正确')
  }
  if (typeof state.playerName !== 'string' || typeof state.shopName !== 'string') {
    throw new UserDataError('存档缺少玩家资料')
  }

  const serialized = JSON.stringify(state)
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
