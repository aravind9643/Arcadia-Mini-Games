export const COLS = 10
export const ROWS = 18

/** 0 = empty, 1..7 = a piece colour index. */
export type Cell = number
export type Grid = Cell[][]

export const emptyGrid = (): Grid =>
  Array.from({ length: ROWS }, () => Array<Cell>(COLS).fill(0))

/**
 * Rotation states are pre-baked rather than computed, so each piece spins
 * around the centre players expect (standard Tetris kicks aren't needed at
 * this scale).
 */
const SHAPES: Record<string, number[][][]> = {
  I: [
    [[0, 1], [1, 1], [2, 1], [3, 1]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
  ],
  O: [[[1, 0], [2, 0], [1, 1], [2, 1]]],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
}

const KEYS = Object.keys(SHAPES)

/** Colour index per piece type, matched to COLORS. */
export const INDEX: Record<string, number> = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 }

export const COLORS = [
  'transparent',
  '#22d3ee', // I
  '#fbbf24', // O
  '#c084fc', // T
  '#4ade80', // S
  '#fb7185', // Z
  '#60a5fa', // J
  '#fb923c', // L
]

export const colorOf = (type: string) => COLORS[INDEX[type]]

export type Piece = {
  type: string
  rot: number
  x: number
  y: number
}

export const spawnPiece = (type = KEYS[Math.floor(Math.random() * KEYS.length)]): Piece => ({
  type,
  rot: 0,
  x: Math.floor(COLS / 2) - 2,
  y: -1,
})

export const randomType = () => KEYS[Math.floor(Math.random() * KEYS.length)]

/** Absolute board cells occupied by a piece. */
export function cellsOf(p: Piece): [number, number][] {
  const states = SHAPES[p.type]
  const shape = states[p.rot % states.length]
  return shape.map(([dx, dy]) => [p.x + dx, p.y + dy])
}

export function collides(grid: Grid, p: Piece): boolean {
  return cellsOf(p).some(([x, y]) => {
    if (x < 0 || x >= COLS || y >= ROWS) return true
    // above the ceiling is legal while the piece is still entering
    if (y < 0) return false
    return grid[y][x] !== 0
  })
}

export function merge(grid: Grid, p: Piece): Grid {
  const next = grid.map((r) => [...r])
  for (const [x, y] of cellsOf(p)) {
    if (y >= 0 && y < ROWS && x >= 0 && x < COLS) next[y][x] = INDEX[p.type]
  }
  return next
}

/** Removes full rows, returning the new grid and how many cleared. */
export function clearLines(grid: Grid): { grid: Grid; cleared: number } {
  const kept = grid.filter((row) => row.some((c) => c === 0))
  const cleared = ROWS - kept.length
  if (cleared === 0) return { grid, cleared: 0 }
  const fresh = Array.from({ length: cleared }, () => Array<Cell>(COLS).fill(0))
  return { grid: [...fresh, ...kept], cleared }
}

/** Standard-ish line scoring, scaled by level. */
export const lineScore = (cleared: number, level: number) =>
  [0, 100, 300, 500, 800][cleared] * (level + 1)

/** Where the piece would land if dropped — used for the ghost preview. */
export function hardDropTarget(grid: Grid, p: Piece): Piece {
  let ghost = { ...p }
  while (!collides(grid, { ...ghost, y: ghost.y + 1 })) ghost = { ...ghost, y: ghost.y + 1 }
  return ghost
}

export const rotate = (p: Piece): Piece => ({
  ...p,
  rot: (p.rot + 1) % SHAPES[p.type].length,
})

/** Gravity interval in ms for a level. */
export const speedFor = (level: number) => Math.max(90, 800 - level * 65)
