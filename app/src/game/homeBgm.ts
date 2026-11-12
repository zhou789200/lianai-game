/* ============================================================
   主页背景音乐
   ------------------------------------------------------------
   四首原创轻音乐，使用 Web Audio 实时合成。
   进入主页随机选曲，用户也可以从主页唱片按钮切歌。
   只在主页挂载期间播放，并遵循现有全局声音开关。
   ============================================================ */

import {
  getSoundVolume,
  isSoundEnabled,
  onSoundChange,
  onSoundVolumeChange,
} from './sound'

type AudioContextCtor = typeof AudioContext

interface MelodyNote {
  midi: number
  beat: number
  duration: number
  gain: number
}

interface ChordBar {
  bass: number
  pad: readonly number[]
  melody: readonly MelodyNote[]
}

interface Track {
  id: string
  title: string
  mood: string
  bpm: number
  masterVolume: number
  seaVolume: number
  bars: readonly ChordBar[]
}

interface AudioSession {
  context: AudioContext
  master: GainNode
  musicBus: GainNode
  targetVolume: number
  track: Track
  sea: AudioBufferSourceNode
  scheduler: number | null
  closeTimer: number | null
  nextBarTime: number
  nextBarIndex: number
}

interface SessionOptions {
  masterVolume?: number
  fadeInSeconds?: number
  onFadeOutComplete?: () => void
}

export interface HomeBgmState {
  trackIndex: number
  trackCount: number
  title: string
  mood: string
}

const SCHEDULER_INTERVAL_MS = 250
const SCHEDULE_AHEAD_SECONDS = 0.7
const FADE_IN_SECONDS = 1.8
const FADE_OUT_SECONDS = 0.85
const TRACK_SWITCH_FADE_SECONDS = 0.55
const TRACK_SWITCH_OVERLAP_SECONDS = 0.3
const STORAGE_KEY = 'seabreeze-pet-cafe.last-home-track'

// 四首曲子都使用原创和声进行与五声音阶旋律，但速度、调式和配器气质不同。
const TRACKS: readonly Track[] = [
  {
    id: 'sea-breeze',
    title: '海风来信',
    mood: 'D 大调 · 温柔钟琴',
    bpm: 74,
    masterVolume: 0.5,
    seaVolume: 0.008,
    bars: [
      {
        bass: 38,
        pad: [50, 57, 61, 66],
        melody: [
          { midi: 78, beat: 0, duration: 1.15, gain: 0.021 },
          { midi: 81, beat: 0.9, duration: 0.75, gain: 0.013 },
          { midi: 76, beat: 1.7, duration: 1.35, gain: 0.018 },
          { midi: 74, beat: 2.9, duration: 0.95, gain: 0.014 },
        ],
      },
      {
        bass: 35,
        pad: [47, 54, 57, 62],
        melody: [
          { midi: 74, beat: 0, duration: 1.05, gain: 0.016 },
          { midi: 78, beat: 0.95, duration: 0.8, gain: 0.014 },
          { midi: 76, beat: 1.75, duration: 1.25, gain: 0.018 },
          { midi: 71, beat: 2.9, duration: 0.9, gain: 0.013 },
        ],
      },
      {
        bass: 31,
        pad: [43, 50, 54, 59],
        melody: [
          { midi: 71, beat: 0, duration: 1, gain: 0.015 },
          { midi: 74, beat: 0.9, duration: 0.8, gain: 0.014 },
          { midi: 79, beat: 1.7, duration: 1.35, gain: 0.02 },
          { midi: 78, beat: 2.85, duration: 0.95, gain: 0.014 },
        ],
      },
      {
        bass: 33,
        pad: [45, 52, 55, 61],
        melody: [
          { midi: 76, beat: 0, duration: 1.1, gain: 0.017 },
          { midi: 73, beat: 0.95, duration: 0.8, gain: 0.013 },
          { midi: 69, beat: 1.7, duration: 1.35, gain: 0.016 },
          { midi: 71, beat: 2.9, duration: 0.9, gain: 0.012 },
        ],
      },
    ],
  },
  {
    id: 'sunset-cup',
    title: '落日与白瓷杯',
    mood: 'G 大调 · 暖木琴',
    bpm: 82,
    masterVolume: 0.46,
    seaVolume: 0.005,
    bars: [
      {
        bass: 43,
        pad: [55, 59, 62, 67],
        melody: [
          { midi: 74, beat: 0, duration: 0.85, gain: 0.018 },
          { midi: 79, beat: 0.8, duration: 0.7, gain: 0.015 },
          { midi: 81, beat: 1.65, duration: 1.15, gain: 0.018 },
          { midi: 83, beat: 2.8, duration: 1.05, gain: 0.014 },
        ],
      },
      {
        bass: 40,
        pad: [52, 55, 59, 64],
        melody: [
          { midi: 79, beat: 0, duration: 0.9, gain: 0.017 },
          { midi: 76, beat: 0.85, duration: 0.75, gain: 0.014 },
          { midi: 74, beat: 1.7, duration: 1.2, gain: 0.018 },
          { midi: 71, beat: 2.9, duration: 0.85, gain: 0.012 },
        ],
      },
      {
        bass: 36,
        pad: [48, 55, 60, 64],
        melody: [
          { midi: 76, beat: 0, duration: 0.9, gain: 0.017 },
          { midi: 79, beat: 0.85, duration: 0.75, gain: 0.015 },
          { midi: 83, beat: 1.7, duration: 1.1, gain: 0.019 },
          { midi: 81, beat: 2.85, duration: 1.05, gain: 0.014 },
        ],
      },
      {
        bass: 38,
        pad: [50, 57, 62, 66],
        melody: [
          { midi: 81, beat: 0, duration: 0.85, gain: 0.017 },
          { midi: 79, beat: 0.8, duration: 0.7, gain: 0.014 },
          { midi: 74, beat: 1.65, duration: 1.25, gain: 0.018 },
          { midi: 76, beat: 2.9, duration: 0.9, gain: 0.013 },
        ],
      },
    ],
  },
  {
    id: 'rain-window',
    title: '雨落在玻璃窗',
    mood: 'A 小调 · 雾感音粒',
    bpm: 68,
    masterVolume: 0.5,
    seaVolume: 0.014,
    bars: [
      {
        bass: 33,
        pad: [45, 52, 57, 60],
        melody: [
          { midi: 69, beat: 0, duration: 1.4, gain: 0.016 },
          { midi: 72, beat: 1.1, duration: 0.9, gain: 0.013 },
          { midi: 76, beat: 2.15, duration: 1.4, gain: 0.018 },
          { midi: 74, beat: 3.15, duration: 0.75, gain: 0.011 },
        ],
      },
      {
        bass: 29,
        pad: [41, 48, 52, 57],
        melody: [
          { midi: 72, beat: 0, duration: 1.2, gain: 0.015 },
          { midi: 69, beat: 1.15, duration: 1, gain: 0.014 },
          { midi: 67, beat: 2.25, duration: 1.3, gain: 0.017 },
          { midi: 71, beat: 3.25, duration: 0.65, gain: 0.011 },
        ],
      },
      {
        bass: 36,
        pad: [48, 55, 60, 64],
        melody: [
          { midi: 64, beat: 0, duration: 1.35, gain: 0.014 },
          { midi: 67, beat: 1.1, duration: 0.9, gain: 0.014 },
          { midi: 72, beat: 2.1, duration: 1.45, gain: 0.019 },
          { midi: 71, beat: 3.2, duration: 0.7, gain: 0.011 },
        ],
      },
      {
        bass: 31,
        pad: [43, 50, 55, 59],
        melody: [
          { midi: 71, beat: 0, duration: 1.25, gain: 0.015 },
          { midi: 67, beat: 1.1, duration: 1.05, gain: 0.014 },
          { midi: 64, beat: 2.15, duration: 1.45, gain: 0.017 },
          { midi: 69, beat: 3.25, duration: 0.65, gain: 0.011 },
        ],
      },
    ],
  },
  {
    id: 'starlight',
    title: '星夜慢板',
    mood: 'C 大调 · 清亮夜铃',
    bpm: 62,
    masterVolume: 0.45,
    seaVolume: 0.003,
    bars: [
      {
        bass: 36,
        pad: [48, 55, 60, 64],
        melody: [
          { midi: 79, beat: 0, duration: 1.5, gain: 0.017 },
          { midi: 76, beat: 1.25, duration: 1.1, gain: 0.014 },
          { midi: 72, beat: 2.45, duration: 1.35, gain: 0.016 },
          { midi: 74, beat: 3.35, duration: 0.6, gain: 0.01 },
        ],
      },
      {
        bass: 33,
        pad: [45, 52, 57, 60],
        melody: [
          { midi: 76, beat: 0, duration: 1.35, gain: 0.016 },
          { midi: 72, beat: 1.25, duration: 1.15, gain: 0.013 },
          { midi: 74, beat: 2.4, duration: 1.4, gain: 0.016 },
          { midi: 69, beat: 3.35, duration: 0.6, gain: 0.01 },
        ],
      },
      {
        bass: 29,
        pad: [41, 48, 52, 57],
        melody: [
          { midi: 72, beat: 0, duration: 1.4, gain: 0.015 },
          { midi: 74, beat: 1.2, duration: 1.05, gain: 0.013 },
          { midi: 76, beat: 2.35, duration: 1.4, gain: 0.017 },
          { midi: 79, beat: 3.35, duration: 0.55, gain: 0.01 },
        ],
      },
      {
        bass: 31,
        pad: [43, 50, 55, 59],
        melody: [
          { midi: 74, beat: 0, duration: 1.35, gain: 0.015 },
          { midi: 71, beat: 1.2, duration: 1.1, gain: 0.013 },
          { midi: 67, beat: 2.35, duration: 1.45, gain: 0.016 },
          { midi: 72, beat: 3.35, duration: 0.55, gain: 0.01 },
        ],
      },
    ],
  },
]

let activeOwners = 0
let detachSoundChange: (() => void) | null = null
let detachVolumeChange: (() => void) | null = null
let stopCurrentLifecycle: ((fadeSeconds?: number) => void) | null = null
let nextCurrentTrack: (() => void) | null = null
let currentTrackIndex = -1
let snapshotTrackIndex = -1
const bgmStateListeners = new Set<() => void>()

function audioContextConstructor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext ??
    null
  )
}

function midiFrequency(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12)
}

function lastPlayedTrackIndex(): number {
  try {
    const value = Number.parseInt(window.localStorage.getItem(STORAGE_KEY) ?? '', 10)
    return Number.isInteger(value) && value >= 0 && value < TRACKS.length ? value : -1
  } catch {
    return -1
  }
}

function rememberTrack(index: number): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(index))
  } catch {
    /* 隐私模式下本地存储不可用，本次会话仍然可以正常切歌 */
  }
}

function chooseRandomTrack(): number {
  const previous = lastPlayedTrackIndex()
  const candidates = TRACKS.map((_, index) => index).filter((index) => index !== previous)
  const pool = candidates.length > 0 ? candidates : TRACKS.map((_, index) => index)
  return pool[Math.floor(Math.random() * pool.length)]
}

function setCurrentTrack(index: number): void {
  snapshotTrackIndex = index
  if (currentTrackIndex === index) return
  currentTrackIndex = index
  rememberTrack(index)
  bgmStateListeners.forEach((listener) => listener())
}

export function getHomeBgmTrackIndex(): number {
  if (snapshotTrackIndex < 0) {
    const storedIndex = lastPlayedTrackIndex()
    snapshotTrackIndex = storedIndex >= 0 ? storedIndex : 0
  }
  return snapshotTrackIndex
}

export function getHomeBgmTrack(index: number): HomeBgmState {
  const track = TRACKS[index] ?? TRACKS[0]
  return {
    trackIndex: TRACKS.indexOf(track),
    trackCount: TRACKS.length,
    title: track.title,
    mood: track.mood,
  }
}

export function onHomeBgmChange(listener: () => void): () => void {
  bgmStateListeners.add(listener)
  return () => bgmStateListeners.delete(listener)
}

function createNoiseBuffer(context: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * 3))
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const data = buffer.getChannelData(0)
  let seed = 0x51a7e

  for (let index = 0; index < length; index += 1) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    data[index] = (seed / 0xffffffff) * 2 - 1
  }
  return buffer
}

function createReverbImpulse(context: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(context.sampleRate * 1.7))
  const impulse = context.createBuffer(2, length, context.sampleRate)
  let seed = 0xc0ffee

  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel)
    for (let index = 0; index < length; index += 1) {
      seed = (Math.imul(seed, 1103515245) + 12345) >>> 0
      const noise = (seed / 0xffffffff) * 2 - 1
      data[index] = noise * (1 - index / length) ** 2.8
    }
  }
  return impulse
}

function beatDuration(track: Track): number {
  return 60 / track.bpm
}

function barDuration(track: Track): number {
  return beatDuration(track) * 4
}

function buildAudioSession(
  context: AudioContext,
  track: Track,
  options: SessionOptions = {},
): AudioSession {
  const compressor = context.createDynamicsCompressor()
  compressor.threshold.value = -28
  compressor.knee.value = 20
  compressor.ratio.value = 2.6
  compressor.attack.value = 0.012
  compressor.release.value = 0.28

  const master = context.createGain()
  master.gain.setValueAtTime(0.0001, context.currentTime)
  master.connect(compressor).connect(context.destination)

  const dry = context.createGain()
  dry.gain.value = 0.78
  dry.connect(master)

  const reverb = context.createConvolver()
  reverb.buffer = createReverbImpulse(context)
  const wet = context.createGain()
  wet.gain.value = 0.16
  reverb.connect(wet).connect(master)

  const musicBus = context.createGain()
  musicBus.gain.value = 0.72
  musicBus.connect(dry)
  musicBus.connect(reverb)

  const sea = context.createBufferSource()
  const seaFilter = context.createBiquadFilter()
  const seaGain = context.createGain()
  sea.buffer = createNoiseBuffer(context)
  sea.loop = true
  seaFilter.type = 'bandpass'
  seaFilter.frequency.value = 720
  seaFilter.Q.value = 0.45
  seaGain.gain.value = track.seaVolume
  sea.connect(seaFilter).connect(seaGain).connect(musicBus)
  sea.start()

  const targetVolume = options.masterVolume ?? track.masterVolume
  const fadeInSeconds = options.fadeInSeconds ?? FADE_IN_SECONDS
  const now = context.currentTime
  const audibleVolume = targetVolume * getSoundVolume()
  master.gain.setValueAtTime(0.0001, now)
  master.gain.exponentialRampToValueAtTime(
    Math.max(0.0001, audibleVolume),
    now + Math.max(0.05, fadeInSeconds),
  )

  return {
    context,
    master,
    musicBus,
    targetVolume,
    track,
    sea,
    scheduler: null,
    closeTimer: null,
    nextBarTime: now + 0.12,
    nextBarIndex: 0,
  }
}

function addTone(
  session: AudioSession,
  options: {
    frequency: number
    start: number
    duration: number
    gain: number
    type?: OscillatorType
    attack?: number
    detune?: number
  },
): void {
  const { context } = session
  const oscillator = context.createOscillator()
  const envelope = context.createGain()
  const attack = Math.min(options.duration * 0.4, options.attack ?? 0.008)

  oscillator.type = options.type ?? 'sine'
  oscillator.frequency.setValueAtTime(options.frequency, options.start)
  if (options.detune) oscillator.detune.setValueAtTime(options.detune, options.start)

  envelope.gain.setValueAtTime(0.0001, options.start)
  envelope.gain.exponentialRampToValueAtTime(
    Math.max(0.0002, options.gain),
    options.start + attack,
  )
  envelope.gain.exponentialRampToValueAtTime(
    0.0001,
    options.start + options.duration,
  )

  oscillator.connect(envelope).connect(session.musicBus)
  oscillator.start(options.start)
  oscillator.stop(options.start + options.duration + 0.04)
}

function addBell(
  session: AudioSession,
  midi: number,
  start: number,
  duration: number,
  gain: number,
): void {
  const frequency = midiFrequency(midi)
  addTone(session, {
    frequency,
    start,
    duration,
    gain,
    type: 'sine',
    attack: 0.006,
  })
  addTone(session, {
    frequency: frequency * 2.005,
    start,
    duration: duration * 0.58,
    gain: gain * 0.24,
    type: 'sine',
    attack: 0.003,
    detune: 2,
  })
}

function scheduleBar(session: AudioSession, bar: ChordBar, start: number): void {
  const beatSeconds = beatDuration(session.track)
  const barSeconds = barDuration(session.track)
  const releaseEnd = start + barSeconds + 0.4
  const isRainWindow = session.track.id === 'rain-window'
  const isStarlight = session.track.id === 'starlight'

  bar.pad.forEach((midi, index) => {
    addTone(session, {
      frequency: midiFrequency(midi),
      start,
      duration: releaseEnd - start,
      gain: 0.009 - index * 0.0011,
      type: isRainWindow ? 'sine' : index === 0 ? 'triangle' : 'sine',
      attack: isStarlight ? 0.72 : 0.52,
      detune: index % 2 === 0 ? -2 : 2,
    })
  })

  addTone(session, {
    frequency: midiFrequency(bar.bass),
    start,
    duration: beatSeconds * 1.75,
    gain: isStarlight ? 0.018 : 0.021,
    type: 'sine',
    attack: isStarlight ? 0.08 : 0.035,
  })
  addTone(session, {
    frequency: midiFrequency(bar.bass + 7),
    start: start + beatSeconds * 2,
    duration: beatSeconds * 1.6,
    gain: isRainWindow ? 0.009 : 0.012,
    type: 'sine',
    attack: 0.04,
  })

  bar.melody.forEach((note) => {
    addBell(
      session,
      note.midi,
      start + note.beat * beatSeconds,
      note.duration,
      note.gain,
    )
  })
}

function stopScheduler(session: AudioSession): void {
  if (session.scheduler === null) return
  window.clearInterval(session.scheduler)
  session.scheduler = null
}

function startScheduler(session: AudioSession): void {
  if (session.scheduler !== null || session.context.state !== 'running') return
  session.nextBarTime = Math.max(
    session.nextBarTime,
    session.context.currentTime + 0.08,
  )

  const schedule = () => {
    const { context, track } = session
    if (context.state !== 'running') return
    if (document.hidden) {
      session.nextBarTime = context.currentTime + 0.1
      return
    }
    if (session.nextBarTime < context.currentTime - 0.1) {
      session.nextBarTime = context.currentTime + 0.08
    }

    const barSeconds = barDuration(track)
    while (
      session.nextBarTime <
      context.currentTime + SCHEDULE_AHEAD_SECONDS
    ) {
      const bar = track.bars[session.nextBarIndex]
      scheduleBar(session, bar, session.nextBarTime)
      session.nextBarIndex = (session.nextBarIndex + 1) % track.bars.length
      session.nextBarTime += barSeconds
    }
  }

  schedule()
  session.scheduler = window.setInterval(schedule, SCHEDULER_INTERVAL_MS)
}

function createLifecycle(): {
  stop: (fadeSeconds?: number) => void
  nextTrack: () => void
} {
  let disposed = false
  let session: AudioSession | null = null
  let waitingForGesture = false
  let switchTimer: number | null = null

  const updateVolume = () => {
    const current = session
    if (!current) return
    const now = current.context.currentTime
    current.master.gain.cancelScheduledValues(now)
    current.master.gain.setTargetAtTime(
      Math.max(
        0.0001,
        current.targetVolume * (isSoundEnabled() ? getSoundVolume() : 0),
      ),
      now,
      0.04,
    )
  }

  const closeSession = (
    current: AudioSession,
    fadeSeconds: number,
    onComplete?: () => void,
  ) => {
    stopScheduler(current)

    if (current.closeTimer !== null) window.clearTimeout(current.closeTimer)
    const now = current.context.currentTime
    current.master.gain.cancelScheduledValues(now)
    current.master.gain.setValueAtTime(
      Math.max(0.0001, current.master.gain.value),
      now,
    )
    current.master.gain.linearRampToValueAtTime(
      0.0001,
      now + Math.max(0.05, fadeSeconds),
    )
    current.closeTimer = window.setTimeout(() => {
      if (current.context.state !== 'closed') void current.context.close()
      onComplete?.()
    }, Math.ceil(fadeSeconds * 1000) + 80)
  }

  const openSession = (
    index = chooseRandomTrack(),
    options: SessionOptions = {},
  ) => {
    if (disposed || !isSoundEnabled()) return
    const Ctor = audioContextConstructor()
    if (!Ctor) return

    let context: AudioContext | null = null
    try {
      context = new Ctor()
      session = buildAudioSession(context, TRACKS[index], options)
      setCurrentTrack(index)
      waitingForGesture = context.state !== 'running'
      if (context.state === 'running') startScheduler(session)
    } catch {
      if (context && context.state !== 'closed') void context.close()
      if (session) closeSession(session, 0.05)
      session = null
    }
  }

  const handleVisibilityChange = () => {
    if (document.hidden) return
    if (!session) {
      if (isSoundEnabled()) openSession()
      return
    }
    if (session.context.state !== 'running' && isSoundEnabled()) {
      waitingForGesture = true
    }
    session.nextBarTime = session.context.currentTime + 0.08
  }

  const handleUserGesture = () => {
    const current = session
    if (disposed) return
    if (!current) {
      if (isSoundEnabled()) openSession()
      return
    }
    if (current.context.state === 'running' || !waitingForGesture) return

    waitingForGesture = false
    void current.context
      .resume()
      .then(() => {
        if (disposed || session !== current || !isSoundEnabled()) return
        if (current.context.state === 'running') startScheduler(current)
        else waitingForGesture = true
      })
      .catch(() => {
        if (!disposed && session === current) waitingForGesture = true
      })
  }

  const nextTrack = () => {
    if (disposed || !isSoundEnabled()) return
    if (switchTimer !== null) window.clearTimeout(switchTimer)
    const nextIndex =
      session === null
        ? chooseRandomTrack()
        : (currentTrackIndex + 1) % TRACKS.length
    const previousSession = session
    session = null
    waitingForGesture = false

    const openNext = () =>
      openSession(nextIndex, {
        fadeInSeconds: TRACK_SWITCH_FADE_SECONDS,
      })

    if (!previousSession) {
      openNext()
      return
    }

    closeSession(previousSession, TRACK_SWITCH_FADE_SECONDS)
    switchTimer = window.setTimeout(() => {
      switchTimer = null
      openNext()
    }, TRACK_SWITCH_OVERLAP_SECONDS * 1000)
  }

  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('pointerdown', handleUserGesture, {
    capture: true,
    passive: true,
  })
  document.addEventListener('keydown', handleUserGesture, true)
  const removeVolumeListener = onSoundVolumeChange(updateVolume)
  openSession()

  return {
    stop: (fadeSeconds = FADE_OUT_SECONDS) => {
      if (disposed) return
      disposed = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      document.removeEventListener('pointerdown', handleUserGesture, true)
      document.removeEventListener('keydown', handleUserGesture, true)
      removeVolumeListener()
      if (switchTimer !== null) window.clearTimeout(switchTimer)
      switchTimer = null
      if (session) closeSession(session, fadeSeconds)
      session = null
    },
    nextTrack,
  }
}

function ensureLifecycle(): void {
  if (!isSoundEnabled() || stopCurrentLifecycle) return
  const lifecycle = createLifecycle()
  stopCurrentLifecycle = (fadeSeconds) => lifecycle.stop(fadeSeconds)
  nextCurrentTrack = lifecycle.nextTrack
}

function stopLifecycle(fadeSeconds = FADE_OUT_SECONDS): void {
  const stop = stopCurrentLifecycle
  stopCurrentLifecycle = null
  nextCurrentTrack = null
  stop?.(fadeSeconds)
}

/**
 * 进入主页时调用。随机选曲，返回的函数负责淡出并关闭音乐。
 */
export function startHomeBgm(): () => void {
  activeOwners += 1
  if (!detachSoundChange) {
    detachSoundChange = onSoundChange(() => {
      if (isSoundEnabled()) ensureLifecycle()
      else stopLifecycle(0.05)
    })
  }
  if (!detachVolumeChange) {
    detachVolumeChange = onSoundVolumeChange(() => {
      if (isSoundEnabled()) ensureLifecycle()
    })
  }
  ensureLifecycle()

  let released = false
  return () => {
    if (released) return
    released = true
    activeOwners = Math.max(0, activeOwners - 1)
    if (activeOwners > 0) return
    detachSoundChange?.()
    detachSoundChange = null
    detachVolumeChange?.()
    detachVolumeChange = null
    stopLifecycle()
  }
}

/**
 * 从主页唱片按钮切换下一首。用户点击本身也满足浏览器首次起播策略。
 */
export function playNextHomeBgm(): void {
  if (!nextCurrentTrack) {
    ensureLifecycle()
  }
  nextCurrentTrack?.()
}
