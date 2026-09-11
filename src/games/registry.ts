import { lazy, type ComponentType } from 'react'
import type { IconName } from '../components/Icon'

export type GameCategory =
  | 'Puzzle'
  | 'Reflex'
  | 'Memory'
  | 'Arcade'
  | 'Word'
  | 'Strategy'

export type GameMeta = {
  id: string
  title: string
  tagline: string
  category: GameCategory
  /** Icon from the inline SVG set. */
  icon: IconName
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
    icon: 'brain',
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
    icon: 'grid',
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
    icon: 'bolt',
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
    icon: 'snake',
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
    icon: 'crosshair',
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
    icon: 'waveform',
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
    icon: 'gem',
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
    icon: 'letters',
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
  {
    id: 'tetris',
    title: 'Block Drop',
    tagline: 'Stack the falling pieces, clear the lines',
    category: 'Arcade',
    icon: 'blocks',
    colors: ['#06b6d4', '#6366f1'],
    scoring: 'high',
    scoreLabel: 'Top score',
    howTo: [
      'Swipe left and right to move the falling piece, or use the arrow keys.',
      'Tap the piece (or press up) to rotate it; swipe down to drop it fast.',
      'Fill a whole row to clear it — four at once scores the most.',
    ],
    Component: lazy(() => import('./tetris/BlockDrop')),
  },
  {
    id: 'flappy',
    title: 'Sky Hop',
    tagline: 'One tap keeps you airborne',
    category: 'Reflex',
    icon: 'wing',
    colors: ['#facc15', '#fb923c'],
    scoring: 'high',
    scoreLabel: 'Most pipes',
    howTo: [
      'Tap anywhere (or press space) to flap upward.',
      'Gravity pulls you down the moment you stop.',
      'Thread the gaps — touching a pipe or the ground ends the run.',
    ],
    Component: lazy(() => import('./flappy/SkyHop')),
  },
  {
    id: 'sudoku',
    title: 'Sudoku',
    tagline: 'Nine by nine, one of each',
    category: 'Puzzle',
    icon: 'sudoku',
    colors: ['#0ea5e9', '#8b5cf6'],
    scoring: 'low',
    scoreLabel: 'Fastest solve',
    howTo: [
      'Tap a cell, then tap a number to fill it in.',
      'Every row, column and 3×3 box needs the digits 1–9 exactly once.',
      'Use Notes to pencil in candidates while you work.',
    ],
    Component: lazy(() => import('./sudoku/Sudoku')),
  },
  {
    id: 'connect4',
    title: 'Connect Four',
    tagline: 'Four in a row beats the machine',
    category: 'Strategy',
    icon: 'discs',
    colors: ['#f43f5e', '#facc15'],
    scoring: 'high',
    scoreLabel: 'Wins',
    howTo: [
      'Tap a column to drop your disc into it.',
      'Line up four in a row — across, down or diagonally.',
      'The computer plays yellow, and it looks ahead.',
    ],
    Component: lazy(() => import('./connect4/ConnectFour')),
  },
  {
    id: 'breakout',
    title: 'Brick Breaker',
    tagline: 'Bounce, smash, clear the wall',
    category: 'Arcade',
    icon: 'bricks',
    colors: ['#a3e635', '#14b8a6'],
    scoring: 'high',
    scoreLabel: 'Top score',
    howTo: [
      'Drag to slide the paddle, or steer with the arrow keys.',
      'Keep the ball alive and break every brick to clear the level.',
      'The ball speeds up as you go, and the angle depends where it lands.',
    ],
    Component: lazy(() => import('./breakout/BrickBreaker')),
  },
  {
    id: 'tictactoe',
    title: 'Tic-Tac-Toe',
    tagline: 'Simple rules, unbeatable opponent',
    category: 'Strategy',
    icon: 'noughts',
    colors: ['#ec4899', '#8b5cf6'],
    scoring: 'high',
    scoreLabel: 'Wins',
    howTo: [
      'Tap a square to place your X.',
      'Three in a row wins — across, down or diagonally.',
      'On Hard the computer plays perfectly, so a draw is a good result.',
    ],
    Component: lazy(() => import('./tictactoe/TicTacToe')),
  },
]

export const byId = (id: string) => GAMES.find((g) => g.id === id)

export const CATEGORIES: GameCategory[] = [
  'Puzzle',
  'Arcade',
  'Reflex',
  'Strategy',
  'Memory',
  'Word',
]
