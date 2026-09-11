import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { clamp, fmtNum, randInt } from '../../lib/utils'
import { byId } from '../registry'
import './SkyClimb.css'

/* Fixed world box; the camera pans upward as the player climbs. */
const W = 100
const H = 150
const GRAV = 0.00042
const BOUNCE = -0.145
const MOVE = 0.062
const PLAT_W = 22
const PLAT_H = 3
const PLAYER_W = 9
const PLAYER_H = 9
const GAP = 21

type Plat = { x: number; y: number; kind: 'solid' | 'moving'; vx: number }

function makePlatform(y: number, hard: number): Plat {
  // moving platforms appear as the climb gets higher
  const moving = Math.random() < Math.min(0.05 + hard * 0.02, 0.32)
  return {
    x: randInt(2, W - PLAT_W - 2),
    y,
    kind: moving ? 'moving' : 'solid',
    vx: moving ? (Math.random() > 0.5 ? 0.016 : -0.016) : 0,
  }
}

export default function SkyClimb() {
  const meta = byId('doodle')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const px = useRef(W / 2)
  const py = useRef(H - 30)
  const vy = useRef(0)
  const cam = useRef(0)
  const plats = useRef<Plat[]>([])
  const keys = useRef({ left: false, right: false })
  const tiltDir = useRef(0)
  const highest = useRef(0)
  /** Altitude the run began at, so height is measured from there. */
  const startY = useRef(H - 30)

  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'run' | 'over'>('idle')
  const [isBest, setIsBest] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const seed = useCallback(() => {
    const list: Plat[] = [{ x: W / 2 - PLAT_W / 2, y: H - 12, kind: 'solid', vx: 0 }]
    for (let i = 1; i < 26; i++) list.push(makePlatform(H - 12 - i * GAP, 0))
    plats.current = list
    px.current = W / 2
    py.current = H - 30
    startY.current = py.current
    vy.current = BOUNCE
    // start the camera so the player already sits on the scroll line
    cam.current = py.current - H * 0.45
    highest.current = 0
  }, [])

  const reset = useCallback(() => {
    seed()
    setScore(0)
    setIsBest(false)
    setPhase('idle')
  }, [seed])

  useEffect(() => {
    seed()
  }, [seed])

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

  /* ---------- simulation + render ---------- */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(now - last, 34)
      last = now

      if (phaseRef.current === 'run') {
        // horizontal: keyboard or touch steering
        const dir = (keys.current.right ? 1 : 0) - (keys.current.left ? 1 : 0) || tiltDir.current
        px.current += dir * MOVE * dt

        // wrap around the sides, as the original does
        if (px.current < -PLAYER_W) px.current = W
        if (px.current > W) px.current = -PLAYER_W

        vy.current += GRAV * dt
        py.current += vy.current * dt

        // move the moving platforms
        for (const p of plats.current) {
          if (p.kind !== 'moving') continue
          p.x += p.vx * dt
          if (p.x < 1 || p.x > W - PLAT_W - 1) p.vx = -p.vx
        }

        // Bounce only while falling, and only onto a platform's top edge.
        // The window widens with fall speed so a fast descent can't tunnel
        // straight through a platform between two frames.
        if (vy.current > 0) {
          const travel = vy.current * dt
          for (const p of plats.current) {
            const feet = py.current + PLAYER_H
            if (
              feet >= p.y - travel &&
              feet <= p.y + PLAT_H + 4 &&
              px.current + PLAYER_W > p.x &&
              px.current < p.x + PLAT_W
            ) {
              py.current = p.y - PLAYER_H
              vy.current = BOUNCE
              cue('pop', 'soft')
              break
            }
          }
        }

        // Camera scrolls so the player never rises above 45% of the view.
        // The court starts with the player low, so the initial camera is
        // offset to match rather than forcing a long unscored climb.
        const limit = cam.current + H * 0.45
        if (py.current < limit) {
          cam.current -= limit - py.current
        }
        // height is measured from the starting altitude, not the camera
        const climbed = Math.max(0, Math.floor((startY.current - py.current) / 4))
        if (climbed > highest.current) {
          highest.current = climbed
          setScore(climbed)
        }

        // Recycle platforms that scrolled off the bottom, then extend the
        // ladder upward one GAP at a time from whatever is currently highest.
        const hard = highest.current / 260
        plats.current = plats.current.filter((p) => p.y < cam.current + H + 10)
        let topY = Math.min(...plats.current.map((p) => p.y))
        while (plats.current.length < 26) {
          topY -= GAP
          plats.current.push(makePlatform(topY, hard))
        }

        // fell off the bottom
        if (py.current > cam.current + H + 6) setPhase('over')
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

      // sky, shifting hue as you climb
      const t = Math.min(1, highest.current / 900)
      const sky = ctx.createLinearGradient(0, 0, 0, ch)
      if (light) {
        sky.addColorStop(0, `hsl(${205 + t * 50}, 70%, 88%)`)
        sky.addColorStop(1, '#eef4ff')
      } else {
        sky.addColorStop(0, `hsl(${228 + t * 60}, 46%, ${13 + t * 6}%)`)
        sky.addColorStop(1, '#0a0a16')
      }
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, cw, ch)

      // stars drift past to convey altitude
      ctx.fillStyle = light ? 'rgba(80,110,170,0.3)' : 'rgba(255,255,255,0.45)'
      for (let i = 0; i < 26; i++) {
        const starY = (((i * 137.5 - cam.current * 0.35) % H) + H) % H
        const starX = (i * 61.8) % W
        ctx.fillRect(starX * sx, starY * sy, 1.6, 1.6)
      }

      // platforms
      for (const p of plats.current) {
        const y = (p.y - cam.current) * sy
        if (y < -10 || y > ch + 10) continue
        const g = ctx.createLinearGradient(p.x * sx, y, (p.x + PLAT_W) * sx, y)
        if (p.kind === 'moving') {
          g.addColorStop(0, '#fbbf24')
          g.addColorStop(1, '#f97316')
        } else {
          g.addColorStop(0, '#4ade80')
          g.addColorStop(1, '#22c55e')
        }
        ctx.fillStyle = g
        ctx.shadowColor = p.kind === 'moving' ? 'rgba(251,191,36,0.6)' : 'rgba(74,222,128,0.55)'
        ctx.shadowBlur = 10
        roundRect(ctx, p.x * sx, y, PLAT_W * sx, PLAT_H * sy, 3)
        ctx.fill()
        ctx.shadowBlur = 0
      }

      // player — a little rounded body with eyes, squashed when rising
      const bx = px.current * sx
      const by = (py.current - cam.current) * sy
      const squash = clamp(1 - vy.current * 1.6, 0.82, 1.2)
      ctx.save()
      ctx.translate(bx + (PLAYER_W * sx) / 2, by + (PLAYER_H * sy) / 2)
      ctx.scale(1 / squash, squash)
      ctx.fillStyle = '#a3e635'
      ctx.shadowColor = 'rgba(163,230,53,0.75)'
      ctx.shadowBlur = 16
      roundRect(
        ctx,
        (-PLAYER_W * sx) / 2,
        (-PLAYER_H * sy) / 2,
        PLAYER_W * sx,
        PLAYER_H * sy,
        PLAYER_W * sx * 0.35,
      )
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#14300a'
      const eye = PLAYER_W * sx * 0.11
      ctx.beginPath()
      ctx.arc(-eye * 1.6, -eye, eye, 0, Math.PI * 2)
      ctx.arc(eye * 1.6, -eye, eye, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
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

  /* touch steering: hold either half of the screen */
  const steer = (e: React.PointerEvent) => {
    const r = e.currentTarget.getBoundingClientRect()
    tiltDir.current = e.clientX - r.left < r.width / 2 ? -1 : 1
    if (phase === 'idle') setPhase('run')
  }

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Height" value={fmtNum(score)} accent />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div
        className="sc"
        onPointerDown={steer}
        onPointerMove={(e) => e.buttons > 0 && steer(e)}
        onPointerUp={() => (tiltDir.current = 0)}
        onPointerLeave={() => (tiltDir.current = 0)}
      >
        <canvas ref={canvas} className="sc__canvas" />

        {phase === 'idle' && (
          <motion.div className="sc__veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>Tap to climb</strong>
            <span>Hold the left or right half to steer</span>
          </motion.div>
        )}
      </div>

      {/* explicit steering pads, clearer than relying on halves alone */}
      <div className="sc__pad">
        <button
          aria-label="Move left"
          onPointerDown={() => {
            tiltDir.current = -1
            if (phase === 'idle') setPhase('run')
          }}
          onPointerUp={() => (tiltDir.current = 0)}
          onPointerLeave={() => (tiltDir.current = 0)}
        >
          <Icon name="chevron-right" size={20} weight={2.4} />
        </button>
        <button
          aria-label="Move right"
          onPointerDown={() => {
            tiltDir.current = 1
            if (phase === 'idle') setPhase('run')
          }}
          onPointerUp={() => (tiltDir.current = 0)}
          onPointerLeave={() => (tiltDir.current = 0)}
        >
          <Icon name="chevron-right" size={20} weight={2.4} />
        </button>
      </div>

      <ResultOverlay
        open={phase === 'over'}
        won={false}
        isBest={isBest}
        headline={`${fmtNum(score)}m climbed`}
        detail={
          score > 400
            ? 'Serious altitude. The orange platforms slide — time those jumps.'
            : 'You wrap around the screen edges — use that to reach awkward platforms.'
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
