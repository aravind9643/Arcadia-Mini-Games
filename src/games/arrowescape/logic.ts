export type ArrowDirection = 'up' | 'down' | 'left' | 'right'
export type ArrowState = 'idle' | 'sliding' | 'blocked'

export interface ArrowModel {
  id: string
  row: number
  col: number
  direction: ArrowDirection
  path: [number, number][]
  state: ArrowState
}

export interface LevelData {
  level: number
  gridSize: number
  arrows: ArrowModel[]
}

export interface ExitInfo {
  blocked: boolean
  blockRow?: number
  blockCol?: number
  trajectory: [number, number][]
}

export interface ArrowTrack {
  track: [number, number][]
  dist: number[]
  headDist: number
  tailDist: number
}

export const DIR_DELTA: Record<ArrowDirection, [number, number]> = {
  up: [-1, 0],
  down: [1, 0],
  left: [0, -1],
  right: [0, 1],
}

export const DIR_OPPOSITE: Record<ArrowDirection, ArrowDirection> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const ALL_DIRS: ArrowDirection[] = ['up', 'down', 'left', 'right']

/** Mulberry32 deterministic PRNG */
export function createRng(seed: number) {
  let s = seed | 0
  return function () {
    s = (s + 0x6d2b79f5) | 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Grid size scaling matching reference constants:
 * Level 1: 10x10, Level 6: 12x12, exactly as in reference screenshots.
 */
export function getGridSizeForLevel(level: number): number {
  if (level <= 10) {
    return 10 + Math.round((level - 1) * 0.44)
  } else if (level <= 50) {
    return 14 + Math.round((level - 10) * 0.15)
  }
  return 18
}

/** Computes forward exit trajectory of an arrow and whether another arrow blocks it */
export function computeExit(
  arrow: ArrowModel,
  arrows: ArrowModel[],
  gridSize: number,
): ExitInfo {
  const [dr, dc] = DIR_DELTA[arrow.direction]
  const trajectory: [number, number][] = [[arrow.row, arrow.col]]
  let r = arrow.row + dr
  let c = arrow.col + dc

  const occupied = new Map<string, ArrowModel>()
  for (const other of arrows) {
    if (other.id === arrow.id || other.state === 'sliding') continue
    for (const [or, oc] of other.path) {
      occupied.set(`${or},${oc}`, other)
    }
  }

  while (r >= 0 && r < gridSize && c >= 0 && c < gridSize) {
    trajectory.push([r, c])
    if (occupied.has(`${r},${c}`)) {
      return {
        blocked: true,
        blockRow: r,
        blockCol: c,
        trajectory,
      }
    }
    r += dr
    c += dc
  }

  // Overshoot exit points for exit animation
  for (let i = 0; i < 3; i++) {
    trajectory.push([r, c])
    r += dr
    c += dc
  }

  return {
    blocked: false,
    trajectory,
  }
}

/** Finds all unblocked arrows currently ready to escape */
export function findEscapableArrows(
  arrows: ArrowModel[],
  gridSize: number,
): ArrowModel[] {
  return arrows.filter(
    (a) => a.state === 'idle' && !computeExit(a, arrows, gridSize).blocked,
  )
}

function pack(r: number, c: number): number {
  return r * 1000 + c
}

function canExitClean(
  r: number,
  c: number,
  dir: ArrowDirection,
  occupied: Set<number>,
  gridSize: number,
): boolean {
  const [dr, dc] = DIR_DELTA[dir]
  let cr = r + dr
  let cc = c + dc
  while (cr >= 0 && cr < gridSize && cc >= 0 && cc < gridSize) {
    if (occupied.has(pack(cr, cc))) return false
    cr += dr
    cc += dc
  }
  return true
}

interface ExitCand {
  r: number
  c: number
  dir: ArrowDirection
}

function findExitCandidates(
  occupied: Set<number>,
  gridSize: number,
): ExitCand[] {
  const cands: ExitCand[] = []
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      if (occupied.has(pack(r, c))) continue
      for (const dir of ALL_DIRS) {
        if (canExitClean(r, c, dir, occupied, gridSize)) {
          cands.push({ r, c, dir })
        }
      }
    }
  }
  return cands
}

function getExitPathPacked(
  r: number,
  c: number,
  dir: ArrowDirection,
  gridSize: number,
): Set<number> {
  const [dr, dc] = DIR_DELTA[dir]
  const set = new Set<number>()
  let cr = r + dr
  let cc = c + dc
  while (cr >= 0 && cr < gridSize && cc >= 0 && cc < gridSize) {
    set.add(pack(cr, cc))
    cr += dr
    cc += dc
  }
  return set
}

/**
 * Grows an entangled snake path backwards from the exit head.
 */
function growArrowPath(
  headR: number,
  headC: number,
  exitDir: ArrowDirection,
  targetLen: number,
  occupied: Set<number>,
  gridSize: number,
  rng: () => number,
): [number, number][] | null {
  const exitPath = getExitPathPacked(headR, headC, exitDir, gridSize)
  const path: [number, number][] = [[headR, headC]]
  const pathSet = new Set<number>([pack(headR, headC)])

  let cr = headR
  let cc = headC
  let growDir = DIR_OPPOSITE[exitDir]
  let straightCount = 0
  const maxStraight = 2

  for (let step = 1; step < targetLen; step++) {
    const validDirs: ArrowDirection[] = []

    for (const d of ALL_DIRS) {
      if (d === DIR_OPPOSITE[growDir]) continue
      const [dr, dc] = DIR_DELTA[d]
      const nr = cr + dr
      const nc = cc + dc
      const p = pack(nr, nc)

      if (nr < 0 || nr >= gridSize || nc < 0 || nc >= gridSize) continue
      if (occupied.has(p)) continue
      if (exitPath.has(p)) continue
      if (pathSet.has(p)) continue

      let selfTouch = false
      for (const od of ALL_DIRS) {
        const [ar, ac] = DIR_DELTA[od]
        const adjP = pack(nr + ar, nc + ac)
        if (adjP !== pack(cr, cc) && pathSet.has(adjP)) {
          selfTouch = true
          break
        }
      }
      if (selfTouch) continue

      validDirs.push(d)
    }

    if (validDirs.length === 0) break

    if (step === 1 && !validDirs.includes(growDir)) {
      return null
    }

    let chosen: ArrowDirection
    if (step === 1) {
      chosen = growDir
    } else {
      const turns = validDirs.filter((d) => d !== growDir)
      const straights = validDirs.filter((d) => d === growDir)

      if (straightCount >= maxStraight && turns.length > 0) {
        chosen = turns[Math.floor(rng() * turns.length)]
      } else if (turns.length > 0 && rng() < 0.65) {
        chosen = turns[Math.floor(rng() * turns.length)]
      } else if (straights.length > 0) {
        chosen = straights[0]
      } else {
        chosen = validDirs[Math.floor(rng() * validDirs.length)]
      }
    }

    if (chosen === growDir) {
      straightCount++
    } else {
      straightCount = 0
      growDir = chosen
    }

    const [dr, dc] = DIR_DELTA[chosen]
    cr += dr
    cc += dc
    path.push([cr, cc])
    pathSet.add(pack(cr, cc))
  }

  return path
}

/**
 * Reverse Level Generator matching reference architecture.
 */
export function generateLevel(level: number): LevelData {
  const gridSize = getGridSizeForLevel(level)
  const rng = createRng(level * 10007 + 911)

  const totalCells = gridSize * gridSize
  const targetFilled = Math.floor(totalCells * 0.52)

  const occupied = new Set<number>()
  const reverseArrows: ArrowModel[] = []

  let failures = 0
  const maxFailures = 45

  while (occupied.size < targetFilled && failures < maxFailures) {
    const candidates = findExitCandidates(occupied, gridSize)
    if (candidates.length === 0) break

    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const temp = candidates[i]
      candidates[i] = candidates[j]
      candidates[j] = temp
    }

    let targetLen = 3
    const roll = rng()
    if (roll < 0.28) targetLen = 2 + Math.floor(rng() * 2)
    else if (roll < 0.72) targetLen = 3 + Math.floor(rng() * 3)
    else targetLen = 5 + Math.floor(rng() * 3)

    let placed = false
    for (const cand of candidates.slice(0, 30)) {
      const path = growArrowPath(
        cand.r,
        cand.c,
        cand.dir,
        targetLen,
        occupied,
        gridSize,
        rng,
      )

      if (path && path.length >= 2) {
        const id = `a_${level}_${reverseArrows.length}`
        reverseArrows.push({
          id,
          row: path[0][0],
          col: path[0][1],
          direction: cand.dir,
          path,
          state: 'idle',
        })

        for (const pt of path) {
          occupied.add(pack(pt[0], pt[1]))
        }
        placed = true
        failures = 0
        break
      }
    }

    if (!placed) {
      failures++
    }
  }

  const arrows: ArrowModel[] = []
  for (let i = reverseArrows.length - 1; i >= 0; i--) {
    const a = reverseArrows[i]
    arrows.push({
      ...a,
      id: `a_${level}_${arrows.length}`,
    })
  }

  if (arrows.length === 0) {
    return generateFallbackLevel(level, gridSize)
  }

  return {
    level,
    gridSize,
    arrows,
  }
}

function generateFallbackLevel(level: number, gridSize: number): LevelData {
  const arrows: ArrowModel[] = [
    {
      id: `a_${level}_0`,
      row: 0,
      col: 0,
      direction: 'right',
      path: [
        [0, 0],
        [0, 1],
        [1, 1],
      ],
      state: 'idle',
    },
    {
      id: `a_${level}_1`,
      row: 1,
      col: 0,
      direction: 'left',
      path: [
        [1, 0],
        [2, 0],
      ],
      state: 'idle',
    },
  ]
  return { level, gridSize, arrows }
}

/* ==========================================================================
   Arrow Track & Continuous Slither Slicing (matching ArrowComponent in Dart)
   ========================================================================== */

/**
 * Builds the continuous track path for an arrow:
 * Consists of the exit extension path outside the board (in forward direction),
 * followed by the arrow's own path segments from head to tail.
 */
export function buildArrowTrack(
  arrow: ArrowModel,
  gridSize: number,
): ArrowTrack {
  const [dr, dc] = DIR_DELTA[arrow.direction]
  const headX = arrow.col + 0.5
  const headY = arrow.row + 0.5

  const extCount = gridSize + 4
  const track: [number, number][] = []

  // Exit extension points outside the board in forward direction (collected backward)
  for (let i = extCount; i >= 1; i--) {
    track.push([headX + dc * i, headY + dr * i])
  }

  // Arrow's own segments: head to tail
  for (const pt of arrow.path) {
    track.push([pt[1] + 0.5, pt[0] + 0.5])
  }

  const dist: number[] = [0]
  for (let i = 1; i < track.length; i++) {
    const d = Math.hypot(track[i][0] - track[i - 1][0], track[i][1] - track[i - 1][1])
    dist.push(dist[i - 1] + d)
  }

  const headDist = dist[extCount]
  const tailDist = dist[extCount + arrow.path.length - 1]

  return {
    track,
    dist,
    headDist,
    tailDist,
  }
}

function sampleTrackAtDist(
  track: [number, number][],
  dist: number[],
  s: number,
): [number, number] {
  if (s <= dist[0]) return track[0]
  if (s >= dist[dist.length - 1]) return track[track.length - 1]
  for (let i = 0; i < dist.length - 1; i++) {
    if (s >= dist[i] && s <= dist[i + 1]) {
      const segLen = dist[i + 1] - dist[i]
      const t = segLen > 0.0001 ? (s - dist[i]) / segLen : 0
      return [
        track[i][0] + (track[i + 1][0] - track[i][0]) * t,
        track[i][1] + (track[i + 1][1] - track[i][1]) * t,
      ]
    }
  }
  return track[track.length - 1]
}

/**
 * Slices the track between animHead and animTail.
 */
export function sliceTrack(
  track: [number, number][],
  dist: number[],
  from: number,
  to: number,
): [number, number][] {
  if (from >= to - 0.01) return []
  const pts: [number, number][] = [sampleTrackAtDist(track, dist, from)]
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] > from && dist[i] < to) {
      pts.push(track[i])
    }
  }
  pts.push(sampleTrackAtDist(track, dist, to))
  return pts
}

/**
 * Computes SVG stem and caret path strings from sliced points.
 */
export function getArrowSvgPaths(
  pts: [number, number][],
  direction: ArrowDirection,
): { stemD: string; caretD: string } | null {
  if (pts.length === 0) return null

  const [dr, dc] = DIR_DELTA[direction]
  const defaultDx = dc
  const defaultDy = dr

  const head = pts[0]
  const prev = pts.length > 1 ? pts[1] : [head[0] - defaultDx, head[1] - defaultDy]
  const vx = head[0] - prev[0]
  const vy = head[1] - prev[1]
  const vlen = Math.hypot(vx, vy)
  const dx = vlen > 0.001 ? vx / vlen : defaultDx
  const dy = vlen > 0.001 ? vy / vlen : defaultDy

  // Tip of chevron caret extends forward from head by 0.3
  const tipX = head[0] + dx * 0.3
  const tipY = head[1] + dy * 0.3

  const hd = 0.24
  const hw = 0.17
  const baseX = tipX - dx * hd
  const baseY = tipY - dy * hd
  const px = -dy
  const py = dx

  const wing1X = baseX + px * hw
  const wing1Y = baseY + py * hw
  const wing2X = baseX - px * hw
  const wing2Y = baseY - py * hw

  // Stem connects from tail all the way up to tip
  const stemPts = [...pts].reverse()
  stemPts.push([tipX, tipY])
  const stemD = stemPts
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p[0].toFixed(3)} ${p[1].toFixed(3)}`)
    .join(' ')

  const caretD = `M ${wing1X.toFixed(3)} ${wing1Y.toFixed(3)} L ${tipX.toFixed(3)} ${tipY.toFixed(3)} L ${wing2X.toFixed(3)} ${wing2Y.toFixed(3)}`

  return { stemD, caretD }
}
