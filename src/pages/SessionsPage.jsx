import { useState } from 'react'
import SessionBuilder from '../components/SessionBuilder'
import SessionsList from '../components/SessionsList'
import '../styles/TrainingPages.css'

export default function SessionsPage({
  exercises,
  sessions,
  onAddSession,
  onUpdateSession,
  onDeleteSession,
  onLaunchSession,
  onResumeSession,
  onShareSession,
  activeSessionId,
  onOpenExerciseDetails,
  onNavigate
}) {
  const [showSessionBuilder, setShowSessionBuilder] = useState(false)
  const [editingSession, setEditingSession] = useState(null)

  const handleCreateSession = (sessionData) => {
    onAddSession(sessionData)
    setShowSessionBuilder(false)
  }

  const handleUpdate = (id, sessionData) => {
    onUpdateSession(id, sessionData)
    setEditingSession(null)
    setShowSessionBuilder(false)
  }

  const handleEditSession = (session) => {
    setEditingSession(session)
    setShowSessionBuilder(true)
  }

  const handleToggleBuilder = () => {
    if (showSessionBuilder) {
      setEditingSession(null)
    }
    setShowSessionBuilder(!showSessionBuilder)
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
            onClick={handleToggleBuilder}
          >
            {showSessionBuilder ? (editingSession ? 'Annuler la modification' : 'Fermer la création') : 'Créer une séance'}
          </button>
        </header>

        <div className="training-surface-body">
          <SessionsList
            sessions={sessions}
            onDeleteSession={onDeleteSession}
            onLaunchSession={onLaunchSession}
            onResumeSession={onResumeSession}
            onShareSession={onShareSession}
            onEditSession={handleEditSession}
            activeSessionId={activeSessionId}
            onOpenExerciseDetails={onOpenExerciseDetails}
          />
        </div>
      </section>

      {showSessionBuilder && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              handleToggleBuilder()
            }
          }}
        >
          <div className="modal-card modal-card-large" role="dialog" aria-modal="true" aria-label={editingSession ? 'Modifier la séance' : 'Créer une séance'}>
            <div className="modal-header">
              <div className="modal-title">
                <h2>{editingSession ? 'Modifier la séance' : 'Nouvelle séance'}</h2>
                <p>{editingSession ? 'Ajustez votre programme et vos répétitions.' : 'Créez un nouveau modèle de séance pour vos futurs entraînements.'}</p>
              </div>
              <button type="button" className="btn btn-secondary btn-small" onClick={handleToggleBuilder}>
                Fermer
              </button>
            </div>
            <div className="modal-body">
              <SessionBuilder
                exercises={exercises}
                onAddSession={handleCreateSession}
                onUpdateSession={handleUpdate}
                initialSession={editingSession}
                onOpenExerciseDetails={onOpenExerciseDetails}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
