/* ============================================================
   布丁的叫声 —— Web Audio 现场合成
   ------------------------------------------------------------
   项目里没有任何音频文件，也不引入外部素材。
   一声猫叫拆成「m 的鼻音起音 + 元音开口 + 尾音颤动」三段来合成：
   - 周期性波形（带 2/3/4 次泛音）做声带
   - 低通从 900Hz 开到 5kHz，做出张嘴的「m→ow」
   - 两个带通共鸣腔撑起元音，三角波补一层胸腔低频
   - 颤音深度逐渐加大，尾音才有猫叫那种拐弯
   四种基础语气：bright（开心长喵）、chirp（短促咪）、double（连叫两声）、soft（低落轻喵）。
   另外四种做变化用：trill（咕噜式招呼）、question（上扬疑问）、
   longcall（撒娇拖长）、grumpy（不耐烦的低哼）。
   点击猫时按「洗牌轮转」取一种，保证连着点也不会重复上一声。
   ============================================================ */

import { getEffectiveSoundVolume, isSoundEnabled } from './sound'

export type MeowKind =
  | 'bright'
  | 'chirp'
  | 'double'
  | 'soft'
  | 'trill'
  | 'question'
  | 'longcall'
  | 'grumpy'

type AudioContextCtor = typeof AudioContext

interface Syllable {
  f0Start: number
  f0Peak: number
  f0End: number
  dur: number
  /** 音高最高点落在时长的百分比处 */
  peakAt: number
  gain: number
  /** 0–1，越大高频共鸣越亮 */
  brightness: number
  vibratoHz: number
  vibratoDepth: number
}

const SYLLABLES: Record<MeowKind, Syllable[]> = {
  // 开心：起音轻挑，冲上去再软软落回来
  bright: [
    {
      f0Start: 520,
      f0Peak: 840,
      f0End: 500,
      dur: 0.36,
      peakAt: 0.33,
      gain: 0.17,
      brightness: 0.95,
      vibratoHz: 17,
      vibratoDepth: 0.055,
    },
  ],
  // 短促的「咪」：又快又高，像被逗了一下
  chirp: [
    {
      f0Start: 660,
      f0Peak: 1080,
      f0End: 820,
      dur: 0.2,
      peakAt: 0.4,
      gain: 0.15,
      brightness: 1,
      vibratoHz: 21,
      vibratoDepth: 0.035,
    },
  ],
  // 连叫两声，第二声更高更短
  double: [
    {
      f0Start: 560,
      f0Peak: 780,
      f0End: 600,
      dur: 0.2,
      peakAt: 0.4,
      gain: 0.15,
      brightness: 0.9,
      vibratoHz: 18,
      vibratoDepth: 0.04,
    },
    {
      f0Start: 700,
      f0Peak: 1000,
      f0End: 660,
      dur: 0.16,
      peakAt: 0.36,
      gain: 0.14,
      brightness: 1,
      vibratoHz: 22,
      vibratoDepth: 0.05,
    },
  ],
  // 没精神时的轻喵：低、慢、暗
  soft: [
    {
      f0Start: 360,
      f0Peak: 430,
      f0End: 300,
      dur: 0.52,
      peakAt: 0.3,
      gain: 0.13,
      brightness: 0.55,
      vibratoHz: 11,
      vibratoDepth: 0.03,
    },
  ],
  // 打招呼的「咕噜」：嘴几乎没张开，靠快速颤动做出连续的短音
  trill: [
    {
      f0Start: 430,
      f0Peak: 520,
      f0End: 470,
      dur: 0.11,
      peakAt: 0.35,
      gain: 0.11,
      brightness: 0.45,
      vibratoHz: 26,
      vibratoDepth: 0.07,
    },
    {
      f0Start: 460,
      f0Peak: 560,
      f0End: 500,
      dur: 0.1,
      peakAt: 0.35,
      gain: 0.12,
      brightness: 0.5,
      vibratoHz: 28,
      vibratoDepth: 0.07,
    },
    {
      f0Start: 440,
      f0Peak: 540,
      f0End: 460,
      dur: 0.09,
      peakAt: 0.3,
      gain: 0.1,
      brightness: 0.42,
      vibratoHz: 24,
      vibratoDepth: 0.06,
    },
  ],
  // 疑问：音高一路往上抬，尾巴不收
  question: [
    {
      f0Start: 470,
      f0Peak: 880,
      f0End: 860,
      dur: 0.3,
      peakAt: 0.86,
      gain: 0.15,
      brightness: 0.85,
      vibratoHz: 15,
      vibratoDepth: 0.03,
    },
  ],
  // 撒娇：拖得很长，中途拐一下再落回平音
  longcall: [
    {
      f0Start: 470,
      f0Peak: 760,
      f0End: 520,
      dur: 0.78,
      peakAt: 0.34,
      gain: 0.15,
      brightness: 0.72,
      vibratoHz: 13,
      vibratoDepth: 0.065,
    },
  ],
  // 不耐烦的低哼：又低又暗，颤得慢
  grumpy: [
    {
      f0Start: 300,
      f0Peak: 370,
      f0End: 250,
      dur: 0.4,
      peakAt: 0.28,
      gain: 0.16,
      brightness: 0.32,
      vibratoHz: 9,
      vibratoDepth: 0.05,
    },
  ],
}

let ctx: AudioContext | null = null
let lastPlayedAt = 0
const MEOW_COOLDOWN_MS = 320

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor: AudioContextCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    try {
      ctx = new Ctor()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function scheduleSyllable(
  ac: BaseAudioContext,
  at: number,
  s: Syllable,
  detune: number,
  volume: number,
): void {
  const now = at
  const start = s.f0Start * detune
  const peak = s.f0Peak * detune
  const end = s.f0End * detune

  const out = ac.createGain()
  const gain = s.gain * volume
  out.gain.setValueAtTime(0.0001, now)
  out.gain.exponentialRampToValueAtTime(gain, now + 0.022)
  out.gain.linearRampToValueAtTime(gain * 0.82, now + s.dur * 0.82)
  out.gain.exponentialRampToValueAtTime(0.0001, now + s.dur + 0.05)

  // 张嘴：低通从鼻音的 900Hz 打开到明亮元音
  const mouth = ac.createBiquadFilter()
  mouth.type = 'lowpass'
  mouth.Q.value = 0.7
  mouth.frequency.setValueAtTime(900, now)
  mouth.frequency.exponentialRampToValueAtTime(3200 + s.brightness * 2400, now + s.dur * 0.4)

  // 两个共鸣腔撑起「喵」的元音，开头偏 ae、结尾滑向 ou
  const formantLow = ac.createBiquadFilter()
  formantLow.type = 'bandpass'
  formantLow.Q.value = 2.6
  formantLow.frequency.setValueAtTime(start * 2.5, now)
  formantLow.frequency.linearRampToValueAtTime(peak * 3.1, now + s.dur * s.peakAt)
  formantLow.frequency.linearRampToValueAtTime(end * 2.3, now + s.dur)

  const formantHigh = ac.createBiquadFilter()
  formantHigh.type = 'bandpass'
  formantHigh.Q.value = 6
  formantHigh.frequency.setValueAtTime(start * 5.4, now)
  formantHigh.frequency.linearRampToValueAtTime(peak * 6.2, now + s.dur * s.peakAt)
  formantHigh.frequency.linearRampToValueAtTime(end * 4.4, now + s.dur)

  const lowMix = ac.createGain()
  lowMix.gain.value = 0.95
  const highMix = ac.createGain()
  highMix.gain.value = 0.18 + s.brightness * 0.24

  // 声带：基波 + 2/3/4 次泛音，比纯锯齿柔和、比正弦有性格
  const voice = ac.createOscillator()
  voice.setPeriodicWave(
    ac.createPeriodicWave(
      new Float32Array([0, 0, 0, 0, 0, 0, 0]),
      new Float32Array([0, 1, 0.62, 0.44, 0.3, 0.2, 0.13]),
    ),
  )
  // 音高轮廓：先轻轻塌一下再扬起来，尾巴滑落
  voice.frequency.setValueAtTime(start * 0.94, now)
  voice.frequency.linearRampToValueAtTime(start, now + 0.025)
  voice.frequency.exponentialRampToValueAtTime(peak, now + s.dur * s.peakAt)
  voice.frequency.exponentialRampToValueAtTime(end, now + s.dur)

  // 胸腔低频，让声音不单薄
  const body = ac.createOscillator()
  body.type = 'triangle'
  body.frequency.setValueAtTime(start * 0.5, now)
  body.frequency.exponentialRampToValueAtTime(peak * 0.5, now + s.dur * s.peakAt)
  body.frequency.exponentialRampToValueAtTime(end * 0.5, now + s.dur)
  const bodyMix = ac.createGain()
  bodyMix.gain.value = 0.3

  // 尾音颤动：深度从 0 慢慢加深，猫叫的「拐弯」就在这里
  const lfo = ac.createOscillator()
  lfo.frequency.value = s.vibratoHz
  const lfoDepth = ac.createGain()
  lfoDepth.gain.setValueAtTime(0, now)
  lfoDepth.gain.linearRampToValueAtTime(peak * s.vibratoDepth, now + s.dur * 0.85)

  const highpass = ac.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = 190

  // 轻微压限，连叫时也不会突然爆音
  const glue = ac.createDynamicsCompressor()
  glue.threshold.value = -20
  glue.knee.value = 14
  glue.ratio.value = 3
  glue.attack.value = 0.004
  glue.release.value = 0.14

  voice.connect(formantLow).connect(lowMix).connect(mouth)
  voice.connect(formantHigh).connect(highMix).connect(mouth)
  body.connect(bodyMix).connect(mouth)
  mouth.connect(out).connect(highpass).connect(glue).connect(ac.destination)
  lfo.connect(lfoDepth).connect(voice.frequency)

  const stopAt = now + s.dur + 0.08
  voice.start(now)
  body.start(now)
  lfo.start(now)
  voice.stop(stopAt)
  body.stop(stopAt)
  lfo.stop(stopAt)
}

/**
 * 把一声猫叫排进给定的音频上下文（实时播放和离线渲染共用这段图）。
 * detune 用来在每次点击时做一点点音高变化。
 */
export function scheduleMeow(
  ac: BaseAudioContext,
  at: number,
  kind: MeowKind = 'bright',
  detune = 1,
  volume = 1,
): void {
  let cursor = at
  const outputVolume = Math.min(1, Math.max(0, volume))
  SYLLABLES[kind].forEach((syllable, index) => {
    if (index > 0) cursor += 0.055
    scheduleSyllable(ac, cursor, syllable, detune, outputVolume)
    cursor += syllable.dur
  })
}

const ALL_KINDS: MeowKind[] = [
  'bright',
  'chirp',
  'double',
  'soft',
  'trill',
  'question',
  'longcall',
  'grumpy',
]

let bag: MeowKind[] = []
let lastKind: MeowKind | null = null

/**
 * 取下一声猫叫的语气：把全部语气洗牌后依次用掉再重新洗。
 * 相邻两次一定不同，且每种语气在一轮里都会出现一次。
 */
export function nextMeowKind(): MeowKind {
  if (bag.length === 0) {
    bag = [...ALL_KINDS]
    for (let i = bag.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const swap = bag[i]
      bag[i] = bag[j]
      bag[j] = swap
    }
    // 新一轮的第一声不能和上一轮的最后一声撞车
    if (bag.length > 1 && bag[0] === lastKind) {
      const head = bag[0]
      bag[0] = bag[1]
      bag[1] = head
    }
  }
  const kind = bag.shift() ?? 'bright'
  lastKind = kind
  return kind
}

/**
 * 叫一声。kind 不传就按洗牌轮转挑一种语气（保证和上一声不同）。
 * 返回是否真的发声（总开关关闭 / 不支持 Web Audio / 0.32s 内连点时为 false）。
 */
export function playMeow(kind?: MeowKind): boolean {
  if (!isSoundEnabled()) return false
  const ac = audioContext()
  if (!ac) return false

  // 连点限流：太快会糊成一片噪音。用挂钟计时，音频时钟在 resume 前可能是冻结的
  const wallClock = Date.now()
  if (wallClock - lastPlayedAt < MEOW_COOLDOWN_MS) return false
  lastPlayedAt = wallClock

  // 被限流拦下的点击不消耗语气，保证真正发声的每一下都换一种
  const chosen = kind ?? nextMeowKind()

  scheduleMeow(ac, ac.currentTime, chosen, 0.95 + Math.random() * 0.1, getEffectiveSoundVolume())
  return true
}
