import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { IconButton, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore, useSwipe, type Dir } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum } from '../../lib/utils'
import { byId } from '../registry'
import {
  cellsOf,
  clearLines,
  collides,
  colorOf,
  COLORS,
  COLS,
  emptyGrid,
  hardDropTarget,
  INDEX,
  lineScore,
  merge,
  randomType,
  rotate,
  ROWS,
  speedFor,
  spawnPiece,
  type Grid,
  type Piece,
} from './logic'
import './BlockDrop.css'

export default function BlockDrop() {
  const meta = byId('tetris')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [grid, setGrid] = useState<Grid>(emptyGrid)
  const [piece, setPiece] = useState<Piece>(() => spawnPiece())
  const [nextType, setNextType] = useState(randomType)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [over, setOver] = useState(false)
  const [running, setRunning] = useState(true)
  const [isBest, setIsBest] = useState(false)
  const [flash, setFlash] = useState<number[]>([])

  const level = Math.floor(lines / 8)

  const reset = useCallback(() => {
    setGrid(emptyGrid())
    setPiece(spawnPiece())
    setNextType(randomType())
    setScore(0)
    setLines(0)
    setOver(false)
    setRunning(true)
    setIsBest(false)
    setFlash([])
  }, [])

  /** Locks the piece, clears lines and spawns the next one. */
  const lock = useCallback(
    (p: Piece) => {
      const merged = merge(grid, p)
      const { grid: cleaned, cleared } = clearLines(merged)

      if (cleared > 0) {
        // remember which rows vanished so they can flash before collapsing
        const rows = merged
          .map((row, i) => (row.every((c) => c !== 0) ? i : -1))
          .filter((i) => i >= 0)
        setFlash(rows)
        setTimeout(() => setFlash([]), 180)

        setScore((s) => s + lineScore(cleared, level))
        setLines((l) => l + cleared)
        sfx(cleared === 4 ? 'levelup' : 'match', Math.min(cleared, 4))
        navigator.vibrate?.(cleared === 4 ? [16, 40, 16] : 12)
      } else {
        cue('tick', 'soft')
      }

      const fresh = spawnPiece(nextType)
      // no room for the new piece means the stack reached the top
      if (collides(cleaned, fresh)) {
        setGrid(cleaned)
        setOver(true)
        setRunning(false)
        return
      }
      setGrid(cleaned)
      setPiece(fresh)
      setNextType(randomType())
    },
    [grid, nextType, level],
  )

  /** One gravity step; locks on contact. */
  const step = useCallback(() => {
    setPiece((p) => {
      const down = { ...p, y: p.y + 1 }
      if (!collides(grid, down)) return down
      lock(p)
      return p
    })
  }, [grid, lock])

  useEffect(() => {
    if (!running || over) return
    const id = setInterval(step, speedFor(level))
    return () => clearInterval(id)
  }, [running, over, level, step])

  /* ---------- controls ---------- */

  const move = useCallback(
    (dx: number) => {
      if (!running || over) return
      setPiece((p) => {
        const moved = { ...p, x: p.x + dx }
        if (collides(grid, moved)) return p
        cue('tap', 'soft')
        return moved
      })
    },
    [grid, running, over],
  )

  const spin = useCallback(() => {
    if (!running || over) return
    setPiece((p) => {
      const turned = rotate(p)
      if (!collides(grid, turned)) {
        cue('flip', 'soft')
        return turned
      }
      // nudge off the wall if the spin was blocked there
      for (const dx of [-1, 1, -2, 2]) {
        const kicked = { ...turned, x: turned.x + dx }
        if (!collides(grid, kicked)) {
          cue('flip', 'soft')
          return kicked
        }
      }
      return p
    })
  }, [grid, running, over])

  const drop = useCallback(() => {
    if (!running || over) return
    setPiece((p) => {
      const target = hardDropTarget(grid, p)
      setScore((s) => s + (target.y - p.y) * 2)
      sfx('whoosh')
      navigator.vibrate?.(14)
      lock(target)
      return target
    })
  }, [grid, running, over, lock])

  const softDrop = useCallback(() => {
    if (!running || over) return
    step()
    setScore((s) => s + 1)
  }, [running, over, step])

  const onDir = useCallback(
    (d: Dir) => {
      if (d === 'left') move(-1)
      else if (d === 'right') move(1)
      else if (d === 'up') spin()
      else drop()
    },
    [move, spin, drop],
  )

  const swipe = useSwipe(onDir, 24)

  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const k = e.key
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault()
      if (k === 'ArrowLeft' || k === 'a') move(-1)
      else if (k === 'ArrowRight' || k === 'd') move(1)
      else if (k === 'ArrowUp' || k === 'w') spin()
      else if (k === 'ArrowDown' || k === 's') softDrop()
      else if (k === ' ') drop()
      else if (k === 'p') setRunning((r) => !r)
    }
    window.addEventListener('keydown', on, { passive: false })
    return () => window.removeEventListener('keydown', on)
  }, [move, spin, drop, softDrop])

  useEffect(() => {
    if (!over) return
    setIsBest(store.submitScore(meta.id, score))
    sfx('lose')
    navigator.vibrate?.([30, 60, 30])
  }, [over, score, meta.id])

  /* ---------- render model ---------- */

  const view = useMemo(() => {
    const cells = grid.map((r) => [...r])
    if (!over) {
      // ghost first, so the live piece paints over it
      const ghost = hardDropTarget(grid, piece)
      for (const [x, y] of cellsOf(ghost)) {
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS && cells[y][x] === 0) cells[y][x] = -1
      }
      for (const [x, y] of cellsOf(piece)) {
        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) cells[y][x] = INDEX[piece.type]
      }
    }
    return cells
  }, [grid, piece, over])

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Lines" value={lines} />
          <Stat label="Level" value={level + 1} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
      actions={
        !over && (
          <IconButton
            label={running ? 'Pause' : 'Resume'}
            onClick={() => setRunning((r) => !r)}
          >
            <Icon name={running ? 'pause' : 'resume'} size={16} />
          </IconButton>
        )
      }
    >
      <div className="bd">
        <div className="bd__board" {...swipe}>
          {view.map((row, y) =>
            row.map((c, x) => (
              <span
                key={`${x},${y}`}
                className={`bd__c${c === -1 ? ' is-ghost' : ''}${flash.includes(y) ? ' is-flash' : ''}`}
                style={c > 0 ? { background: COLORS[c] } : undefined}
              />
            )),
          )}

          {!running && !over && (
            <motion.button
              className="bd__veil"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={() => setRunning(true)}
            >
              <strong>Paused</strong>
              <span>Tap to resume</span>
            </motion.button>
          )}
        </div>

        <aside className="bd__side">
          <span className="bd__nextlabel">Next</span>
          <NextPreview type={nextType} />
          <p className="bd__hint">
            <span className="bd__hint--touch">Swipe to move · tap to rotate · swipe down to drop</span>
            <span className="bd__hint--keys">← → move · ↑ rotate · ↓ soft · space drop</span>
          </p>
        </aside>
      </div>

      {/* thumb controls — swiping alone is fiddly for rotation */}
      <div className="bd__pad">
        <button aria-label="Move left" onPointerDown={() => move(-1)}>
          <Icon name="chevron-right" size={19} weight={2.4} />
        </button>
        <button aria-label="Rotate" onPointerDown={spin}>
          <Icon name="rotate-cw" size={19} weight={2.2} />
        </button>
        <button aria-label="Soft drop" onPointerDown={softDrop}>
          <Icon name="chevron-right" size={19} weight={2.4} />
        </button>
        <button aria-label="Move right" onPointerDown={() => move(1)}>
          <Icon name="chevron-right" size={19} weight={2.4} />
        </button>
        <button aria-label="Hard drop" className="bd__pad-drop" onPointerDown={drop}>
          Drop
        </button>
      </div>

      <ResultOverlay
        open={over}
        won={false}
        isBest={isBest}
        headline={`${fmtNum(score)} points`}
        detail={`${lines} lines cleared · reached level ${level + 1}`}
        onAgain={reset}
      />
    </GameFrame>
  )
}

function NextPreview({ type }: { type: string }) {
  const p = spawnPiece(type)
  const cells = cellsOf({ ...p, x: 0, y: 0 })
  const minX = Math.min(...cells.map(([x]) => x))
  const minY = Math.min(...cells.map(([, y]) => y))
  const norm = cells.map(([x, y]) => [x - minX, y - minY])
  const w = Math.max(...norm.map(([x]) => x)) + 1
  const h = Math.max(...norm.map(([, y]) => y)) + 1

  return (
    <div
      className="bd__next"
      style={{ gridTemplateColumns: `repeat(${w}, 1fr)`, gridTemplateRows: `repeat(${h}, 1fr)` }}
    >
      {Array.from({ length: w * h }, (_, i) => {
        const x = i % w
        const y = Math.floor(i / w)
        const on = norm.some(([nx, ny]) => nx === x && ny === y)
        return (
          <span
            key={i}
            className="bd__nextc"
            style={on ? { background: colorOf(type) } : undefined}
          />
        )
      })}
    </div>
  )
}
