import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum } from '../../lib/utils'
import { byId } from '../registry'
import { optionsFor, randomFlags, type Flag } from './flags'
import './FlagHunt.css'

const ROUND = 10
const PER_QUESTION = 8000

export default function FlagHunt() {
  const meta = byId('flags')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [deck, setDeck] = useState<Flag[]>(() => randomFlags(ROUND))
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [chosen, setChosen] = useState<string | null>(null)
  const [left, setLeft] = useState(PER_QUESTION)
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle')
  const [isBest, setIsBest] = useState(false)
  const askedAt = useRef(0)

  const flag = deck[index]
  const options = useMemo(() => (flag ? optionsFor(flag) : []), [flag])

  const reset = useCallback(() => {
    setDeck(randomFlags(ROUND))
    setIndex(0)
    setScore(0)
    setCorrect(0)
    setChosen(null)
    setLeft(PER_QUESTION)
    setIsBest(false)
    setPhase('idle')
  }, [])

  const start = () => {
    reset()
    askedAt.current = performance.now()
    setPhase('run')
    cue('levelup', 'heavy')
  }

  /** Moves to the next flag, or ends the round. */
  const advance = useCallback(() => {
    setChosen(null)
    if (index + 1 >= ROUND) {
      setPhase('done')
      return
    }
    setIndex((i) => i + 1)
    setLeft(PER_QUESTION)
    askedAt.current = performance.now()
  }, [index])

  const answer = useCallback(
    (country: string | null) => {
      if (chosen !== null || phase !== 'run') return
      setChosen(country ?? '')

      if (country === flag.country) {
        // faster answers earn a bigger bonus
        const elapsed = performance.now() - askedAt.current
        const bonus = Math.max(0, Math.round((PER_QUESTION - elapsed) / 100))
        setScore((s) => s + 100 + bonus)
        setCorrect((c) => c + 1)
        cue('match', 'success', 3)
      } else {
        cue('lose', 'error')
      }
      setTimeout(advance, 950)
    },
    [chosen, phase, flag, advance],
  )

  /* per-question countdown */
  useEffect(() => {
    if (phase !== 'run' || chosen !== null) return
    let raf = 0
    const tick = () => {
      const remaining = PER_QUESTION - (performance.now() - askedAt.current)
      if (remaining <= 0) {
        setLeft(0)
        answer(null)
        return
      }
      setLeft(remaining)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, chosen, index, answer])

  useEffect(() => {
    if (phase !== 'done') return
    setIsBest(store.submitScore(meta.id, score))
    sfx('win')
    navigator.vibrate?.([16, 50, 16])
  }, [phase, score, meta.id])

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Flag" value={`${Math.min(index + 1, ROUND)}/${ROUND}`} />
          <Stat label="Right" value={correct} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="fh">
        <div className="fh__bar">
          <motion.span
            className="fh__barfill"
            style={{ width: `${(left / PER_QUESTION) * 100}%` }}
            animate={{
              background:
                left < 2500
                  ? 'linear-gradient(90deg,#f43f5e,#fb7185)'
                  : 'linear-gradient(90deg,#0ea5e9,#22c55e)',
            }}
          />
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            className="fh__flag"
            initial={{ opacity: 0, scale: 0.9, rotateY: -18 }}
            animate={{ opacity: 1, scale: 1, rotateY: 0 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            dangerouslySetInnerHTML={{ __html: flag?.svg ?? '' }}
          />
        </AnimatePresence>

        <div className="fh__options">
          {options.map((c) => {
            const state =
              chosen === null
                ? ''
                : c === flag.country
                  ? ' is-right'
                  : c === chosen
                    ? ' is-wrong'
                    : ' is-dim'
            return (
              <motion.button
                key={c}
                className={`fh__opt${state}`}
                onClick={() => answer(c)}
                disabled={chosen !== null}
                whileTap={{ scale: chosen === null ? 0.96 : 1 }}
              >
                {c}
              </motion.button>
            )
          })}
        </div>

        {phase === 'idle' && (
          <motion.button
            className="fh__veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={start}
          >
            <strong>Tap to start</strong>
            <span>Ten flags · answer fast for bonus points</span>
          </motion.button>
        )}
      </div>

      <p className="fh__note">Flags are simplified illustrations, not exact reproductions.</p>

      <ResultOverlay
        open={phase === 'done'}
        won={correct >= 6}
        isBest={isBest}
        headline={`${correct}/${ROUND} correct`}
        detail={`${fmtNum(score)} points. ${
          correct === ROUND ? 'A perfect round.' : 'Speed adds a bonus on every right answer.'
        }`}
        onAgain={start}
      />
    </GameFrame>
  )
}
