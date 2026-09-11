import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { haptic, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { randInt } from '../../lib/utils'
import { byId } from '../registry'
import './Echo.css'

const PADS = [
  { id: 0, color: '#22d3ee', dim: 'rgba(34,211,238,0.16)' },
  { id: 1, color: '#a3e635', dim: 'rgba(163,230,53,0.16)' },
  { id: 2, color: '#f472b6', dim: 'rgba(244,114,182,0.16)' },
  { id: 3, color: '#fbbf24', dim: 'rgba(251,191,36,0.16)' },
]

type Phase = 'idle' | 'showing' | 'input' | 'over'

export default function Echo() {
  const meta = byId('simon')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [seq, setSeq] = useState<number[]>([])
  const [phase, setPhase] = useState<Phase>('idle')
  const [lit, setLit] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [isBest, setIsBest] = useState(false)
  const timers = useRef<number[]>([])

  const clearTimers = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }
  useEffect(() => clearTimers, [])

  /** Plays the sequence back, then hands control to the player. */
  const playback = useCallback((s: number[]) => {
    clearTimers()
    setPhase('showing')
    setLit(null)
    // speeds up as the sequence grows, floored so it stays playable
    const gap = Math.max(280, 620 - s.length * 26)

    s.forEach((pad, i) => {
      timers.current.push(
        window.setTimeout(() => {
          setLit(pad)
          tonePad(pad)
          haptic('soft')
          timers.current.push(window.setTimeout(() => setLit(null), gap * 0.55))
        }, i * gap + 420),
      )
    })

    timers.current.push(
      window.setTimeout(
        () => {
          setPhase('input')
          setStep(0)
        },
        s.length * gap + 420,
      ),
    )
  }, [])

  const nextRound = useCallback(
    (current: number[]) => {
      const s = [...current, randInt(0, 3)]
      setSeq(s)
      playback(s)
    },
    [playback],
  )

  const reset = useCallback(() => {
    clearTimers()
    setSeq([])
    setStep(0)
    setLit(null)
    setIsBest(false)
    setPhase('idle')
  }, [])

  const press = (pad: number) => {
    if (phase !== 'input') {
      if (phase === 'idle') nextRound([])
      return
    }

    setLit(pad)
    tonePad(pad)
    haptic('tap')
    window.setTimeout(() => setLit(null), 160)

    if (seq[step] !== pad) {
      clearTimers()
      setPhase('over')
      setIsBest(store.submitScore(meta.id, seq.length - 1))
      sfx('lose')
      navigator.vibrate?.([40, 60, 40])
      return
    }

    const next = step + 1
    if (next === seq.length) {
      sfx('levelup')
      haptic('success')
      timers.current.push(window.setTimeout(() => nextRound(seq), 620))
    } else {
      setStep(next)
    }
  }

  const label: Record<Phase, string> = {
    idle: 'Tap any pad to begin',
    showing: 'Watch closely…',
    input: `Your turn — ${step}/${seq.length}`,
    over: 'Sequence broken',
  }

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Round" value={seq.length || '—'} accent />
          <Stat label="Progress" value={phase === 'input' ? `${step}/${seq.length}` : '—'} />
          <Stat label="Best" value={best || '—'} />
        </StatRow>
      }
    >
      <div className={`echo__pads${phase === 'showing' ? ' is-locked' : ''}`}>
        {PADS.map((p) => (
          <motion.button
            key={p.id}
            className="echo__pad"
            aria-label={`Pad ${p.id + 1}`}
            onPointerDown={() => press(p.id)}
            animate={{
              background: lit === p.id ? p.color : p.dim,
              borderColor: lit === p.id ? p.color : 'var(--stroke)',
              scale: lit === p.id ? 1.035 : 1,
              boxShadow: lit === p.id ? `0 0 60px -6px ${p.color}` : '0 0 0 rgba(0,0,0,0)',
            }}
            transition={{ duration: 0.13 }}
            whileTap={{ scale: 0.96 }}
          />
        ))}

        <motion.div className="echo__hub" animate={{ scale: phase === 'showing' ? 0.94 : 1 }}>
          <strong className="mono">{seq.length || '–'}</strong>
          <span>{phase === 'showing' ? 'watch' : phase === 'input' ? 'repeat' : 'round'}</span>
        </motion.div>
      </div>

      <p className="echo__label">{label[phase]}</p>

      <ResultOverlay
        open={phase === 'over'}
        won={false}
        isBest={isBest}
        headline={`${seq.length - 1} step${seq.length - 1 === 1 ? '' : 's'} recalled`}
        detail={
          seq.length - 1 >= 10
            ? 'That is a seriously long chain — well done.'
            : 'Each round adds one more step. Try again?'
        }
        onAgain={reset}
      />
    </GameFrame>
  )
}

/** Pad-specific tone so the sequence is audible as well as visual. */
function tonePad(pad: number) {
  sfx('match', pad)
}
