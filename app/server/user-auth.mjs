import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto'
import { promisify } from 'node:util'
import { UserDataError } from './user-db.mjs'

const scrypt = promisify(scryptCallback)
const USERNAME_MIN_LENGTH = 3
const USERNAME_MAX_LENGTH = 20
const PASSWORD_MIN_LENGTH = 8
const PASSWORD_MAX_LENGTH = 128
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]+$/u
const SESSION_TOKEN_PATTERN = /^[a-zA-Z0-9_-]{32,128}$/

export const SESSION_COOKIE_NAME = 'seabreeze_session'
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000

export function normalizeUsername(value) {
  if (typeof value !== 'string') {
    throw new UserDataError('请输入游戏账号')
  }
  const username = value.normalize('NFKC').trim()
  if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    throw new UserDataError(
      `游戏账号需为 ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} 个字符`,
    )
  }
  if (!USERNAME_PATTERN.test(username)) {
    throw new UserDataError('游戏账号只能包含文字、数字、下划线或短横线')
  }
  return username
}

export function usernameKey(username) {
  return normalizeUsername(username).toLocaleLowerCase('en-US')
}

export function validateCredentials(username, password) {
  const normalizedUsername = normalizeUsername(username)
  if (typeof password !== 'string') {
    throw new UserDataError('请输入密码')
  }
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    throw new UserDataError(
      `密码需为 ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} 个字符`,
    )
  }
  if (/[\u0000-\u001f\u007f]/.test(password)) {
    throw new UserDataError('密码包含不支持的字符')
  }
  return {
    username: normalizedUsername,
    usernameKey: usernameKey(normalizedUsername),
    password,
  }
}

export async function createPasswordRecord(password) {
  const salt = randomBytes(16).toString('hex')
  const hash = await derivePassword(password, salt)
  return { passwordHash: hash, passwordSalt: salt }
}

export async function verifyPassword(password, passwordHash, passwordSalt) {
  if (typeof passwordHash !== 'string' || typeof passwordSalt !== 'string') {
    return false
  }
  const actual = Buffer.from(await derivePassword(password, passwordSalt), 'hex')
  const expected = Buffer.from(passwordHash, 'hex')
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export function createSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token) {
  if (typeof token !== 'string' || !SESSION_TOKEN_PATTERN.test(token)) {
    return null
  }
  return createHash('sha256').update(token).digest('hex')
}

export function readSessionToken(cookieHeader) {
  if (typeof cookieHeader !== 'string') return null
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const name = part.slice(0, separator).trim()
    if (name !== SESSION_COOKIE_NAME) continue
    const value = part.slice(separator + 1).trim()
    return SESSION_TOKEN_PATTERN.test(value) ? value : null
  }
  return null
}

export function sessionCookie(token, options = {}) {
  const maxAge = Math.floor((options.ttlMs ?? SESSION_TTL_MS) / 1000)
  const secure = options.secure ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export function clearedSessionCookie(options = {}) {
  const secure = options.secure ? '; Secure' : ''
  return `${SESSION_COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`
}

async function derivePassword(password, salt) {
  const key = await scrypt(password, salt, 64, {
    N: 16_384,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  })
  return Buffer.from(key).toString('hex')
}

export const ACCOUNT_LIMITS = {
  usernameMinLength: USERNAME_MIN_LENGTH,
  usernameMaxLength: USERNAME_MAX_LENGTH,
  passwordMinLength: PASSWORD_MIN_LENGTH,
  passwordMaxLength: PASSWORD_MAX_LENGTH,
}
