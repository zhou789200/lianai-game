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
  const [typing, setTyping] = useState<{
    pageKey: string
    text: string | null
    count: number
  }>({ pageKey: '', text: null, count: 0 })
  const timerRef = useRef<number | null>(null)
  const shown =
    reduced || !text
      ? text?.length ?? 0
      : typing.pageKey === pageKey && typing.text === text
        ? typing.count
        : 0

  const stop = useCallback(() => {
    if (timerRef.current === null) return
    window.clearInterval(timerRef.current)
    timerRef.current = null
  }, [])

  useEffect(() => {
    stop()
    const length = text?.length ?? 0
    if (reduced || !text) return

    let current = 0
    timerRef.current = window.setInterval(() => {
      current += 1
      setTyping({ pageKey, text, count: current })
      if (current >= length) stop()
    }, 42)
    return stop
  }, [pageKey, reduced, stop, text])

  const complete = useCallback(() => {
    stop()
    setTyping({ pageKey, text, count: text?.length ?? 0 })
  }, [pageKey, stop, text])

  return {
    visible: text ? text.slice(0, shown) : '',
    done: !text || shown >= text.length,
    complete,
  }
}
