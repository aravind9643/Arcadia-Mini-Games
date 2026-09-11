import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './components/TabBar'
import { Empty } from './components/ui'
import { primeAudio } from './lib/feedback'
import { useThemeEffect } from './lib/hooks'
import { Home } from './screens/Home'
import { Play } from './screens/Play'
import { Scores } from './screens/Scores'
import { Settings } from './screens/Settings'

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

export default function App() {
  useThemeEffect()
  const location = useLocation()

  // iOS only allows the audio context to start inside a gesture.
  useEffect(() => {
    const on = () => primeAudio()
    window.addEventListener('pointerdown', on, { once: true })
    return () => window.removeEventListener('pointerdown', on)
  }, [])

  // Never restore a scroll position across routes.
  useEffect(() => window.scrollTo(0, 0), [location.pathname])

  return (
    <>
      <div className="aurora" aria-hidden>
        <div className="aurora__grain" />
      </div>

      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <Page>
                <Home />
              </Page>
            }
          />
          <Route
            path="/scores"
            element={
              <Page>
                <Scores />
              </Page>
            }
          />
          <Route
            path="/settings"
            element={
              <Page>
                <Settings />
              </Page>
            }
          />
          <Route path="/play/:id" element={<Play />} />
          <Route
            path="*"
            element={
              <Page>
                <div className="page shell">
                  <Empty icon="🕹️" title="Nothing here">
                    That screen doesn't exist. Head back to the arcade.
                  </Empty>
                </div>
              </Page>
            }
          />
        </Routes>
      </AnimatePresence>

      <TabBar />
    </>
  )
}
