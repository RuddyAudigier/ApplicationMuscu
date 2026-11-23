import { useEffect } from 'react'
import PerformanceTable from './PerformanceTable'
import { normalizeMuscleGroups } from '../utils/muscleGroups'
import { normalizeVariants } from '../utils/variants'
import MuscleMap from './MuscleMap'
import '../styles/ExerciseDetailsModal.css'

export default function ExerciseDetailsModal({ exercise, performances = [], onClose }) {
  useEffect(() => {
    if (!exercise) {
      return
    }

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose?.()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [exercise, onClose])

  if (!exercise) {
    return null
  }

  const muscleGroups = normalizeMuscleGroups(exercise.muscleGroups)
  const variants = normalizeVariants(exercise.variants, exercise.id)

  return (
    <div className="exercise-modal-overlay" onClick={() => onClose?.()}>
      <div className="exercise-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="exercise-modal-header">
          <div>
            <h2>{exercise.name}</h2>
            <p>Fiche complète de l&apos;exercice</p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => onClose?.()}>
            Fermer
          </button>
        </div>

        <section className="exercise-modal-section">
          <h3>Description</h3>
          <p>{exercise.description || 'Aucune description.'}</p>
        </section>

        <section className="exercise-modal-section">
          <h3>Groupes musculaires</h3>
          <MuscleMap muscleGroups={muscleGroups} label={`Muscles travaillés: ${exercise.name}`} />
          <div>
            {muscleGroups.length > 0 ? (
              muscleGroups.map((group) => (
                <span key={group} className="muscle-group">{group}</span>
              ))
            ) : (
              <span>Aucun groupe renseigné.</span>
            )}
          </div>
        </section>

        <section className="exercise-modal-section">
          <h3>Variantes</h3>
          <ul className="exercise-modal-variants">
            {variants.map((variant) => (
              <li key={variant.id || variant.name}>
                <strong>{variant.name}</strong>
                {variant.isDefault ? ' (base)' : ''}
              </li>
            ))}
          </ul>
        </section>

        <section className="exercise-modal-section">
          <h3>Performances</h3>
          {performances.length > 0 ? (
            <PerformanceTable performances={performances} exercises={[exercise]} />
          ) : (
            <p>Aucune performance enregistrée pour cet exercice.</p>
          )}
        </section>
      </div>
    </div>
  )
}
