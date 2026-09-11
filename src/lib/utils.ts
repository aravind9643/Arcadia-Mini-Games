export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export const range = (n: number) => Array.from({ length: n }, (_, i) => i)

export const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

export const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)]

export function shuffle<T>(arr: readonly T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** 1234 -> "1,234" */
export const fmtNum = (n: number) => n.toLocaleString('en-US')

/** ms -> "1:04.2" or "4.21s" for short spans */
export function fmtTime(ms: number, short = false) {
  if (short && ms < 60_000) return `${(ms / 1000).toFixed(2)}s`
  const total = Math.max(0, ms)
  const m = Math.floor(total / 60_000)
  const s = Math.floor((total % 60_000) / 1000)
  const d = Math.floor((total % 1000) / 100)
  return `${m}:${String(s).padStart(2, '0')}.${d}`
}

export function fmtAgo(ts: number) {
  const diff = Date.now() - ts
  const mins = Math.round(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.round(hrs / 24)
  return days === 1 ? 'yesterday' : `${days}d ago`
}

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(' ')
