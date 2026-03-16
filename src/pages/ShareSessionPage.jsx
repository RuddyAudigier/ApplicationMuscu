import '../styles/ShareSessionPage.css'
import { normalizeMuscleGroups } from '../utils/muscleGroups'

export default function ShareSessionPage({ sharedSession, onBackToApp }) {
  if (!sharedSession) {
    return null
  }

  if (sharedSession.invalid) {
    return (
      <div className="share-page">
        <div className="share-card">
          <p className="share-kicker">Lien de partage</p>
          <h1>Lien invalide ou expiré</h1>
          <p className="share-date">ID: {sharedSession.sharedId}</p>
          <p className="share-date">Le lien existe mais la séance n'a pas été retrouvée en base.</p>
          <button className="btn btn-secondary share-back-btn" onClick={onBackToApp}>
            Retour à l'application
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="share-page">
      <div className="share-card">
        <p className="share-kicker">
          {sharedSession.shareType === 'completed-workout' ? 'Séance effectuée partagée' : 'Fiche séance partagée'}
        </p>
        <h1>{sharedSession.name}</h1>
        <p className="share-date">Lien généré le {sharedSession.sharedAt}</p>
        {sharedSession.workoutDate && (
          <p className="share-date">Séance réalisée le {sharedSession.workoutDate}</p>
        )}

        <div className="share-exercises">
          {sharedSession.exercises.map((exercise) => (
            <article key={exercise.id} className="share-exercise-card">
              <h2>{exercise.name}</h2>

              <div className="share-tags">
                {normalizeMuscleGroups(exercise.muscleGroups).map((group) => (
                  <span key={group} className="muscle-group">{group}</span>
                ))}
              </div>

              {exercise.coachNotes && (
                <div className="share-notes">
                  <strong>Remarques coach:</strong>
                  <p className="share-notes-content">{exercise.coachNotes}</p>
                </div>
              )}

              <div className="share-series-table-wrap">
                <table className="share-series-table">
                  <thead>
                    <tr>
                      <th>Série</th>
                      <th>Variante</th>
                      <th>Reps</th>
                      <th>Poids (kg)</th>
                      <th>RPE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exercise.seriesData.map((serie) => (
                      <tr key={`${exercise.id}-${serie.serieNumber}`}>
                        <td>{serie.serieNumber}</td>
                        <td>{serie.variantName ?? '-'}</td>
                        <td>{serie.reps ?? '-'}</td>
                        <td>{serie.weight ?? '-'}</td>
                        <td>
                          {serie.rpe ? (
                            <span className={`rpe-chip rpe-${serie.rpe}`}>RPE {serie.rpe}</span>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ))}
        </div>

        <button className="btn btn-secondary share-back-btn" onClick={onBackToApp}>
          Retour à l'application
        </button>
      </div>
    </div>
  )
}
