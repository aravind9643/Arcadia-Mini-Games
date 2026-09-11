import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { clamp, fmtNum } from '../../lib/utils'
import { byId } from '../registry'
import './BrickBreaker.css'

/* Fixed world box, scaled at draw time so play feels the same everywhere. */
const W = 100
const H = 130
const BRICK_ROWS = 5
const BRICK_COLS = 7
const BRICK_H = 6
const BRICK_TOP = 14
const PAD_W = 20
const PAD_H = 2.6
const PAD_Y = H - 8
const BALL_R = 1.7
const BASE_SPEED = 0.055

const ROW_COLORS = ['#fb7185', '#fb923c', '#fbbf24', '#a3e635', '#22d3ee']

type Brick = { x: number; y: number; w: number; h: number; row: number; alive: boolean }

function makeBricks(level: number): Brick[] {
  const pad = 1.4
  const w = (W - pad * (BRICK_COLS + 1)) / BRICK_COLS
  const out: Brick[] = []
  for (let r = 0; r < BRICK_ROWS; r++) {
    for (let c = 0; c < BRICK_COLS; c++) {
      // higher levels punch gaps in the wall for variety
      if (level > 1 && (r + c) % (level + 3) === 0) continue
      out.push({
        x: pad + c * (w + pad),
        y: BRICK_TOP + r * (BRICK_H + pad),
        w,
        h: BRICK_H,
        row: r,
        alive: true,
      })
    }
  }
  return out
}

export default function BrickBreaker() {
  const meta = byId('breakout')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const padX = useRef(W / 2)
  const ball = useRef({ x: W / 2, y: PAD_Y - 6, vx: BASE_SPEED * 0.6, vy: -BASE_SPEED })
  const bricks = useRef<Brick[]>(makeBricks(1))
  const keys = useRef({ left: false, right: false })
  const shake = useRef(0)

  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [level, setLevel] = useState(1)
  const [phase, setPhase] = useState<'idle' | 'run' | 'over' | 'won'>('idle')
  const [isBest, setIsBest] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const levelRef = useRef(level)
  levelRef.current = level

  const resetBall = useCallback(() => {
    ball.current = {
      x: padX.current,
      y: PAD_Y - 6,
      vx: BASE_SPEED * (Math.random() > 0.5 ? 0.6 : -0.6),
      vy: -BASE_SPEED,
    }
  }, [])

  const reset = useCallback(() => {
    padX.current = W / 2
    bricks.current = makeBricks(1)
    setScore(0)
    setLives(3)
    setLevel(1)
    setIsBest(false)
    resetBall()
    setPhase('idle')
  }, [resetBall])

  const nextLevel = useCallback(() => {
    const lv = levelRef.current + 1
    setLevel(lv)
    bricks.current = makeBricks(lv)
    resetBall()
    setPhase('idle')
    sfx('levelup')
  }, [resetBall])

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true
      if (e.key === ' ') {
        e.preventDefault()
        if (phaseRef.current === 'idle') setPhase('run')
      }
    }
    const up = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = false
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = false
    }
    window.addEventListener('keydown', down, { passive: false })
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  /* ---------- pointer drag ---------- */
  const movePaddle = (clientX: number) => {
    const cv = canvas.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    padX.current = clamp(((clientX - r.left) / r.width) * W, PAD_W / 2, W - PAD_W / 2)
  }

  /* ---------- simulation + render ---------- */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(now - last, 34)
      last = now

      if (phaseRef.current === 'run') {
        // keyboard steering
        const kSpeed = 0.075 * dt
        if (keys.current.left) padX.current = clamp(padX.current - kSpeed, PAD_W / 2, W - PAD_W / 2)
        if (keys.current.right) padX.current = clamp(padX.current + kSpeed, PAD_W / 2, W - PAD_W / 2)

        const b = ball.current
        // speed creeps up with level so later boards stay tense
        const spd = 1 + (levelRef.current - 1) * 0.12
        b.x += b.vx * dt * spd
        b.y += b.vy * dt * spd

        // walls
        if (b.x - BALL_R < 0) {
          b.x = BALL_R
          b.vx = Math.abs(b.vx)
          sfx('tick')
        } else if (b.x + BALL_R > W) {
          b.x = W - BALL_R
          b.vx = -Math.abs(b.vx)
          sfx('tick')
        }
        if (b.y - BALL_R < 0) {
          b.y = BALL_R
          b.vy = Math.abs(b.vy)
          sfx('tick')
        }

        // paddle — bounce angle depends where it lands, so players can aim
        if (
          b.vy > 0 &&
          b.y + BALL_R >= PAD_Y &&
          b.y - BALL_R <= PAD_Y + PAD_H &&
          b.x >= padX.current - PAD_W / 2 - BALL_R &&
          b.x <= padX.current + PAD_W / 2 + BALL_R
        ) {
          const hit = (b.x - padX.current) / (PAD_W / 2)
          const angle = clamp(hit, -1, 1) * 1.05
          const speed = Math.hypot(b.vx, b.vy)
          b.vx = Math.sin(angle) * speed
          b.vy = -Math.abs(Math.cos(angle) * speed)
          b.y = PAD_Y - BALL_R
          cue('pop', 'soft')
        }

        // bricks
        for (const br of bricks.current) {
          if (!br.alive) continue
          if (
            b.x + BALL_R > br.x &&
            b.x - BALL_R < br.x + br.w &&
            b.y + BALL_R > br.y &&
            b.y - BALL_R < br.y + br.h
          ) {
            br.alive = false
            // reflect off the shallower axis of penetration
            const overlapX = Math.min(b.x + BALL_R - br.x, br.x + br.w - (b.x - BALL_R))
            const overlapY = Math.min(b.y + BALL_R - br.y, br.y + br.h - (b.y - BALL_R))
            if (overlapX < overlapY) b.vx = -b.vx
            else b.vy = -b.vy

            shake.current = 1
            setScore((s) => s + (BRICK_ROWS - br.row) * 10)
            sfx('merge', BRICK_ROWS - br.row)
            navigator.vibrate?.(8)
            break
          }
        }

        // cleared the wall
        if (bricks.current.every((br) => !br.alive)) {
          setPhase('won')
        }

        // lost the ball
        if (b.y - BALL_R > H) {
          setLives((l) => {
            const left = l - 1
            if (left <= 0) {
              setPhase('over')
            } else {
              resetBall()
              setPhase('idle')
              sfx('lose')
              navigator.vibrate?.(26)
            }
            return left
          })
        }
      } else if (phaseRef.current === 'idle') {
        // ball rides the paddle until launch
        ball.current.x = padX.current
        ball.current.y = PAD_Y - 6
      }

      draw()
      raf = requestAnimationFrame(frame)
    }

    const draw = () => {
      const cv = canvas.current
      const ctx = cv?.getContext('2d')
      if (!cv || !ctx) return

      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const cw = cv.clientWidth
      const ch = cv.clientHeight
      if (cv.width !== cw * dpr || cv.height !== ch * dpr) {
        cv.width = cw * dpr
        cv.height = ch * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, cw, ch)

      // brief screen shake on a brick hit
      shake.current = Math.max(0, shake.current - 0.09)
      if (shake.current > 0) {
        ctx.translate((Math.random() - 0.5) * shake.current * 3, (Math.random() - 0.5) * shake.current * 3)
      }

      const sx = cw / W
      const sy = ch / H

      // bricks
      for (const br of bricks.current) {
        if (!br.alive) continue
        ctx.fillStyle = ROW_COLORS[br.row]
        ctx.shadowColor = ROW_COLORS[br.row]
        ctx.shadowBlur = 10
        roundRect(ctx, br.x * sx, br.y * sy, br.w * sx, br.h * sy, 3)
        ctx.fill()
        ctx.shadowBlur = 0
        // top highlight gives the brick some depth
        ctx.fillStyle = 'rgba(255,255,255,0.28)'
        roundRect(ctx, br.x * sx, br.y * sy, br.w * sx, br.h * sy * 0.34, 3)
        ctx.fill()
      }

      // paddle
      const px = (padX.current - PAD_W / 2) * sx
      const grad = ctx.createLinearGradient(px, 0, px + PAD_W * sx, 0)
      grad.addColorStop(0, '#a3e635')
      grad.addColorStop(1, '#14b8a6')
      ctx.fillStyle = grad
      ctx.shadowColor = 'rgba(163,230,53,0.7)'
      ctx.shadowBlur = 16
      roundRect(ctx, px, PAD_Y * sy, PAD_W * sx, PAD_H * sy, PAD_H * sy * 0.5)
      ctx.fill()
      ctx.shadowBlur = 0

      // ball
      const b = ball.current
      ctx.fillStyle = '#fff'
      ctx.shadowColor = 'rgba(255,255,255,0.9)'
      ctx.shadowBlur = 14
      ctx.beginPath()
      ctx.arc(b.x * sx, b.y * sy, BALL_R * sx, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [resetBall])

  useEffect(() => {
    if (phase !== 'over') return
    setIsBest(store.submitScore(meta.id, score))
    sfx('lose')
    navigator.vibrate?.([30, 60, 30])
  }, [phase, score, meta.id])

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          <Stat label="Lives" value={'●'.repeat(Math.max(0, lives)) || '—'} />
          <Stat label="Level" value={level} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div
        className="bb"
        onPointerDown={(e) => {
          e.preventDefault()
          movePaddle(e.clientX)
          if (phase === 'idle') setPhase('run')
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'mouse') movePaddle(e.clientX)
        }}
      >
        <canvas ref={canvas} className="bb__canvas" />

        {phase === 'idle' && (
          <motion.div className="bb__veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>{lives < 3 ? `${lives} ball${lives === 1 ? '' : 's'} left` : 'Ready'}</strong>
            <span>Drag to aim the paddle, then tap to launch</span>
          </motion.div>
        )}
      </div>

      <ResultOverlay
        open={phase === 'over'}
        won={false}
        isBest={isBest}
        headline={`${fmtNum(score)} points`}
        detail={`You reached level ${level}. Hit the ball with the paddle's edge to angle it sharply.`}
        onAgain={reset}
      />

      {/* level-cleared is a continue, not a restart, so it gets its own button */}
      <ResultOverlay
        open={phase === 'won'}
        won
        headline={`Level ${level} cleared!`}
        detail={`${fmtNum(score)} points so far — the next wall is tougher.`}
        againLabel={`Start level ${level + 1}`}
        onAgain={nextLevel}
      />
    </GameFrame>
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}
