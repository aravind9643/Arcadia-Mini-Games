# Arcadia — Mini Games

A mobile-first PWA arcade of twenty-six mini games, built with React 19, TypeScript, Vite and Framer Motion. Installable, and fully playable offline.

## Run it

```bash
npm install
npm run dev      # dev server
npm run build    # production build -> dist/
npm run preview  # serve the built app (needed to test the service worker)
```

The service worker only runs in a production build, so use `preview` to test installability and offline play.

## The games

| Game | Category | Scored by |
| --- | --- | --- |
| Memory Match | Memory | fewest moves |
| 2048 | Puzzle | top score |
| Sudoku | Puzzle | fastest solve |
| Minesweeper | Puzzle | fastest clear |
| Tetris | Arcade | top score |
| Breakout | Arcade | top score |
| Snake | Arcade | longest run |
| Flappy Bird | Reflex | most pipes |
| Reaction | Reflex | best average (ms) |
| Whack-a-Mole | Reflex | most points in 30s |
| Lights Out | Puzzle | fewest moves |
| SameGame | Puzzle | top score |
| Doodle Jump | Arcade | highest climb |
| Pong | Arcade | best win margin |
| Connect Four | Strategy | wins |
| Tic-Tac-Toe | Strategy | wins |
| Simon | Memory | longest sequence |
| Wordle | Word | fewest guesses |
| Hangman | Word | longest streak |
| Word Scramble | Word | top score |
| Connections | Word | fewest mistakes |
| Flag Hunt | Word | best round |
| Suika | Puzzle | top score |
| Triple Tile | Puzzle | top score |
| Crossy Road | Arcade | furthest hop |
| Odd Shade | Reflex | highest level |

## On naming and trademarks

Games here are listed under the familiar names of the titles they reproduce, so the mechanics are immediately recognisable. Every one is an independent implementation: all code, artwork, word lists and puzzle data are original, and no assets are taken from the original titles.

Be aware that several of these names are **active trademarks** of their owners — among them Tetris (Tetris Holding), Wordle and Connections (The New York Times), Suika Game (Aladdin X), Crossy Road (Hipster Whale), Doodle Jump (Lima Sky), Flappy Bird (dotGEARS), Simon (Hasbro) and Connect Four (Hasbro). Using them is fine for a personal or portfolio project, but **publishing to an app store or any commercial distribution under these names risks takedown**. Rename the `title` fields in [`src/games/registry.ts`](src/games/registry.ts) before shipping publicly — titles live in that one file, so renaming is a single-file change and nothing else references them.

The two Strategy games ship real opponents rather than random movers. Tic-Tac-Toe uses full **minimax** with depth preference, so Hard is unbeatable — a draw is the best available result. Connect Four uses **minimax with alpha-beta pruning** (depth 5 on Hard) over a positional evaluation that weights centre control and blocks imminent threats. Both were verified by scripted play: random moves won 0 of 6 against Tic-Tac-Toe's Hard AI and 0 of 4 against Connect Four's.

Each game is lazily loaded as its own chunk, so the initial download stays small.

## Architecture

```
src/
  games/
    registry.ts        game metadata + lazy imports (drives home & routing)
    <game>/            one folder per game, component + CSS (+ logic where it earns a file)
  components/
    GameFrame.tsx      shared game chrome: header, HUD, help sheet, result overlay
    TabBar.tsx         bottom tabs on mobile, top-right capsule on desktop
    ui.tsx             Button, IconButton, Stat, Toggle, Empty
  screens/             Home, Play, Scores, Settings, InstallPrompt
  lib/
    storage.ts         localStorage-backed store (scores, settings, favorites)
    feedback.ts        WebAudio synth + haptics — no audio assets to download
    hooks.ts           store subscription, RAF loop, swipe/arrow input, sizing
    utils.ts           formatting and small helpers
```

**Adding a game** means creating the folder and adding one entry to `registry.ts` — the home grid, routing, scores screen and help sheet all read from that registry.

## Design notes

- **Mobile-first.** Layouts are built for a ~390px viewport and widen at 860px, where the tab bar moves to the top-right and grids gain columns. Thumb controls (Snake's D-pad, Minesweeper's flag toggle) hide on pointer devices, which get keyboard input instead.
- **Input parity.** Every game takes both touch and keyboard: swipe or arrows for 2048 and Snake, long-press or right-click to flag in Minesweeper, on-screen or physical keyboard in Wordle.
- **No downloaded assets.** Sound is synthesised with WebAudio and every icon is inline SVG, so the whole app is self-contained offline with no icon font or sprite request. Audio is unlocked on the first pointer gesture, as iOS requires.
- **One icon set.** [`Icon.tsx`](src/components/Icon.tsx) holds a stroke-based set drawn on a 24px grid. They inherit `currentColor` and take a `weight` prop, so they stay consistent and theme-aware — unlike emoji, which render differently on every OS and can't be recolored. Memory Match's card faces are flat SVG shapes for the same reason.
- **Motion with a fallback.** Animations use spring physics via Framer Motion, and `prefers-reduced-motion` collapses them.
- **Theming.** Light and dark palettes are CSS custom properties on `:root`; the choice persists and updates the browser theme-color.

Scores, settings and favorites live in `localStorage` on the device — nothing is uploaded.
