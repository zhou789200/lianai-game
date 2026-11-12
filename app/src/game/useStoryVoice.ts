import { useEffect, useId, useState } from 'react'
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
