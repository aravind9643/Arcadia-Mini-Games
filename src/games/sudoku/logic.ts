export type Grid = number[] // 81 cells, 0 = empty

const idx = (r: number, c: number) => r * 9 + c

export function canPlace(g: Grid, pos: number, v: number): boolean {
  const r = Math.floor(pos / 9)
  const c = pos % 9
  for (let i = 0; i < 9; i++) {
    if (g[idx(r, i)] === v && idx(r, i) !== pos) return false
    if (g[idx(i, c)] === v && idx(i, c) !== pos) return false
  }
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++) {
      const p = idx(br + dr, bc + dc)
      if (g[p] === v && p !== pos) return false
    }
  return true
}

const shuffled = <T,>(a: T[]): T[] => {
  const out = [...a]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Fills an empty grid with a random valid solution. */
function fill(g: Grid): boolean {
  const pos = g.indexOf(0)
  if (pos === -1) return true
  for (const v of shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
    if (canPlace(g, pos, v)) {
      g[pos] = v
      if (fill(g)) return true
      g[pos] = 0
    }
  }
  return false
}

/** Counts solutions, stopping at `cap` — used to guarantee uniqueness. */
function countSolutions(g: Grid, cap = 2): number {
  const pos = g.indexOf(0)
  if (pos === -1) return 1
  let total = 0
  for (let v = 1; v <= 9; v++) {
    if (!canPlace(g, pos, v)) continue
    g[pos] = v
    total += countSolutions(g, cap)
    g[pos] = 0
    if (total >= cap) break
  }
  return total
}

export type Level = 'Easy' | 'Medium' | 'Hard'

const HOLES: Record<Level, number> = { Easy: 38, Medium: 46, Hard: 52 }

export type Puzzle = { puzzle: Grid; solution: Grid; givens: boolean[] }

/**
 * Digs holes out of a full solution, keeping the puzzle uniquely solvable.
 * Symmetric removal (cell + its mirror) gives the classic Sudoku look.
 */
export function generate(level: Level): Puzzle {
  const solution: Grid = Array(81).fill(0)
  fill(solution)

  const puzzle = [...solution]
  const target = HOLES[level]
  let removed = 0

  for (const p of shuffled([...Array(81).keys()])) {
    if (removed >= target) break
    const mirror = 80 - p
    if (puzzle[p] === 0) continue

    const savedA = puzzle[p]
    const savedB = puzzle[mirror]
    puzzle[p] = 0
    puzzle[mirror] = 0

    if (countSolutions([...puzzle]) !== 1) {
      puzzle[p] = savedA
      puzzle[mirror] = savedB
    } else {
      removed += p === mirror ? 1 : 2
    }
  }

  return { puzzle, solution, givens: puzzle.map((v) => v !== 0) }
}

/** Cells that clash with another copy of the same digit. */
export function conflicts(g: Grid): Set<number> {
  const bad = new Set<number>()
  for (let p = 0; p < 81; p++) {
    const v = g[p]
    if (v === 0) continue
    if (!canPlace(g, p, v)) bad.add(p)
  }
  return bad
}

export const isSolved = (g: Grid) => !g.includes(0) && conflicts(g).size === 0

/** How many of each digit are already placed, for the keypad counters. */
export function digitCounts(g: Grid): number[] {
  const counts = Array(10).fill(0)
  for (const v of g) if (v > 0) counts[v]++
  return counts
}

/** Peers of a cell: same row, column or box — used for highlighting. */
export function peersOf(pos: number): Set<number> {
  const out = new Set<number>()
  const r = Math.floor(pos / 9)
  const c = pos % 9
  for (let i = 0; i < 9; i++) {
    out.add(idx(r, i))
    out.add(idx(i, c))
  }
  const br = Math.floor(r / 3) * 3
  const bc = Math.floor(c / 3) * 3
  for (let dr = 0; dr < 3; dr++)
    for (let dc = 0; dc < 3; dc++) out.add(idx(br + dr, bc + dc))
  out.delete(pos)
  return out
}
