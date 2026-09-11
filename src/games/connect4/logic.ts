export const COLS = 7
export const ROWS = 6

/** 0 empty, 1 player (red), 2 computer (yellow). */
export type Disc = 0 | 1 | 2
export type Board = Disc[][]

export const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array<Disc>(COLS).fill(0))

export const validCols = (b: Board) =>
  Array.from({ length: COLS }, (_, c) => c).filter((c) => b[0][c] === 0)

/** Row a disc would land in, or -1 if the column is full. */
export function landingRow(b: Board, col: number): number {
  for (let r = ROWS - 1; r >= 0; r--) if (b[r][col] === 0) return r
  return -1
}

export function drop(b: Board, col: number, disc: Disc): { board: Board; row: number } {
  const row = landingRow(b, col)
  if (row < 0) return { board: b, row: -1 }
  const next = b.map((r) => [...r])
  next[row][col] = disc
  return { board: next, row }
}

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const

/** The four winning cells, or null. */
export function winnerLine(b: Board): { disc: Disc; cells: [number, number][] } | null {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const disc = b[r][c]
      if (disc === 0) continue
      for (const [dr, dc] of DIRS) {
        const cells: [number, number][] = [[r, c]]
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break
          if (b[nr][nc] !== disc) break
          cells.push([nr, nc])
        }
        if (cells.length === 4) return { disc, cells }
      }
    }
  }
  return null
}

export const isFull = (b: Board) => b[0].every((c) => c !== 0)

/* ---------------- AI ---------------- */

/** Scores a 4-cell window from the computer's point of view. */
function scoreWindow(win: Disc[], me: Disc): number {
  const you: Disc = me === 1 ? 2 : 1
  const mine = win.filter((d) => d === me).length
  const theirs = win.filter((d) => d === you).length
  const empty = win.filter((d) => d === 0).length

  if (mine === 4) return 10_000
  if (mine === 3 && empty === 1) return 60
  if (mine === 2 && empty === 2) return 8
  // block an imminent loss more eagerly than we chase our own three
  if (theirs === 3 && empty === 1) return -80
  if (theirs === 2 && empty === 2) return -6
  return 0
}

function evaluate(b: Board, me: Disc): number {
  let score = 0

  // centre control is worth a lot in Connect Four
  const centre = b.map((r) => r[Math.floor(COLS / 2)]).filter((d) => d === me).length
  score += centre * 6

  const windows: Disc[][] = []
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3
        const ec = c + dc * 3
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue
        windows.push([0, 1, 2, 3].map((k) => b[r + dr * k][c + dc * k]))
      }

  for (const w of windows) score += scoreWindow(w, me)
  return score
}

function minimax(
  b: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximising: boolean,
  me: Disc,
): { score: number; col: number } {
  const win = winnerLine(b)
  if (win) {
    // prefer faster wins and slower losses
    const s = win.disc === me ? 100_000 + depth : -100_000 - depth
    return { score: s, col: -1 }
  }
  if (isFull(b) || depth === 0) return { score: evaluate(b, me), col: -1 }

  const you: Disc = me === 1 ? 2 : 1
  // search the middle first — it prunes far more branches
  const cols = validCols(b).sort(
    (a, c) => Math.abs(a - COLS / 2) - Math.abs(c - COLS / 2),
  )
  let bestCol = cols[0]

  if (maximising) {
    let value = -Infinity
    for (const c of cols) {
      const { board } = drop(b, c, me)
      const { score } = minimax(board, depth - 1, alpha, beta, false, me)
      if (score > value) {
        value = score
        bestCol = c
      }
      alpha = Math.max(alpha, value)
      if (alpha >= beta) break
    }
    return { score: value, col: bestCol }
  }

  let value = Infinity
  for (const c of cols) {
    const { board } = drop(b, c, you)
    const { score } = minimax(board, depth - 1, alpha, beta, true, me)
    if (score < value) {
      value = score
      bestCol = c
    }
    beta = Math.min(beta, value)
    if (alpha >= beta) break
  }
  return { score: value, col: bestCol }
}

export type Level = 'Easy' | 'Medium' | 'Hard'

const DEPTH: Record<Level, number> = { Easy: 1, Medium: 3, Hard: 5 }

export function aiMove(b: Board, level: Level): number {
  const cols = validCols(b)
  if (cols.length === 0) return -1
  // a little randomness on Easy keeps it from feeling robotic
  if (level === 'Easy' && Math.random() < 0.4) {
    return cols[Math.floor(Math.random() * cols.length)]
  }
  const { col } = minimax(b, DEPTH[level], -Infinity, Infinity, true, 2)
  return col >= 0 ? col : cols[0]
}
