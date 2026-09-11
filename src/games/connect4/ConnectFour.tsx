import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import {
  aiMove,
  COLS,
  drop,
  emptyBoard,
  isFull,
  landingRow,
  validCols,
  winnerLine,
  type Board,
  type Level,
} from './logic'
import './ConnectFour.css'

export default function ConnectFour() {
  const meta = byId('connect4')!
  const allTime = useStore().scores[meta.id]?.best ?? 0

  const [level, setLevel] = useState<Level>('Medium')
  const [board, setBoard] = useState<Board>(emptyBoard)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null)
  const [winCells, setWinCells] = useState<[number, number][]>([])
  const [tally, setTally] = useState({ w: 0, l: 0, d: 0 })
  const [isBest, setIsBest] = useState(false)
  const [hover, setHover] = useState<number | null>(null)

  const reset = useCallback(() => {
    setBoard(emptyBoard())
    setBusy(false)
    setResult(null)
    setWinCells([])
    setIsBest(false)
    setHover(null)
  }, [])

  useEffect(reset, [level, reset])

  const finish = useCallback(
    (outcome: 'win' | 'lose' | 'draw', cells: [number, number][]) => {
      setResult(outcome)
      setWinCells(cells)

      const next = {
        w: tally.w + (outcome === 'win' ? 1 : 0),
        l: tally.l + (outcome === 'lose' ? 1 : 0),
        d: tally.d + (outcome === 'draw' ? 1 : 0),
      }
      setTally(next)

      if (outcome === 'win') {
        setIsBest(store.submitScore(meta.id, next.w))
        sfx('win')
        navigator.vibrate?.([14, 50, 14])
      } else {
        sfx(outcome === 'draw' ? 'tick' : 'lose')
        navigator.vibrate?.(outcome === 'lose' ? [30, 60, 30] : 14)
      }
    },
    [meta.id, tally],
  )

  const playColumn = (col: number) => {
    if (busy || result) return
    if (landingRow(board, col) < 0) return

    const { board: mine } = drop(board, col, 1)
    setBoard(mine)
    cue('pop', 'tap')

    const won = winnerLine(mine)
    if (won) return finish('win', won.cells)
    if (isFull(mine)) return finish('draw', [])

    setBusy(true)
    // a beat of "thinking" makes the AI feel less abrupt
    setTimeout(() => {
      const col2 = aiMove(mine, level)
      const { board: theirs } = drop(mine, col2, 2)
      setBoard(theirs)
      sfx('flip')
      setBusy(false)

      const lost = winnerLine(theirs)
      if (lost) return finish('lose', lost.cells)
      if (isFull(theirs)) return finish('draw', [])
    }, 420)
  }

  const isWinCell = (r: number, c: number) =>
    winCells.some(([wr, wc]) => wr === r && wc === c)

  const playable = validCols(board)
  const headline =
    result === 'win' ? 'You win!' : result === 'lose' ? 'Computer wins' : 'A draw'

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Wins" value={tally.w} accent />
          <Stat label="Losses" value={tally.l} />
          <Stat label="Draws" value={tally.d} />
          <Stat label="Record" value={allTime} />
        </StatRow>
      }
    >
      <div className="c4__levels">
        {(['Easy', 'Medium', 'Hard'] as Level[]).map((l) => (
          <button
            key={l}
            className={`c4__lvl${l === level ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setLevel(l)
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="c4">
        {/* column hit areas sit above the grid so a tap anywhere drops a disc */}
        <div className="c4__cols">
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              className="c4__col"
              aria-label={`Drop in column ${c + 1}`}
              disabled={!playable.includes(c) || busy || Boolean(result)}
              onPointerEnter={() => setHover(c)}
              onPointerLeave={() => setHover(null)}
              onClick={() => playColumn(c)}
            >
              {hover === c && !busy && !result && playable.includes(c) && (
                <motion.span
                  className="c4__ghost"
                  layoutId="c4-ghost"
                  transition={{ type: 'spring', stiffness: 520, damping: 34 }}
                />
              )}
            </button>
          ))}
        </div>

        <div className="c4__grid" aria-hidden>
          {board.map((row, r) =>
            row.map((d, c) => (
              <span key={`${r},${c}`} className="c4__cell">
                {d !== 0 && (
                  <motion.span
                    className={`c4__disc c4__disc--${d === 1 ? 'you' : 'ai'}${
                      isWinCell(r, c) ? ' is-win' : ''
                    }`}
                    initial={{ y: `-${(r + 1) * 100 + 40}%` }}
                    animate={{ y: 0 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20, mass: 0.7 }}
                  />
                )}
              </span>
            )),
          )}
        </div>
      </div>

      <p className="c4__turn">
        {result ? headline : busy ? 'Computer thinking…' : 'Your turn — you play red'}
      </p>

      <ResultOverlay
        open={Boolean(result)}
        won={result === 'win'}
        isBest={result === 'win' && isBest}
        headline={headline}
        detail={
          result === 'lose'
            ? 'Watch for three-in-a-row with an open end — block it early.'
            : result === 'draw'
              ? 'Board full with no line. Evenly matched.'
              : `${tally.w} win${tally.w === 1 ? '' : 's'} this session on ${level}.`
        }
        onAgain={reset}
      />
    </GameFrame>
  )
}
