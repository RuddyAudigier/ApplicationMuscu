import { useEffect, useMemo, useState } from 'react'
import AddExerciseForm from '../components/AddExerciseForm'
import ExerciseList from '../components/ExerciseList'
import SearchBar from '../components/SearchBar'
import MuscleFilter from '../components/MuscleFilter'
import { normalizeMuscleGroups } from '../utils/muscleGroups'
import '../styles/TrainingPages.css'
import '../styles/Modal.css'

export default function ExercisesPage({
  exercises,
  onAddExercise,
  onDeleteExercise,
  onUpdateExercise,
  onUpdateCoachNotes,
  onOpenExerciseDetails,
  onNavigate
}) {
  const [searchResults, setSearchResults] = useState(exercises)
  const [muscleFilter, setMuscleFilter] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  useEffect(() => {
    setSearchResults(exercises)
  }, [exercises])

  useEffect(() => {
    if (!isCreateOpen) {
      return
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsCreateOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isCreateOpen])

  useEffect(() => {
    if (!isCreateOpen) {
      return
    }

    const raf = window.requestAnimationFrame(() => {
      const input = document.getElementById('name')
      if (input && typeof input.focus === 'function') {
        input.focus()
      }
    })
    return () => window.cancelAnimationFrame(raf)
  }, [isCreateOpen])

  const totalExercises = exercises.length
  const activeExercisesLabel = useMemo(() => {
    if (!Array.isArray(searchResults)) {
      return `${totalExercises}`
    }
    return `${searchResults.length}/${totalExercises}`
  }, [searchResults, totalExercises])

  const handleSearch = (results) => setSearchResults(Array.isArray(results) ? results : exercises)

  const filteredExercises = useMemo(() => {
    const base = Array.isArray(searchResults) ? searchResults : exercises
    if (!muscleFilter) {
      return base
    }
    const normalizedTarget = normalizeMuscleGroups([muscleFilter])[0]
    if (!normalizedTarget) {
      return base
    }
    return base.filter((exercise) => normalizeMuscleGroups(exercise?.muscleGroups || []).includes(normalizedTarget))
  }, [exercises, muscleFilter, searchResults])

  const handleAddExercise = (exerciseData) => {
    onAddExercise(exerciseData)
    setIsCreateOpen(false)
  }

  return (
    <div className="training-page">
      <div className="training-topbar">
        <div className="training-title">
          <h1>Exercices</h1>
          <p>Ajoutez, recherchez et gérez vos variantes et notes.</p>
        </div>

        <div className="training-switch" aria-label="Aller à">
          <button type="button" className="active" onClick={() => onNavigate?.('exercises')}>
            Exercices <span aria-hidden="true">({activeExercisesLabel})</span>
          </button>
          <button type="button" onClick={() => onNavigate?.('sessions')}>
            Séances
          </button>
        </div>
      </div>

      <section className="training-surface">
        <header className="training-surface-header">
          <div>
            <h2>Bibliothèque</h2>
            <p>Tout ce dont tu as besoin pour préparer tes séances (exos, variantes, notes).</p>
          </div>
        </header>

        <div className="training-surface-body">
          <div className="training-tools">
            <SearchBar
              exercises={exercises}
              onSearch={handleSearch}
              placeholder="Rechercher par nom ou groupe musculaire"
            />
            <MuscleFilter value={muscleFilter} onChange={setMuscleFilter} />
          </div>

          <ExerciseList
            exercises={filteredExercises}
            onDeleteExercise={onDeleteExercise}
            onUpdateExercise={onUpdateExercise}
            onUpdateCoachNotes={onUpdateCoachNotes}
            onOpenExerciseDetails={onOpenExerciseDetails}
          />

          <button
            type="button"
            className="create-tile"
            onClick={() => setIsCreateOpen(true)}
            aria-label="Créer un exercice"
          >
            <span className="create-tile-plus" aria-hidden="true">+</span>
            <span className="create-tile-text">
              <strong>Créer un exercice</strong>
              <span>Ajoute un nouvel exercice à ta bibliothèque.</span>
            </span>
          </button>
        </div>
      </section>

      {isCreateOpen && (
        <div
          className="modal-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setIsCreateOpen(false)
            }
          }}
        >
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Créer un exercice">
            <div className="modal-header">
              <div className="modal-title">
                <h2>Nouveau exercice</h2>
                <p>Ajoute un exercice puis retrouve-le dans la liste.</p>
              </div>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setIsCreateOpen(false)}>
                Fermer
              </button>
            </div>
            <div className="modal-body">
              <AddExerciseForm onAddExercise={handleAddExercise} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
