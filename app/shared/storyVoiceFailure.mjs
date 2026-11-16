export class OnlineVoiceTimeoutError extends Error {
  constructor() {
    super('在线语音请求超时')
    this.name = 'OnlineVoiceTimeoutError'
  }
}

export const STORY_AUTO_ADVANCE_MS = 5_000

export function getStoryAutoAdvanceDelay(enabled) {
  return enabled ? STORY_AUTO_ADVANCE_MS : null
}

/**
 * 自动翻页的唯一判定入口。
 *
 * 语音可能先于打字机结束，也可能在打字机之后结束；只有两个异步过程
 * 都完成、当前页面允许推进且页面仍可见时，才应该开始新的 5 秒计时。
 */
export function isStoryAutoAdvanceReady({
  allowed = false,
  textComplete = false,
  voiceFinished = false,
  pageVisible = true,
} = {}) {
  return Boolean(allowed && textComplete && voiceFinished && pageVisible)
}

function errorName(error) {
  if (
    error !== null &&
    typeof error === 'object' &&
    'name' in error &&
    typeof error.name === 'string'
  ) {
    return error.name
  }
  return ''
}

export function isAbortFailure(error) {
  return errorName(error) === 'AbortError'
}

export function normalizeOnlineVoiceFailure(error, didTimeOut) {
  if (didTimeOut && isAbortFailure(error)) return new OnlineVoiceTimeoutError()
  return error
}

export function shouldUseSystemVoiceFallback(error) {
  return errorName(error) !== 'AbortError'
}
