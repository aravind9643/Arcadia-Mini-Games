import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Button, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, shuffle } from '../../lib/utils'
import { byId } from '../registry'
import { randomEntry, type Entry } from '../hangman/words'
import './AnagramRush.css'

const DURATION = 90_000

type Tile = { id: number; ch: string; used: boolean }

/** Scrambles a word, guaranteeing the result differs from the original. */
function scramble(word: string): Tile[] {
  let order = shuffle(word.split(''))
  let guard = 0
  while (order.join('') === word && guard++ < 10) order = shuffle(word.split(''))
  return order.map((ch, id) => ({ id, ch, used: false }))
}

export default function AnagramRush() {
  const meta = byId('anagram')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [entry, setEntry] = useState<Entry>(() => randomEntry())
  const [tiles, setTiles] = useState<Tile[]>(() => scramble(entry.word))
  const [slotIds, setSlotIds] = useState<number[]>([])
  const [score, setScore] = useState(0)
  const [solved, setSolved] = useState(0)
  const [skips, setSkips] = useState(0)
  const [left, setLeft] = useState(DURATION)
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle')
  const [flash, setFlash] = useState<'ok' | 'bad' | null>(null)
  const [isBest, setIsBest] = useState(false)
  const startedAt = useRef(0)
  const wordAt = useRef(0)

  const load = useCallback((prev?: string) => {
    const e = randomEntry(prev)
    setEntry(e)
    setTiles(scramble(e.word))
    setSlotIds([])
    wordAt.current = performance.now()
  }, [])

  const reset = useCallback(() => {
    setScore(0)
    setSolved(0)
    setSkips(0)
    setLeft(DURATION)
    setIsBest(false)
    setFlash(null)
    setPhase('idle')
    load()
  }, [load])

  const start = () => {
    reset()
    startedAt.current = performance.now()
    wordAt.current = performance.now()
    setPhase('run')
    cue('levelup', 'heavy')
  }

  /* countdown */
  useEffect(() => {
    if (phase !== 'run') return
    let raf = 0
    let lastSec = 0
    const tick = () => {
      const remaining = DURATION - (performance.now() - startedAt.current)
      if (remaining <= 0) {
        setLeft(0)
        setPhase('done')
        return
      }
      setLeft(remaining)
      const sec = Math.ceil(remaining / 1000)
      if (sec <= 5 && sec !== lastSec) {
        lastSec = sec
        sfx('tick')
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  useEffect(() => {
    if (phase !== 'done') return
    setIsBest(store.submitScore(meta.id, score))
    sfx('win')
    navigator.vibrate?.([16, 50, 16])
  }, [phase, score, meta.id])

  const guessWord = slotIds
    .map((id) => tiles.find((t) => t.id === id)?.ch ?? '')
    .join('')

  /* check the answer whenever the slots fill up */
  useEffect(() => {
    if (phase !== 'run') return
    if (guessWord.length !== entry.word.length) return

    if (guessWord === entry.word) {
      // longer words and faster solves both pay more
      const seconds = (performance.now() - wordAt.current) / 1000
      const speed = Math.max(0, Math.round((12 - seconds) * 4))
      const points = entry.word.length * 10 + speed
      setScore((s) => s + points)
      setSolved((n) => n + 1)
      setFlash('ok')
      cue('match', 'success', 3)
      setTimeout(() => {
        setFlash(null)
        load(entry.word)
      }, 420)
    } else {
      setFlash('bad')
      cue('lose', 'error')
      setTimeout(() => {
        setFlash(null)
        // wrong answer just clears the slots, the letters stay
        setSlotIds([])
        setTiles((ts) => ts.map((t) => ({ ...t, used: false })))
      }, 380)
    }
  }, [guessWord, entry.word, phase, load])

  const pushTile = (id: number) => {
    if (phase !== 'run' || flash) return
    setTiles((ts) => ts.map((t) => (t.id === id ? { ...t, used: true } : t)))
    setSlotIds((s) => [...s, id])
    cue('flip', 'soft')
  }

  const popTile = () => {
    if (phase !== 'run' || slotIds.length === 0 || flash) return
    const last = slotIds.at(-1)!
    setSlotIds((s) => s.slice(0, -1))
    setTiles((ts) => ts.map((t) => (t.id === last ? { ...t, used: false } : t)))
    cue('tick', 'soft')
  }

  const skip = () => {
    if (phase !== 'run') return
    setSkips((n) => n + 1)
    setScore((s) => Math.max(0, s - 5))
    cue('whoosh')
    load(entry.word)
  }

  const secs = (left / 1000).toFixed(1)

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Solved" value={solved} />
          <Stat label="Time" value={`${secs}s`} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="ar">
        <div className="ar__bar">
          <motion.span
            className="ar__barfill"
            style={{ width: `${(left / DURATION) * 100}%` }}
            animate={{
              background:
                left < 15_000
                  ? 'linear-gradient(90deg,#f43f5e,#fb7185)'
                  : 'linear-gradient(90deg,#8b5cf6,#0ea5e9)',
            }}
          />
        </div>

        <p className="ar__hint">{entry.hint}</p>

        {/* answer slots */}
        <div className={`ar__slots${flash ? ` is-${flash}` : ''}`}>
          {entry.word.split('').map((_, i) => {
            const id = slotIds[i]
            const tile = id !== undefined ? tiles.find((t) => t.id === id) : null
            return (
              <button
                key={i}
                className={`ar__slot${tile ? ' is-filled' : ''}`}
                onClick={popTile}
                aria-label={tile ? `Remove ${tile.ch}` : 'Empty slot'}
              >
                <AnimatePresence mode="popLayout">
                  {tile && (
                    <motion.span
                      key={tile.id}
                      initial={{ scale: 0.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.3, opacity: 0 }}
                      transition={{ type: 'spring', stiffness: 520, damping: 26 }}
                    >
                      {tile.ch.toUpperCase()}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )
          })}
        </div>

        {/* letter bank */}
        <div className="ar__bank">
          {tiles.map((t) => (
            <motion.button
              key={t.id}
              className={`ar__tile${t.used ? ' is-used' : ''}`}
              onClick={() => pushTile(t.id)}
              disabled={t.used}
              whileTap={{ scale: 0.9 }}
              layout
              transition={{ type: 'spring', stiffness: 460, damping: 28 }}
            >
              {t.ch.toUpperCase()}
            </motion.button>
          ))}
        </div>

        <div className="ar__tools">
          <Button size="sm" variant="surface" onClick={popTile} disabled={slotIds.length === 0}>
            Undo
          </Button>
          <Button size="sm" variant="surface" onClick={skip}>
            Skip (−5)
          </Button>
        </div>

        {phase === 'idle' && (
          <motion.button
            className="ar__veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={start}
          >
            <strong>Tap to start</strong>
            <span>90 seconds · unscramble as many words as you can</span>
          </motion.button>
        )}
      </div>

      <ResultOverlay
        open={phase === 'done'}
        won
        isBest={isBest}
        headline={`${fmtNum(score)} points`}
        detail={`${solved} word${solved === 1 ? '' : 's'} unscrambled${skips ? ` · ${skips} skipped` : ''}`}
        onAgain={start}
      />
    </GameFrame>
  )
}
