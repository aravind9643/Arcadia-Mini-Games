import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { Sheet } from '../components/GameFrame'
import { Button, SectionTitle, Toggle } from '../components/ui'
import { GAMES } from '../games/registry'
import { cue, sfx } from '../lib/feedback'
import { useSettings } from '../lib/hooks'
import { store } from '../lib/storage'
import './Settings.css'

export function Settings() {
  const s = useSettings()
  const [confirm, setConfirm] = useState(false)

  return (
    <div className="page shell settings">
      <header className="scores__head">
        <p className="home__eyebrow">Preferences</p>
        <h1>
          Make it <span className="grad-text">yours</span>
        </h1>
      </header>

      <SectionTitle>Appearance</SectionTitle>
      <div className="settings__group">
        <Toggle
          icon={s.theme === 'dark' ? '🌙' : '☀️'}
          label="Dark theme"
          hint={s.theme === 'dark' ? 'Deep space palette' : 'Bright daylight palette'}
          checked={s.theme === 'dark'}
          onChange={(v) => store.setSettings({ theme: v ? 'dark' : 'light' })}
        />
      </div>

      <SectionTitle>Feedback</SectionTitle>
      <div className="settings__group">
        <Toggle
          icon="🔊"
          label="Sound effects"
          hint="Synthesised in-app — no downloads"
          checked={s.sound}
          onChange={(v) => {
            store.setSettings({ sound: v })
            if (v) sfx('match', 2)
          }}
        />
        <Toggle
          icon="📳"
          label="Haptics"
          hint="Vibration on supported devices"
          checked={s.haptics}
          onChange={(v) => {
            store.setSettings({ haptics: v })
            if (v) navigator.vibrate?.(18)
          }}
        />
      </div>

      <SectionTitle>Data</SectionTitle>
      <div className="settings__group">
        <div className="settings__row">
          <span className="toggle__icon">💾</span>
          <span className="toggle__text">
            <span className="toggle__label">Stored on this device</span>
            <span className="toggle__hint">
              Scores and preferences live in local storage. Nothing is uploaded.
            </span>
          </span>
        </div>
        <Button variant="danger" full onClick={() => setConfirm(true)}>
          Reset all progress
        </Button>
      </div>

      <footer className="settings__foot">
        <span className="settings__mark">🕹️</span>
        <strong>Arcadia</strong>
        <p>
          {GAMES.length} mini games · installable · plays offline
          <br />
          Built with React, TypeScript and Framer Motion.
        </p>
      </footer>

      <AnimatePresence>
        {confirm && (
          <Sheet title="Reset all progress?" onClose={() => setConfirm(false)}>
            <p className="settings__warn">
              This clears every best score, play count and favorite on this device. It can't be
              undone.
            </p>
            <motion.div className="settings__confirm">
              <Button
                variant="danger"
                full
                onClick={() => {
                  store.reset()
                  cue('lose', 'error')
                  setConfirm(false)
                }}
              >
                Yes, reset everything
              </Button>
              <Button variant="ghost" full onClick={() => setConfirm(false)}>
                Keep my scores
              </Button>
            </motion.div>
          </Sheet>
        )}
      </AnimatePresence>
    </div>
  )
}
