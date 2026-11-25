import { useEffect, useMemo, useState } from 'react'
import ExerciseList from '../components/ExerciseList'
import AddExerciseForm from '../components/AddExerciseForm'
import SessionBuilder from '../components/SessionBuilder'
import SessionsList from '../components/SessionsList'
import SearchBar from '../components/SearchBar'
import GeneralAdviceBoard from '../components/GeneralAdviceBoard'
import '../styles/MusculationPage.css'

export default function MusculationPage({
  exercises,
  sessions,
  onAddExercise,
  onDeleteExercise,
  onUpdateExercise,
  onAddSession,
  onDeleteSession,
  onLaunchSession,
  onUpdateCoachNotes,
  activeSessionId,
  onResumeSession,
  onShareSession,
  onOpenExerciseDetails
}) {
  const [filteredExercises, setFilteredExercises] = useState(exercises)
  const [showSessionBuilder, setShowSessionBuilder] = useState(false)
  const [activeSection, setActiveSection] = useState('exercises')

  useEffect(() => {
    setFilteredExercises(exercises)
  }, [exercises])

  const totalExercises = exercises.length
  const totalSessions = sessions.length

  const activeExercisesLabel = useMemo(() => {
    if (!Array.isArray(filteredExercises)) {
      return `${totalExercises}`
    }
    return `${filteredExercises.length}/${totalExercises}`
  }, [filteredExercises, totalExercises])

  const handleSearch = (results) => {
    setFilteredExercises(Array.isArray(results) ? results : exercises)
  }

  const handleCreateSession = (sessionData) => {
    onAddSession(sessionData)
    setShowSessionBuilder(false)
  }

  return (
    <div className="musculation-page">
      <div className="page-header">
        <h1>Centre d'entraînement</h1>
        <p>Gérez vos exercices et vos séances dans un espace unique.</p>
      </div>

      <nav className="section-switch" aria-label="Navigation centre d'entraînement">
        <a
          className={`section-pill ${activeSection === 'exercises' ? 'active' : ''}`}
          href="#section-exercises"
          onClick={() => setActiveSection('exercises')}
        >
          Exercices <span className="section-pill-count">{activeExercisesLabel}</span>
        </a>
        <a
          className={`section-pill ${activeSection === 'sessions' ? 'active' : ''}`}
          href="#section-sessions"
          onClick={() => setActiveSection('sessions')}
        >
          Séances <span className="section-pill-count">{totalSessions}</span>
        </a>
        <a className="section-pill secondary" href="#section-sessions" onClick={() => {
          setActiveSection('sessions')
          setShowSessionBuilder(true)
        }}>
          + Créer une séance
        </a>
      </nav>

      <GeneralAdviceBoard title="Conseils généraux (entrainement, nutrition, sommeil)" variant="postit" />

      <section id="section-exercises" className="musculation-section">
        <header className="musculation-section-header">
          <div>
            <h2>Exercices</h2>
            <p>Ajoutez, recherchez et gérez vos variantes.</p>
          </div>
        </header>

        <div className="musculation-section-body">
          <AddExerciseForm onAddExercise={onAddExercise} />
          <SearchBar
            exercises={exercises}
            onSearch={handleSearch}
            placeholder="Rechercher par nom ou groupe musculaire"
          />
          <ExerciseList
            exercises={filteredExercises}
            onDeleteExercise={onDeleteExercise}
            onUpdateExercise={onUpdateExercise}
            onUpdateCoachNotes={onUpdateCoachNotes}
            onOpenExerciseDetails={onOpenExerciseDetails}
          />
        </div>
      </section>

      <section id="section-sessions" className="musculation-section">
        <header className="musculation-section-header">
          <div>
            <h2>Séances</h2>
            <p>Lancez, reprenez ou partagez vos séances.</p>
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setShowSessionBuilder((prev) => !prev)
              setActiveSection('sessions')
            }}
          >
            {showSessionBuilder ? 'Fermer la création' : 'Créer une séance'}
          </button>
        </header>

        <div className="musculation-section-body">
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
