import { useEffect, useState } from 'react'
import PerformanceTable from '../components/PerformanceTable'
import '../styles/PerformancesPage.css'
import { DEFAULT_VARIANT_NAME, getDefaultVariant, normalizeVariants } from '../utils/variants'

const getVariantSelectValue = (variant) => variant.id || `name:${variant.name}`

function parseCsvLine(line, delimiter) {
  const values = []
  let current = ''
  let insideQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        current += '"'
        i += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  values.push(current.trim())
  return values
}

function normalizeHeader(header) {
  return header
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_')
}

function findHeaderValue(row, aliases) {
  for (const alias of aliases) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) {
      return row[alias]
    }
  }
  return ''
}

function normalizeCsvDate(value) {
  const raw = String(value || '').trim()
  if (!raw) {
    return null
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const frMatch = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+.*)?$/)
  if (frMatch) {
    const day = frMatch[1].padStart(2, '0')
    const month = frMatch[2].padStart(2, '0')
    return `${frMatch[3]}-${month}-${day}`
  }

  const parsed = new Date(raw)
  const ts = parsed.getTime()
  if (!Number.isFinite(ts)) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

function PerformancesPage({
  performances,
  exercises,
  onAddPerformance,
  onImportPerformances,
  onOpenExerciseDetails
}) {
  const parseWeightValue = (value) => {
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

  const [selectedExercise, setSelectedExercise] = useState(null)
  const [showManualSection, setShowManualSection] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [manualPerf, setManualPerf] = useState({
    exerciseId: exercises[0]?.id || '',
    variantId: '',
    reps: '',
    weight: '',
    rpe: '10',
    sessionName: 'Ajout manuel',
    performanceDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    if (!manualPerf.exerciseId && exercises.length > 0) {
      const defaultVariant = getDefaultVariant(normalizeVariants(exercises[0].variants, exercises[0].id), exercises[0].id)
      setManualPerf((prev) => ({
        ...prev,
        exerciseId: exercises[0].id,
        variantId: getVariantSelectValue(defaultVariant)
      }))
    }
  }, [exercises, manualPerf.exerciseId])

  useEffect(() => {
    if (!manualPerf.exerciseId) {
      return
    }

    const selectedExerciseData = exercises.find((exercise) => exercise.id === manualPerf.exerciseId)
    if (!selectedExerciseData) {
      return
    }

    const variants = normalizeVariants(selectedExerciseData.variants, selectedExerciseData.id)
    const selectedVariantStillExists = variants.some((variant) => getVariantSelectValue(variant) === (manualPerf.variantId || ''))

    if (!selectedVariantStillExists) {
      const defaultVariant = getDefaultVariant(variants, selectedExerciseData.id)
      setManualPerf((prev) => ({
        ...prev,
        variantId: getVariantSelectValue(defaultVariant)
      }))
    }
  }, [manualPerf.exerciseId, manualPerf.variantId, exercises])

  const performancesByExercise = exercises.reduce((acc, exercise) => {
    const exoPerfs = performances.filter((p) => p.exerciseId === exercise.id)
    if (exoPerfs.length > 0) {
      acc[exercise.name] = exoPerfs
    }
    return acc
  }, {})

  const exercisesWithPerfs = Object.keys(performancesByExercise)

  const totalSeries = performances.length
  const totalExercises = exercisesWithPerfs.length
  const avgWeight = performances.length > 0
    ? (performances.reduce((sum, p) => sum + (p.weight || 0), 0) / performances.length).toFixed(1)
    : 0

  const latestPerformanceDate = performances.length > 0
    ? [...performances]
      .sort((a, b) => new Date(b.performanceDate || b.date) - new Date(a.performanceDate || a.date))[0]
      ?.date
    : null

  const handleManualPerfChange = (field, value) => {
    setManualPerf((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddManualPerformance = async (e) => {
    e.preventDefault()

    const selectedExerciseData = exercises.find((exercise) => exercise.id === manualPerf.exerciseId)
    const reps = parseInt(manualPerf.reps, 10)
    const weight = parseWeightValue(manualPerf.weight)
    const serieNumber = 1
    const rpe = manualPerf.rpe ? parseInt(manualPerf.rpe, 10) : 10

    if (!selectedExerciseData) {
      alert('Sélectionne un exercice.')
      return
    }

    if (!Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
      alert('Reps doit être supérieur à 0 et le poids doit être supérieur ou égal à 0.')
      return
    }

    try {
      setIsSaving(true)
      await onAddPerformance({
        exerciseId: selectedExerciseData.id,
        exerciseName: selectedExerciseData.name,
        reps,
        weight,
        rpe,
        variantId: (manualPerf.variantId || '').startsWith('name:') ? null : (manualPerf.variantId || null),
        variantName: (
          normalizeVariants(selectedExerciseData.variants, selectedExerciseData.id)
            .find((variant) => getVariantSelectValue(variant) === (manualPerf.variantId || ''))
            ?.name || DEFAULT_VARIANT_NAME
        ),
        serieNumber,
        sessionName: manualPerf.sessionName?.trim() || 'Ajout manuel',
        performanceDate: manualPerf.performanceDate
      })

      setManualPerf((prev) => ({
        ...prev,
        reps: '',
        weight: '',
        rpe: '10'
      }))
    } finally {
      setIsSaving(false)
    }
  }

  const parseCsvToPerformances = (csvText) => {
    const normalizedText = csvText.replace(/\r\n/g, '\n').trim()
    if (!normalizedText) {
      throw new Error('Le fichier CSV est vide.')
    }

    const lines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length < 2) {
      throw new Error('Le CSV doit contenir une ligne d\'en-tête et au moins une ligne de données.')
    }

    const delimiter = lines[0].includes(';') ? ';' : ','
    const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader)

    const exerciseByName = exercises.reduce((acc, exercise) => ({
      ...acc,
      [exercise.name.trim().toLowerCase()]: exercise
    }), {})
    const exerciseById = exercises.reduce((acc, exercise) => ({
      ...acc,
      [exercise.id]: exercise
    }), {})

    const importedRows = []
    const errors = []

    for (let i = 1; i < lines.length; i += 1) {
      const rawValues = parseCsvLine(lines[i], delimiter)
      const row = headers.reduce((acc, header, index) => ({
        ...acc,
        [header]: (rawValues[index] || '').trim()
      }), {})

      const exerciseIdValue = findHeaderValue(row, ['exercise_id', 'exo_id', 'id_exercice'])
      const exerciseNameValue = findHeaderValue(row, ['exercise_name', 'exercise', 'exercice', 'nom_exercice', 'name'])
      const repsValue = findHeaderValue(row, ['reps', 'repetitions'])
      const weightValue = findHeaderValue(row, ['weight', 'poids', 'kg', 'charge'])
      const rpeValue = findHeaderValue(row, ['rpe'])
      const variantValue = findHeaderValue(row, ['variant', 'variante', 'variant_name'])
      const seriesValue = findHeaderValue(row, ['series_number', 'serie_number', 'serie', 'series', 'set'])
      const dateValue = findHeaderValue(row, ['performance_date', 'date'])
      const sessionNameValue = findHeaderValue(row, ['session_name', 'session', 'seance'])

      const exerciseFromId = exerciseIdValue ? exerciseById[exerciseIdValue] : null
      const exerciseFromName = exerciseNameValue
        ? exerciseByName[exerciseNameValue.toLowerCase()]
        : null
      const matchedExercise = exerciseFromId || exerciseFromName

      const reps = parseInt(repsValue, 10)
      const weight = parseWeightValue(weightValue)
      const serieNumber = parseInt(seriesValue || '1', 10)
      const rpe = rpeValue ? parseInt(rpeValue, 10) : 10
      const normalizedDate = dateValue ? normalizeCsvDate(dateValue) : null
      const variants = normalizeVariants(matchedExercise?.variants, matchedExercise?.id)
      const defaultVariant = getDefaultVariant(variants, matchedExercise?.id)
      const selectedVariant = variantValue
        ? variants.find((variant) => variant.name.toLocaleLowerCase('fr-FR') === variantValue.toLocaleLowerCase('fr-FR'))
        : defaultVariant

      const lineNumber = i + 1
      if (!matchedExercise) {
        errors.push(`Ligne ${lineNumber}: exercice introuvable (${exerciseNameValue || exerciseIdValue || 'vide'}).`)
        continue
      }
      if (!Number.isFinite(reps) || reps <= 0) {
        errors.push(`Ligne ${lineNumber}: reps invalide.`)
        continue
      }
      if (!Number.isFinite(weight) || weight < 0) {
        errors.push(`Ligne ${lineNumber}: poids invalide.`)
        continue
      }
      if (!Number.isFinite(serieNumber) || serieNumber <= 0) {
        errors.push(`Ligne ${lineNumber}: numéro de série invalide.`)
        continue
      }
      if (!Number.isFinite(rpe) || rpe < 6 || rpe > 10) {
        errors.push(`Ligne ${lineNumber}: RPE doit être entre 6 et 10.`)
        continue
      }
      if (dateValue && !normalizedDate) {
        errors.push(`Ligne ${lineNumber}: date invalide (${dateValue}).`)
        continue
      }

      importedRows.push({
        exerciseId: matchedExercise.id,
        exerciseName: matchedExercise.name,
        reps,
        weight,
        rpe,
        variantId: selectedVariant?.id || null,
        variantName: selectedVariant?.name || variantValue || DEFAULT_VARIANT_NAME,
        serieNumber,
        sessionName: sessionNameValue || 'Import CSV',
        performanceDate: normalizedDate || new Date().toISOString().split('T')[0]
      })
    }

    return { importedRows, errors }
  }

  const handleImportCsv = async (e) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    try {
      setIsImporting(true)
      const fileText = await file.text()
      const { importedRows, errors } = parseCsvToPerformances(fileText)

      if (importedRows.length === 0) {
        alert(`Aucune ligne importable.\n${errors.slice(0, 8).join('\n')}`)
        return
      }

      await onImportPerformances(importedRows)

      const warningPart = errors.length > 0
        ? `\n${errors.length} ligne(s) ignorée(s).`
        : ''
      alert(`${importedRows.length} performance(s) importée(s).${warningPart}`)
    } catch (error) {
      console.error('Erreur import CSV:', error)
      alert(error.message || "Erreur lors de l'import CSV")
    } finally {
      setIsImporting(false)
      e.target.value = ''
    }
  }

  return (
    <div className="performances-page">
      <div className="page-header">
        <div>
          <h1>Performances</h1>
          <p>Analyse de vos séries, charges et régularité d'entraînement.</p>
        </div>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => setShowManualSection((prev) => !prev)}
        >
          {showManualSection ? 'Fermer ajout manuel' : 'Ajout manuel'}
        </button>
      </div>

      {showManualSection && (
      <section className="manual-perf-section">
        <h2>Ajouter une performance manuellement</h2>
        <p>Pratique pour importer tes performances historiques avant ta première séance.</p>

        <div className="csv-import-box">
          <p>
            Import CSV (colonnes acceptées) :
            <code> exercise_name/exercise/exercice | variant/variante | reps | weight/poids | rpe | performance_date/date | session_name/session</code>
          </p>
          <label className="csv-import-label">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={handleImportCsv}
              disabled={isImporting || exercises.length === 0}
            />
            <span>{isImporting ? 'Import en cours...' : 'Importer un fichier CSV'}</span>
          </label>
        </div>

        <form className="manual-perf-form" onSubmit={handleAddManualPerformance}>
          <div className="manual-field">
            <label htmlFor="manual-exercise">Exercice</label>
            <select
              id="manual-exercise"
              value={manualPerf.exerciseId}
              onChange={(e) => handleManualPerfChange('exerciseId', e.target.value)}
              required
            >
              {exercises.length === 0 ? (
                <option value="">Aucun exercice</option>
              ) : (
                exercises.map((exercise) => (
                  <option key={exercise.id} value={exercise.id}>
                    {exercise.name}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="manual-field">
            <label htmlFor="manual-reps">Reps</label>
            <input
              id="manual-reps"
              type="number"
              min="1"
              value={manualPerf.reps}
              onChange={(e) => handleManualPerfChange('reps', e.target.value)}
              required
            />
          </div>

          <div className="manual-field">
            <label htmlFor="manual-variant">Variante</label>
            <select
              id="manual-variant"
              value={manualPerf.variantId}
              onChange={(e) => handleManualPerfChange('variantId', e.target.value)}
            >
              {(
                normalizeVariants(
                  exercises.find((exercise) => exercise.id === manualPerf.exerciseId)?.variants,
                  manualPerf.exerciseId
                )
              ).map((variant) => (
                <option key={variant.id || variant.name} value={getVariantSelectValue(variant)}>
                  {variant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="manual-field">
            <label htmlFor="manual-weight">Poids (kg)</label>
            <input
              id="manual-weight"
              type="number"
              min="0"
              step="0.01"
              value={manualPerf.weight}
              onChange={(e) => handleManualPerfChange('weight', e.target.value)}
              required
            />
          </div>

          <div className="manual-field">
            <label htmlFor="manual-rpe">RPE</label>
            <select
              id="manual-rpe"
              value={manualPerf.rpe}
              onChange={(e) => handleManualPerfChange('rpe', e.target.value)}
            >
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
            </select>
          </div>

          <div className="manual-field">
            <label htmlFor="manual-date">Date</label>
            <input
              id="manual-date"
              type="date"
              value={manualPerf.performanceDate}
              onChange={(e) => handleManualPerfChange('performanceDate', e.target.value)}
              required
            />
          </div>

          <div className="manual-field manual-field-wide">
            <label htmlFor="manual-session">Nom de séance (optionnel)</label>
            <input
              id="manual-session"
              type="text"
              value={manualPerf.sessionName}
              onChange={(e) => handleManualPerfChange('sessionName', e.target.value)}
              placeholder="Ex: Bloc force semaine 3"
            />
          </div>

          <button
            className="btn btn-primary manual-submit-btn"
            type="submit"
            disabled={isSaving || exercises.length === 0}
          >
            {isSaving ? 'Ajout...' : 'Ajouter au tableau'}
          </button>
        </form>
      </section>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">TS</div>
          <div className="stat-content">
            <p className="stat-label">Total séries</p>
            <h3 className="stat-value">{totalSeries}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">EX</div>
          <div className="stat-content">
            <p className="stat-label">Exercices suivis</p>
            <h3 className="stat-value">{totalExercises}</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">KG</div>
          <div className="stat-content">
            <p className="stat-label">Charge moyenne</p>
            <h3 className="stat-value">{avgWeight} kg</h3>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">DS</div>
          <div className="stat-content">
            <p className="stat-label">Dernière séance</p>
            <h3 className="stat-value">
              {latestPerformanceDate || 'Aucune'}
            </h3>
          </div>
        </div>
      </div>

      {exercisesWithPerfs.length > 0 && (
        <div className="filter-section">
          <div className="filter-tabs">
            <button
              className={`filter-btn ${!selectedExercise ? 'active' : ''}`}
              onClick={() => setSelectedExercise(null)}
            >
              Tous ({exercisesWithPerfs.length})
            </button>
            {exercisesWithPerfs.slice(0, 5).map((exoName) => (
              <button
                key={exoName}
                className={`filter-btn ${selectedExercise === exoName ? 'active' : ''}`}
                onClick={() => setSelectedExercise(exoName)}
              >
                {exoName}
              </button>
            ))}
            {exercisesWithPerfs.length > 5 && (
              <select
                className="filter-dropdown"
                onChange={(e) => setSelectedExercise(e.target.value || null)}
                value={selectedExercise || ''}
              >
                <option value="">Autres exercices...</option>
                {exercisesWithPerfs.slice(5).map((exoName) => (
                  <option key={exoName} value={exoName}>
                    {exoName}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      <div className="table-section">
        {performances.length > 0 ? (
          <PerformanceTable
            performances={selectedExercise ? performancesByExercise[selectedExercise] : performances}
            exercises={exercises}
            onOpenExerciseDetails={onOpenExerciseDetails}
          />
        ) : (
          <div className="empty-state">
            <p>Aucune donnée de performance pour le moment</p>
            <p className="empty-subtext">Complétez une séance pour alimenter vos statistiques.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PerformancesPage
