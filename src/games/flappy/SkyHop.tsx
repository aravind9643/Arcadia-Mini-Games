import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, randInt } from '../../lib/utils'
import { byId } from '../registry'
import './SkyHop.css'

/* World units are a fixed 100x140 box, scaled to the canvas at draw time,
   so physics feel identical on every screen size. */
const W = 100
const H = 140
/* Tuned so a flap peaks in ~230ms and the bird crosses the screen in ~4s:
   apex height is FLAP^2 / (2*GRAV) ≈ 11 world units, about a third of the gap. */
const GRAV = 0.00055
const FLAP = -0.11
const MAX_FALL = 0.14
const SPEED = 0.016
const GAP = 40
const PIPE_W = 14
const PIPE_SPACING = 52
const BIRD_X = 28
const BIRD_R = 4

type Pipe = { x: number; gapY: number; scored: boolean }

export default function SkyHop() {
  const meta = byId('flappy')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const y = useRef(H / 2)
  const vy = useRef(0)
  const pipes = useRef<Pipe[]>([])
  const tilt = useRef(0)
  const scroll = useRef(0)

  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'run' | 'over'>('idle')
  const [isBest, setIsBest] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const reset = useCallback(() => {
    y.current = H / 2
    vy.current = 0
    pipes.current = []
    tilt.current = 0
    setScore(0)
    setPhase('idle')
    setIsBest(false)
  }, [])

  const flap = useCallback(() => {
    if (phaseRef.current === 'over') return
    if (phaseRef.current === 'idle') {
      // first pipe starts comfortably off-screen so there's time to settle
      pipes.current = [{ x: W + 26, gapY: H / 2, scored: false }]
      setPhase('run')
    }
    vy.current = FLAP
    cue('pop', 'soft')
  }, [])

  /* ---------- input ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey, { passive: false })
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  /* ---------- simulation + render ---------- */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(now - last, 42)
      last = now

      if (phaseRef.current === 'run') {
        vy.current = Math.min(vy.current + GRAV * dt, MAX_FALL)
        y.current += vy.current * dt
        tilt.current = Math.max(-0.5, Math.min(1.1, vy.current * 7))
        scroll.current += SPEED * dt

        for (const p of pipes.current) p.x -= SPEED * dt

        // recycle pipes and keep a steady stream at a fixed spacing
        pipes.current = pipes.current.filter((p) => p.x > -PIPE_W - 2)
        const lastPipe = pipes.current.at(-1)
        if (!lastPipe || lastPipe.x < W - PIPE_SPACING) {
          pipes.current.push({ x: W + 4, gapY: randInt(26, H - 30), scored: false })
        }

        // scoring: the moment a pipe's trailing edge passes the bird
        for (const p of pipes.current) {
          if (!p.scored && p.x + PIPE_W < BIRD_X - BIRD_R) {
            p.scored = true
            setScore((s) => s + 1)
            sfx('match', 2)
            navigator.vibrate?.(8)
          }
        }

        // the ceiling just stops you, as in the original — only the ground kills
        if (y.current - BIRD_R < 0) {
          y.current = BIRD_R
          vy.current = 0
        }
        const hitBounds = y.current + BIRD_R > H
        const hitPipe = pipes.current.some(
          (p) =>
            BIRD_X + BIRD_R > p.x &&
            BIRD_X - BIRD_R < p.x + PIPE_W &&
            (y.current - BIRD_R < p.gapY - GAP / 2 || y.current + BIRD_R > p.gapY + GAP / 2),
        )
        if (hitBounds || hitPipe) {
          y.current = Math.min(y.current, H - BIRD_R)
          setPhase('over')
        }
      } else if (phaseRef.current === 'idle') {
        // gentle hover so the bird reads as alive before the run starts
        y.current = H / 2 + Math.sin(now / 320) * 3
        tilt.current = Math.sin(now / 320) * 0.18
        scroll.current += SPEED * dt * 0.3
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

      // sky
      const sky = ctx.createLinearGradient(0, 0, 0, ch)
      if (light) {
        sky.addColorStop(0, '#cfe9ff')
        sky.addColorStop(1, '#fde9c8')
      } else {
        sky.addColorStop(0, '#15203c')
        sky.addColorStop(1, '#3b2a4d')
      }
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, cw, ch)

      // parallax hills
      ctx.fillStyle = light ? 'rgba(90,140,190,0.22)' : 'rgba(255,255,255,0.05)'
      const off = (scroll.current * 6) % (cw / 2)
      for (let i = -1; i < 4; i++) {
        const hx = i * (cw / 2) - off
        ctx.beginPath()
        ctx.arc(hx + cw / 4, ch * 0.86, cw * 0.28, Math.PI, 0)
        ctx.fill()
      }

      // pipes
      for (const p of pipes.current) {
        const px = p.x * sx
        const pw = PIPE_W * sx
        const gapTop = (p.gapY - GAP / 2) * sy
        const gapBot = (p.gapY + GAP / 2) * sy

        const g = ctx.createLinearGradient(px, 0, px + pw, 0)
        g.addColorStop(0, '#16a34a')
        g.addColorStop(0.45, '#4ade80')
        g.addColorStop(1, '#15803d')
        ctx.fillStyle = g

        roundRect(ctx, px, 0, pw, gapTop, 4)
        ctx.fill()
        roundRect(ctx, px, gapBot, pw, ch - gapBot, 4)
        ctx.fill()

        // lips make the gap edge easier to judge
        ctx.fillStyle = '#22c55e'
        roundRect(ctx, px - 2, gapTop - 8, pw + 4, 8, 3)
        ctx.fill()
        roundRect(ctx, px - 2, gapBot, pw + 4, 8, 3)
        ctx.fill()
      }

      // bird
      const bx = BIRD_X * sx
      const by = y.current * sy
      ctx.save()
      ctx.translate(bx, by)
      ctx.rotate(tilt.current)
      ctx.shadowColor = 'rgba(251,191,36,0.7)'
      ctx.shadowBlur = 16
      ctx.fillStyle = '#fbbf24'
      ctx.beginPath()
      ctx.ellipse(0, 0, BIRD_R * sx * 1.15, BIRD_R * sy * 0.95, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
      // wing
      ctx.fillStyle = '#f59e0b'
      ctx.beginPath()
      ctx.ellipse(-1 * sx, 0.6 * sy, 2.2 * sx, 1.5 * sy, -0.3, 0, Math.PI * 2)
      ctx.fill()
      // eye + beak
      ctx.fillStyle = '#1f1300'
      ctx.beginPath()
      ctx.arc(1.6 * sx, -1.1 * sy, 0.8 * sx, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fb923c'
      ctx.beginPath()
      ctx.moveTo(3.4 * sx, 0)
      ctx.lineTo(6 * sx, 0.8 * sy)
      ctx.lineTo(3.4 * sx, 1.6 * sy)
      ctx.closePath()
      ctx.fill()
      ctx.restore()

      // ground strip
      ctx.fillStyle = light ? '#b98b53' : '#2b1f3a'
      ctx.fillRect(0, ch - 3, cw, 3)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

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
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div
        className="sh"
        onPointerDown={(e) => {
          e.preventDefault()
          flap()
        }}
      >
        <canvas ref={canvas} className="sh__canvas" />

        <div className="sh__score mono" aria-hidden>
          {phase === 'run' ? score : ''}
        </div>

        {phase === 'idle' && (
          <motion.div
            className="sh__veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <strong>Tap to fly</strong>
            <span>Each tap flaps — keep off the pipes</span>
          </motion.div>
        )}
      </div>

      <ResultOverlay
        open={phase === 'over'}
        won={false}
        isBest={isBest}
        headline={score === 0 ? 'Straight into it' : `${score} pipe${score === 1 ? '' : 's'} cleared`}
        detail={
          score >= 20
            ? 'That is seriously good flying.'
            : 'Short, light taps hold a steadier line than frantic ones.'
        }
        onAgain={reset}
      />
    </GameFrame>
  )
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  yy: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + rr, yy)
  ctx.arcTo(x + w, yy, x + w, yy + h, rr)
  ctx.arcTo(x + w, yy + h, x, yy + h, rr)
  ctx.arcTo(x, yy + h, x, yy, rr)
  ctx.arcTo(x, yy, x + w, yy, rr)
  ctx.closePath()
}
