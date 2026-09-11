import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, randInt } from '../../lib/utils'
import { byId } from '../registry'
import './OddShade.css'

const LIVES = 3
const TIME_PER_LEVEL = 6000

type Round = { size: number; odd: number; base: string; oddColor: string }

/**
 * Grid grows 2x2 -> 3x3 -> ... and the colour difference shrinks, so
 * difficulty climbs on two axes at once.
 */
function makeRound(level: number): Round {
  const size = Math.min(2 + Math.floor(level / 2), 6)
  const hue = randInt(0, 359)
  const sat = randInt(58, 78)
  const light = randInt(46, 62)
  // difference narrows with level but never below a perceivable floor
  const delta = Math.max(4.5, 22 - level * 1.35)
  const dir = Math.random() > 0.5 ? 1 : -1
  return {
    size,
    odd: randInt(0, size * size - 1),
    base: `hsl(${hue} ${sat}% ${light}%)`,
    oddColor: `hsl(${hue} ${sat}% ${Math.min(92, Math.max(12, light + delta * dir))}%)`,
  }
}

export default function OddShade() {
  const meta = byId('shades')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [level, setLevel] = useState(1)
  const [round, setRound] = useState<Round>(() => makeRound(1))
  const [lives, setLives] = useState(LIVES)
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(TIME_PER_LEVEL)
  const [phase, setPhase] = useState<'idle' | 'run' | 'over'>('idle')
  const [wrong, setWrong] = useState<number | null>(null)
  const [isBest, setIsBest] = useState(false)
  const askedAt = useRef(0)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const reset = useCallback(() => {
    setLevel(1)
    setRound(makeRound(1))
    setLives(LIVES)
    setScore(0)
    setLeft(TIME_PER_LEVEL)
    setWrong(null)
    setIsBest(false)
    setPhase('idle')
  }, [])

  const start = () => {
    reset()
    askedAt.current = performance.now()
    setPhase('run')
    cue('levelup', 'heavy')
  }

  const nextLevel = useCallback((lv: number) => {
    setLevel(lv)
    setRound(makeRound(lv))
    setLeft(TIME_PER_LEVEL)
    setWrong(null)
    askedAt.current = performance.now()
  }, [])

  /** Losing a life; ends the game at zero. */
  const loseLife = useCallback(() => {
    const next = lives - 1
    setLives(next)
    if (next <= 0) setPhase('over')
    else nextLevel(level)
  }, [lives, level, nextLevel])

  const tap = (i: number) => {
    if (phase !== 'run' || wrong !== null) return

    if (i === round.odd) {
      const elapsed = performance.now() - askedAt.current
      const bonus = Math.max(0, Math.round((TIME_PER_LEVEL - elapsed) / 60))
      setScore((s) => s + level * 20 + bonus)
      cue('match', 'success', Math.min(level, 4))
      nextLevel(level + 1)
    } else {
      setWrong(i)
      cue('lose', 'error')
      setTimeout(loseLife, 520)
    }
  }

  /* countdown; running out costs a life */
  useEffect(() => {
    if (phase !== 'run' || wrong !== null) return
    let raf = 0
    const tick = () => {
      const remaining = TIME_PER_LEVEL - (performance.now() - askedAt.current)
      if (remaining <= 0) {
        setLeft(0)
        sfx('lose')
        loseLife()
        return
      }
      setLeft(remaining)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, wrong, level, loseLife])

  useEffect(() => {
    if (phase !== 'over') return
    setIsBest(store.submitScore(meta.id, score))
    sfx('lose')
    navigator.vibrate?.([30, 60, 30])
  }, [phase, score, meta.id])

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Level" value={level} />
          <Stat label="Lives" value={'●'.repeat(Math.max(0, lives)) || '—'} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="os">
        <div className="os__bar">
          <motion.span
            className="os__barfill"
            style={{ width: `${(left / TIME_PER_LEVEL) * 100}%` }}
            animate={{
              background:
                left < 2000
                  ? 'linear-gradient(90deg,#f43f5e,#fb7185)'
                  : 'linear-gradient(90deg,#ec4899,#f97316)',
            }}
          />
        </div>

        <div
          className="os__grid"
          style={{ gridTemplateColumns: `repeat(${round.size}, 1fr)` }}
        >
          {Array.from({ length: round.size * round.size }, (_, i) => (
            <motion.button
              key={`${level}-${i}`}
              className={`os__c${wrong === i ? ' is-wrong' : ''}`}
              style={{ background: i === round.odd ? round.oddColor : round.base }}
              onClick={() => tap(i)}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: Math.min(i * 0.012, 0.2) }}
              whileTap={{ scale: 0.93 }}
              aria-label={`Tile ${i + 1}`}
            />
          ))}
        </div>

        {phase === 'idle' && (
          <motion.button
            className="os__veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={start}
          >
            <strong>Tap to start</strong>
            <span>Find the one tile that is a different shade</span>
          </motion.button>
        )}
      </div>

      <ResultOverlay
        open={phase === 'over'}
        won={false}
        isBest={isBest}
        headline={`Level ${level} reached`}
        detail={`${fmtNum(score)} points. The grid grows and the difference narrows each level.`}
        onAgain={start}
      />
    </GameFrame>
  )
}
