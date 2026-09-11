import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useArrowKeys, useStore, useSwipe, type Dir } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, range } from '../../lib/utils'
import { byId } from '../registry'
import { canMove, init, maxTile, move, spawn, SIZE, tileStyle, type Tile } from './logic'
import './Twenty48.css'

export default function Twenty48() {
  const meta = byId('twenty48')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [tiles, setTiles] = useState<Tile[]>(init)
  const [score, setScore] = useState(0)
  const [over, setOver] = useState(false)
  const [isBest, setIsBest] = useState(false)
  const [won, setWon] = useState(false)
  const [gain, setGain] = useState<{ id: number; amount: number } | null>(null)
  const busy = useRef(false)

  const reset = useCallback(() => {
    setTiles(init())
    setScore(0)
    setOver(false)
    setIsBest(false)
    setWon(false)
    setGain(null)
    busy.current = false
  }, [])

  const step = useCallback(
    (dir: Dir) => {
      if (over || busy.current) return
      const res = move(tiles, dir)
      if (!res.moved) {
        cue('tick', 'soft')
        return
      }

      busy.current = true
      const withSpawn = spawn(res.tiles)
      setTiles(withSpawn)

      if (res.gained > 0) {
        setScore((s) => s + res.gained)
        setGain({ id: Date.now(), amount: res.gained })
        sfx('merge', Math.min(Math.log2(res.topMerge) - 1, 6))
        navigator.vibrate?.(res.topMerge >= 128 ? 20 : 8)
      } else {
        cue('whoosh', 'soft')
      }

      // 2048 reached — celebrate once, but let the run continue
      if (res.topMerge >= 2048 && !won) {
        setWon(true)
        sfx('levelup')
      }

      // let the slide animation land before accepting the next input
      setTimeout(() => {
        busy.current = false
        if (!canMove(withSpawn)) setOver(true)
      }, 120)
    },
    [tiles, over, won],
  )

  useArrowKeys(step, !over)
  const swipe = useSwipe(step)

  useEffect(() => {
    if (!over) return
    setIsBest(store.submitScore(meta.id, score))
    sfx('lose')
    navigator.vibrate?.([30, 50, 30])
  }, [over, score, meta.id])

  const top = maxTile(tiles)

  const hud = useMemo(
    () => (
      <StatRow>
        <div className="t48__scorewrap">
          <Stat label="Score" value={fmtNum(score)} accent />
          <AnimatePresence>
            {gain && (
              <motion.span
                key={gain.id}
                className="t48__gain mono"
                initial={{ opacity: 0, y: 6, scale: 0.7 }}
                animate={{ opacity: 1, y: -22, scale: 1 }}
                exit={{ opacity: 0, y: -34 }}
                transition={{ duration: 0.55 }}
                onAnimationComplete={() => setGain(null)}
              >
                +{gain.amount}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        <Stat label="Top tile" value={fmtNum(top)} />
      </StatRow>
    ),
    [score, best, top, gain],
  )

  return (
    <GameFrame game={meta} hud={hud} onRestart={reset}>
      <div className="t48" {...swipe}>
        <div className="t48__grid">
          {range(SIZE * SIZE).map((i) => (
            <span key={i} className="t48__cell" />
          ))}

          <div className="t48__layer">
            {tiles.map((t) => {
              const { bg, fg, glow } = tileStyle(t.value)
              // one step = a quarter of the layer, so each cell sits at n/3 of
              // the leftover space once its own width is accounted for
              const pos = (n: number) => `calc(${n} * (25% + var(--gap) / 4))`
              return (
                <motion.div
                  key={t.id}
                  className="t48__tile"
                  style={{
                    background: bg,
                    color: fg,
                    boxShadow: glow ? `0 0 26px -4px ${glow}` : undefined,
                    fontSize:
                      t.value >= 1024 ? '1.42rem' : t.value >= 128 ? '1.62rem' : '1.9rem',
                  }}
                  initial={{
                    left: pos(t.col),
                    top: pos(t.row),
                    scale: t.fresh ? 0 : 1,
                    opacity: t.fresh ? 0 : 1,
                  }}
                  animate={{
                    left: pos(t.col),
                    top: pos(t.row),
                    scale: t.merged ? [1.18, 1] : 1,
                    opacity: 1,
                  }}
                  transition={{
                    left: { type: 'spring', stiffness: 520, damping: 36 },
                    top: { type: 'spring', stiffness: 520, damping: 36 },
                    scale: { type: 'spring', stiffness: 460, damping: 22 },
                    opacity: { duration: 0.14 },
                  }}
                >
                  {t.value}
                </motion.div>
              )
            })}
          </div>
        </div>

        <p className="t48__hint">
          <span className="t48__hint--touch">Swipe to slide the tiles</span>
          <span className="t48__hint--keys">Use the arrow keys or WASD to slide</span>
        </p>
      </div>

      <ResultOverlay
        open={over}
        won={false}
        isBest={isBest}
        headline="No moves left"
        detail={
          <>
            You scored <strong style={{ color: 'var(--text)' }}>{fmtNum(score)}</strong> and reached
            the <strong style={{ color: 'var(--text)' }}>{fmtNum(top)}</strong> tile.
          </>
        }
        onAgain={reset}
      />

      {/* 2048 milestone, dismissible so the run can continue */}
      <AnimatePresence>
        {won && !over && (
          <motion.button
            className="t48__banner"
            initial={{ opacity: 0, y: -30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -30 }}
            onClick={() => setWon(false)}
          >
            <Icon name="trophy" size={15} />
            2048 reached — tap to keep going
          </motion.button>
        )}
      </AnimatePresence>
    </GameFrame>
  )
}
