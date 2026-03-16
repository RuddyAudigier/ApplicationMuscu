import '../styles/SessionsList.css'

export default function SessionsList({
  sessions,
  onDeleteSession,
  onLaunchSession,
  onResumeSession,
  onShareSession,
  activeSessionId,
  onOpenExerciseDetails
}) {
  if (sessions.length === 0) {
    return (
      <div className="empty-state-sessions">
        <h3>Aucune séance créée</h3>
        <p>Utilisez le bouton \"Créer une séance\" pour démarrer.</p>
      </div>
    )
  }

  return (
    <div className="sessions-list-wrapper">
      <div className="sessions-header">
        <h2>Mes séances</h2>
      </div>

      <div className="sessions-grid">
        {sessions.map((session) => (
          <div key={session.id} className="session-card">
            <div className="session-header">
              <h3>{session.name}</h3>
              <div className="session-actions">
                <button
                  className="btn-launch"
                  onClick={() => onLaunchSession(session)}
                  title="Lancer cette séance"
                >
                  Démarrer
                </button>
                <button
                  className="btn-delete"
                  onClick={() => {
                    if (window.confirm('Supprimer cette séance ?')) {
                      onDeleteSession(session.id)
                    }
                  }}
                  title="Supprimer cette séance"
                >
                  Supprimer
                </button>
                <button
                  className="btn-launch"
                  onClick={() => onShareSession(session)}
                  title="Partager la dernière séance effectuée"
                >
                  Partager séance faite
                </button>
              </div>
            </div>

            <p className="session-date">Créée le {session.createdAt}</p>

            <div className="session-exercises">
              <p className="exercises-label">Exercices inclus ({session.exercises.length})</p>
              {session.exercises.slice(0, 5).map((sessionExercise) => (
                <div key={sessionExercise.id} className="exercise-item-session">
                  <div>
                    <button
                      type="button"
                      className="exercise-name exercise-link-button"
                      onClick={() => onOpenExerciseDetails?.(sessionExercise.id)}
                      title={`Voir la fiche de ${sessionExercise.name}`}
                    >
                      {sessionExercise.name}
                    </button>
                    <div className="muscle-tags">
                      {sessionExercise.muscleGroups?.slice(0, 2).map((group) => (
                        <span key={group} className="muscle-tag">{group}</span>
                      ))}
                      {sessionExercise.muscleGroups?.length > 2 && (
                        <span className="muscle-tag">+{sessionExercise.muscleGroups.length - 2}</span>
                      )}
                    </div>
                  </div>
                  <div className="series-badge">
                    <span>{sessionExercise.series}</span>
                    <span className="series-label">séries</span>
                  </div>
                </div>
              ))}

              {session.exercises.length > 5 && (
                <p className="more-exercises">+{session.exercises.length - 5} exercices</p>
              )}
            </div>

            <button className="cta-btn" onClick={() => onLaunchSession(session)}>
              {activeSessionId === session.id ? 'Reprendre la séance' : 'Commencer la séance'}
            </button>
            {activeSessionId === session.id && (
              <button className="btn btn-secondary" onClick={() => onResumeSession(session.id)}>
                Continuer maintenant
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
