import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, shuffle } from '../../lib/utils'
import { byId } from '../registry'
import './TripleTile.css'

const TRAY = 7
/** Simple glyph set — drawn as SVG so they render identically everywhere. */
const SYMBOLS = [
  { id: 'circle', color: '#f472b6', d: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z' },
  { id: 'square', color: '#22d3ee', d: 'M5 5h14v14H5Z' },
  { id: 'triangle', color: '#a3e635', d: 'M12 4 20 19H4Z' },
  { id: 'diamond', color: '#fbbf24', d: 'M12 3.5 20.5 12 12 20.5 3.5 12Z' },
  { id: 'star', color: '#c084fc', d: 'm12 3 2.6 5.9 6.4.7-4.8 4.3 1.3 6.3L12 17.1 6.5 20.2l1.3-6.3L3 9.6l6.4-.7Z' },
  { id: 'heart', color: '#fb7185', d: 'M12 20.4 4.6 13a4.6 4.6 0 0 1 7.4-5.3A4.6 4.6 0 0 1 19.4 13Z' },
  { id: 'hex', color: '#2dd4bf', d: 'M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6Z' },
  { id: 'drop', color: '#818cf8', d: 'M12 3.2c3.6 4.2 6 7.3 6 10a6 6 0 0 1-12 0c0-2.7 2.4-5.8 6-10Z' },
]

type Level = { name: string; kinds: number; triples: number }
const LEVELS: Level[] = [
  { name: 'Easy', kinds: 5, triples: 12 },
  { name: 'Medium', kinds: 6, triples: 16 },
  { name: 'Hard', kinds: 8, triples: 20 },
]

type Tile = { id: number; sym: number; layer: number; x: number; y: number }

/**
 * Deals tiles in multiples of three so the board is always clearable, then
 * scatters them across loosely overlapping layers.
 */
function deal(level: Level): Tile[] {
  const syms: number[] = []
  for (let i = 0; i < level.triples; i++) {
    const s = i % level.kinds
    syms.push(s, s, s)
  }
  const order = shuffle(syms)

  // Lay out on a 6-wide grid, one layer per 18 tiles, offsetting each layer
  // by half a cell so upper tiles visibly overlap (and block) lower ones.
  const COLS = 6
  const PER_LAYER = COLS * 3
  return order.map((sym, id) => {
    const layer = Math.floor(id / PER_LAYER)
    const within = id % PER_LAYER
    const col = within % COLS
    const row = Math.floor(within / COLS)
    return {
      id,
      sym,
      layer,
      x: 6 + col * 14.5 + (layer % 2) * 6,
      y: 8 + row * 20 + (layer % 2) * 7,
    }
  })
}

export default function TripleTile() {
  const meta = byId('triple')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [lvl, setLvl] = useState(0)
  const [board, setBoard] = useState<Tile[]>(() => deal(LEVELS[0]))
  const [tray, setTray] = useState<Tile[]>([])
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const [isBest, setIsBest] = useState(false)

  const reset = useCallback((index = lvl) => {
    setBoard(deal(LEVELS[index]))
    setTray([])
    setScore(0)
    setCombo(0)
    setResult(null)
    setIsBest(false)
  }, [lvl])

  /** A tile is blocked when a later-layer tile overlaps it. */
  const blocked = useMemo(() => {
    const set = new Set<number>()
    for (const a of board) {
      for (const b of board) {
        if (b.layer <= a.layer) continue
        if (Math.abs(b.x - a.x) < 11 && Math.abs(b.y - a.y) < 11) {
          set.add(a.id)
          break
        }
      }
    }
    return set
  }, [board])

  const take = (t: Tile) => {
    if (result || blocked.has(t.id) || tray.length >= TRAY) return

    const nextTray = [...tray, t]
    setBoard((b) => b.filter((x) => x.id !== t.id))
    cue('tap', 'soft')

    // three of a kind clear together
    const same = nextTray.filter((x) => x.sym === t.sym)
    if (same.length === 3) {
      const ids = new Set(same.map((x) => x.id))
      setTray(nextTray.filter((x) => !ids.has(x.id)))
      const c = combo + 1
      setCombo(c)
      setScore((s) => s + 30 * Math.min(c, 5))
      sfx('match', Math.min(c - 1, 4))
      navigator.vibrate?.(12)
      return
    }

    setCombo(0)
    setTray(nextTray)
  }

  /* win / lose */
  useEffect(() => {
    if (result) return
    if (board.length === 0 && tray.length === 0) {
      setResult('win')
      const final = score + 200
      setScore(final)
      setIsBest(store.submitScore(meta.id, final))
      sfx('win')
      navigator.vibrate?.([14, 50, 14, 50, 30])
    } else if (tray.length >= TRAY) {
      setResult('lose')
      setIsBest(store.submitScore(meta.id, score))
      sfx('lose')
      navigator.vibrate?.([30, 60, 30])
    }
  }, [board, tray, result, score, meta.id])

  return (
    <GameFrame
      game={meta}
      onRestart={() => reset()}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Left" value={board.length} />
          <Stat label="Tray" value={`${tray.length}/${TRAY}`} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="tt3__levels">
        {LEVELS.map((l, i) => (
          <button
            key={l.name}
            className={`tt3__lvl${i === lvl ? ' is-on' : ''}`}
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

      <div className="tt3__board">
        <AnimatePresence>
          {board.map((t) => {
            const s = SYMBOLS[t.sym]
            const isBlocked = blocked.has(t.id)
            return (
              <motion.button
                key={t.id}
                className={`tt3__tile${isBlocked ? ' is-blocked' : ''}`}
                style={{ left: `${t.x}%`, top: `${t.y}%`, zIndex: t.layer + 1 }}
                onClick={() => take(t)}
                disabled={isBlocked}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                whileTap={{ scale: isBlocked ? 1 : 0.9 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                aria-label={`${s.id} tile${isBlocked ? ', blocked' : ''}`}
              >
                <svg viewBox="0 0 24 24">
                  <path d={s.d} fill={s.color} />
                </svg>
              </motion.button>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="tt3__tray">
        {Array.from({ length: TRAY }, (_, i) => {
          const t = tray[i]
          const s = t ? SYMBOLS[t.sym] : null
          return (
            <span key={i} className={`tt3__slot${t ? ' is-filled' : ''}`}>
              <AnimatePresence mode="popLayout">
                {s && (
                  <motion.svg
                    key={t.id}
                    viewBox="0 0 24 24"
                    initial={{ scale: 0.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.3, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                  >
                    <path d={s.d} fill={s.color} />
                  </motion.svg>
                )}
              </AnimatePresence>
            </span>
          )
        })}
      </div>

      <ResultOverlay
        open={Boolean(result)}
        won={result === 'win'}
        isBest={isBest}
        headline={result === 'win' ? 'Tray cleared!' : 'Tray full'}
        detail={
          result === 'win'
            ? `Every tile matched — 200 bonus included. Final score ${fmtNum(score)}.`
            : 'Take tiles you can match soon — a full tray ends the run.'
        }
        onAgain={() => reset()}
      />
    </GameFrame>
  )
}
