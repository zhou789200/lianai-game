import { useState } from 'react'
import {
  AlertCircle,
  AudioLines,
  Check,
  Cloud,
  Database,
  HardDrive,
  LogIn,
  LogOut,
  RotateCcw,
  Save,
  ShieldAlert,
  UserRoundPlus,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useGame } from '../game/GameContext'
import { playSfx } from '../game/sfx'
import { useStoryVoicePreference } from '../game/useStoryVoice'
import type { GameState } from '../game/types'
import { Modal } from './Modal'
import { UiButton } from './UiButton'

interface SettingsModalProps {
  onClose: () => void
  onOpenAccount: (mode: 'register' | 'login') => void
}

type PendingAction = 'reset' | 'logout' | 'keep-local' | 'use-remote' | null

function fmt(at: number | null): string {
  if (!at) return '尚未保存'
  return new Date(at).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function saveSummary(state: GameState): string {
  return `Lv.${state.level} · ${state.coins} 金币 · ${state.stats.businessRuns} 次营业`
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

export function SettingsModal({
  onClose,
  onOpenAccount,
}: SettingsModalProps) {
  const { state, lastSavedAt, saveError, userData, authBusy, actions } = useGame()
  const [confirmReset, setConfirmReset] = useState(false)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const {
    soundEnabled: sound,
    soundVolume,
    voiceEnabled,
    speechSupported,
    supportText,
    active: voiceActive,
    toggleSound: toggleSoundPreference,
    changeSoundVolume,
    toggleVoice,
  } = useStoryVoicePreference()

  const busy = authBusy || pendingAction !== null
  const account = userData.user
  const conflict = userData.conflict
  const syncBlocked = userData.syncBlocked || !!conflict
  const volumePercent = Math.round(soundVolume * 100)
  const volumeLabel =
    volumePercent === 0
      ? '静音'
      : volumePercent < 45
        ? '轻'
        : volumePercent < 80
          ? '舒适'
          : '响亮'

  const toggleSound = () => {
    const next = !sound
    toggleSoundPreference()
    if (next) playSfx('success')
  }

  const toggleStoryVoice = () => {
    if (!speechSupported) return
    const next = !voiceEnabled
    toggleVoice()
    if (next && sound) playSfx('tap')
  }

  const resetGame = async () => {
    if (busy || syncBlocked) return
    setPendingAction('reset')
    setActionError(null)
    try {
      await actions.resetGame()
      setConfirmReset(false)
      onClose()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setPendingAction(null)
    }
  }

  const logout = async () => {
    if (busy || syncBlocked) return
    setPendingAction('logout')
    setActionError(null)
    try {
      await actions.logoutFromAccount()
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setPendingAction(null)
    }
  }

  const resolveConflict = async (strategy: 'keep-local' | 'use-remote') => {
    if (busy || !conflict) return
    setPendingAction(strategy)
    setActionError(null)
    try {
      await actions.resolveAccountConflict(strategy)
    } catch (error) {
      setActionError(getErrorMessage(error))
    } finally {
      setPendingAction(null)
    }
  }

  if (confirmReset) {
    return (
      <Modal
        title="重置存档？"
        subtitle={
          account
            ? '当前账号的游戏进度会从数据库和本机缓存中清除，账号本身仍可继续登录。'
            : '游客存档会从当前浏览器清除。若之后创建账号，将使用全新的游戏进度。'
        }
        onClose={busy ? undefined : () => setConfirmReset(false)}
        actions={
          <>
            <UiButton
              variant="ghost"
              onClick={() => setConfirmReset(false)}
              disabled={busy}
            >
              我再想想
            </UiButton>
            <UiButton
              variant="primary"
              onClick={resetGame}
              loading={pendingAction === 'reset'}
              disabled={busy || syncBlocked}
            >
              确认重置
            </UiButton>
          </>
        }
      >
        {syncBlocked ? (
          <p className="account-error" role="alert">
            <ShieldAlert size={15} />
            <span>请先返回设置页，处理本机与云端的存档冲突。</span>
          </p>
        ) : null}
        {actionError ? (
          <p className="account-error" role="alert">
            <AlertCircle size={15} />
            <span>{actionError}</span>
          </p>
        ) : null}
      </Modal>
    )
  }

  return (
    <Modal
      title="账号与存档"
      subtitle={`${state.shopName} · 原型版本 v0.1`}
      onClose={busy ? undefined : onClose}
      actions={
        <UiButton variant="primary" block onClick={onClose} disabled={busy}>
          关闭
        </UiButton>
      }
    >
      <section className="account-identity" aria-label="当前账号状态">
        <div className="account-identity__icon" aria-hidden="true">
          {account ? <Database size={19} /> : <HardDrive size={19} />}
        </div>
        <div className="account-identity__copy">
          <strong>{account ? account.username : '游客试玩'}</strong>
          <span>
            {account
              ? userData.source === 'remote'
                ? '已连接用户数据库'
                : '正在使用账号本机缓存'
              : '进度仅保存在当前浏览器'}
          </span>
        </div>
        <span
          className={`account-identity__badge${
            account && userData.source === 'remote' ? ' is-online' : ''
          }`}
        >
          {account
            ? userData.source === 'remote'
              ? '已同步'
              : '离线'
            : '游客'}
        </span>
      </section>

      {account ? (
        <div className="account-meta">
          <span>
            <Cloud size={13} />
            数据库存档修订 <b className="t-num">#{userData.revision}</b>
          </span>
          <span>
            <Save size={13} />
            最近同步 {fmt(userData.lastSyncedAt)}
          </span>
        </div>
      ) : (
        <div className="account-guest-actions">
          <UiButton
            variant="primary"
            block
            icon={<UserRoundPlus size={16} />}
            onClick={() => onOpenAccount('register')}
            disabled={busy}
          >
            创建账号并保存进度
          </UiButton>
          <UiButton
            variant="ghost"
            block
            icon={<LogIn size={16} />}
            onClick={() => onOpenAccount('login')}
            disabled={busy}
          >
            登录已有账号
          </UiButton>
        </div>
      )}

      {conflict ? (
        <section className="account-conflict" aria-label="存档冲突处理">
          <div className="account-conflict__heading">
            <ShieldAlert size={17} />
            <div>
              <strong>需要选择保留哪个版本</strong>
              <span>自动同步已暂停。两个版本不会被时间戳静默覆盖。</span>
            </div>
          </div>
          <div className="account-conflict__versions">
            <div>
              <span>本机版本</span>
              <strong>{saveSummary(state)}</strong>
            </div>
            <div>
              <span>云端版本 · #{conflict.revision}</span>
              <strong>
                {conflict.state
                  ? saveSummary(conflict.state)
                  : '云端版本已变化，可重新载入查看'}
              </strong>
            </div>
          </div>
          <div className="account-conflict__actions">
            <UiButton
              variant="cream"
              block
              loading={pendingAction === 'keep-local'}
              disabled={busy}
              onClick={() => resolveConflict('keep-local')}
            >
              保留本机并覆盖云端
            </UiButton>
            <UiButton
              variant="sea"
              block
              loading={pendingAction === 'use-remote'}
              disabled={busy}
              onClick={() => resolveConflict('use-remote')}
            >
              采用云端并替换本机
            </UiButton>
          </div>
        </section>
      ) : null}

      <div className="settings-grid">
        <div className="settings-stat">
          <span className="settings-stat__value t-num">{state.coins}</span>
          <span className="settings-stat__label">金币</span>
        </div>
        <div className="settings-stat">
          <span className="settings-stat__value t-num">
            {state.stamina}/{state.staminaMax}
          </span>
          <span className="settings-stat__label">体力</span>
        </div>
        <div className="settings-stat">
          <span className="settings-stat__value t-num">Lv.{state.level}</span>
          <span className="settings-stat__label">店铺等级</span>
        </div>
        <div className="settings-stat">
          <span className="settings-stat__value t-num">
            {state.pet.intimacy}
          </span>
          <span className="settings-stat__label">布丁亲密度</span>
        </div>
      </div>

      <div
        className={`save-state ${
          saveError || userData.error || syncBlocked
            ? 'save-state--error'
            : 'save-state--ok'
        }`}
        role="status"
      >
        {saveError || userData.error || syncBlocked ? (
          <AlertCircle size={14} />
        ) : (
          <Check size={14} />
        )}
        <span>
          {actionError ??
            saveError ??
            userData.error ??
            `${
              account && userData.source === 'remote'
                ? '数据库存档正常'
                : account
                  ? '账号进度已保存在本机缓存'
                  : '游客进度已保存在当前浏览器'
            } · 最近保存 ${fmt(lastSavedAt)}`}
        </span>
      </div>

      <button
        type="button"
        className="setting-row"
        onClick={toggleSound}
        aria-pressed={sound}
      >
        <span className="setting-row__icon">
          {sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </span>
        <span className="setting-row__body">
          <strong>声音</strong>
          <small>
            {sound
              ? '主页音乐、经营、宠物与剧情音效已开启'
              : '已静音，游戏操作只保留视觉反馈'}
          </small>
        </span>
        <span
          className={`setting-switch${sound ? ' is-on' : ''}`}
          aria-hidden="true"
        >
          <i />
        </span>
      </button>

      <div className="setting-volume" aria-disabled={!sound}>
        <div className="setting-volume__heading">
          <span className="setting-volume__label" id="setting-volume-label">
            音量
          </span>
          <output
            className="setting-volume__value t-num"
            htmlFor="setting-volume"
            aria-live="polite"
            aria-label={`当前音量 ${volumePercent}%`}
          >
            {volumePercent}% · {sound ? volumeLabel : '已静音'}
          </output>
        </div>
        <div className="setting-volume__control">
          <VolumeX size={14} aria-hidden="true" />
          <input
            id="setting-volume"
            className="setting-volume__range"
            type="range"
            min="0"
            max="100"
            step="1"
            value={volumePercent}
            aria-labelledby="setting-volume-label"
            aria-valuetext={`${volumePercent}%，${sound ? volumeLabel : '总声音已关闭'}`}
            onChange={(event) => changeSoundVolume(Number(event.currentTarget.value) / 100)}
          />
          <Volume2 size={14} aria-hidden="true" />
        </div>
        {!sound ? (
          <p className="setting-volume__hint">
            声音已关闭；拖动滑杆会重新开启声音
          </p>
        ) : null}
      </div>

      <button
        type="button"
        className="setting-row"
        onClick={toggleStoryVoice}
        aria-pressed={voiceActive}
        aria-description={supportText}
        disabled={!speechSupported || !sound}
      >
        <span className="setting-row__icon">
          {voiceActive ? (
            <AudioLines size={16} />
          ) : (
            <VolumeX size={16} />
          )}
        </span>
        <span className="setting-row__body">
          <strong>剧情角色朗读</strong>
          <small>
            {!sound
              ? `总声音已关闭，开启声音后才能朗读。${supportText}`
              : !speechSupported
                ? supportText
                : voiceEnabled
                  ? supportText
                  : '剧情文字会保持安静，不自动发声'}
          </small>
        </span>
        <span
          className={`setting-switch${
            voiceActive ? ' is-on' : ''
          }`}
          aria-hidden="true"
        >
          <i />
        </span>
      </button>

      <div className="account-operations">
        <UiButton
          variant="ghost"
          block
          icon={<RotateCcw size={15} />}
          onClick={() => {
            setActionError(null)
            setConfirmReset(true)
          }}
          disabled={busy || syncBlocked}
        >
          重置游戏存档
        </UiButton>
        {account ? (
          <UiButton
            variant="ghost"
            block
            icon={<LogOut size={15} />}
            onClick={logout}
            loading={pendingAction === 'logout'}
            disabled={busy || syncBlocked}
          >
            退出账号
          </UiButton>
        ) : null}
      </div>

      {actionError ? (
        <p className="account-error" role="alert">
          <AlertCircle size={14} />
          <span>{actionError}</span>
        </p>
      ) : null}

      <p className="settings-note">
        <ShieldAlert size={11} />{' '}
        {conflict
          ? '冲突解决前，退出账号和重置存档都会保持锁定。'
          : account
            ? '账号密码不会保存在浏览器；退出后会自动恢复此设备的游客存档。'
            : '创建账号时会把当前游客进度上传，建立独立账号；登录只读取该账号的存档。'}
      </p>
    </Modal>
  )
}
