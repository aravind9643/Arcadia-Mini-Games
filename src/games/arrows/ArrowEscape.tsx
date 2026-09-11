import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useMemo, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Button, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import {
  ARROW_COLORS,
  DELTA,
  exitRay,
  generate,
  hintFor,
  isFree,
  type Arrow,
  type Difficulty,
  type Level,
} from './logic'
import './ArrowEscape.css'

const LIVES = 3
const LEVELS: Difficulty[] = ['Easy', 'Medium', 'Hard']

/** Rotation applied to the arrow glyph, which is drawn pointing up. */
const ROT: Record<Arrow['dir'], number> = { up: 0, right: 90, down: 180, left: 270 }

export default function ArrowEscape() {
  const meta = byId('arrows')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [difficulty, setDifficulty] = useState<Difficulty>('Easy')
  const [level, setLevel] = useState<Level>(() => generate('Easy'))
  const [alive, setAlive] = useState<Set<number>>(
    () => new Set(level.arrows.map((a) => a.id)),
  )
  const [lives, setLives] = useState(LIVES)
  const [cleared, setCleared] = useState(0)
  const [bumped, setBumped] = useState<number | null>(null)
  const [hint, setHint] = useState<number | null>(null)
  const [escaping, setEscaping] = useState<Arrow[]>([])
  const [phase, setPhase] = useState<'play' | 'won' | 'lost'>('play')
  const [isBest, setIsBest] = useState(false)

  /** Builds a fresh board at the given difficulty. */
  const newBoard = useCallback((d: Difficulty) => {
    const lvl = generate(d)
    setLevel(lvl)
    setAlive(new Set(lvl.arrows.map((a) => a.id)))
    setLives(LIVES)
    setBumped(null)
    setHint(null)
    setEscaping([])
    setPhase('play')
  }, [])

  const restart = useCallback(() => {
    setCleared(0)
    setIsBest(false)
    newBoard(difficulty)
  }, [difficulty, newBoard])

  const tap = (arrow: Arrow) => {
    if (phase !== 'play' || !alive.has(arrow.id)) return
    setHint(null)

    if (isFree(level, alive, arrow)) {
      // slide it off the board, then drop it from the live set
      setEscaping((e) => [...e, arrow])
      setTimeout(() => setEscaping((e) => e.filter((x) => x.id !== arrow.id)), 420)

      const next = new Set(alive)
      next.delete(arrow.id)
      setAlive(next)
      cue('whoosh', 'soft')

      if (next.size === 0) {
        const done = cleared + 1
        setCleared(done)
        setIsBest(store.submitScore(meta.id, done))
        setPhase('won')
        sfx('win')
        navigator.vibrate?.([14, 50, 14])
      }
      return
    }

    // blocked: bump it and take a life
    setBumped(arrow.id)
    setTimeout(() => setBumped(null), 380)
    cue('lose', 'error')

    const left = lives - 1
    setLives(left)
    if (left <= 0) {
      setPhase('lost')
      setIsBest(store.submitScore(meta.id, cleared))
      sfx('lose')
      navigator.vibrate?.([30, 60, 30])
    }
  }

  const showHint = () => {
    const a = hintFor(level, alive)
    if (!a) return
    setHint(a.id)
    cue('tick')
    setTimeout(() => setHint(null), 1800)
  }

  const nextLevel = () => {
    newBoard(difficulty)
    cue('levelup', 'heavy')
  }

  /* keep the board sized to the viewport without overflowing */
  const cellPct = 100 / level.size

  const visible = useMemo(
    () => level.arrows.filter((a) => alive.has(a.id)),
    [level, alive],
  )

  return (
    <GameFrame
      game={meta}
      onRestart={restart}
      hud={
        <StatRow>
          <Stat label="Level" value={cleared + 1} accent />
          <Stat label="Left" value={alive.size} />
          <Stat label="Lives" value={'●'.repeat(Math.max(0, lives)) || '—'} />
          <Stat label="Best" value={best} />
        </StatRow>
      }
    >
      <div className="ae__levels">
        {LEVELS.map((d) => (
          <button
            key={d}
            className={`ae__lvl${d === difficulty ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setDifficulty(d)
              setCleared(0)
              newBoard(d)
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div
        className="ae__board"
        style={{ ['--n' as string]: level.size }}
      >
        {/* grid backdrop */}
        {Array.from({ length: level.size * level.size }, (_, i) => (
          <span key={i} className="ae__cell" />
        ))}

        <AnimatePresence>
          {visible.map((a) => {
            const head = a.cells[0]
            const free = isFree(level, alive, a)
            return (
              <motion.button
                key={a.id}
                className={[
                  'ae__arrow',
                  bumped === a.id && 'is-bumped',
                  hint === a.id && 'is-hint',
                  free && 'is-free',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{
                  left: `${head.x * cellPct}%`,
                  top: `${head.y * cellPct}%`,
                  width: `${cellPct}%`,
                  height: `${cellPct}%`,
                  color: ARROW_COLORS[a.colorIndex],
                }}
                onClick={() => tap(a)}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{
                  // fly off in the pointed direction
                  x: `${DELTA[a.dir].x * 320}%`,
                  y: `${DELTA[a.dir].y * 320}%`,
                  opacity: 0,
                  transition: { duration: 0.34, ease: [0.4, 0, 0.6, 1] },
                }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                aria-label={`${a.dir} arrow${free ? ', path clear' : ', blocked'}`}
              >
                {/* body segments trail behind the head */}
                {a.cells.slice(1).map((c, i) => (
                  <span
                    key={i}
                    className="ae__body"
                    style={{
                      left: `${(c.x - head.x) * 100}%`,
                      top: `${(c.y - head.y) * 100}%`,
                    }}
                  />
                ))}
                <span className="ae__head" style={{ rotate: `${ROT[a.dir]}deg` }}>
                  <svg viewBox="0 0 24 24" aria-hidden>
                    <path
                      d="M12 4.5 19 13h-4v6.5H9V13H5Z"
                      fill="currentColor"
                      stroke="rgba(0,0,0,0.35)"
                      strokeWidth="1"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </motion.button>
            )
          })}
        </AnimatePresence>

        {/* the escaping arrow's path, drawn briefly so the move reads clearly */}
        <AnimatePresence>
          {escaping.map((a) => (
            <motion.span
              key={`trail-${a.id}`}
              className="ae__trail"
              style={trailStyle(a, level.size, cellPct)}
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.42 }}
            />
          ))}
        </AnimatePresence>
      </div>

      <div className="ae__tools">
        <Button size="sm" variant="surface" onClick={showHint} disabled={phase !== 'play'}>
          Hint
        </Button>
        <Button size="sm" variant="surface" onClick={() => newBoard(difficulty)}>
          New board
        </Button>
      </div>

      <p className="ae__hint">Tap an arrow whose route to the edge is clear</p>

      <ResultOverlay
        open={phase === 'won'}
        won
        isBest={isBest}
        headline="Board cleared!"
        detail={`${difficulty} level ${cleared} solved with ${lives} ${lives === 1 ? 'life' : 'lives'} left.`}
        againLabel="Next board"
        onAgain={nextLevel}
      />

      <ResultOverlay
        open={phase === 'lost'}
        won={false}
        isBest={isBest}
        headline="Out of lives"
        detail={`${cleared} board${cleared === 1 ? '' : 's'} cleared. Trace each arrow's path to the edge before tapping.`}
        onAgain={restart}
      />
    </GameFrame>
  )
}

/** Positions the fading trail along the arrow's exit ray. */
function trailStyle(a: Arrow, size: number, cellPct: number) {
  const ray = exitRay(a, size)
  if (ray.length === 0) return { display: 'none' }
  const xs = ray.map((c) => c.x)
  const ys = ray.map((c) => c.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)
  const w = Math.max(...xs) - minX + 1
  const h = Math.max(...ys) - minY + 1
  return {
    left: `${minX * cellPct}%`,
    top: `${minY * cellPct}%`,
    width: `${w * cellPct}%`,
    height: `${h * cellPct}%`,
    background: ARROW_COLORS[a.colorIndex],
  }
}
