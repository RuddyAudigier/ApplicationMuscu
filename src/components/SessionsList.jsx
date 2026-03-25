import '../styles/SessionsList.css'

function computeSessionStats(session) {
  const exercises = Array.isArray(session?.exercises) ? session.exercises : []
  const totalSeries = exercises.reduce((sum, ex) => sum + (Number(ex?.series) || 0), 0)
  const primaryMuscles = new Map()
  exercises.forEach((ex) => {
    const groups = Array.isArray(ex?.muscleGroups) ? ex.muscleGroups : []
    groups.slice(0, 2).forEach((group) => {
      if (!group) return
      const key = String(group)
      primaryMuscles.set(key, (primaryMuscles.get(key) || 0) + 1)
    })
  })
  const topMuscles = Array.from(primaryMuscles.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 3)

  return { totalSeries, topMuscles }
}

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
        {sessions.map((session) => {
          const isActive = activeSessionId === session.id
          const { totalSeries, topMuscles } = computeSessionStats(session)
          const exercises = Array.isArray(session?.exercises) ? session.exercises : []

          return (
            <article key={session.id} className={`session-card${isActive ? ' active' : ''}`}>
              <header className="session-card-head">
                <div className="session-card-title">
                  <h3 title={session.name}>{session.name}</h3>
                  <div className="session-meta">
                    <span className="session-meta-item">Créée le {session.createdAt}</span>
                    <span className="session-chip">{exercises.length} exos</span>
                    <span className="session-chip">{totalSeries} séries</span>
                  </div>
                  {topMuscles.length > 0 && (
                    <div className="session-muscles" aria-label="Muscles principaux">
                      {topMuscles.map((muscle) => (
                        <span key={muscle} className="session-muscle-chip">{muscle}</span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="session-card-actions" aria-label="Actions séance">
                  {isActive ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-success btn-small session-action-primary"
                        onClick={() => onResumeSession(session.id)}
                        title="Continuer la séance en cours"
                      >
                        <span aria-hidden="true">▶</span> Continuer
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-small"
                        onClick={() => onLaunchSession(session)}
                        title="Redémarrer depuis le début"
                      >
                        <span aria-hidden="true">↻</span> Redémarrer
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-small session-action-primary"
                      onClick={() => onLaunchSession(session)}
                      title="Lancer cette séance"
                    >
                      <span aria-hidden="true">▶</span> Démarrer
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => onShareSession(session)}
                    title="Partager la dernière séance effectuée"
                  >
                    <span aria-hidden="true">⤴</span> Partager
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => {
                      if (window.confirm('Supprimer cette séance ?')) {
                        onDeleteSession(session.id)
                      }
                    }}
                    title="Supprimer cette séance"
                  >
                    <span aria-hidden="true">🗑</span> Supprimer
                  </button>
                </div>
              </header>

              <div className="session-exercises">
                <div className="exercises-label-row">
                  <p className="exercises-label">Exercices inclus</p>
                  <p className="exercises-count">{exercises.length}</p>
                </div>

                <ol className="session-exercise-list">
                  {exercises.slice(0, 5).map((sessionExercise) => (
                    <li key={sessionExercise.id} className="exercise-item-session">
                      <div className="exercise-main">
                        <button
                          type="button"
                          className="exercise-name exercise-link-button"
                          onClick={() => onOpenExerciseDetails?.(sessionExercise.id)}
                          title={`Voir la fiche de ${sessionExercise.name}`}
                        >
                          {sessionExercise.name}
                        </button>
                        <div className="muscle-tags" aria-label="Groupes musculaires">
                          {sessionExercise.muscleGroups?.slice(0, 2).map((group) => (
                            <span key={group} className="muscle-tag">{group}</span>
                          ))}
                          {sessionExercise.muscleGroups?.length > 2 && (
                            <span className="muscle-tag">+{sessionExercise.muscleGroups.length - 2}</span>
                          )}
                        </div>
                      </div>

                      <div className="series-badge" aria-label={`${sessionExercise.series} séries`}>
                        <span>{sessionExercise.series}</span>
                        <span className="series-label">séries</span>
                      </div>
                    </li>
                  ))}
                </ol>

                {exercises.length > 5 && (
                  <p className="more-exercises">+{exercises.length - 5} exercices</p>
                )}
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}
