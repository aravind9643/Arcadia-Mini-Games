import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { grad } from '../components/GameFrame'
import { IconButton, SectionTitle } from '../components/ui'
import { CATEGORIES, GAMES, type GameCategory, type GameMeta } from '../games/registry'
import { cue } from '../lib/feedback'
import { useStore } from '../lib/hooks'
import { store } from '../lib/storage'
import { cx, fmtNum, fmtTime } from '../lib/utils'
import { InstallPrompt } from './InstallPrompt'
import './Home.css'

type Filter = 'All' | 'Favorites' | GameCategory

export function Home() {
  const { scores, favorites } = useStore()
  const [filter, setFilter] = useState<Filter>('All')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return GAMES.filter((g) => {
      if (filter === 'Favorites' && !favorites.includes(g.id)) return false
      if (filter !== 'All' && filter !== 'Favorites' && g.category !== filter) return false
      if (!q) return true
      return (
        g.title.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
      )
    })
  }, [filter, query, favorites])

  const totalPlays = Object.values(scores).reduce((a, s) => a + s.plays, 0)
  const played = Object.keys(scores).length

  const recent = useMemo(
    () =>
      Object.entries(scores)
        .sort((a, b) => b[1].lastPlayed - a[1].lastPlayed)
        .slice(0, 1)
        .map(([id]) => GAMES.find((g) => g.id === id))
        .filter((g): g is GameMeta => Boolean(g))[0],
    [scores],
  )

  const filters: Filter[] = ['All', 'Favorites', ...CATEGORIES]

  return (
    <div className="page shell home">
      <header className="home__head">
        <motion.p
          className="home__eyebrow"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {greeting()} · {GAMES.length} games offline-ready
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.04 }}
        >
          Your pocket <span className="grad-text">arcade</span>
        </motion.h1>
        <motion.div
          className="home__meta"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.12 }}
        >
          <span className="chip">🎲 {fmtNum(totalPlays)} rounds played</span>
          <span className="chip">
            🏅 {played}/{GAMES.length} tried
          </span>
        </motion.div>
      </header>

      <InstallPrompt />

      {recent && <ContinueCard game={recent} />}

      {/* filters + search */}
      <div className="home__controls">
        <div className="home__search">
          <span aria-hidden>🔍</span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games"
            aria-label="Search games"
            type="search"
          />
        </div>
        <div className="home__chips scroll-x" role="tablist" aria-label="Filter games">
          {filters.map((f) => (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              className={cx('fchip', filter === f && 'is-on')}
              onClick={() => {
                cue('tap')
                setFilter(f)
              }}
            >
              {f === 'Favorites' ? '★ Favorites' : f}
            </button>
          ))}
        </div>
      </div>

      <SectionTitle action={<span className="home__count">{visible.length}</span>}>
        {filter === 'All' ? 'All games' : filter}
      </SectionTitle>

      {visible.length === 0 ? (
        <motion.p className="home__none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {filter === 'Favorites'
            ? 'No favorites yet — tap the star on any game.'
            : 'Nothing matched that search.'}
        </motion.p>
      ) : (
        <motion.ul className="grid" layout>
          <AnimatePresence mode="popLayout">
            {visible.map((g, i) => (
              <GameCard key={g.id} game={g} index={i} />
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  )
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Late night'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

/* ---------------- cards ---------------- */

function ContinueCard({ game }: { game: GameMeta }) {
  const nav = useNavigate()
  return (
    <motion.button
      className="cont"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.16, type: 'spring', stiffness: 260, damping: 26 }}
      whileTap={{ scale: 0.985 }}
      onClick={() => {
        cue('whoosh')
        nav(`/play/${game.id}`)
      }}
      style={{ ['--g' as string]: grad(game) }}
    >
      <span className="cont__glow" />
      <span className="cont__icon">{game.icon}</span>
      <span className="cont__text">
        <span className="cont__label">Jump back in</span>
        <strong>{game.title}</strong>
      </span>
      <span className="cont__go">▶</span>
    </motion.button>
  )
}

function GameCard({ game, index }: { game: GameMeta; index: number }) {
  const nav = useNavigate()
  const { scores, favorites } = useStore()
  const s = scores[game.id]
  const fav = favorites.includes(game.id)

  const best =
    !s || game.scoring === 'none'
      ? null
      : game.scoring === 'low'
        ? game.id === 'memory' || game.id === 'wordle'
          ? fmtNum(s.best)
          : fmtTime(s.best, true)
        : fmtNum(s.best)

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 22, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.94 }}
      transition={{ delay: Math.min(index * 0.045, 0.36), type: 'spring', stiffness: 300, damping: 28 }}
    >
      <motion.article
        className="gcard"
        whileHover={{ y: -5 }}
        whileTap={{ scale: 0.975 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        style={{ ['--g' as string]: grad(game) }}
      >
        <button
          className="gcard__hit"
          onClick={() => {
            cue('whoosh')
            nav(`/play/${game.id}`)
          }}
          aria-label={`Play ${game.title}`}
        />
        <span className="gcard__wash" aria-hidden />

        <header className="gcard__top">
          <span className="gcard__icon">{game.icon}</span>
          <IconButton
            label={fav ? `Unfavorite ${game.title}` : `Favorite ${game.title}`}
            className={cx('gcard__fav', fav && 'is-on')}
            onClick={(e) => {
              e.stopPropagation()
              store.toggleFavorite(game.id)
            }}
          >
            {fav ? '★' : '☆'}
          </IconButton>
        </header>

        <div className="gcard__body">
          <h3>{game.title}</h3>
          <p>{game.tagline}</p>
        </div>

        <footer className="gcard__foot">
          <span className="gcard__cat">{game.category}</span>
          {best ? (
            <span className="gcard__best mono" title={game.scoreLabel}>
              ★ {best}
            </span>
          ) : (
            <span className="gcard__new">New</span>
          )}
        </footer>
      </motion.article>
    </motion.li>
  )
}
