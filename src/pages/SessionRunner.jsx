import { useEffect, useMemo, useState } from 'react'
import '../styles/SessionRunner.css'
import { DEFAULT_VARIANT_NAME, getDefaultVariant, normalizeVariants } from '../utils/variants'

function parseWeightValue(value) {
  if (value === null || value === undefined) {
    return null
  }

  const normalized = String(value).replace(',', '.').trim()
  if (!normalized) {
    return null
  }

  const parsed = Number.parseFloat(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed * 100) / 100
}

function buildSeriesState(session, initialSeriesData) {
  if (!session?.exercises?.length) {
    return {}
  }

  const built = {}

  session.exercises.forEach((exercise) => {
    const exerciseVariants = normalizeVariants(exercise?.variants, exercise?.id)
    const defaultVariant = getDefaultVariant(exerciseVariants, exercise.id)
    const previousSeries = initialSeriesData?.[exercise.id] || []

    if (previousSeries.length > 0) {
      built[exercise.id] = previousSeries.map((serie) => ({
        ...serie,
        rpe: String(serie?.rpe || '10'),
        validated: Boolean(serie?.validated),
        variantId: serie?.variantId || (defaultVariant.id || `name:${defaultVariant.name}`),
        variantName: serie?.variantName || defaultVariant.name || DEFAULT_VARIANT_NAME
      }))
      return
    }

    built[exercise.id] = Array.from({ length: exercise.series }).map(() => ({
      reps: '',
      weight: '',
      rpe: '10',
      validated: false,
      variantId: defaultVariant.id || `name:${defaultVariant.name}`,
      variantName: defaultVariant.name || DEFAULT_VARIANT_NAME
    }))
  })

  return built
}

export default function SessionRunner({
  session,
  performances = [],
  initialState,
  onProgressChange,
  onEndSession,
  onAbandonSession,
  onOpenExerciseDetails
}) {
  const [seriesData, setSeriesData] = useState(() => buildSeriesState(session, initialState?.seriesData))
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().split('T')[0]) // Date de la séance, modifiable pendant la séance

  const getExerciseVariants = (exercise) => normalizeVariants(exercise?.variants, exercise?.id)
  const getVariantSelectValue = (variant) => variant.id || `name:${variant.name}`

  useEffect(() => {
    setSeriesData(buildSeriesState(session, initialState?.seriesData))
  }, [session?.id])

  useEffect(() => {
    if (!session?.id || !onProgressChange || Object.keys(seriesData).length === 0) {
      return
    }

    onProgressChange({
      currentExerciseIndex: 0,
      seriesData
    })
  }, [seriesData, session, onProgressChange])

  const toSerieNumbers = (serie) => ({
    reps: parseInt(serie.reps, 10),
    weight: parseWeightValue(serie.weight)
  })

  const canValidateSerie = (serie) => {
    const reps = parseInt(serie.reps, 10)
    const weight = parseWeightValue(serie.weight)
    const rpe = parseInt(serie.rpe, 10)

    return Number.isFinite(reps) && reps > 0 && weight !== null && Number.isFinite(rpe) && rpe >= 6 && rpe <= 10
  }

  const isSerieValid = (serie) => Boolean(serie.validated && canValidateSerie(serie))
  const hasWeightAndReps = (serie) => (
    String(serie.reps ?? '').trim() !== '' && String(serie.weight ?? '').trim() !== ''
  )

  const handleSeriesChange = (exercise, serieIndex, field, value) => {
    if (field === 'variantId') {
      const variants = getExerciseVariants(exercise)
      const selectedVariant = variants.find((variant) => getVariantSelectValue(variant) === value) || getDefaultVariant(variants, exercise.id)

      setSeriesData((prev) => ({
        ...prev,
        [exercise.id]: (prev[exercise.id] || []).map((serie, idx) =>
          idx === serieIndex
            ? {
              ...serie,
              validated: false,
              variantId: getVariantSelectValue(selectedVariant),
              variantName: selectedVariant.name || DEFAULT_VARIANT_NAME
            }
            : serie
        )
      }))
      return
    }

    setSeriesData((prev) => ({
      ...prev,
      [exercise.id]: (prev[exercise.id] || []).map((serie, idx) =>
        idx === serieIndex
          ? { ...serie, [field]: value, validated: false }
          : serie
      )
    }))
  }

  const handleValidateSerie = (exerciseId, serieIndex) => {
    setSeriesData((prev) => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] || []).map((serie, idx) =>
        idx === serieIndex ? { ...serie, validated: canValidateSerie(serie) } : serie
      )
    }))
  }

  const handleUnlockSerie = (exerciseId, serieIndex) => {
    setSeriesData((prev) => ({
      ...prev,
      [exerciseId]: (prev[exerciseId] || []).map((serie, idx) =>
        idx === serieIndex ? { ...serie, validated: false } : serie
      )
    }))
  }

  const getRpeBadgeClass = (rpe) => {
    if (!rpe) return 'runner-rpe-badge runner-rpe-empty'
    return `runner-rpe-badge runner-rpe-${rpe}`
  }

  const getBestWeightForSameRepsBeforeSerie = (exerciseId, serie, serieIndex) => {
    const { reps } = toSerieNumbers(serie)
    if (!Number.isFinite(reps) || reps <= 0) {
      return 0
    }

    const sessionBestBefore = (seriesData[exerciseId] || [])
      .slice(0, serieIndex)
      .reduce((best, previousSerie) => {
        const previous = toSerieNumbers(previousSerie)
        const sameVariant = (
          (previousSerie.variantId || '') === (serie.variantId || '') ||
          (previousSerie.variantName || '').toLocaleLowerCase('fr-FR') === (serie.variantName || '').toLocaleLowerCase('fr-FR')
        )
        if (
          !isSerieValid(previousSerie) ||
          !sameVariant ||
          previous.reps !== reps ||
          !Number.isFinite(previous.weight) ||
          previous.weight <= 0
        ) {
          return best
        }

        return Math.max(best, previous.weight)
      }, 0)

    const historyForVariantAndReps = performances
      .filter((performance) => performance.exerciseId === exerciseId)
      .filter((performance) => (
        (performance.variantId || '') === (serie.variantId || '') ||
        (performance.variantName || '').toLocaleLowerCase('fr-FR') === (serie.variantName || '').toLocaleLowerCase('fr-FR')
      ))
      .reduce((best, performance) => (
        performance.reps === reps ? Math.max(best, performance.weight || 0) : best
      ), 0)

    return Math.max(historyForVariantAndReps, sessionBestBefore)
  }

  const isSerieRepPR = (exerciseId, serie, serieIndex) => {
    const { weight } = toSerieNumbers(serie)
    if (!Number.isFinite(weight) || weight <= 0) {
      return false
    }

    const baseline = getBestWeightForSameRepsBeforeSerie(exerciseId, serie, serieIndex)
    return weight > (baseline + 0.01)
  }

  const recordPulseBySerie = useMemo(() => {
    const nextPulse = {}

    session?.exercises?.forEach((exercise) => {
      ; (seriesData[exercise.id] || []).forEach((serie, index) => {
        const key = `${exercise.id}-${index}`
        if (isSerieRepPR(exercise.id, serie, index)) {
          nextPulse[key] = true
        }
      })
    })

    return nextPulse
  }, [seriesData, session, performances])

  const progress = useMemo(() => {
    if (!session?.exercises?.length) return 0

    const totalSeries = session.exercises.reduce((sum, exercise) => sum + exercise.series, 0)
    const completedSeries = session.exercises.reduce((sum, exercise) => {
      const done = (seriesData[exercise.id] || []).filter(isSerieValid).length
      return sum + done
    }, 0)

    if (totalSeries === 0) return 0
    return Math.round((completedSeries / totalSeries) * 100)
  }, [seriesData, session])

  const handleFinishSession = () => {
    const sessionDateISO = sessionDate // Utiliser la date choisie pendant la séance
    const incompleteSeries = []

    session.exercises.forEach((exercise) => {
      ; (seriesData[exercise.id] || []).forEach((serie, index) => {
        if (!isSerieValid(serie)) {
          incompleteSeries.push(`${exercise.name} - Série ${index + 1}`)
        }
      })
    })

    let allowIncomplete = false
    if (incompleteSeries.length > 0) {
      allowIncomplete = window.confirm(
        `Il y a ${incompleteSeries.length} série(s) non validée(s).\n` +
        'Si vous continuez, elles seront enregistrées avec 0 répétition et poids null.\n\n' +
        'Continuer ?'
      )

      if (!allowIncomplete) {
        return
      }
    }

    const performanceData = []
    session.exercises.forEach((exercise) => {
      ; (seriesData[exercise.id] || []).forEach((serie, index) => {
        if (isSerieValid(serie)) {
          performanceData.push({
            id: Date.now() + Math.random(),
            exerciseName: exercise.name,
            reps: parseInt(serie.reps, 10),
            weight: parseWeightValue(serie.weight),
            rpe: parseInt(serie.rpe, 10),
            variantId: (serie.variantId || '').startsWith('name:') ? null : (serie.variantId || null),
            variantName: serie.variantName || DEFAULT_VARIANT_NAME,
            date: sessionDateISO,
            performanceDate: sessionDateISO,
            exerciseId: exercise.id,
            serieNumber: index + 1,
            sessionName: session.name
          })
          return
        }

        if (allowIncomplete) {
          performanceData.push({
            id: Date.now() + Math.random(),
            exerciseName: exercise.name,
            reps: 0,
            weight: null,
            rpe: parseInt(serie.rpe, 10) || 10,
            variantId: (serie.variantId || '').startsWith('name:') ? null : (serie.variantId || null),
            variantName: serie.variantName || DEFAULT_VARIANT_NAME,
            date: sessionDateISO,
            performanceDate: sessionDateISO,
            exerciseId: exercise.id,
            serieNumber: index + 1,
            sessionName: session.name
          })
        }
      })
    })

    onEndSession(performanceData)
  }

  if (!session?.exercises?.length) {
    return null
  }

  return (
    <div className="session-runner">
      <div className="runner-card">
        <h2>{session.name}</h2>
        <div className="session-date-selector">
          <label htmlFor="session-date">Date de la séance:</label>
          <input
            id="session-date"
            type="date"
            value={sessionDate}
            onChange={(e) => setSessionDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]} // Empêcher les dates futures
          />
          <small>Cette date sera utilisée pour détecter tes records personnels</small>
        </div>
        <p>{session.exercises.length} exercice(s) sur cette page</p>
        <div className="runner-progress-track">
          <div className="runner-progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <span className="runner-progress-label">{progress}% complété</span>
      </div>

      <div className="runner-exercises-list">
        {session.exercises.map((exercise) => {
          const exerciseVariants = getExerciseVariants(exercise)

          return (
            <div key={exercise.id} className="runner-card">
              <h3>
                <button
                  type="button"
                  className="exercise-link-button"
                  onClick={() => onOpenExerciseDetails?.(exercise.id)}
                  title={`Voir la fiche de ${exercise.name}`}
                >
                  {exercise.name}
                </button>
              </h3>
              {exercise.coachNotes && (
                <div className="runner-coach-notes">
                  <p className="runner-coach-title">Remarques coach</p>
                  <p className="runner-coach-content">{exercise.coachNotes}</p>
                </div>
              )}

              <div className="runner-muscles">
                {exercise.muscleGroups?.map((group) => (
                  <span key={group} className="muscle-group">{group}</span>
                ))}
              </div>

              <h4>Séries: {exercise.series}</h4>

              <div className="runner-series-list">
                {(seriesData[exercise.id] || []).map((serie, index) => (
                  <div
                    key={`${exercise.id}-${index}`}
                    className={`runner-serie-item ${isSerieValid(serie) ? 'done' : ''}`}
                  >
                    <div className="runner-serie-fields">
                      <label>Série {index + 1}</label>
                      <select
                        value={serie.variantId || ''}
                        onChange={(e) => handleSeriesChange(exercise, index, 'variantId', e.target.value)}
                        aria-label={`Variante série ${index + 1}`}
                        disabled={Boolean(serie.validated)}
                      >
                        {exerciseVariants.map((variant) => (
                          <option key={variant.id || variant.name} value={getVariantSelectValue(variant)}>
                            {variant.name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={serie.reps}
                        onChange={(e) => handleSeriesChange(exercise, index, 'reps', e.target.value)}
                        placeholder="Reps"
                        disabled={Boolean(serie.validated)}
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={serie.weight}
                        onChange={(e) => handleSeriesChange(exercise, index, 'weight', e.target.value)}
                        placeholder="Poids (kg)"
                        disabled={Boolean(serie.validated)}
                      />
                      <select
                        value={serie.rpe}
                        onChange={(e) => handleSeriesChange(exercise, index, 'rpe', e.target.value)}
                        className={getRpeBadgeClass(serie.rpe)}
                        aria-label={`RPE série ${index + 1}`}
                        disabled={Boolean(serie.validated)}
                      >
                        <option value="6">RPE 6</option>
                        <option value="7">RPE 7</option>
                        <option value="8">RPE 8</option>
                        <option value="9">RPE 9</option>
                        <option value="10">RPE 10</option>
                      </select>
                    </div>

                    <div className="runner-serie-actions">
                      {serie.validated ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => handleUnlockSerie(exercise.id, index)}
                        >
                          Modifier
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-primary btn-small"
                          onClick={() => handleValidateSerie(exercise.id, index)}
                          disabled={!canValidateSerie(serie)}
                          title="Valider la série"
                        >
                          ✓
                        </button>
                      )}
                    </div>

                    {hasWeightAndReps(serie) && isSerieRepPR(exercise.id, serie, index) && (
                      <div className={`runner-serie-meta ${recordPulseBySerie[`${exercise.id}-${index}`] ? 'runner-pr-animate' : ''}`}>
                        <span className="runner-record-banner">
                          Record battu sur {toSerieNumbers(serie).reps} reps ({serie.variantName || DEFAULT_VARIANT_NAME})
                        </span>
                      </div>
                    )}

                    {isSerieValid(serie) && <span className="runner-complete">Complété</span>}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="runner-actions">
        <button className="btn btn-primary" onClick={handleFinishSession}>
          Terminer la séance
        </button>
      </div>

      <button className="btn btn-danger" onClick={onAbandonSession}>
        Abandonner la séance
      </button>
    </div>
  )
}
