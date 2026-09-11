import { lazy, type ComponentType } from 'react'

export type GameCategory = 'Puzzle' | 'Reflex' | 'Memory' | 'Arcade' | 'Word'

export type GameMeta = {
  id: string
  title: string
  tagline: string
  category: GameCategory
  /** Emoji used as the card mark. */
  icon: string
  /** Two colors for the card's gradient. */
  colors: [string, string]
  /** How the best score should be read. */
  scoring: 'high' | 'low' | 'none'
  scoreLabel: string
  howTo: string[]
  Component: ComponentType
}

/** Each game is code-split so the first paint stays small. */
export const GAMES: GameMeta[] = [
  {
    id: 'memory',
    title: 'Memory Match',
    tagline: 'Pair the glyphs before your moves run out',
    category: 'Memory',
    icon: '🧠',
    colors: ['#8b5cf6', '#d946ef'],
    scoring: 'low',
    scoreLabel: 'Fewest moves',
    howTo: [
      'Tap a card to reveal the glyph beneath it.',
      'Find its twin — matched pairs stay face up.',
      'Clear the board in as few moves as you can.',
    ],
    Component: lazy(() => import('./memory/MemoryMatch')),
  },
  {
    id: 'twenty48',
    title: '2048',
    tagline: 'Slide, merge and chase the big tile',
    category: 'Puzzle',
    icon: '🔢',
    colors: ['#f59e0b', '#ef4444'],
    scoring: 'high',
    scoreLabel: 'Top score',
    howTo: [
      'Swipe (or use arrow keys) to slide every tile at once.',
      'Equal tiles merge into their double.',
      'The board fills as you go — plan your moves.',
    ],
    Component: lazy(() => import('./twenty48/Twenty48')),
  },
  {
    id: 'reaction',
    title: 'Reaction',
    tagline: 'How fast are your reflexes, really?',
    category: 'Reflex',
    icon: '⚡',
    colors: ['#22d3ee', '#3b82f6'],
    scoring: 'low',
    scoreLabel: 'Best average',
    howTo: [
      'Wait for the pad to turn green.',
      'Tap the instant it does — tapping early resets the round.',
      'Five rounds make up your average.',
    ],
    Component: lazy(() => import('./reaction/Reaction')),
  },
  {
    id: 'snake',
    title: 'Neon Snake',
    tagline: 'Grow long, never bite yourself',
    category: 'Arcade',
    icon: '🐍',
    colors: ['#a3e635', '#10b981'],
    scoring: 'high',
    scoreLabel: 'Longest run',
    howTo: [
      'Swipe or use the arrow keys to steer.',
      'Eat the orbs to grow and score.',
      'Walls and your own tail end the run.',
    ],
    Component: lazy(() => import('./snake/Snake')),
  },
  {
    id: 'whack',
    title: 'Tap Rush',
    tagline: 'Thirty seconds, endless targets',
    category: 'Reflex',
    icon: '🎯',
    colors: ['#fb7185', '#f43f5e'],
    scoring: 'high',
    scoreLabel: 'Most hits',
    howTo: [
      'Tap the glowing targets as they appear.',
      'Chains of quick hits multiply your score.',
      'Bombs cost you — leave them alone.',
    ],
    Component: lazy(() => import('./whack/TapRush')),
  },
  {
    id: 'simon',
    title: 'Echo',
    tagline: 'Repeat the pattern, one step longer each time',
    category: 'Memory',
    icon: '🎵',
    colors: ['#6366f1', '#8b5cf6'],
    scoring: 'high',
    scoreLabel: 'Longest sequence',
    howTo: [
      'Watch the pads light up in order.',
      'Tap them back in the same order.',
      'Each round adds one more step.',
    ],
    Component: lazy(() => import('./simon/Echo')),
  },
  {
    id: 'minesweeper',
    title: 'Minefield',
    tagline: 'Read the numbers, flag the danger',
    category: 'Puzzle',
    icon: '💎',
    colors: ['#14b8a6', '#0ea5e9'],
    scoring: 'low',
    scoreLabel: 'Fastest clear',
    howTo: [
      'Tap to reveal a tile; numbers count adjacent mines.',
      'Long-press (or right-click) to flag a suspect.',
      'Clear every safe tile to win.',
    ],
    Component: lazy(() => import('./minesweeper/Minefield')),
  },
  {
    id: 'wordle',
    title: 'Word Hunt',
    tagline: 'Six guesses to crack the five-letter word',
    category: 'Word',
    icon: '🔤',
    colors: ['#84cc16', '#22c55e'],
    scoring: 'low',
    scoreLabel: 'Fewest guesses',
    howTo: [
      'Guess any five-letter word to start.',
      'Green means right letter, right spot; amber means wrong spot.',
      'You get six tries.',
    ],
    Component: lazy(() => import('./wordle/WordHunt')),
  },
]

export const byId = (id: string) => GAMES.find((g) => g.id === id)

export const CATEGORIES: GameCategory[] = ['Puzzle', 'Reflex', 'Memory', 'Arcade', 'Word']
