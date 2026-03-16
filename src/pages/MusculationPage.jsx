import { useEffect, useState } from 'react'
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
  const [activeTab, setActiveTab] = useState('exercises')
  const [filteredExercises, setFilteredExercises] = useState(exercises)
  const [showSessionBuilder, setShowSessionBuilder] = useState(false)

  useEffect(() => {
    setFilteredExercises(exercises)
  }, [exercises])

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

      <GeneralAdviceBoard title="Conseils généraux (entrainement, nutrition, sommeil)" />

      <div className="tabs-container">
        <div className="tabs">
          <button
            className={`tab-button ${activeTab === 'exercises' ? 'active' : ''}`}
            onClick={() => setActiveTab('exercises')}
          >
            Exercices
          </button>
          <button
            className={`tab-button ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            Séances
          </button>
        </div>
      </div>

      <div className="tab-content">
        {activeTab === 'exercises' && (
          <div className="exercises-section">
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
        )}

        {activeTab === 'sessions' && (
          <div className="sessions-section">
            <div className="sessions-toolbar">
              <button
                className="btn btn-primary"
                onClick={() => setShowSessionBuilder(!showSessionBuilder)}
              >
                {showSessionBuilder ? 'Fermer la création' : 'Créer une séance'}
              </button>
            </div>
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
        )}
      </div>
    </div>
  )
}
