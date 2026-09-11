/**
 * Grouping puzzles: four categories of four, ordered easiest (0) to
 * trickiest (3). Bundled so the game works offline.
 */
export type Group = { theme: string; words: string[] }
export type Puzzle = Group[]

export const PUZZLES: Puzzle[] = [
  [
    { theme: 'Planets', words: ['MARS', 'VENUS', 'SATURN', 'NEPTUNE'] },
    { theme: 'Chess pieces', words: ['KING', 'BISHOP', 'ROOK', 'KNIGHT'] },
    { theme: 'Card suits', words: ['HEART', 'SPADE', 'CLUB', 'DIAMOND'] },
    { theme: 'Roman gods', words: ['JUPITER', 'MERCURY', 'PLUTO', 'JUNO'] },
  ],
  [
    { theme: 'Citrus fruits', words: ['LEMON', 'LIME', 'ORANGE', 'CITRON'] },
    { theme: 'Shades of blue', words: ['NAVY', 'AZURE', 'COBALT', 'TEAL'] },
    { theme: 'Musical keys', words: ['MAJOR', 'MINOR', 'SHARP', 'FLAT'] },
    { theme: 'Tyre conditions', words: ['SPARE', 'BALD', 'WORN', 'SLICK'] },
  ],
  [
    { theme: 'Big cats', words: ['LION', 'TIGER', 'JAGUAR', 'PUMA'] },
    { theme: 'Sportswear brands', words: ['NIKE', 'FILA', 'UMBRO', 'REEBOK'] },
    { theme: 'Greek letters', words: ['DELTA', 'SIGMA', 'OMEGA', 'THETA'] },
    { theme: 'Car makers', words: ['FORD', 'HONDA', 'VOLVO', 'MAZDA'] },
  ],
  [
    { theme: 'Kinds of bread', words: ['RYE', 'NAAN', 'PITA', 'SODA'] },
    { theme: 'Water bodies', words: ['GULF', 'SOUND', 'STRAIT', 'BAY'] },
    { theme: 'Golf terms', words: ['BIRDIE', 'EAGLE', 'BOGEY', 'ALBATROSS'] },
    { theme: 'Birds', words: ['ROBIN', 'SWIFT', 'CRANE', 'SWALLOW'] },
  ],
  [
    { theme: 'Units of time', words: ['MINUTE', 'HOUR', 'DECADE', 'SECOND'] },
    { theme: 'Tiny amounts', words: ['TRACE', 'DASH', 'HINT', 'SHRED'] },
    { theme: 'Newspaper parts', words: ['COLUMN', 'HEADLINE', 'EDITORIAL', 'OBITUARY'] },
    { theme: 'Spine-related', words: ['DISC', 'VERTEBRA', 'LUMBAR', 'SACRUM'] },
  ],
  [
    { theme: 'Board games', words: ['CLUEDO', 'RISK', 'SORRY', 'TROUBLE'] },
    { theme: 'Weather events', words: ['SLEET', 'HAIL', 'FROST', 'GALE'] },
    { theme: 'Pasta shapes', words: ['PENNE', 'FUSILLI', 'RIGATONI', 'ORZO'] },
    { theme: 'Ways to greet', words: ['WAVE', 'BOW', 'NOD', 'SALUTE'] },
  ],
  [
    { theme: 'Keyboard keys', words: ['SHIFT', 'ENTER', 'TAB', 'ESCAPE'] },
    { theme: 'Poker hands', words: ['FLUSH', 'STRAIGHT', 'PAIR', 'HOUSE'] },
    { theme: 'Coffee drinks', words: ['LATTE', 'MOCHA', 'FLAT', 'CORTADO'] },
    { theme: 'River features', words: ['DELTA', 'MOUTH', 'BANK', 'BED'] },
  ],
  [
    { theme: 'Dances', words: ['TANGO', 'SALSA', 'WALTZ', 'RUMBA'] },
    { theme: 'Sauces', words: ['PESTO', 'AIOLI', 'GRAVY', 'ROUX'] },
    { theme: 'NATO alphabet', words: ['CHARLIE', 'FOXTROT', 'JULIET', 'ROMEO'] },
    { theme: 'Card games', words: ['BRIDGE', 'RUMMY', 'HEARTS', 'SNAP'] },
  ],
]

export const randomPuzzle = (exclude?: number) => {
  if (PUZZLES.length < 2) return 0
  let i = Math.floor(Math.random() * PUZZLES.length)
  let guard = 0
  while (i === exclude && guard++ < 12) i = Math.floor(Math.random() * PUZZLES.length)
  return i
}

/** Colour per difficulty tier, easiest first. */
export const TIER_COLORS = ['#facc15', '#4ade80', '#38bdf8', '#c084fc']
