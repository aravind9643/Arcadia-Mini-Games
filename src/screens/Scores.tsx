import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { grad } from '../components/GameFrame'
import { Empty, Stat, StatRow } from '../components/ui'
import { GAMES } from '../games/registry'
import { cue } from '../lib/feedback'
import { useStore } from '../lib/hooks'
import { fmtAgo, fmtNum, fmtTime } from '../lib/utils'
import './Scores.css'

/** Memory and Word Hunt count moves/guesses; other "low" games measure time. */
const COUNT_BASED = new Set(['memory', 'wordle'])

function formatBest(id: string, scoring: string, best: number) {
  if (scoring === 'high') return fmtNum(best)
  if (COUNT_BASED.has(id)) return fmtNum(best)
  return fmtTime(best, true)
}

export function Scores() {
  const nav = useNavigate()
  const { scores } = useStore()

  const rows = GAMES.map((g) => ({ game: g, score: scores[g.id] })).sort((a, b) => {
    if (!a.score && !b.score) return 0
    if (!a.score) return 1
    if (!b.score) return -1
    return b.score.lastPlayed - a.score.lastPlayed
  })

  const plays = Object.values(scores).reduce((a, s) => a + s.plays, 0)
  const tried = Object.keys(scores).length

  return (
    <div className="page shell scores">
      <header className="scores__head">
        <p className="home__eyebrow">Your record</p>
        <h1>
          Personal <span className="grad-text">bests</span>
        </h1>
      </header>

      <StatRow>
        <Stat label="Rounds" value={fmtNum(plays)} accent />
        <Stat label="Games tried" value={`${tried}/${GAMES.length}`} />
        <Stat label="Bests set" value={fmtNum(tried)} />
      </StatRow>

      {plays === 0 ? (
        <div className="scores__empty">
          <Empty icon="🏆" title="No scores yet">
            Play a round and your bests will show up here — stored on this device.
          </Empty>
        </div>
      ) : (
        <ul className="scores__list">
          {rows.map(({ game, score }, i) => (
            <motion.li
              key={game.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: Math.min(i * 0.04, 0.3) }}
            >
              <motion.button
                className="srow"
                whileTap={{ scale: 0.985 }}
                whileHover={{ x: 3 }}
                onClick={() => {
                  cue('whoosh')
                  nav(`/play/${game.id}`)
                }}
              >
                <span className="srow__icon" style={{ background: grad(game) }}>
                  {game.icon}
                </span>
                <span className="srow__text">
                  <strong>{game.title}</strong>
                  <span>
                    {score
                      ? `${score.plays} ${score.plays === 1 ? 'round' : 'rounds'} · ${fmtAgo(score.lastPlayed)}`
                      : 'Not played yet'}
                  </span>
                </span>
                <span className="srow__best">
                  {score ? (
                    <>
                      <strong className="mono">
                        {formatBest(game.id, game.scoring, score.best)}
                      </strong>
                      <span>{game.scoreLabel}</span>
                    </>
                  ) : (
                    <span className="srow__play">Play ▸</span>
                  )}
                </span>
              </motion.button>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  )
}
