import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Button, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtTime } from '../../lib/utils'
import { byId } from '../registry'
import './Minefield.css'

type Level = { name: string; cols: number; rows: number; mines: number }

const LEVELS: Level[] = [
  { name: 'Easy', cols: 8, rows: 10, mines: 10 },
  { name: 'Medium', cols: 9, rows: 12, mines: 18 },
  { name: 'Hard', cols: 10, rows: 14, mines: 30 },
]

type Cell = {
  mine: boolean
  near: number
  open: boolean
  flag: boolean
}

const NUM_COLORS = [
  '',
  '#60a5fa',
  '#34d399',
  '#fbbf24',
  '#fb923c',
  '#f87171',
  '#e879f9',
  '#a78bfa',
  '#f472b6',
]

const makeGrid = (l: Level): Cell[] =>
  Array.from({ length: l.cols * l.rows }, () => ({
    mine: false,
    near: 0,
    open: false,
    flag: false,
  }))

/** Mines are laid after the first tap so the opening move is always safe. */
function layMines(grid: Cell[], l: Level, safeIndex: number): Cell[] {
  const next = grid.map((c) => ({ ...c }))
  const safe = new Set([safeIndex, ...neighbors(safeIndex, l)])
  const candidates = next.map((_, i) => i).filter((i) => !safe.has(i))

  for (let placed = 0; placed < l.mines && candidates.length; placed++) {
    const pick = Math.floor(Math.random() * candidates.length)
    next[candidates[pick]].mine = true
    candidates.splice(pick, 1)
  }

  next.forEach((c, i) => {
    c.near = c.mine ? 0 : neighbors(i, l).filter((n) => next[n].mine).length
  })
  return next
}

function neighbors(i: number, l: Level): number[] {
  const x = i % l.cols
  const y = Math.floor(i / l.cols)
  const out: number[] = []
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= l.cols || ny >= l.rows) continue
      out.push(ny * l.cols + nx)
    }
  return out
}

/** Flood-fills empty regions so a single tap clears the obvious area. */
function openFrom(grid: Cell[], start: number, l: Level): Cell[] {
  const next = grid.map((c) => ({ ...c }))
  const stack = [start]
  const seen = new Set<number>()

  while (stack.length) {
    const i = stack.pop()!
    if (seen.has(i)) continue
    seen.add(i)
    const cell = next[i]
    if (cell.flag || cell.open) continue
    cell.open = true
    if (cell.near === 0 && !cell.mine) {
      neighbors(i, l).forEach((n) => {
        if (!next[n].open && !next[n].flag) stack.push(n)
      })
    }
  }
  return next
}

export default function Minefield() {
  const meta = byId('minesweeper')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [lvl, setLvl] = useState(0)
  const level = LEVELS[lvl]
  const [grid, setGrid] = useState(() => makeGrid(level))
  const [seeded, setSeeded] = useState(false)
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play')
  const [flagMode, setFlagMode] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [isBest, setIsBest] = useState(false)
  const press = useRef<number | undefined>(undefined)

  const reset = useCallback(
    (index = lvl) => {
      setGrid(makeGrid(LEVELS[index]))
      setSeeded(false)
      setState('play')
      setStartedAt(null)
      setElapsed(0)
      setIsBest(false)
      setFlagMode(false)
    },
    [lvl],
  )

  useEffect(() => {
    if (startedAt === null || state !== 'play') return
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100)
    return () => clearInterval(id)
  }, [startedAt, state])

  const flags = grid.filter((c) => c.flag).length
  const safeLeft = grid.filter((c) => !c.mine && !c.open).length

  // win check runs whenever the grid changes
  useEffect(() => {
    if (state !== 'play' || !seeded) return
    if (safeLeft > 0) return
    setState('won')
    setIsBest(store.submitScore(meta.id, elapsed, true))
    sfx('win')
    navigator.vibrate?.([14, 50, 14, 50, 30])
  }, [safeLeft, state, seeded, elapsed, meta.id])

  const reveal = (i: number) => {
    if (state !== 'play' || grid[i].open) return

    if (flagMode) return toggleFlag(i)
    if (grid[i].flag) return

    // first tap seeds the board around a guaranteed-safe opening
    let base = grid
    if (!seeded) {
      base = layMines(grid, level, i)
      setSeeded(true)
      setStartedAt(Date.now())
    }

    if (base[i].mine) {
      setGrid(base.map((c) => (c.mine ? { ...c, open: true } : c)))
      setState('lost')
      cue('lose', 'error')
      return
    }

    setGrid(openFrom(base, i, level))
    cue('pop', 'soft')
  }

  const toggleFlag = (i: number) => {
    if (state !== 'play' || grid[i].open) return
    setGrid((g) => g.map((c, k) => (k === i ? { ...c, flag: !c.flag } : c)))
    cue('tick', 'tap')
  }

  return (
    <GameFrame
      game={meta}
      onRestart={() => reset()}
      hud={
        <StatRow>
          <Stat label="Mines" value={`${flags}/${level.mines}`} accent />
          <Stat label="Left" value={safeLeft} />
          <Stat label="Time" value={fmtTime(elapsed)} />
          <Stat label="Best" value={best ? fmtTime(best, true) : '—'} />
        </StatRow>
      }
      actions={
        <Button
          size="sm"
          variant={flagMode ? 'primary' : 'surface'}
          onClick={() => setFlagMode((f) => !f)}
          aria-pressed={flagMode}
        >
          {flagMode ? '🚩 Flag' : '⛏ Dig'}
        </Button>
      }
    >
      <div className="mf__levels">
        {LEVELS.map((l, i) => (
          <button
            key={l.name}
            className={`mf__lvl${i === lvl ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setLvl(i)
              reset(i)
            }}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div
        className="mf__grid"
        style={{ gridTemplateColumns: `repeat(${level.cols}, minmax(0, 1fr))` }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {grid.map((c, i) => (
          <motion.button
            key={i}
            className={`mf__c${c.open ? ' is-open' : ''}${c.open && c.mine ? ' is-mine' : ''}`}
            onClick={() => reveal(i)}
            onContextMenu={(e) => {
              e.preventDefault()
              toggleFlag(i)
            }}
            onPointerDown={() => {
              // long-press flags, so phones don't need the mode switch
              press.current = window.setTimeout(() => {
                toggleFlag(i)
                press.current = undefined
              }, 380)
            }}
            onPointerUp={() => window.clearTimeout(press.current)}
            onPointerLeave={() => window.clearTimeout(press.current)}
            whileTap={{ scale: c.open ? 1 : 0.9 }}
            style={{ color: c.near ? NUM_COLORS[c.near] : undefined }}
            aria-label={c.open ? (c.mine ? 'Mine' : `${c.near} adjacent mines`) : 'Hidden tile'}
          >
            {c.open ? (c.mine ? '💥' : c.near || '') : c.flag ? '🚩' : ''}
          </motion.button>
        ))}
      </div>

      <p className="mf__hint">
        <span className="mf__hint--touch">Long-press to flag · or switch to 🚩 mode</span>
        <span className="mf__hint--keys">Right-click to flag a suspected mine</span>
      </p>

      <ResultOverlay
        open={state !== 'play'}
        won={state === 'won'}
        isBest={state === 'won' && isBest}
        headline={state === 'won' ? 'Field cleared!' : 'Boom.'}
        detail={
          state === 'won'
            ? `${level.name} cleared in ${fmtTime(elapsed)} with ${flags} flags placed.`
            : 'That tile was live. The first tap is always safe — try again.'
        }
        onAgain={() => reset()}
      />
    </GameFrame>
  )
}
