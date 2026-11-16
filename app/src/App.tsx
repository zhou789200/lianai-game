import { useEffect, useLayoutEffect, useState } from 'react'
import { GameProvider, useGame } from './game/GameContext'
import { PhoneShell } from './components/PhoneShell'
import { SceneRenderer } from './components/SceneRenderer'
import { AppHeader } from './components/AppHeader'
import { BottomNav } from './components/BottomNav'
import { ToastStack } from './components/ToastStack'
import { SettingsModal } from './components/SettingsModal'
import { IntroModal } from './components/IntroModal'
import { AccountModal } from './components/AccountModal'
import { playSfx } from './game/sfx'
import { stopStoryVoice } from './game/storyVoice'
import {
  setBackgroundMusicContext,
  startHomeBgm,
} from './game/homeBgm'
import { preloadArt } from './assets/preload'
import { HomeView } from './views/HomeView'
import { BusinessView } from './views/BusinessView'
import { CafeView } from './views/CafeView'
import { PetView } from './views/PetView'
import { RomanceView } from './views/RomanceView'
import { StoryView } from './views/StoryView'
import {
  hasChosenGuestMode,
  hasGuestSave,
  hasSeenIntro,
  rememberGuestMode,
  rememberIntroSeen,
} from './game/storage'
import type { ViewKey } from './game/types'

/**
 * 立绘留白区：五个场景底图本身已经画好人物与宠物，
 * 场景层不再叠加任何立绘，内容层只留一块透明留白，
 * 保证下面的操作/剧情内容不会压到画里的人。
 */
function figureZone(view: ViewKey): 'character' | 'pet' | null {
  if (view === 'home') return 'pet'
  return null
}

function Game() {
  const { state, notices, dismissNotice, authReady, userData } = useGame()
  const [view, setView] = useState<ViewKey>('home')
  const [runId, setRunId] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAccount, setShowAccount] = useState(false)
  const [accountStartMode, setAccountStartMode] = useState<'register' | 'login'>(
    'register',
  )
  const [guestChosen, setGuestChosen] = useState(
    () => hasChosenGuestMode() || hasGuestSave(),
  )
  const [introDismissed, setIntroDismissed] = useState(false)

  const showAccountGate =
    authReady && !userData.user && !guestChosen
  // 新档案先做账号选择；试玩后才看新手说明，避免两个弹窗叠在一起。
  const needsIntro =
    authReady && !hasSeenIntro() && (!!userData.user || guestChosen)
  const showIntro = !showAccountGate && needsIntro && !introDismissed

  const zone = figureZone(view)
  const inRun = view === 'business' && runId !== null
  const useImmersiveCafe = view === 'cafe'
  const guestGateOpen = showAccountGate

  const navigate = (next: ViewKey) => {
    if (next === view) return
    stopStoryVoice()
    playSfx('navigate')
    setView(next)
  }

  const openAccount = (mode: 'register' | 'login') => {
    stopStoryVoice()
    setAccountStartMode(mode)
    setShowSettings(false)
    setShowAccount(true)
  }

  useLayoutEffect(() => {
    notices.forEach((notice) => dismissNotice(notice.id))
    // 临时提示属于当前页片，切换模块时不能带到恋爱或剧情本里。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view])

  // 首屏渲染完成后在空闲时段预热其余美术资源，
  // 之后任何页面的图片都是「插入即出图」，不会先闪一帧空白。
  useEffect(() => {
    preloadArt()
  }, [])

  useEffect(() => {
    const release = startHomeBgm()
    return release
  }, [])

  useEffect(() => {
    setBackgroundMusicContext(inRun ? 'cafe' : 'home')
  }, [inRun])

  return (
    <PhoneShell figure={zone} tone={useImmersiveCafe ? 'cafe' : 'default'}>
      {/* 场景层始终挂载：底图常驻，切页只是切 opacity，
          从咖啡店玩法返回时也不会重新加载图片。 */}
      <SceneRenderer
        view={view === 'romance' ? 'story' : view}
        decor={state.decor}
        hidden={useImmersiveCafe}
      />

      <div className="app">
        {inRun || useImmersiveCafe || !authReady ? null : (
          <AppHeader
            onOpenSettings={() => {
              if (!guestGateOpen) {
                stopStoryVoice()
                setShowSettings(true)
              }
            }}
            onOpenRomance={() => navigate('romance')}
          />
        )}

        {/* 立绘留白区：透明，只负责把内容压到画面下半部分 */}
        {zone ? <div className={`figure-zone figure-zone--${zone}`} aria-hidden="true" /> : null}

        {view === 'home' ? <HomeView onNavigate={navigate} /> : null}
        {inRun && runId ? (
          <BusinessView key={runId} runId={runId} onExit={() => setView('cafe')} />
        ) : null}
        {view === 'cafe' ? (
          <CafeView
            onStart={(id) => {
              setRunId(id)
              setView('business')
            }}
          />
        ) : null}
        {view === 'pet' ? <PetView /> : null}
        {view === 'romance' ? <RomanceView /> : null}
        {view === 'story' ? <StoryView /> : null}

        {inRun || !authReady || guestGateOpen ? null : (
          <BottomNav active={view} onChange={navigate} />
        )}
      </div>

      <ToastStack notices={notices} onDismiss={dismissNotice} />

      {!authReady ? (
        <div className="auth-boot" role="status" aria-live="polite">
          <span className="auth-boot__spinner" aria-hidden="true" />
          <span>正在恢复游戏账号…</span>
        </div>
      ) : null}

      {showAccountGate ? (
        <AccountModal
          allowGuest
          dismissible={false}
          onGuest={() => {
            rememberGuestMode()
            setGuestChosen(true)
            setIntroDismissed(false)
          }}
          onClose={() => {
            setGuestChosen(true)
            setIntroDismissed(false)
          }}
        />
      ) : null}

      {showSettings ? (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onOpenAccount={openAccount}
        />
      ) : null}
      {showAccount && !showAccountGate ? (
        <AccountModal
          initialMode={accountStartMode}
          onClose={() => setShowAccount(false)}
        />
      ) : null}
      {showIntro && !showAccountGate && !showSettings ? (
        <IntroModal
          onClose={() => {
            rememberIntroSeen()
            setIntroDismissed(true)
          }}
        />
      ) : null}
    </PhoneShell>
  )
}

export default function App() {
  return (
    <GameProvider>
      <Game />
    </GameProvider>
  )
}
