import { AnimatePresence, motion } from 'framer-motion'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { grad } from '../components/GameFrame'
import { Icon } from '../components/Icon'
import { IconButton, SectionTitle } from '../components/ui'
import { CATEGORIES, GAMES, type GameCategory, type GameMeta } from '../games/registry'
import { cue } from '../lib/feedback'
import { useStore } from '../lib/hooks'
import { store } from '../lib/storage'
import { cx, fmtNum, fmtTime } from '../lib/utils'
import { InstallPrompt } from './InstallPrompt'
import './Home.css'

type Filter = 'All' | 'Recent' | 'Favorites' | GameCategory
type SortOption = 'popular' | 'recent' | 'default' | 'name'

export function Home() {
  const { scores, favorites } = useStore()
  const [filter, setFilter] = useState<Filter>('All')
  const [sort, setSort] = useState<SortOption>('default')
  const [query, setQuery] = useState('')

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const filtered = GAMES.filter((g) => {
      const s = scores[g.id]
      if (filter === 'Recent' && (!s || s.plays === 0)) return false
      if (filter === 'Favorites' && !favorites.includes(g.id)) return false
      if (
        filter !== 'All' &&
        filter !== 'Recent' &&
        filter !== 'Favorites' &&
        g.category !== filter
      )
        return false
      if (!q) return true
      return (
        g.title.toLowerCase().includes(q) ||
        g.tagline.toLowerCase().includes(q) ||
        g.category.toLowerCase().includes(q)
      )
    })

    // In 'Recent' tab, default sort is by popularity (most played)
    const effectiveSort = filter === 'Recent' && sort === 'default' ? 'popular' : sort

    return [...filtered].sort((a, b) => {
      const sa = scores[a.id]
      const sb = scores[b.id]

      if (effectiveSort === 'popular') {
        const pa = sa?.plays ?? 0
        const pb = sb?.plays ?? 0
        if (pb !== pa) return pb - pa
        const la = sa?.lastPlayed ?? 0
        const lb = sb?.lastPlayed ?? 0
        return lb - la
      }

      if (effectiveSort === 'recent') {
        const la = sa?.lastPlayed ?? 0
        const lb = sb?.lastPlayed ?? 0
        if (lb !== la) return lb - la
        const pa = sa?.plays ?? 0
        const pb = sb?.plays ?? 0
        return pb - pa
      }

      if (effectiveSort === 'name') {
        return a.title.localeCompare(b.title)
      }

      return 0
    })
  }, [favorites, filter, query, scores, sort])

  const totalPlays = Object.values(scores).reduce((a, s) => a + s.plays, 0)
  const played = Object.keys(scores).length

  // Continue card features the user's most popular game among recent games
  const recent = useMemo(
    () =>
      Object.entries(scores)
        .filter(([, s]) => s.plays > 0)
        .sort((a, b) => {
          if (b[1].plays !== a[1].plays) return b[1].plays - a[1].plays
          return b[1].lastPlayed - a[1].lastPlayed
        })
        .slice(0, 1)
        .map(([id]) => GAMES.find((g) => g.id === id))
        .filter((g): g is GameMeta => Boolean(g))[0],
    [scores],
  )

  const filters: Filter[] = ['All', 'Recent', 'Favorites', ...CATEGORIES]

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
          <span className="chip">
            <Icon name="dice" size={14} />
            {fmtNum(totalPlays)} rounds played
          </span>
          <span className="chip">
            <Icon name="medal" size={14} />
            {played}/{GAMES.length} tried
          </span>
        </motion.div>
      </header>

      <InstallPrompt />

      {recent && <ContinueCard game={recent} />}

      {/* filters + search */}
      <div className="home__controls">
        <div className="home__search">
          <Icon name="search" size={17} />
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
              {f === 'Recent' ? (
                <>
                  <Icon name="clock" size={13} />
                  Recent
                </>
              ) : f === 'Favorites' ? (
                <>
                  <Icon name="star-filled" size={13} />
                  Favorites
                </>
              ) : (
                f
              )}
            </button>
          ))}
        </div>
      </div>

      <SectionTitle
        action={
          <div className="home__sort-bar">
            <label className="home__sort-label" htmlFor="home-sort">
              <Icon name="sparkles" size={13} />
              <select
                id="home-sort"
                value={filter === 'Recent' && sort === 'default' ? 'popular' : sort}
                onChange={(e) => {
                  cue('tap')
                  setSort(e.target.value as SortOption)
                }}
                className="home__sort-select"
                aria-label="Sort games"
              >
                <option value="popular">Popular</option>
                <option value="recent">Recent</option>
                <option value="default">Featured</option>
                <option value="name">A–Z</option>
              </select>
            </label>
            <span className="home__count">{visible.length}</span>
          </div>
        }
      >
        {filter === 'All' ? 'All games' : filter === 'Recent' ? 'Recent games' : filter}
      </SectionTitle>

      {visible.length === 0 ? (
        <motion.p className="home__none" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {filter === 'Favorites'
            ? 'No favorites yet — tap the star on any game.'
            : filter === 'Recent'
              ? 'No recent games yet — play a round to start your history!'
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
  const { scores } = useStore()
  const s = scores[game.id]
  const playLabel = s?.plays ? `${fmtNum(s.plays)} ${s.plays === 1 ? 'round' : 'rounds'} played` : null

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
      <span className="cont__icon">
        <Icon name={game.icon} size={23} />
      </span>
      <span className="cont__text">
        <span className="cont__label">
          {playLabel ? `Most Played · ${playLabel}` : 'Jump back in'}
        </span>
        <strong>{game.title}</strong>
      </span>
      <span className="cont__go">
        <Icon name="chevron-right" size={16} />
      </span>
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
          <span className="gcard__icon">
            <Icon name={game.icon} size={22} />
          </span>
          <IconButton
            label={fav ? `Unfavorite ${game.title}` : `Favorite ${game.title}`}
            className={cx('gcard__fav', fav && 'is-on')}
            onClick={(e) => {
              e.stopPropagation()
              store.toggleFavorite(game.id)
            }}
          >
            <Icon name={fav ? 'star-filled' : 'star'} size={17} />
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
              <Icon name="star-filled" size={11} />
              {best}
            </span>
          ) : (
            <span className="gcard__new">New</span>
          )}
        </footer>
      </motion.article>
    </motion.li>
  )
}
