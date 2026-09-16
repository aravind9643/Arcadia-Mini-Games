/**
 * Block Blast Game Logic Engine
 * Based on the #1 viral mobile block puzzle hit.
 */

export const GRID_SIZE = 8

export interface Cell {
  filled: boolean
  color: string | null
  clearing?: boolean
}

export type Grid = Cell[][]

export interface PieceShape {
  id: string
  name: string
  matrix: number[][]
  color: string
  glow: string
  dark: string
}

// 8 curated jewel neon color themes for polyomino pieces
export const PIECE_COLORS = [
  { color: '#f43f5e', glow: 'rgba(244, 63, 94, 0.65)', dark: '#9f1239' }, // Ruby Red
  { color: '#fb923c', glow: 'rgba(251, 146, 60, 0.65)', dark: '#c2410c' }, // Amber Orange
  { color: '#facc15', glow: 'rgba(250, 204, 21, 0.65)', dark: '#a16207' }, // Topaz Yellow
  { color: '#22c55e', glow: 'rgba(34, 197, 94, 0.65)', dark: '#15803d' },  // Emerald Green
  { color: '#06b6d4', glow: 'rgba(6, 182, 212, 0.65)', dark: '#0e7490' },  // Cyan Diamond
  { color: '#3b82f6', glow: 'rgba(59, 130, 246, 0.65)', dark: '#1d4ed8' }, // Sapphire Blue
  { color: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.65)', dark: '#6d28d9' }, // Amethyst Violet
  { color: '#ec4899', glow: 'rgba(236, 72, 153, 0.65)', dark: '#be185d' }, // Magenta Pink
]

// Canonical shapes in Block Blast
export const SHAPE_TEMPLATES: { name: string; matrix: number[][] }[] = [
  // Single dot
  { name: 'dot', matrix: [[1]] },

  // Squares
  { name: 'square_2', matrix: [[1, 1], [1, 1]] },
  { name: 'square_3', matrix: [[1, 1, 1], [1, 1, 1], [1, 1, 1]] },

  // Bars (horizontal)
  { name: 'bar_h2', matrix: [[1, 1]] },
  { name: 'bar_h3', matrix: [[1, 1, 1]] },
  { name: 'bar_h4', matrix: [[1, 1, 1, 1]] },
  { name: 'bar_h5', matrix: [[1, 1, 1, 1, 1]] },

  // Bars (vertical)
  { name: 'bar_v2', matrix: [[1], [1]] },
  { name: 'bar_v3', matrix: [[1], [1], [1]] },
  { name: 'bar_v4', matrix: [[1], [1], [1], [1]] },
  { name: 'bar_v5', matrix: [[1], [1], [1], [1], [1]] },

  // Small L (2x2 corner)
  { name: 'corner_tl', matrix: [[1, 1], [1, 0]] },
  { name: 'corner_tr', matrix: [[1, 1], [0, 1]] },
  { name: 'corner_bl', matrix: [[1, 0], [1, 1]] },
  { name: 'corner_br', matrix: [[0, 1], [1, 1]] },

  // Big L (3x3 corner)
  { name: 'big_corner_tl', matrix: [[1, 1, 1], [1, 0, 0], [1, 0, 0]] },
  { name: 'big_corner_tr', matrix: [[1, 1, 1], [0, 0, 1], [0, 0, 1]] },
  { name: 'big_corner_bl', matrix: [[1, 0, 0], [1, 0, 0], [1, 1, 1]] },
  { name: 'big_corner_br', matrix: [[0, 0, 1], [0, 0, 1], [1, 1, 1]] },

  // L-Shapes (3x2)
  { name: 'l_dl', matrix: [[1, 0], [1, 0], [1, 1]] },
  { name: 'l_dr', matrix: [[0, 1], [0, 1], [1, 1]] },
  { name: 'l_ul', matrix: [[1, 1], [1, 0], [1, 0]] },
  { name: 'l_ur', matrix: [[1, 1], [0, 1], [0, 1]] },

  // L-Shapes (2x3)
  { name: 'l_h_tl', matrix: [[1, 1, 1], [1, 0, 0]] },
  { name: 'l_h_tr', matrix: [[1, 1, 1], [0, 0, 1]] },
  { name: 'l_h_bl', matrix: [[1, 0, 0], [1, 1, 1]] },
  { name: 'l_h_br', matrix: [[0, 0, 1], [1, 1, 1]] },

  // T-Shapes
  { name: 't_down', matrix: [[1, 1, 1], [0, 1, 0]] },
  { name: 't_up', matrix: [[0, 1, 0], [1, 1, 1]] },
  { name: 't_left', matrix: [[0, 1], [1, 1], [0, 1]] },
  { name: 't_right', matrix: [[1, 0], [1, 1], [1, 0]] },

  // Z and S shapes
  { name: 'z_h', matrix: [[1, 1, 0], [0, 1, 1]] },
  { name: 's_h', matrix: [[0, 1, 1], [1, 1, 0]] },
  { name: 'z_v', matrix: [[0, 1], [1, 1], [1, 0]] },
  { name: 's_v', matrix: [[1, 0], [1, 1], [0, 1]] },
]

/**
 * Creates an empty 8x8 grid.
 */
export function createEmptyGrid(): Grid {
  return Array.from({ length: GRID_SIZE }, () =>
    Array.from({ length: GRID_SIZE }, () => ({
      filled: false,
      color: null,
    })),
  )
}

/**
 * Deep clones a grid immutably.
 */
export function cloneGrid(grid: Grid): Grid {
  return grid.map((row) => row.map((cell) => ({ ...cell })))
}

let pieceCounter = 0

/**
 * Generates a random polyomino piece with a harmonious jewel color.
 */
export function generatePiece(): PieceShape {
  const t = SHAPE_TEMPLATES[Math.floor(Math.random() * SHAPE_TEMPLATES.length)]
  const c = PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)]
  return {
    id: `p_${++pieceCounter}_${Date.now()}`,
    name: t.name,
    matrix: t.matrix,
    color: c.color,
    glow: c.glow,
    dark: c.dark,
  }
}

/**
 * Generates a batch of 3 pieces ensuring at least one piece can fit if board isn't saturated.
 */
export function generatePieceTray(grid: Grid): PieceShape[] {
  const pieces: PieceShape[] = []
  for (let i = 0; i < 3; i++) {
    pieces.push(generatePiece())
  }

  // If none of the 3 pieces can fit, replace the first with an easier piece (like dot or 2-bar)
  if (!pieces.some((p) => canPlacePieceAnywhere(grid, p))) {
    const easyTemplates = SHAPE_TEMPLATES.filter(
      (t) => t.name === 'dot' || t.name === 'bar_h2' || t.name === 'bar_v2',
    )
    const easy = easyTemplates[Math.floor(Math.random() * easyTemplates.length)]
    const c = PIECE_COLORS[Math.floor(Math.random() * PIECE_COLORS.length)]
    pieces[0] = {
      id: `p_${++pieceCounter}_${Date.now()}`,
      name: easy.name,
      matrix: easy.matrix,
      color: c.color,
      glow: c.glow,
      dark: c.dark,
    }
  }

  return pieces
}

/**
 * Checks if a piece can be placed at (startRow, startCol).
 */
export function canPlacePiece(
  grid: Grid,
  piece: PieceShape,
  startRow: number,
  startCol: number,
): boolean {
  const pRows = piece.matrix.length
  const pCols = piece.matrix[0].length

  if (startRow < 0 || startCol < 0) return false
  if (startRow + pRows > GRID_SIZE || startCol + pCols > GRID_SIZE) return false

  for (let r = 0; r < pRows; r++) {
    for (let c = 0; c < pCols; c++) {
      if (piece.matrix[r][c] === 1) {
        const gr = startRow + r
        const gc = startCol + c
        if (grid[gr][gc].filled) return false
      }
    }
  }

  return true
}

/**
 * Checks if a piece can fit anywhere on the board.
 */
export function canPlacePieceAnywhere(grid: Grid, piece: PieceShape): boolean {
  const pRows = piece.matrix.length
  const pCols = piece.matrix[0].length

  for (let r = 0; r <= GRID_SIZE - pRows; r++) {
    for (let c = 0; c <= GRID_SIZE - pCols; c++) {
      if (canPlacePiece(grid, piece, r, c)) {
        return true
      }
    }
  }

  return false
}

/**
 * Checks if ANY available piece can be placed anywhere on the board.
 */
export function hasAnyLegalMove(grid: Grid, pieces: (PieceShape | null)[]): boolean {
  for (const p of pieces) {
    if (p && canPlacePieceAnywhere(grid, p)) {
      return true
    }
  }
  return false
}

export interface ClearResult {
  rows: number[]
  cols: number[]
  clearedCellCoordinates: { r: number; c: number }[]
  scoreAdded: number
}

/**
 * Identifies all completed rows and columns on the board.
 */
export function detectCompletedLines(grid: Grid): ClearResult {
  const rowsToClear: number[] = []
  const colsToClear: number[] = []

  // Check horizontal rows
  for (let r = 0; r < GRID_SIZE; r++) {
    if (grid[r].every((cell) => cell.filled)) {
      rowsToClear.push(r)
    }
  }

  // Check vertical columns
  for (let c = 0; c < GRID_SIZE; c++) {
    let colFilled = true
    for (let r = 0; r < GRID_SIZE; r++) {
      if (!grid[r][c].filled) {
        colFilled = false
        break
      }
    }
    if (colFilled) {
      colsToClear.push(c)
    }
  }

  // Collect unique cell coordinates to blast
  const coordsMap = new Set<string>()
  for (const r of rowsToClear) {
    for (let c = 0; c < GRID_SIZE; c++) {
      coordsMap.add(`${r},${c}`)
    }
  }
  for (const c of colsToClear) {
    for (let r = 0; r < GRID_SIZE; r++) {
      coordsMap.add(`${r},${c}`)
    }
  }

  const clearedCellCoordinates = Array.from(coordsMap).map((k) => {
    const [r, c] = k.split(',').map(Number)
    return { r, c }
  })

  // Total lines cleared
  const totalLines = rowsToClear.length + colsToClear.length

  // Block Blast classic scoring:
  // 1 line: 100, 2 lines: 300, 3 lines: 600, 4 lines: 1000, 5+: 1500+
  let scoreAdded = 0
  if (totalLines === 1) scoreAdded = 100
  else if (totalLines === 2) scoreAdded = 300
  else if (totalLines === 3) scoreAdded = 600
  else if (totalLines === 4) scoreAdded = 1000
  else if (totalLines >= 5) scoreAdded = 1000 + (totalLines - 4) * 500

  return {
    rows: rowsToClear,
    cols: colsToClear,
    clearedCellCoordinates,
    scoreAdded,
  }
}

/**
 * Places a piece on the grid and marks it.
 */
export function placePiece(
  grid: Grid,
  piece: PieceShape,
  startRow: number,
  startCol: number,
): { newGrid: Grid; tilesPlacedCount: number } {
  const newGrid = cloneGrid(grid)
  let tilesPlacedCount = 0

  for (let r = 0; r < piece.matrix.length; r++) {
    for (let c = 0; c < piece.matrix[0].length; c++) {
      if (piece.matrix[r][c] === 1) {
        newGrid[startRow + r][startCol + c] = {
          filled: true,
          color: piece.color,
        }
        tilesPlacedCount++
      }
    }
  }

  return { newGrid, tilesPlacedCount }
}

/**
 * Clears lines from the grid.
 */
export function clearLinesFromGrid(
  grid: Grid,
  rows: number[],
  cols: number[],
): Grid {
  const newGrid = cloneGrid(grid)

  for (const r of rows) {
    for (let c = 0; c < GRID_SIZE; c++) {
      newGrid[r][c] = { filled: false, color: null }
    }
  }

  for (const c of cols) {
    for (let r = 0; r < GRID_SIZE; r++) {
      newGrid[r][c] = { filled: false, color: null }
    }
  }

  return newGrid
}
