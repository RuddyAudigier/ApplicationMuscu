import ExerciseCard from './ExerciseCard'
import '../styles/ExerciseList.css'

export default function ExerciseList({
  exercises,
  onDeleteExercise,
  onUpdateExercise,
  onUpdateCoachNotes,
  onOpenExerciseDetails
}) {
  if (exercises.length === 0) {
    return (
      <div className="empty-state">
        <h3>Aucun exercice trouvé</h3>
        <p>Essayez une autre recherche ou ajoutez un nouvel exercice.</p>
      </div>
    )
  }

  return (
    <div className="exercise-list-wrapper">
      <div className="exercises-header">
        <h2>Exercices disponibles</h2>
        <p className="exercise-count">{exercises.length} exercice{exercises.length > 1 ? 's' : ''}</p>
      </div>
      <div className="exercise-list">
        {exercises.map((exercise) => (
          <ExerciseCard
            key={exercise.id}
            exercise={exercise}
            onDelete={onDeleteExercise}
            onUpdateExercise={onUpdateExercise}
            onUpdateCoachNotes={onUpdateCoachNotes}
            onOpenExerciseDetails={onOpenExerciseDetails}
          />
        ))}
      </div>
    </div>
  )
}
