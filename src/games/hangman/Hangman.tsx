import { motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import { randomEntry, type Entry } from './words'
import './Hangman.css'

const LIVES = 6
const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

export default function Hangman() {
  const meta = byId('hangman')!
  const bestStreak = useStore().scores[meta.id]?.best ?? 0

  const [entry, setEntry] = useState<Entry>(() => randomEntry())
  const [guessed, setGuessed] = useState<string[]>([])
  const [streak, setStreak] = useState(0)
  const [showHint, setShowHint] = useState(false)
  const [isBest, setIsBest] = useState(false)
  /** Guards the end-of-word effect from firing twice for one word. */
  const [settled, setSettled] = useState(false)

  const letters = [...new Set(entry.word.split(''))]
  const wrong = guessed.filter((g) => !entry.word.includes(g))
  const left = LIVES - wrong.length
  const solved = letters.every((l) => guessed.includes(l))
  const dead = left <= 0
  const over = solved || dead

  /** Next word in the run; a loss resets the streak. */
  const next = useCallback(
    (keepStreak: boolean) => {
      setEntry((e) => randomEntry(e.word))
      setGuessed([])
      setShowHint(false)
      setIsBest(false)
      setSettled(false)
      if (!keepStreak) setStreak(0)
    },
    [],
  )

  const guess = useCallback(
    (ch: string) => {
      if (over || guessed.includes(ch)) return
      setGuessed((g) => [...g, ch])
      if (entry.word.includes(ch)) cue('match', 'success', 2)
      else cue('lose', 'error')
    },
    [over, guessed, entry.word],
  )

  /* physical keyboard */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const k = e.key.toLowerCase()
      if (/^[a-z]$/.test(k)) guess(k)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [guess])

  /* Record the outcome once per word. */
  useEffect(() => {
    if (!over || settled) return
    setSettled(true)
    if (solved) {
      const s = streak + 1
      setStreak(s)
      setIsBest(store.submitScore(meta.id, s))
      sfx('win')
      navigator.vibrate?.([14, 50, 14])
    } else {
      sfx('lose')
      navigator.vibrate?.([30, 60, 30])
    }
  }, [over, settled, solved, streak, meta.id])

  return (
    <GameFrame
      game={meta}
      onRestart={() => next(false)}
      hud={
        <StatRow>
          <Stat label="Chances" value={'●'.repeat(Math.max(0, left)) || '—'} accent />
          <Stat label="Streak" value={streak} />
          <Stat label="Best" value={bestStreak} />
        </StatRow>
      }
    >
      <Gallows wrong={wrong.length} />

      <div className="hm__word">
        {entry.word.split('').map((ch, i) => {
          const shown = guessed.includes(ch) || dead
          return (
            <span key={i} className={`hm__slot${shown ? ' is-on' : ''}${dead && !guessed.includes(ch) ? ' is-missed' : ''}`}>
              {shown && (
                <motion.span
                  initial={{ y: 10, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 460, damping: 24 }}
                >
                  {ch.toUpperCase()}
                </motion.span>
              )}
            </span>
          )
        })}
      </div>

      <button className="hm__hint" onClick={() => { cue('tap'); setShowHint(true) }}>
        {showHint ? entry.hint : 'Need a hint?'}
      </button>

      <div className="hm__kb">
        {ROWS.map((row, i) => (
          <div className="hm__kbrow" key={i}>
            {row.split('').map((ch) => {
              const used = guessed.includes(ch)
              const hit = used && entry.word.includes(ch)
              return (
                <motion.button
                  key={ch}
                  className={`hm__key${used ? (hit ? ' is-hit' : ' is-miss') : ''}`}
                  onClick={() => guess(ch)}
                  disabled={used || over}
                  whileTap={{ scale: 0.9 }}
                >
                  {ch.toUpperCase()}
                </motion.button>
              )
            })}
          </div>
        ))}
      </div>

      <ResultOverlay
        open={over}
        won={solved}
        isBest={solved && isBest}
        headline={solved ? 'Got it!' : 'Out of chances'}
        detail={
          <>
            The word was{' '}
            <strong style={{ color: 'var(--lime)', letterSpacing: '0.06em' }}>
              {entry.word.toUpperCase()}
            </strong>
            {solved ? ` — that's ${streak} in a row.` : `. ${entry.hint}.`}
          </>
        }
        againLabel={solved ? 'Next word' : 'Try another'}
        onAgain={() => next(solved)}
      />
    </GameFrame>
  )
}

/** Draws the figure one stroke per wrong guess. */
function Gallows({ wrong }: { wrong: number }) {
  const parts = [
    <circle key="head" cx="62" cy="30" r="10" />,
    <path key="body" d="M62 40v26" />,
    <path key="arm1" d="M62 47 49 57" />,
    <path key="arm2" d="M62 47 75 57" />,
    <path key="leg1" d="M62 66 51 82" />,
    <path key="leg2" d="M62 66 73 82" />,
  ]
  return (
    <svg className="hm__gallows" viewBox="0 0 110 100" aria-label={`${wrong} of 6 wrong guesses`}>
      {/* frame is always drawn */}
      <g className="hm__frame">
        <path d="M8 92h44M18 92V8h44M62 8v12" />
      </g>
      <g className="hm__figure">
        {parts.slice(0, wrong).map((p, i) => (
          <motion.g
            key={i}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            {p}
          </motion.g>
        ))}
      </g>
    </svg>
  )
}
