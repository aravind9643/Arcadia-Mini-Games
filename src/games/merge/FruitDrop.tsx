import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { clamp, fmtNum } from '../../lib/utils'
import { byId } from '../registry'
import {
  colorOf,
  DANGER_Y,
  H,
  mergeScore,
  newId,
  overflowing,
  radiusOf,
  randomDropTier,
  step,
  TIERS,
  W,
  type Fruit,
} from './physics'
import './FruitDrop.css'

const DROP_COOLDOWN = 380

export default function FruitDrop() {
  const meta = byId('merge')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const fruits = useRef<Fruit[]>([])
  const aimX = useRef(W / 2)
  const lastDrop = useRef(0)
  const dangerSince = useRef(0)

  const [nextTier, setNextTier] = useState(randomDropTier)
  const [queued, setQueued] = useState(randomDropTier)
  const [score, setScore] = useState(0)
  const [topTier, setTopTier] = useState(0)
  const [over, setOver] = useState(false)
  const [isBest, setIsBest] = useState(false)
  const overRef = useRef(false)
  overRef.current = over

  const reset = useCallback(() => {
    fruits.current = []
    aimX.current = W / 2
    lastDrop.current = 0
    dangerSince.current = 0
    setNextTier(randomDropTier())
    setQueued(randomDropTier())
    setScore(0)
    setTopTier(0)
    setOver(false)
    setIsBest(false)
  }, [])

  const aimAt = (clientX: number) => {
    const cv = canvas.current
    if (!cv) return
    const r = cv.getBoundingClientRect()
    const raw = ((clientX - r.left) / r.width) * W
    aimX.current = clamp(raw, radiusOf(nextTier), W - radiusOf(nextTier))
  }

  const drop = () => {
    if (overRef.current) return
    const now = performance.now()
    if (now - lastDrop.current < DROP_COOLDOWN) return
    lastDrop.current = now

    fruits.current = [
      ...fruits.current,
      {
        id: newId(),
        tier: nextTier,
        x: aimX.current,
        y: DANGER_Y - radiusOf(nextTier) - 2,
        vx: 0,
        vy: 0.004,
        born: now,
      },
    ]
    setNextTier(queued)
    setQueued(randomDropTier())
    cue('pop', 'soft')
  }

  /* ---------- simulation + render ---------- */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      // fixed-ish timestep keeps the solver stable on slow frames
      const dt = Math.min(now - last, 32)
      last = now

      if (!overRef.current) {
        const res = step(fruits.current, dt, now)
        fruits.current = res.fruits

        if (res.merges.length) {
          let gained = 0
          let high = 0
          for (const m of res.merges) {
            gained += mergeScore(m.tier)
            high = Math.max(high, m.tier)
          }
          setScore((s) => s + gained)
          setTopTier((t) => Math.max(t, high))
          sfx('merge', Math.min(high, 5))
          navigator.vibrate?.(high >= 5 ? 20 : 9)
        }

        // overflow must persist briefly, so a bouncing drop isn't fatal
        if (overflowing(fruits.current, now)) {
          if (dangerSince.current === 0) dangerSince.current = now
          else if (now - dangerSince.current > 900) setOver(true)
        } else {
          dangerSince.current = 0
        }
      }

      draw(now)
      raf = requestAnimationFrame(frame)
    }

    const draw = (now: number) => {
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

      // danger line, reddening as fruit approaches it
      const risk = dangerSince.current ? 1 : 0
      ctx.strokeStyle = risk ? 'rgba(248,113,113,0.9)' : 'rgba(255,255,255,0.18)'
      ctx.lineWidth = 2
      ctx.setLineDash([7, 7])
      ctx.beginPath()
      ctx.moveTo(0, DANGER_Y * sy)
      ctx.lineTo(cw, DANGER_Y * sy)
      ctx.stroke()
      ctx.setLineDash([])

      // aim guide
      if (!overRef.current) {
        ctx.strokeStyle = 'rgba(255,255,255,0.2)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(aimX.current * sx, DANGER_Y * sy)
        ctx.lineTo(aimX.current * sx, ch)
        ctx.stroke()

        // the fruit waiting to drop
        drawFruit(ctx, aimX.current * sx, (DANGER_Y - radiusOf(nextTier) - 2) * sy, radiusOf(nextTier) * sx, nextTier, 1)
      }

      for (const f of fruits.current) {
        // brief pop-in scale for freshly merged fruit
        const age = now - f.born
        const pop = age < 190 ? 1 + Math.sin((age / 190) * Math.PI) * 0.16 : 1
        drawFruit(ctx, f.x * sx, f.y * sy, radiusOf(f.tier) * sx, f.tier, pop)
      }
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [nextTier])

  useEffect(() => {
    if (!over) return
    setIsBest(store.submitScore(meta.id, score))
    sfx('lose')
    navigator.vibrate?.([30, 60, 30])
  }, [over, score, meta.id])

  return (
    <GameFrame
      game={meta}
      onRestart={reset}
      hud={
        <StatRow>
          <Stat label="Score" value={fmtNum(score)} accent />
          {/* fruit names are long — show the tier number, name it in the overlay */}
          <Stat label="Tier" value={`${topTier + 1}/${TIERS.length}`} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="fd">
        <div className="fd__next">
          <span>Next</span>
          <i style={{ background: colorOf(queued), width: 14 + queued * 3, height: 14 + queued * 3 }} />
        </div>

        <div
          className="fd__jar"
          onPointerDown={(e) => {
            e.preventDefault()
            aimAt(e.clientX)
          }}
          onPointerMove={(e) => {
            if (e.buttons > 0 || e.pointerType === 'mouse') aimAt(e.clientX)
          }}
          onPointerUp={drop}
        >
          <canvas ref={canvas} className="fd__canvas" />
        </div>
      </div>

      <p className="fd__hint">Drag to aim, release to drop</p>

      <ResultOverlay
        open={over}
        won={false}
        isBest={isBest}
        headline={`${fmtNum(score)} points`}
        detail={`Your biggest was a ${TIERS[topTier].name}. Keep the large fruit at the bottom and merge upward.`}
        onAgain={reset}
      />
    </GameFrame>
  )
}

/** A fruit: radial body, glossy highlight, subtle rim. */
function drawFruit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  tier: number,
  scale: number,
) {
  const rr = r * scale
  const color = colorOf(tier)

  const g = ctx.createRadialGradient(x - rr * 0.3, y - rr * 0.35, rr * 0.1, x, y, rr)
  g.addColorStop(0, '#ffffff')
  g.addColorStop(0.22, color)
  g.addColorStop(1, shade(color, -28))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, rr, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.ellipse(x - rr * 0.32, y - rr * 0.4, rr * 0.22, rr * 0.15, -0.5, 0, Math.PI * 2)
  ctx.fill()
}

/** Shifts a hex colour lighter (+) or darker (−). */
function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt))
  const b = Math.max(0, Math.min(255, (n & 255) + amt))
  return `rgb(${r},${g},${b})`
}
