import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { Button, IconButton } from '../components/ui'
import './InstallPrompt.css'

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'arcadia:install-dismissed'

/** Offers the native A2HS prompt on Chromium, and iOS instructions on Safari. */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)
  const [hidden, setHidden] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1',
  )

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true
    if (standalone) {
      setHidden(true)
      return
    }

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvt(e as BIPEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)

    // iOS Safari never fires beforeinstallprompt — detect and instruct instead.
    const ua = navigator.userAgent
    const isIOS = /iP(hone|ad|od)/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    if (isIOS) setIosHint(true)

    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1')
    setHidden(true)
  }

  const show = !hidden && (evt !== null || iosHint)

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          className="install"
          initial={{ opacity: 0, y: 14, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -10, height: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        >
          <span className="install__icon">📲</span>
          <div className="install__text">
            <strong>Install Arcadia</strong>
            <p>
              {evt
                ? 'Add it to your home screen for full-screen play, offline.'
                : 'Tap Share, then “Add to Home Screen” to play offline.'}
            </p>
          </div>
          {evt && (
            <Button
              variant="primary"
              size="sm"
              onClick={async () => {
                await evt.prompt()
                const { outcome } = await evt.userChoice
                if (outcome === 'accepted') dismiss()
                setEvt(null)
              }}
            >
              Install
            </Button>
          )}
          <IconButton label="Dismiss" className="install__x" onClick={dismiss}>
            ✕
          </IconButton>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
