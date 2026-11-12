/* ============================================================
   主页背景音乐
   ------------------------------------------------------------
   四小节循环的原创轻音乐，使用 Web Audio 实时合成：
   暖色铺底、轻低音、钟琴旋律和一点海风噪声。
   只在主页挂载期间播放，并遵循现有全局声音开关。
   ============================================================ */

import { isSoundEnabled, onSoundChange } from './sound'

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

interface AudioSession {
  context: AudioContext
  master: GainNode
  musicBus: GainNode
  noiseBuffer: AudioBuffer
  scheduler: number | null
  closeTimer: number | null
  nextBarTime: number
  nextBarIndex: number
}

const BPM = 74
const BEAT_SECONDS = 60 / BPM
const BAR_SECONDS = BEAT_SECONDS * 4
const SCHEDULER_INTERVAL_MS = 250
const SCHEDULE_AHEAD_SECONDS = 0.7
const MASTER_VOLUME = 0.5
const FADE_IN_SECONDS = 1.8
const FADE_OUT_SECONDS = 0.65

// D 大调色彩的四小节循环，旋律落在五声音阶内，适合轻松但不空泛的咖啡馆氛围。
const BARS: readonly ChordBar[] = [
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
]

let activeOwners = 0
let detachSoundChange: (() => void) | null = null
let stopCurrentLifecycle: ((fadeSeconds?: number) => void) | null = null

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

function buildAudioSession(context: AudioContext): AudioSession {
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

  const noiseBuffer = createNoiseBuffer(context)
  const sea = context.createBufferSource()
  const seaFilter = context.createBiquadFilter()
  const seaGain = context.createGain()
  sea.buffer = noiseBuffer
  sea.loop = true
  seaFilter.type = 'bandpass'
  seaFilter.frequency.value = 720
  seaFilter.Q.value = 0.45
  seaGain.gain.value = 0.008
  sea.connect(seaFilter).connect(seaGain).connect(musicBus)
  sea.start()

  return {
    context,
    master,
    musicBus,
    noiseBuffer,
    scheduler: null,
    closeTimer: null,
    nextBarTime: context.currentTime + 0.12,
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
  const releaseEnd = start + BAR_SECONDS + 0.4

  bar.pad.forEach((midi, index) => {
    addTone(session, {
      frequency: midiFrequency(midi),
      start,
      duration: releaseEnd - start,
      gain: 0.009 - index * 0.0011,
      type: index === 0 ? 'triangle' : 'sine',
      attack: 0.52,
      detune: index % 2 === 0 ? -2 : 2,
    })
  })

  addTone(session, {
    frequency: midiFrequency(bar.bass),
    start,
    duration: BEAT_SECONDS * 1.75,
    gain: 0.021,
    type: 'sine',
    attack: 0.035,
  })
  addTone(session, {
    frequency: midiFrequency(bar.bass + 7),
    start: start + BEAT_SECONDS * 2,
    duration: BEAT_SECONDS * 1.6,
    gain: 0.012,
    type: 'sine',
    attack: 0.04,
  })

  bar.melody.forEach((note) => {
    addBell(
      session,
      note.midi,
      start + note.beat * BEAT_SECONDS,
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
    const { context } = session
    if (context.state !== 'running') return
    if (document.hidden) {
      session.nextBarTime = context.currentTime + 0.1
      return
    }
    if (session.nextBarTime < context.currentTime - 0.1) {
      session.nextBarTime = context.currentTime + 0.08
    }

    while (
      session.nextBarTime <
      context.currentTime + SCHEDULE_AHEAD_SECONDS
    ) {
      const bar = BARS[session.nextBarIndex]
      scheduleBar(session, bar, session.nextBarTime)
      session.nextBarIndex = (session.nextBarIndex + 1) % BARS.length
      session.nextBarTime += BAR_SECONDS
    }
  }

  schedule()
  session.scheduler = window.setInterval(schedule, SCHEDULER_INTERVAL_MS)
}

function createLifecycle(): (fadeSeconds?: number) => void {
  let disposed = false
  let session: AudioSession | null = null
  let waitingForGesture = false

  const closeSession = (fadeSeconds: number) => {
    const current = session
    if (!current) return
    session = null
    stopScheduler(current)

    if (current.closeTimer !== null) window.clearTimeout(current.closeTimer)
    const now = current.context.currentTime
    waitingForGesture = false
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
    }, Math.ceil(fadeSeconds * 1000) + 80)
  }

  const openSession = () => {
    if (disposed || !isSoundEnabled()) return
    const Ctor = audioContextConstructor()
    if (!Ctor) return

    let context: AudioContext | null = null
    try {
      context = new Ctor()
      session = buildAudioSession(context)
      const now = context.currentTime
      session.master.gain.cancelScheduledValues(now)
      session.master.gain.setValueAtTime(0.0001, now)
      session.master.gain.exponentialRampToValueAtTime(
        MASTER_VOLUME,
        now + FADE_IN_SECONDS,
      )

      if (context.state === 'running') startScheduler(session)
      else waitingForGesture = true
    } catch {
      if (context && context.state !== 'closed') void context.close()
      closeSession(0.05)
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

  document.addEventListener('visibilitychange', handleVisibilityChange)
  document.addEventListener('pointerdown', handleUserGesture, {
    capture: true,
    passive: true,
  })
  document.addEventListener('keydown', handleUserGesture, true)
  openSession()

  return (fadeSeconds = FADE_OUT_SECONDS) => {
    if (disposed) return
    disposed = true
    document.removeEventListener('visibilitychange', handleVisibilityChange)
    document.removeEventListener('pointerdown', handleUserGesture, true)
    document.removeEventListener('keydown', handleUserGesture, true)
    closeSession(fadeSeconds)
  }
}

function ensureLifecycle(): void {
  if (!isSoundEnabled() || stopCurrentLifecycle) {
    return
  }
  stopCurrentLifecycle = createLifecycle()
}

function stopLifecycle(fadeSeconds = FADE_OUT_SECONDS): void {
  const stop = stopCurrentLifecycle
  stopCurrentLifecycle = null
  stop?.(fadeSeconds)
}

/**
 * 在主页组件挂载时调用。返回值负责淡出、关闭音频上下文并移除监听器。
 * 多次挂载会合并成一套音乐生命周期，避免开发模式 StrictMode 重复播放。
 */
export function startHomeBgm(): () => void {
  activeOwners += 1
  if (!detachSoundChange) {
    detachSoundChange = onSoundChange(() => {
      if (isSoundEnabled()) ensureLifecycle()
      else stopLifecycle(0.05)
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
    stopLifecycle()
  }
}
