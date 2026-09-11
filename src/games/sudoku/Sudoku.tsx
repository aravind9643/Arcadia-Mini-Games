import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { Button, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtTime } from '../../lib/utils'
import { byId } from '../registry'
import {
  conflicts,
  digitCounts,
  generate,
  isSolved,
  peersOf,
  type Grid,
  type Level,
  type Puzzle,
} from './logic'
import './Sudoku.css'

type Move = { pos: number; before: number; beforeNotes: number[] }

export default function Sudoku() {
  const meta = byId('sudoku')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [level, setLevel] = useState<Level>('Easy')
  const [puz, setPuz] = useState<Puzzle | null>(null)
  const [grid, setGrid] = useState<Grid>([])
  const [notes, setNotes] = useState<number[][]>(() => Array.from({ length: 81 }, () => []))
  const [sel, setSel] = useState<number | null>(null)
  const [noteMode, setNoteMode] = useState(false)
  const [mistakes, setMistakes] = useState(0)
  const [history, setHistory] = useState<Move[]>([])
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const [isBest, setIsBest] = useState(false)
  const building = useRef(false)

  /** Builds a new puzzle; deferred a frame so the spinner can paint. */
  const build = useCallback((lv: Level) => {
    if (building.current) return
    building.current = true
    setPuz(null)
    setTimeout(() => {
      const p = generate(lv)
      setPuz(p)
      setGrid([...p.puzzle])
      setNotes(Array.from({ length: 81 }, () => []))
      setSel(null)
      setMistakes(0)
      setHistory([])
      setElapsed(0)
      setStartedAt(Date.now())
      setDone(false)
      setIsBest(false)
      setNoteMode(false)
      building.current = false
    }, 40)
  }, [])

  useEffect(() => build(level), [level, build])

  useEffect(() => {
    if (startedAt === null || done) return
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200)
    return () => clearInterval(id)
  }, [startedAt, done])

  const bad = useMemo(() => (grid.length ? conflicts(grid) : new Set<number>()), [grid])
  const counts = useMemo(() => (grid.length ? digitCounts(grid) : Array(10).fill(0)), [grid])
  const peers = useMemo(() => (sel === null ? new Set<number>() : peersOf(sel)), [sel])

  /* ---------- input ---------- */

  const place = useCallback(
    (v: number) => {
      if (!puz || sel === null || done) return
      if (puz.givens[sel]) return

      if (noteMode && v > 0) {
        setHistory((h) => [...h, { pos: sel, before: grid[sel], beforeNotes: notes[sel] }])
        setNotes((n) => {
          const next = n.map((x) => [...x])
          const at = next[sel].indexOf(v)
          if (at >= 0) next[sel].splice(at, 1)
          else next[sel].push(v)
          return next
        })
        cue('tick', 'soft')
        return
      }

      setHistory((h) => [...h, { pos: sel, before: grid[sel], beforeNotes: notes[sel] }])

      const next = [...grid]
      next[sel] = v
      setGrid(next)
      // placing a digit clears that cell's pencil marks
      setNotes((n) => {
        const copy = n.map((x) => [...x])
        copy[sel] = []
        return copy
      })

      if (v === 0) {
        cue('tick', 'soft')
        return
      }

      if (v !== puz.solution[sel]) {
        setMistakes((m) => m + 1)
        cue('lose', 'error')
      } else {
        cue('pop', 'tap')
      }
    },
    [puz, sel, done, noteMode, grid, notes],
  )

  const undo = useCallback(() => {
    setHistory((h) => {
      const last = h.at(-1)
      if (!last) return h
      setGrid((g) => {
        const next = [...g]
        next[last.pos] = last.before
        return next
      })
      setNotes((n) => {
        const next = n.map((x) => [...x])
        next[last.pos] = last.beforeNotes
        return next
      })
      setSel(last.pos)
      cue('tap', 'soft')
      return h.slice(0, -1)
    })
  }, [])

  /* keyboard entry */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (sel === null) return
      if (/^[1-9]$/.test(e.key)) return place(Number(e.key))
      if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') return place(0)
      const r = Math.floor(sel / 9)
      const c = sel % 9
      if (e.key === 'ArrowUp' && r > 0) setSel(sel - 9)
      else if (e.key === 'ArrowDown' && r < 8) setSel(sel + 9)
      else if (e.key === 'ArrowLeft' && c > 0) setSel(sel - 1)
      else if (e.key === 'ArrowRight' && c < 8) setSel(sel + 1)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', on, { passive: false })
    return () => window.removeEventListener('keydown', on)
  }, [sel, place])

  /* win check */
  useEffect(() => {
    if (!grid.length || done) return
    if (!isSolved(grid)) return
    setDone(true)
    setIsBest(store.submitScore(meta.id, elapsed, true))
    sfx('win')
    navigator.vibrate?.([14, 50, 14, 50, 30])
  }, [grid, done, elapsed, meta.id])

  const filled = grid.filter((v) => v !== 0).length

  if (!puz) {
    return (
      <GameFrame game={meta}>
        <div className="sd__loading">
          <span className="booting__ring" />
          <p>Carving a fresh {level.toLowerCase()} puzzle…</p>
        </div>
      </GameFrame>
    )
  }

  return (
    <GameFrame
      game={meta}
      onRestart={() => build(level)}
      hud={
        <StatRow>
          <Stat label="Time" value={fmtTime(elapsed)} accent />
          <Stat label="Filled" value={`${filled}/81`} />
          <Stat label="Errors" value={mistakes} />
          <Stat label="Best" value={best ? fmtTime(best, true) : '—'} />
        </StatRow>
      }
      actions={
        <Button
          size="sm"
          variant={noteMode ? 'primary' : 'surface'}
          onClick={() => setNoteMode((n) => !n)}
          aria-pressed={noteMode}
        >
          Notes
        </Button>
      }
    >
      <div className="sd__levels">
        {(['Easy', 'Medium', 'Hard'] as Level[]).map((l) => (
          <button
            key={l}
            className={`sd__lvl${l === level ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setLevel(l)
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="sd__grid">
        {grid.map((v, p) => {
          const given = puz.givens[p]
          const isSel = sel === p
          const isPeer = peers.has(p)
          const sameDigit = v !== 0 && sel !== null && grid[sel] === v && !isSel
          return (
            <button
              key={p}
              className={[
                'sd__c',
                given && 'is-given',
                isSel && 'is-sel',
                isPeer && 'is-peer',
                sameDigit && 'is-same',
                bad.has(p) && 'is-bad',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => {
                setSel(p)
                cue('tap', 'soft')
              }}
              aria-label={`Row ${Math.floor(p / 9) + 1}, column ${(p % 9) + 1}${v ? `, ${v}` : ', empty'}`}
            >
              {v !== 0 ? (
                <motion.span
                  key={v}
                  initial={{ scale: 0.55, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                >
                  {v}
                </motion.span>
              ) : notes[p].length > 0 ? (
                <span className="sd__notes">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <i key={n}>{notes[p].includes(n) ? n : ''}</i>
                  ))}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="sd__pad">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button
            key={n}
            className="sd__key"
            onClick={() => place(n)}
            disabled={counts[n] >= 9}
          >
            {n}
            <i>{Math.max(0, 9 - counts[n])}</i>
          </button>
        ))}
      </div>

      <div className="sd__tools">
        <Button size="sm" variant="surface" onClick={undo} disabled={history.length === 0}>
          <Icon name="undo" size={14} />
          Undo
        </Button>
        <Button size="sm" variant="surface" onClick={() => place(0)}>
          Erase
        </Button>
      </div>

      <ResultOverlay
        open={done}
        won
        isBest={isBest}
        headline="Solved!"
        detail={`${level} puzzle in ${fmtTime(elapsed)}${mistakes === 0 ? ' with no mistakes.' : ` · ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`}`}
        onAgain={() => build(level)}
      />
    </GameFrame>
  )
}
