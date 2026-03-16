function parseDateToIso(value) {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`

  const frMatch = raw.match(/^(\d{2})[\/.-](\d{2})[\/.-](\d{4})$/)
  if (frMatch) return `${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`

  const parsed = new Date(raw)
  const ts = parsed.getTime()
  if (!Number.isFinite(ts)) return null
  return parsed.toISOString().slice(0, 10)
}

function parseDateToTimestamp(value) {
  const iso = parseDateToIso(value)
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  const ts = new Date(y, m - 1, d).getTime()
  return Number.isFinite(ts) ? ts : null
}

function normalizeVariantName(value) {
  return String(value || 'Touch and Go').trim().toLowerCase().replace(/\s+/g, ' ')
}

function normalizeExerciseName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || null
}

function getVariantIdentityKeys(perf) {
  const keys = []
  if (perf.variantId) keys.push(`id:${perf.variantId}`)
  keys.push(`name:${normalizeVariantName(perf.variantName)}`)
  return keys
}

function getExerciseIdentityKeys(exerciseId, perf) {
  const keys = []
  if (exerciseId) keys.push(`id:${exerciseId}`)
  const byName = normalizeExerciseName(perf.exerciseName)
  if (byName) keys.push(`name:${byName}`)
  return keys
}

function getPerformanceDateKey(perf) {
  return parseDateToIso(perf.performanceDate)
}

function getCreatedAtTimestamp(perf) {
  const ts = new Date(perf.createdAt || 0).getTime()
  return Number.isFinite(ts) && ts > 0 ? ts : null
}

function isCreatedAtSameDayAsPerformanceDate(perf) {
  const perfDate = getPerformanceDateKey(perf)
  const createdDate = String(perf.createdAt || '').slice(0, 10)
  return Boolean(perfDate && createdDate && perfDate === createdDate)
}

function getPerformanceTimestamp(perf) {
  const created = getCreatedAtTimestamp(perf)
  if (created !== null && isCreatedAtSameDayAsPerformanceDate(perf)) return created
  return parseDateToTimestamp(perf.performanceDate)
}

function toNumber(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function buildHistoryIndex(historyPerformances) {
  const index = new Map()
  for (const perf of historyPerformances) {
    const reps = toNumber(perf.reps)
    const weight = toNumber(perf.weight)
    const exerciseId = perf.exerciseId
    const exerciseName = normalizeExerciseName(perf.exerciseName)
    const date = getPerformanceDateKey(perf)
    const timestamp = getPerformanceTimestamp(perf)
    if ((!exerciseId && !exerciseName) || !date || !Number.isFinite(timestamp) || !Number.isFinite(reps) || reps <= 0 || !Number.isFinite(weight) || weight < 0) {
      continue
    }

    const candidate = { reps, weight, date, timestamp }
    const exerciseKeys = getExerciseIdentityKeys(exerciseId, perf)
    const variantKeys = getVariantIdentityKeys(perf)
    for (const exKey of exerciseKeys) {
      for (const variantKey of variantKeys) {
        const baseKey = `${exKey}::${variantKey}`
        const repsMap = index.get(baseKey) || new Map()
        const existing = repsMap.get(reps) || []
        repsMap.set(reps, [...existing, candidate])
        index.set(baseKey, repsMap)
      }
    }
  }
  return index
}

function dedupeCandidates(cands) {
  const m = new Map()
  for (const c of cands) {
    const key = `${c.reps}::${c.weight}::${c.date}::${c.timestamp}`
    if (!m.has(key)) m.set(key, c)
  }
  return Array.from(m.values())
}

function pickHeaviest(candidates) {
  if (!candidates.length) return null
  return candidates.reduce((best, c) => {
    if (!best) return c
    if (c.weight > best.weight) return c
    if (Math.abs(c.weight - best.weight) <= 0.01 && c.timestamp > best.timestamp) return c
    return best
  }, null)
}

function pickClosestBelowOrEqual(candidates, currentWeight) {
  return pickHeaviest(candidates.filter((c) => c.weight <= currentWeight + 0.01))
}

function findCandidatesForReps(index, exerciseId, perf, targetReps) {
  if (!targetReps || targetReps <= 0) return []
  const exerciseKeys = getExerciseIdentityKeys(exerciseId, perf)
  if (!exerciseKeys.length) return []
  const variantKeys = getVariantIdentityKeys(perf)
  const merged = []
  for (const exKey of exerciseKeys) {
    for (const variantKey of variantKeys) {
      const repsMap = index.get(`${exKey}::${variantKey}`)
      if (!repsMap) continue
      merged.push(...(repsMap.get(targetReps) || []))
    }
  }
  return merged
}

function findAllCandidates(index, exerciseId, perf) {
  const exerciseKeys = getExerciseIdentityKeys(exerciseId, perf)
  const variantKeys = getVariantIdentityKeys(perf)
  const merged = []
  for (const exKey of exerciseKeys) {
    for (const variantKey of variantKeys) {
      const repsMap = index.get(`${exKey}::${variantKey}`)
      if (!repsMap) continue
      repsMap.forEach((cands) => merged.push(...cands))
    }
  }
  return dedupeCandidates(merged)
}

function isObsoleteReference(candidate, allCandidates) {
  return allCandidates.some((other) => (
    other !== candidate &&
    other.reps >= candidate.reps &&
    other.weight >= candidate.weight &&
    (other.reps > candidate.reps || other.weight > candidate.weight)
  ))
}

function findPreviousBest(index, exerciseId, perf) {
  const reps = toNumber(perf.reps)
  const currentWeight = toNumber(perf.weight)
  if (!reps || reps <= 0 || !Number.isFinite(currentWeight)) return null

  const all = findAllCandidates(index, exerciseId, perf)
  const exact = pickHeaviest(dedupeCandidates(findCandidatesForReps(index, exerciseId, perf, reps)))
  if (exact) return { ...exact, comparisonType: 'same-reps' }

  for (let lowerReps = reps - 1; lowerReps >= 1; lowerReps -= 1) {
    const cands = dedupeCandidates(findCandidatesForReps(index, exerciseId, perf, lowerReps)).filter((c) => !isObsoleteReference(c, all))
    if (!cands.length) continue
    const best = pickClosestBelowOrEqual(cands, currentWeight) || pickHeaviest(cands)
    return { ...best, comparisonType: 'lower-reps' }
  }
  return null
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function run() {
  // Case 1: historique importé FR date -> doit donner un PR same-reps.
  const history = [
    {
      exerciseId: 'exo-1',
      exerciseName: 'Extension triceps poulie basse',
      reps: 13,
      weight: 12.5,
      variantName: 'TOUCH   AND   GO',
      performanceDate: '07/02/2026',
      createdAt: '2026-03-06T10:00:00Z'
    }
  ]

  const current = {
    exerciseId: 'exo-1',
    exerciseName: 'Extension triceps poulie basse',
    reps: 13,
    weight: 14.7,
    variantName: 'Touch and Go',
    performanceDate: '2026-03-06',
    createdAt: '2026-03-06T20:00:00Z'
  }

  const idx = buildHistoryIndex(history)
  const previousBest = findPreviousBest(idx, 'exo-1', current)

  assert(previousBest !== null, 'Case 1: previousBest absent')
  assert(previousBest.comparisonType === 'same-reps', 'Case 1: comparisonType attendu same-reps')
  assert(Math.abs(previousBest.weight - 12.5) < 0.01, 'Case 1: poids de référence attendu 12.5')

  // Case 2: variantes strictes -> Dip != Touch and Go
  const historyDipOnly = [
    {
      exerciseId: 'exo-2',
      exerciseName: 'Extension triceps poulie basse',
      reps: 13,
      weight: 20,
      variantName: 'Dips',
      performanceDate: '2026-02-01'
    }
  ]
  const idx2 = buildHistoryIndex(historyDipOnly)
  const previousBest2 = findPreviousBest(idx2, 'exo-2', {
    exerciseId: 'exo-2',
    exerciseName: 'Extension triceps poulie basse',
    reps: 13,
    weight: 14.7,
    variantName: 'Touch and Go',
    performanceDate: '2026-03-06'
  })
  assert(previousBest2 === null, 'Case 2: variantes melangees, attendu null')

  // Case 3: fallback exercice par nom si id differe (import legacy)
  const historyByName = [
    {
      exerciseId: 'legacy-id',
      exerciseName: 'Extension triceps poulie basse',
      reps: 13,
      weight: 12.5,
      variantName: 'Touch and Go',
      performanceDate: '2026-02-07'
    }
  ]
  const idx3 = buildHistoryIndex(historyByName)
  const previousBest3 = findPreviousBest(idx3, 'new-id', {
    exerciseId: 'new-id',
    exerciseName: 'Extension triceps poulie basse',
    reps: 13,
    weight: 14.7,
    variantName: 'Touch and Go',
    performanceDate: '2026-03-06'
  })
  assert(previousBest3 !== null, 'Case 3: fallback nom exercice KO')
  assert(Math.abs(previousBest3.weight - 12.5) < 0.01, 'Case 3: mauvaise reference')

  console.log('OK - regression checks passed (3 cases)')
}

run()
