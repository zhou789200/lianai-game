import { Volume1, Volume2, VolumeX } from 'lucide-react'
import { playSfx } from '../game/sfx'
import { useStoryVoicePreference } from '../game/useStoryVoice'

interface StoryVoiceButtonProps {
  className?: string
}

export function StoryVoiceButton({
  className = 'storybook__icon-btn',
}: StoryVoiceButtonProps) {
  const {
    soundEnabled,
    speechSupported,
    active,
    toggleVoice,
  } = useStoryVoicePreference()
  const available = soundEnabled && speechSupported
  const label = !speechSupported
    ? '当前浏览器不支持剧情朗读'
    : !soundEnabled
      ? '总声音已关闭，请先在设置中开启声音'
      : active
        ? '关闭剧情朗读'
        : '开启剧情朗读'

  return (
    <button
      type="button"
      className={`${className} story-voice-btn${active ? ' is-on' : ''}`}
      onClick={() => {
        playSfx('tap')
        toggleVoice()
      }}
      disabled={!available}
      aria-label={label}
      aria-pressed={active}
      title={label}
    >
      {!available ? (
        <VolumeX size={16} />
      ) : active ? (
        <Volume2 size={16} />
      ) : (
        <Volume1 size={16} />
      )}
    </button>
  )
}
