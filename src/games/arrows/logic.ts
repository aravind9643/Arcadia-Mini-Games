/**
 * Arrow-escape puzzle logic.
 *
 * Each arrow occupies one or more cells and points in a fixed direction.
 * Tapping it casts a ray from its head; if every cell on that ray is empty
 * the arrow slides out and is removed, otherwise the tap is a mistake.
 *
 * Removal only ever frees space, so the state space is monotone: a level
 * built with a valid removal order can never be made unsolvable by play.
 * That is why generation works backwards — see `generate`.
 */

export type Dir = 'up' | 'down' | 'left' | 'right'

export type Cell = { x: number; y: number }

export type Arrow = {
  id: number
  dir: Dir
  /** Every cell the arrow occupies. `cells[0]` is the head. */
  cells: Cell[]
  colorIndex: number
}

export type Level = {
  size: number
  arrows: Arrow[]
  /** Permanently blocked cells. */
  walls: Cell[]
}

export const DELTA: Record<Dir, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

export const DIRS: Dir[] = ['up', 'down', 'left', 'right']

export const ARROW_COLORS = [
  '#f472b6',
  '#22d3ee',
  '#a3e635',
  '#fbbf24',
  '#c084fc',
  '#fb7185',
  '#38bdf8',
  '#2dd4bf',
]

const key = (c: Cell) => `${c.x},${c.y}`

/** Every occupied cell on the board, by owner id (-1 for walls). */
function occupancy(level: Level, alive: Set<number>): Map<string, number> {
  const map = new Map<string, number>()
  for (const w of level.walls) map.set(key(w), -1)
  for (const a of level.arrows) {
    if (!alive.has(a.id)) continue
    for (const c of a.cells) map.set(key(c), a.id)
  }
  return map
}

/**
 * The cells an arrow's head passes through on its way off the board.
 * Stops at the board edge; does not include the head cell itself.
 */
export function exitRay(arrow: Arrow, size: number): Cell[] {
  const d = DELTA[arrow.dir]
  const out: Cell[] = []
  let { x, y } = arrow.cells[0]
  for (;;) {
    x += d.x
    y += d.y
    if (x < 0 || y < 0 || x >= size || y >= size) break
    out.push({ x, y })
  }
  return out
}

/** An arrow is free when nothing occupies its exit ray. */
export function isFree(level: Level, alive: Set<number>, arrow: Arrow): boolean {
  const occ = occupancy(level, alive)
  return exitRay(arrow, level.size).every((c) => {
    const owner = occ.get(key(c))
    // its own body never blocks it — the head leads and the tail follows
    return owner === undefined || owner === arrow.id
  })
}

export const freeArrows = (level: Level, alive: Set<number>): Arrow[] =>
  level.arrows.filter((a) => alive.has(a.id) && isFree(level, alive, a))

/* ------------------------------------------------------------------ */
/*  Generation                                                         */
/* ------------------------------------------------------------------ */

export type Difficulty = 'Easy' | 'Medium' | 'Hard'

type Spec = { size: number; count: number; maxLen: number; bendChance: number }

const SPECS: Record<Difficulty, Spec> = {
  Easy: { size: 5, count: 7, maxLen: 2, bendChance: 0 },
  Medium: { size: 6, count: 11, maxLen: 3, bendChance: 0.25 },
  Hard: { size: 7, count: 15, maxLen: 3, bendChance: 0.4 },
}

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

/**
 * Builds a body of `len` cells starting at `head`, growing away from the
 * exit direction so the tail trails behind. May bend once.
 */
function buildBody(head: Cell, dir: Dir, len: number, bend: boolean): Cell[] {
  const back = DELTA[dir]
  const cells: Cell[] = [head]
  let cur = head
  // perpendicular options for the bend
  const side: Cell[] =
    dir === 'up' || dir === 'down'
      ? [
          { x: -1, y: 0 },
          { x: 1, y: 0 },
        ]
      : [
          { x: 0, y: -1 },
          { x: 0, y: 1 },
        ]
  const bendAt = bend && len > 2 ? randInt(1, len - 1) : -1
  const bendDir = side[Math.floor(Math.random() * side.length)]

  for (let i = 1; i < len; i++) {
    const step = i === bendAt ? bendDir : { x: -back.x, y: -back.y }
    cur = { x: cur.x + step.x, y: cur.y + step.y }
    cells.push(cur)
  }
  return cells
}

/**
 * Generates a solvable level by construction.
 *
 * Arrows are laid down in *reverse* removal order: each new arrow is placed
 * so that its exit ray is clear of everything placed so far. Replaying the
 * placement order backwards is therefore always a valid solution.
 */
export function generate(difficulty: Difficulty): Level {
  const spec = SPECS[difficulty]
  const { size } = spec

  for (let attempt = 0; attempt < 40; attempt++) {
    const placed: Arrow[] = []
    const taken = new Set<string>()
    let id = 1

    for (let n = 0; n < spec.count; n++) {
      let put: Arrow | null = null

      // try random placements until one fits and has a clear exit
      for (let tries = 0; tries < 140 && !put; tries++) {
        const dir = DIRS[Math.floor(Math.random() * DIRS.length)]
        const len = randInt(1, spec.maxLen)
        const bend = Math.random() < spec.bendChance
        const head = { x: randInt(0, size - 1), y: randInt(0, size - 1) }
        const cells = buildBody(head, dir, len, bend)

        // body must stay on the board and not overlap anything placed
        const fits = cells.every(
          (c) =>
            c.x >= 0 &&
            c.y >= 0 &&
            c.x < size &&
            c.y < size &&
            !taken.has(key(c)),
        )
        if (!fits) continue
        // no duplicate cells within the body itself
        if (new Set(cells.map(key)).size !== cells.length) continue

        const candidate: Arrow = {
          id,
          dir,
          cells,
          colorIndex: (id - 1) % ARROW_COLORS.length,
        }

        // its exit ray must be clear of everything already on the board,
        // which is what makes this arrow removable *before* all of them
        const bodySet = new Set(cells.map(key))
        const rayClear = exitRay(candidate, size).every(
          (c) => !taken.has(key(c)) || bodySet.has(key(c)),
        )
        if (!rayClear) continue

        put = candidate
      }

      if (!put) break
      placed.push(put)
      for (const c of put.cells) taken.add(key(c))
      id++
    }

    // Placement order is reverse removal order, so reverse it to get the
    // on-screen list; the level is solvable regardless of listing order.
    if (placed.length >= Math.ceil(spec.count * 0.7)) {
      return { size, arrows: placed.reverse(), walls: [] }
    }
  }

  // Fallback: a trivially solvable board, so the game never hands back null.
  return {
    size,
    arrows: [
      { id: 1, dir: 'left', cells: [{ x: 0, y: 0 }], colorIndex: 0 },
      { id: 2, dir: 'right', cells: [{ x: size - 1, y: 1 }], colorIndex: 1 },
    ],
    walls: [],
  }
}

/**
 * Greedy solver. Because removal is monotone, repeatedly taking any free
 * arrow is guaranteed to finish if a solution exists — no backtracking.
 * Used to verify generated levels and to power the hint button.
 */
export function solve(level: Level): number[] | null {
  const alive = new Set(level.arrows.map((a) => a.id))
  const order: number[] = []

  while (alive.size > 0) {
    const next = level.arrows.find((a) => alive.has(a.id) && isFree(level, alive, a))
    if (!next) return null
    alive.delete(next.id)
    order.push(next.id)
  }
  return order
}

/** The next arrow a hint should point at, given the current board. */
export function hintFor(level: Level, alive: Set<number>): Arrow | null {
  return level.arrows.find((a) => alive.has(a.id) && isFree(level, alive, a)) ?? null
}
