import { useCallback, useEffect, useRef, useState } from 'react'

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}

export function useTypewriter(text: string | null, pageKey: string) {
  const reduced = usePrefersReducedMotion()
  const [shown, setShown] = useState(0)
  const timerRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timerRef.current === null) return
    window.clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => {
    stop()
    const length = text?.length ?? 0
    if (reduced || !text) {
      setShown(length)
      return
    }

    setShown(0)
    let current = 0
    timerRef.current = window.setInterval(() => {
      current += 1
      setShown(current)
      if (current >= length) stop()
    }, 42)
    return stop
  }, [pageKey, reduced, stop, text])

  const complete = useCallback(() => {
    stop()
    setShown(text?.length ?? 0)
  }, [stop, text])

  return {
    visible: text ? text.slice(0, shown) : '',
    done: !text || shown >= text.length,
    complete,
  }
}
