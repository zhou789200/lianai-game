/**
 * 旧内核 / 低内存设备的轻量降级。
 *
 * 只关闭装饰性动画、毛玻璃和混合模式，不改布局与交互；
 * 旧 Android WebView（<=109）或 2GB 级设备会自动启用，
 * 也可以用 ?lowpower=1 / ?lowpower=0 强制开关，便于真机对比。
 */
const LOW_POWER_KEY = 'seabreeze-pet-cafe.low-power'

/** 参与判定的最小设备信息；拆成纯函数便于覆盖各机型回归。 */
export interface LowPowerSignals {
  userAgent: string
  /** navigator.deviceMemory，单位 GB；未知时传 undefined */
  deviceMemory?: number
  /** navigator.hardwareConcurrency */
  hardwareConcurrency?: number
}

/**
 * Android 厂商浏览器 / 应用内 WebView 上报的 Chrome 版本并不可信：
 * ColorOS 浏览器会写 Chrome/115，实际仍使用旧合成器。
 * 这类环境统一走稳定绘制模式；桌面 Chrome / Edge 不受影响。
 */
const VENDOR_BROWSER =
  /HeyTapBrowser|OppoBrowser|MiuiBrowser|HuaweiBrowser|VivoBrowser|UCBrowser|Quark|MQQBrowser|MicroMessenger|baiduboxapp|SogouMobileBrowser|LenovoBrowser/i

/** 低于该 Chrome 版本才视为旧内核；现代旗舰机常驻 110+，不能一刀切。 */
const OLD_CHROMIUM_MAJOR = 110
/** 低于该版本且内存/核心数偏紧的低端机才降级（旗舰机 110–119 不应被关动画）。 */
const LOW_END_CHROMIUM_MAJOR = 120

/**
 * 是否应该进入稳定绘制模式（纯函数）。
 *
 * 判定优先级：
 *  1. Android 厂商浏览器 / WebView：一律稳定模式（UA 版本不可信）；
 *  2. 低内存（<=2GB）或极少核心（<=2）：稳定模式；
 *  3. 旧内核（<110）且内存 <=4GB：稳定模式；
 *  4. 其余 Android 上 110–119 的现代设备保持完整效果。
 */
export function shouldUseLowPower({
  userAgent,
  deviceMemory = 8,
  hardwareConcurrency = 8,
}: LowPowerSignals): boolean {
  const android = /Android/i.test(userAgent)
  if (!android) {
    return deviceMemory <= 2 || hardwareConcurrency <= 2
  }

  const chromeMajor = Number(userAgent.match(/Chrome\/(\d+)/)?.[1] ?? 999)
  const vendorBrowser = VENDOR_BROWSER.test(userAgent)
  // 应用内 WebView 的 UA 带 "wv" 标记，但也可能由新版 Chromium 提供，
  // 用版本号区分：只有旧 WebView 才强制降级。
  const oldWebView = /\bwv\b|Version\/[\d.]+/.test(userAgent) && chromeMajor < LOW_END_CHROMIUM_MAJOR

  return (
    vendorBrowser ||
    oldWebView ||
    deviceMemory <= 2 ||
    hardwareConcurrency <= 2 ||
    (chromeMajor < OLD_CHROMIUM_MAJOR && deviceMemory <= 4)
  )
}

export function initLowPowerMode(): boolean {
  if (typeof window === 'undefined') return false
  const root = document.documentElement
  const forced = new URLSearchParams(window.location.search).get('lowpower')

  let enabled: boolean
  if (forced === '1') {
    enabled = true
  } else if (forced === '0') {
    enabled = false
  } else {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(LOW_POWER_KEY)
    } catch {
      /* 隐私模式不可用，走自动判断 */
    }
    if (stored === '1') {
      enabled = true
    } else if (stored === '0') {
      enabled = false
    } else {
      const navigatorExt = navigator as Navigator & { deviceMemory?: number }
      enabled = shouldUseLowPower({
        userAgent: navigator.userAgent,
        deviceMemory: navigatorExt.deviceMemory,
        hardwareConcurrency: navigator.hardwareConcurrency,
      })
    }
  }

  root.classList.toggle('low-power', enabled)
  root.dataset.lowPower = enabled ? '1' : '0'
  return enabled
}
