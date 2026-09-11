import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, randInt } from '../../lib/utils'
import { byId } from '../registry'
import './TapRush.css'

const DURATION = 30_000
const COMBO_WINDOW = 900

type Target = {
  id: number
  x: number
  y: number
  size: number
  bomb: boolean
  bornAt: number
  life: number
}

type Floater = { id: number; x: number; y: number; text: string; bad?: boolean }

export default function TapRush() {
  const meta = byId('whack')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [targets, setTargets] = useState<Target[]>([])
  const [floaters, setFloaters] = useState<Floater[]>([])
  const [score, setScore] = useState(0)
  const [hits, setHits] = useState(0)
  const [misses, setMisses] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [left, setLeft] = useState(DURATION)
  const [phase, setPhase] = useState<'idle' | 'run' | 'done'>('idle')
  const [isBest, setIsBest] = useState(false)

  const nextId = useRef(1)
  const lastHit = useRef(0)
  const startedAt = useRef(0)

  const reset = useCallback(() => {
    setTargets([])
    setFloaters([])
    setScore(0)
    setHits(0)
    setMisses(0)
    setCombo(0)
    setMaxCombo(0)
    setLeft(DURATION)
    setIsBest(false)
    setPhase('idle')
  }, [])

  const start = () => {
    reset()
    startedAt.current = performance.now()
    setPhase('run')
    cue('levelup', 'heavy')
  }

  /* ---------- countdown ---------- */
  useEffect(() => {
    if (phase !== 'run') return
    let raf = 0
    let lastTick = 0
    const tick = () => {
      const remaining = DURATION - (performance.now() - startedAt.current)
      if (remaining <= 0) {
        setLeft(0)
        setPhase('done')
        return
      }
      setLeft(remaining)
      // audible ticks for the final countdown
      const sec = Math.ceil(remaining / 1000)
      if (sec <= 5 && sec !== lastTick) {
        lastTick = sec
        sfx('tick')
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase])

  /* ---------- spawn targets, faster as time runs out ---------- */
  useEffect(() => {
    if (phase !== 'run') return
    let timeout: number

    const schedule = () => {
      // read elapsed time directly so the ramp-up isn't frozen by a stale closure
      const progress = Math.min(1, (performance.now() - startedAt.current) / DURATION)
      const delay = Math.max(260, 820 - progress * 520)
      timeout = window.setTimeout(() => {
        const bomb = Math.random() < 0.16
        const life = bomb ? 1400 : Math.max(700, 1500 - progress * 620)
        setTargets((ts) => [
          ...ts.slice(-5),
          {
            id: nextId.current++,
            x: randInt(8, 82),
            y: randInt(8, 82),
            size: randInt(52, 78),
            bomb,
            bornAt: performance.now(),
            life,
          },
        ])
        schedule()
      }, delay)
    }
    schedule()
    return () => window.clearTimeout(timeout)
  }, [phase])

  /* ---------- expire targets ---------- */
  useEffect(() => {
    if (phase !== 'run') return
    const id = setInterval(() => {
      const now = performance.now()
      setTargets((ts) => {
        const expired = ts.filter((t) => now - t.bornAt > t.life)
        // letting a good target slip breaks the combo
        if (expired.some((t) => !t.bomb)) {
          setCombo(0)
          setMisses((m) => m + expired.filter((e) => !e.bomb).length)
        }
        return ts.filter((t) => now - t.bornAt <= t.life)
      })
    }, 120)
    return () => clearInterval(id)
  }, [phase])

  /* ---------- record the run ---------- */
  useEffect(() => {
    if (phase !== 'done') return
    setTargets([])
    setIsBest(store.submitScore(meta.id, score))
    sfx('win')
    navigator.vibrate?.([16, 50, 16])
  }, [phase, score, meta.id])

  const float = (f: Omit<Floater, 'id'>) => {
    const id = nextId.current++
    setFloaters((fs) => [...fs.slice(-6), { ...f, id }])
    setTimeout(() => setFloaters((fs) => fs.filter((x) => x.id !== id)), 700)
  }

  const tap = (t: Target) => {
    setTargets((ts) => ts.filter((x) => x.id !== t.id))

    if (t.bomb) {
      setScore((s) => Math.max(0, s - 30))
      setCombo(0)
      setMisses((m) => m + 1)
      cue('lose', 'error')
      float({ x: t.x, y: t.y, text: '−30', bad: true })
      return
    }

    const now = performance.now()
    const chained = now - lastHit.current < COMBO_WINDOW
    const nextCombo = chained ? combo + 1 : 1
    lastHit.current = now

    const mult = Math.min(1 + Math.floor(nextCombo / 4), 5)
    const points = 10 * mult

    setCombo(nextCombo)
    setMaxCombo((m) => Math.max(m, nextCombo))
    setScore((s) => s + points)
    setHits((h) => h + 1)
    sfx('match', Math.min(mult - 1, 4))
    navigator.vibrate?.(8)
    float({ x: t.x, y: t.y, text: mult > 1 ? `+${points} ×${mult}` : `+${points}` })
  }

  const accuracy = hits + misses === 0 ? 0 : Math.round((hits / (hits + misses)) * 100)
  const secs = (left / 1000).toFixed(1)

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Time" value={`${secs}s`} />
          <Stat label="Combo" value={`×${Math.min(1 + Math.floor(combo / 4), 5)}`} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="tr">
        {/* time bar */}
        <div className="tr__bar">
          <motion.span
            className="tr__barfill"
            style={{ width: `${(left / DURATION) * 100}%` }}
            animate={{
              background:
                left < 6000
                  ? 'linear-gradient(90deg,#f43f5e,#fb7185)'
                  : 'linear-gradient(90deg,#fb7185,#f472b6)',
            }}
          />
        </div>

        <div className="tr__arena">
          <AnimatePresence>
            {targets.map((t) => (
              <motion.button
                key={t.id}
                className={`tr__t${t.bomb ? ' is-bomb' : ''}`}
                style={{ left: `${t.x}%`, top: `${t.y}%`, width: t.size, height: t.size }}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.5, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 460, damping: 22 }}
                onPointerDown={() => tap(t)}
                aria-label={t.bomb ? 'Bomb — do not tap' : 'Target'}
              >
                <span className="tr__tinner">{t.bomb ? '💣' : '◎'}</span>
                <motion.span
                  className="tr__tring"
                  initial={{ scale: 1, opacity: 0.55 }}
                  animate={{ scale: 0, opacity: 0 }}
                  transition={{ duration: t.life / 1000, ease: 'linear' }}
                />
              </motion.button>
            ))}
          </AnimatePresence>

          {/* score floaters */}
          <AnimatePresence>
            {floaters.map((f) => (
              <motion.span
                key={f.id}
                className={`tr__float mono${f.bad ? ' is-bad' : ''}`}
                style={{ left: `${f.x}%`, top: `${f.y}%` }}
                initial={{ opacity: 1, y: 0, scale: 0.8 }}
                animate={{ opacity: 0, y: -48, scale: 1.15 }}
                transition={{ duration: 0.7 }}
              >
                {f.text}
              </motion.span>
            ))}
          </AnimatePresence>

          {combo >= 4 && phase === 'run' && (
            <motion.div
              className="tr__combo"
              key={Math.floor(combo / 4)}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {combo} chain!
            </motion.div>
          )}

          {phase === 'idle' && (
            <motion.button
              className="tr__veil"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              onClick={start}
            >
              <strong>Tap to start</strong>
              <span>30 seconds · chain hits for multipliers · avoid 💣</span>
            </motion.button>
          )}
        </div>
      </div>

      <ResultOverlay
        open={phase === 'done'}
        won
        isBest={isBest}
        headline={`${fmtNum(score)} points`}
        detail={
          <>
            {hits} hits · {accuracy}% accuracy · best chain ×{maxCombo}
          </>
        }
        onAgain={start}
      />
    </GameFrame>
  )
}
