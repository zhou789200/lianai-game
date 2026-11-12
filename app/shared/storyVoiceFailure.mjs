export class OnlineVoiceTimeoutError extends Error {
  constructor() {
    super('在线语音请求超时')
    this.name = 'OnlineVoiceTimeoutError'
  }
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
