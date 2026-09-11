import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import { isWord, randomAnswer } from './words'
import './WordHunt.css'

const LEN = 5
const TRIES = 6

type Mark = 'hit' | 'near' | 'miss'

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']

/** Standard Wordle marking, including duplicate-letter accounting. */
function grade(guess: string, answer: string): Mark[] {
  const marks: Mark[] = Array(LEN).fill('miss')
  const pool = answer.split('')

  // exact positions first, so they claim their letter from the pool
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === pool[i]) {
      marks[i] = 'hit'
      pool[i] = ''
    }
  }
  for (let i = 0; i < LEN; i++) {
    if (marks[i] === 'hit') continue
    const at = pool.indexOf(guess[i])
    if (at !== -1) {
      marks[i] = 'near'
      pool[at] = ''
    }
  }
  return marks
}

export default function WordHunt() {
  const meta = byId('wordle')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [answer, setAnswer] = useState(randomAnswer)
  const [guesses, setGuesses] = useState<string[]>([])
  const [marks, setMarks] = useState<Mark[][]>([])
  const [draft, setDraft] = useState('')
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play')
  const [shake, setShake] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [isBest, setIsBest] = useState(false)

  const reset = useCallback(() => {
    setAnswer(randomAnswer())
    setGuesses([])
    setMarks([])
    setDraft('')
    setState('play')
    setToast(null)
    setIsBest(false)
  }, [])

  const flash = (msg: string) => {
    setToast(msg)
    setShake((s) => s + 1)
    cue('lose', 'error')
    setTimeout(() => setToast(null), 1300)
  }

  const submit = useCallback(() => {
    if (state !== 'play') return
    if (draft.length < LEN) return flash('Not enough letters')
    if (!isWord(draft)) return flash(`"${draft.toUpperCase()}" isn't in the list`)

    const m = grade(draft, answer)
    const nextGuesses = [...guesses, draft]
    setGuesses(nextGuesses)
    setMarks([...marks, m])
    setDraft('')

    if (draft === answer) {
      setState('won')
      setIsBest(store.submitScore(meta.id, nextGuesses.length, true))
      sfx('win')
      navigator.vibrate?.([14, 50, 14, 50, 30])
    } else if (nextGuesses.length >= TRIES) {
      setState('lost')
      sfx('lose')
      navigator.vibrate?.([30, 60, 30])
    } else {
      const hits = m.filter((x) => x === 'hit').length
      cue('match', 'success', Math.min(hits, 4))
    }
  }, [draft, answer, guesses, marks, state, meta.id])

  const type = useCallback(
    (ch: string) => {
      if (state !== 'play' || draft.length >= LEN) return
      cue('flip', 'soft')
      setDraft((d) => d + ch)
    },
    [draft, state],
  )

  const back = useCallback(() => {
    if (state !== 'play') return
    cue('tick', 'soft')
    setDraft((d) => d.slice(0, -1))
  }, [state])

  /* physical keyboard on desktop */
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === 'Enter') return submit()
      if (e.key === 'Backspace') return back()
      const k = e.key.toLowerCase()
      if (/^[a-z]$/.test(k)) type(k)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [submit, back, type])

  /** Best-known state of each letter, for keyboard tinting. */
  const keyState = (() => {
    const rank = { miss: 0, near: 1, hit: 2 }
    const out: Record<string, Mark> = {}
    guesses.forEach((g, gi) =>
      g.split('').forEach((ch, i) => {
        const m = marks[gi][i]
        if (!out[ch] || rank[m] > rank[out[ch]]) out[ch] = m
      }),
    )
    return out
  })()

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Guess" value={`${Math.min(guesses.length + 1, TRIES)}/${TRIES}`} accent />
          <Stat label="Best" value={best ? `${best} tries` : '—'} />
        </StatRow>
      }
    >
      <div className="wh">
        <div className="wh__board">
          {Array.from({ length: TRIES }, (_, r) => {
            const submitted = r < guesses.length
            const isCurrent = r === guesses.length && state === 'play'
            const text = submitted ? guesses[r] : isCurrent ? draft : ''

            return (
              <motion.div
                className="wh__row"
                key={r}
                animate={isCurrent && shake ? { x: [0, -9, 9, -6, 0] } : { x: 0 }}
                transition={{ duration: 0.34 }}
              >
                {Array.from({ length: LEN }, (_, c) => {
                  const ch = text[c] ?? ''
                  const mark = submitted ? marks[r][c] : null
                  return (
                    <motion.div
                      key={c}
                      className={`wh__tile${mark ? ` is-${mark}` : ''}${ch && !mark ? ' is-filled' : ''}`}
                      initial={false}
                      animate={
                        submitted
                          ? { rotateX: [0, 90, 0], scale: 1 }
                          : { scale: ch ? [1.12, 1] : 1 }
                      }
                      transition={
                        submitted
                          ? { duration: 0.46, delay: c * 0.1, times: [0, 0.5, 1] }
                          : { type: 'spring', stiffness: 520, damping: 22 }
                      }
                    >
                      {ch.toUpperCase()}
                    </motion.div>
                  )
                })}
              </motion.div>
            )
          })}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div
              className="wh__toast"
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="wh__kb">
          {ROWS.map((row, ri) => (
            <div className="wh__kbrow" key={ri}>
              {ri === 2 && (
                <button className="wh__key wh__key--wide" onClick={submit}>
                  Enter
                </button>
              )}
              {row.split('').map((ch) => (
                <motion.button
                  key={ch}
                  className={`wh__key${keyState[ch] ? ` is-${keyState[ch]}` : ''}`}
                  onClick={() => type(ch)}
                  whileTap={{ scale: 0.9 }}
                >
                  {ch.toUpperCase()}
                </motion.button>
              ))}
              {ri === 2 && (
                <button className="wh__key wh__key--wide" onClick={back}>
                  ⌫
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <ResultOverlay
        open={state !== 'play'}
        won={state === 'won'}
        isBest={state === 'won' && isBest}
        headline={state === 'won' ? praise(guesses.length) : 'Out of guesses'}
        detail={
          <>
            The word was{' '}
            <strong style={{ color: 'var(--lime)', letterSpacing: '0.08em' }}>
              {answer.toUpperCase()}
            </strong>
            {state === 'won' && ` — solved in ${guesses.length} ${guesses.length === 1 ? 'try' : 'tries'}.`}
          </>
        }
        onAgain={reset}
      />
    </GameFrame>
  )
}

function praise(tries: number) {
  return (
    ['Genius!', 'Magnificent', 'Impressive', 'Nicely done', 'Got there', 'Phew — just made it'][
      tries - 1
    ] ?? 'Solved'
  )
}
