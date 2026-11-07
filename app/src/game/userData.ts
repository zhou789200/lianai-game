import type { GameState } from './types'

const REQUEST_TIMEOUT_MS = 8_000

export interface AccountUser {
  id: string
  username: string
  playerName: string
  shopName: string
  accountType: 'account' | 'guest'
  createdAt: string
  updatedAt: string
  lastSeenAt: string
}

interface RemoteSaveResult {
  revision: number
  savedAt: string
  unchanged: boolean
}

export type UserDataSource = 'remote' | 'local'

export interface AccountConflict {
  revision: number
  state: GameState | null
}

export interface UserDataStatus {
  user: AccountUser | null
  revision: number
  source: UserDataSource
  lastSyncedAt: number | null
  error: string | null
  syncBlocked: boolean
  conflict: AccountConflict | null
}

export class UserDataConflictError extends Error {
  readonly revision: number
  readonly state: unknown

  constructor(revision: number, state: unknown) {
    super('云端存档已有更新版本')
    this.name = 'UserDataConflictError'
    this.revision = revision
    this.state = state
  }
}

export class AuthenticationRequiredError extends Error {
  constructor(message = '请先登录游戏账号') {
    super(message)
    this.name = 'AuthenticationRequiredError'
  }
}

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    })
    const payload: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      if (response.status === 401) {
        throw new AuthenticationRequiredError(
          isRecord(payload) && typeof payload.error === 'string'
            ? payload.error
            : undefined,
        )
      }
      if (response.status === 409 && isRecord(payload)) {
        throw new UserDataConflictError(
          typeof payload.revision === 'number' ? payload.revision : 0,
          payload.state ?? null,
        )
      }
      const message =
        isRecord(payload) && typeof payload.error === 'string'
          ? payload.error
          : `用户数据请求失败（${response.status}）`
      throw new Error(message)
    }
    return payload
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('用户数据库连接超时')
    }
    throw error
  } finally {
    window.clearTimeout(timer)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseUser(value: unknown): AccountUser | null {
  if (
    !isRecord(value) ||
    typeof value.id !== 'string' ||
    typeof value.username !== 'string'
  ) {
    return null
  }
  return {
    id: value.id,
    username: value.username,
    playerName: typeof value.playerName === 'string' ? value.playerName : value.username,
    shopName: typeof value.shopName === 'string' ? value.shopName : '海风镇宠物咖啡馆',
    accountType: value.accountType === 'guest' ? 'guest' : 'account',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    lastSeenAt:
      typeof value.lastSeenAt === 'string' ? value.lastSeenAt : new Date().toISOString(),
  }
}

export async function getCurrentAccount(): Promise<AccountUser | null> {
  const payload = await requestJson('/api/auth/me')
  return isRecord(payload) ? parseUser(payload.user) : null
}

export async function registerAccount(
  username: string,
  password: string,
): Promise<AccountUser> {
  const payload = await requestJson('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  const user = isRecord(payload) ? parseUser(payload.user) : null
  if (!user) throw new Error('账号服务返回格式不正确')
  return user
}

export async function loginAccount(
  username: string,
  password: string,
): Promise<AccountUser> {
  const payload = await requestJson('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  const user = isRecord(payload) ? parseUser(payload.user) : null
  if (!user) throw new Error('账号服务返回格式不正确')
  return user
}

export async function logoutAccount(): Promise<void> {
  await requestJson('/api/auth/logout', { method: 'POST' })
}

export async function loadRemoteSave(): Promise<{
  state: GameState | null
  revision: number
} | null> {
  const payload = await requestJson('/api/me/save')
  if (!isRecord(payload) || !isRecord(payload.save)) {
    return { state: null, revision: 0 }
  }
  return {
    state: payload.save.state as GameState,
    revision:
      typeof payload.save.revision === 'number' ? payload.save.revision : 0,
  }
}

export async function saveRemoteState(
  state: GameState,
  revision: number,
): Promise<RemoteSaveResult> {
  const payload = await requestJson('/api/me/save', {
    method: 'PUT',
    body: JSON.stringify({ save: state, revision }),
  })
  if (!isRecord(payload) || typeof payload.revision !== 'number') {
    throw new Error('用户数据服务返回格式不正确')
  }
  return {
    revision: payload.revision,
    savedAt:
      typeof payload.savedAt === 'string'
        ? payload.savedAt
        : new Date().toISOString(),
    unchanged: payload.unchanged === true,
  }
}

export async function deleteRemoteSave(revision: number): Promise<void> {
  await requestJson(`/api/me/save?revision=${revision}`, {
    method: 'DELETE',
  })
}
