import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtTime } from '../../lib/utils'
import { byId } from '../registry'
import './LightsOut.css'

type Size = 3 | 4 | 5

/** Indices toggled by pressing `i`: itself plus orthogonal neighbours. */
function affected(i: number, n: number): number[] {
  const r = Math.floor(i / n)
  const c = i % n
  const out = [i]
  if (r > 0) out.push(i - n)
  if (r < n - 1) out.push(i + n)
  if (c > 0) out.push(i - 1)
  if (c < n - 1) out.push(i + 1)
  return out
}

function applyPress(board: boolean[], i: number, n: number): boolean[] {
  const next = [...board]
  for (const k of affected(i, n)) next[k] = !next[k]
  return next
}

/**
 * Builds a board by pressing random tiles on a solved grid. Every position
 * reachable this way is solvable by definition, so no puzzle is impossible.
 */
function generate(n: Size): boolean[] {
  // retry rather than recurse, so an unlucky streak can't blow the stack
  for (let attempt = 0; attempt < 20; attempt++) {
    let board = Array<boolean>(n * n).fill(false)
    for (let k = 0; k < n * n; k++) {
      if (Math.random() < 0.5) continue
      board = applyPress(board, Math.floor(Math.random() * n * n), n)
    }
    // never hand back an already-solved board
    if (board.some(Boolean)) return board
  }
  // fallback: one press always leaves a lit, solvable board
  return applyPress(Array<boolean>(n * n).fill(false), 0, n)
}

export default function LightsOut() {
  const meta = byId('lightsout')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [size, setSize] = useState<Size>(4)
  const [board, setBoard] = useState<boolean[]>(() => generate(4))
  const [moves, setMoves] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const [isBest, setIsBest] = useState(false)

  const reset = useCallback((n: Size = size) => {
    setBoard(generate(n))
    setMoves(0)
    setStartedAt(null)
    setElapsed(0)
    setDone(false)
    setIsBest(false)
  }, [size])

  useEffect(() => {
    if (startedAt === null || done) return
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200)
    return () => clearInterval(id)
  }, [startedAt, done])

  const press = (i: number) => {
    if (done) return
    if (startedAt === null) setStartedAt(Date.now())
    const next = applyPress(board, i, size)
    setBoard(next)
    setMoves((m) => m + 1)
    cue('flip', 'tap')

    if (next.every((v) => !v)) {
      setDone(true)
      setIsBest(store.submitScore(meta.id, moves + 1, true))
      sfx('win')
      navigator.vibrate?.([14, 50, 14, 50, 30])
    }
  }

  const lit = board.filter(Boolean).length

  return (
    <GameFrame
      game={meta}
      onRestart={() => reset()}
      hud={
        <StatRow>
          <Stat label="Moves" value={moves} accent />
          <Stat label="Lit" value={lit} />
          <Stat label="Time" value={fmtTime(elapsed)} />
          <Stat label="Best" value={best || '—'} />
        </StatRow>
      }
    >
      <div className="lo__sizes">
        {([3, 4, 5] as Size[]).map((n) => (
          <button
            key={n}
            className={`lo__size${n === size ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setSize(n)
              reset(n)
            }}
          >
            {n}×{n}
          </button>
        ))}
      </div>

      <div
        className="lo__grid"
        style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}
      >
        {board.map((on, i) => (
          <motion.button
            key={i}
            className={`lo__c${on ? ' is-on' : ''}`}
            onClick={() => press(i)}
            whileTap={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            aria-label={`Light ${i + 1}, ${on ? 'on' : 'off'}`}
          >
            <span className="lo__bulb" />
          </motion.button>
        ))}
      </div>

      <p className="lo__hint">Each tap flips the tile and its four neighbours</p>

      <ResultOverlay
        open={done}
        won
        isBest={isBest}
        headline="Lights out!"
        detail={`Cleared the ${size}×${size} board in ${moves} moves · ${fmtTime(elapsed)}`}
        onAgain={() => reset()}
      />
    </GameFrame>
  )
}
