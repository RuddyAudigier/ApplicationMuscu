import { useState } from 'react'
import '../styles/PerformanceTable.css'
import { calculateE1RM, roundE1RM } from '../utils/e1rm'
import { DEFAULT_VARIANT_NAME, normalizeVariants } from '../utils/variants'

export default function PerformanceTable({ performances, exercises = [], onOpenExerciseDetails, onViewProgress }) {
  const [variantFilterByExercise, setVariantFilterByExercise] = useState({})

  const formatWeightForExport = (weight) => {
    if (weight === null || weight === undefined || weight === '') {
      return ''
    }

    const value = Number(weight)
    if (!Number.isFinite(value)) {
      return ''
    }

    return String(Math.round(value * 100) / 100).replace('.', ',')
  }

  const copyVariantForExcel = async (rowsByReps, variantName) => {
    const lines = []
    for (let reps = 1; reps <= 30; reps += 1) {
      const perf = rowsByReps[reps]
      const weight = perf ? formatWeightForExport(perf.weight) : ''
      const date = perf?.date || ''
      lines.push(`${weight}\t${date}`)
    }

    const payload = lines.join('\n')

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(payload)
        alert(`Copié: ${variantName} (Poids + Date, 30 lignes).`)
        return
      }
    } catch (error) {
      console.error('Erreur copie presse-papiers:', error)
    }

    window.prompt('Copiez ce contenu (Poids + Date):', payload)
  }

  if (performances.length === 0) {
    return (
      <div className="empty-state">
        <h3>Aucune performance enregistrée</h3>
        <p>Lancez et complétez une séance pour enregistrer vos performances.</p>
      </div>
    )
  }

  const groupedPerformances = performances.reduce((acc, perf) => {
    if (!acc[perf.exerciseId]) {
      acc[perf.exerciseId] = {
        exerciseName: perf.exerciseName,
        items: []
      }
    }
    acc[perf.exerciseId].items.push(perf)
    return acc
  }, {})

  return (
    <div className="performance-table-wrapper">
      <h2>Tableau des performances</h2>

      {Object.entries(groupedPerformances).map(([exerciseId, exerciseGroup]) => {
        const perfs = exerciseGroup.items
        const exerciseData = exercises.find((exercise) => exercise.id === exerciseId)

        const exerciseVariants = normalizeVariants(
          exerciseData?.variants ||
          perfs.map((perf) => ({ name: perf.variantName || DEFAULT_VARIANT_NAME, isDefault: false })),
          exerciseId
        )

        const variantColumns = exerciseVariants.map((variant) => {
          const bestByReps = {}
          for (let reps = 1; reps <= 30; reps += 1) {
            bestByReps[reps] = null
          }

          perfs
            .filter((perf) => {
              const perfVariantKey = perf.variantId || perf.variantName || DEFAULT_VARIANT_NAME
              const variantKey = variant.id || variant.name
              return perfVariantKey === variantKey || perf.variantName === variant.name
            })
            .forEach((perf) => {
              const reps = parseInt(perf.reps, 10)
              if (!Number.isFinite(reps) || reps < 1 || reps > 30) {
                return
              }

              const existing = bestByReps[reps]
              if (!existing || perf.weight > existing.weight) {
                bestByReps[reps] = perf
                return
              }

              if (perf.weight === existing.weight) {
                const currentDate = new Date(perf.performanceDate || perf.date)
                const existingDate = new Date(existing.performanceDate || existing.date)
                if (currentDate > existingDate) {
                  bestByReps[reps] = perf
                }
              }
            })

          const selectedRows = { ...bestByReps }

          // Supprime visuellement les entrées obsolètes:
          // dominées par une autre ligne (plus lourd et/ou plus de reps).
          Object.entries(bestByReps).forEach(([repsKey, perf]) => {
            if (!perf) {
              return
            }

            const reps = Number(repsKey)
            const weight = Number(perf.weight)
            const isDominated = Object.entries(bestByReps).some(([otherRepsKey, otherPerf]) => {
              if (!otherPerf) {
                return false
              }
              const otherReps = Number(otherRepsKey)
              const otherWeight = Number(otherPerf.weight)

              const dominatesOnAxes = otherReps >= reps && otherWeight >= weight
              const strictOnOneAxis = otherReps > reps || otherWeight > weight

              return dominatesOnAxes && strictOnOneAxis
            })

            if (isDominated) {
              selectedRows[reps] = null
            }
          })

          return {
            variant,
            rowsByReps: selectedRows
          }
        })

        const selectedVariantFilter = variantFilterByExercise[exerciseId] || 'all'
        const displayedVariantColumns = selectedVariantFilter === 'all'
          ? variantColumns
          : variantColumns.filter(({ variant }) => ((variant.id || variant.name) === selectedVariantFilter))
        const sortedReps = Array.from({ length: 30 }, (_, index) => index + 1)

        return (
          <section key={exerciseId} className="performance-block">
            <div className="performance-block-header">
              <h3>
                <span className="exercise-header-actions">
                  <button
                    type="button"
                    className="exercise-link-button"
                    onClick={() => onOpenExerciseDetails?.(exerciseId)}
                    title={`Voir la fiche de ${exerciseGroup.exerciseName}`}
                  >
                    {exerciseGroup.exerciseName}
                  </button>
                  {onViewProgress && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-small exercise-progress-btn"
                      onClick={() => onViewProgress(exerciseId)}
                      title={`Voir la progression de ${exerciseGroup.exerciseName}`}
                    >
                      Graphique
                    </button>
                  )}
                </span>
              </h3>
              <div className="variant-filter-control">
                <label htmlFor={`variant-filter-${exerciseId}`}>Variante</label>
                <select
                  id={`variant-filter-${exerciseId}`}
                  value={selectedVariantFilter}
                  onChange={(e) => setVariantFilterByExercise((prev) => ({
                    ...prev,
                    [exerciseId]: e.target.value
                  }))}
                >
                  <option value="all">Toutes les variantes</option>
                  {variantColumns.map(({ variant }) => (
                    <option key={`${exerciseId}-filter-${variant.id || variant.name}`} value={variant.id || variant.name}>
                      {variant.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="performance-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th rowSpan={2}>Reps</th>
                    {displayedVariantColumns.map(({ variant }) => (
                      <th key={`${exerciseId}-${variant.id || variant.name}`} colSpan={3} className="variant-header">
                        <div className="variant-header-content">
                          <span>{variant.name}</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-small variant-copy-btn"
                            onClick={() => {
                              const targetVariant = variantColumns.find(
                                ({ variant: currentVariant }) => (currentVariant.id || currentVariant.name) === (variant.id || variant.name)
                              )
                              if (targetVariant) {
                                copyVariantForExcel(targetVariant.rowsByReps, variant.name)
                              }
                            }}
                            title="Copier 30 lignes: Poids + Date"
                          >
                            Copier Excel
                          </button>
                        </div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    {displayedVariantColumns.flatMap(({ variant }) => ([
                      <th key={`${exerciseId}-${variant.id || variant.name}-weight`} className="variant-col-start">Poids (kg)</th>,
                      <th key={`${exerciseId}-${variant.id || variant.name}-rpe`}>RPE</th>,
                      <th key={`${exerciseId}-${variant.id || variant.name}-date`}>Date</th>
                    ]))}
                  </tr>
                </thead>
                <tbody>
                  {sortedReps.map((reps) => {
                    return (
                      <tr key={`${exerciseId}-reps-${reps}`}>
                        <td>{reps}</td>
                        {displayedVariantColumns.flatMap(({ variant, rowsByReps }) => {
                          const perf = rowsByReps[reps]
                          return [
                            <td key={`${exerciseId}-${variant.id || variant.name}-${reps}-w`} className="variant-col-start">{perf?.weight ?? '-'}</td>,
                            <td key={`${exerciseId}-${variant.id || variant.name}-${reps}-r`}>
                              {perf?.rpe ? <span className={`rpe-chip rpe-${perf.rpe}`}>RPE {perf.rpe}</span> : '-'}
                            </td>,
                            <td key={`${exerciseId}-${variant.id || variant.name}-${reps}-d`}>{perf?.date ?? '-'}</td>
                          ]
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div className="exercise-summary">
              <strong>Total des séances:</strong> {new Set(perfs.map((p) => p.date)).size}
              {' · '}
              <strong>Meilleur e1RM:</strong> {roundE1RM(
                perfs.reduce((best, perf) => {
                  const e1rm = calculateE1RM(perf.weight, perf.reps)
                  return e1rm && e1rm > best ? e1rm : best
                }, 0)
              ) || 0} kg
            </div>
          </section>
        )
      })}

      <section className="global-stats">
        <h3>Statistiques globales</h3>
        <div className="global-grid">
          <div className="global-item">
            <span>Total de séries</span>
            <strong>{performances.length}</strong>
          </div>
          <div className="global-item">
            <span>Poids total levé (kg)</span>
            <strong>{Math.round(performances.reduce((sum, p) => sum + (p.reps * p.weight), 0) * 100) / 100}</strong>
          </div>
          <div className="global-item">
            <span>Reps totales</span>
            <strong>{performances.reduce((sum, p) => sum + p.reps, 0)}</strong>
          </div>
          <div className="global-item">
            <span>Exercices suivis</span>
            <strong>{new Set(performances.map((p) => p.exerciseName)).size}</strong>
          </div>
        </div>
      </section>
    </div>
  )
}
