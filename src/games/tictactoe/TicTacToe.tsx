import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { pick } from '../../lib/utils'
import { byId } from '../registry'
import './TicTacToe.css'

type Mark = 'X' | 'O' | null
type Board = Mark[]

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
]

function winnerOf(b: Board): { mark: Mark; line: number[] } | null {
  for (const line of LINES) {
    const [a, c, d] = line
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a], line }
  }
  return null
}

const openCells = (b: Board) =>
  b.map((c, i) => (c === null ? i : -1)).filter((i) => i >= 0)

/**
 * Minimax with depth preference, so the AI wins as fast as possible and
 * loses as slowly as possible. The board is tiny, so no pruning is needed.
 */
function minimax(b: Board, forMark: Mark, turn: Mark, depth = 0): number {
  const win = winnerOf(b)
  if (win) return win.mark === forMark ? 10 - depth : depth - 10
  const open = openCells(b)
  if (open.length === 0) return 0

  const scores = open.map((i) => {
    const next = [...b]
    next[i] = turn
    return minimax(next, forMark, turn === 'X' ? 'O' : 'X', depth + 1)
  })
  return turn === forMark ? Math.max(...scores) : Math.min(...scores)
}

function bestMove(b: Board, mark: Mark): number {
  const open = openCells(b)
  let best = -Infinity
  let choice = open[0]
  for (const i of open) {
    const next = [...b]
    next[i] = mark
    const s = minimax(next, mark, mark === 'X' ? 'O' : 'X', 1)
    if (s > best) {
      best = s
      choice = i
    }
  }
  return choice
}

type Level = 'Easy' | 'Medium' | 'Hard'

/** Easy plays at random; Medium blunders sometimes; Hard is perfect. */
function aiMove(b: Board, level: Level): number {
  const open = openCells(b)
  if (level === 'Easy') return pick(open)
  if (level === 'Medium' && Math.random() < 0.35) return pick(open)
  return bestMove(b, 'O')
}

export default function TicTacToe() {
  const meta = byId('tictactoe')!
  const wins = useStore().scores[meta.id]?.best ?? 0

  const [level, setLevel] = useState<Level>('Hard')
  const [board, setBoard] = useState<Board>(() => Array(9).fill(null))
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<'win' | 'lose' | 'draw' | null>(null)
  const [line, setLine] = useState<number[]>([])
  const [tally, setTally] = useState({ w: 0, l: 0, d: 0 })
  const [isBest, setIsBest] = useState(false)

  const reset = useCallback(() => {
    setBoard(Array(9).fill(null))
    setBusy(false)
    setResult(null)
    setLine([])
    setIsBest(false)
  }, [])

  /** Applies a finished-game outcome once. */
  const finish = useCallback(
    (outcome: 'win' | 'lose' | 'draw', winLine: number[]) => {
      setResult(outcome)
      setLine(winLine)

      const next = {
        w: tally.w + (outcome === 'win' ? 1 : 0),
        l: tally.l + (outcome === 'lose' ? 1 : 0),
        d: tally.d + (outcome === 'draw' ? 1 : 0),
      }
      setTally(next)

      if (outcome === 'win') {
        // "best" is the session win count, so it climbs as you keep winning
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

  const play = (i: number) => {
    if (busy || result || board[i]) return
    const next = [...board]
    next[i] = 'X'
    setBoard(next)
    cue('tap')

    const mine = winnerOf(next)
    if (mine) return finish('win', mine.line)
    if (openCells(next).length === 0) return finish('draw', [])

    // let the player see their mark land before the AI replies
    setBusy(true)
    setTimeout(() => {
      const move = aiMove(next, level)
      const after = [...next]
      after[move] = 'O'
      setBoard(after)
      sfx('flip')
      setBusy(false)

      const theirs = winnerOf(after)
      if (theirs) return finish('lose', theirs.line)
      if (openCells(after).length === 0) return finish('draw', [])
    }, 380)
  }

  useEffect(reset, [level, reset])

  const headline =
    result === 'win' ? 'You win!' : result === 'lose' ? 'Computer wins' : 'A draw'

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Won" value={tally.w} accent />
          <Stat label="Lost" value={tally.l} />
          <Stat label="Drew" value={tally.d} />
          <Stat label="Best" value={wins} />
        </StatRow>
      }
    >
      <div className="ttt__levels">
        {(['Easy', 'Medium', 'Hard'] as Level[]).map((l) => (
          <button
            key={l}
            className={`ttt__lvl${l === level ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setLevel(l)
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="ttt__board">
        {board.map((m, i) => (
          <motion.button
            key={i}
            className={`ttt__c${line.includes(i) ? ' is-win' : ''}`}
            onClick={() => play(i)}
            whileTap={{ scale: m ? 1 : 0.92 }}
            aria-label={m ? `${m} at square ${i + 1}` : `Empty square ${i + 1}`}
            disabled={Boolean(m) || busy || Boolean(result)}
          >
            {m && (
              <motion.span
                className={`ttt__m ttt__m--${m.toLowerCase()}`}
                initial={{ scale: 0, rotate: -35, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              >
                {m === 'X' ? <XMark /> : <OMark />}
              </motion.span>
            )}
          </motion.button>
        ))}
      </div>

      <p className="ttt__turn">
        {result ? headline : busy ? 'Computer thinking…' : 'Your turn — you play X'}
      </p>

      <ResultOverlay
        open={Boolean(result)}
        won={result === 'win'}
        isBest={result === 'win' && isBest}
        headline={headline}
        detail={
          result === 'draw' && level === 'Hard'
            ? 'A draw is the best possible result against a perfect opponent.'
            : result === 'lose'
              ? 'Take the centre or a corner early — it opens more threats.'
              : `${tally.w} win${tally.w === 1 ? '' : 's'} this session.`
        }
        onAgain={reset}
      />
    </GameFrame>
  )
}

/*
 * Both marks are drawn in a 40-unit box and sized so their *ink* — the path
 * plus half the 5-unit stroke on each side — spans an identical 29 units,
 * centred on 20,20. Matching the ink rather than the path keeps X and O at
 * the same visual weight; sizing the paths alone left O noticeably larger.
 */
const XMark = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    <motion.path
      d="M8 8 32 32"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.18 }}
    />
    <motion.path
      d="M32 8 8 32"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.18, delay: 0.14 }}
    />
  </svg>
)

const OMark = () => (
  <svg viewBox="0 0 40 40" aria-hidden>
    <motion.circle
      cx="20"
      cy="20"
      r="12"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.3 }}
    />
  </svg>
)
