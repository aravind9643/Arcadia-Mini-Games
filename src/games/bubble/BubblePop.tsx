import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum } from '../../lib/utils'
import { byId } from '../registry'
import {
  clusterAt,
  COLORS,
  COLS,
  hasMoves,
  makeBoard,
  remaining,
  ROWS,
  scoreFor,
  settle,
  type Board,
} from './logic'
import './BubblePop.css'

type Level = { name: string; colors: number }

const LEVELS: Level[] = [
  { name: 'Easy', colors: 3 },
  { name: 'Medium', colors: 4 },
  { name: 'Hard', colors: 5 },
]

export default function BubblePop() {
  const meta = byId('bubble')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [lvl, setLvl] = useState(1)
  const [board, setBoard] = useState<Board>(() => makeBoard(LEVELS[1].colors))
  const [score, setScore] = useState(0)
  const [pops, setPops] = useState(0)
  const [hover, setHover] = useState<number[]>([])
  const [floater, setFloater] = useState<{ id: number; text: string; i: number } | null>(null)
  const [over, setOver] = useState(false)
  const [isBest, setIsBest] = useState(false)

  const reset = useCallback((index = lvl) => {
    setBoard(makeBoard(LEVELS[index].colors))
    setScore(0)
    setPops(0)
    setHover([])
    setFloater(null)
    setOver(false)
    setIsBest(false)
  }, [lvl])

  const left = useMemo(() => remaining(board), [board])

  const pop = (i: number) => {
    if (over || board[i] < 0) return
    const group = clusterAt(board, i)
    if (group.length < 2) {
      cue('tick', 'soft')
      return
    }

    const gained = scoreFor(group.length)
    const cleared = [...board]
    for (const k of group) cleared[k] = -1

    setBoard(settle(cleared))
    setScore((s) => s + gained)
    setPops((n) => n + 1)
    setHover([])
    setFloater({ id: Date.now(), text: `+${gained}`, i })
    sfx('merge', Math.min(Math.floor(group.length / 3), 5))
    navigator.vibrate?.(group.length > 6 ? 18 : 9)
  }

  /* end of game: no group of two remains */
  useEffect(() => {
    if (over || board.length === 0) return
    if (hasMoves(board)) return
    setOver(true)
    // clearing the whole board earns a completion bonus
    const bonus = remaining(board) === 0 ? 500 : 0
    const final = score + bonus
    if (bonus) setScore(final)
    setIsBest(store.submitScore(meta.id, final))
    sfx(bonus ? 'win' : 'lose')
    navigator.vibrate?.(bonus ? [14, 50, 14] : [30, 60, 30])
  }, [board, over, score, meta.id])

  return (
    <GameFrame
      game={meta}
      onRestart={() => reset()}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Left" value={left} />
          <Stat label="Pops" value={pops} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="bp__levels">
        {LEVELS.map((l, i) => (
          <button
            key={l.name}
            className={`bp__lvl${i === lvl ? ' is-on' : ''}`}
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
        className="bp__grid"
        style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)`, gridTemplateRows: `repeat(${ROWS}, 1fr)` }}
        onPointerLeave={() => setHover([])}
      >
        {board.map((v, i) => (
          <button
            key={i}
            className={`bp__c${hover.includes(i) ? ' is-hover' : ''}`}
            disabled={v < 0}
            onPointerEnter={() => {
              if (v < 0) return
              const g = clusterAt(board, i)
              setHover(g.length >= 2 ? g : [])
            }}
            onClick={() => pop(i)}
            aria-label={v < 0 ? 'Empty' : `Bubble ${v + 1}`}
          >
            <AnimatePresence>
              {v >= 0 && (
                <motion.span
                  className="bp__b"
                  style={{ background: COLORS[v] }}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                />
              )}
            </AnimatePresence>
          </button>
        ))}

        <AnimatePresence>
          {floater && (
            <motion.span
              key={floater.id}
              className="bp__float mono"
              style={{
                left: `${((floater.i % COLS) + 0.5) * (100 / COLS)}%`,
                top: `${(Math.floor(floater.i / COLS) + 0.5) * (100 / ROWS)}%`,
              }}
              initial={{ opacity: 1, y: 0, scale: 0.8 }}
              animate={{ opacity: 0, y: -46, scale: 1.2 }}
              transition={{ duration: 0.75 }}
              onAnimationComplete={() => setFloater(null)}
            >
              {floater.text}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <p className="bp__hint">
        {hover.length >= 2
          ? `${hover.length} bubbles · +${scoreFor(hover.length)}`
          : 'Tap any group of two or more'}
      </p>

      <ResultOverlay
        open={over}
        won={left === 0}
        isBest={isBest}
        headline={left === 0 ? 'Board cleared!' : 'No moves left'}
        detail={
          left === 0
            ? `Perfect clear — 500 bonus included. Final score ${fmtNum(score)}.`
            : `${left} bubble${left === 1 ? '' : 's'} stranded. Clear big clusters first — they score far more.`
        }
        onAgain={() => reset()}
      />
    </GameFrame>
  )
}
