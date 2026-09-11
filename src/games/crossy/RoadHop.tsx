import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useArrowKeys, useStore, useSwipe, type Dir } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, randInt } from '../../lib/utils'
import { byId } from '../registry'
import './RoadHop.css'

/* A grid of lanes; the camera follows the player upward. */
const COLS = 9
const VISIBLE = 11
/** Player occupies this much of a cell; used for car overlap tests. */
const HITBOX = 0.8

type Lane =
  | { kind: 'grass' }
  | { kind: 'road'; dir: 1 | -1; speed: number; cars: number[]; len: number }

function makeLane(row: number): Lane {
  // the first few rows are always safe, then roads grow denser
  if (row < 2 || Math.random() < 0.32) return { kind: 'grass' }
  const difficulty = Math.min(row / 90, 1)
  const len = Math.random() < 0.25 ? 2 : 1
  const count = randInt(1, 2 + Math.floor(difficulty * 2))
  const cars: number[] = []
  for (let i = 0; i < count; i++) cars.push(Math.random() * COLS)
  return {
    kind: 'road',
    dir: Math.random() > 0.5 ? 1 : -1,
    speed: (0.0016 + Math.random() * 0.0022) * (1 + difficulty),
    cars,
    len,
  }
}

export default function RoadHop() {
  const meta = byId('crossy')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const lanes = useRef<Lane[]>([])
  const col = useRef(Math.floor(COLS / 2))
  const row = useRef(0)
  const camRow = useRef(0)
  const hopFrom = useRef({ c: 4, r: 0 })
  const hopAt = useRef(0)

  const [score, setScore] = useState(0)
  const [phase, setPhase] = useState<'idle' | 'run' | 'over'>('idle')
  const [isBest, setIsBest] = useState(false)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  const seed = useCallback(() => {
    lanes.current = Array.from({ length: 60 }, (_, i) => makeLane(i))
    col.current = Math.floor(COLS / 2)
    row.current = 0
    camRow.current = 0
    hopFrom.current = { c: col.current, r: 0 }
    hopAt.current = 0
  }, [])

  const reset = useCallback(() => {
    seed()
    setScore(0)
    setIsBest(false)
    setPhase('idle')
  }, [seed])

  useEffect(() => seed(), [seed])

  const hop = useCallback(
    (d: Dir) => {
      if (phaseRef.current === 'over') return
      if (phaseRef.current === 'idle') setPhase('run')

      hopFrom.current = { c: col.current, r: row.current }
      hopAt.current = performance.now()

      if (d === 'up') row.current += 1
      else if (d === 'down') row.current = Math.max(0, row.current - 1)
      else if (d === 'left') col.current = Math.max(0, col.current - 1)
      else col.current = Math.min(COLS - 1, col.current + 1)

      // extend the world ahead of the player
      while (lanes.current.length < row.current + 40) {
        lanes.current.push(makeLane(lanes.current.length))
      }

      if (row.current > score) {
        setScore(row.current)
        cue('pop', 'soft')
      } else {
        cue('tick', 'soft')
      }
    },
    [score],
  )

  useArrowKeys(hop, phase !== 'over')
  const swipe = useSwipe(hop, 20)

  /* ---------- simulation + render ---------- */
  useEffect(() => {
    let raf = 0
    let last = performance.now()

    const frame = (now: number) => {
      const dt = Math.min(now - last, 34)
      last = now

      if (phaseRef.current === 'run') {
        // move traffic
        for (const lane of lanes.current) {
          if (lane.kind !== 'road') continue
          for (let i = 0; i < lane.cars.length; i++) {
            lane.cars[i] += lane.dir * lane.speed * dt * COLS
            // wrap around, leaving room for the car's length
            if (lane.dir > 0 && lane.cars[i] > COLS + lane.len) lane.cars[i] = -lane.len
            if (lane.dir < 0 && lane.cars[i] < -lane.len) lane.cars[i] = COLS + lane.len
          }
        }

        // collision with the lane the player stands in
        const lane = lanes.current[row.current]
        if (lane?.kind === 'road') {
          // axis-aligned overlap between the player cell and any car
          const hit = lane.cars.some(
            (cx) => col.current + HITBOX > cx && col.current < cx + lane.len,
          )
          if (hit) setPhase('over')
        }

        // camera eases toward the player
        camRow.current += (row.current - 2 - camRow.current) * Math.min(1, dt / 110)
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

      const cellW = cw / COLS
      const cellH = ch / VISIBLE
      const light = document.documentElement.dataset.theme === 'light'

      // rows are drawn bottom-up from the camera
      const baseRow = Math.floor(camRow.current) - 1
      for (let k = -1; k < VISIBLE + 2; k++) {
        const r = baseRow + k
        if (r < 0) continue
        const lane = lanes.current[r]
        if (!lane) continue
        const y = ch - (r - camRow.current + 1) * cellH

        if (lane.kind === 'grass') {
          ctx.fillStyle = light
            ? r % 2 === 0
              ? '#bbf7d0'
              : '#a7f3d0'
            : r % 2 === 0
              ? '#14532d'
              : '#166534'
          ctx.fillRect(0, y, cw, cellH)
        } else {
          ctx.fillStyle = light ? '#94a3b8' : '#1e293b'
          ctx.fillRect(0, y, cw, cellH)
          // dashed lane marking
          ctx.strokeStyle = light ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.28)'
          ctx.lineWidth = 2
          ctx.setLineDash([9, 11])
          ctx.beginPath()
          ctx.moveTo(0, y + cellH / 2)
          ctx.lineTo(cw, y + cellH / 2)
          ctx.stroke()
          ctx.setLineDash([])

          for (const cx of lane.cars) {
            drawCar(ctx, cx * cellW, y + cellH * 0.16, cellW * lane.len * 0.92, cellH * 0.68, lane.dir)
          }
        }
      }

      // player, with a short hop arc
      const t = Math.min(1, (now - hopAt.current) / 130)
      const ease = 1 - (1 - t) * (1 - t)
      const pc = hopFrom.current.c + (col.current - hopFrom.current.c) * ease
      const pr = hopFrom.current.r + (row.current - hopFrom.current.r) * ease
      const lift = Math.sin(t * Math.PI) * cellH * 0.28

      const x = pc * cellW
      const y = ch - (pr - camRow.current + 1) * cellH - lift
      ctx.fillStyle = 'rgba(0,0,0,0.3)'
      ctx.beginPath()
      ctx.ellipse(x + cellW / 2, y + cellH * 0.86, cellW * 0.3, cellH * 0.1, 0, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#facc15'
      ctx.shadowColor = 'rgba(250,204,21,0.8)'
      ctx.shadowBlur = 14
      roundRect(ctx, x + cellW * 0.16, y + cellH * 0.12, cellW * 0.68, cellH * 0.68, cellW * 0.2)
      ctx.fill()
      ctx.shadowBlur = 0
      ctx.fillStyle = '#1c1400'
      const eye = cellW * 0.07
      ctx.beginPath()
      ctx.arc(x + cellW * 0.36, y + cellH * 0.36, eye, 0, Math.PI * 2)
      ctx.arc(x + cellW * 0.62, y + cellH * 0.36, eye, 0, Math.PI * 2)
      ctx.fill()
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
          <Stat label="Rows" value={fmtNum(score)} accent />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
    >
      <div className="rh" {...swipe}>
        <canvas ref={canvas} className="rh__canvas" />

        {phase === 'idle' && (
          <motion.div className="rh__veil" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <strong>Hop forward</strong>
            <span>Swipe or use the arrow keys · mind the traffic</span>
          </motion.div>
        )}
      </div>

      <div className="rh__pad">
        <button aria-label="Left" className="rh--l" onPointerDown={() => hop('left')}>
          <Icon name="chevron-right" size={19} weight={2.4} />
        </button>
        <button aria-label="Forward" className="rh--u" onPointerDown={() => hop('up')}>
          <Icon name="chevron-right" size={19} weight={2.4} />
        </button>
        <button aria-label="Back" className="rh--d" onPointerDown={() => hop('down')}>
          <Icon name="chevron-right" size={19} weight={2.4} />
        </button>
        <button aria-label="Right" className="rh--r" onPointerDown={() => hop('right')}>
          <Icon name="chevron-right" size={19} weight={2.4} />
        </button>
      </div>

      <ResultOverlay
        open={phase === 'over'}
        won={false}
        isBest={isBest}
        headline={score === 0 ? 'Straight into traffic' : `${score} rows crossed`}
        detail="Wait in the gaps between lanes — there is no time limit, only traffic."
        onAgain={reset}
      />
    </GameFrame>
  )
}

function drawCar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  dir: number,
) {
  const body = dir > 0 ? '#f43f5e' : '#38bdf8'
  ctx.fillStyle = body
  ctx.shadowColor = 'rgba(0,0,0,0.45)'
  ctx.shadowBlur = 6
  roundRect(ctx, x, y, w, h, h * 0.28)
  ctx.fill()
  ctx.shadowBlur = 0
  // windscreen, on the leading edge
  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  const ww = w * 0.24
  roundRect(ctx, dir > 0 ? x + w - ww - h * 0.14 : x + h * 0.14, y + h * 0.2, ww, h * 0.6, h * 0.15)
  ctx.fill()
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
