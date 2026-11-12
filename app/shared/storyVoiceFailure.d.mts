export class OnlineVoiceTimeoutError extends Error {
  constructor()
}

export function isAbortFailure(error: unknown): boolean

export function normalizeOnlineVoiceFailure(
  error: unknown,
  didTimeOut: boolean,
): unknown

export function shouldUseSystemVoiceFallback(error: unknown): boolean
