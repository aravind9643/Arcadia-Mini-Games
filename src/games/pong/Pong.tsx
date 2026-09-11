import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { clamp } from '../../lib/utils'
import { byId } from '../registry'
import './Pong.css'

/* Portrait court: you defend the bottom, the computer the top. */
const W = 100
const H = 130
const PAD_W = 22
const PAD_H = 3
const YOU_Y = H - 9
const AI_Y = 6
const BALL_R = 2
const START_SPEED = 0.05
const WIN_AT = 11

type Level = 'Easy' | 'Medium' | 'Hard'
/** How fast the AI paddle can track, and how much it mis-aims. */
const AI: Record<Level, { speed: number; error: number }> = {
  Easy: { speed: 0.028, error: 16 },
  Medium: { speed: 0.042, error: 8 },
  Hard: { speed: 0.058, error: 3 },
}

export default function Pong() {
  const meta = byId('pong')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const youX = useRef(W / 2)
  const aiX = useRef(W / 2)
  const aiTarget = useRef(W / 2)
  const ball = useRef({ x: W / 2, y: H / 2, vx: START_SPEED * 0.5, vy: START_SPEED })
  const keys = useRef({ left: false, right: false })
  const glow = useRef(0)

  const [level, setLevel] = useState<Level>('Medium')
  const [you, setYou] = useState(0)
  const [them, setThem] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'run' | 'over'>('idle')
  const [isBest, setIsBest] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const levelRef = useRef(level)
  levelRef.current = level

  /** Centres the ball and sends it toward whoever just conceded. */
  const serve = useCallback((toward: 1 | -1) => {
    const angle = (Math.random() - 0.5) * 0.8
    ball.current = {
      x: W / 2,
      y: H / 2,
      vx: Math.sin(angle) * START_SPEED,
      vy: Math.cos(angle) * START_SPEED * toward,
    }
  }, [])

  const reset = useCallback(() => {
    setYou(0)
    setThem(0)
    setIsBest(false)
    youX.current = W / 2
    aiX.current = W / 2
    serve(Math.random() > 0.5 ? 1 : -1)
    setPhase('idle')
  }, [serve])

  useEffect(() => reset(), [level, reset])

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'd', ' '].includes(e.key)) e.preventDefault()
      if (e.key === 'ArrowLeft' || e.key === 'a') keys.current.left = true
      if (e.key === 'ArrowRight' || e.key === 'd') keys.current.right = true
      if (e.key === ' ' && phaseRef.current === 'idle') setPhase('run')
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

  const movePaddle = (clientX: number) => {
    const cv = canvas.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    youX.current = clamp(((clientX - r.left) / r.width) * W, PAD_W / 2, W - PAD_W / 2)
  }

  /* ---------- simulation + render ---------- */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(now - last, 34)
      last = now

      if (phaseRef.current === 'run') {
        const kSpeed = 0.07 * dt
        if (keys.current.left) youX.current = clamp(youX.current - kSpeed, PAD_W / 2, W - PAD_W / 2)
        if (keys.current.right) youX.current = clamp(youX.current + kSpeed, PAD_W / 2, W - PAD_W / 2)

        const b = ball.current
        b.x += b.vx * dt
        b.y += b.vy * dt

        // side walls
        if (b.x - BALL_R < 0) {
          b.x = BALL_R
          b.vx = Math.abs(b.vx)
          sfx('tick')
        } else if (b.x + BALL_R > W) {
          b.x = W - BALL_R
          b.vx = -Math.abs(b.vx)
          sfx('tick')
        }

        // AI tracks the ball with a deliberate error margin
        const cfg = AI[levelRef.current]
        if (b.vy < 0) {
          // only re-aim while the ball is coming toward it
          aiTarget.current = b.x + (Math.random() - 0.5) * cfg.error
        }
        const diff = aiTarget.current - aiX.current
        aiX.current = clamp(
          aiX.current + clamp(diff, -cfg.speed * dt, cfg.speed * dt),
          PAD_W / 2,
          W - PAD_W / 2,
        )

        // paddle bounces — contact point sets the outgoing angle
        const speed = Math.hypot(b.vx, b.vy)
        if (
          b.vy > 0 &&
          b.y + BALL_R >= YOU_Y &&
          b.y - BALL_R <= YOU_Y + PAD_H &&
          Math.abs(b.x - youX.current) <= PAD_W / 2 + BALL_R
        ) {
          const hit = clamp((b.x - youX.current) / (PAD_W / 2), -1, 1)
          const next = Math.min(speed * 1.045, 0.12)
          b.vx = Math.sin(hit * 1.0) * next
          b.vy = -Math.abs(Math.cos(hit * 1.0) * next)
          b.y = YOU_Y - BALL_R
          glow.current = 1
          cue('pop', 'soft')
        } else if (
          b.vy < 0 &&
          b.y - BALL_R <= AI_Y + PAD_H &&
          b.y + BALL_R >= AI_Y &&
          Math.abs(b.x - aiX.current) <= PAD_W / 2 + BALL_R
        ) {
          const hit = clamp((b.x - aiX.current) / (PAD_W / 2), -1, 1)
          const next = Math.min(speed * 1.045, 0.12)
          b.vx = Math.sin(hit * 1.0) * next
          b.vy = Math.abs(Math.cos(hit * 1.0) * next)
          b.y = AI_Y + PAD_H + BALL_R
          sfx('flip')
        }

        // goals
        if (b.y > H + 6) {
          setThem((t) => t + 1)
          serve(-1)
          sfx('lose')
          navigator.vibrate?.(24)
        } else if (b.y < -6) {
          setYou((y) => y + 1)
          serve(1)
          sfx('match', 3)
          navigator.vibrate?.(12)
        }
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

      const sx = cw / W
      const sy = ch / H
      const light = document.documentElement.dataset.theme === 'light'
      const ink = light ? 'rgba(30,25,60,0.5)' : 'rgba(255,255,255,0.35)'

      // centre line
      ctx.strokeStyle = ink
      ctx.lineWidth = 2
      ctx.setLineDash([8, 10])
      ctx.beginPath()
      ctx.moveTo(0, ch / 2)
      ctx.lineTo(cw, ch / 2)
      ctx.stroke()
      ctx.setLineDash([])

      // paddles
      glow.current = Math.max(0, glow.current - 0.06)
      ctx.fillStyle = '#22d3ee'
      ctx.shadowColor = 'rgba(34,211,238,0.85)'
      ctx.shadowBlur = 12 + glow.current * 22
      roundRect(ctx, (youX.current - PAD_W / 2) * sx, YOU_Y * sy, PAD_W * sx, PAD_H * sy, 4)
      ctx.fill()

      ctx.fillStyle = '#fb7185'
      ctx.shadowColor = 'rgba(251,113,133,0.85)'
      ctx.shadowBlur = 12
      roundRect(ctx, (aiX.current - PAD_W / 2) * sx, AI_Y * sy, PAD_W * sx, PAD_H * sy, 4)
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
  }, [serve])

  /* match end */
  useEffect(() => {
    if (phase !== 'run') return
    if (you < WIN_AT && them < WIN_AT) return
    setPhase('over')
    if (you >= WIN_AT) {
      // score records the best winning margin
      setIsBest(store.submitScore(meta.id, you - them))
      sfx('win')
      navigator.vibrate?.([14, 50, 14])
    } else {
      sfx('lose')
    }
  }, [you, them, phase, meta.id])

  const won = you >= WIN_AT

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="You" value={you} accent />
          <Stat label="CPU" value={them} />
          <Stat label="To win" value={WIN_AT} />
          <Stat label="Margin" value={best || '—'} />
        </StatRow>
      }
    >
      <div className="pg__levels">
        {(['Easy', 'Medium', 'Hard'] as Level[]).map((l) => (
          <button
            key={l}
            className={`pg__lvl${l === level ? ' is-on' : ''}`}
            onClick={() => {
              cue('tap')
              setLevel(l)
            }}
          >
            {l}
          </button>
        ))}
      </div>

      <div
        className="pg"
        onPointerDown={(e) => {
          e.preventDefault()
          movePaddle(e.clientX)
          if (phase === 'idle') setPhase('run')
        }}
        onPointerMove={(e) => {
          if (e.buttons > 0 || e.pointerType === 'mouse') movePaddle(e.clientX)
        }}
      >
        <canvas ref={canvas} className="pg__canvas" />

        {phase === 'idle' && (
          <motion.div className="pg__veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>Tap to serve</strong>
            <span>Drag along the bottom to move your paddle</span>
          </motion.div>
        )}
      </div>

      <ResultOverlay
        open={phase === 'over'}
        won={won}
        isBest={won && isBest}
        headline={won ? `You win ${you}–${them}` : `Computer wins ${them}–${you}`}
        detail={
          won
            ? `Beat ${level} by ${you - them}. Try a harder opponent?`
            : 'Hit the ball with the paddle edge to angle your returns.'
        }
        onAgain={reset}
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
