import type { Dir } from '../../lib/hooks'

export const SIZE = 4

export type Tile = {
  id: number
  value: number
  row: number
  col: number
  /** Set on the frame the tile was produced by a merge. */
  merged?: boolean
  /** Set on the frame the tile was spawned. */
  fresh?: boolean
}

export type Board = {
  tiles: Tile[]
  score: number
  best: number
}

let nextId = 1
const newId = () => nextId++

const emptyCells = (tiles: Tile[]) => {
  const taken = new Set(tiles.map((t) => `${t.row},${t.col}`))
  const out: { row: number; col: number }[] = []
  for (let row = 0; row < SIZE; row++)
    for (let col = 0; col < SIZE; col++)
      if (!taken.has(`${row},${col}`)) out.push({ row, col })
  return out
}

export function spawn(tiles: Tile[]): Tile[] {
  const free = emptyCells(tiles)
  if (free.length === 0) return tiles
  const cell = free[Math.floor(Math.random() * free.length)]
  // classic 2048 odds: 90% a 2, 10% a 4
  const value = Math.random() < 0.9 ? 2 : 4
  return [...tiles, { id: newId(), value, ...cell, fresh: true }]
}

export function init(): Tile[] {
  return spawn(spawn([]))
}

/** Traversal order so tiles nearest the target wall move first. */
function lines(dir: Dir): { row: number; col: number }[][] {
  const idx = [0, 1, 2, 3]
  const out: { row: number; col: number }[][] = []
  if (dir === 'left' || dir === 'right') {
    for (const row of idx) {
      const cols = dir === 'left' ? idx : [...idx].reverse()
      out.push(cols.map((col) => ({ row, col })))
    }
  } else {
    for (const col of idx) {
      const rows = dir === 'up' ? idx : [...idx].reverse()
      out.push(rows.map((row) => ({ row, col })))
    }
  }
  return out
}

export type MoveResult = {
  tiles: Tile[]
  gained: number
  moved: boolean
  /** Highest value created by a merge this move, for sound pitch. */
  topMerge: number
}

export function move(tiles: Tile[], dir: Dir): MoveResult {
  const at = new Map(tiles.map((t) => [`${t.row},${t.col}`, t]))
  const result: Tile[] = []
  let gained = 0
  let moved = false
  let topMerge = 0

  for (const line of lines(dir)) {
    // pull out the occupied cells in traversal order
    const present = line
      .map((c) => at.get(`${c.row},${c.col}`))
      .filter((t): t is Tile => Boolean(t))

    let slot = 0
    let i = 0
    while (i < present.length) {
      const tile = present[i]
      const next = present[i + 1]
      const target = line[slot]

      if (next && next.value === tile.value) {
        // merge the pair into a single tile at the target cell
        const value = tile.value * 2
        gained += value
        topMerge = Math.max(topMerge, value)
        result.push({ id: tile.id, value, row: target.row, col: target.col, merged: true })
        moved = true
        i += 2
      } else {
        if (tile.row !== target.row || tile.col !== target.col) moved = true
        result.push({ id: tile.id, value: tile.value, row: target.row, col: target.col })
        i += 1
      }
      slot += 1
    }
  }

  return { tiles: result, gained, moved, topMerge }
}

export function canMove(tiles: Tile[]) {
  if (tiles.length < SIZE * SIZE) return true
  return (['up', 'down', 'left', 'right'] as Dir[]).some((d) => move(tiles, d).moved)
}

export const maxTile = (tiles: Tile[]) => tiles.reduce((m, t) => Math.max(m, t.value), 0)

/** Tile palette — warm low values climbing to a hot, glowing 2048. */
export function tileStyle(value: number): { bg: string; fg: string; glow?: string } {
  switch (value) {
    case 2:
      return { bg: 'rgba(255,255,255,0.14)', fg: 'var(--text)' }
    case 4:
      return { bg: 'rgba(255,255,255,0.22)', fg: 'var(--text)' }
    case 8:
      return { bg: 'linear-gradient(145deg,#fbbf24,#f59e0b)', fg: '#3a2200' }
    case 16:
      return { bg: 'linear-gradient(145deg,#fb923c,#f97316)', fg: '#3a1a00' }
    case 32:
      return { bg: 'linear-gradient(145deg,#fb7185,#f43f5e)', fg: '#fff' }
    case 64:
      return { bg: 'linear-gradient(145deg,#f43f5e,#e11d48)', fg: '#fff' }
    case 128:
      return { bg: 'linear-gradient(145deg,#e879f9,#d946ef)', fg: '#fff', glow: '#d946ef' }
    case 256:
      return { bg: 'linear-gradient(145deg,#c084fc,#a855f7)', fg: '#fff', glow: '#a855f7' }
    case 512:
      return { bg: 'linear-gradient(145deg,#a78bfa,#7c3aed)', fg: '#fff', glow: '#7c3aed' }
    case 1024:
      return { bg: 'linear-gradient(145deg,#38bdf8,#0ea5e9)', fg: '#fff', glow: '#0ea5e9' }
    default:
      return { bg: 'linear-gradient(145deg,#22d3ee,#06b6d4)', fg: '#03212a', glow: '#22d3ee' }
  }
}
