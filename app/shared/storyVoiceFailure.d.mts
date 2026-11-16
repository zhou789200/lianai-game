export class OnlineVoiceTimeoutError extends Error {
  constructor()
}

export const STORY_AUTO_ADVANCE_MS: number

export function getStoryAutoAdvanceDelay(enabled: boolean): number | null

export function isStoryAutoAdvanceReady(options?: {
  allowed?: boolean
  textComplete?: boolean
  voiceFinished?: boolean
  pageVisible?: boolean
}): boolean

export function isAbortFailure(error: unknown): boolean

export function normalizeOnlineVoiceFailure(
  error: unknown,
  didTimeOut: boolean,
): unknown

export function shouldUseSystemVoiceFallback(error: unknown): boolean
