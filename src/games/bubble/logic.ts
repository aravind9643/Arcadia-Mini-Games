export const COLS = 9
export const ROWS = 12

/** -1 is an empty cell; 0..n index into COLORS. */
export type Board = number[]

export const COLORS = ['#22d3ee', '#f472b6', '#a3e635', '#fbbf24', '#a78bfa']

export const makeBoard = (colors: number): Board =>
  Array.from({ length: COLS * ROWS }, () => Math.floor(Math.random() * colors))

const at = (r: number, c: number) => r * COLS + c

/** Flood-fills the same-coloured cluster containing `start`. */
export function clusterAt(board: Board, start: number): number[] {
  const color = board[start]
  if (color < 0) return []

  const seen = new Set<number>()
  const stack = [start]
  while (stack.length) {
    const i = stack.pop()!
    if (seen.has(i)) continue
    if (board[i] !== color) continue
    seen.add(i)

    const r = Math.floor(i / COLS)
    const c = i % COLS
    if (r > 0) stack.push(at(r - 1, c))
    if (r < ROWS - 1) stack.push(at(r + 1, c))
    if (c > 0) stack.push(at(r, c - 1))
    if (c < COLS - 1) stack.push(at(r, c + 1))
  }
  return [...seen]
}

/**
 * Drops bubbles into the gaps below them, then shifts whole empty columns
 * to the left — the standard "same game" settle.
 */
export function settle(board: Board): Board {
  const grid: number[][] = []
  for (let c = 0; c < COLS; c++) {
    const col: number[] = []
    for (let r = ROWS - 1; r >= 0; r--) {
      const v = board[at(r, c)]
      if (v >= 0) col.push(v)
    }
    grid.push(col)
  }

  const kept = grid.filter((col) => col.length > 0)

  const next: Board = Array(COLS * ROWS).fill(-1)
  kept.forEach((col, c) => {
    col.forEach((v, k) => {
      next[at(ROWS - 1 - k, c)] = v
    })
  })
  return next
}

/** Quadratic scoring, so big clusters are worth far more than small ones. */
export const scoreFor = (n: number) => n * (n - 1) * 5

/** True when no group of 2+ remains anywhere. */
export function hasMoves(board: Board): boolean {
  for (let i = 0; i < board.length; i++) {
    if (board[i] < 0) continue
    const r = Math.floor(i / COLS)
    const c = i % COLS
    if (c < COLS - 1 && board[at(r, c + 1)] === board[i]) return true
    if (r < ROWS - 1 && board[at(r + 1, c)] === board[i]) return true
  }
  return false
}

export const remaining = (board: Board) => board.filter((v) => v >= 0).length
