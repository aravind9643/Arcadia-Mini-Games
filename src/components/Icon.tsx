import type { ReactElement, SVGProps } from 'react'

/**
 * Stroke-based icon set drawn on a 24x24 grid.
 *
 * These are inline SVG rather than emoji so they render identically on every
 * platform, inherit `currentColor`, and stay crisp at any size.
 */
export type IconName =
  // navigation / chrome
  | 'play'
  | 'trophy'
  | 'settings'
  | 'search'
  | 'back'
  | 'restart'
  | 'help'
  | 'close'
  | 'chevron-right'
  | 'star'
  | 'star-filled'
  | 'install'
  | 'moon'
  | 'sun'
  | 'volume'
  | 'vibrate'
  | 'database'
  | 'dice'
  | 'medal'
  | 'sparkles'
  | 'pause'
  | 'resume'
  | 'flag'
  | 'bomb'
  | 'target'
  | 'gamepad'
  // per-game marks
  | 'brain'
  | 'grid'
  | 'bolt'
  | 'snake'
  | 'crosshair'
  | 'waveform'
  | 'gem'
  | 'letters'
  | 'blocks'
  | 'wing'
  | 'sudoku'
  | 'discs'
  | 'bricks'
  | 'noughts'
  | 'undo'
  | 'rotate-cw'
  | 'gallows'
  | 'shuffle'
  | 'jump'
  | 'paddle'
  | 'bulb'
  | 'bubbles'
  | 'groups'
  | 'fruit'
  | 'triple'
  | 'traffic'
  | 'globe'
  | 'swatch'
  | 'arrow-escape'
  | 'atom'
  | 'clock'
  | 'blast'
  | 'flask'

type Props = SVGProps<SVGSVGElement> & {
  name: IconName
  size?: number | string
  /** Stroke width on the 24px grid. */
  weight?: number
}

export function Icon({ name, size = 24, weight = 1.9, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={weight}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name]}
    </svg>
  )
}

const PATHS: Record<IconName, ReactElement> = {
  /* ---------- navigation / chrome ---------- */
  play: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="5" />
      <path d="M7 12h2.6M8.3 10.7v2.6" />
      <circle cx="15.4" cy="11.2" r=".9" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="13.4" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4.6a1 1 0 0 0-1 1.2A4 4 0 0 0 7 10.3M17 6h2.4a1 1 0 0 1 1 1.2A4 4 0 0 1 17 10.3" />
      <path d="M12 14v3.5M8.5 20.5h7M9.8 17.5h4.4l.8 3H9l.8-3Z" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.1" />
      <path d="M12 2.6l1.5 2.6a7.4 7.4 0 0 1 1.9.8l2.9-.6 1.6 2.8-2 2.2a7.6 7.6 0 0 1 0 2l2 2.2-1.6 2.8-2.9-.6a7.4 7.4 0 0 1-1.9.8L12 21.4l-1.5-2.6a7.4 7.4 0 0 1-1.9-.8l-2.9.6-1.6-2.8 2-2.2a7.6 7.6 0 0 1 0-2l-2-2.2 1.6-2.8 2.9.6a7.4 7.4 0 0 1 1.9-.8L12 2.6Z" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.2" />
      <path d="M15.4 15.4 20 20" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  'chevron-right': <path d="M9 5l7 7-7 7" />,
  restart: (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.6h-4.6" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.4 9.3a2.7 2.7 0 0 1 5.2.9c0 1.8-2.6 2.3-2.6 4" />
      <circle cx="12" cy="17.4" r=".9" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  star: <path d="m12 3.4 2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83L6.6 20.05l1.03-6L3.3 9.8l6-.9L12 3.4Z" />,
  'star-filled': (
    <path
      d="m12 3.4 2.7 5.5 6 .9-4.35 4.25 1.03 6-5.38-2.83L6.6 20.05l1.03-6L3.3 9.8l6-.9L12 3.4Z"
      fill="currentColor"
    />
  ),
  install: (
    <>
      <rect x="6" y="2.6" width="12" height="18.8" rx="2.6" />
      <path d="M12 8v6.4M9.4 11.9 12 14.5l2.6-2.6" />
    </>
  ),
  moon: <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.6v2.2M12 19.2v2.2M4.4 4.4l1.6 1.6M18 18l1.6 1.6M2.6 12h2.2M19.2 12h2.2M4.4 19.6 6 18M18 6l1.6-1.6" />
    </>
  ),
  volume: (
    <>
      <path d="M11 4.8 6.6 8.5H3.4v7h3.2L11 19.2V4.8Z" />
      <path d="M15.2 9.2a4 4 0 0 1 0 5.6M18 6.4a8 8 0 0 1 0 11.2" />
    </>
  ),
  vibrate: (
    <>
      <rect x="8" y="4" width="8" height="16" rx="2" />
      <path d="M4.6 9.4v5.2M2 10.8v2.4M19.4 9.4v5.2M22 10.8v2.4" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7.4" ry="3.2" />
      <path d="M4.6 6v12c0 1.8 3.3 3.2 7.4 3.2s7.4-1.4 7.4-3.2V6" />
      <path d="M19.4 12c0 1.8-3.3 3.2-7.4 3.2S4.6 13.8 4.6 12" />
    </>
  ),
  dice: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4" />
      <circle cx="8.6" cy="8.6" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="14.6" r="6" />
      <path d="M8.4 9.2 6 2.8h4.4L12 6.6l1.6-3.8H18l-2.4 6.4" />
      <path d="m12 11.6.95 1.95 2.15.3-1.55 1.5.37 2.15L12 16.5l-1.92 1a0 0 0 0 1 0 0l.37-2.15-1.55-1.5 2.15-.3L12 11.6Z" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 3.2 13.6 8 18.4 9.6 13.6 11.2 12 16l-1.6-4.8L5.6 9.6 10.4 8 12 3.2Z" />
      <path d="M18.4 15.2l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2Z" />
    </>
  ),
  pause: <path d="M9.2 5v14M14.8 5v14" />,
  resume: <path d="M7.4 4.6 19 12 7.4 19.4V4.6Z" fill="currentColor" />,
  flag: (
    <>
      <path d="M5.6 21V3.6" />
      <path d="M5.6 4.4h11.2l-2 3.6 2 3.6H5.6" />
    </>
  ),
  bomb: (
    <>
      <circle cx="10.4" cy="14.4" r="6.2" />
      <path d="m15.2 9.6 2.2-2.2M17.4 4.2v2M20.4 7.4h-2M19.6 5.2l1.4-1.4" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <circle cx="12" cy="12" r="4.6" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  gamepad: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="5" />
      <path d="M7 12h2.6M8.3 10.7v2.6" />
      <circle cx="15.4" cy="11.2" r=".9" fill="currentColor" stroke="none" />
      <circle cx="17.8" cy="13.4" r=".9" fill="currentColor" stroke="none" />
    </>
  ),

  /* ---------- per-game marks ---------- */
  /* A matched pair of cards, one filled — reads clearly at 22px. */
  brain: (
    <>
      <rect x="2.8" y="4.6" width="8.4" height="12" rx="2.1" fill="currentColor" />
      <rect x="12.8" y="7.4" width="8.4" height="12" rx="2.1" />
    </>
  ),
  grid: (
    <>
      <rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.4" />
      <path d="M3.4 12h17.2M12 3.4v17.2" />
    </>
  ),
  bolt: <path d="M13.4 2.4 4.8 13.2h5.6l-.8 8.4 8.6-10.8h-5.6l.8-8.4Z" />,
  /* Segmented body on a grid + a pellet — reads as "snake game", not a letter. */
  snake: (
    <>
      <path d="M4.6 6.2h5.6v5.6H4.6z" />
      <path d="M10.2 11.8h5.6v5.6h-5.6z" />
      <path d="M4.6 11.8h5.6" />
      <circle cx="18.6" cy="6.4" r="1.8" fill="currentColor" stroke="none" />
    </>
  ),
  crosshair: (
    <>
      <circle cx="12" cy="12" r="7.6" />
      <path d="M12 1.8v4M12 18.2v4M1.8 12h4M18.2 12h4" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  waveform: <path d="M3 12h2.6M8.2 6.6v10.8M12 3.2v17.6M15.8 8.4v7.2M19.4 11v2" />,
  gem: (
    <>
      <path d="M6 3.4h12l3.4 5.4L12 20.6 2.6 8.8 6 3.4Z" />
      <path d="M2.6 8.8h18.8M8.8 3.4 12 20.6l3.2-17.2" />
    </>
  ),
  /* Word-game tiles: a filled "found" tile beside two empty ones. */
  letters: (
    <>
      <rect x="2.6" y="5.4" width="6.2" height="13.2" rx="1.9" fill="currentColor" />
      <rect x="10.4" y="5.4" width="6.2" height="13.2" rx="1.9" />
      <rect x="18.2" y="5.4" width="3.2" height="13.2" rx="1.6" />
    </>
  ),

  /* An S-tetromino stack. */
  blocks: (
    <>
      <rect x="3" y="12.6" width="8.4" height="8.4" rx="1.5" fill="currentColor" />
      <rect x="11.4" y="12.6" width="8.4" height="8.4" rx="1.5" />
      <rect x="7.2" y="4.2" width="8.4" height="8.4" rx="1.5" />
    </>
  ),
  /* A bird-ish wing between two pipe gaps. */
  wing: (
    <>
      <path d="M3.4 12a5.4 5.4 0 0 1 9.6-3.4l4.2 1.2-2 2.2 2 2.2-4.2 1.2A5.4 5.4 0 0 1 3.4 12Z" />
      <circle cx="8" cy="10.4" r=".95" fill="currentColor" stroke="none" />
      <path d="M20.6 4v4.2M20.6 15.8V20" />
    </>
  ),
  /* 3x3 of boxes with one filled — the sudoku subgrid. */
  sudoku: (
    <>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2.6" />
      <path d="M9.07 3.2v17.6M14.93 3.2v17.6M3.2 9.07h17.6M3.2 14.93h17.6" />
      <rect x="9.07" y="9.07" width="5.86" height="5.86" fill="currentColor" stroke="none" />
    </>
  ),
  /* Stacked discs in a column — Connect Four. */
  discs: (
    <>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="2.8" />
      <circle cx="8.5" cy="15.4" r="2.5" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.4" r="2.5" />
      <circle cx="8.5" cy="8.6" r="2.5" />
    </>
  ),
  /* Brick rows above a paddle and ball. */
  bricks: (
    <>
      <path d="M3.2 4.6h17.6M3.2 9h17.6M8 4.6V9M14.6 4.6V9" />
      <rect x="3.2" y="4.6" width="17.6" height="4.4" rx="1" />
      <circle cx="15.4" cy="13.6" r="1.5" fill="currentColor" stroke="none" />
      <rect x="6.6" y="18" width="10.8" height="2.6" rx="1.3" fill="currentColor" stroke="none" />
    </>
  ),
  /* An O and an X, side by side. */
  noughts: (
    <>
      <circle cx="8" cy="8" r="4" />
      <path d="M13.4 13.4 20.4 20.4M20.4 13.4l-7 7" />
    </>
  ),

  undo: (
    <>
      <path d="M4 12a8 8 0 1 0 2.6-5.9" />
      <path d="M4 4v4.6h4.6" />
    </>
  ),
  'rotate-cw': (
    <>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4.6h-4.6" />
    </>
  ),

  /* Blank letter slots with a rising underscore — the guessing word. */
  gallows: (
    <>
      <path d="M3.4 19.4h17.2" />
      <path d="M5.6 15.6h3.6M10.2 15.6h3.6M14.8 15.6h3.6" />
      <rect x="5.6" y="4.6" width="12.8" height="7.4" rx="1.8" />
      <path d="M9.4 8.3h5.2" />
    </>
  ),
  /* Two crossing arrows — letters being rearranged. */
  shuffle: (
    <>
      <path d="M3.4 6.6h4l9.2 10.8h4" />
      <path d="M3.4 17.4h4l3.4-4" />
      <path d="M13.6 8.2 16.6 6.6M18.2 4.6l2.4 2-2.4 2" />
      <path d="M18.2 15.4l2.4 2-2.4 2" />
    </>
  ),
  /* A figure arcing up off a platform. */
  jump: (
    <>
      <circle cx="12.6" cy="5.4" r="2.2" />
      <path d="M4.4 16.4c2.6-5.4 5.6-8 9-8 2.4 0 4.4 1.3 6.2 3.8" />
      <path d="M3.4 20.4h5.2M15.4 20.4h5.2" />
    </>
  ),
  /* Two paddles and a ball between them. */
  paddle: (
    <>
      <rect x="2.6" y="7.4" width="2.8" height="9.2" rx="1.4" fill="currentColor" />
      <rect x="18.6" y="7.4" width="2.8" height="9.2" rx="1.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" stroke="none" />
      <path d="M12 3.6v2.2M12 18.2v2.2" />
    </>
  ),
  /* A lit bulb. */
  bulb: (
    <>
      <path d="M9 17.4a6 6 0 1 1 6 0v1.6a1.4 1.4 0 0 1-1.4 1.4h-3.2A1.4 1.4 0 0 1 9 19Z" />
      <path d="M9.6 17.4h4.8" />
    </>
  ),
  /* Clustered bubbles. */
  bubbles: (
    <>
      <circle cx="8.6" cy="14.4" r="5.2" />
      <circle cx="16.4" cy="8.6" r="3.6" />
      <circle cx="6.6" cy="6.4" r="2.2" />
    </>
  ),

  /* Four rows of tiles — one solved group filled. */
  groups: (
    <>
      <rect x="2.6" y="3.4" width="18.8" height="4" rx="1.4" fill="currentColor" />
      <rect x="2.6" y="9.2" width="8.6" height="4" rx="1.4" />
      <rect x="12.8" y="9.2" width="8.6" height="4" rx="1.4" />
      <rect x="2.6" y="15" width="8.6" height="4" rx="1.4" />
      <rect x="12.8" y="15" width="8.6" height="4" rx="1.4" />
    </>
  ),
  /* Merged circles of growing size, in a container. */
  fruit: (
    <>
      <path d="M3.8 5.6v10a5 5 0 0 0 5 5h6.4a5 5 0 0 0 5-5v-10" />
      <circle cx="9" cy="14.6" r="4" />
      <circle cx="16.4" cy="16" r="2.6" />
      <circle cx="14.6" cy="9" r="2" />
    </>
  ),
  /* Three identical tiles, the match-3 trio. */
  triple: (
    <>
      <rect x="2.4" y="8.6" width="6" height="6.8" rx="1.6" fill="currentColor" />
      <rect x="9" y="8.6" width="6" height="6.8" rx="1.6" fill="currentColor" />
      <rect x="15.6" y="8.6" width="6" height="6.8" rx="1.6" />
    </>
  ),
  /* Lane markings with a car crossing. */
  traffic: (
    <>
      <path d="M3.4 3.4v17.2M20.6 3.4v17.2" />
      <path d="M12 3.4v3M12 10.4v3M12 17.4v3" />
      <rect x="6.2" y="9.6" width="5.2" height="4.8" rx="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  /* A globe with meridians. */
  globe: (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M3.4 12h17.2" />
      <path d="M12 3.4a13 13 0 0 1 0 17.2 13 13 0 0 1 0-17.2Z" />
    </>
  ),
  /* Overlapping colour swatches. */
  swatch: (
    <>
      <rect x="2.8" y="2.8" width="10" height="10" rx="2.4" fill="currentColor" />
      <rect x="11.2" y="11.2" width="10" height="10" rx="2.4" />
      <path d="M11.2 6.6h4.4a2 2 0 0 1 2 2v2.6" />
    </>
  ),
  /* An escaping directional arrow breaking out through an aperture. */
  'arrow-escape': (
    <>
      <path d="M4 12h14" />
      <path d="M12 6l6 6-6 6" />
      <path d="M21 4v4M21 16v4" />
    </>
  ),
  /* An atomic nucleus with intersecting electron orbits for Chain Reaction. */
  atom: (
    <>
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(30 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(-30 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(90 12 12)" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  blast: (
    <>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
      <path d="M14 14l6 6M20 14l-6 6" />
    </>
  ),
  flask: (
    <>
      <path d="M9.5 3h5M10 3v5.5L5.6 18a2.3 2.3 0 0 0 2.1 3.5h8.6a2.3 2.3 0 0 0 2.1-3.5L14 8.5V3" />
      <path d="M7.4 15h9.2" />
    </>
  ),
}
