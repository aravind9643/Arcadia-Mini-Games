import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { IconButton, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import {
  executePour,
  generateLevel,
  getPourAmount,
  isLevelSolved,
  isTubeSolved,
  LIQUID_COLORS,
  type Tube,
} from './logic'
import './WaterSort.css'

interface ActivePour {
  fromIndex: number
  toIndex: number
  color: string
  amount: number
  startX: number
  startY: number
  targetX: number
  targetY: number
  width: number
  height: number
  sourceLayers: string[]
  isRight: boolean
  phase: 'flight' | 'pouring' | 'return'
}

export default function WaterSort() {
  const meta = byId('watersort')!
  const bestScore = useStore().scores[meta.id]?.best ?? 1

  const [level, setLevel] = useState(1)
  const [tubes, setTubes] = useState<Tube[]>(() => generateLevel(1).tubes)
  const [selectedTube, setSelectedTube] = useState<number | null>(null)
  const [shakeTube, setShakeTube] = useState<number | null>(null)
  const [history, setHistory] = useState<Tube[][]>([])
  const [moves, setMoves] = useState(0)
  const [won, setWon] = useState(false)
  const [isBest, setIsBest] = useState(false)
  const [extraTubeUsed, setExtraTubeUsed] = useState(false)
  const [activePour, setActivePour] = useState<ActivePour | null>(null)

  const tubesRef = useRef<Tube[]>(tubes)
  const standRef = useRef<HTMLDivElement | null>(null)
  const tubeEls = useRef<(HTMLDivElement | null)[]>([])
  const animTimers = useRef<number[]>([])

  useEffect(() => {
    tubesRef.current = tubes
  }, [tubes])

  const clearAnimTimers = useCallback(() => {
    animTimers.current.forEach((id) => window.clearTimeout(id))
    animTimers.current = []
  }, [])

  useEffect(() => {
    return () => clearAnimTimers()
  }, [clearAnimTimers])

  const colorMap = useMemo(() => {
    const map = new Map<string, (typeof LIQUID_COLORS)[0]>()
    for (const c of LIQUID_COLORS) {
      map.set(c.id, c)
    }
    return map
  }, [])

  const startLevel = useCallback(
    (lvl: number) => {
      clearAnimTimers()
      const cfg = generateLevel(lvl)
      setTubes(cfg.tubes)
      tubesRef.current = cfg.tubes
      setSelectedTube(null)
      setShakeTube(null)
      setActivePour(null)
      setHistory([])
      setMoves(0)
      setWon(false)
      setIsBest(false)
      setExtraTubeUsed(false)
    },
    [clearAnimTimers],
  )

  const restartCurrentLevel = useCallback(() => {
    cue('tap')
    startLevel(level)
  }, [level, startLevel])

  const handleNextLevel = useCallback(() => {
    const nextLevel = level + 1
    setLevel(nextLevel)
    const isNewBest = store.submitScore(meta.id, nextLevel)
    setIsBest(isNewBest)
    startLevel(nextLevel)
  }, [level, meta.id, startLevel])

  /**
   * Undoes the last move
   */
  const handleUndo = useCallback(() => {
    if (history.length === 0 || activePour !== null || won) return
    clearAnimTimers()
    cue('pop', 'soft')
    const prev = history[history.length - 1]
    setTubes(prev)
    tubesRef.current = prev
    setHistory((h) => h.slice(0, -1))
    setSelectedTube(null)
    setActivePour(null)
  }, [activePour, clearAnimTimers, history, won])

  /**
   * Adds an extra empty tube power-up
   */
  const handleAddExtraTube = useCallback(() => {
    if (extraTubeUsed || won || activePour !== null) return
    cue('pop', 'tap')
    sfx('match')
    setExtraTubeUsed(true)
    setTubes((t) => [...t, []])
    tubesRef.current = [...tubesRef.current, []]
  }, [activePour, extraTubeUsed, won])

  /**
   * Handles clicking on a tube
   */
  const handleTubeClick = useCallback(
    (tubeIndex: number) => {
      if (won || activePour !== null) return

      const currentTubes = tubesRef.current

      // No tube selected yet: select this tube if it has liquid
      if (selectedTube === null) {
        if (currentTubes[tubeIndex].length === 0) {
          cue('tick', 'error')
          return
        }
        cue('pop', 'tap')
        sfx('tap')
        setSelectedTube(tubeIndex)
        return
      }

      // Clicking already selected tube: deselect it
      if (selectedTube === tubeIndex) {
        cue('pop', 'soft')
        setSelectedTube(null)
        return
      }

      // Check if pour is legal
      const pourAmount = getPourAmount(currentTubes[selectedTube], currentTubes[tubeIndex])

      if (pourAmount === 0) {
        // If clicked tube has liquid, switch selection to it seamlessly
        if (currentTubes[tubeIndex].length > 0) {
          cue('pop', 'tap')
          sfx('tap')
          setSelectedTube(tubeIndex)
        } else {
          // Empty or invalid destination: shake active tube
          cue('tick', 'error')
          setShakeTube(selectedTube)
          const timer = window.setTimeout(() => setShakeTube(null), 360)
          animTimers.current.push(timer)
        }
        return
      }

      // Measure exact coordinates relative to the stand
      const standEl = standRef.current
      const fromEl = tubeEls.current[selectedTube]
      const toEl = tubeEls.current[tubeIndex]

      if (!standEl || !fromEl || !toEl) return

      const standRect = standEl.getBoundingClientRect()
      const fromRect = fromEl.getBoundingClientRect()
      const toRect = toEl.getBoundingClientRect()

      const startX = fromRect.left - standRect.left
      const startY = fromRect.top - standRect.top
      const targetX = toRect.left - standRect.left
      const targetY = toRect.top - standRect.top
      const isRight = targetX >= startX

      const sourceTube = currentTubes[selectedTube]
      const liquidColor = sourceTube[sourceTube.length - 1]

      // Record undo snapshot
      setHistory((h) => [...h, currentTubes.map((t) => [...t])])
      setMoves((m) => m + 1)

      // Start Step 1: Flight towards destination
      setActivePour({
        fromIndex: selectedTube,
        toIndex: tubeIndex,
        color: liquidColor,
        amount: pourAmount,
        startX,
        startY,
        targetX,
        targetY,
        width: fromRect.width,
        height: fromRect.height,
        sourceLayers: [...sourceTube],
        isRight,
        phase: 'flight',
      })
      sfx('whoosh')

      // Step 2: Deep tilt & flow liquid stream
      const t1 = window.setTimeout(() => {
        setActivePour((p) => (p ? { ...p, phase: 'pouring' } : null))
        sfx('pop')
        const tPop1 = window.setTimeout(() => sfx('pop'), 110)
        const tPop2 = window.setTimeout(() => sfx('pop'), 220)
        animTimers.current.push(tPop1, tPop2)

        // Step 3: Finish liquid transfer and return tube upright
        const t2 = window.setTimeout(() => {
          const result = executePour(currentTubes, selectedTube, tubeIndex)
          if (result) {
            setTubes(result.newTubes)
            tubesRef.current = result.newTubes

            if (isTubeSolved(result.newTubes[tubeIndex])) {
              sfx('match', 3)
              cue('pop', 'heavy')
            }

            if (isLevelSolved(result.newTubes)) {
              setWon(true)
              const isNewBest = store.submitScore(meta.id, level)
              setIsBest(isNewBest)
              sfx('win')
            }
          }

          setActivePour((p) => (p ? { ...p, phase: 'return' } : null))

          // Step 4: Return flight complete
          const t3 = window.setTimeout(() => {
            setActivePour(null)
            setSelectedTube(null)
          }, 260)
          animTimers.current.push(t3)
        }, 480)
        animTimers.current.push(t2)
      }, 240)
      animTimers.current.push(t1)
    },
    [activePour, level, meta.id, selectedTube, won],
  )

  // Split tubes into neat balanced rows
  const tubeRows = useMemo(() => {
    const total = tubes.length
    if (total <= 4) {
      return [tubes.map((tube, idx) => ({ tube, idx }))]
    }
    const half = Math.ceil(total / 2)
    return [
      tubes.slice(0, half).map((tube, idx) => ({ tube, idx })),
      tubes.slice(half).map((tube, idx) => ({ tube, idx: idx + half })),
    ]
  }, [tubes])

  const activeColorDef = activePour ? colorMap.get(activePour.color) : null

  return (
    <GameFrame
      game={meta}
      onRestart={restartCurrentLevel}
      hud={
        <StatRow>
          <Stat label="Level" value={level} accent />
          <Stat label="Moves" value={moves} />
          <Stat label="Best" value={Math.max(bestScore, level)} />
        </StatRow>
      }
      actions={
        <>
          <IconButton
            label="Undo move"
            onClick={handleUndo}
            disabled={history.length === 0 || won || activePour !== null}
          >
            <Icon name="undo" size={18} />
          </IconButton>
          <IconButton
            label="Restart level"
            onClick={restartCurrentLevel}
            disabled={activePour !== null}
          >
            <Icon name="restart" size={18} />
          </IconButton>
        </>
      }
    >
      <div className="ws">
        {/* Laboratory Stand Tray */}
        <div className="ws__stand" ref={standRef}>
          {/* Static Tubes Rows */}
          <div className="ws__rack">
            {tubeRows.map((row, rIdx) => (
              <div className="ws__row" key={rIdx}>
                {row.map(({ tube, idx }) => {
                  const isSelected = selectedTube === idx && activePour?.fromIndex !== idx
                  const isShaking = shakeTube === idx
                  const isSolved = isTubeSolved(tube)
                  const isHidden = activePour?.fromIndex === idx
                  const isReceiving =
                    activePour?.toIndex === idx && activePour.phase === 'pouring'

                  return (
                    <div
                      key={idx}
                      ref={(el) => {
                        tubeEls.current[idx] = el
                      }}
                      className={`ws__tube-wrapper ${
                        isSelected ? 'ws__tube-wrapper--selected' : ''
                      } ${isShaking ? 'ws__tube-wrapper--shake' : ''} ${
                        isSolved ? 'ws__tube-wrapper--solved' : ''
                      }`}
                      style={{
                        visibility: isHidden ? 'hidden' : 'visible',
                      }}
                      onClick={() => handleTubeClick(idx)}
                    >
                      {/* Tube Rim Collar */}
                      <div className="ws__tube-rim">
                        <div className="ws__rim-shine" />
                      </div>

                      {/* Glass Body */}
                      <div className="ws__tube">
                        {/* Specular Highlight Stripe */}
                        <div className="ws__tube-shine" />

                        {/* Etched Volume Graduation Ticks */}
                        <div className="ws__tube-grad">
                          <span className="ws__grad-line" />
                          <span className="ws__grad-line" />
                          <span className="ws__grad-line" />
                        </div>

                        {/* Liquid Stack */}
                        <div className="ws__liquid-column">
                          {tube.map((colorId, layerIdx) => {
                            const cDef = colorMap.get(colorId)
                            const isTop = layerIdx === tube.length - 1

                            return (
                              <div
                                key={layerIdx}
                                className="ws__liquid-layer"
                                style={{
                                  background: `linear-gradient(180deg, ${cDef?.surface ?? '#ff668a'} 0%, ${cDef?.hex ?? '#ff2a5f'} 45%, ${cDef?.dark ?? '#990026'} 100%)`,
                                }}
                              >
                                {isTop && (
                                  <div
                                    className="ws__meniscus"
                                    style={{ backgroundColor: cDef?.surface ?? '#ff668a' }}
                                  />
                                )}
                              </div>
                            )
                          })}

                          {/* Rising incoming liquid animation in receiving tube */}
                          {isReceiving && activeColorDef && (
                            <div
                              className="ws__liquid-layer ws__liquid-layer--filling"
                              style={{
                                height: `${activePour.amount * 25}%`,
                                background: `linear-gradient(180deg, ${activeColorDef.surface} 0%, ${activeColorDef.hex} 45%, ${activeColorDef.dark} 100%)`,
                              }}
                            >
                              <div
                                className="ws__meniscus"
                                style={{ backgroundColor: activeColorDef.surface }}
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tube Floor Shadow */}
                      <div className="ws__tube-shadow" />

                      {/* Solved Star Check Badge */}
                      {isSolved && (
                        <div className="ws__solved-badge">
                          <Icon name="star-filled" size={13} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Absolute Pouring Liquid Stream Jet */}
          {activePour && activePour.phase === 'pouring' && activeColorDef && (
            <div
              className="ws__overlay-stream"
              style={{
                left: `${activePour.targetX + activePour.width / 2}px`,
                top: `${activePour.targetY - 14}px`,
                background: `linear-gradient(180deg, ${activeColorDef.surface} 0%, ${activeColorDef.hex} 60%, ${activeColorDef.dark} 100%)`,
                boxShadow: `0 0 10px ${activeColorDef.glow}`,
              }}
            />
          )}

          {/* Absolute Flight Overlay Tube */}
          {activePour && (
            <div
              className="ws__overlay-tube"
              style={{
                left: `${activePour.startX}px`,
                top: `${activePour.startY}px`,
                width: `${activePour.width}px`,
                height: `${activePour.height}px`,
                transform: (() => {
                  const dx = activePour.targetX - activePour.startX
                  const dy = activePour.targetY - activePour.startY
                  const isRight = activePour.isRight

                  if (activePour.phase === 'flight') {
                    const tx = dx + (isRight ? -14 : 14)
                    const ty = dy - 34
                    const rot = isRight ? 54 : -54
                    return `translate(${tx}px, ${ty}px) rotate(${rot}deg)`
                  }

                  if (activePour.phase === 'pouring') {
                    const tx = dx + (isRight ? -14 : 14)
                    const ty = dy - 34
                    const rot = isRight ? 72 : -72
                    return `translate(${tx}px, ${ty}px) rotate(${rot}deg)`
                  }

                  // return phase
                  return 'translate(0px, 0px) rotate(0deg)'
                })(),
                transition:
                  activePour.phase === 'flight'
                    ? 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)'
                    : activePour.phase === 'pouring'
                    ? 'transform 0.18s ease-out'
                    : 'transform 0.26s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            >
              {/* Tube Rim Collar */}
              <div className="ws__tube-rim">
                <div className="ws__rim-shine" />
              </div>

              {/* Glass Body */}
              <div className="ws__tube">
                <div className="ws__tube-shine" />
                <div className="ws__tube-grad">
                  <span className="ws__grad-line" />
                  <span className="ws__grad-line" />
                  <span className="ws__grad-line" />
                </div>

                <div className="ws__liquid-column">
                  {activePour.sourceLayers.map((colorId, layerIdx) => {
                    const cDef = colorMap.get(colorId)
                    const isPouringLayer =
                      activePour.phase === 'pouring' &&
                      layerIdx >= activePour.sourceLayers.length - activePour.amount

                    return (
                      <div
                        key={layerIdx}
                        className={`ws__liquid-layer ${
                          isPouringLayer ? 'ws__liquid-layer--draining' : ''
                        }`}
                        style={{
                          background: `linear-gradient(180deg, ${cDef?.surface ?? '#ff668a'} 0%, ${cDef?.hex ?? '#ff2a5f'} 45%, ${cDef?.dark ?? '#990026'} 100%)`,
                        }}
                      />
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="ws__actions">
          <button
            className="ws__action-btn"
            onClick={handleUndo}
            disabled={history.length === 0 || won || activePour !== null}
          >
            <Icon name="undo" size={16} />
            <span>Undo ({history.length})</span>
          </button>

          {!extraTubeUsed && !won && (
            <button
              className="ws__action-btn ws__action-btn--accent"
              onClick={handleAddExtraTube}
              disabled={activePour !== null}
            >
              <Icon name="flask" size={16} />
              <span>+1 Tube</span>
            </button>
          )}

          <button
            className="ws__action-btn"
            onClick={restartCurrentLevel}
            disabled={activePour !== null}
          >
            <Icon name="restart" size={16} />
            <span>Restart</span>
          </button>
        </div>

        {/* Level Complete Overlay */}
        <ResultOverlay
          open={won}
          won={true}
          headline={`Level ${level} Cleared!`}
          detail={
            <span>
              All colors sorted with precision in <strong>{moves}</strong> moves.
            </span>
          }
          isBest={isBest}
          onAgain={handleNextLevel}
          againLabel="Next Level"
        />
      </div>
    </GameFrame>
  )
}
