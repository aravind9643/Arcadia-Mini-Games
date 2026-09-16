import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { GameFrame, ResultOverlay } from '../../components/GameFrame'
import { Stat, StatRow } from '../../components/ui'
import { cue, sfx } from '../../lib/feedback'
import { useStore } from '../../lib/hooks'
import { store } from '../../lib/storage'
import { byId } from '../registry'
import {
  canPlacePiece,
  canPlacePieceAnywhere,
  clearLinesFromGrid,
  createEmptyGrid,
  detectCompletedLines,
  generatePieceTray,
  hasAnyLegalMove,
  placePiece,
  GRID_SIZE,
  type Grid,
  type PieceShape,
} from './logic'
import './BlockBlast.css'

interface BoardMetrics {
  cellW: number
  cellH: number
  gap: number
  padLeft: number
  padTop: number
}

function getTrayTileMetrics(piece: PieceShape) {
  const maxDim = Math.max(piece.matrix.length, piece.matrix[0].length)
  if (maxDim <= 2) return { size: 24, gap: 3 }
  if (maxDim === 3) return { size: 19, gap: 2.5 }
  if (maxDim === 4) return { size: 16, gap: 2 }
  return { size: 13.5, gap: 2 }
}

export default function BlockBlast() {
  const meta = byId('blockblast')!
  const bestScore = useStore().scores[meta.id]?.best ?? 0

  const [grid, setGrid] = useState<Grid>(() => createEmptyGrid())
  const [tray, setTray] = useState<(PieceShape | null)[]>(() =>
    generatePieceTray(createEmptyGrid()),
  )
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [over, setOver] = useState(false)
  const [isBest, setIsBest] = useState(false)

  // Selection & Drag State
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null)
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null)
  const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null)
  const [hoverTarget, setHoverTarget] = useState<{ r: number; c: number } | null>(null)
  const [clearingCells, setClearingCells] = useState<Set<string>>(new Set())
  const [comboPopup, setComboPopup] = useState<{ combo: number; score: number } | null>(null)
  const [boardMetrics, setBoardMetrics] = useState<BoardMetrics>({
    cellW: 40,
    cellH: 40,
    gap: 4,
    padLeft: 8,
    padTop: 8,
  })

  const boardRef = useRef<HTMLDivElement | null>(null)
  const gridRef = useRef<Grid>(grid)
  const trayRef = useRef<(PieceShape | null)[]>(tray)
  const metricsRef = useRef<BoardMetrics>(boardMetrics)

  useEffect(() => {
    gridRef.current = grid
    trayRef.current = tray
  }, [grid, tray])

  const measureBoard = useCallback((): BoardMetrics => {
    const board = boardRef.current
    if (!board) return metricsRef.current

    const rect = board.getBoundingClientRect()
    const style = window.getComputedStyle(board)
    const padLeft = parseFloat(style.paddingLeft) || 8
    const padRight = parseFloat(style.paddingRight) || 8
    const padTop = parseFloat(style.paddingTop) || 8
    const padBottom = parseFloat(style.paddingBottom) || 8
    const gap = parseFloat(style.gap || style.rowGap) || 4

    const innerWidth = rect.width - padLeft - padRight
    const innerHeight = rect.height - padTop - padBottom

    const cellW = (innerWidth - (GRID_SIZE - 1) * gap) / GRID_SIZE
    const cellH = (innerHeight - (GRID_SIZE - 1) * gap) / GRID_SIZE

    const metrics: BoardMetrics = { cellW, cellH, gap, padLeft, padTop }
    setBoardMetrics(metrics)
    metricsRef.current = metrics
    return metrics
  }, [])

  useEffect(() => {
    measureBoard()
    window.addEventListener('resize', measureBoard)
    return () => window.removeEventListener('resize', measureBoard)
  }, [measureBoard])

  const resetGame = useCallback(() => {
    const freshGrid = createEmptyGrid()
    setGrid(freshGrid)
    gridRef.current = freshGrid
    const freshTray = generatePieceTray(freshGrid)
    setTray(freshTray)
    trayRef.current = freshTray
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setOver(false)
    setIsBest(false)
    setSelectedSlot(null)
    setDraggedSlot(null)
    setDragPointer(null)
    setHoverTarget(null)
    setClearingCells(new Set())
    setComboPopup(null)
  }, [])

  const activePiece = useMemo(() => {
    const slot = draggedSlot !== null ? draggedSlot : selectedSlot
    return slot !== null && tray[slot] ? tray[slot] : null
  }, [draggedSlot, selectedSlot, tray])

  /**
   * Evaluates if a game-over condition has been reached
   */
  const checkGameOver = useCallback(
    (currentGrid: Grid, currentTray: (PieceShape | null)[], currentScore: number) => {
      const remainingPieces = currentTray.filter((p): p is PieceShape => p !== null)
      if (remainingPieces.length === 0) return

      if (!hasAnyLegalMove(currentGrid, currentTray)) {
        setOver(true)
        const isNewBest = store.submitScore(meta.id, currentScore)
        setIsBest(isNewBest)
        sfx('lose')
        cue('tick', 'error')
      }
    },
    [meta.id],
  )

  /**
   * Commits piece placement and triggers line blast cascades
   */
  const commitPlacement = useCallback(
    (pieceSlot: number, startR: number, startC: number) => {
      const piece = trayRef.current[pieceSlot]
      if (!piece) return

      if (!canPlacePiece(gridRef.current, piece, startR, startC)) {
        cue('tick', 'error')
        return
      }

      // 1. Place piece
      const { newGrid, tilesPlacedCount } = placePiece(gridRef.current, piece, startR, startC)
      cue('pop', 'tap')

      // Base placement points
      let addedScore = tilesPlacedCount * 10
      let nextCombo = combo

      // 2. Detect line completions
      const clearRes = detectCompletedLines(newGrid)

      if (clearRes.rows.length > 0 || clearRes.cols.length > 0) {
        nextCombo += 1
        if (nextCombo > maxCombo) setMaxCombo(nextCombo)

        // Combo multiplier: +40% bonus per combo level
        const comboMultiplier = 1 + (nextCombo - 1) * 0.4
        const lineBonus = Math.round(clearRes.scoreAdded * comboMultiplier)
        addedScore += lineBonus

        // Show celebratory combo banner
        if (nextCombo >= 2) {
          setComboPopup({ combo: nextCombo, score: lineBonus })
          window.setTimeout(() => setComboPopup(null), 850)
        }

        // Sound effect with ascending pitch on combo
        sfx('match', Math.min(nextCombo, 5))
        cue('pop', 'heavy')

        // Mark cells for blast animation
        const blastSet = new Set(
          clearRes.clearedCellCoordinates.map((c) => `${c.r},${c.c}`),
        )
        setClearingCells(blastSet)
        setGrid(newGrid)

        // Clear cells after blast animation
        window.setTimeout(() => {
          const clearedGrid = clearLinesFromGrid(newGrid, clearRes.rows, clearRes.cols)
          setGrid(clearedGrid)
          gridRef.current = clearedGrid
          setClearingCells(new Set())

          // Post-clear game over check
          checkGameOver(clearedGrid, updatedTray, nextTotalScore)
        }, 300)
      } else {
        // Reset combo if no line cleared on this turn
        nextCombo = 0
        setGrid(newGrid)
        gridRef.current = newGrid
      }

      const nextTotalScore = score + addedScore
      setScore(nextTotalScore)
      setCombo(nextCombo)

      // 3. Update Tray
      const updatedTray = [...trayRef.current]
      updatedTray[pieceSlot] = null

      // If all 3 pieces are used, generate new tray
      if (updatedTray.every((p) => p === null)) {
        const nextBatch = generatePieceTray(newGrid)
        setTray(nextBatch)
        trayRef.current = nextBatch
        checkGameOver(newGrid, nextBatch, nextTotalScore)
      } else {
        setTray(updatedTray)
        trayRef.current = updatedTray
        checkGameOver(newGrid, updatedTray, nextTotalScore)
      }

      // Reset selection and hover
      setSelectedSlot(null)
      setDraggedSlot(null)
      setDragPointer(null)
      setHoverTarget(null)
    },
    [checkGameOver, combo, maxCombo, score],
  )

  /**
   * Computes pixel-perfect grid coordinates (r, c) accounting for board padding & cell gaps
   */
  const getGridCoordsFromPoint = useCallback(
    (clientX: number, clientY: number, piece: PieceShape | null) => {
      const board = boardRef.current
      if (!board || !piece) return null

      const rect = board.getBoundingClientRect()
      const { cellW, cellH, gap, padLeft, padTop } = metricsRef.current

      const pRows = piece.matrix.length
      const pCols = piece.matrix[0].length

      const pieceW = pCols * cellW + (pCols - 1) * gap
      const pieceH = pRows * cellH + (pRows - 1) * gap

      const boardX = clientX - rect.left - padLeft
      const boardY = clientY - rect.top - padTop

      // Calculate the top-left cell index so the piece is centered directly under the pointer
      const leftOfPiece = boardX - pieceW / 2
      const topOfPiece = boardY - pieceH / 2

      const c = Math.round(leftOfPiece / (cellW + gap))
      const r = Math.round(topOfPiece / (cellH + gap))

      if (r >= 0 && r + pRows <= GRID_SIZE && c >= 0 && c + pCols <= GRID_SIZE) {
        return { r, c }
      }
      return null
    },
    [],
  )

  /**
   * Pointer down on a tray slot to begin dragging or select
   */
  const handleSlotPointerDown = (slotIndex: number, e: React.PointerEvent) => {
    if (over) return
    const piece = tray[slotIndex]
    if (!piece) return

    measureBoard()

    // Touch offset so thumb doesn't cover preview on mobile
    const isTouch = e.pointerType === 'touch'
    const offsetY = isTouch ? -75 : 0

    setDraggedSlot(slotIndex)
    setSelectedSlot(slotIndex)
    setDragPointer({ x: e.clientX, y: e.clientY + offsetY })

    const target = getGridCoordsFromPoint(e.clientX, e.clientY + offsetY, piece)
    setHoverTarget(target)

    const handlePointerMove = (moveEv: PointerEvent) => {
      const curY = moveEv.clientY + offsetY
      setDragPointer({ x: moveEv.clientX, y: curY })
      const curTarget = getGridCoordsFromPoint(moveEv.clientX, curY, piece)
      setHoverTarget(curTarget)
    }

    const handlePointerUp = (upEv: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)

      const finalY = upEv.clientY + offsetY
      const finalTarget = getGridCoordsFromPoint(upEv.clientX, finalY, piece)

      if (finalTarget && canPlacePiece(gridRef.current, piece, finalTarget.r, finalTarget.c)) {
        commitPlacement(slotIndex, finalTarget.r, finalTarget.c)
      } else {
        // Did not drop on grid; leave selected for tap-to-place
        setDraggedSlot(null)
        setDragPointer(null)
        setHoverTarget(null)
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  /**
   * Tap on grid cell to place currently selected piece (Accessible Tap-to-Place mode)
   */
  const handleCellClick = (r: number, c: number) => {
    if (over || selectedSlot === null) return
    const piece = tray[selectedSlot]
    if (!piece) return

    if (canPlacePiece(grid, piece, r, c)) {
      commitPlacement(selectedSlot, r, c)
    } else {
      cue('tick', 'error')
    }
  }

  // Generate preview ghost cells map
  const ghostCellsMap = useMemo(() => {
    const map = new Map<string, string>()
    if (!activePiece || !hoverTarget) return map
    if (!canPlacePiece(grid, activePiece, hoverTarget.r, hoverTarget.c)) return map

    for (let r = 0; r < activePiece.matrix.length; r++) {
      for (let c = 0; c < activePiece.matrix[0].length; c++) {
        if (activePiece.matrix[r][c] === 1) {
          map.set(`${hoverTarget.r + r},${hoverTarget.c + c}`, activePiece.color)
        }
      }
    }
    return map
  }, [activePiece, grid, hoverTarget])

  return (
    <GameFrame
      game={meta}
      onRestart={resetGame}
      hud={
        <StatRow>
          <Stat label="Score" value={score} accent />
          <Stat
            label="Combo"
            value={
              combo > 0 ? (
                <span style={{ color: '#f43f5e', fontWeight: 800 }}>
                  ×{combo}
                </span>
              ) : (
                '—'
              )
            }
          />
          <Stat label="Best" value={Math.max(bestScore, score)} />
        </StatRow>
      }
    >
      <div className="bb">
        {/* 8x8 Grid Board */}
        <div ref={boardRef} className="bb__board">
          {grid.map((row, r) =>
            row.map((cell, c) => {
              const cellKey = `${r},${c}`
              const isClearing = clearingCells.has(cellKey)
              const ghostColor = ghostCellsMap.get(cellKey)

              let cellStyle = {}
              let cellClass = 'bb__cell'

              if (cell.filled) {
                cellClass += ' bb__cell--filled'
                cellStyle = {
                  backgroundColor: cell.color ?? '#f43f5e',
                  boxShadow: `0 0 10px ${cell.color}88, inset 0 2px 2px #ffffff66`,
                }
              } else if (ghostColor) {
                cellClass += ' bb__cell--preview'
                cellStyle = {
                  backgroundColor: ghostColor,
                }
              }

              if (isClearing) {
                cellClass += ' bb__cell--clearing'
              }

              return (
                <div
                  key={cellKey}
                  className={cellClass}
                  style={cellStyle}
                  onClick={() => handleCellClick(r, c)}
                />
              )
            }),
          )}

          {/* Combo Banner Popup */}
          {comboPopup && (
            <div className="bb__combo-badge">
              <span className="bb__combo-pill">COMBO ×{comboPopup.combo}!</span>
              <span className="bb__combo-score">+{comboPopup.score}</span>
            </div>
          )}
        </div>

        {/* 3-Piece Tray at Bottom */}
        <div className="bb__tray">
          {tray.map((piece, slotIdx) => {
            if (!piece) {
              return <div key={slotIdx} className="bb__slot bb__slot--empty" />
            }

            const canFit = canPlacePieceAnywhere(grid, piece)
            const isSelected = selectedSlot === slotIdx
            const isDragging = draggedSlot === slotIdx
            const { size, gap } = getTrayTileMetrics(piece)

            return (
              <div
                key={piece.id}
                className={`bb__slot ${!canFit ? 'bb__slot--disabled' : ''} ${
                  isSelected ? 'bb__slot--selected' : ''
                }`}
                style={{ opacity: isDragging ? 0.3 : canFit ? 1 : 0.32 }}
                onPointerDown={(e) => handleSlotPointerDown(slotIdx, e)}
              >
                {/* Mini Piece Matrix */}
                <div
                  className="bb__piece"
                  style={{
                    gridTemplateColumns: `repeat(${piece.matrix[0].length}, ${size}px)`,
                    gap: `${gap}px`,
                  }}
                >
                  {piece.matrix.map((row, r) =>
                    row.map((val, c) =>
                      val === 1 ? (
                        <div
                          key={`${r},${c}`}
                          className="bb__piece-tile"
                          style={{
                            width: `${size}px`,
                            height: `${size}px`,
                            backgroundColor: piece.color,
                            boxShadow: `0 0 6px ${piece.glow}`,
                          }}
                        />
                      ) : (
                        <div
                          key={`${r},${c}`}
                          className="bb__piece-empty"
                          style={{ width: `${size}px`, height: `${size}px` }}
                        />
                      ),
                    ),
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Floating Piece Preview during pointer drag - 1:1 Pixel Match with Board Cells */}
        {draggedSlot !== null && dragPointer && activePiece && (
          <div
            className="bb__dragging"
            style={{
              left: `${dragPointer.x}px`,
              top: `${dragPointer.y}px`,
              gap: `${boardMetrics.gap}px`,
              gridTemplateColumns: `repeat(${activePiece.matrix[0].length}, ${boardMetrics.cellW}px)`,
            }}
          >
            {activePiece.matrix.map((row, r) =>
              row.map((val, c) =>
                val === 1 ? (
                  <div
                    key={`${r},${c}`}
                    className="bb__dragging-tile"
                    style={{
                      width: `${boardMetrics.cellW}px`,
                      height: `${boardMetrics.cellH}px`,
                      backgroundColor: activePiece.color,
                      color: activePiece.color,
                    }}
                  />
                ) : (
                  <div
                    key={`${r},${c}`}
                    style={{
                      width: `${boardMetrics.cellW}px`,
                      height: `${boardMetrics.cellH}px`,
                      opacity: 0,
                    }}
                  />
                ),
              ),
            )}
          </div>
        )}

        {/* Game Over Overlay */}
        <ResultOverlay
          open={over}
          won={false}
          headline="No More Moves!"
          detail={
            <span>
              You scored <strong>{score}</strong> with a max streak of{' '}
              <strong>×{maxCombo}</strong> combos.
            </span>
          }
          isBest={isBest}
          onAgain={resetGame}
          againLabel="Play Again"
        />
      </div>
    </GameFrame>
  )
}
