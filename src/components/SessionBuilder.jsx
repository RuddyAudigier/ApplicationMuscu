import { useState } from 'react'
import '../styles/SessionBuilder.css'

export default function SessionBuilder({ exercises, onAddSession, onOpenExerciseDetails }) {
  const [sessionName, setSessionName] = useState('')
  const [selectedExercises, setSelectedExercises] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  const filteredExercises = exercises.filter((ex) =>
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ex.muscleGroups?.some((mg) => mg.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const handleAddExerciseToSession = (exercise) => {
    if (!selectedExercises.find((ex) => ex.id === exercise.id)) {
      setSelectedExercises([...selectedExercises, { ...exercise, series: 3 }])
    }
  }

  const handleRemoveExerciseFromSession = (exerciseId) => {
    setSelectedExercises(selectedExercises.filter((ex) => ex.id !== exerciseId))
  }

  const handleSeriesChange = (exerciseId, series) => {
    setSelectedExercises(
      selectedExercises.map((ex) =>
        ex.id === exerciseId ? { ...ex, series: parseInt(series, 10) || 0 } : ex
      )
    )
  }

  const handleCreateSession = () => {
    if (sessionName.trim() && selectedExercises.length > 0) {
      onAddSession({
        name: sessionName,
        exercises: selectedExercises,
        createdAt: new Date().toLocaleDateString('fr-FR')
      })
      setSessionName('')
      setSelectedExercises([])
      setSearchQuery('')
      alert('Séance créée avec succès.')
    } else {
      alert('Veuillez entrer un nom et sélectionner des exercices.')
    }
  }

  return (
    <div className="session-builder">
      <div className="builder-header">
        <h2>Créer une séance</h2>
        <p>Composez votre séance en sélectionnant les exercices souhaités.</p>
      </div>

      <div className="builder-content">
        <div className="input-group">
          <label htmlFor="sessionName">Nom de la séance *</label>
          <input
            id="sessionName"
            type="text"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            placeholder="Ex: Haut du corps"
            className="session-name-input"
          />
        </div>

        <div className="builder-layout">
          <div className="exercise-selection">
            <h3>Exercices disponibles ({filteredExercises.length})</h3>

            <input
              type="text"
              placeholder="Rechercher un exercice"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />

            <div className="exercises-scroll">
              {filteredExercises.length > 0 ? (
                filteredExercises.map((exercise) => (
                  <div key={exercise.id} className="exercise-item">
                    <div className="exercise-info">
                      <h4>
                        <button
                          type="button"
                          className="exercise-link-button"
                          onClick={() => onOpenExerciseDetails?.(exercise.id)}
                          title={`Voir la fiche de ${exercise.name}`}
                        >
                          {exercise.name}
                        </button>
                      </h4>
                      <div className="muscle-tags">
                        {exercise.muscleGroups?.map((group) => (
                          <span key={group} className="muscle-tag">{group}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      className="add-btn"
                      onClick={() => handleAddExerciseToSession(exercise)}
                      disabled={selectedExercises.find((ex) => ex.id === exercise.id)}
                    >
                      {selectedExercises.find((ex) => ex.id === exercise.id) ? 'Ajouté' : 'Ajouter'}
                    </button>
                  </div>
                ))
              ) : (
                <p className="no-results">Aucun exercice trouvé</p>
              )}
            </div>
          </div>

          <div className="selected-panel">
            <h3>Séance en construction ({selectedExercises.length})</h3>

            {selectedExercises.length > 0 ? (
              <div className="selected-exercises">
                {selectedExercises.map((exercise) => (
                  <div key={exercise.id} className="selected-item">
                    <div className="exercise-details">
                      <h4>
                        <button
                          type="button"
                          className="exercise-link-button"
                          onClick={() => onOpenExerciseDetails?.(exercise.id)}
                          title={`Voir la fiche de ${exercise.name}`}
                        >
                          {exercise.name}
                        </button>
                      </h4>
                      <div className="muscle-tags">
                        {exercise.muscleGroups?.map((group) => (
                          <span key={group} className="muscle-tag small">{group}</span>
                        ))}
                      </div>
                    </div>
                    <div className="series-control">
                      <label htmlFor={`series-${exercise.id}`}>Séries:</label>
                      <input
                        id={`series-${exercise.id}`}
                        type="number"
                        min="1"
                        max="10"
                        value={exercise.series}
                        onChange={(e) => handleSeriesChange(exercise.id, e.target.value)}
                      />
                    </div>
                    <button
                      className="remove-btn"
                      onClick={() => handleRemoveExerciseFromSession(exercise.id)}
                      title="Supprimer"
                    >
                      Retirer
                    </button>
                  </div>
                ))}

                <button className="create-btn" onClick={handleCreateSession}>
                  Créer la séance
                </button>
              </div>
            ) : (
              <div className="empty-panel">
                <p>Aucun exercice sélectionné</p>
                <p className="hint">Ajoutez des exercices depuis la liste de gauche.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
