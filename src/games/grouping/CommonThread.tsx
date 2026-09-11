import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Button, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { shuffle } from '../../lib/utils'
import { byId } from '../registry'
import { PUZZLES, randomPuzzle, TIER_COLORS, type Group } from './puzzles'
import './CommonThread.css'

const MAX_MISTAKES = 4

type Solved = Group & { tier: number }

export default function CommonThread() {
  const meta = byId('grouping')!
  // 0 mistakes is a legitimate best, so distinguish "unset" from zero
  const bestEntry = useStore().scores[meta.id]
  const best = bestEntry?.best

  const [puzIndex, setPuzIndex] = useState(randomPuzzle)
  const puzzle = PUZZLES[puzIndex]

  const [pool, setPool] = useState(() => shuffle(puzzle.flatMap((g) => g.words)))
  const [picked, setPicked] = useState<string[]>([])
  const [solved, setSolved] = useState<Solved[]>([])
  const [mistakes, setMistakes] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [isBest, setIsBest] = useState(false)

  const lost = mistakes >= MAX_MISTAKES
  const won = solved.length === 4
  const over = won || lost

  const reset = useCallback(() => {
    const i = randomPuzzle(puzIndex)
    setPuzIndex(i)
    setPool(shuffle(PUZZLES[i].flatMap((g) => g.words)))
    setPicked([])
    setSolved([])
    setMistakes(0)
    setToast(null)
    setIsBest(false)
  }, [puzIndex])

  const flash = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 1400)
  }

  const toggle = (w: string) => {
    if (over) return
    if (picked.includes(w)) {
      setPicked((p) => p.filter((x) => x !== w))
      cue('tick', 'soft')
    } else if (picked.length < 4) {
      setPicked((p) => [...p, w])
      cue('tap', 'soft')
    }
  }

  const submit = () => {
    if (picked.length !== 4 || over) return

    const tier = puzzle.findIndex((g) => picked.every((w) => g.words.includes(w)))

    if (tier >= 0) {
      setSolved((s) => [...s, { ...puzzle[tier], tier }])
      setPool((p) => p.filter((w) => !picked.includes(w)))
      setPicked([])
      cue('match', 'success', solved.length)

      if (solved.length + 1 === 4) {
        setIsBest(store.submitScore(meta.id, mistakes, true))
        sfx('win')
        navigator.vibrate?.([14, 50, 14, 50, 30])
      }
      return
    }

    // "one away" is the signature near-miss of this format
    const closest = Math.max(
      ...puzzle.map((g) => picked.filter((w) => g.words.includes(w)).length),
    )
    setMistakes((m) => m + 1)
    setShake((s) => s + 1)
    flash(closest === 3 ? 'One away…' : 'Not a group')
    cue('lose', 'error')
  }

  const deselect = () => {
    setPicked([])
    cue('tick', 'soft')
  }

  const reshuffle = () => {
    setPool((p) => shuffle(p))
    cue('whoosh', 'soft')
  }

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Groups" value={`${solved.length}/4`} accent />
          <Stat label="Mistakes" value={`${mistakes}/${MAX_MISTAKES}`} />
          <Stat label="Best" value={best ?? '—'} />
        </StatRow>
      }
    >
      <div className="ct">
        {/* solved rows stack above the remaining pool */}
        <div className="ct__solved">
          <AnimatePresence>
            {solved.map((g) => (
              <motion.div
                key={g.theme}
                className="ct__row"
                style={{ background: TIER_COLORS[g.tier] }}
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 26 }}
              >
                <strong>{g.theme}</strong>
                <span>{g.words.join(' · ')}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        <motion.div
          className="ct__grid"
          animate={shake ? { x: [0, -8, 8, -5, 0] } : { x: 0 }}
          transition={{ duration: 0.34 }}
        >
          {pool.map((w) => (
            <motion.button
              key={w}
              layout
              className={`ct__c${picked.includes(w) ? ' is-on' : ''}`}
              onClick={() => toggle(w)}
              whileTap={{ scale: 0.94 }}
              transition={{ type: 'spring', stiffness: 460, damping: 30 }}
            >
              {w}
            </motion.button>
          ))}
        </motion.div>

        <AnimatePresence>
          {toast && (
            <motion.div
              className="ct__toast"
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
            >
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        {/* remaining-chances dots */}
        <div className="ct__lives" aria-label={`${MAX_MISTAKES - mistakes} mistakes remaining`}>
          <span>Mistakes left</span>
          {Array.from({ length: MAX_MISTAKES }, (_, i) => (
            <motion.i
              key={i}
              className={i < MAX_MISTAKES - mistakes ? 'is-on' : ''}
              animate={{ scale: i < MAX_MISTAKES - mistakes ? 1 : 0.6 }}
            />
          ))}
        </div>

        <div className="ct__tools">
          <Button size="sm" variant="surface" onClick={reshuffle} disabled={over}>
            Shuffle
          </Button>
          <Button size="sm" variant="surface" onClick={deselect} disabled={picked.length === 0}>
            Clear
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={submit}
            disabled={picked.length !== 4 || over}
          >
            Submit
          </Button>
        </div>
      </div>

      <ResultOverlay
        open={over}
        won={won}
        isBest={won && isBest}
        headline={won ? (mistakes === 0 ? 'Flawless!' : 'Solved!') : 'Out of guesses'}
        detail={
          won
            ? `All four groups found with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`
            : `The groups were: ${puzzle.map((g) => g.theme).join(', ')}.`
        }
        againLabel="New puzzle"
        onAgain={reset}
      />
    </GameFrame>
  )
}
