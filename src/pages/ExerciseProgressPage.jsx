import { useEffect, useMemo, useState } from 'react'
import '../styles/ExerciseProgressPage.css'
import { calculateE1RM, roundE1RM } from '../utils/e1rm'
import { DEFAULT_VARIANT_NAME } from '../utils/variants'

const formatIsoDateLabel = (isoDate) => {
  if (!isoDate) return ''
  const parsed = new Date(`${isoDate}T00:00:00`)
  const ts = parsed.getTime()
  if (!Number.isFinite(ts)) return String(isoDate)
  return parsed.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const getNormalizedVariantName = (performance) => {
  if (!performance) return DEFAULT_VARIANT_NAME.toLowerCase()
  const name = String(performance.variantName || DEFAULT_VARIANT_NAME).trim() || DEFAULT_VARIANT_NAME
  return name.toLowerCase()
}

function ExerciseProgressPage({
  exercises = [],
  performances = [],
  initialExerciseId = null,
  onBack
}) {
  const [selectedExerciseId, setSelectedExerciseId] = useState(initialExerciseId || null)
  const [selectedVariantKey, setSelectedVariantKey] = useState(null)
  const [activeView, setActiveView] = useState('table') // 'table' | 'charts'

  useEffect(() => {
    if (initialExerciseId) {
      setSelectedExerciseId(initialExerciseId)
      return
    }
    if (!selectedExerciseId && exercises.length > 0) {
      setSelectedExerciseId(exercises[0].id)
    }
  }, [exercises, initialExerciseId, selectedExerciseId])

  // Quand l'exercice change, auto-sélectionner la variante par défaut (Touch and Go ou première dispo)
  useEffect(() => {
    setSelectedVariantKey(null) // sera résolu dans le useMemo variantOptions
  }, [selectedExerciseId])

  const selectedExercise = exercises.find((exercise) => exercise.id === selectedExerciseId) || null

  const variantOptions = useMemo(() => {
    if (!selectedExerciseId) return []
    const forExercise = performances.filter((perf) => perf.exerciseId === selectedExerciseId)
    const map = new Map()
    forExercise.forEach((perf) => {
      const key = getNormalizedVariantName(perf)
      const label = String(perf.variantName || DEFAULT_VARIANT_NAME).trim() || DEFAULT_VARIANT_NAME
      if (!map.has(key)) {
        // Optionnellement, garder le label avec la "meilleure" casse (première rencontrée)
        map.set(key, label)
      }
    })
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label, 'fr-FR'))
  }, [performances, selectedExerciseId])

  // Dérivation synchrone de la variante active pour éviter les effets de bord (flash "aucune perf")
  const effectiveVariantKey = useMemo(() => {
    if (variantOptions.length === 0) return null
    if (selectedVariantKey && variantOptions.some((o) => o.key === selectedVariantKey)) {
      return selectedVariantKey
    }
    // Fallback immédiat
    const defaultOption =
      variantOptions.find((o) => o.label.toLowerCase() === DEFAULT_VARIANT_NAME.toLowerCase()) ||
      variantOptions[0]
    return defaultOption.key
  }, [variantOptions, selectedVariantKey])

  const exercisePerformances = useMemo(() => {
    if (!selectedExerciseId || !effectiveVariantKey) return []
    const filtered = performances
      .filter((perf) => perf.exerciseId === selectedExerciseId)
      .filter((perf) => getNormalizedVariantName(perf) === effectiveVariantKey)
      .map((perf) => ({
        ...perf,
        reps: toNumber(perf.reps) ?? 0,
        weight: toNumber(perf.weight),
        performanceDate: String(perf.performanceDate || '').slice(0, 10)
      }))
      .filter((perf) => perf.performanceDate && perf.reps > 0 && perf.weight !== null)
      .sort((a, b) => {
        const aTs = new Date(`${a.performanceDate}T00:00:00`).getTime()
        const bTs = new Date(`${b.performanceDate}T00:00:00`).getTime()
        if (aTs !== bTs) return aTs - bTs
        const aCreated = new Date(a.createdAt || 0).getTime()
        const bCreated = new Date(b.createdAt || 0).getTime()
        return aCreated - bCreated
      })
    return filtered
  }, [performances, selectedExerciseId, effectiveVariantKey])

  const progressData = useMemo(() => {
    if (exercisePerformances.length === 0) return null

    const pointsByDate = new Map()
    for (const perf of exercisePerformances) {
      const date = perf.performanceDate
      if (!pointsByDate.has(date)) {
        pointsByDate.set(date, {
          date,
          ts: new Date(`${date}T00:00:00`).getTime(),
          maxWeight: 0,
          bestE1rm: 0,
          volume: 0,
          totalReps: 0,
          series: 0
        })
      }
      const bucket = pointsByDate.get(date)
      const weight = perf.weight ?? 0
      const reps = perf.reps ?? 0
      const e1rm = calculateE1RM(weight, reps) || 0
      bucket.series += 1
      bucket.totalReps += reps
      bucket.volume += weight * reps
      bucket.maxWeight = Math.max(bucket.maxWeight, weight)
      bucket.bestE1rm = Math.max(bucket.bestE1rm, e1rm)
    }

    const points = Array.from(pointsByDate.values())
      .filter((point) => Number.isFinite(point.ts))
      .sort((a, b) => a.ts - b.ts)

    if (points.length === 0) return null

    const minWeight = Math.min(...points.map((p) => p.maxWeight))
    const maxWeight = Math.max(...points.map((p) => p.maxWeight))
    const minE1rm = Math.min(...points.map((p) => p.bestE1rm))
    const maxE1rm = Math.max(...points.map((p) => p.bestE1rm))
    const maxVolume = Math.max(...points.map((p) => p.volume))

    return {
      points,
      stats: {
        maxWeight,
        maxE1rm,
        totalVolume: points.reduce((sum, p) => sum + p.volume, 0),
        sessions: points.length,
        deltaWeight: points.length >= 2 ? (points.at(-1).maxWeight - points[0].maxWeight) : null,
        deltaE1rm: points.length >= 2 ? (maxE1rm - points[0].bestE1rm) : null
      },
      ranges: { minWeight, maxWeight, minE1rm, maxE1rm, maxVolume }
    }
  }, [exercisePerformances])

  // Données pour le tableau progression par reps × temps
  const repProgressionData = useMemo(() => {
    if (exercisePerformances.length === 0) return null

    // Toutes les dates uniques triées
    const allDates = [...new Set(exercisePerformances.map((p) => p.performanceDate))].sort()

    // Pour chaque (date, reps) → meilleur poids
    const cellMap = new Map()
    for (const perf of exercisePerformances) {
      const key = `${perf.performanceDate}|${perf.reps}`
      const existing = cellMap.get(key)
      if (!existing || perf.weight > existing.weight) {
        cellMap.set(key, perf)
      }
    }

    // Reps utilisées (seulement celles qui ont des données)
    const usedReps = [...new Set(exercisePerformances.map((p) => p.reps))].sort((a, b) => a - b)

    // Pour chaque rep, calculer le PR absolu jusqu'à chaque date
    const repRows = usedReps.map((reps) => {
      let allTimeMax = 0
      let previousWeight = null
      const cells = allDates.map((date) => {
        const key = `${date}|${reps}`
        const perf = cellMap.get(key)
        if (!perf) {
          return { date, weight: null, status: 'empty' }
        }
        const weight = perf.weight
        let status = 'normal'
        if (weight > allTimeMax) {
          status = 'pr'
          allTimeMax = weight
        } else if (previousWeight !== null && weight < previousWeight) {
          status = 'down'
        }
        previousWeight = weight
        return { date, weight, status }
      })

      const weights = cells.filter((c) => c.weight !== null).map((c) => c.weight)
      const minW = Math.min(...weights)
      const maxW = Math.max(...weights)

      return { reps, cells, minW, maxW, currentBest: allTimeMax }
    })

    return { allDates, repRows }
  }, [exercisePerformances])

  return (
    <div className="exercise-progress-page">
      <div className="progress-page-header">
        {onBack && (
          <button type="button" className="btn btn-secondary btn-small" onClick={onBack}>
            Retour
          </button>
        )}
        <div className="progress-page-title">
          <h1>Progression par exercice</h1>
          <p>Évolution dans le temps à partir des reps et du poids: poids max, e1RM estimé, volume.</p>
        </div>
      </div>

      <div className="exercise-selector">
        <label htmlFor="exercise-select">Choisir un exercice :</label>
        <select
          id="exercise-select"
          value={selectedExerciseId || ''}
          onChange={(e) => setSelectedExerciseId(e.target.value)}
          className="exercise-dropdown"
        >
          <option value="">-- Sélectionner --</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      </div>

      {selectedExerciseId && variantOptions.length > 1 && (
        <div className="exercise-selector">
          <label htmlFor="variant-select">Variante :</label>
          <select
            id="variant-select"
            value={effectiveVariantKey || ''}
            onChange={(e) => setSelectedVariantKey(e.target.value)}
            className="exercise-dropdown"
          >
            {variantOptions.map((variant) => (
              <option key={variant.key} value={variant.key}>
                {variant.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedExerciseId && exercises.length === 0 && (
        <div className="no-data">Ajoute au moins un exercice pour voir la progression.</div>
      )}

      {selectedExerciseId && exercisePerformances.length === 0 && (
        <div className="no-data">Aucune performance enregistrée pour cet exercice.</div>
      )}

      {progressData && selectedExercise && (
        <div className="progress-container">
          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-label">Poids MAX</span>
              <span className="stat-value">{progressData.stats.maxWeight.toFixed(1)} kg</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">e1RM MAX</span>
              <span className="stat-value">{roundE1RM(progressData.stats.maxE1rm) || 0} kg</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Volume Total</span>
              <span className="stat-value">{progressData.stats.totalVolume.toFixed(0)} kg</span>
            </div>
            <div className="stat-card">
              <span className="stat-label">Progression</span>
              <span className="stat-value">
                {progressData.stats.deltaE1rm !== null
                  ? `${progressData.stats.deltaE1rm >= 0 ? '+' : ''}${roundE1RM(progressData.stats.deltaE1rm) || 0} kg`
                  : '--'}
              </span>
            </div>
          </div>

          {/* Toggle vue */}
          <div className="view-toggle">
            <button
              type="button"
              className={`view-toggle-btn${activeView === 'table' ? ' active' : ''}`}
              onClick={() => setActiveView('table')}
            >
              📊 Progression par reps
            </button>
            <button
              type="button"
              className={`view-toggle-btn${activeView === 'charts' ? ' active' : ''}`}
              onClick={() => setActiveView('charts')}
            >
              📈 Graphiques
            </button>
          </div>

          {/* === VUE TABLEAU PROGRESSION PAR REPS × TEMPS === */}
          {activeView === 'table' && repProgressionData && (
            <div className="rep-progression-section">
              <div className="rep-progression-header">
                <h3>Progression Poids par Nombre de Reps</h3>
                <p className="rep-progression-desc">
                  Chaque ligne = un nombre de reps. Chaque colonne = une séance. Le meilleur poids soulevé ce jour-là pour ce nombre de reps.
                </p>
              </div>

              <div className="rep-progression-legend">
                <span className="legend-item">
                  <span className="legend-dot pr" />
                  <span>🏆 Record perso</span>
                </span>
                <span className="legend-item">
                  <span className="legend-dot down" />
                  <span>↓ Régression</span>
                </span>
                <span className="legend-item">
                  <span className="legend-dot normal" />
                  <span>= Stable</span>
                </span>
              </div>

              <div className="rep-progression-scroll">
                <table className="rep-progression-table">
                  <thead>
                    <tr>
                      <th className="rep-col-header">Reps</th>
                      <th className="best-col-header">PR</th>
                      <th className="sparkline-col-header">Courbe</th>
                      {repProgressionData.allDates.map((date) => (
                        <th key={date} className="date-col-header">
                          {formatIsoDateLabel(date)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {repProgressionData.repRows.map(({ reps, cells, minW, maxW, currentBest }) => (
                      <tr key={reps} className="rep-row">
                        <td className="rep-label">
                          <span className="rep-badge">{reps}</span>
                          <span className="rep-unit">rep{reps > 1 ? 's' : ''}</span>
                        </td>
                        <td className="best-weight">
                          <span className="best-weight-value">
                            {currentBest > 0 ? `${currentBest} kg` : '-'}
                          </span>
                        </td>
                        <td className="sparkline-cell">
                          <svg className="sparkline" viewBox="0 0 80 30" preserveAspectRatio="none">
                            {(() => {
                              const dataCells = cells.filter((c) => c.weight !== null)
                              if (dataCells.length < 2) {
                                // Point unique
                                if (dataCells.length === 1) {
                                  return <circle cx="40" cy="15" r="3" fill="#fbbf24" />
                                }
                                return null
                              }
                              const range = maxW - minW || 1
                              const totalDates = repProgressionData.allDates.length
                              const pointList = dataCells.map((c) => {
                                const x = (repProgressionData.allDates.indexOf(c.date) / Math.max(totalDates - 1, 1)) * 76 + 2
                                const y = 26 - ((c.weight - minW) / range) * 22
                                return { x, y, ...c }
                              })
                              const pointStr = pointList.map((p) => `${p.x},${p.y}`).join(' ')
                              return (
                                <>
                                  <polyline
                                    points={pointStr}
                                    fill="none"
                                    stroke="rgba(34,211,238,0.5)"
                                    strokeWidth="1.5"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                  />
                                  {pointList.map((p) => {
                                    const color = p.status === 'pr' ? '#fbbf24'
                                      : p.status === 'down' ? '#f87171'
                                      : '#94a3b8'
                                    return (
                                      <circle key={p.date} cx={p.x} cy={p.y} r={p.status === 'pr' ? 3.5 : 2.5} fill={color} />
                                    )
                                  })}
                                </>
                              )
                            })()}
                          </svg>
                        </td>
                        {cells.map((cell) => (
                          <td
                            key={cell.date}
                            className={`weight-cell status-${cell.status}`}
                            title={
                              cell.weight !== null
                                ? `${cell.date}: ${cell.weight} kg × ${reps} rep${reps > 1 ? 's' : ''}`
                                : `${cell.date}: aucune donnée pour ${reps} rep${reps > 1 ? 's' : ''}`
                            }
                          >
                            {cell.weight !== null ? (
                              <span className="cell-weight">
                                <span className="cell-kg-value">{cell.weight}</span>
                                <span className="cell-kg-unit">kg</span>
                                {cell.status === 'pr' && <span className="pr-badge">PR</span>}
                                {cell.status === 'down' && <span className="trend-arrow down">↓</span>}
                              </span>
                            ) : (
                              <span className="cell-empty">·</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* === VUE GRAPHIQUES === */}
          {activeView === 'charts' && (
            <>
              <div className="charts-container">
                <div className="chart-box">
                  <h3>Évolution du Poids Max</h3>
                  <div className="mini-chart">
                    {progressData.points.map((point, idx) => {
                      const range = progressData.ranges.maxWeight - progressData.ranges.minWeight || 1
                      const height = ((point.maxWeight - progressData.ranges.minWeight) / range) * 100
                      return (
                        <div key={point.date} className="chart-bar-container">
                          <div
                            className="chart-bar"
                            style={{ height: `${Math.max(5, height)}%` }}
                            title={`${point.date}: ${point.maxWeight.toFixed(1)} kg`}
                          />
                          {idx % Math.ceil(progressData.points.length / 5) === 0 && (
                            <span className="chart-label">{formatIsoDateLabel(point.date)}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="chart-legend">Poids en kg →</div>
                </div>

                <div className="chart-box">
                  <h3>Évolution du e1RM estimé</h3>
                  <div className="mini-chart">
                    {progressData.points.map((point, idx) => {
                      const range = progressData.ranges.maxE1rm - progressData.ranges.minE1rm || 1
                      const height = ((point.bestE1rm - progressData.ranges.minE1rm) / range) * 100
                      return (
                        <div key={point.date} className="chart-bar-container">
                          <div
                            className="chart-bar e1rm-bar"
                            style={{ height: `${Math.max(5, height)}%` }}
                            title={`${point.date}: ${roundE1RM(point.bestE1rm) || 0} kg`}
                          />
                          {idx % Math.ceil(progressData.points.length / 5) === 0 && (
                            <span className="chart-label">{formatIsoDateLabel(point.date)}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="chart-legend">e1RM en kg →</div>
                </div>

                <div className="chart-box">
                  <h3>Évolution du Volume Total (Poids × Reps)</h3>
                  <div className="mini-chart">
                    {progressData.points.map((point, idx) => {
                      const height = (point.volume / (progressData.ranges.maxVolume || 1)) * 100
                      return (
                        <div key={point.date} className="chart-bar-container">
                          <div
                            className="chart-bar volume-bar"
                            style={{ height: `${Math.max(5, height)}%` }}
                            title={`${point.date}: ${point.volume.toFixed(0)} kg`}
                          />
                          {idx % Math.ceil(progressData.points.length / 5) === 0 && (
                            <span className="chart-label">{formatIsoDateLabel(point.date)}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <div className="chart-legend">Volume en kg →</div>
                </div>
              </div>

              <div className="detailed-table">
                <h3>Historique détaillé</h3>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Variante</th>
                        <th>Poids (kg)</th>
                        <th>Reps</th>
                        <th>e1RM</th>
                        <th>Volume (kg)</th>
                        <th>RPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...exercisePerformances].reverse().map((perf, idx) => (
                        <tr key={perf.id || `${perf.performanceDate}-${idx}`} className={idx % 2 === 0 ? 'even' : ''}>
                          <td>{perf.performanceDate}</td>
                          <td>{perf.variantName || DEFAULT_VARIANT_NAME}</td>
                          <td className="weight">{(perf.weight ?? 0).toFixed(1)}</td>
                          <td>{perf.reps}</td>
                          <td className="e1rm">{roundE1RM(calculateE1RM(perf.weight ?? 0, perf.reps) || 0) || 0}</td>
                          <td className="volume">{((perf.weight ?? 0) * perf.reps).toFixed(0)}</td>
                          <td className="rpe">{perf.rpe || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default ExerciseProgressPage
