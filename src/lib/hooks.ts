import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { store } from './storage'

/** Subscribes the component to the persisted store. */
export function useStore() {
  return useSyncExternalStore(store.subscribe, store.get, store.get)
}

export function useSettings() {
  return useStore().settings
}

/** Applies the theme to <html> and keeps the browser chrome in sync. */
export function useThemeEffect() {
  const { theme } = useSettings()
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    meta?.setAttribute('content', theme === 'light' ? '#f4f4fb' : '#07070d')
  }, [theme])
}

/** requestAnimationFrame loop with a stable callback and pause support. */
export function useRaf(cb: (dt: number, t: number) => void, active = true) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (!active) return
    let id = 0
    let last = performance.now()
    const tick = (now: number) => {
      // clamp so a backgrounded tab doesn't produce a giant dt
      const dt = Math.min(now - last, 50)
      last = now
      ref.current(dt, now)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
  }, [active])
}

/** setInterval that respects `active` and always calls the latest callback. */
export function useInterval(cb: () => void, ms: number | null) {
  const ref = useRef(cb)
  ref.current = cb
  useEffect(() => {
    if (ms === null) return
    const id = setInterval(() => ref.current(), ms)
    return () => clearInterval(id)
  }, [ms])
}

export function useMediaQuery(query: string) {
  const [match, setMatch] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches,
  )
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

export const useIsDesktop = () => useMediaQuery('(min-width: 860px)')

/** Measures an element, re-measuring on resize — used to size game boards. */
export function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect
      setSize({ width: r.width, height: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

/** Keyboard arrows / WASD as a direction callback (desktop parity). */
export type Dir = 'up' | 'down' | 'left' | 'right'

const KEYMAP: Record<string, Dir> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
  W: 'up',
  S: 'down',
  A: 'left',
  D: 'right',
}

export function useArrowKeys(onDir: (d: Dir) => void, active = true) {
  const ref = useRef(onDir)
  ref.current = onDir
  useEffect(() => {
    if (!active) return
    const on = (e: KeyboardEvent) => {
      const dir = KEYMAP[e.key]
      if (!dir) return
      e.preventDefault()
      ref.current(dir)
    }
    window.addEventListener('keydown', on, { passive: false })
    return () => window.removeEventListener('keydown', on)
  }, [active])
}

/** Swipe gestures on an element; returns props to spread. */
export function useSwipe(onDir: (d: Dir) => void, threshold = 28) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const ref = useRef(onDir)
  ref.current = onDir

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const s = start.current
      start.current = null
      if (!s) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return
      if (Math.abs(dx) > Math.abs(dy)) ref.current(dx > 0 ? 'right' : 'left')
      else ref.current(dy > 0 ? 'down' : 'up')
    },
    [threshold],
  )

  return { onPointerDown, onPointerUp, onPointerCancel: () => (start.current = null) }
}

/** Countdown timer in ms. Returns remaining time and controls. */
export function useCountdown(durationMs: number, running: boolean, onEnd?: () => void) {
  const [left, setLeft] = useState(durationMs)
  const endRef = useRef(onEnd)
  endRef.current = onEnd

  useEffect(() => setLeft(durationMs), [durationMs])

  useEffect(() => {
    if (!running) return
    const started = performance.now()
    const from = left
    let id = 0
    const tick = () => {
      const next = from - (performance.now() - started)
      if (next <= 0) {
        setLeft(0)
        endRef.current?.()
        return
      }
      setLeft(next)
      id = requestAnimationFrame(tick)
    }
    id = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(id)
    // `left` is intentionally read once per run/pause transition
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, durationMs])

  return [left, setLeft] as const
}
