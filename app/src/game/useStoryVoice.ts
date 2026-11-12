import { useEffect, useId, useState } from 'react'
import { isSoundEnabled, onSoundChange, setSoundEnabled } from './sound'
import {
  isSpeechSupported,
  isStoryVoiceEnabled,
  onStoryVoiceChange,
  setStoryVoiceEnabled,
  speakStoryText,
  stopStoryVoice,
} from './storyVoice'

export function useStoryVoicePreference() {
  const [soundEnabled, setSoundState] = useState(() => isSoundEnabled())
  const [voiceEnabled, setVoiceState] = useState(() => isStoryVoiceEnabled())
  const supported = isSpeechSupported()

  useEffect(
    () =>
      onSoundChange(() => {
        const enabled = isSoundEnabled()
        setSoundState(enabled)
        if (!enabled) stopStoryVoice()
      }),
    [],
  )
  useEffect(() => onStoryVoiceChange(() => setVoiceState(isStoryVoiceEnabled())), [])

  const toggleSound = () => {
    const next = !soundEnabled
    setSoundEnabled(next)
    setSoundState(next)
  }

  const toggleVoice = () => {
    if (!supported) return
    const next = !voiceEnabled
    setStoryVoiceEnabled(next)
    setVoiceState(next)
  }

  return {
    soundEnabled,
    voiceEnabled,
    speechSupported: supported,
    active: soundEnabled && voiceEnabled && supported,
    toggleSound,
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

  useEffect(() => {
    if (!active || !text?.trim()) {
      stopStoryVoice(owner)
      return
    }

    // 延后一拍再调用语音，StrictMode 的首次探测挂载会先清理定时器，
    // 因此开发模式下也只会真正朗读一次。
    const timer = window.setTimeout(() => {
      speakStoryText({ text, speaker, owner })
    }, 0)

    return () => {
      window.clearTimeout(timer)
      stopStoryVoice(owner)
    }
  }, [active, owner, pageKey, speaker, text])

  return { ...preference, active }
}
