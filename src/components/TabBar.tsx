import { motion } from 'framer-motion'
import { NavLink, useLocation } from 'react-router-dom'
import { cue } from '../lib/feedback'
import { Icon, type IconName } from './Icon'
import './TabBar.css'

const TABS: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Play', icon: 'gamepad' },
  { to: '/scores', label: 'Scores', icon: 'trophy' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export function TabBar() {
  const { pathname } = useLocation()

  // The tab bar is chrome for browsing — a game screen should be undistracted.
  if (pathname.startsWith('/play/')) return null

  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar__inner">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.to === '/'}
            className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}
            onClick={() => cue('tap')}
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    className="tab__pill"
                    layoutId="tab-pill"
                    transition={{ type: 'spring', stiffness: 480, damping: 34 }}
                  />
                )}
                <span className="tab__icon">
                  <Icon name={t.icon} size={21} />
                </span>
                <span className="tab__label">{t.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
