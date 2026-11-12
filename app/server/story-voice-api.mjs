import { createHash } from 'node:crypto'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const MAX_BODY_BYTES = 8 * 1024
const MAX_TEXT_LENGTH = 320
const RATE_WINDOW_MS = 60_000
const RATE_LIMIT = 60
const CACHE_TTL_MS = 10 * 60_000
const CACHE_MAX_BYTES = 16 * 1024 * 1024
const CONNECTION_TIMEOUT_MS = 15_000
const SYNTHESIS_TIMEOUT_MS = 30_000

const VOICE_PROFILES = {
  旁白: {
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: 0.94,
    pitch: '-2Hz',
    volume: 91,
  },
  你: {
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: 0.98,
    pitch: '0Hz',
    volume: 92,
  },
  林澈: {
    voice: 'zh-CN-YunjianNeural',
    rate: 0.88,
    pitch: '-8Hz',
    volume: 92,
  },
  顾淮: {
    voice: 'zh-CN-YunxiNeural',
    rate: 0.92,
    pitch: '-4Hz',
    volume: 91,
  },
  阿岚: {
    voice: 'zh-CN-XiaoyiNeural',
    rate: 1.02,
    pitch: '2Hz',
    volume: 92,
  },
  布丁: {
    voice: 'zh-CN-XiaoyiNeural',
    rate: 1.1,
    pitch: '+18Hz',
    volume: 90,
  },
  旧屋主人: {
    voice: 'zh-CN-YunyangNeural',
    rate: 0.82,
    pitch: '-10Hz',
    volume: 91,
  },
  选择之后: {
    voice: 'zh-CN-XiaoxiaoNeural',
    rate: 0.92,
    pitch: '-1Hz',
    volume: 90,
  },
}

const DEFAULT_PROFILE = VOICE_PROFILES.旁白

class StoryVoiceApiError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'StoryVoiceApiError'
    this.status = status
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cleanText(value, maxLength, fallback = '') {
  if (typeof value !== 'string') return fallback
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export function resolveStoryVoiceProfile(speaker) {
  const name = cleanText(speaker, 32, '旁白') || '旁白'
  const alias = name === '林撤' ? '林澈' : name
  return {
    speaker: name,
    ...(VOICE_PROFILES[alias] ?? DEFAULT_PROFILE),
  }
}

export function sanitizeStoryVoiceRequest(body) {
  if (!isRecord(body)) throw new StoryVoiceApiError('请求内容格式不正确')
  const text = cleanText(body.text, MAX_TEXT_LENGTH)
  if (!text) throw new StoryVoiceApiError('需要朗读的剧情文字不能为空')
  return {
    text,
    ...resolveStoryVoiceProfile(body.speaker),
  }
}

function cacheKeyFor(request) {
  return createHash('sha256')
    .update(
      [
        request.voice,
        request.rate,
        request.pitch,
        request.volume,
        request.text,
      ].join('\u0000'),
    )
    .digest('base64url')
}

export async function synthesizeStoryVoiceAudio(text, profile, options = {}) {
  const signal = options.signal
  if (signal?.aborted) throw new StoryVoiceApiError('语音请求已取消', 499)

  const tts = new MsEdgeTTS({
    connectionTimeoutMs: CONNECTION_TIMEOUT_MS,
    synthesisTimeoutMs: SYNTHESIS_TIMEOUT_MS,
  })
  let removeAbortListener = () => {}

  try {
    await tts.setMetadata(
      profile.voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3,
    )
    if (signal?.aborted) throw new StoryVoiceApiError('语音请求已取消', 499)

    const { audioStream } = tts.toStream(escapeXml(text), {
      rate: profile.rate,
      pitch: profile.pitch,
      volume: profile.volume,
    })
    const chunks = []

    await new Promise((resolve, reject) => {
      let settled = false
      const finish = () => {
        if (settled) return
        settled = true
        resolve()
      }
      const fail = (error) => {
        if (settled) return
        settled = true
        reject(error)
      }
      const abort = () => {
        tts.close()
        fail(new StoryVoiceApiError('语音请求已取消', 499))
      }

      audioStream.on('data', (chunk) => chunks.push(chunk))
      audioStream.once('end', finish)
      audioStream.once('close', finish)
      audioStream.once('error', fail)
      if (signal) {
        signal.addEventListener('abort', abort, { once: true })
        removeAbortListener = () => signal.removeEventListener('abort', abort)
      }
    })

    const audio = Buffer.concat(chunks)
    if (audio.length < 128) throw new Error('语音服务返回了空音频')
    return audio
  } finally {
    removeAbortListener()
    tts.close()
  }
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []

    req.on('data', (chunk) => {
      size += chunk.length
      if (size > MAX_BODY_BYTES) {
        reject(new StoryVoiceApiError('语音请求内容过大', 413))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'))
      } catch {
        reject(new StoryVoiceApiError('请求 JSON 无法解析'))
      }
    })
    req.on('error', reject)
  })
}

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function sendAudio(res, audio, profile) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'audio/mpeg')
  res.setHeader('Content-Length', audio.length)
  res.setHeader('Cache-Control', 'private, max-age=3600')
  res.setHeader('X-Story-Voice', profile.voice)
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.end(audio)
}

export function createStoryVoiceMiddleware(options = {}) {
  const synthesize = options.synthesize ?? synthesizeStoryVoiceAudio
  const buckets = new Map()
  const cache = new Map()
  const pending = new Map()
  let cacheBytes = 0

  const retainPendingTask = (cacheKey, task) => {
    task.users += 1
    return () => {
      task.users -= 1
      if (task.users > 0 || task.settled) return
      task.controller.abort()
      if (pending.get(cacheKey) === task) pending.delete(cacheKey)
    }
  }

  const pruneCache = (now = Date.now()) => {
    for (const [key, entry] of cache) {
      if (now - entry.createdAt < CACHE_TTL_MS) continue
      cache.delete(key)
      cacheBytes -= entry.audio.length
    }
    while (cacheBytes > CACHE_MAX_BYTES && cache.size > 0) {
      const [key, entry] = cache.entries().next().value
      cache.delete(key)
      cacheBytes -= entry.audio.length
    }
  }

  return async function storyVoiceMiddleware(req, res, next) {
    const pathname = new URL(req.url ?? '/', 'http://localhost').pathname
    if (pathname !== '/api/story/voice') {
      next()
      return
    }
    if (req.method !== 'POST') {
      sendJson(res, 405, { error: '只接受 POST 请求' })
      return
    }

    const key = req.socket?.remoteAddress || 'local'
    const now = Date.now()
    const bucket = (buckets.get(key) || []).filter((at) => now - at < RATE_WINDOW_MS)
    if (bucket.length >= RATE_LIMIT) {
      sendJson(res, 429, { error: '语音请求过于频繁，请稍后再试' })
      return
    }
    bucket.push(now)
    buckets.set(key, bucket)

    let disconnected = false
    let disconnectRequest = () => {}
    const disconnectedPromise = new Promise((_, reject) => {
      disconnectRequest = () => {
        disconnected = true
        reject(new StoryVoiceApiError('语音请求已取消', 499))
      }
    })
    // 消费拒绝，避免客户端在读取请求体之前断开时出现未处理拒绝。
    void disconnectedPromise.catch(() => undefined)
    res.once('close', () => {
      if (!res.writableFinished) disconnectRequest()
    })

    try {
      const request = sanitizeStoryVoiceRequest(
        await Promise.race([readJsonBody(req), disconnectedPromise]),
      )
      const cacheKey = cacheKeyFor(request)
      pruneCache()

      const cached = cache.get(cacheKey)
      if (cached) {
        sendAudio(res, cached.audio, request)
        return
      }

      let task = pending.get(cacheKey)
      if (!task) {
        const abortController = new AbortController()
        const promise = Promise.resolve()
          .then(() =>
            synthesize(request.text, request, {
              signal: abortController.signal,
            }),
          )
          .then((audio) => {
            if (!Buffer.isBuffer(audio) || audio.length < 128) {
              throw new Error('语音服务返回了空音频')
            }
            cache.set(cacheKey, { audio, createdAt: Date.now() })
            cacheBytes += audio.length
            pruneCache()
            return audio
          })
          .finally(() => {
            task.settled = true
            if (pending.get(cacheKey) === task) pending.delete(cacheKey)
          })
        task = {
          promise,
          controller: abortController,
          users: 0,
          settled: false,
        }
        pending.set(cacheKey, task)
      }

      const releaseTask = retainPendingTask(cacheKey, task)
      const audio = await Promise.race([task.promise, disconnectedPromise])
        .finally(releaseTask)
      sendAudio(res, audio, request)
    } catch (error) {
      const status = error instanceof StoryVoiceApiError ? error.status : 502
      if (status !== 499) {
        console.warn(
          `[story-voice] synthesis failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      }
      if (!res.headersSent) {
        sendJson(res, status, {
          error: status === 502 ? '自然语音暂时不可用' : error.message,
        })
      }
    }
  }
}

export { StoryVoiceApiError, VOICE_PROFILES }
