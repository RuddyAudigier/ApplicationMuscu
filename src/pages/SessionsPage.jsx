import { useState } from 'react'
import SessionBuilder from '../components/SessionBuilder'
import SessionsList from '../components/SessionsList'
import '../styles/TrainingPages.css'

export default function SessionsPage({
  exercises,
  sessions,
  onAddSession,
  onDeleteSession,
  onLaunchSession,
  onResumeSession,
  onShareSession,
  activeSessionId,
  onOpenExerciseDetails,
  onNavigate
}) {
  const [showSessionBuilder, setShowSessionBuilder] = useState(false)

  const handleCreateSession = (sessionData) => {
    onAddSession(sessionData)
    setShowSessionBuilder(false)
  }

  return (
    <div className="training-page">
      <div className="training-topbar">
        <div className="training-title">
          <h1>Séances</h1>
          <p>Créez, lancez, reprenez et partagez vos séances.</p>
        </div>

        <div className="training-switch" aria-label="Aller à">
          <button type="button" onClick={() => onNavigate?.('exercises')}>
            Exercices
          </button>
          <button type="button" className="active" onClick={() => onNavigate?.('sessions')}>
            Séances <span aria-hidden="true">({sessions.length})</span>
          </button>
        </div>
      </div>

      <section className="training-surface">
        <header className="training-surface-header">
          <div>
            <h2>Gestion</h2>
            <p>Crée une séance puis lance-la depuis la liste (ou reprends si elle est en cours).</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setShowSessionBuilder((prev) => !prev)}
          >
            {showSessionBuilder ? 'Fermer la création' : 'Créer une séance'}
          </button>
        </header>

        <div className="training-surface-body">
          <SessionsList
            sessions={sessions}
            onDeleteSession={onDeleteSession}
            onLaunchSession={onLaunchSession}
            onResumeSession={onResumeSession}
            onShareSession={onShareSession}
            activeSessionId={activeSessionId}
            onOpenExerciseDetails={onOpenExerciseDetails}
          />

          {showSessionBuilder && (
            <SessionBuilder
              exercises={exercises}
              onAddSession={handleCreateSession}
              onOpenExerciseDetails={onOpenExerciseDetails}
            />
          )}
        </div>
      </section>
    </div>
  )
}
