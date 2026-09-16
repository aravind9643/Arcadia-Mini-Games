import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { Button, IconButton, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import {
  buildArrowTrack,
  computeExit,
  DIR_DELTA,
  findEscapableArrows,
  generateLevel,
  sliceTrack,
  type ArrowDirection,
  type ArrowModel,
  type ArrowTrack,
  type LevelData,
} from './logic'
import './ArrowEscape.css'

type GameTheme = 'classic' | 'neon' | 'cyber' | 'sunset'

interface AnimatingArrow {
  id: string
  type: 'exiting' | 'blocked'
  track: ArrowTrack
  startTime: number
  duration: number
}

const THEME_STYLES: Record<
  GameTheme,
  { bg: string; arrow: string; accent: string; dot: string; glow: boolean }
> = {
  classic: {
    bg: '#161719',
    arrow: '#ffffff',
    accent: '#76ed12',
    dot: 'rgba(255, 255, 255, 0.16)',
    glow: false,
  },
  neon: {
    bg: '#0f0c20',
    arrow: '#00ffcc',
    accent: '#00ffcc',
    dot: 'rgba(0, 255, 204, 0.22)',
    glow: true,
  },
  cyber: {
    bg: '#0d0211',
    arrow: '#ff007f',
    accent: '#9d00ff',
    dot: 'rgba(255, 0, 127, 0.22)',
    glow: true,
  },
  sunset: {
    bg: '#140d1c',
    arrow: '#ffc107',
    accent: '#ff5722',
    dot: 'rgba(255, 193, 7, 0.22)',
    glow: true,
  },
}

export default function ArrowEscape() {
  const meta = byId('arrowescape')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const [theme, setTheme] = useState<GameTheme>('classic')
  const [level, setLevel] = useState(1)
  const [levelData, setLevelData] = useState<LevelData>(() => generateLevel(1))
  const [remainingCount, setRemainingCount] = useState(levelData.arrows.length)
  const [lives, setLives] = useState(3)
  const [isZen, setIsZen] = useState(false)
  const [combo, setCombo] = useState(0)

  const [won, setWon] = useState(false)
  const [gameOver, setGameOver] = useState(false)
  const [isBest, setIsBest] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const arrowsRef = useRef<ArrowModel[]>(
    levelData.arrows.map((a) => ({ ...a, path: [...a.path] })),
  )
  const animsRef = useRef<Map<string, AnimatingArrow>>(new Map())
  const hintArrowIdRef = useRef<string | null>(null)
  const lastExitTime = useRef<number>(0)
  const hintTimeout = useRef<number | null>(null)

  const tracksMap = useMemo(() => {
    const map = new Map<string, ArrowTrack>()
    for (const a of levelData.arrows) {
      map.set(a.id, buildArrowTrack(a, levelData.gridSize))
    }
    return map
  }, [levelData])

  const loadLevel = useCallback((lvl: number) => {
    const data = generateLevel(lvl)
    setLevel(lvl)
    setLevelData(data)
    arrowsRef.current = data.arrows.map((a) => ({ ...a, path: [...a.path] }))
    setRemainingCount(data.arrows.length)
    setLives(3)
    setCombo(0)
    hintArrowIdRef.current = null
    animsRef.current.clear()
    setWon(false)
    setGameOver(false)
    setIsBest(false)
  }, [])

  const restartCurrent = useCallback(() => {
    loadLevel(level)
  }, [level, loadLevel])

  // Core trigger on instant pointerdown
  const triggerArrow = useCallback(
    (arrow: ArrowModel) => {
      if (won || gameOver || animsRef.current.has(arrow.id) || arrow.state === 'sliding') return

      const exit = computeExit(arrow, arrowsRef.current, levelData.gridSize)
      const track = tracksMap.get(arrow.id) || buildArrowTrack(arrow, levelData.gridSize)

      if (exit.blocked) {
        cue('tick', 'error')
        setCombo(0)

        animsRef.current.set(arrow.id, {
          id: arrow.id,
          type: 'blocked',
          track,
          startTime: performance.now(),
          duration: 340,
        })

        if (!isZen) {
          setLives((prev) => {
            const next = prev - 1
            if (next <= 0) {
              sfx('lose')
              setGameOver(true)
            }
            return Math.max(0, next)
          })
        }
        return
      }

      // Successful Escape: slither along track smoothly
      const now = performance.now()
      if (now - lastExitTime.current < 1600) {
        const nextCombo = combo + 1
        setCombo(nextCombo)
        if (nextCombo >= 2) {
          sfx('match', Math.min(nextCombo, 4))
        } else {
          cue('whoosh', 'soft')
        }
      } else {
        setCombo(1)
        cue('whoosh', 'soft')
      }
      lastExitTime.current = now

      const duration = 320 + arrow.path.length * 50
      arrow.state = 'sliding'

      animsRef.current.set(arrow.id, {
        id: arrow.id,
        type: 'exiting',
        track,
        startTime: performance.now(),
        duration,
      })

      if (hintArrowIdRef.current === arrow.id) {
        hintArrowIdRef.current = null
      }
    },
    [combo, gameOver, isZen, levelData.gridSize, tracksMap, won],
  )

  // Touch & Pointer handlers with immediate response and forgiving radius
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.preventDefault()
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const cellSize = rect.width / levelData.gridSize

      const col = Math.floor(x / cellSize)
      const row = Math.floor(y / cellSize)

      // 1. Direct cell hit on non-sliding arrow
      let hit = arrowsRef.current.find(
        (a) => a.state !== 'sliding' && a.path.some((p) => p[0] === row && p[1] === col),
      )

      // 2. Forgiving nearest check within 0.58 cell
      if (!hit) {
        const gridX = x / cellSize
        const gridY = y / cellSize
        let minDist = 0.58
        for (const a of arrowsRef.current) {
          if (a.state === 'sliding') continue
          for (const p of a.path) {
            const d = Math.hypot(gridX - (p[1] + 0.5), gridY - (p[0] + 0.5))
            if (d < minDist) {
              minDist = d
              hit = a
            }
          }
        }
      }

      if (hit) {
        triggerArrow(hit)
      }
    },
    [levelData.gridSize, triggerArrow],
  )

  // 60-120 FPS native Canvas renderer with zero React re-render overhead
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: false })
    if (!ctx) return

    let animId = 0
    let running = true

    const render = (now: number) => {
      if (!running) return

      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const sizePx = Math.floor(rect.width)

      if (canvas.width !== sizePx * dpr || canvas.height !== sizePx * dpr) {
        canvas.width = sizePx * dpr
        canvas.height = sizePx * dpr
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      const themeConfig = THEME_STYLES[theme]
      const { gridSize } = levelData
      const cellSize = sizePx / gridSize
      const sw = Math.max(2, cellSize * 0.13)

      // Background
      ctx.fillStyle = themeConfig.bg
      ctx.fillRect(0, 0, sizePx, sizePx)

      // Grid Dots
      ctx.fillStyle = themeConfig.dot
      const dotRadius = Math.max(1, cellSize * 0.04)
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          ctx.beginPath()
          ctx.arc((c + 0.5) * cellSize, (r + 0.5) * cellSize, dotRadius, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Handle active continuous animations
      const completedIds: string[] = []

      for (const [id, anim] of animsRef.current.entries()) {
        const elapsed = now - anim.startTime
        const progress = Math.min(1, elapsed / anim.duration)

        if (anim.type === 'exiting' && progress >= 1) {
          completedIds.push(id)
        } else if (anim.type === 'blocked' && progress >= 1) {
          animsRef.current.delete(id)
        }
      }

      if (completedIds.length > 0) {
        for (const cid of completedIds) {
          animsRef.current.delete(cid)
        }
        arrowsRef.current = arrowsRef.current.filter((a) => !completedIds.includes(a.id))
        setRemainingCount(arrowsRef.current.length)

        if (arrowsRef.current.length === 0) {
          sfx('win')
          const recordedBest = store.submitScore(meta.id, level)
          setIsBest(recordedBest)
          setWon(true)
        }
      }

      // Render Arrows
      for (const arrow of arrowsRef.current) {
        const anim = animsRef.current.get(arrow.id)
        const isHinted = hintArrowIdRef.current === arrow.id
        let pts: [number, number][]
        let isBlocked = false

        if (anim) {
          const elapsed = now - anim.startTime
          const progress = Math.min(1, elapsed / anim.duration)
          const { track, dist, headDist, tailDist } = anim.track

          if (anim.type === 'exiting') {
            if (progress >= 1) continue
            const traveled = progress * tailDist
            const animHead = Math.max(0, headDist - traveled)
            const animTail = Math.max(0, tailDist - traveled)
            pts = sliceTrack(track, dist, animHead, animTail)
          } else {
            // Blocked: in-place perpendicular shake with decay (never translates along track)
            isBlocked = true
            const p = progress
            const decay = 1 - p
            const shake = Math.sin(p * Math.PI * 10) * 0.12 * decay
            const [dr, dc] = DIR_DELTA[arrow.direction]
            const perpX = -dr * shake
            const perpY = dc * shake
            pts = arrow.path.map((pt) => [pt[1] + 0.5 + perpX, pt[0] + 0.5 + perpY])
          }
        } else if (arrow.state !== 'sliding') {
          pts = arrow.path.map((p) => [p[1] + 0.5, p[0] + 0.5])
        } else {
          continue
        }

        if (pts.length === 0) continue

        // Draw arrow with authentic Skia/Flutter stroke math
        drawArrow(ctx, pts, arrow.direction, cellSize, sw, themeConfig, isHinted, isBlocked)
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => {
      running = false
      cancelAnimationFrame(animId)
    }
  }, [level, levelData, meta.id, theme])

  const handleHint = useCallback(() => {
    if (won || gameOver) return
    const escapable = findEscapableArrows(arrowsRef.current, levelData.gridSize)
    if (escapable.length > 0) {
      cue('tick', 'tap')
      hintArrowIdRef.current = escapable[0].id
      if (hintTimeout.current) clearTimeout(hintTimeout.current)
      hintTimeout.current = window.setTimeout(() => {
        hintArrowIdRef.current = null
      }, 2400)
    }
  }, [gameOver, levelData.gridSize, won])

  useEffect(() => {
    return () => {
      if (hintTimeout.current) clearTimeout(hintTimeout.current)
    }
  }, [])

  const nextTheme = () => {
    cue('tap')
    const themes: GameTheme[] = ['classic', 'neon', 'cyber', 'sunset']
    const nextIdx = (themes.indexOf(theme) + 1) % themes.length
    setTheme(themes[nextIdx])
  }

  return (
    <GameFrame
      game={meta}
      onRestart={restartCurrent}
      hud={
        <StatRow>
          <Stat
            label="Level"
            value={
              combo >= 2 ? (
                <span className="ae__level-val">
                  <span>{level}</span>
                  <span className="ae__combo-badge">
                    <Icon name="bolt" size={10} weight={2.5} />
                    <span>{combo}x</span>
                  </span>
                </span>
              ) : (
                level
              )
            }
            accent
          />
          <Stat label="Lives" value={isZen ? '∞' : ('●'.repeat(Math.max(0, lives)) || '—')} />
          <Stat label="Left" value={remainingCount} />
          <Stat label="Best" value={Math.max(best, level - 1)} />
        </StatRow>
      }
      actions={
        <>
          <IconButton
            label={`Theme: ${theme}`}
            onClick={nextTheme}
          >
            <Icon name="swatch" size={18} />
          </IconButton>
          <IconButton
            label="Hint"
            disabled={remainingCount === 0}
            onClick={handleHint}
          >
            <Icon name="bulb" size={18} />
          </IconButton>
          <IconButton
            label={isZen ? 'Switch to Classic (3 lives)' : 'Switch to Zen (infinite lives)'}
            onClick={() => {
              cue('tap')
              setIsZen((z) => !z)
            }}
          >
            <Icon name={isZen ? 'sun' : 'sparkles'} size={18} />
          </IconButton>
        </>
      }
    >
      <div className={`ae ae-theme-${theme}`}>
        {/* High-Performance Canvas Board matching standard game frame */}
        <div className="ae__board">
          <canvas
            ref={canvasRef}
            className="ae__canvas"
            onPointerDown={handlePointerDown}
          />
        </div>

        {/* Victory Overlay */}
        <ResultOverlay
          open={won}
          won
          headline={`Level ${level} Cleared!`}
          detail={
            <span>
              All arrows escaped safely.{' '}
              {isZen ? 'Zen flow mastered.' : `${lives} ${lives === 1 ? 'life' : 'lives'} intact.`}
            </span>
          }
          isBest={isBest}
          onAgain={() => loadLevel(level + 1)}
          againLabel="Next Level"
        />

        {/* Game Over Overlay */}
        <ResultOverlay
          open={gameOver}
          won={false}
          headline="Trapped in the Grid"
          detail={
            <span>
              Out of lives on Level {level}. Re-plan your sequence and try again!
            </span>
          }
          onAgain={restartCurrent}
          againLabel="Try Again"
          extra={
            <Button
              variant="surface"
              full
              style={{ marginTop: 8 }}
              onClick={() => {
                setIsZen(true)
                setLives(3)
                setGameOver(false)
              }}
            >
              Continue in Zen Mode
            </Button>
          }
        />
      </div>
    </GameFrame>
  )
}

/**
 * Renders an arrow onto 2D Canvas with exact Flutter Flame Skia math
 */
function drawArrow(
  ctx: CanvasRenderingContext2D,
  pts: [number, number][],
  direction: ArrowDirection,
  cellSize: number,
  sw: number,
  themeConfig: { bg: string; arrow: string; accent: string; dot: string; glow: boolean },
  isHinted: boolean,
  isBlocked: boolean,
) {
  const [dr, dc] = DIR_DELTA[direction]
  const head = pts[0]
  const prev = pts.length > 1 ? pts[1] : [head[0] - dc, head[1] - dr]
  const vx = head[0] - prev[0]
  const vy = head[1] - prev[1]
  const vlen = Math.hypot(vx, vy)
  const dx = vlen > 0.001 ? vx / vlen : dc
  const dy = vlen > 0.001 ? vy / vlen : dr

  // Tip of caret
  const tipX = (head[0] + dx * 0.3) * cellSize
  const tipY = (head[1] + dy * 0.3) * cellSize

  // Caret wings
  const hd = 0.24 * cellSize
  const hw = 0.17 * cellSize
  const baseX = tipX - dx * hd
  const baseY = tipY - dy * hd
  const px = -dy
  const py = dx

  const wing1X = baseX + px * hw
  const wing1Y = baseY + py * hw
  const wing2X = baseX - px * hw
  const wing2Y = baseY - py * hw

  let color = themeConfig.arrow
  if (isBlocked) {
    color = '#f43f5e'
  } else if (isHinted) {
    color = themeConfig.accent
  }

  ctx.save()
  ctx.lineWidth = sw
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color

  if (isHinted) {
    ctx.shadowColor = themeConfig.accent
    ctx.shadowBlur = cellSize * 0.38
  } else if (themeConfig.glow && !isBlocked) {
    ctx.shadowColor = color
    ctx.shadowBlur = cellSize * 0.25
  } else {
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
  }

  // Draw stem
  ctx.beginPath()
  const tail = pts[pts.length - 1]
  ctx.moveTo(tail[0] * cellSize, tail[1] * cellSize)
  for (let i = pts.length - 2; i >= 0; i--) {
    ctx.lineTo(pts[i][0] * cellSize, pts[i][1] * cellSize)
  }
  ctx.lineTo(tipX, tipY)
  ctx.stroke()

  // Draw caret
  ctx.beginPath()
  ctx.moveTo(wing1X, wing1Y)
  ctx.lineTo(tipX, tipY)
  ctx.lineTo(wing2X, wing2Y)
  ctx.stroke()

  ctx.restore()
}
