/**
 * Chain Reaction Game Engine
 * Based on realspal/ChainReaction and the original Android classic by Buddy-Matt Entertainment.
 */

export type PlayerId = 1 | 2

export interface CellState {
  count: number
  player: PlayerId | null
}

export type Board = CellState[][]

export type GridType = 'classic' | 'reference' | 'compact'

export interface GridConfig {
  rows: number
  cols: number
  label: string
}

export const GRID_CONFIGS: Record<GridType, GridConfig> = {
  classic: { rows: 9, cols: 6, label: '9 × 6 (Portrait)' },
  reference: { rows: 9, cols: 15, label: '9 × 15 (Reference)' },
  compact: { rows: 6, cols: 6, label: '6 × 6 (Fast)' },
}

export interface FlyingOrb {
  id: string
  fromR: number
  fromC: number
  toR: number
  toC: number
  player: PlayerId
}

export interface ExplosionStep {
  boardBefore: Board
  boardDuringFlight: Board
  explodingCells: { r: number; c: number; player: PlayerId }[]
  flyingOrbs: FlyingOrb[]
  boardAfter: Board
}

export interface MoveResult {
  steps: ExplosionStep[]
  finalBoard: Board
  totalExplosions: number
  winner: PlayerId | null
}

export const NEIGHBORS: [number, number][] = [
  [-1, 0], // Up
  [1, 0],  // Down
  [0, -1], // Left
  [0, 1],  // Right
]

/**
 * Returns the critical mass of a cell at (r, c).
 * Corners: 2, Edges: 3, Inner: 4.
 */
export function getCriticalMass(r: number, c: number, rows: number, cols: number): number {
  let count = 0
  if (r > 0) count++
  if (r < rows - 1) count++
  if (c > 0) count++
  if (c < cols - 1) count++
  return count
}

/**
 * Creates an empty board of given dimensions.
 */
export function createEmptyBoard(rows: number, cols: number): Board {
  const board: Board = []
  for (let r = 0; r < rows; r++) {
    const row: CellState[] = []
    for (let c = 0; c < cols; c++) {
      row.push({ count: 0, player: null })
    }
    board.push(row)
  }
  return board
}

/**
 * Clones a board immutably.
 */
export function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => ({ ...cell })))
}

/**
 * Checks if a move at (r, c) is legal for the given player.
 */
export function canPlayMove(board: Board, r: number, c: number, player: PlayerId): boolean {
  if (r < 0 || r >= board.length || c < 0 || c >= board[0].length) return false
  const cell = board[r][c]
  return cell.player === null || cell.player === player || cell.count === 0
}

/**
 * Counts total orbs on board for each player.
 */
export function countOrbs(board: Board): { p1: number; p2: number } {
  let p1 = 0
  let p2 = 0
  for (let r = 0; r < board.length; r++) {
    for (let c = 0; c < board[0].length; c++) {
      const cell = board[r][c]
      if (cell.player === 1) p1 += cell.count
      else if (cell.player === 2) p2 += cell.count
    }
  }
  return { p1, p2 }
}

/**
 * Checks if a player has won.
 * Active only after both players have made at least one turn.
 */
export function checkWinner(
  board: Board,
  hasMoved: { 1: boolean; 2: boolean } | number,
): PlayerId | null {
  if (typeof hasMoved === 'number') {
    if (hasMoved < 2) return null
  } else {
    if (!hasMoved[1] || !hasMoved[2]) return null
  }
  const { p1, p2 } = countOrbs(board)
  if (p1 === 0 && p2 > 0) return 2
  if (p2 === 0 && p1 > 0) return 1
  return null
}

/**
 * Simulates placing an orb and generating the full cascading explosion steps.
 */
export function executeMove(
  initialBoard: Board,
  r: number,
  c: number,
  player: PlayerId,
  hasMoved: { 1: boolean; 2: boolean } = { 1: true, 2: true },
): MoveResult {
  const rows = initialBoard.length
  const cols = initialBoard[0].length
  const currentBoard = cloneBoard(initialBoard)

  // 1. Place orb in cell
  const cell = currentBoard[r][c]
  cell.count += 1
  cell.player = player

  const steps: ExplosionStep[] = []
  let totalExplosions = 0
  let orbIdCounter = 0
  const updatedHasMoved = { ...hasMoved, [player]: true }

  // Loop cascade until fully stable
  const maxIterations = 300 // Safety circuit breaker
  let iteration = 0

  while (iteration < maxIterations) {
    iteration++
    // Find all cells at or exceeding critical mass
    const unstableCells: { r: number; c: number; player: PlayerId; crit: number }[] = []
    for (let cr = 0; cr < rows; cr++) {
      for (let cc = 0; cc < cols; cc++) {
        const crit = getCriticalMass(cr, cc, rows, cols)
        if (currentBoard[cr][cc].count >= crit) {
          unstableCells.push({
            r: cr,
            c: cc,
            player: currentBoard[cr][cc].player ?? player,
            crit,
          })
        }
      }
    }

    if (unstableCells.length === 0) break

    totalExplosions += unstableCells.length
    const boardBefore = cloneBoard(currentBoard)
    const boardDuringFlight = cloneBoard(currentBoard)
    const flyingOrbs: FlyingOrb[] = []

    // 1. Deduct critical mass from exploding cells
    for (const uc of unstableCells) {
      boardDuringFlight[uc.r][uc.c].count -= uc.crit
      if (boardDuringFlight[uc.r][uc.c].count === 0) {
        boardDuringFlight[uc.r][uc.c].player = null
      }

      // Generate flying orbs to orthogonal neighbors
      for (const [dr, dc] of NEIGHBORS) {
        const nr = uc.r + dr
        const nc = uc.c + dc
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          flyingOrbs.push({
            id: `orb_${orbIdCounter++}`,
            fromR: uc.r,
            fromC: uc.c,
            toR: nr,
            toC: nc,
            player: uc.player,
          })
        }
      }
    }

    // 2. Deliver flying orbs to neighbor cells and convert ownership
    const boardAfter = cloneBoard(boardDuringFlight)
    for (const orb of flyingOrbs) {
      const targetCell = boardAfter[orb.toR][orb.toC]
      targetCell.count += 1
      targetCell.player = orb.player
    }

    steps.push({
      boardBefore,
      boardDuringFlight,
      explodingCells: unstableCells,
      flyingOrbs,
      boardAfter,
    })

    // Advance currentBoard to boardAfter for next cascade wave
    for (let cr = 0; cr < rows; cr++) {
      for (let cc = 0; cc < cols; cc++) {
        currentBoard[cr][cc] = { ...boardAfter[cr][cc] }
      }
    }
  }

  const finalWinner = checkWinner(currentBoard, updatedHasMoved)
  return {
    steps,
    finalBoard: currentBoard,
    totalExplosions,
    winner: finalWinner,
  }
}

/**
 * Intelligent AI Move Evaluator for Player vs Computer
 */
export function getAiMove(
  board: Board,
  aiPlayer: PlayerId = 2,
  hasMoved: { 1: boolean; 2: boolean } = { 1: true, 2: true },
  difficulty: 'casual' | 'tactical' = 'tactical',
): { r: number; c: number } {
  const rows = board.length
  const cols = board[0].length
  const opponent: PlayerId = aiPlayer === 1 ? 2 : 1

  const validMoves: { r: number; c: number }[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (canPlayMove(board, r, c, aiPlayer)) {
        validMoves.push({ r, c })
      }
    }
  }

  if (validMoves.length === 0) return { r: 0, c: 0 }

  if (difficulty === 'casual') {
    // 35% chance to play random move, else heuristic
    if (Math.random() < 0.35) {
      return validMoves[Math.floor(Math.random() * validMoves.length)]
    }
  }

  let bestScore = -Infinity
  let bestMove = validMoves[0]

  for (const move of validMoves) {
    const { r, c } = move
    const crit = getCriticalMass(r, c, rows, cols)
    const currentCell = board[r][c]

    // Simulate move
    const res = executeMove(board, r, c, aiPlayer, hasMoved)

    // 1. Immediate win
    if (res.winner === aiPlayer) {
      return move
    }

    let score = 0

    // 2. Value of chain explosions & captured orbs
    const { p1: beforeP1, p2: beforeP2 } = countOrbs(board)
    const { p1: afterP1, p2: afterP2 } = countOrbs(res.finalBoard)

    const aiGain = aiPlayer === 2 ? afterP2 - beforeP2 : afterP1 - beforeP1
    const oppLoss = aiPlayer === 2 ? beforeP1 - afterP1 : beforeP2 - afterP2

    score += aiGain * 3 + oppLoss * 5
    score += res.totalExplosions * 4

    // 3. Positional strategic weighting (corners are safest, then edges)
    if (crit === 2) {
      score += 6 // Corner preference
    } else if (crit === 3) {
      score += 3 // Edge preference
    }

    // 4. Critical mass readiness (loading a cell close to detonation)
    if (currentCell.count + 1 === crit - 1) {
      score += 2
    }

    // 5. Threat avoidance: Check if any adjacent opponent cell is about to explode
    let adjacentToThreat = false
    for (const [dr, dc] of NEIGHBORS) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
        const neighbor = board[nr][nc]
        const nCrit = getCriticalMass(nr, nc, rows, cols)
        if (neighbor.player === opponent && neighbor.count === nCrit - 1) {
          adjacentToThreat = true
          break
        }
      }
    }

    // Penalize playing into imminent opponent blast radius unless we explode it first
    if (adjacentToThreat && res.totalExplosions === 0) {
      score -= 10
    }

    // Add slight tie-breaker jitter
    score += Math.random() * 0.5

    if (score > bestScore) {
      bestScore = score
      bestMove = move
    }
  }

  return bestMove
}
