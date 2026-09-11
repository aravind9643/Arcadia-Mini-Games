import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { store } from '../../lib/storage'
import { fmtTime, shuffle } from '../../lib/utils'
import { byId } from '../registry'
import './MemoryMatch.css'

/**
 * Card faces are simple filled SVG shapes rather than emoji: they stay
 * identical across platforms and read clearly at small sizes.
 */
const GLYPHS: { id: string; color: string; path: string }[] = [
  { id: 'circle', color: '#f472b6', path: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16Z' },
  { id: 'square', color: '#22d3ee', path: 'M5.5 5.5h13v13h-13Z' },
  { id: 'triangle', color: '#a3e635', path: 'M12 4.2 20 19H4Z' },
  { id: 'diamond', color: '#fbbf24', path: 'M12 3.4 20.6 12 12 20.6 3.4 12Z' },
  {
    id: 'star',
    color: '#c084fc',
    path: 'm12 3.2 2.6 5.8 6.3.7-4.7 4.3 1.3 6.2L12 17.1l-5.5 3.1 1.3-6.2L3.1 9.7l6.3-.7L12 3.2Z',
  },
  {
    id: 'heart',
    color: '#fb7185',
    path: 'M12 20.4 4.6 13a4.6 4.6 0 0 1 7.4-5.3A4.6 4.6 0 0 1 19.4 13Z',
  },
  { id: 'bolt', color: '#38bdf8', path: 'M13.6 2.4 5 13.4h5.4l-.9 8.2L18.6 10h-5.6Z' },
  { id: 'hex', color: '#2dd4bf', path: 'M12 3.2 19.6 7.6v8.8L12 20.8 4.4 16.4V7.6Z' },
  {
    id: 'cross',
    color: '#f97316',
    path: 'M9.4 3.6h5.2v5.8h5.8v5.2h-5.8v5.8H9.4v-5.8H3.6V9.4h5.8Z',
  },
  {
    id: 'drop',
    color: '#818cf8',
    path: 'M12 3.2c3.6 4.2 6 7.3 6 10a6 6 0 0 1-12 0c0-2.7 2.4-5.8 6-10Z',
  },
]

function Glyph({ id }: { id: string }) {
  const g = GLYPHS.find((x) => x.id === id)!
  return (
    <svg viewBox="0 0 24 24" width="56%" height="56%" aria-hidden="true">
      <path d={g.path} fill={g.color} />
    </svg>
  )
}

type Difficulty = { name: string; pairs: number; cols: number }

const LEVELS: Difficulty[] = [
  { name: 'Easy', pairs: 6, cols: 3 },
  { name: 'Medium', pairs: 8, cols: 4 },
  { name: 'Hard', pairs: 10, cols: 4 },
]

type Card = { key: number; glyph: string; matched: boolean }

const deal = (pairs: number): Card[] =>
  shuffle(GLYPHS.slice(0, pairs).flatMap((g) => [g.id, g.id])).map((glyph, key) => ({
    key,
    glyph,
    matched: false,
  }))

export default function MemoryMatch() {
  const meta = byId('memory')!
  const [level, setLevel] = useState(1)
  const cfg = LEVELS[level]

  const [cards, setCards] = useState(() => deal(cfg.pairs))
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [streak, setStreak] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [done, setDone] = useState(false)
  const [isBest, setIsBest] = useState(false)

  const matchedCount = cards.filter((c) => c.matched).length
  const won = matchedCount === cards.length

  const reset = useCallback(
    (lvl = level) => {
      setCards(deal(LEVELS[lvl].pairs))
      setFlipped([])
      setMoves(0)
      setStreak(0)
      setStartedAt(null)
      setElapsed(0)
      setDone(false)
      setIsBest(false)
    },
    [level],
  )

  // running clock, only while a round is in progress
  useEffect(() => {
    if (startedAt === null || done) return
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100)
    return () => clearInterval(id)
  }, [startedAt, done])

  // resolve a pair once two cards are face up
  useEffect(() => {
    if (flipped.length !== 2) return
    const [a, b] = flipped
    const isPair = cards[a].glyph === cards[b].glyph

    if (isPair) {
      const next = streak + 1
      setStreak(next)
      cue('match', 'success', next - 1)
      setCards((cs) => cs.map((c) => (c.key === a || c.key === b ? { ...c, matched: true } : c)))
      setFlipped([])
      return
    }

    setStreak(0)
    const t = setTimeout(() => setFlipped([]), 720)
    return () => clearTimeout(t)
  }, [flipped, cards, streak])

  // record the win once
  useEffect(() => {
    if (!won || done) return
    setDone(true)
    const best = store.submitScore(meta.id, moves, true)
    setIsBest(best)
    sfx('win')
    navigator.vibrate?.([14, 60, 14, 60, 30])
  }, [won, done, moves, meta.id])

  const flip = (key: number) => {
    if (done || flipped.length === 2) return
    if (flipped.includes(key) || cards[key].matched) return
    if (startedAt === null) setStartedAt(Date.now())
    cue('flip', 'soft')
    setFlipped((f) => [...f, key])
    if (flipped.length === 1) setMoves((m) => m + 1)
  }

  const accuracy = moves === 0 ? 100 : Math.round((cfg.pairs / moves) * 100)

  const hud = useMemo(
    () => (
      <StatRow>
        <Stat label="Moves" value={moves} accent />
        <Stat label="Pairs" value={`${matchedCount / 2}/${cfg.pairs}`} />
        <Stat label="Streak" value={`×${streak}`} />
        <Stat label="Time" value={fmtTime(elapsed)} />
      </StatRow>
    ),
    [moves, matchedCount, cfg.pairs, streak, elapsed],
  )

  return (
    <GameFrame game={meta} hud={hud} onRestart={() => reset()}>
      <div className="mm__levels">
        {LEVELS.map((l, i) => (
          <button
            key={l.name}
            className={`mm__lvl${i === level ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setLevel(i)
              reset(i)
            }}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div
        className="mm__board"
        style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
      >
        {cards.map((card) => {
          const face = card.matched || flipped.includes(card.key)
          return (
            <motion.button
              key={card.key}
              className="mm__card"
              onClick={() => flip(card.key)}
              aria-label={face ? `${card.glyph} card` : 'Hidden card'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: 1,
                scale: card.matched ? 0.94 : 1,
              }}
              transition={{
                delay: Math.min(card.key * 0.026, 0.35),
                type: 'spring',
                stiffness: 320,
                damping: 24,
              }}
              whileTap={{ scale: 0.93 }}
            >
              <motion.span
                className="mm__inner"
                animate={{ rotateY: face ? 180 : 0 }}
                transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              >
                <span className="mm__face mm__face--back">
                  <span className="mm__pattern" />
                </span>
                <span
                  className={`mm__face mm__face--front${card.matched ? ' is-matched' : ''}`}
                >
                  <Glyph id={card.glyph} />
                </span>
              </motion.span>
            </motion.button>
          )
        })}
      </div>

      <ResultOverlay
        open={done}
        won
        isBest={isBest}
        headline="Board cleared!"
        detail={
          <>
            {moves} moves · {fmtTime(elapsed)} · {accuracy}% efficiency
            <br />
            <span style={{ color: 'var(--text-faint)' }}>{cfg.name} · {cfg.pairs} pairs</span>
          </>
        }
        onAgain={() => reset()}
      />
    </GameFrame>
  )
}
