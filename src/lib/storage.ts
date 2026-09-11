const KEY = 'arcadia:v1'

export type Settings = {
  theme: 'dark' | 'light'
  sound: boolean
  haptics: boolean
}

export type ScoreEntry = {
  /** Best score (higher is better) or best time in ms (lower is better). */
  best: number
  plays: number
  lastPlayed: number
}

type Store = {
  settings: Settings
  scores: Record<string, ScoreEntry>
  favorites: string[]
}

const defaults: Store = {
  settings: { theme: 'dark', sound: true, haptics: true },
  scores: {},
  favorites: [],
}

function read(): Store {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return structuredClone(defaults)
    const parsed = JSON.parse(raw) as Partial<Store>
    return {
      settings: { ...defaults.settings, ...parsed.settings },
      scores: parsed.scores ?? {},
      favorites: parsed.favorites ?? [],
    }
  } catch {
    return structuredClone(defaults)
  }
}

let cache = read()
const listeners = new Set<() => void>()

function commit() {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache))
  } catch {
    /* private mode / quota — keep the in-memory copy */
  }
  listeners.forEach((l) => l())
}

export const store = {
  subscribe(l: () => void) {
    listeners.add(l)
    // must return void — React treats a non-function return value as an error
    return () => {
      listeners.delete(l)
    }
  },
  get: () => cache,

  setSettings(patch: Partial<Settings>) {
    cache = { ...cache, settings: { ...cache.settings, ...patch } }
    commit()
  },

  toggleFavorite(id: string) {
    const has = cache.favorites.includes(id)
    cache = {
      ...cache,
      favorites: has ? cache.favorites.filter((f) => f !== id) : [...cache.favorites, id],
    }
    commit()
  },

  /** Records a finished run. `lowerIsBetter` for time-based games. */
  submitScore(id: string, value: number, lowerIsBetter = false) {
    const prev = cache.scores[id]
    const isBest =
      !prev || (lowerIsBetter ? value < prev.best : value > prev.best)
    cache = {
      ...cache,
      scores: {
        ...cache.scores,
        [id]: {
          best: isBest ? value : prev.best,
          plays: (prev?.plays ?? 0) + 1,
          lastPlayed: Date.now(),
        },
      },
    }
    commit()
    return isBest
  },

  reset() {
    cache = structuredClone(defaults)
    commit()
  },
}
