/* ============================================================
   游戏音效 —— Web Audio 现场合成
   ------------------------------------------------------------
   所有音效都由振荡器、滤波噪声和短包络实时生成，不依赖音频文件。
   音色会刻意保持短、轻、颗粒清楚，避免在快速游玩时盖住猫叫或糊成噪音。
   ============================================================ */

import {
  getSoundVolume,
  isSoundEnabled,
  onSoundChange,
  onSoundVolumeChange,
} from './sound'

export type SfxName =
  | 'tap'
  | 'navigate'
  | 'error'
  | 'success'
  | 'page'
  | 'choice'
  | 'coin'
  | 'reward'
  | 'unlock'
  | 'start'
  | 'arrival'
  | 'serve'
  | 'clean'
  | 'brew'
  | 'steam'
  | 'oven'
  | 'whisk'
  | 'pour'
  | 'plate'
  | 'pet-feed'
  | 'pet-play'
  | 'pet-groom'
  | 'pet-photo'
  | 'cafe-pet'
  | 'cafe-romance'
  | 'settle'
  | 'sparkle'
  | 'heart'
  | 'bubble'
  | 'flutter'
  | 'tick'

export type PetActionSound = 'feed' | 'play' | 'groom' | 'photo'

type AudioContextCtor = typeof AudioContext

interface ToneSpec {
  frequency: number
  endFrequency?: number
  delay?: number
  duration?: number
  gain?: number
  attack?: number
  type?: OscillatorType
  filter?: BiquadFilterType
  filterFrequency?: number
  filterEndFrequency?: number
  filterQ?: number
}

interface NoiseSpec {
  delay?: number
  duration?: number
  gain?: number
  filter?: BiquadFilterType
  filterFrequency?: number
  filterEndFrequency?: number
  filterQ?: number
}

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let detachVolumePreferences: (() => void) | null = null
const lastPlayedAt = new Map<SfxName, number>()

const SFX_MASTER_VOLUME = 0.42

export interface GameAudioPlayback {
  stop: (fadeSeconds?: number) => void
}

const COOLDOWN_MS: Partial<Record<SfxName, number>> = {
  tap: 35,
  navigate: 70,
  page: 70,
  choice: 90,
  error: 140,
  coin: 90,
  reward: 180,
  unlock: 180,
  'pet-play': 180,
  'pet-feed': 180,
  'pet-groom': 180,
  'pet-photo': 180,
  sparkle: 90,
  heart: 100,
  bubble: 70,
  flutter: 90,
  tick: 120,
}

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  if (!Ctor) return null

  if (!ctx) {
    try {
      ctx = new Ctor()
      const compressor = ctx.createDynamicsCompressor()
      compressor.threshold.value = -22
      compressor.knee.value = 18
      compressor.ratio.value = 3.5
      compressor.attack.value = 0.004
      compressor.release.value = 0.16

      master = ctx.createGain()
      master.gain.value = SFX_MASTER_VOLUME * getSoundVolume()
      master.connect(compressor).connect(ctx.destination)

      const updateVolume = () => {
        if (!ctx || !master) return
        const now = ctx.currentTime
        master.gain.cancelScheduledValues(now)
        master.gain.setTargetAtTime(
          SFX_MASTER_VOLUME * (isSoundEnabled() ? getSoundVolume() : 0),
          now,
          0.025,
        )
      }
      detachVolumePreferences?.()
      const removeSoundListener = onSoundChange(updateVolume)
      const removeVolumeListener = onSoundVolumeChange(updateVolume)
      detachVolumePreferences = () => {
        removeSoundListener()
        removeVolumeListener()
      }
    } catch {
      ctx = null
      master = null
      return null
    }
  }

  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export function isGameAudioSupported(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(
    window.AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext,
  )
}

export function primeGameAudio(): boolean {
  return audioContext() !== null
}

export async function decodeGameAudio(data: ArrayBuffer): Promise<AudioBuffer> {
  const ac = audioContext()
  if (!ac) throw new Error('当前浏览器不支持音频播放')
  return ac.decodeAudioData(data.slice(0))
}

export function playGameAudio(
  buffer: AudioBuffer,
  options: {
    volume?: number
    onEnded?: () => void
  } = {},
): GameAudioPlayback | null {
  const ac = audioContext()
  if (!ac) return null

  const source = ac.createBufferSource()
  const gain = ac.createGain()
  const volume = Math.max(0, Math.min(1, options.volume ?? 0.9))
  const now = ac.currentTime
  let stopped = false

  source.buffer = buffer
  gain.gain.setValueAtTime(volume, now)
  source.connect(gain).connect(ac.destination)

  const cleanup = () => {
    source.disconnect()
    gain.disconnect()
  }
  source.onended = () => {
    cleanup()
    if (!stopped) options.onEnded?.()
  }

  try {
    source.start(now)
    void ac.resume()
  } catch {
    cleanup()
    return null
  }

  return {
    stop: (fadeSeconds = 0.04) => {
      if (stopped) return
      stopped = true
      const stopAt = ac.currentTime + Math.max(0.01, fadeSeconds)
      gain.gain.cancelScheduledValues(ac.currentTime)
      gain.gain.setValueAtTime(gain.gain.value, ac.currentTime)
      gain.gain.linearRampToValueAtTime(0.0001, stopAt)
      try {
        source.stop(stopAt)
      } catch {
        cleanup()
      }
    },
  }
}

function tone(ac: AudioContext, spec: ToneSpec): void {
  if (!master) return
  const start = ac.currentTime + (spec.delay ?? 0)
  const duration = Math.max(0.025, spec.duration ?? 0.12)
  const attack = Math.min(duration * 0.35, spec.attack ?? 0.006)
  const peak = Math.max(0.0002, spec.gain ?? 0.06)
  const oscillator = ac.createOscillator()
  const envelope = ac.createGain()

  oscillator.type = spec.type ?? 'sine'
  oscillator.frequency.setValueAtTime(Math.max(20, spec.frequency), start)
  if (spec.endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, spec.endFrequency),
      start + duration,
    )
  }

  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.exponentialRampToValueAtTime(peak, start + attack)
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  let output: AudioNode = oscillator
  if (spec.filter) {
    const filter = ac.createBiquadFilter()
    filter.type = spec.filter
    filter.Q.value = spec.filterQ ?? 0.8
    filter.frequency.setValueAtTime(
      Math.max(30, spec.filterFrequency ?? 1200),
      start,
    )
    if (spec.filterEndFrequency) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(30, spec.filterEndFrequency),
        start + duration,
      )
    }
    output = output.connect(filter)
  }

  output.connect(envelope).connect(master)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.025)
}

function getNoiseBuffer(ac: AudioContext): AudioBuffer {
  if (noiseBuffer) return noiseBuffer
  const buffer = ac.createBuffer(1, Math.max(1, Math.floor(ac.sampleRate * 1.2)), ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1
  }
  noiseBuffer = buffer
  return buffer
}

function noise(ac: AudioContext, spec: NoiseSpec): void {
  if (!master) return
  const start = ac.currentTime + (spec.delay ?? 0)
  const duration = Math.max(0.025, spec.duration ?? 0.12)
  const source = ac.createBufferSource()
  const filter = ac.createBiquadFilter()
  const envelope = ac.createGain()
  const peak = Math.max(0.0002, spec.gain ?? 0.04)

  source.buffer = getNoiseBuffer(ac)
  source.loop = true
  filter.type = spec.filter ?? 'bandpass'
  filter.Q.value = spec.filterQ ?? 0.9
  filter.frequency.setValueAtTime(Math.max(30, spec.filterFrequency ?? 1200), start)
  if (spec.filterEndFrequency) {
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(30, spec.filterEndFrequency),
      start + duration,
    )
  }

  envelope.gain.setValueAtTime(0.0001, start)
  envelope.gain.linearRampToValueAtTime(peak, start + Math.min(0.018, duration * 0.3))
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration)

  source.connect(filter).connect(envelope).connect(master)
  source.start(start, Math.random() * 0.8)
  source.stop(start + duration + 0.025)
}

function bell(ac: AudioContext, frequency: number, delay: number, gain = 0.055): void {
  tone(ac, {
    frequency,
    endFrequency: frequency * 0.995,
    delay,
    duration: 0.34,
    gain,
    attack: 0.004,
    type: 'sine',
  })
  tone(ac, {
    frequency: frequency * 2.01,
    delay,
    duration: 0.2,
    gain: gain * 0.28,
    type: 'sine',
  })
}

function click(ac: AudioContext, delay = 0, frequency = 360, gain = 0.036): void {
  tone(ac, {
    frequency,
    endFrequency: frequency * 0.82,
    delay,
    duration: 0.045,
    gain,
    attack: 0.002,
    type: 'triangle',
  })
}

const SCHEDULERS: Record<SfxName, (ac: AudioContext) => void> = {
  tap: (ac) => {
    click(ac, 0, 540, 0.03)
  },
  navigate: (ac) => {
    tone(ac, { frequency: 392, delay: 0, duration: 0.065, gain: 0.035, type: 'triangle' })
    tone(ac, { frequency: 523.25, delay: 0.045, duration: 0.09, gain: 0.032, type: 'triangle' })
  },
  error: (ac) => {
    tone(ac, {
      frequency: 190,
      endFrequency: 165,
      duration: 0.13,
      gain: 0.04,
      type: 'triangle',
      filter: 'lowpass',
      filterFrequency: 900,
    })
    tone(ac, {
      frequency: 145,
      endFrequency: 120,
      delay: 0.09,
      duration: 0.18,
      gain: 0.036,
      type: 'triangle',
      filter: 'lowpass',
      filterFrequency: 760,
    })
  },
  success: (ac) => {
    tone(ac, { frequency: 523.25, delay: 0, duration: 0.09, gain: 0.04, type: 'triangle' })
    tone(ac, { frequency: 783.99, delay: 0.065, duration: 0.16, gain: 0.042, type: 'triangle' })
  },
  page: (ac) => {
    noise(ac, {
      duration: 0.1,
      gain: 0.028,
      filter: 'highpass',
      filterFrequency: 1700,
      filterEndFrequency: 2700,
    })
    tone(ac, { frequency: 285, duration: 0.055, gain: 0.018, type: 'sine' })
  },
  choice: (ac) => {
    tone(ac, { frequency: 440, duration: 0.12, gain: 0.042, type: 'triangle' })
    tone(ac, { frequency: 659.25, delay: 0.06, duration: 0.18, gain: 0.038, type: 'triangle' })
  },
  coin: (ac) => {
    tone(ac, { frequency: 1046.5, duration: 0.09, gain: 0.038, type: 'sine' })
    tone(ac, { frequency: 1318.5, delay: 0.045, duration: 0.1, gain: 0.034, type: 'sine' })
    tone(ac, { frequency: 1567.98, delay: 0.09, duration: 0.14, gain: 0.03, type: 'sine' })
  },
  reward: (ac) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      tone(ac, {
        frequency,
        delay: index * 0.065,
        duration: 0.2,
        gain: 0.035,
        type: 'triangle',
      })
    })
    noise(ac, {
      delay: 0.14,
      duration: 0.24,
      gain: 0.018,
      filter: 'highpass',
      filterFrequency: 3800,
    })
  },
  unlock: (ac) => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      bell(ac, frequency, index * 0.055, 0.034)
    })
  },
  start: (ac) => {
    bell(ac, 523.25, 0, 0.045)
    bell(ac, 783.99, 0.16, 0.042)
    noise(ac, {
      delay: 0.02,
      duration: 0.32,
      gain: 0.022,
      filter: 'lowpass',
      filterFrequency: 700,
      filterEndFrequency: 260,
    })
  },
  arrival: (ac) => {
    bell(ac, 659.25, 0, 0.052)
    bell(ac, 880, 0.13, 0.046)
    tone(ac, { frequency: 220, duration: 0.08, gain: 0.018, type: 'sine' })
  },
  serve: (ac) => {
    click(ac, 0, 420, 0.035)
    tone(ac, { frequency: 784, delay: 0.06, duration: 0.12, gain: 0.035, type: 'sine' })
    tone(ac, { frequency: 1046.5, delay: 0.12, duration: 0.18, gain: 0.032, type: 'sine' })
  },
  clean: (ac) => {
    noise(ac, {
      duration: 0.2,
      gain: 0.05,
      filter: 'bandpass',
      filterFrequency: 760,
      filterEndFrequency: 1550,
      filterQ: 2.4,
    })
    tone(ac, {
      frequency: 330,
      endFrequency: 510,
      delay: 0.08,
      duration: 0.18,
      gain: 0.025,
      type: 'sine',
    })
  },
  brew: (ac) => {
    noise(ac, {
      duration: 0.42,
      gain: 0.046,
      filter: 'lowpass',
      filterFrequency: 900,
      filterEndFrequency: 420,
      filterQ: 1.2,
    })
    tone(ac, {
      frequency: 105,
      endFrequency: 72,
      duration: 0.42,
      gain: 0.035,
      type: 'triangle',
      filter: 'lowpass',
      filterFrequency: 380,
    })
    click(ac, 0.31, 280, 0.02)
  },
  steam: (ac) => {
    noise(ac, {
      duration: 0.3,
      gain: 0.05,
      filter: 'highpass',
      filterFrequency: 1800,
      filterEndFrequency: 3600,
      filterQ: 0.7,
    })
    tone(ac, {
      frequency: 2100,
      endFrequency: 2800,
      duration: 0.22,
      gain: 0.012,
      type: 'sine',
    })
  },
  oven: (ac) => {
    tone(ac, {
      frequency: 88,
      endFrequency: 76,
      duration: 0.42,
      gain: 0.026,
      type: 'triangle',
      filter: 'lowpass',
      filterFrequency: 260,
    })
    noise(ac, {
      duration: 0.38,
      gain: 0.018,
      filter: 'bandpass',
      filterFrequency: 480,
      filterEndFrequency: 680,
    })
    click(ac, 0.18, 610, 0.018)
    bell(ac, 1046.5, 0.28, 0.028)
  },
  whisk: (ac) => {
    ;[0, 0.07, 0.14].forEach((delay, index) => {
      noise(ac, {
        delay,
        duration: 0.075,
        gain: 0.026,
        filter: 'bandpass',
        filterFrequency: 1500 + index * 520,
        filterEndFrequency: 2300 + index * 380,
        filterQ: 2.1,
      })
    })
  },
  pour: (ac) => {
    noise(ac, {
      duration: 0.34,
      gain: 0.038,
      filter: 'bandpass',
      filterFrequency: 620,
      filterEndFrequency: 1280,
      filterQ: 1.8,
    })
    tone(ac, {
      frequency: 360,
      endFrequency: 560,
      delay: 0.06,
      duration: 0.24,
      gain: 0.022,
      type: 'sine',
    })
    ;[0.11, 0.19, 0.27].forEach((delay) => click(ac, delay, 760, 0.012))
  },
  plate: (ac) => {
    click(ac, 0, 300, 0.04)
    click(ac, 0.055, 440, 0.03)
    bell(ac, 880, 0.07, 0.024)
  },
  'pet-feed': (ac) => {
    ;[0, 0.055, 0.105].forEach((delay, index) => {
      noise(ac, {
        delay,
        duration: 0.045,
        gain: 0.026,
        filter: 'bandpass',
        filterFrequency: 1500 + index * 180,
        filterQ: 2.8,
      })
    })
    click(ac, 0.17, 235, 0.035)
  },
  'pet-play': (ac) => {
    ;[1046.5, 1318.5, 1568].forEach((frequency, index) => {
      bell(ac, frequency, index * 0.055, 0.032)
    })
    noise(ac, {
      delay: 0.02,
      duration: 0.15,
      gain: 0.018,
      filter: 'highpass',
      filterFrequency: 3000,
    })
  },
  'pet-groom': (ac) => {
    ;[0, 0.11, 0.22].forEach((delay, index) => {
      noise(ac, {
        delay,
        duration: 0.1,
        gain: 0.022,
        filter: 'bandpass',
        filterFrequency: 900 + index * 260,
        filterEndFrequency: 1550 + index * 260,
        filterQ: 1.6,
      })
    })
  },
  'pet-photo': (ac) => {
    noise(ac, {
      duration: 0.045,
      gain: 0.055,
      filter: 'highpass',
      filterFrequency: 1900,
    })
    click(ac, 0.055, 520, 0.032)
    noise(ac, {
      delay: 0.07,
      duration: 0.035,
      gain: 0.04,
      filter: 'highpass',
      filterFrequency: 2400,
    })
  },
  'cafe-pet': (ac) => {
    tone(ac, { frequency: 880, duration: 0.12, gain: 0.026, type: 'sine' })
    tone(ac, { frequency: 1318.5, delay: 0.08, duration: 0.18, gain: 0.024, type: 'sine' })
    noise(ac, {
      delay: 0.08,
      duration: 0.16,
      gain: 0.014,
      filter: 'highpass',
      filterFrequency: 3600,
    })
  },
  'cafe-romance': (ac) => {
    ;[392, 493.88, 587.33].forEach((frequency, index) => {
      tone(ac, {
        frequency,
        delay: index * 0.07,
        duration: 0.34,
        gain: 0.026,
        type: 'sine',
      })
    })
  },
  settle: (ac) => {
    ;[392, 523.25, 659.25].forEach((frequency, index) => {
      tone(ac, {
        frequency,
        delay: index * 0.08,
        duration: 0.62,
        gain: 0.034,
        type: 'sine',
      })
    })
    bell(ac, 1046.5, 0.22, 0.03)
  },
  sparkle: (ac) => {
    tone(ac, { frequency: 1318.5, duration: 0.11, gain: 0.025, type: 'sine' })
    tone(ac, { frequency: 1760, delay: 0.05, duration: 0.14, gain: 0.022, type: 'sine' })
    noise(ac, {
      duration: 0.16,
      gain: 0.012,
      filter: 'highpass',
      filterFrequency: 4200,
    })
  },
  heart: (ac) => {
    tone(ac, { frequency: 493.88, duration: 0.18, gain: 0.03, type: 'sine' })
    tone(ac, { frequency: 659.25, delay: 0.08, duration: 0.22, gain: 0.026, type: 'sine' })
  },
  bubble: (ac) => {
    tone(ac, {
      frequency: 420,
      endFrequency: 760,
      duration: 0.12,
      gain: 0.026,
      type: 'sine',
    })
  },
  flutter: (ac) => {
    noise(ac, {
      duration: 0.2,
      gain: 0.018,
      filter: 'bandpass',
      filterFrequency: 1200,
      filterEndFrequency: 2100,
      filterQ: 1.4,
    })
  },
  tick: (ac) => {
    click(ac, 0, 680, 0.024)
    click(ac, 0.08, 760, 0.016)
  },
}

/**
 * 播放一个语义音效。返回 false 表示静音、浏览器不支持或触发得太快。
 */
export function playSfx(name: SfxName): boolean {
  if (!isSoundEnabled()) return false
  const now = Date.now()
  const cooldown = COOLDOWN_MS[name] ?? 50
  if (now - (lastPlayedAt.get(name) ?? 0) < cooldown) return false

  const ac = audioContext()
  if (!ac) return false
  lastPlayedAt.set(name, now)
  SCHEDULERS[name](ac)
  return true
}

export function playPetActionSfx(action: PetActionSound): boolean {
  return playSfx(`pet-${action}`)
}
