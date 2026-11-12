/* ============================================================
   剧情角色朗读
   ------------------------------------------------------------
   优先使用同源神经语音服务，得到自然 MP3 后通过 Web Audio 播放。
   服务不可用时落回浏览器原生 SpeechSynthesis；旁白与角色始终使用
   不同的声线，并且每次翻页只保留当前一句。
   ============================================================ */

import { isSoundEnabled } from './sound'
import {
  decodeGameAudio,
  isGameAudioSupported,
  playGameAudio,
  primeGameAudio,
  type GameAudioPlayback,
} from './sfx'

const STORY_VOICE_KEY = 'seabreeze-pet-cafe.story-voice'
const STORY_VOICE_EVENT = 'seabreeze:story-voice-change'
const STORY_VOICE_ENDPOINT = './api/story/voice'
// Edge Read Aloud 首次建连偶尔需要 10–20 秒；宁可多等一会儿，
// 也不要过早切到明显更机械的操作系统离线音色。
const ONLINE_VOICE_TIMEOUT_MS = 30_000
const AUDIO_CACHE_LIMIT = 24

let cached: boolean | null = null
let currentOwner: string | null = null
let currentUtterance: SpeechSynthesisUtterance | null = null
let currentPlayback: GameAudioPlayback | null = null
let cancelCurrentRequest: (() => void) | null = null
let playbackId = 0
const decodedAudioCache = new Map<string, AudioBuffer>()
const pendingOnlineAudio = new Map<
  string,
  { promise: Promise<AudioBuffer>; controller: AbortController; users: number }
>()

interface VoiceProfile {
  pitch: number
  rate: number
  gender: 'female' | 'male' | 'neutral'
  voiceHints: readonly string[]
}

interface SpeakStoryTextOptions {
  text: string
  speaker?: string
  owner: string
}

const CHARACTER_PROFILES: Record<string, VoiceProfile> = {
  旁白: {
    pitch: 1.02,
    rate: 0.94,
    gender: 'female',
    voiceHints: ['xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao', 'tingting', 'meijia'],
  },
  你: {
    pitch: 1.02,
    rate: 1,
    gender: 'neutral',
    voiceHints: [],
  },
  林澈: {
    pitch: 0.84,
    rate: 0.92,
    gender: 'male',
    voiceHints: ['yunyang', 'yunjian', 'yunxi', 'yunfeng', 'kangkang', 'zhiwei'],
  },
  顾淮: {
    pitch: 0.9,
    rate: 0.94,
    gender: 'male',
    voiceHints: ['yunyang', 'yunjian', 'yunxi', 'yunfeng', 'kangkang', 'zhiwei'],
  },
  阿岚: {
    pitch: 1.08,
    rate: 1.01,
    gender: 'female',
    voiceHints: ['xiaoyi', 'xiaomo', 'xiaoxiao', 'huihui', 'yaoyao'],
  },
  布丁: {
    pitch: 1.24,
    rate: 1.08,
    gender: 'female',
    voiceHints: ['xiaoyi', 'xiaoxiao', 'yaoyao', 'huihui'],
  },
  旧屋主人: {
    pitch: 0.82,
    rate: 0.88,
    gender: 'male',
    voiceHints: ['yunyang', 'yunjian', 'yunfeng', 'kangkang', 'zhiwei'],
  },
  选择之后: {
    pitch: 1.01,
    rate: 0.94,
    gender: 'female',
    voiceHints: ['xiaoxiao', 'xiaoyi', 'xiaomo', 'huihui', 'yaoyao'],
  },
}

const FEMALE_NAME_HINTS = [
  'female',
  'woman',
  'xiaoxiao',
  'xiaoyi',
  'xiaomo',
  'xiaohan',
  'xiaozhen',
  'huihui',
  'yaoyao',
  'tingting',
  'meijia',
  'sinji',
  '女声',
  '女',
]

function normalizeSpeaker(speaker: string): string {
  return speaker === '林撤' ? '林澈' : speaker
}

const MALE_NAME_HINTS = [
  'male',
  'man',
  'yunyang',
  'yunjian',
  'yunxi',
  'yunfeng',
  'kangkang',
  'zhiwei',
  'liang',
  '男声',
  '男',
]

function speechSynthesisApi(): SpeechSynthesis | null {
  if (
    typeof window === 'undefined' ||
    !('speechSynthesis' in window) ||
    typeof SpeechSynthesisUtterance === 'undefined'
  ) {
    return null
  }
  return window.speechSynthesis
}

function stringHash(value: string): number {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function profileFor(speaker: string): VoiceProfile {
  const known = CHARACTER_PROFILES[normalizeSpeaker(speaker)]
  if (known) return known

  const hash = stringHash(speaker)
  return {
    pitch: 0.88 + ((hash >>> 8) % 23) / 100,
    rate: 0.9 + ((hash >>> 16) % 13) / 100,
    gender: 'neutral',
    voiceHints: [],
  }
}

function chineseVoices(): SpeechSynthesisVoice[] {
  const api = speechSynthesisApi()
  if (!api) return []
  return api.getVoices().filter(
    (voice) =>
      /^zh(?:-|_)/i.test(voice.lang) ||
      /chinese|mandarin|中文|普通话|國語|国语/i.test(voice.name),
  )
}

function normalizeVoiceText(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '')
}

function genderForVoice(voice: SpeechSynthesisVoice): VoiceProfile['gender'] {
  const name = voice.name.toLowerCase()
  const tokenGender = /(?:^|[\s_-])([fm])(?:$|[\s_-])/.exec(name)?.[1]
  const uriGender = /(?:^|[\s_-])([fm])(?:$|[\s_-])/.exec(voice.voiceURI.toLowerCase())?.[1]
  const marker = tokenGender ?? uriGender

  if (marker === 'f') return 'female'
  if (marker === 'm') return 'male'
  if (FEMALE_NAME_HINTS.some((hint) => name.includes(normalizeVoiceText(hint)))) {
    return 'female'
  }
  if (MALE_NAME_HINTS.some((hint) => name.includes(normalizeVoiceText(hint)))) {
    return 'male'
  }
  return 'neutral'
}

function scoreVoice(
  speaker: string,
  profile: VoiceProfile,
  voice: SpeechSynthesisVoice,
): number {
  const name = normalizeVoiceText(voice.name)
  const voiceGender = genderForVoice(voice)
  let score = 0

  profile.voiceHints.forEach((hint, index) => {
    if (name.includes(normalizeVoiceText(hint))) {
      score += 1000 - index * 20
    }
  })

  if (profile.gender !== 'neutral') {
    if (voiceGender === profile.gender) score += 400
    else if (voiceGender !== 'neutral') score -= 500
  }

  const lang = voice.lang.toLowerCase()
  if (/^(zh-cn|zh-hans|cmn-hans)/.test(lang)) score += 80
  else if (/^(zh-sg|zh)/.test(lang)) score += 40
  if (/natural|neural|online/.test(name)) score += 15

  // 同一类声线有多个候选时也保持稳定，不会每次朗读随机换人。
  score += stringHash(`${speaker}:${voice.voiceURI}`) % 9
  return score
}

function voiceFor(
  speaker: string,
  voiceProfile: VoiceProfile,
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined
  return voices.reduce((best, voice) =>
    scoreVoice(speaker, voiceProfile, voice) > scoreVoice(speaker, voiceProfile, best)
      ? voice
      : best,
  )
}

function cleanStoryText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function audioCacheKey(speaker: string, text: string): string {
  return `${normalizeSpeaker(speaker)}\u0000${text}`
}

function trimAudioCache(): void {
  while (decodedAudioCache.size > AUDIO_CACHE_LIMIT) {
    const oldest = decodedAudioCache.keys().next().value
    if (oldest === undefined) return
    decodedAudioCache.delete(oldest)
  }
}

function rememberAudio(key: string, buffer: AudioBuffer): void {
  decodedAudioCache.delete(key)
  decodedAudioCache.set(key, buffer)
  trimAudioCache()
}

function retainOnlineAudio(key: string): void {
  const active = pendingOnlineAudio.get(key)
  if (active) active.users += 1
}

function releaseOnlineAudio(key: string): void {
  const active = pendingOnlineAudio.get(key)
  if (!active) return
  active.users -= 1
  if (active.users > 0) return
  active.controller.abort()
  pendingOnlineAudio.delete(key)
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof DOMException && error.name === 'AbortError'
  ) || (
    error instanceof Error && error.name === 'AbortError'
  )
}

interface OnlineAudioSubscription {
  promise: Promise<AudioBuffer>
  cancel: () => void
}

function requestOnlineAudio(
  text: string,
  speaker: string,
  key: string,
): OnlineAudioSubscription {
  const decoded = decodedAudioCache.get(key)
  if (decoded) {
    rememberAudio(key, decoded)
    return {
      promise: Promise.resolve(decoded),
      cancel: () => undefined,
    }
  }

  const existing = pendingOnlineAudio.get(key)
  if (existing) {
    retainOnlineAudio(key)
    return {
      promise: existing.promise,
      cancel: () => releaseOnlineAudio(key),
    }
  }

  const controller = new AbortController()
  const promise = (async () => {
    const timeout = window.setTimeout(
      () => controller.abort(),
      ONLINE_VOICE_TIMEOUT_MS,
    )
    try {
      const response = await fetch(STORY_VOICE_ENDPOINT, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          Accept: 'audio/mpeg',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text, speaker }),
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`自然语音请求失败（${response.status}）`)
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentType.includes('audio/')) throw new Error('自然语音响应格式不正确')
      return await decodeGameAudio(await response.arrayBuffer())
    } finally {
      window.clearTimeout(timeout)
    }
  })()

  const entry = { promise, controller, users: 1 }
  pendingOnlineAudio.set(key, entry)
  promise
    .then((buffer) => {
      if (pendingOnlineAudio.get(key) === entry) rememberAudio(key, buffer)
    })
    .catch(() => undefined)
    .finally(() => {
      if (pendingOnlineAudio.get(key) === entry) pendingOnlineAudio.delete(key)
    })
  return {
    promise,
    cancel: () => releaseOnlineAudio(key),
  }
}

function clearPlayback(): void {
  currentPlayback?.stop()
  currentPlayback = null
  cancelCurrentRequest?.()
  cancelCurrentRequest = null
}

export function isSpeechSupported(): boolean {
  return isGameAudioSupported() || speechSynthesisApi() !== null
}

export function hasChineseVoice(): boolean {
  return chineseVoices().length > 0
}

export function isStoryVoiceEnabled(): boolean {
  if (cached !== null) return cached
  try {
    cached = window.localStorage.getItem(STORY_VOICE_KEY) !== 'off'
  } catch {
    cached = true
  }
  return cached
}

export function setStoryVoiceEnabled(next: boolean): void {
  cached = next
  try {
    window.localStorage.setItem(STORY_VOICE_KEY, next ? 'on' : 'off')
  } catch {
    /* 隐私模式下 localStorage 不可用：本次会话内仍然生效 */
  }
  if (!next) stopStoryVoice()
  window.dispatchEvent(new Event(STORY_VOICE_EVENT))
}

export function onStoryVoiceChange(listener: () => void): () => void {
  window.addEventListener(STORY_VOICE_EVENT, listener)
  return () => window.removeEventListener(STORY_VOICE_EVENT, listener)
}

/**
 * owner 用来防止已经停用的页面误停另一层正在朗读的内容。
 * 不传 owner 时执行全局停止。
 */
export function stopStoryVoice(owner?: string): void {
  if (owner && currentOwner !== owner) return
  currentOwner = null
  currentUtterance = null
  playbackId += 1
  clearPlayback()
  speechSynthesisApi()?.cancel()
}

function speakWithSystemVoice(
  text: string,
  speaker: string,
  owner: string,
  id: number,
): boolean {
  const api = speechSynthesisApi()
  if (!api) return false

  const profile = profileFor(speaker)
  const utterance = new SpeechSynthesisUtterance(text)

  utterance.lang = 'zh-CN'
  utterance.pitch = profile.pitch
  utterance.rate = profile.rate
  utterance.volume = speaker === '旁白' ? 0.9 : 0.94

  currentOwner = owner
  currentUtterance = utterance
  utterance.onend = () => {
    if (id !== playbackId || currentUtterance !== utterance) return
    currentOwner = null
    currentUtterance = null
  }
  utterance.onerror = () => {
    if (id !== playbackId || currentUtterance !== utterance) return
    currentOwner = null
    currentUtterance = null
  }

  let startTimer = 0
  let started = false
  const start = () => {
    if (started) return
    started = true
    window.clearTimeout(startTimer)
    if (
      id !== playbackId ||
      currentUtterance !== utterance ||
      !isSoundEnabled() ||
      !isStoryVoiceEnabled()
    ) {
      return
    }

    // 只有原生语音回退才读取系统音色。在线神经语音承担主路径。
    const voice = voiceFor(speaker, profile, chineseVoices())
    if (voice) utterance.voice = voice

    try {
      api.resume()
      api.speak(utterance)
    } catch {
      if (id === playbackId) {
        currentOwner = null
        currentUtterance = null
      }
    }
  }

  const waitForVoices = (attempt: number) => {
    if (id !== playbackId || currentUtterance !== utterance) return
    if (chineseVoices().length || attempt >= 6) {
      start()
      return
    }
    startTimer = window.setTimeout(() => waitForVoices(attempt + 1), 80)
  }

  startTimer = window.setTimeout(() => waitForVoices(0), 0)
  return true
}

export function speakStoryText({
  text,
  speaker = '旁白',
  owner,
}: SpeakStoryTextOptions): boolean {
  const content = cleanStoryText(text)
  if (
    !isSoundEnabled() ||
    !isStoryVoiceEnabled() ||
    !content
  ) {
    return false
  }

  stopStoryVoice()
  if (!isGameAudioSupported()) {
    const id = playbackId
    currentOwner = owner
    return speakWithSystemVoice(content, speaker, owner, id)
  }
  primeGameAudio()

  const id = playbackId
  const voiceKey = audioCacheKey(speaker, content)
  currentOwner = owner

  const cachedAudio = decodedAudioCache.get(voiceKey)
  if (cachedAudio) {
    rememberAudio(voiceKey, cachedAudio)
    const playback = playGameAudio(cachedAudio, {
      volume: 0.92,
      onEnded: () => {
        if (id !== playbackId) return
        currentOwner = null
        currentPlayback = null
      },
    })
    if (playback) {
      currentPlayback = playback
      return true
    }
  }

  const subscription = requestOnlineAudio(content, speaker, voiceKey)
  cancelCurrentRequest = subscription.cancel
  subscription.promise
    .then((buffer) => {
      if (
        id !== playbackId ||
        currentOwner !== owner ||
        !isSoundEnabled() ||
        !isStoryVoiceEnabled()
      ) {
        return
      }
      const playback = playGameAudio(buffer, {
        volume: 0.92,
        onEnded: () => {
          if (id !== playbackId) return
          currentOwner = null
          currentPlayback = null
        },
      })
      if (playback) {
        currentPlayback = playback
        cancelCurrentRequest = null
      }
    })
    .catch((error: unknown) => {
      if (id !== playbackId || currentOwner !== owner) return
      cancelCurrentRequest = null
      // 翻页主动取消请求时不应突然朗读已经离开的旧台词。
      if (isAbortError(error)) return
      speakWithSystemVoice(content, speaker, owner, id)
    })

  return true
}
