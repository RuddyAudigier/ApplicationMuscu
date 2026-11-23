import { normalizeMuscleGroups } from '../utils/muscleGroups'
import { DEFAULT_VARIANT_NAME, normalizeVariants } from '../utils/variants'

const MOCK_DB_STORAGE_KEY = 'local_test_db_v1'

function nowIso() {
  return new Date().toISOString()
}

function generateId(prefix = 'id') {
  const uuid = globalThis.crypto?.randomUUID?.()
  if (uuid) {
    return uuid
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function parseJsonSafely(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function formatDateFr(iso) {
  const ts = new Date(iso || 0).getTime()
  if (!Number.isFinite(ts) || ts <= 0) {
    return ''
  }
  return new Date(ts).toLocaleDateString('fr-FR')
}

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

function ensureVariantIds(variants, exerciseId) {
  return normalizeVariants(variants, exerciseId).map((variant) => ({
    ...variant,
    id: variant.id || generateId('variant'),
    exerciseId
  }))
}

function buildSeedDb() {
  const createdAt = nowIso()

  const benchId = generateId('exercise')
  const squatId = generateId('exercise')

  const exercises = [
    {
      id: benchId,
      name: 'Développé couché',
      description: 'Exercice de test (mock).',
      muscleGroups: ['Pectoraux', 'Triceps'],
      variants: ensureVariantIds([{ name: DEFAULT_VARIANT_NAME, isDefault: true }, { name: 'Pause' }], benchId),
      isCustom: true,
      createdAt
    },
    {
      id: squatId,
      name: 'Squat',
      description: 'Exercice de test (mock).',
      muscleGroups: ['Quadriceps', 'Fessiers'],
      variants: ensureVariantIds([{ name: DEFAULT_VARIANT_NAME, isDefault: true }], squatId),
      isCustom: true,
      createdAt
    }
  ]

  const sessionId = generateId('session')
  const sessions = [
    {
      id: sessionId,
      name: 'Séance test (mock)',
      createdAt
    }
  ]

  const sessionExercises = [
    { sessionId, exerciseId: benchId, seriesCount: 3 },
    { sessionId, exerciseId: squatId, seriesCount: 3 }
  ]

  // On met volontairement plusieurs dates pour pouvoir tester:
  // - PR same-reps
  // - PR "record reps" (référence lower-reps à poids égal)
  // - PR "hybride" (référence lower-reps à poids + lourd)
  const performances = [
    // Bench - référence old: 5 reps @ 90 (sert de lower-reps référence)
    {
      id: generateId('perf'),
      exercise_id: benchId,
      exercise_name: 'Développé couché',
      session_name: 'Séance test (mock)',
      reps: 5,
      weight: 90,
      rpe: 9,
      variant_id: exercises[0].variants[0].id,
      variant_name: exercises[0].variants[0].name,
      series_number: 1,
      performance_date: '2026-03-01',
      created_at: nowIso()
    },
    // Bench - même poids mais + reps => record reps
    {
      id: generateId('perf'),
      exercise_id: benchId,
      exercise_name: 'Développé couché',
      session_name: 'Séance test (mock)',
      reps: 6,
      weight: 90,
      rpe: 9,
      variant_id: exercises[0].variants[0].id,
      variant_name: exercises[0].variants[0].name,
      series_number: 1,
      performance_date: '2026-03-05',
      created_at: nowIso()
    },
    // Bench - plus lourd et + reps vs lower reps => PR hybride
    {
      id: generateId('perf'),
      exercise_id: benchId,
      exercise_name: 'Développé couché',
      session_name: 'Séance test (mock)',
      reps: 6,
      weight: 92.5,
      rpe: 9.5,
      variant_id: exercises[0].variants[0].id,
      variant_name: exercises[0].variants[0].name,
      series_number: 2,
      performance_date: '2026-03-10',
      created_at: nowIso()
    },
    // Squat - référence same reps
    {
      id: generateId('perf'),
      exercise_id: squatId,
      exercise_name: 'Squat',
      session_name: 'Séance test (mock)',
      reps: 5,
      weight: 120,
      rpe: 9,
      variant_id: exercises[1].variants[0].id,
      variant_name: exercises[1].variants[0].name,
      series_number: 1,
      performance_date: '2026-03-01',
      created_at: nowIso()
    },
    // Squat - PR same-reps
    {
      id: generateId('perf'),
      exercise_id: squatId,
      exercise_name: 'Squat',
      session_name: 'Séance test (mock)',
      reps: 5,
      weight: 122.5,
      rpe: 9,
      variant_id: exercises[1].variants[0].id,
      variant_name: exercises[1].variants[0].name,
      series_number: 1,
      performance_date: '2026-03-10',
      created_at: nowIso()
    }
  ]

  return {
    version: 1,
    createdAt,
    updatedAt: createdAt,
    exercises,
    sessions,
    sessionExercises,
    performances,
    coachNotesByExerciseId: {},
    sharedSessions: [],
    generalAdvice: null
  }
}

function loadDb() {
  const raw = globalThis.localStorage?.getItem(MOCK_DB_STORAGE_KEY) || ''
  const parsed = parseJsonSafely(raw, null)
  if (parsed && parsed.version === 1) {
    return parsed
  }

  const seeded = buildSeedDb()
  globalThis.localStorage?.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(seeded))
  return seeded
}

function saveDb(db) {
  const next = {
    ...db,
    updatedAt: nowIso()
  }
  globalThis.localStorage?.setItem(MOCK_DB_STORAGE_KEY, JSON.stringify(next))
  return next
}

export function resetMockDatabase() {
  globalThis.localStorage?.removeItem(MOCK_DB_STORAGE_KEY)
}

function cleanupObsoletePerformancesInDb(db, performanceDataArray) {
  const uniqueGroups = new Map()

  performanceDataArray.forEach((perf) => {
    const exerciseId = perf.exerciseId
    const variantId = perf.variantId || null
    const variantName = perf.variantName || DEFAULT_VARIANT_NAME
    if (!exerciseId) return

    const key = `${exerciseId}::${variantId || 'null'}::${variantName}`
    if (!uniqueGroups.has(key)) {
      uniqueGroups.set(key, { exerciseId, variantId, variantName })
    }
  })

  for (const group of uniqueGroups.values()) {
    const rows = db.performances.filter((row) => {
      if (row.exercise_id !== group.exerciseId) return false
      if (group.variantId) return row.variant_id === group.variantId
      return (row.variant_id ?? null) === null && (row.variant_name || DEFAULT_VARIANT_NAME) === group.variantName
    })

    if (rows.length < 2) continue

    const byPointKey = new Map()
    rows.forEach((row) => {
      const reps = Number(row.reps)
      const weight = row.weight !== null ? Number(row.weight) : null
      if (!Number.isFinite(reps) || reps <= 0 || weight === null) return

      const pointKey = `${reps}::${weight}`
      const existing = byPointKey.get(pointKey) || []
      byPointKey.set(pointKey, [...existing, row])
    })

    const idsToDelete = new Set()
    byPointKey.forEach((samePointRows) => {
      if (samePointRows.length <= 1) return
      const sorted = [...samePointRows].sort((a, b) => (
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ))
      sorted.slice(1).forEach((row) => idsToDelete.add(row.id))
    })

    if (idsToDelete.size === 0) continue
    db.performances = db.performances.filter((row) => !idsToDelete.has(row.id))
  }
}

// ===== EXERCICES =====
export const exercisesService = {
  async addExercise(exerciseData) {
    const db = loadDb()

    const id = generateId('exercise')
    const cleanedName = String(exerciseData?.name || '').trim()
    if (!cleanedName) {
      throw new Error("Le nom de l'exercice est requis.")
    }

    const variants = ensureVariantIds(exerciseData?.variants, id)
    const exercise = {
      id,
      name: cleanedName,
      description: String(exerciseData?.description || ''),
      muscleGroups: normalizeMuscleGroups(exerciseData?.muscleGroups || []),
      variants,
      isCustom: exerciseData?.isCustom ?? true,
      createdAt: nowIso()
    }

    db.exercises = [exercise, ...(db.exercises || [])]
    saveDb(db)
    return exercise
  },

  async getExercises() {
    const db = loadDb()
    const list = Array.isArray(db.exercises) ? db.exercises : []
    return list.map((ex) => ({
      id: ex.id,
      name: ex.name,
      description: ex.description,
      muscleGroups: normalizeMuscleGroups(ex.muscleGroups || []),
      variants: ensureVariantIds(ex.variants, ex.id),
      isCustom: Boolean(ex.isCustom),
      createdAt: ex.createdAt || null
    }))
  },

  async deleteExercise(id) {
    const db = loadDb()
    db.exercises = (db.exercises || []).filter((ex) => ex.id !== id)
    db.sessionExercises = (db.sessionExercises || []).filter((se) => se.exerciseId !== id)
    db.performances = (db.performances || []).filter((perf) => perf.exercise_id !== id)
    delete (db.coachNotesByExerciseId || {})[id]
    saveDb(db)
  },

  async updateExercise(id, data) {
    const db = loadDb()
    const cleanedName = String(data?.name || '').trim()
    if (!cleanedName) {
      throw new Error("Le nom de l'exercice est requis.")
    }

    const idx = (db.exercises || []).findIndex((ex) => ex.id === id)
    if (idx === -1) {
      throw new Error('Exercice introuvable.')
    }

    const existing = db.exercises[idx]
    const updated = {
      ...existing,
      name: cleanedName,
      description: String(data?.description || ''),
      muscleGroups: normalizeMuscleGroups(data?.muscleGroups || []),
      variants: ensureVariantIds(data?.variants, id),
      isCustom: data?.isCustom ?? existing.isCustom
    }

    db.exercises[idx] = updated
    saveDb(db)
    return updated
  }
}

// ===== SÉANCES =====
export const sessionsService = {
  async addSession(sessionData) {
    const db = loadDb()
    const name = String(sessionData?.name || '').trim()
    if (!name) {
      throw new Error('Nom de séance manquant.')
    }

    const id = generateId('session')
    const session = { id, name, createdAt: nowIso() }
    db.sessions = [session, ...(db.sessions || [])]

    const exercises = Array.isArray(sessionData?.exercises) ? sessionData.exercises : []
    const nextSessionExercises = exercises.map((ex) => ({
      sessionId: id,
      exerciseId: ex.id,
      seriesCount: Number(ex.series) || 1
    }))
    db.sessionExercises = [...(db.sessionExercises || []), ...nextSessionExercises]

    saveDb(db)
    return { id, ...sessionData }
  },

  async getSessions() {
    const db = loadDb()
    const sessions = Array.isArray(db.sessions) ? db.sessions : []
    const sessionExercises = Array.isArray(db.sessionExercises) ? db.sessionExercises : []
    const exercises = Array.isArray(db.exercises) ? db.exercises : []
    const exerciseById = new Map(exercises.map((ex) => [ex.id, ex]))

    const sorted = [...sessions].sort((a, b) => (
      new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    ))

    return sorted.map((session) => {
      const se = sessionExercises.filter((row) => row.sessionId === session.id)
      return {
        id: session.id,
        name: session.name,
        createdAt: formatDateFr(session.createdAt),
        exercises: se.map((row) => {
          const ex = exerciseById.get(row.exerciseId)
          return {
            id: row.exerciseId,
            name: ex?.name || 'Exercice',
            muscleGroups: [],
            series: row.seriesCount
          }
        })
      }
    })
  },

  async deleteSession(id) {
    const db = loadDb()
    db.sessions = (db.sessions || []).filter((s) => s.id !== id)
    db.sessionExercises = (db.sessionExercises || []).filter((se) => se.sessionId !== id)
    saveDb(db)
  },

  async updateSession(id, sessionData) {
    const db = loadDb()
    const name = String(sessionData?.name || '').trim()
    if (!name) {
      throw new Error('Nom de séance manquant.')
    }

    const idx = (db.sessions || []).findIndex((s) => s.id === id)
    if (idx === -1) {
      throw new Error('Séance introuvable.')
    }

    db.sessions[idx] = { ...db.sessions[idx], name, updatedAt: nowIso() }

    // Supprimer les exercices existants
    db.sessionExercises = (db.sessionExercises || []).filter((se) => se.sessionId !== id)

    // Ajouter les nouveaux
    const exercises = Array.isArray(sessionData?.exercises) ? sessionData.exercises : []
    const nextSessionExercises = exercises.map((ex) => ({
      sessionId: id,
      exerciseId: ex.id,
      seriesCount: Number(ex.series) || 1
    }))
    db.sessionExercises = [...(db.sessionExercises || []), ...nextSessionExercises]

    saveDb(db)
    return { id, ...sessionData }
  }
}

// ===== PERFORMANCES =====
export const performancesService = {
  async cleanupObsoletePerformances(performanceDataArray) {
    const db = loadDb()
    cleanupObsoletePerformancesInDb(db, performanceDataArray)
    saveDb(db)
  },

  async addPerformances(performanceDataArray) {
    const db = loadDb()
    const today = new Date().toISOString().split('T')[0]

    const isIncompleteSerie = (perf) => {
      const reps = Number(perf?.reps)
      const weight = normalizeWeight(perf?.weight)
      return reps === 0 && weight === null
    }

    const isFalledAttempt = (perf) => {
      const reps = Number(perf?.reps)
      return reps === 0  // 0 reps = tentative ratée (ne pas enregistrer en BDD)
    }

    const hasInvalidEntry = performanceDataArray.some((perf) => {
      const reps = Number(perf?.reps)
      const weight = normalizeWeight(perf?.weight)
      const isIncomplete = isIncompleteSerie(perf)
      const isFailed = isFalledAttempt(perf)
      if (isIncomplete || isFailed) return false
      return !Number.isFinite(reps) || reps <= 0 || weight === null
    })

    if (hasInvalidEntry) {
      throw new Error('Entrée performance invalide: mets reps > 0 avec un poids >= 0, ou reps=0 et poids vide pour une série non complétée.')
    }

    // Filtrer: ne pas enregistrer les 0 reps en BDD
    const performancesToSave = performanceDataArray.filter((perf) => {
      const reps = Number(perf?.reps)
      return reps > 0  // Garder seulement reps > 0
    })

    const inserted = performancesToSave.map((perf) => {
      const isIncomplete = isIncompleteSerie(perf)
      return {
        id: generateId('perf'),
        exercise_id: perf.exerciseId,
        exercise_name: perf.exerciseName,
        session_name: perf.sessionName,
        reps: isIncomplete ? 0 : Number(perf.reps),
        weight: isIncomplete ? null : normalizeWeight(perf.weight),
        rpe: perf.rpe ?? 10,
        variant_id: perf.variantId || null,
        variant_name: perf.variantName || DEFAULT_VARIANT_NAME,
        series_number: perf.serieNumber,
        performance_date: perf.performanceDate || today,
        created_at: nowIso()
      }
    })

    db.performances = [...inserted, ...(db.performances || [])]
    cleanupObsoletePerformancesInDb(db, performancesToSave)
    saveDb(db)
  },

  async getPerformances() {
    const db = loadDb()
    const rows = Array.isArray(db.performances) ? db.performances : []

    const sorted = [...rows].sort((a, b) => {
      const aCreated = new Date(a.created_at || 0).getTime()
      const bCreated = new Date(b.created_at || 0).getTime()
      if (bCreated !== aCreated) return bCreated - aCreated
      return String(b.performance_date || '').localeCompare(String(a.performance_date || ''))
    })

    return sorted.map((p) => ({
      id: p.id,
      exerciseName: p.exercise_name,
      reps: Number(p.reps),
      weight: p.weight !== null ? Number(p.weight) : null,
      rpe: p.rpe !== null ? Number(p.rpe) : null,
      variantId: p.variant_id ?? null,
      variantName: p.variant_name || DEFAULT_VARIANT_NAME,
      performanceDate: p.performance_date,
      createdAt: p.created_at ?? null,
      date: formatDateFr(p.performance_date),
      exerciseId: p.exercise_id,
      serieNumber: p.series_number,
      sessionName: p.session_name
    }))
  },

  async getPerformancesByExercise(exerciseId) {
    const db = loadDb()
    return (db.performances || []).filter((p) => p.exercise_id === exerciseId)
  },

  async deletePerformance(id) {
    const db = loadDb()
    db.performances = (db.performances || []).filter((p) => p.id !== id)
    saveDb(db)
  },

  async deletePerformancesBySessionAndDate(sessionName, performanceDateIso) {
    if (!sessionName) {
      throw new Error('Nom de séance manquant.')
    }
    if (!performanceDateIso) {
      throw new Error('Date de séance manquante.')
    }

    const db = loadDb()
    db.performances = (db.performances || []).filter((p) => !(
      p.session_name === sessionName && p.performance_date === performanceDateIso
    ))
    saveDb(db)
  },

  async deletePerformancesBySessionName(sessionName) {
    if (!sessionName) {
      throw new Error('Nom de séance manquant.')
    }

    const db = loadDb()
    db.performances = (db.performances || []).filter((p) => p.session_name !== sessionName)
    saveDb(db)
  }
}

// ===== REMARQUES DU COACH =====
export const coachNotesService = {
  async saveCoachNotes(exerciseId, notes) {
    if (!exerciseId) {
      throw new Error('exerciseId manquant.')
    }
    const db = loadDb()
    const next = {
      notes: String(notes || ''),
      updatedAt: nowIso()
    }
    db.coachNotesByExerciseId = db.coachNotesByExerciseId || {}
    db.coachNotesByExerciseId[exerciseId] = next
    saveDb(db)
  },

  async getCoachNotes(exerciseId) {
    if (!exerciseId) {
      return ''
    }
    const db = loadDb()
    return String(db.coachNotesByExerciseId?.[exerciseId]?.notes || '')
  }
}

// ===== PARTAGE PUBLIC DE SÉANCE =====
export const sharedSessionsService = {
  async createSharedSession(payload) {
    const db = loadDb()
    const id = generateId('shared')
    db.sharedSessions = db.sharedSessions || []
    db.sharedSessions.unshift({
      id,
      payload,
      createdAt: nowIso()
    })
    saveDb(db)
    return id
  },

  async getSharedSession(sharedId) {
    const db = loadDb()
    const found = (db.sharedSessions || []).find((row) => row.id === sharedId) || null
    return found?.payload || null
  }
}

// ===== CONSEILS GENERAUX =====
export const generalAdviceService = {
  async getGeneralAdvice() {
    const db = loadDb()
    return db.generalAdvice || null
  },

  async saveGeneralAdvice(advice) {
    const db = loadDb()
    db.generalAdvice = {
      training: String(advice?.training || ''),
      nutrition: String(advice?.nutrition || ''),
      sleep: String(advice?.sleep || ''),
      updatedAt: nowIso()
    }
    saveDb(db)
  }
}

