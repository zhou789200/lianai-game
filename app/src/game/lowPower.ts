/**
 * 旧内核 / 低内存设备的轻量降级。
 *
 * 只关闭装饰性动画、毛玻璃和混合模式，不改布局与交互；
 * 旧 Android WebView（<=109）或 2GB 级设备会自动启用，
 * 也可以用 ?lowpower=1 / ?lowpower=0 强制开关，便于真机对比。
 */
const LOW_POWER_KEY = 'seabreeze-pet-cafe.low-power'

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
      const ua = navigator.userAgent
      const chromeMajor = Number(ua.match(/Chrome\/(\d+)/)?.[1] ?? 999)
      const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
      const cores = navigator.hardwareConcurrency ?? 8
      const android = /Android/i.test(ua)
      /**
       * Android 厂商浏览器 / 应用内 WebView 上报的 Chrome 版本并不可信：
       * ColorOS 浏览器会写 Chrome/115，实际仍使用旧合成器。
       * 这类环境统一走稳定绘制模式；桌面 Chrome / Edge 不受影响。
       */
      const vendorBrowser =
        /HeyTapBrowser|OppoBrowser|MiuiBrowser|HuaweiBrowser|VivoBrowser|UCBrowser|Quark|MQQBrowser|MicroMessenger|baiduboxapp|SogouMobileBrowser|LenovoBrowser/i.test(
          ua,
        )
      enabled =
        (android && (vendorBrowser || ua.includes('wv') || chromeMajor < 120)) ||
        memory <= 2 ||
        (chromeMajor < 110 && memory <= 4) ||
        cores <= 2
    }
  }

  root.classList.toggle('low-power', enabled)
  root.dataset.lowPower = enabled ? '1' : '0'
  return enabled
}
