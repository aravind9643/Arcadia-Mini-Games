import { motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Button, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useArrowKeys, useStore, useSwipe, type Dir } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { fmtNum, randInt } from '../../lib/utils'
import { byId } from '../registry'
import './Snake.css'

const GRID = 15
const START_MS = 190
const MIN_MS = 78

type Cell = { x: number; y: number }

const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' }

const initialSnake = (): Cell[] => [
  { x: 7, y: 8 },
  { x: 7, y: 9 },
  { x: 7, y: 10 },
]

function placeFood(snake: Cell[]): Cell {
  // reject sampling is fine here — the board is never near-full in practice
  for (;;) {
    const c = { x: randInt(0, GRID - 1), y: randInt(0, GRID - 1) }
    if (!snake.some((s) => s.x === c.x && s.y === c.y)) return c
  }
}

export default function Snake() {
  const meta = byId('snake')!
  const best = useStore().scores[meta.id]?.best ?? 0

  const canvas = useRef<HTMLCanvasElement | null>(null)
  const snake = useRef<Cell[]>(initialSnake())
  const dir = useRef<Dir>('up')
  const queued = useRef<Dir[]>([])
  const food = useRef<Cell>(placeFood(snake.current))
  const pulse = useRef(0)

  const [score, setScore] = useState(0)
  const [running, setRunning] = useState(false)
  const [over, setOver] = useState(false)
  const [isBest, setIsBest] = useState(false)
  const [started, setStarted] = useState(false)

  const speed = Math.max(MIN_MS, START_MS - score * 4)

  const reset = useCallback(() => {
    snake.current = initialSnake()
    dir.current = 'up'
    queued.current = []
    food.current = placeFood(snake.current)
    pulse.current = 0
    setScore(0)
    setOver(false)
    setIsBest(false)
    setStarted(false)
    setRunning(false)
  }, [])

  const turn = useCallback((d: Dir) => {
    const last = queued.current.at(-1) ?? dir.current
    // ignore reversals and repeats — they'd instantly end the run
    if (d === last || d === OPPOSITE[last]) return
    if (queued.current.length < 2) queued.current.push(d)
    if (!started) {
      setStarted(true)
      setRunning(true)
    }
  }, [started])

  useArrowKeys(turn, !over)
  const swipe = useSwipe(turn, 22)

  /* ---------- game tick ---------- */
  useEffect(() => {
    if (!running || over) return
    const id = setInterval(() => {
      const next = queued.current.shift()
      if (next) dir.current = next

      const d = DELTA[dir.current]
      const head = snake.current[0]
      const nh = { x: head.x + d.x, y: head.y + d.y }

      const hitWall = nh.x < 0 || nh.y < 0 || nh.x >= GRID || nh.y >= GRID
      const hitSelf = snake.current.some((s, i) => i < snake.current.length - 1 && s.x === nh.x && s.y === nh.y)

      if (hitWall || hitSelf) {
        setRunning(false)
        setOver(true)
        return
      }

      const ate = nh.x === food.current.x && nh.y === food.current.y
      const body = [nh, ...snake.current]
      if (!ate) body.pop()
      else {
        food.current = placeFood(body)
        pulse.current = 1
        setScore((s) => s + 1)
        sfx('pop')
        navigator.vibrate?.(10)
      }
      snake.current = body
    }, speed)
    return () => clearInterval(id)
  }, [running, over, speed])

  /* ---------- render loop ---------- */
  useEffect(() => {
    let raf = 0
    const draw = () => {
      const cv = canvas.current
      const ctx = cv?.getContext('2d')
      if (cv && ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const size = cv.clientWidth
        if (cv.width !== size * dpr) {
          cv.width = size * dpr
          cv.height = size * dpr
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, size, size)

        const cell = size / GRID
        const light = document.documentElement.dataset.theme === 'light'

        // subtle grid
        ctx.strokeStyle = light ? 'rgba(20,16,45,0.05)' : 'rgba(255,255,255,0.035)'
        ctx.lineWidth = 1
        for (let i = 1; i < GRID; i++) {
          const p = Math.round(i * cell) + 0.5
          ctx.beginPath()
          ctx.moveTo(p, 0)
          ctx.lineTo(p, size)
          ctx.moveTo(0, p)
          ctx.lineTo(size, p)
          ctx.stroke()
        }

        // food, gently pulsing
        pulse.current = Math.max(0, pulse.current - 0.05)
        const t = performance.now() / 380
        const fr = cell * (0.3 + Math.sin(t) * 0.028 + pulse.current * 0.12)
        const fx = (food.current.x + 0.5) * cell
        const fy = (food.current.y + 0.5) * cell
        const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, fr * 2.4)
        fg.addColorStop(0, 'rgba(251,113,133,0.85)')
        fg.addColorStop(1, 'rgba(251,113,133,0)')
        ctx.fillStyle = fg
        ctx.beginPath()
        ctx.arc(fx, fy, fr * 2.4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fb7185'
        ctx.beginPath()
        ctx.arc(fx, fy, fr, 0, Math.PI * 2)
        ctx.fill()

        // snake — head brightest, tail fading to teal
        const body = snake.current
        body.forEach((s, i) => {
          const k = 1 - i / Math.max(body.length, 1)
          const pad = cell * (0.11 + (1 - k) * 0.05)
          const r = cell * 0.3
          ctx.fillStyle = i === 0 ? '#d9f99d' : mixHex('#a3e635', '#10b981', 1 - k)
          ctx.shadowColor = 'rgba(163,230,53,0.55)'
          ctx.shadowBlur = i === 0 ? 22 : 8
          roundRect(ctx, s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, r)
          ctx.fill()
        })
        ctx.shadowBlur = 0
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

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
          <Stat label="Length" value={score + 3} />
          <Stat label="Best" value={fmtNum(Math.max(best, score))} />
        </StatRow>
      }
      actions={
        started &&
        !over && (
          <Button
            size="sm"
            variant="surface"
            onClick={() => {
              cue('tick')
              setRunning((r) => !r)
            }}
          >
            {running ? '❚❚' : '▶'}
          </Button>
        )
      }
    >
      <div className="snake" {...swipe}>
        <canvas ref={canvas} className="snake__canvas" />

        {(!started || (!running && !over)) && (
          <motion.div
            className="snake__veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onPointerDown={() => {
              if (!started) setStarted(true)
              setRunning(true)
              cue('tap')
            }}
          >
            <strong>{started ? 'Paused' : 'Ready?'}</strong>
            <span>{started ? 'Tap to resume' : 'Swipe or press an arrow key to start'}</span>
          </motion.div>
        )}
      </div>

      {/* thumb D-pad — mobile players shouldn't have to swipe precisely */}
      <div className="snake__dpad" aria-hidden={false}>
        <button aria-label="Up" className="dp dp--u" onPointerDown={() => turn('up')}>
          ▲
        </button>
        <button aria-label="Left" className="dp dp--l" onPointerDown={() => turn('left')}>
          ◀
        </button>
        <button aria-label="Right" className="dp dp--r" onPointerDown={() => turn('right')}>
          ▶
        </button>
        <button aria-label="Down" className="dp dp--d" onPointerDown={() => turn('down')}>
          ▼
        </button>
      </div>

      <ResultOverlay
        open={over}
        won={false}
        isBest={isBest}
        headline={score === 0 ? 'Ouch — straight into a wall' : `${score} orbs collected`}
        detail={`Final length ${score + 3}. ${score >= 25 ? 'Excellent control.' : 'Keep to the open space and plan your turns.'}`}
        onAgain={reset}
      />
    </GameFrame>
  )
}

/* ---------- canvas helpers ---------- */

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

function mixHex(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16))
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16))
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t))
  return `rgb(${m[0]},${m[1]},${m[2]})`
}
