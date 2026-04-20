import { useState, useEffect } from 'react'
import '../styles/SessionBuilder.css'

export default function SessionBuilder({
  exercises,
  onAddSession,
  onUpdateSession,
  initialSession = null,
  onOpenExerciseDetails
}) {
  const [sessionName, setSessionName] = useState('')
  const [selectedExercises, setSelectedExercises] = useState([])
  const [searchQuery, setSearchQuery] = useState('')

  const isEditing = Boolean(initialSession)

  useEffect(() => {
    if (initialSession) {
      setSessionName(initialSession.name || '')
      setSelectedExercises(initialSession.exercises || [])
    } else {
      setSessionName('')
      setSelectedExercises([])
    }
  }, [initialSession])

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

  const handleSaveSession = () => {
    if (sessionName.trim() && selectedExercises.length > 0) {
      const sessionData = {
        name: sessionName,
        exercises: selectedExercises,
        createdAt: isEditing ? initialSession.createdAt : new Date().toLocaleDateString('fr-FR')
      }

      if (isEditing) {
        onUpdateSession(initialSession.id, sessionData)
      } else {
        onAddSession(sessionData)
      }
    } else {
      alert('Veuillez entrer un nom et sélectionner au moins un exercice.')
    }
  }

  return (
    <div className="builder-container">
      {/* Barre supérieure du formulaire */}
      <div className="builder-form-top">
        <label htmlFor="sessionName">Identité de la séance</label>
        <input
          id="sessionName"
          type="text"
          value={sessionName}
          onChange={(e) => setSessionName(e.target.value)}
          placeholder="Ex: Poussée (Pectoraux/Triceps)"
          className="session-name-input-styled"
        />
      </div>

      <div className="builder-main-split">
        {/* Colonne de gauche: Bibliothèque d'exercices */}
        <div className="builder-column builder-search-col">
          <div className="col-header">
            <h3>Bibliothèque d'exos</h3>
            <div className="search-wrap">
              <input
                type="text"
                placeholder="🔍 Rechercher un exercice..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="minimal-search"
              />
            </div>
          </div>

          <div className="builder-scroll-list">
            {filteredExercises.length > 0 ? (
              filteredExercises.map((exercise) => {
                const isSelected = selectedExercises.some((ex) => ex.id === exercise.id)
                return (
                  <div key={exercise.id} className={`builder-exercise-card ${isSelected ? 'selected' : ''}`}>
                    <div className="card-info">
                      <h4>{exercise.name}</h4>
                      <div className="builder-tags">
                        {exercise.muscleGroups?.slice(0, 2).map((group) => (
                          <span key={group} className="builder-tag">{group}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      className={`builder-add-btn ${isSelected ? 'is-added' : ''}`}
                      onClick={() => handleAddExerciseToSession(exercise)}
                    >
                      {isSelected ? '✓' : '+'}
                    </button>
                  </div>
                )
              })
            ) : (
              <p className="no-res">Aucun résultat</p>
            )}
          </div>
        </div>

        {/* Colonne de droite: Composition de la séance */}
        <div className="builder-column builder-selection-col">
          <div className="col-header">
            <h3>Composition ({selectedExercises.length})</h3>
          </div>

          <div className="builder-selected-list">
            {selectedExercises.length > 0 ? (
              selectedExercises.map((exercise, idx) => (
                <div key={exercise.id} className="builder-selected-item">
                  <div className="item-order">{idx + 1}</div>
                  <div className="item-main-info">
                    <h4>{exercise.name}</h4>
                    <div className="item-controls">
                      <div className="item-series">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={exercise.series}
                          onChange={(e) => handleSeriesChange(exercise.id, e.target.value)}
                        />
                        <span>séries</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="item-remove"
                    onClick={() => handleRemoveExerciseFromSession(exercise.id)}
                    title="Retirer"
                  >
                    ✕
                  </button>
                </div>
              ))
            ) : (
              <div className="builder-empty-state">
                <div className="empty-icon">📂</div>
                <p>Ta séance est vide</p>
                <small>Ajoute des exercices depuis la liste de gauche</small>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Barre d'action finale */}
      <div className="builder-actions-footer">
        <button className="builder-submit-btn" onClick={handleSaveSession}>
          {isEditing ? 'Enregistrer les modifications' : 'Finaliser la séance'}
        </button>
      </div>
    </div>
  )
}
