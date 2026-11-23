import '../../styles/ExerciseWorkoutCard.css'

function ExerciseWorkoutCard({ 
  exercise, 
  currentSerieIndex, 
  totalSeries,
  isPR = false 
}) {
  if (!exercise) {
    return null
  }

  return (
    <div className="exercise-workout-card">
      <div className="exercise-header">
        <h3 className="exercise-name">{exercise.name}</h3>
        {exercise.variants?.[0]?.name && (
          <span className="exercise-variant">{exercise.variants[0].name}</span>
        )}
      </div>

      <div className="exercise-meta">
        <div className="meta-item">
          <span className="meta-label">Set</span>
          <span className="meta-value">{currentSerieIndex + 1}/{totalSeries}</span>
        </div>
        
        {exercise.coachNotes && (
          <div className="meta-item">
            <span className="meta-label">Notes</span>
            <p className="meta-notes">{exercise.coachNotes}</p>
          </div>
        )}
      </div>

      {isPR && (
        <div className="exercise-pr-badge">
          <span className="pr-icon">🎉</span>
          <span className="pr-text">Personal Record!</span>
        </div>
      )}
    </div>
  )
}

export default ExerciseWorkoutCard
