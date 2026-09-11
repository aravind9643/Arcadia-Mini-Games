/**
 * A deliberately small circle-physics solver: gravity, wall/floor
 * constraints and positional impulse resolution between overlapping pairs.
 * Enough for a merge-drop game without pulling in a physics library.
 */

export const W = 100
export const H = 112
/** Fruit sits below this line; crossing it for too long ends the run. */
export const DANGER_Y = 16

const GRAV = 0.00022
const DAMP = 0.995
const RESTITUTION = 0.14
/** Extra separation applied per solver pass, tuned for stability at 6 passes. */
const PASSES = 6

export type Fruit = {
  id: number
  tier: number
  x: number
  y: number
  vx: number
  vy: number
  /** Set while a freshly merged fruit plays its pop animation. */
  born: number
}

/** Radius and colour climb together, so bigger tiers read instantly. */
export const TIERS = [
  { r: 3.4, color: '#f87171', name: 'cherry' },
  { r: 4.6, color: '#fb923c', name: 'strawberry' },
  { r: 5.9, color: '#c084fc', name: 'grape' },
  { r: 7.3, color: '#facc15', name: 'lemon' },
  { r: 8.8, color: '#fb7185', name: 'peach' },
  { r: 10.6, color: '#f97316', name: 'orange' },
  { r: 12.6, color: '#ef4444', name: 'apple' },
  { r: 14.8, color: '#a3e635', name: 'pear' },
  { r: 17.2, color: '#22c55e', name: 'melon' },
  { r: 20, color: '#16a34a', name: 'watermelon' },
]

export const radiusOf = (tier: number) => TIERS[Math.min(tier, TIERS.length - 1)].r
export const colorOf = (tier: number) => TIERS[Math.min(tier, TIERS.length - 1)].color

/** Only the smaller tiers are ever handed to the player to drop. */
export const randomDropTier = () => Math.floor(Math.random() * 5)

/** Points scale with tier, so late merges dominate the score. */
export const mergeScore = (tier: number) => (tier + 1) * (tier + 2) * 3

let nextId = 1
export const newId = () => nextId++

export type StepResult = {
  fruits: Fruit[]
  merges: { tier: number; x: number; y: number }[]
}

/**
 * Advances the simulation by `dt` ms. Merges are detected first (so a pair
 * never resolves as a collision and a merge in the same frame), then
 * overlaps are relaxed over several positional passes.
 */
export function step(input: Fruit[], dt: number, now: number): StepResult {
  const fruits = input.map((f) => ({ ...f }))
  const merges: StepResult['merges'] = []

  // integrate
  for (const f of fruits) {
    f.vy += GRAV * dt
    f.x += f.vx * dt
    f.y += f.vy * dt
    f.vx *= DAMP
    f.vy *= DAMP
  }

  // merge equal tiers that overlap
  const dead = new Set<number>()
  for (let i = 0; i < fruits.length; i++) {
    if (dead.has(fruits[i].id)) continue
    for (let j = i + 1; j < fruits.length; j++) {
      if (dead.has(fruits[j].id)) continue
      const a = fruits[i]
      const b = fruits[j]
      if (a.tier !== b.tier) continue
      if (a.tier >= TIERS.length - 1) continue

      const dx = b.x - a.x
      const dy = b.y - a.y
      const dist = Math.hypot(dx, dy)
      if (dist > radiusOf(a.tier) + radiusOf(b.tier)) continue

      dead.add(a.id)
      dead.add(b.id)
      const tier = a.tier + 1
      merges.push({ tier, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
      fruits.push({
        id: newId(),
        tier,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        vx: (a.vx + b.vx) / 2,
        vy: (a.vy + b.vy) / 2 - 0.008,
        born: now,
      })
      break
    }
  }

  const alive = fruits.filter((f) => !dead.has(f.id))

  // resolve overlaps and walls
  for (let pass = 0; pass < PASSES; pass++) {
    for (let i = 0; i < alive.length; i++) {
      for (let j = i + 1; j < alive.length; j++) {
        const a = alive[i]
        const b = alive[j]
        const ra = radiusOf(a.tier)
        const rb = radiusOf(b.tier)
        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.hypot(dx, dy)
        const min = ra + rb
        if (dist >= min) continue

        // identical positions would divide by zero — nudge them apart
        if (dist < 0.0001) {
          dx = (Math.random() - 0.5) * 0.1
          dy = -0.1
          dist = Math.hypot(dx, dy)
        }

        const nx = dx / dist
        const ny = dy / dist
        const overlap = min - dist
        // heavier (larger) fruit moves less
        const wa = rb / (ra + rb)
        const wb = ra / (ra + rb)
        a.x -= nx * overlap * wa
        a.y -= ny * overlap * wa
        b.x += nx * overlap * wb
        b.y += ny * overlap * wb

        const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
        if (rel < 0) {
          const imp = -(1 + RESTITUTION) * rel
          a.vx -= nx * imp * wa
          a.vy -= ny * imp * wa
          b.vx += nx * imp * wb
          b.vy += ny * imp * wb
        }
      }
    }

    for (const f of alive) {
      const r = radiusOf(f.tier)
      if (f.x - r < 0) {
        f.x = r
        f.vx = Math.abs(f.vx) * RESTITUTION
      } else if (f.x + r > W) {
        f.x = W - r
        f.vx = -Math.abs(f.vx) * RESTITUTION
      }
      if (f.y + r > H) {
        f.y = H - r
        f.vy = -Math.abs(f.vy) * RESTITUTION
      }
    }
  }

  return { fruits: alive, merges }
}

/** True when a settled fruit is poking above the danger line. */
export function overflowing(fruits: Fruit[], now: number): boolean {
  return fruits.some(
    (f) =>
      f.y - radiusOf(f.tier) < DANGER_Y &&
      Math.abs(f.vy) < 0.006 &&
      now - f.born > 900,
  )
}
