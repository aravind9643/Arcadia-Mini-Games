import { Suspense } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { GameFrame } from '../components/GameFrame'
import { byId } from '../games/registry'
import './Play.css'

export function Play() {
  const { id = '' } = useParams()
  const game = byId(id)

  if (!game) return <Navigate to="/" replace />

  const { Component } = game
  return (
    <Suspense
      fallback={
        <GameFrame game={game}>
          <div className="booting">
            <span className="booting__ring" />
            <p>Loading {game.title}…</p>
          </div>
        </GameFrame>
      }
    >
      <Component />
    </Suspense>
  )
}
