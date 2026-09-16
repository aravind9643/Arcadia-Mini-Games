import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Icon } from '../../components/Icon'
import { IconButton, Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import {
  canPlayMove,
  countOrbs,
  createEmptyBoard,
  executeMove,
  getAiMove,
  getCriticalMass,
  GRID_CONFIGS,
  type Board,
  type FlyingOrb,
  type GridType,
  type PlayerId,
} from './logic'
import './ChainReaction.css'

type GameMode = 'cpu' | 'pvp'

interface ActiveAnimationStep {
  flyingOrbs: FlyingOrb[]
  startTime: number
  duration: number
  boardDuringFlight: Board
  targetBoard: Board
}

interface LastMove {
  r: number
  c: number
  player: PlayerId
}

const PLAYER_COLORS = {
  1: {
    primary: '#ff2a4b', // Reference Red
    dark: '#8b001a',
    glow: 'rgba(255, 42, 75, 0.55)',
    gridLine: 'rgba(255, 42, 75, 0.32)',
    name: 'Red',
  },
  2: {
    primary: '#00b0ff', // Reference Blue
    dark: '#005b9f',
    glow: 'rgba(0, 176, 255, 0.55)',
    gridLine: 'rgba(0, 176, 255, 0.32)',
    name: 'Blue',
  },
}

export default function ChainReaction() {
  const meta = byId('chainreaction')!
  const bestScore = useStore().scores[meta.id]?.best ?? 0

  const [gridType, setGridType] = useState<GridType>('classic')
  const gridConfig = useMemo(() => GRID_CONFIGS[gridType], [gridType])

  const [mode, setMode] = useState<GameMode>('cpu')
  const [board, setBoard] = useState<Board>(() =>
    createEmptyBoard(gridConfig.rows, gridConfig.cols),
  )
  const [turn, setTurn] = useState<PlayerId>(1)
  const [totalMoves, setTotalMoves] = useState(0)
  const [hasMoved, setHasMoved] = useState<{ 1: boolean; 2: boolean }>({ 1: false, 2: false })
  const [lastMove, setLastMove] = useState<LastMove | null>(null)
  const [maxChain, setMaxChain] = useState(0)
  const [wins, setWins] = useState(0)
  const [winner, setWinner] = useState<PlayerId | null>(null)
  const [isBest, setIsBest] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const boardRef = useRef<Board>(board)
  const animStepRef = useRef<ActiveAnimationStep | null>(null)
  const turnRef = useRef<PlayerId>(turn)
  const totalMovesRef = useRef<number>(totalMoves)
  const hasMovedRef = useRef<{ 1: boolean; 2: boolean }>(hasMoved)
  const lastMoveRef = useRef<LastMove | null>(lastMove)
  const isAnimatingRef = useRef<boolean>(false)

  useEffect(() => {
    boardRef.current = board
    turnRef.current = turn
    totalMovesRef.current = totalMoves
    hasMovedRef.current = hasMoved
    lastMoveRef.current = lastMove
    isAnimatingRef.current = isAnimating
  }, [board, hasMoved, isAnimating, lastMove, totalMoves, turn])

  const orbs = useMemo(() => countOrbs(board), [board])

  const resetGame = useCallback(() => {
    const fresh = createEmptyBoard(gridConfig.rows, gridConfig.cols)
    setBoard(fresh)
    boardRef.current = fresh
    setTurn(1)
    turnRef.current = 1
    setTotalMoves(0)
    totalMovesRef.current = 0
    setHasMoved({ 1: false, 2: false })
    hasMovedRef.current = { 1: false, 2: false }
    setLastMove(null)
    lastMoveRef.current = null
    setMaxChain(0)
    setWinner(null)
    setIsBest(false)
    setIsAnimating(false)
    isAnimatingRef.current = false
    animStepRef.current = null
  }, [gridConfig.cols, gridConfig.rows])

  const handleFinish = useCallback(
    (gameWinner: PlayerId) => {
      setWinner(gameWinner)
      if (gameWinner === 1) {
        setWins((prev) => {
          const next = prev + 1
          const newBest = store.submitScore(meta.id, next)
          setIsBest(newBest)
          return next
        })
        sfx('win')
      } else {
        sfx('lose')
      }
    },
    [meta.id],
  )

  /**
   * Runs the cascade explosion sequence step-by-step with authentic visual pacing
   */
  const processExplosions = useCallback(
    async (
      initialExplodingBoard: Board,
      steps: import('./logic').ExplosionStep[],
      finalBoard: Board,
      gameWinner: PlayerId | null,
    ) => {
      setIsAnimating(true)
      isAnimatingRef.current = true

      // 1. First show the placed orb in the cell right before it detonates
      setBoard(initialExplodingBoard)
      boardRef.current = initialExplodingBoard

      // Brief anticipation pause so the player sees the cell reach critical mass
      await new Promise<void>((resolve) => window.setTimeout(resolve, 180))

      // 2. Play through each cascade explosion wave
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i]
        const soundPitch = Math.min(i + 1, 5)
        sfx('match', soundPitch)

        const stepDuration = 380 // Smooth flight duration in ms

        await new Promise<void>((resolve) => {
          animStepRef.current = {
            flyingOrbs: step.flyingOrbs,
            startTime: performance.now(),
            duration: stepDuration,
            boardDuringFlight: step.boardDuringFlight,
            targetBoard: step.boardAfter,
          }

          window.setTimeout(() => {
            // Flying orbs arrive at destination cells
            setBoard(step.boardAfter)
            boardRef.current = step.boardAfter
            animStepRef.current = null
            cue('pop', 'tap')
            resolve()
          }, stepDuration)
        })

        // Settling pause between cascade waves to allow user to track chain spread
        if (i < steps.length - 1) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, 140))
        }
      }

      setBoard(finalBoard)
      boardRef.current = finalBoard
      setIsAnimating(false)
      isAnimatingRef.current = false

      if (gameWinner !== null) {
        handleFinish(gameWinner)
      } else {
        const nextPlayer: PlayerId = turnRef.current === 1 ? 2 : 1
        setTurn(nextPlayer)
        turnRef.current = nextPlayer
      }
    },
    [handleFinish],
  )

  /**
   * Main player move execution
   */
  const handlePlayMove = useCallback(
    (r: number, c: number) => {
      if (winner !== null || isAnimatingRef.current) return
      const currentTurn = turnRef.current
      if (mode === 'cpu' && currentTurn === 2) return // Wait for AI

      if (!canPlayMove(boardRef.current, r, c, currentTurn)) {
        cue('tick', 'error')
        return
      }

      cue('pop', 'tap')
      const currentMoves = totalMovesRef.current
      const updatedHasMoved = { ...hasMovedRef.current, [currentTurn]: true }
      setHasMoved(updatedHasMoved)
      hasMovedRef.current = updatedHasMoved

      const moveObj: LastMove = { r, c, player: currentTurn }
      setLastMove(moveObj)
      lastMoveRef.current = moveObj

      const result = executeMove(boardRef.current, r, c, currentTurn, updatedHasMoved)

      setTotalMoves(currentMoves + 1)
      totalMovesRef.current = currentMoves + 1

      if (result.totalExplosions > maxChain) {
        setMaxChain(result.totalExplosions)
      }

      if (result.steps.length > 0) {
        processExplosions(
          result.steps[0].boardBefore,
          result.steps,
          result.finalBoard,
          result.winner,
        )
      } else {
        setBoard(result.finalBoard)
        boardRef.current = result.finalBoard

        if (result.winner !== null) {
          handleFinish(result.winner)
        } else {
          const nextPlayer: PlayerId = currentTurn === 1 ? 2 : 1
          setTurn(nextPlayer)
          turnRef.current = nextPlayer
        }
      }
    },
    [handleFinish, maxChain, mode, processExplosions, winner],
  )

  /**
   * AI turn trigger with realistic thinking pace
   */
  useEffect(() => {
    if (mode !== 'cpu' || turn !== 2 || winner !== null || isAnimating) return

    const timer = window.setTimeout(() => {
      const aiMove = getAiMove(boardRef.current, 2, hasMovedRef.current, 'tactical')
      cue('pop', 'soft')

      const currentMoves = totalMovesRef.current
      const updatedHasMoved = { ...hasMovedRef.current, 2: true }
      setHasMoved(updatedHasMoved)
      hasMovedRef.current = updatedHasMoved

      const moveObj: LastMove = { r: aiMove.r, c: aiMove.c, player: 2 }
      setLastMove(moveObj)
      lastMoveRef.current = moveObj

      const result = executeMove(boardRef.current, aiMove.r, aiMove.c, 2, updatedHasMoved)

      setTotalMoves(currentMoves + 1)
      totalMovesRef.current = currentMoves + 1

      if (result.totalExplosions > maxChain) {
        setMaxChain(result.totalExplosions)
      }

      if (result.steps.length > 0) {
        processExplosions(
          result.steps[0].boardBefore,
          result.steps,
          result.finalBoard,
          result.winner,
        )
      } else {
        setBoard(result.finalBoard)
        boardRef.current = result.finalBoard

        if (result.winner !== null) {
          handleFinish(result.winner)
        } else {
          setTurn(1)
          turnRef.current = 1
        }
      }
    }, 700)

    return () => clearTimeout(timer)
  }, [handleFinish, isAnimating, maxChain, mode, processExplosions, turn, winner])

  /**
   * Canvas Pointer interaction with strict boundary checking
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top

    if (rawX < 0 || rawX >= rect.width || rawY < 0 || rawY >= rect.height) return

    const col = Math.min(
      gridConfig.cols - 1,
      Math.max(0, Math.floor((rawX / rect.width) * gridConfig.cols)),
    )
    const row = Math.min(
      gridConfig.rows - 1,
      Math.max(0, Math.floor((rawY / rect.height) * gridConfig.rows)),
    )

    handlePlayMove(row, col)
  }

  /**
   * 60fps Native 2D Canvas rendering matching authentic Chain Reaction visuals
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animId = 0
    let running = true

    const render = (now: number) => {
      if (!running) return

      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const width = Math.floor(rect.width)
      const height = Math.floor(rect.height)

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr
        canvas.height = height * dpr
      }

      ctx.save()
      ctx.scale(dpr, dpr)

      // Background - Dark cosmic board
      ctx.fillStyle = '#090a12'
      ctx.fillRect(0, 0, width, height)

      const { rows, cols } = gridConfig
      const cellW = width / cols
      const cellH = height / rows
      const orbRadius = Math.min(cellW, cellH) * 0.22

      // Draw Grid Lines in active player's color
      const pTurnColor = PLAYER_COLORS[turnRef.current]
      ctx.lineWidth = 1.5
      ctx.strokeStyle = pTurnColor.gridLine

      for (let r = 0; r <= rows; r++) {
        ctx.beginPath()
        ctx.moveTo(0, r * cellH)
        ctx.lineTo(width, r * cellH)
        ctx.stroke()
      }

      for (let c = 0; c <= cols; c++) {
        ctx.beginPath()
        ctx.moveTo(c * cellW, 0)
        ctx.lineTo(c * cellW, height)
        ctx.stroke()
      }

      // Intersection grid dots
      ctx.fillStyle = pTurnColor.gridLine
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          ctx.beginPath()
          ctx.arc(c * cellW, r * cellH, 1.5, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Highlight cell of last move with pulsing indicator
      if (lastMoveRef.current) {
        const lm = lastMoveRef.current
        const lmx = (lm.c + 0.5) * cellW
        const lmy = (lm.r + 0.5) * cellH
        const pColor = PLAYER_COLORS[lm.player]
        const pulse = Math.sin(now * 0.005) * 2
        const rad = Math.min(cellW, cellH) * 0.44 + pulse

        ctx.save()
        ctx.strokeStyle = pColor.glow
        ctx.lineWidth = 1.8
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.arc(lmx, lmy, rad, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
      }

      const activeStep = animStepRef.current
      // CRITICAL FIX: While orbs are in flight, render boardDuringFlight so arriving orbs don't prematurely duplicate
      const displayBoard = activeStep ? activeStep.boardDuringFlight : boardRef.current

      // Render Orbs in each cell
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cell = displayBoard[r][c]
          if (cell.count === 0 || cell.player === null) continue

          const pInfo = PLAYER_COLORS[cell.player]
          const cx = (c + 0.5) * cellW
          const cy = (r + 0.5) * cellH
          const crit = getCriticalMass(r, c, rows, cols)
          const isCritical = cell.count >= crit - 1

          // Calm and smooth rotation speed
          const spinSpeed = isCritical ? 0.0016 : 0.0009
          const angleBase = now * spinSpeed

          // Gentle breathing when critical
          const breath = isCritical ? 1 + Math.sin(now * 0.004) * 0.06 : 1
          const currentRadius = orbRadius * breath

          // Tight atomic clustering
          const countToDraw = Math.min(cell.count, 4)
          const orbitDist =
            currentRadius *
            (countToDraw === 1 ? 0 : countToDraw === 2 ? 0.62 : countToDraw === 3 ? 0.68 : 0.76)

          ctx.save()
          ctx.translate(cx, cy)

          for (let i = 0; i < countToDraw; i++) {
            const angle = angleBase + (i * (Math.PI * 2)) / countToDraw
            const ox = Math.cos(angle) * orbitDist
            const oy = Math.sin(angle) * orbitDist

            // Ambient glow
            ctx.beginPath()
            ctx.arc(ox, oy, currentRadius * (isCritical ? 1.5 : 1.22), 0, Math.PI * 2)
            ctx.fillStyle = pInfo.glow
            ctx.fill()

            // 3D marble sphere gradient with specular highlight
            const grad = ctx.createRadialGradient(
              ox - currentRadius * 0.32,
              oy - currentRadius * 0.35,
              currentRadius * 0.06,
              ox,
              oy,
              currentRadius,
            )
            grad.addColorStop(0, '#ffffff')
            grad.addColorStop(0.2, '#ffffff')
            grad.addColorStop(0.48, pInfo.primary)
            grad.addColorStop(0.85, pInfo.dark)
            grad.addColorStop(1, '#050608')

            ctx.beginPath()
            ctx.arc(ox, oy, currentRadius, 0, Math.PI * 2)
            ctx.fillStyle = grad
            ctx.fill()
          }

          ctx.restore()
        }
      }

      // Render Flying Orbs during chain explosion step
      if (activeStep) {
        const elapsed = now - activeStep.startTime
        const progress = Math.min(1, Math.max(0, elapsed / activeStep.duration))
        const easeProg = 1 - Math.pow(1 - progress, 3) // Smooth cubic ease-out

        for (const flying of activeStep.flyingOrbs) {
          const fromX = (flying.fromC + 0.5) * cellW
          const fromY = (flying.fromR + 0.5) * cellH
          const toX = (flying.toC + 0.5) * cellW
          const toY = (flying.toR + 0.5) * cellH

          const curX = fromX + (toX - fromX) * easeProg
          const curY = fromY + (toY - fromY) * easeProg

          const pInfo = PLAYER_COLORS[flying.player]

          // Particle trail streak
          const tailX = fromX + (toX - fromX) * Math.max(0, easeProg - 0.2)
          const tailY = fromY + (toY - fromY) * Math.max(0, easeProg - 0.2)

          ctx.beginPath()
          ctx.moveTo(tailX, tailY)
          ctx.lineTo(curX, curY)
          ctx.lineWidth = orbRadius * 1.1
          ctx.lineCap = 'round'
          ctx.strokeStyle = pInfo.glow
          ctx.stroke()

          // Flying sphere core with 3D gradient
          const grad = ctx.createRadialGradient(
            curX - orbRadius * 0.3,
            curY - orbRadius * 0.3,
            orbRadius * 0.06,
            curX,
            curY,
            orbRadius,
          )
          grad.addColorStop(0, '#ffffff')
          grad.addColorStop(0.45, pInfo.primary)
          grad.addColorStop(1, pInfo.dark)

          ctx.beginPath()
          ctx.arc(curX, curY, orbRadius, 0, Math.PI * 2)
          ctx.fillStyle = grad
          ctx.fill()
        }
      }

      ctx.restore()
      animId = requestAnimationFrame(render)
    }

    animId = requestAnimationFrame(render)
    return () => {
      running = false
      cancelAnimationFrame(animId)
    }
  }, [gridConfig])

  const toggleMode = () => {
    cue('tap')
    setMode((m) => (m === 'cpu' ? 'pvp' : 'cpu'))
    resetGame()
  }

  const toggleGrid = () => {
    cue('tap')
    const order: GridType[] = ['classic', 'reference', 'compact']
    const nextIdx = (order.indexOf(gridType) + 1) % order.length
    const nextType = order[nextIdx]
    setGridType(nextType)
    const nextCfg = GRID_CONFIGS[nextType]
    const fresh = createEmptyBoard(nextCfg.rows, nextCfg.cols)
    setBoard(fresh)
    boardRef.current = fresh
    setTurn(1)
    turnRef.current = 1
    setTotalMoves(0)
    totalMovesRef.current = 0
    setHasMoved({ 1: false, 2: false })
    hasMovedRef.current = { 1: false, 2: false }
    setLastMove(null)
    lastMoveRef.current = null
    setMaxChain(0)
    setWinner(null)
    setIsBest(false)
    setIsAnimating(false)
    isAnimatingRef.current = false
    animStepRef.current = null
  }

  const activeColor = PLAYER_COLORS[turn]

  return (
    <GameFrame
      game={meta}
      onRestart={resetGame}
      hud={
        <StatRow>
          <Stat
            label="Turn"
            value={
              <span className="cr__turn-stat">
                <span
                  className="cr__turn-dot"
                  style={{ background: activeColor.primary }}
                />
                <span>
                  {mode === 'cpu'
                    ? turn === 1
                      ? 'You'
                      : 'CPU'
                    : activeColor.name}
                </span>
              </span>
            }
            accent
          />
          <Stat
            label="Red"
            value={<span style={{ color: PLAYER_COLORS[1].primary }}>{orbs.p1}</span>}
          />
          <Stat
            label="Blue"
            value={<span style={{ color: PLAYER_COLORS[2].primary }}>{orbs.p2}</span>}
          />
          <Stat
            label="Best"
            value={Math.max(bestScore, wins)}
          />
        </StatRow>
      }
      actions={
        <>
          <IconButton
            label={mode === 'cpu' ? 'Switch to 2-Player (Pass & Play)' : 'Switch to vs CPU'}
            onClick={toggleMode}
          >
            <Icon name={mode === 'cpu' ? 'gamepad' : 'brain'} size={18} />
          </IconButton>
          <IconButton
            label={`Grid: ${gridConfig.label}`}
            onClick={toggleGrid}
          >
            <Icon name="grid" size={18} />
          </IconButton>
        </>
      }
    >
      <div className={`cr ${gridType === 'reference' ? 'cr--wide' : ''}`}>
        {/* Board container */}
        <div
          className={`cr__board ${gridType === 'reference' ? 'cr__board--wide' : ''}`}
          style={{
            aspectRatio: `${gridConfig.cols} / ${gridConfig.rows}`,
            borderColor: turn === 1 ? 'rgba(255, 42, 75, 0.45)' : 'rgba(0, 176, 255, 0.45)',
            boxShadow: `0 0 20px -3px ${turn === 1 ? 'rgba(255, 42, 75, 0.35)' : 'rgba(0, 176, 255, 0.35)'}, var(--shadow)`,
          }}
        >
          <canvas
            ref={canvasRef}
            className="cr__canvas"
            onPointerDown={handlePointerDown}
          />
        </div>

        {/* Victory Overlay */}
        <ResultOverlay
          open={winner !== null}
          won={winner === 1}
          headline={
            mode === 'cpu'
              ? winner === 1
                ? 'Chain Victory!'
                : 'Overwhelmed by CPU'
              : `${PLAYER_COLORS[winner ?? 1].name} Wins!`
          }
          detail={
            <span>
              {winner === 1
                ? mode === 'cpu'
                  ? 'You eliminated all CPU orbs from the grid.'
                  : 'Red wiped out Blue with unstoppable chain reactions.'
                : mode === 'cpu'
                  ? 'The CPU achieved critical mass dominance.'
                  : 'Blue wiped out Red with unstoppable chain reactions.'}
            </span>
          }
          isBest={isBest && winner === 1}
          onAgain={resetGame}
          againLabel="Play Again"
        />
      </div>
    </GameFrame>
  )
}
