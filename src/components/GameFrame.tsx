import { AnimatePresence, motion } from 'framer-motion'
import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cue } from '../lib/feedback'
import type { GameMeta } from '../games/registry'
import { Icon } from './Icon'
import { Button, IconButton } from './ui'
import './GameFrame.css'

type Props = {
  game: GameMeta
  /** Live stats row (score, timer, moves…). */
  hud?: ReactNode
  /** Extra controls beside the restart button. */
  actions?: ReactNode
  onRestart?: () => void
  children: ReactNode
}

export function GameFrame({ game, hud, actions, onRestart, children }: Props) {
  const nav = useNavigate()
  const [help, setHelp] = useState(false)

  return (
    <div className="gf">
      <header className="gf__bar">
        <IconButton label="Back to games" onClick={() => nav('/')}>
          <Icon name="back" size={20} />
        </IconButton>

        <div className="gf__id">
          <span className="gf__icon" style={{ background: grad(game) }}>
            <Icon name={game.icon} size={21} />
          </span>
          <span className="gf__titles">
            <h1>{game.title}</h1>
            <span>{game.category}</span>
          </span>
        </div>

        <div className="gf__tools">
          {actions}
          <IconButton label="How to play" onClick={() => setHelp(true)}>
            <Icon name="help" size={19} />
          </IconButton>
          {onRestart && (
            <IconButton
              label="Restart"
              onClick={() => {
                cue('whoosh', 'heavy')
                onRestart()
              }}
            >
              <Icon name="restart" size={19} />
            </IconButton>
          )}
        </div>
      </header>

      {hud && <div className="gf__hud">{hud}</div>}

      <main className="gf__stage">{children}</main>

      <AnimatePresence>
        {help && (
          <Sheet onClose={() => setHelp(false)} title={`How to play ${game.title}`}>
            <ol className="gf__steps">
              {game.howTo.map((s, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 + i * 0.06 }}
                >
                  <span className="gf__stepno">{i + 1}</span>
                  {s}
                </motion.li>
              ))}
            </ol>
            <Button variant="primary" full onClick={() => setHelp(false)}>
              Got it
            </Button>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  )
}

export const grad = (g: GameMeta) =>
  `linear-gradient(135deg, ${g.colors[0]}, ${g.colors[1]})`

/* ---------------- bottom sheet / modal ---------------- */

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  return (
    <motion.div
      className="sheet__scrim"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="sheet card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ y: '100%', opacity: 0.5 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 34 }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.45 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 620) onClose()
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="sheet__grab" />
        <h2 className="sheet__title">{title}</h2>
        {children}
      </motion.div>
    </motion.div>
  )
}

/* ---------------- end-of-round overlay ---------------- */

export function ResultOverlay({
  open,
  won,
  headline,
  detail,
  isBest,
  onAgain,
  extra,
}: {
  open: boolean
  won?: boolean
  headline: string
  detail?: ReactNode
  isBest?: boolean
  onAgain: () => void
  extra?: ReactNode
}) {
  const nav = useNavigate()
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="result"
          initial={{ opacity: 0, backdropFilter: 'blur(0px)' }}
          animate={{ opacity: 1, backdropFilter: 'blur(14px)' }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="result__card card"
            initial={{ scale: 0.86, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 26 }}
          >
            {isBest && (
              <motion.span
                className="result__badge"
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: -8 }}
                transition={{ type: 'spring', stiffness: 400, damping: 12, delay: 0.22 }}
              >
                <Icon name="star-filled" size={13} />
                New best
              </motion.span>
            )}
            <motion.span
              className={`result__mark${won ? ' is-won' : ''}`}
              initial={{ scale: 0.3, rotate: -12 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 14, delay: 0.06 }}
            >
              <Icon name={won ? 'trophy' : 'sparkles'} size={34} weight={1.7} />
            </motion.span>
            <h2>{headline}</h2>
            {detail && <div className="result__detail">{detail}</div>}
            {extra}
            <div className="result__actions">
              <Button variant="primary" size="lg" full onClick={onAgain}>
                Play again
              </Button>
              <Button variant="ghost" full onClick={() => nav('/')}>
                Back to games
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
