import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  ArrowRight,
  Cloud,
  LockKeyhole,
  LogIn,
  ShieldCheck,
  UserRoundPlus,
} from 'lucide-react'
import { useGame } from '../game/GameContext'
import { Modal } from './Modal'
import { UiButton } from './UiButton'

type AccountMode = 'register' | 'login'

interface AccountModalProps {
  onClose: () => void
  onGuest?: () => void
  allowGuest?: boolean
  dismissible?: boolean
  initialMode?: AccountMode
}

const USERNAME_PATTERN = /^[\p{L}\p{N}_-]+$/u

function validateUsername(value: string): string | null {
  const username = value.normalize('NFKC').trim()
  if (username.length < 3 || username.length > 20) {
    return '游戏账号需为 3-20 个字符'
  }
  if (!USERNAME_PATTERN.test(username)) {
    return '游戏账号只能包含文字、数字、下划线或短横线'
  }
  return null
}

function validatePassword(value: string): string | null {
  if (value.length < 8 || value.length > 128) {
    return '密码需为 8-128 个字符'
  }
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    return '密码包含不支持的字符'
  }
  return null
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '操作失败，请稍后重试'
}

export function AccountModal({
  onClose,
  onGuest,
  allowGuest = false,
  dismissible = true,
  initialMode = 'register',
}: AccountModalProps) {
  const { userData, authBusy, actions } = useGame()
  const [mode, setMode] = useState<AccountMode>(initialMode)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const usernameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (document.activeElement !== usernameRef.current) usernameRef.current?.focus()
    }, 120)
    return () => window.clearTimeout(timer)
  }, [])

  const busy = submitting || authBusy

  const switchMode = (nextMode: AccountMode) => {
    if (busy || nextMode === mode) return
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
    setError(null)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (busy) return

    const usernameError = validateUsername(username)
    if (usernameError) {
      setError(usernameError)
      return
    }
    const passwordError = validatePassword(password)
    if (passwordError) {
      setError(passwordError)
      return
    }
    if (mode === 'register' && password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      if (mode === 'register') {
        await actions.registerWithAccount(username.trim(), password)
      } else {
        await actions.loginWithAccount(username.trim(), password)
      }
      onClose()
    } catch (submitError) {
      setError(getErrorMessage(submitError))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title={mode === 'register' ? '创建游戏账号' : '登录游戏账号'}
      subtitle={
        mode === 'register'
          ? '绑定当前进度，换设备也能继续经营'
          : '登录后读取账号里的咖啡馆存档'
      }
      onClose={dismissible && !busy ? onClose : undefined}
      initialFocusRef={usernameRef}
    >
      <div className="account-tabs" role="tablist" aria-label="账号方式">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          className={`account-tab${mode === 'register' ? ' is-active' : ''}`}
          onClick={() => switchMode('register')}
          disabled={busy}
        >
          <UserRoundPlus size={15} />
          创建账号
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          className={`account-tab${mode === 'login' ? ' is-active' : ''}`}
          onClick={() => switchMode('login')}
          disabled={busy}
        >
          <LogIn size={15} />
          已有账号
        </button>
      </div>

      <form className="account-form" onSubmit={submit} noValidate>
        <label className="account-field">
          <span className="account-field__label">游戏账号</span>
          <div className="account-field__control">
            <LockKeyhole size={15} aria-hidden="true" />
            <input
              ref={usernameRef}
              type="text"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={20}
              placeholder="3-20 个文字、数字或短横线"
              disabled={busy}
              required
            />
          </div>
        </label>

        <label className="account-field">
          <span className="account-field__label">密码</span>
          <div className="account-field__control">
            <ShieldCheck size={15} aria-hidden="true" />
            <input
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              maxLength={128}
              placeholder="至少 8 个字符"
              disabled={busy}
              required
            />
          </div>
        </label>

        {mode === 'register' ? (
          <label className="account-field">
            <span className="account-field__label">确认密码</span>
            <div className="account-field__control">
              <ShieldCheck size={15} aria-hidden="true" />
              <input
                type="password"
                name="confirm-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                autoComplete="new-password"
                maxLength={128}
                placeholder="再输入一次密码"
                disabled={busy}
                required
              />
            </div>
          </label>
        ) : null}

        {error ? (
          <p className="account-error" role="alert">
            <AlertCircle size={14} />
            <span>{error}</span>
          </p>
        ) : null}

        <UiButton
          variant="primary"
          block
          type="submit"
          loading={busy}
          icon={mode === 'register' ? <UserRoundPlus size={16} /> : <ArrowRight size={16} />}
        >
          {mode === 'register' ? '创建并保存进度' : '登录并继续营业'}
        </UiButton>
      </form>

      <div className="account-policy">
        <Cloud size={14} aria-hidden="true" />
        <span>
          {mode === 'register'
            ? '账号创建后会自动绑定当前游客进度。密码不会保存在浏览器里。'
            : '登录后优先读取数据库存档；网络异常时使用这台设备的账号缓存。'}
        </span>
      </div>

      {allowGuest ? (
        <button
          type="button"
          className="account-guest-link"
          onClick={onGuest ?? onClose}
          disabled={busy}
        >
          先以游客试玩
          <ArrowRight size={14} />
        </button>
      ) : null}

      {userData.error && !error ? (
        <p className="account-error" role="status">
          <AlertCircle size={14} />
          <span>{userData.error}</span>
        </p>
      ) : null}
    </Modal>
  )
}
