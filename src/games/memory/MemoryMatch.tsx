import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { store } from '../../lib/storage'
import { fmtTime, shuffle } from '../../lib/utils'
import { byId } from '../registry'
import './MemoryMatch.css'

const GLYPHS = ['🚀', '🌙', '⭐', '🔥', '🌊', '🍀', '⚡', '🎈', '🍩', '👾']

type Difficulty = { name: string; pairs: number; cols: number }

const LEVELS: Difficulty[] = [
  { name: 'Easy', pairs: 6, cols: 3 },
  { name: 'Medium', pairs: 8, cols: 4 },
  { name: 'Hard', pairs: 10, cols: 4 },
]

type Card = { key: number; glyph: string; matched: boolean }

const deal = (pairs: number): Card[] =>
  shuffle(GLYPHS.slice(0, pairs).flatMap((g) => [g, g])).map((glyph, key) => ({
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
              aria-label={face ? card.glyph : 'Hidden card'}
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
                  {card.glyph}
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
