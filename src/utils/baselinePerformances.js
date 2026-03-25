const DEFAULT_BASELINE_BY_SESSION = {
  'Cycle 2 : haut du corps': '/baselines/cycle2_haut_du_corps_historique.csv'
}

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function parseCsvLine(line, delimiter) {
  const out = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      const next = line[i + 1]
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (!inQuotes && ch === delimiter) {
      out.push(current)
      current = ''
      continue
    }

    current += ch
  }

  out.push(current)
  return out.map((cell) => cell.trim())
}

function toNumberLoose(value) {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw) return null
  const normalized = raw.replace(',', '.')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function normalizeDateToIso(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
  }

  const frMatch = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/)
  if (frMatch) {
    const day = frMatch[1].padStart(2, '0')
    const month = frMatch[2].padStart(2, '0')
    return `${frMatch[3]}-${month}-${day}`
  }

  const parsed = new Date(raw)
  const ts = parsed.getTime()
  if (!Number.isFinite(ts)) return null
  return parsed.toISOString().slice(0, 10)
}

function findHeaderValue(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') {
      return row[key]
    }
  }
  return null
}

function normalizeExerciseKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeVariantKey(value) {
  return String(value || 'Touch and Go')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const fetchCache = new Map()

async function fetchTextCached(url) {
  if (fetchCache.has(url)) {
    return fetchCache.get(url)
  }
  const promise = fetch(url, { cache: 'no-cache' }).then(async (res) => {
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }
    return res.text()
  })
  fetchCache.set(url, promise)
  return promise
}

export async function getBaselinePerformancesForSession(sessionName, exercises) {
  const path = DEFAULT_BASELINE_BY_SESSION[String(sessionName || '').trim()]
  if (!path) {
    return []
  }

  let csvText = ''
  try {
    csvText = await fetchTextCached(path)
  } catch {
    return []
  }

  const normalizedText = String(csvText || '').replace(/\r\n/g, '\n').trim()
  if (!normalizedText) {
    return []
  }

  const lines = normalizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length < 2) {
    return []
  }

  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = parseCsvLine(lines[0], delimiter).map(normalizeHeader)

  const exerciseByKey = Array.isArray(exercises)
    ? exercises.reduce((acc, exercise) => {
      const key = normalizeExerciseKey(exercise?.name)
      if (!key) return acc
      return { ...acc, [key]: exercise }
    }, {})
    : {}

  const rows = []

  for (let i = 1; i < lines.length; i += 1) {
    const values = parseCsvLine(lines[i], delimiter)
    const row = headers.reduce((acc, header, index) => ({
      ...acc,
      [header]: values[index] ?? ''
    }), {})

    const exerciseNameValue = findHeaderValue(row, ['exercise_name', 'exercise', 'exercice', 'nom_exercice', 'name'])
    const repsValue = findHeaderValue(row, ['reps', 'repetitions', 'rm'])
    const weightValue = findHeaderValue(row, ['weight', 'poids', 'kg', 'charge'])
    const dateValue = findHeaderValue(row, ['performance_date', 'date'])
    const variantValue = findHeaderValue(row, ['variant', 'variante', 'variant_name'])

    const reps = toNumberLoose(repsValue)
    const weight = toNumberLoose(weightValue)
    const performanceDate = normalizeDateToIso(dateValue) || null

    if (!exerciseNameValue || !Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0 || !performanceDate) {
      continue
    }

    const matchedExercise = exerciseByKey[normalizeExerciseKey(exerciseNameValue)] || null
    const variantName = String(variantValue || 'Touch and Go').trim() || 'Touch and Go'

    rows.push({
      // exerciseId peut etre null si le nom ne matche pas exactement: l'algo peut matcher par name.
      exerciseId: matchedExercise?.id || null,
      exerciseName: matchedExercise?.name || String(exerciseNameValue).trim(),
      sessionName: sessionName,
      reps: Math.trunc(reps),
      weight,
      rpe: null,
      variantId: null,
      variantName,
      performanceDate,
      createdAt: null,
      serieNumber: 1,
      _baseline: true,
      _variantKey: normalizeVariantKey(variantName)
    })
  }

  // Tente d'assigner variantId si possible (sinon on reste sur variantName).
  if (Array.isArray(exercises) && rows.length > 0) {
    const variantsByExerciseId = new Map()
    exercises.forEach((exercise) => {
      const variants = Array.isArray(exercise?.variants) ? exercise.variants : []
      variantsByExerciseId.set(exercise?.id, variants)
    })

    rows.forEach((row) => {
      if (!row.exerciseId) return
      const variants = variantsByExerciseId.get(row.exerciseId) || []
      const match = variants.find((variant) => normalizeVariantKey(variant?.name) === row._variantKey) || null
      if (match?.id) {
        row.variantId = match.id
        row.variantName = match.name || row.variantName
      }
    })
  }

  rows.forEach((row) => {
    delete row._variantKey
  })

  return rows
}
