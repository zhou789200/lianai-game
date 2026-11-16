import { useCallback, useEffect, useId, useRef, useState } from 'react'
import {
  getSoundVolume,
  isSoundEnabled,
  onSoundChange,
  onSoundVolumeChange,
  setSoundEnabled,
  setSoundVolume,
} from './sound'
import {
  getStoryVoiceCapabilities,
  getStoryVoiceSupportText,
  isStoryVoiceEnabled,
  onStoryVoiceChange,
  setStoryVoiceEnabled,
  speakStoryText,
  stopStoryVoice,
  type StoryVoiceCapabilities,
} from './storyVoice'
import {
  STORY_AUTO_ADVANCE_MS,
  isStoryAutoAdvanceReady,
} from '../../shared/storyVoiceFailure.mjs'

export { STORY_AUTO_ADVANCE_MS }

/**
 * 文字与语音都完成后等待 5 秒再推进。任一条件变化、用户手动翻页、
 * 页面进入后台或组件卸载时都会清除计时，确保每个页面只有一次计时。
 */
export function useStoryAutoAdvance({
  onAdvance,
  pageKey,
  allowed = true,
  textComplete = true,
  voiceFinished = true,
  pageVisible = true,
}: {
  onAdvance: () => void
  pageKey: string
  allowed?: boolean
  textComplete?: boolean
  voiceFinished?: boolean
  pageVisible?: boolean
}) {
  const onAdvanceRef = useRef(onAdvance)
  const timerRef = useRef<number | null>(null)
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document === 'undefined' || !document.hidden,
  )

  useEffect(() => {
    onAdvanceRef.current = onAdvance
  }, [onAdvance])

  useEffect(() => {
    const onChange = () => setDocumentVisible(!document.hidden)
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [])

  const cancel = useCallback(() => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => {
    cancel()
    if (
      !pageKey ||
      !isStoryAutoAdvanceReady({
        allowed,
        textComplete,
        voiceFinished,
        pageVisible: pageVisible && documentVisible,
      })
    ) {
      return
    }

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      onAdvanceRef.current()
    }, STORY_AUTO_ADVANCE_MS)
    return cancel
  }, [
    allowed,
    cancel,
    documentVisible,
    pageKey,
    pageVisible,
    textComplete,
    voiceFinished,
  ])

  return { cancel }
}

export function useStoryVoicePreference() {
  const [soundEnabled, setSoundState] = useState(() => isSoundEnabled())
  const [soundVolume, setSoundVolumeState] = useState(() => getSoundVolume())
  const [voiceEnabled, setVoiceState] = useState(() => isStoryVoiceEnabled())
  const [capabilities] = useState<StoryVoiceCapabilities>(getStoryVoiceCapabilities)
  const supported = capabilities.online || capabilities.system
  const voiceActive = soundEnabled && voiceEnabled && supported

  useEffect(
    () =>
      onSoundChange(() => {
        const enabled = isSoundEnabled()
        setSoundState(enabled)
        if (!enabled) stopStoryVoice()
      }),
    [],
  )
  useEffect(
    () =>
      onSoundVolumeChange(() => {
        setSoundVolumeState(getSoundVolume())
      }),
    [],
  )
  useEffect(() => onStoryVoiceChange(() => setVoiceState(isStoryVoiceEnabled())), [])

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    setSoundState(next)
  }

  const changeSoundVolume = (next: number) => {
    const volume = Math.min(1, Math.max(0, next))
    setSoundVolumeState(volume)
    setSoundVolume(volume)
    if (!soundEnabled && volume > 0) {
      setSoundEnabled(true)
      setSoundState(true)
    }
    if (volume === 0 && soundEnabled) {
      setSoundEnabled(false)
      setSoundState(false)
    }
  }

  const toggleVoice = () => {
    if (!supported) return
    const next = !voiceEnabled
    setStoryVoiceEnabled(next)
    setVoiceState(next)
  }

  return {
    soundEnabled,
    soundVolume,
    voiceEnabled,
    capabilities,
    speechSupported: supported,
    supportText: getStoryVoiceSupportText(capabilities),
    active: voiceActive,
    toggleSound,
    changeSoundVolume,
    toggleVoice,
  }
}

export function useStoryVoice(
  text: string | null,
  speaker: string | undefined,
  pageKey: string,
  enabled = true,
) {
  const owner = useId()
  const preference = useStoryVoicePreference()
  const active = enabled && preference.active
  const requestRef = useRef(0)
  const [completion, setCompletion] = useState({
    pageKey: '',
    finished: false,
  })

  useEffect(() => {
    const request = requestRef.current + 1
    requestRef.current = request
    const speechText = text?.trim() ?? ''
    const hasText = Boolean(speechText)

    if (!active || !hasText) {
      stopStoryVoice(owner)
      return () => {
        if (requestRef.current === request) requestRef.current += 1
      }
    }

    const finish = () => {
      if (requestRef.current === request) {
        setCompletion({ pageKey, finished: true })
      }
    }

    // 延后一拍再调用语音，StrictMode 的首次探测挂载会先清理定时器，
    // 因此开发模式下也只会真正朗读一次。
    const timer = window.setTimeout(() => {
      setCompletion({ pageKey, finished: false })
      const accepted = speakStoryText({
        text: speechText,
        speaker,
        owner,
        onFinished: finish,
      })
      if (!accepted) finish()
    }, 0)

    return () => {
      window.clearTimeout(timer)
      if (requestRef.current === request) requestRef.current += 1
      stopStoryVoice(owner)
    }
  }, [active, owner, pageKey, speaker, text])

  const finished =
    !active || !text?.trim()
      ? true
      : completion.pageKey === pageKey && completion.finished

  return { ...preference, active, finished }
}
