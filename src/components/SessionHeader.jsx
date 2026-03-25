import '../../styles/SessionHeader.css'

function SessionHeader({ exerciseName, currentIndex, totalExercises, progressPercent = 0 }) {
  return (
    <div className="session-header">
      <div className="session-header-info">
        <h2 className="session-exercise-name">{exerciseName || 'Exercice'}</h2>
        <p className="session-exercise-counter">{currentIndex + 1} sur {totalExercises}</p>
      </div>
      
      <div className="session-progress-bar-container">
        <div className="session-progress-bar">
          <div 
            className="session-progress-fill"
            style={{ width: `${Math.min(progressPercent, 100)}%` }}
          />
        </div>
        <span className="session-progress-text">{Math.round(progressPercent)}%</span>
      </div>
    </div>
  )
}

export default SessionHeader
