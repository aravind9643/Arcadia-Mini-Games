import { store } from './storage'

/* ---------------- haptics ---------------- */

type Pattern = 'tap' | 'soft' | 'success' | 'error' | 'heavy'

const patterns: Record<Pattern, number | number[]> = {
  tap: 8,
  soft: 4,
  success: [12, 40, 22],
  error: [30, 50, 30],
  heavy: 26,
}

export function haptic(kind: Pattern = 'tap') {
  if (!store.get().settings.haptics) return
  navigator.vibrate?.(patterns[kind])
}

/* ---------------- sound ---------------- */
/* Tiny WebAudio synth — no asset downloads, so it works fully offline. */

let ctx: AudioContext | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext ?? (window as any).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** Unlock audio on the first user gesture (iOS requirement). */
export function primeAudio() {
  audio()
}

type ToneOpts = {
  freq: number
  dur?: number
  type?: OscillatorType
  gain?: number
  slideTo?: number
  delay?: number
}

function tone({ freq, dur = 0.12, type = 'sine', gain = 0.16, slideTo, delay = 0 }: ToneOpts) {
  const ac = audio()
  if (!ac) return
  const t0 = ac.currentTime + delay
  const osc = ac.createOscillator()
  const amp = ac.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t0)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur)

  // short attack + exponential decay keeps clicks out of the envelope
  amp.gain.setValueAtTime(0.0001, t0)
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

  osc.connect(amp).connect(ac.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

const MAJOR = [523.25, 587.33, 659.25, 783.99, 880]

export type SoundName =
  | 'tap'
  | 'flip'
  | 'match'
  | 'win'
  | 'lose'
  | 'pop'
  | 'tick'
  | 'whoosh'
  | 'merge'
  | 'levelup'

export function sfx(name: SoundName, step = 0) {
  if (!store.get().settings.sound) return
  switch (name) {
    case 'tap':
      return tone({ freq: 420, dur: 0.07, type: 'triangle', gain: 0.1 })
    case 'flip':
      return tone({ freq: 330, dur: 0.09, type: 'square', gain: 0.06, slideTo: 520 })
    case 'match':
      return tone({
        freq: MAJOR[Math.min(step, MAJOR.length - 1)],
        dur: 0.2,
        type: 'triangle',
        gain: 0.14,
      })
    case 'merge':
      return tone({ freq: 300 + step * 60, dur: 0.14, type: 'sine', gain: 0.14, slideTo: 600 + step * 90 })
    case 'pop':
      return tone({ freq: 760, dur: 0.08, type: 'sine', gain: 0.13, slideTo: 300 })
    case 'tick':
      return tone({ freq: 1180, dur: 0.035, type: 'square', gain: 0.05 })
    case 'whoosh':
      return tone({ freq: 180, dur: 0.22, type: 'sawtooth', gain: 0.05, slideTo: 60 })
    case 'levelup':
      return [0, 1, 2].forEach((i) =>
        tone({ freq: MAJOR[i + 1], dur: 0.16, type: 'triangle', gain: 0.12, delay: i * 0.07 }),
      )
    case 'win':
      return [0, 2, 4, 4].forEach((n, i) =>
        tone({ freq: MAJOR[n], dur: 0.26, type: 'triangle', gain: 0.13, delay: i * 0.1 }),
      )
    case 'lose':
      return [440, 330, 233].forEach((f, i) =>
        tone({ freq: f, dur: 0.26, type: 'sawtooth', gain: 0.09, delay: i * 0.11 }),
      )
  }
}

/** Sound + haptic in one call, for the common UI cases. */
export function cue(name: SoundName, kind: Parameters<typeof haptic>[0] = 'tap', step = 0) {
  sfx(name, step)
  haptic(kind)
}
