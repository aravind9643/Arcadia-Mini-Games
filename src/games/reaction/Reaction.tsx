import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { randInt } from '../../lib/utils'
import { byId } from '../registry'
import './Reaction.css'

const ROUNDS = 5

type Phase = 'idle' | 'waiting' | 'go' | 'scored' | 'early'

export default function Reaction() {
  const meta = byId('reaction')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [phase, setPhase] = useState<Phase>('idle')
  const [times, setTimes] = useState<number[]>([])
  const [last, setLast] = useState<number | null>(null)
  const [done, setDone] = useState(false)
  const [isBest, setIsBest] = useState(false)

  const goAt = useRef(0)
  const timer = useRef<number | undefined>(undefined)

  const clear = () => {
    window.clearTimeout(timer.current)
  }
  useEffect(() => clear, [])

  const arm = useCallback(() => {
    setPhase('waiting')
    clear()
    // unpredictable delay so the player can't learn the rhythm
    timer.current = window.setTimeout(() => {
      goAt.current = performance.now()
      setPhase('go')
      sfx('pop')
      navigator.vibrate?.(14)
    }, randInt(1100, 3400))
  }, [])

  const reset = useCallback(() => {
    clear()
    setTimes([])
    setLast(null)
    setDone(false)
    setIsBest(false)
    setPhase('idle')
  }, [])

  const tapPad = () => {
    if (phase === 'idle' || phase === 'scored' || phase === 'early') {
      cue('tap')
      arm()
      return
    }

    if (phase === 'waiting') {
      // jumped the gun — round is void
      clear()
      setPhase('early')
      cue('lose', 'error')
      return
    }

    if (phase === 'go') {
      const ms = Math.round(performance.now() - goAt.current)
      const next = [...times, ms]
      setLast(ms)
      setTimes(next)
      cue('match', 'success', Math.min(next.length - 1, 4))

      if (next.length >= ROUNDS) {
        const avg = Math.round(next.reduce((a, b) => a + b, 0) / next.length)
        setIsBest(store.submitScore(meta.id, avg, true))
        setDone(true)
        sfx('win')
      } else {
        setPhase('scored')
      }
    }
  }

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0
  const fastest = times.length ? Math.min(...times) : 0

  const copy: Record<Phase, { title: string; sub: string }> = {
    idle: { title: 'Tap to start', sub: `${ROUNDS} rounds — wait for green` },
    waiting: { title: 'Wait…', sub: 'Tap the moment it turns green' },
    go: { title: 'TAP!', sub: 'Now!' },
    scored: { title: `${last} ms`, sub: `Round ${times.length} of ${ROUNDS} — tap to continue` },
    early: { title: 'Too early', sub: 'Tap to try that round again' },
  }

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Round" value={`${Math.min(times.length + (done ? 0 : 1), ROUNDS)}/${ROUNDS}`} accent />
          <Stat label="Last" value={last ? `${last}ms` : '—'} />
          <Stat label="Average" value={avg ? `${avg}ms` : '—'} />
          <Stat label="Best avg" value={best ? `${best}ms` : '—'} />
        </StatRow>
      }
    >
      <motion.button
        className={`rx__pad rx__pad--${phase}`}
        onPointerDown={tapPad}
        whileTap={{ scale: 0.98 }}
        aria-label={copy[phase].title}
      >
        <AnimatePresence mode="wait">
          <motion.span
            key={phase + last}
            className="rx__inner"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.16 }}
          >
            <strong>{copy[phase].title}</strong>
            <span>{copy[phase].sub}</span>
          </motion.span>
        </AnimatePresence>

        {phase === 'go' && (
          <motion.span
            className="rx__ripple"
            initial={{ scale: 0.2, opacity: 0.8 }}
            animate={{ scale: 2.4, opacity: 0 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: 'easeOut' }}
          />
        )}
      </motion.button>

      <div className="rx__dots" aria-hidden>
        {Array.from({ length: ROUNDS }, (_, i) => (
          <motion.span
            key={i}
            className={`rx__dot${times[i] !== undefined ? ' is-done' : ''}`}
            animate={{ scale: times[i] !== undefined ? [1.5, 1] : 1 }}
          >
            {times[i] !== undefined && <span className="mono">{times[i]}</span>}
          </motion.span>
        ))}
      </div>

      <ResultOverlay
        open={done}
        won
        isBest={isBest}
        headline={verdict(avg)}
        detail={
          <>
            Average <strong style={{ color: 'var(--text)' }}>{avg} ms</strong> over {ROUNDS} rounds
            <br />
            Fastest single tap: {fastest} ms
          </>
        }
        onAgain={reset}
      />
    </GameFrame>
  )
}

function verdict(avg: number) {
  if (avg < 200) return 'Lightning reflexes'
  if (avg < 260) return 'Very sharp'
  if (avg < 330) return 'Solid reactions'
  if (avg < 420) return 'Not bad at all'
  return 'Room to improve'
}
