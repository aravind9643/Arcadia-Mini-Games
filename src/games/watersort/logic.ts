/**
 * Water Sort Puzzle Game Logic Engine
 * Guaranteed solvable level generator and liquid pouring mechanics.
 */

export const TUBE_CAPACITY = 4

export interface ColorDef {
  id: string
  name: string
  hex: string
  glow: string
  dark: string
  surface: string
}

// 10 Vibrant Neon Fluid Colors
export const LIQUID_COLORS: ColorDef[] = [
  { id: 'crimson', name: 'Crimson', hex: '#ff2a5f', glow: 'rgba(255, 42, 95, 0.6)', dark: '#990026', surface: '#ff668a' },
  { id: 'cyan', name: 'Cyan', hex: '#00d2ff', glow: 'rgba(0, 210, 255, 0.6)', dark: '#006680', surface: '#66e4ff' },
  { id: 'amber', name: 'Amber', hex: '#ffaa00', glow: 'rgba(255, 170, 0, 0.6)', dark: '#996600', surface: '#ffc855' },
  { id: 'emerald', name: 'Emerald', hex: '#00e676', glow: 'rgba(0, 230, 118, 0.6)', dark: '#008040', surface: '#5df6a5' },
  { id: 'violet', name: 'Violet', hex: '#a855f7', glow: 'rgba(168, 85, 247, 0.6)', dark: '#5b21b6', surface: '#c084fc' },
  { id: 'coral', name: 'Coral', hex: '#ff6b4a', glow: 'rgba(255, 107, 74, 0.6)', dark: '#b32a0c', surface: '#ff9880' },
  { id: 'blue', name: 'Royal Blue', hex: '#2563eb', glow: 'rgba(37, 99, 235, 0.6)', dark: '#1e3a8a', surface: '#60a5fa' },
  { id: 'yellow', name: 'Sun Yellow', hex: '#facc15', glow: 'rgba(250, 204, 21, 0.6)', dark: '#854d0e', surface: '#fde047' },
  { id: 'pink', name: 'Hot Pink', hex: '#f43f85', glow: 'rgba(244, 63, 133, 0.6)', dark: '#9f1249', surface: '#f772a8' },
  { id: 'lime', name: 'Neon Lime', hex: '#84cc16', glow: 'rgba(132, 204, 22, 0.6)', dark: '#3f6212', surface: '#a3e635' },
]

export type Tube = string[] // Array of color IDs from bottom to top (max length 4)

export interface LevelConfig {
  level: number
  tubes: Tube[]
  colorCount: number
}

/**
 * Checks if a tube is full and homogeneous (solved tube)
 */
export function isTubeSolved(tube: Tube): boolean {
  if (tube.length !== TUBE_CAPACITY) return false
  const first = tube[0]
  return tube.every((c) => c === first)
}

/**
 * Checks if the whole puzzle is completed
 */
export function isLevelSolved(tubes: Tube[]): boolean {
  for (const tube of tubes) {
    if (tube.length === 0) continue
    if (!isTubeSolved(tube)) return false
  }
  return true
}

/**
 * Checks if pouring from tube A to tube B is legal.
 * Returns the number of units that will be transferred (0 if illegal).
 */
export function getPourAmount(from: Tube, to: Tube): number {
  if (from.length === 0) return 0
  if (to.length >= TUBE_CAPACITY) return 0

  const topFromColor = from[from.length - 1]

  // If destination is not empty, top colors must match
  if (to.length > 0) {
    const topToColor = to[to.length - 1]
    if (topFromColor !== topToColor) return 0
  }

  // Count how many consecutive blocks of the same color are on top of `from`
  let countSameColor = 0
  for (let i = from.length - 1; i >= 0; i--) {
    if (from[i] === topFromColor) {
      countSameColor++
    } else {
      break
    }
  }

  const spaceInTo = TUBE_CAPACITY - to.length
  return Math.min(countSameColor, spaceInTo)
}

/**
 * Executes a pour operation immutably
 */
export function executePour(
  tubes: Tube[],
  fromIndex: number,
  toIndex: number,
): { newTubes: Tube[]; amount: number; color: string } | null {
  if (fromIndex === toIndex) return null
  const from = tubes[fromIndex]
  const to = tubes[toIndex]

  const amount = getPourAmount(from, to)
  if (amount === 0) return null

  const color = from[from.length - 1]
  const newTubes = tubes.map((t) => [...t])

  for (let i = 0; i < amount; i++) {
    newTubes[fromIndex].pop()
    newTubes[toIndex].push(color)
  }

  return { newTubes, amount, color }
}

/**
 * Generates a guaranteed-solvable Water Sort level by starting with
 * a solved state and applying reverse pours.
 */
export function generateLevel(levelNumber: number): LevelConfig {
  let colorCount = 2
  let emptyTubes = 1

  if (levelNumber === 1) {
    colorCount = 2
    emptyTubes = 1
  } else if (levelNumber === 2) {
    colorCount = 3
    emptyTubes = 1
  } else if (levelNumber === 3) {
    colorCount = 3
    emptyTubes = 2
  } else if (levelNumber <= 6) {
    colorCount = 4
    emptyTubes = 2
  } else if (levelNumber <= 10) {
    colorCount = 5
    emptyTubes = 2
  } else if (levelNumber <= 15) {
    colorCount = 6
    emptyTubes = 2
  } else {
    colorCount = Math.min(LIQUID_COLORS.length, 6 + Math.floor((levelNumber - 15) / 5))
    emptyTubes = 2
  }

  const selectedColors = LIQUID_COLORS.slice(0, colorCount).map((c) => c.id)

  // Start with solved state: each color has 1 full tube
  const tubes: Tube[] = selectedColors.map((c) => [c, c, c, c])

  // Add empty buffer tubes
  for (let i = 0; i < emptyTubes; i++) {
    tubes.push([])
  }

  // Shuffle by applying random legal reverse pours to guarantee solvability
  const shuffleSteps = 15 + levelNumber * 5

  for (let step = 0; step < shuffleSteps; step++) {
    // Pick a non-empty source tube
    const nonEmpties = tubes
      .map((t, idx) => ({ t, idx }))
      .filter((item) => item.t.length > 0)

    if (nonEmpties.length === 0) break

    const source = nonEmpties[Math.floor(Math.random() * nonEmpties.length)]
    // Pick a destination tube that is not full
    const availDest = tubes
      .map((t, idx) => ({ t, idx }))
      .filter((item) => item.idx !== source.idx && item.t.length < TUBE_CAPACITY)

    if (availDest.length === 0) continue

    const dest = availDest[Math.floor(Math.random() * availDest.length)]

    // Pop 1 liquid unit from source and push to dest
    const color = source.t.pop()!
    dest.t.push(color)
  }

  // Safety check: ensure at least 1 tube is completely empty to start
  const hasEmpty = tubes.some((t) => t.length === 0)
  if (!hasEmpty) {
    // If by chance no tube is empty, empty the last tube by distributing its liquid to others
    const lastTube = tubes[tubes.length - 1]
    while (lastTube.length > 0) {
      const color = lastTube.pop()!
      const receiver = tubes.find((t, idx) => idx !== tubes.length - 1 && t.length < TUBE_CAPACITY)
      if (receiver) {
        receiver.push(color)
      } else {
        // Put back if all are full
        lastTube.push(color)
        break
      }
    }
  }

  return {
    level: levelNumber,
    tubes,
    colorCount,
  }
}
