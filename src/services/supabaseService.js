import { supabase } from '../supabase'
import { normalizeMuscleGroups } from '../utils/muscleGroups'
import { DEFAULT_VARIANT_NAME, normalizeVariants } from '../utils/variants'

function normalizeWeight(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalized = String(value ?? '').replace(',', '.').trim()
  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * 100) / 100
}

// ===== EXERCICES =====
export const exercisesService = {
  // Ajouter un exercice
  async addExercise(exerciseData) {
    try {
      // Insérer l'exercice
      const { data: exercise, error: exerciseError } = await supabase
        .from('exercises')
        .insert([{
          name: exerciseData.name,
          description: exerciseData.description,
          is_custom: exerciseData.isCustom || true
        }])
        .select()
        .single()

      if (exerciseError) throw exerciseError

      // Insérer les groupes musculaires
      if (exerciseData.muscleGroups && exerciseData.muscleGroups.length > 0) {
        const muscleGroupsData = exerciseData.muscleGroups.map(muscle => ({
          exercise_id: exercise.id,
          muscle_group: muscle
        }))

        const { error: muscleError } = await supabase
          .from('muscle_groups')
          .insert(muscleGroupsData)

        if (muscleError) throw muscleError
      }

      const normalizedVariants = normalizeVariants(exerciseData.variants, exercise.id)
      const variantsPayload = normalizedVariants.map((variant) => ({
        exercise_id: exercise.id,
        name: variant.name,
        is_default: variant.isDefault
      }))

      const { error: variantsError } = await supabase
        .from('exercise_variants')
        .insert(variantsPayload)

      if (variantsError && variantsError.code !== '42P01') throw variantsError

      return {
        id: exercise.id,
        ...exerciseData,
        variants: normalizedVariants
      }
    } catch (error) {
      console.error('Erreur ajout exercice:', error)
      throw error
    }
  },

  // Récupérer tous les exercices
  async getExercises() {
    try {
      const { data, error } = await supabase
        .from('exercises_with_muscles')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      const exerciseIds = data.map((exercise) => exercise.id)
      let variantsByExerciseId = {}

      if (exerciseIds.length > 0) {
        const { data: variants, error: variantsError } = await supabase
          .from('exercise_variants')
          .select('id, exercise_id, name, is_default')
          .in('exercise_id', exerciseIds)
          .order('created_at', { ascending: true })

        if (!variantsError && variants) {
          variantsByExerciseId = variants.reduce((acc, variant) => {
            const existing = acc[variant.exercise_id] || []
            return {
              ...acc,
              [variant.exercise_id]: [
                ...existing,
                {
                  id: variant.id,
                  exerciseId: variant.exercise_id,
                  name: variant.name,
                  isDefault: variant.is_default
                }
              ]
            }
          }, {})
        }
      }

      return data.map(ex => ({
        id: ex.id,
        name: ex.name,
        description: ex.description,
        muscleGroups: normalizeMuscleGroups(ex.muscle_groups),
        variants: normalizeVariants(variantsByExerciseId[ex.id], ex.id),
        isCustom: ex.is_custom,
        createdAt: ex.created_at
      }))
    } catch (error) {
      console.error('Erreur récupération exercices:', error)
      return []
    }
  },

  // Supprimer un exercice
  async deleteExercise(id) {
    try {
      const { error } = await supabase
        .from('exercises')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Erreur suppression exercice:', error)
      throw error
    }
  },

  // Mettre à jour un exercice
  async updateExercise(id, data) {
    try {
      const cleanedMuscleGroups = normalizeMuscleGroups(data.muscleGroups || [])
      const cleanedVariants = normalizeVariants(data.variants, id)
      const cleanedName = (data.name || '').trim()

      if (!cleanedName) {
        throw new Error("Le nom de l'exercice est requis.")
      }

      const updatePayload = {
        name: cleanedName,
        description: data.description
      }

      let { error } = await supabase
        .from('exercises')
        .update({
          ...updatePayload,
          updated_at: new Date()
        })
        .eq('id', id)

      // Compatibilité avec anciennes bases où updated_at n'existe pas.
      const missingUpdatedAt =
        error &&
        (
          error.code === '42703' ||
          error.message?.toLowerCase().includes('updated_at')
        )

      if (missingUpdatedAt) {
        const retry = await supabase
          .from('exercises')
          .update(updatePayload)
          .eq('id', id)
        error = retry.error
      }

      if (error) throw error

      const { error: deleteMusclesError } = await supabase
        .from('muscle_groups')
        .delete()
        .eq('exercise_id', id)

      if (deleteMusclesError) throw deleteMusclesError

      if (cleanedMuscleGroups.length > 0) {
        const muscleGroupsData = cleanedMuscleGroups.map((muscle) => ({
          exercise_id: id,
          muscle_group: muscle
        }))

        const { error: insertMusclesError } = await supabase
          .from('muscle_groups')
          .insert(muscleGroupsData)

        if (insertMusclesError) throw insertMusclesError
      }

      // Synchronisation des variantes:
      // si la migration variantes n'est pas appliquée, on n'empêche pas la modif nom/description.
      try {
        const { data: existingVariants, error: existingVariantsError } = await supabase
          .from('exercise_variants')
          .select('id, name, is_default')
          .eq('exercise_id', id)

        if (!existingVariantsError && existingVariants) {
          const nextVariantsById = new Map(cleanedVariants.filter((variant) => variant.id).map((variant) => [variant.id, variant]))
          const existingIds = existingVariants.map((variant) => variant.id)
          const variantsToDelete = existingIds.filter((existingId) => !nextVariantsById.has(existingId))

          if (variantsToDelete.length > 0) {
            const { error: deleteVariantsError } = await supabase
              .from('exercise_variants')
              .delete()
              .in('id', variantsToDelete)

            if (deleteVariantsError) throw deleteVariantsError
          }

          for (const variant of cleanedVariants) {
            if (variant.id) {
              const { error: updateVariantError } = await supabase
                .from('exercise_variants')
                .update({
                  name: variant.name,
                  is_default: variant.isDefault
                })
                .eq('id', variant.id)

              if (updateVariantError) throw updateVariantError
            } else {
              const { error: insertVariantError } = await supabase
                .from('exercise_variants')
                .insert([{
                  exercise_id: id,
                  name: variant.name,
                  is_default: variant.isDefault
                }])

              if (insertVariantError) throw insertVariantError
            }
          }
        } else if (existingVariantsError) {
          const isSchemaGap =
            existingVariantsError.code === '42P01' ||
            existingVariantsError.code === '42703' ||
            existingVariantsError.code === 'PGRST204' ||
            existingVariantsError.message?.toLowerCase().includes('exercise_variants')

          if (!isSchemaGap) {
            throw existingVariantsError
          }
        }
      } catch (variantsError) {
        const isSchemaGap =
          variantsError?.code === '42P01' ||
          variantsError?.code === '42703' ||
          variantsError?.code === 'PGRST204' ||
          variantsError?.message?.toLowerCase().includes('exercise_variants')

        if (!isSchemaGap) {
          throw variantsError
        }

        console.warn('Sync variantes ignorée (migration SQL manquante):', variantsError)
      }
    } catch (error) {
      console.error('Erreur mise à jour exercice:', error)
      throw error
    }
  }
}

// ===== SÉANCES =====
export const sessionsService = {
  // Ajouter une séance
  async addSession(sessionData) {
    try {
      // Insérer la séance
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert([{
          name: sessionData.name
        }])
        .select()
        .single()

      if (sessionError) throw sessionError

      // Insérer les exercices de la séance
      if (sessionData.exercises && sessionData.exercises.length > 0) {
        const sessionExercisesData = sessionData.exercises.map(ex => ({
          session_id: session.id,
          exercise_id: ex.id,
          series_count: ex.series
        }))

        const { error: exercisesError } = await supabase
          .from('session_exercises')
          .insert(sessionExercisesData)

        if (exercisesError) throw exercisesError
      }

      return { id: session.id, ...sessionData }
    } catch (error) {
      console.error('Erreur ajout séance:', error)
      throw error
    }
  },

  // Récupérer toutes les séances
  async getSessions() {
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .order('created_at', { ascending: false })

      if (sessionsError) throw sessionsError

      // Pour chaque séance, récupérer les exercices
      const sessionsWithExercises = await Promise.all(
        sessions.map(async (session) => {
          const { data: sessionExercises } = await supabase
            .from('session_exercises')
            .select('exercise_id, series_count, exercises(*)')
            .eq('session_id', session.id)

          return {
            id: session.id,
            name: session.name,
            createdAt: new Date(session.created_at).toLocaleDateString('fr-FR'),
            exercises: sessionExercises.map(se => ({
              id: se.exercise_id,
              name: se.exercises.name,
              muscleGroups: [], // À récupérer si nécessaire
              series: se.series_count
            }))
          }
        })
      )

      return sessionsWithExercises
    } catch (error) {
      console.error('Erreur récupération séances:', error)
      return []
    }
  },

  // Supprimer une séance
  async deleteSession(id) {
    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Erreur suppression séance:', error)
      throw error
    }
  }
}

// ===== PERFORMANCES =====
export const performancesService = {
  async cleanupObsoletePerformances(performanceDataArray) {
    const uniqueGroups = new Map()

    performanceDataArray.forEach((perf) => {
      const exerciseId = perf.exerciseId
      const variantId = perf.variantId || null
      const variantName = perf.variantName || DEFAULT_VARIANT_NAME

      if (!exerciseId) {
        return
      }

      const key = `${exerciseId}::${variantId || 'null'}::${variantName}`
      if (!uniqueGroups.has(key)) {
        uniqueGroups.set(key, { exerciseId, variantId, variantName })
      }
    })

    for (const group of uniqueGroups.values()) {
      let query = supabase
        .from('performances')
        .select('id, reps, weight, performance_date, created_at')
        .eq('exercise_id', group.exerciseId)

      if (group.variantId) {
        query = query.eq('variant_id', group.variantId)
      } else {
        query = query
          .is('variant_id', null)
          .eq('variant_name', group.variantName)
      }

      const { data: rows, error } = await query

      if (error || !rows || rows.length < 2) {
        continue
      }

      const normalizedRows = rows
        .map((row) => ({
          ...row,
          reps: Number(row.reps),
          weight: Number(row.weight),
          timestamp: new Date(row.performance_date || row.created_at || 0).getTime()
        }))
        .filter((row) => Number.isFinite(row.reps) && row.reps > 0 && Number.isFinite(row.weight) && row.weight > 0)

      if (normalizedRows.length < 2) {
        continue
      }

      const idsToDelete = new Set()

      // 1) Dédupliquer les points identiques (même poids + mêmes reps): garder le plus récent.
      const samePointGroups = new Map()
      normalizedRows.forEach((row) => {
        const pointKey = `${row.reps}::${row.weight}`
        if (!samePointGroups.has(pointKey)) {
          samePointGroups.set(pointKey, [])
        }
        samePointGroups.get(pointKey).push(row)
      })

      samePointGroups.forEach((samePointRows) => {
        if (samePointRows.length <= 1) {
          return
        }

        const sorted = [...samePointRows].sort((a, b) => b.timestamp - a.timestamp)
        sorted.slice(1).forEach((row) => idsToDelete.add(row.id))
      })

      // 2) Ne pas supprimer les perfs "dominees" entre reps differentes.
      // On conserve l'historique complet pour permettre les comparaisons
      // PR hybrides (rep inferieure la plus proche).

      if (idsToDelete.size === 0) {
        continue
      }

      const { error: deleteError } = await supabase
        .from('performances')
        .delete()
        .in('id', Array.from(idsToDelete))

      if (deleteError) {
        console.warn('Nettoyage des performances obsolètes ignoré:', deleteError)
      }
    }
  },

  // Ajouter des performances
  async addPerformances(performanceDataArray) {
    try {
      const today = new Date().toISOString().split('T')[0]
      const isIncompleteSerie = (perf) => {
        const reps = Number(perf?.reps)
        const weight = normalizeWeight(perf?.weight)
        return reps === 0 && weight === null
      }

      const hasInvalidEntry = performanceDataArray.some((perf) => {
        const reps = Number(perf?.reps)
        const weight = normalizeWeight(perf?.weight)
        const isIncomplete = isIncompleteSerie(perf)
        if (isIncomplete) {
          return false
        }

        return !Number.isFinite(reps) || reps <= 0 || weight === null
      })

      if (hasInvalidEntry) {
        throw new Error('Entrée performance invalide: mets reps > 0 avec un poids >= 0, ou reps=0 et poids vide pour une série non complétée.')
      }

      const performancesFormatted = performanceDataArray.map((perf) => {
        const isIncomplete = isIncompleteSerie(perf)
        return {
        exercise_id: perf.exerciseId,
        exercise_name: perf.exerciseName,
        session_name: perf.sessionName,
        reps: isIncomplete ? 0 : Number(perf.reps),
        weight: isIncomplete ? null : normalizeWeight(perf.weight),
        rpe: perf.rpe ?? 10,
        variant_id: perf.variantId || null,
        variant_name: perf.variantName || DEFAULT_VARIANT_NAME,
        series_number: perf.serieNumber,
        performance_date: perf.performanceDate || today
        }
      })

      const { error } = await supabase
        .from('performances')
        .insert(performancesFormatted)

      if (!error) {
        await this.cleanupObsoletePerformances(performanceDataArray)
        return
      }

      const shouldRetryWithoutRpe =
        error.code === 'PGRST204' ||
        error.code === '42703' ||
        error.message?.toLowerCase().includes('rpe') ||
        error.message?.toLowerCase().includes('variant')

      if (!shouldRetryWithoutRpe) {
        throw error
      }

      const legacyPerformancesFormatted = performanceDataArray.map((perf) => {
        const isIncomplete = isIncompleteSerie(perf)
        return {
        exercise_id: perf.exerciseId,
        exercise_name: perf.exerciseName,
        session_name: perf.sessionName,
        reps: isIncomplete ? 0 : Number(perf.reps),
        weight: isIncomplete ? null : normalizeWeight(perf.weight),
        series_number: perf.serieNumber,
        performance_date: perf.performanceDate || today
        }
      })

      const { error: legacyError } = await supabase
        .from('performances')
        .insert(legacyPerformancesFormatted)

      if (legacyError) throw legacyError

      await this.cleanupObsoletePerformances(performanceDataArray)
      return
    } catch (error) {
      console.error('Erreur ajout performances:', error)
      throw error
    }
  },

  // Récupérer toutes les performances
  async getPerformances() {
    try {
      const { data, error } = await supabase
        .from('performances')
        .select('*')
        .order('created_at', { ascending: false })
        .order('performance_date', { ascending: false })

      if (error) throw error

      return data.map(p => ({
        id: p.id,
        exerciseName: p.exercise_name,
        reps: Number(p.reps),
        weight: p.weight !== null ? Number(p.weight) : null,
        rpe: p.rpe !== null ? Number(p.rpe) : null,
        variantId: p.variant_id ?? null,
        variantName: p.variant_name || DEFAULT_VARIANT_NAME,
        performanceDate: p.performance_date,
        createdAt: p.created_at ?? null,
        date: new Date(p.performance_date).toLocaleDateString('fr-FR'),
        exerciseId: p.exercise_id,
        serieNumber: p.series_number,
        sessionName: p.session_name
      }))
    } catch (error) {
      console.error('Erreur récupération performances:', error)
      return []
    }
  },

  // Récupérer les performances d'un exercice
  async getPerformancesByExercise(exerciseId) {
    try {
      const { data, error } = await supabase
        .from('performances')
        .select('*')
        .eq('exercise_id', exerciseId)
        .order('created_at', { ascending: false })
        .order('performance_date', { ascending: false })

      if (error) throw error

      return data
    } catch (error) {
      console.error('Erreur récupération performances:', error)
      return []
    }
  },

  // Supprimer une performance
  async deletePerformance(id) {
    try {
      const { error } = await supabase
        .from('performances')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Erreur suppression performance:', error)
      throw error
    }
  },

  async deletePerformancesBySessionAndDate(sessionName, performanceDateIso) {
    try {
      if (!sessionName) {
        throw new Error('Nom de séance manquant.')
      }
      if (!performanceDateIso) {
        throw new Error('Date de séance manquante.')
      }

      const { error } = await supabase
        .from('performances')
        .delete()
        .eq('session_name', sessionName)
        .eq('performance_date', performanceDateIso)

      if (error) throw error
    } catch (error) {
      console.error('Erreur suppression dernier entrainement:', error)
      throw error
    }
  },

  async deletePerformancesBySessionName(sessionName) {
    try {
      if (!sessionName) {
        throw new Error('Nom de séance manquant.')
      }

      const { error } = await supabase
        .from('performances')
        .delete()
        .eq('session_name', sessionName)

      if (error) throw error
    } catch (error) {
      console.error('Erreur suppression performances séance:', error)
      throw error
    }
  }
}

// ===== REMARQUES DU COACH =====
export const coachNotesService = {
  // Ajouter/Mettre à jour une remarque
  async saveCoachNotes(exerciseId, notes) {
    try {
      // Vérifier si une remarque existe
      const { data: existing } = await supabase
        .from('coach_notes')
        .select('id')
        .eq('exercise_id', exerciseId)
        .single()

      if (existing) {
        // Mettre à jour
        const { error } = await supabase
          .from('coach_notes')
          .update({
            notes: notes,
            updated_at: new Date()
          })
          .eq('exercise_id', exerciseId)

        if (error) throw error
      } else {
        // Créer
        const { error } = await supabase
          .from('coach_notes')
          .insert([{
            exercise_id: exerciseId,
            notes: notes
          }])

        if (error) throw error
      }
    } catch (error) {
      console.error('Erreur sauvegarde remarques:', error)
      throw error
    }
  },

  // Récupérer les remarques d'un exercice
  async getCoachNotes(exerciseId) {
    try {
      const { data, error } = await supabase
        .from('coach_notes')
        .select('notes')
        .eq('exercise_id', exerciseId)
        .single()

      if (error && error.code !== 'PGRST116') throw error // PGRST116 = no rows

      return data?.notes || ''
    } catch (error) {
      console.error('Erreur récupération remarques:', error)
      return ''
    }
  }
}

// ===== PARTAGE PUBLIC DE SÉANCE =====
export const sharedSessionsService = {
  async createSharedSession(payload) {
    try {
      const { data, error } = await supabase
        .from('shared_sessions')
        .insert([{
          payload
        }])
        .select('id')
        .single()

      if (error) throw error

      return data.id
    } catch (error) {
      console.error('Erreur création partage séance:', error)
      throw error
    }
  },

  async getSharedSession(sharedId) {
    try {
      const { data, error } = await supabase
        .from('shared_sessions')
        .select('payload')
        .eq('id', sharedId)
        .single()

      if (error) throw error

      return data?.payload || null
    } catch (error) {
      console.error('Erreur récupération partage séance:', error)
      return null
    }
  }
}

// ===== CONSEILS GENERAUX =====
const GENERAL_ADVICE_SINGLETON_ID = 1

function normalizeGeneralAdvicePayload(payload) {
  return {
    training: String(payload?.training || ''),
    nutrition: String(payload?.nutrition || ''),
    sleep: String(payload?.sleep || '')
  }
}

export const generalAdviceService = {
  async getGeneralAdvice() {
    try {
      const { data, error } = await supabase
        .from('general_advice')
        .select('training_notes, nutrition_notes, sleep_notes')
        .eq('id', GENERAL_ADVICE_SINGLETON_ID)
        .single()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      if (!data) {
        return null
      }

      return normalizeGeneralAdvicePayload({
        training: data.training_notes,
        nutrition: data.nutrition_notes,
        sleep: data.sleep_notes
      })
    } catch (error) {
      console.error('Erreur récupération conseils généraux:', error)
      return null
    }
  },

  async saveGeneralAdvice(advice) {
    try {
      const normalized = normalizeGeneralAdvicePayload(advice)
      const payload = {
        id: GENERAL_ADVICE_SINGLETON_ID,
        training_notes: normalized.training,
        nutrition_notes: normalized.nutrition,
        sleep_notes: normalized.sleep,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('general_advice')
        .upsert([payload], { onConflict: 'id' })

      if (error) throw error
    } catch (error) {
      console.error('Erreur sauvegarde conseils généraux:', error)
      throw error
    }
  }
}
