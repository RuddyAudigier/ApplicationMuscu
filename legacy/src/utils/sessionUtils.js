/**
 * Session utilities (Single Responsibility: construction et normalisation des séances)
 */

import { normalizeMuscleGroups } from './muscleGroups'
import { normalizeVariants } from './variants'

export const SessionBuilder = {
  /**
   * Build session with enriched exercise details
   */
  buildWithDetails(session, allExercises) {
    return {
      ...session,
      exercises: session.exercises.map((sessionExercise) => {
        const details = allExercises.find((exercise) => exercise.id === sessionExercise.id)
        return {
          ...sessionExercise,
          muscleGroups: normalizeMuscleGroups(details?.muscleGroups || sessionExercise.muscleGroups || []),
          variants: normalizeVariants(details?.variants || sessionExercise.variants, sessionExercise.id),
          coachNotes: details?.coachNotes || ''
        }
      })
    }
  }
}
