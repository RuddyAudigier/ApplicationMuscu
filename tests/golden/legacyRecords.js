// Copie VERBATIM de legacy/src/App.jsx (ligne 30 et lignes 58-455) : oracle du test golden.
// Seul changement : ajout de `export`. Ne pas modifier.

export const PR_EPSILON = 0.01

export function normalizeVariantName(value) {
  return String(value || 'Touch and Go')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

export function normalizeExerciseName(value) {
  const name = String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return name || null
}

export function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalized = typeof value === 'string'
    ? value.replace(',', '.').trim()
    : value

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

export function parseDateToIso(value) {
  if (!value) {
    return null
  }

  const raw = String(value).trim()
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
  const parsedTs = parsed.getTime()
  if (!Number.isFinite(parsedTs)) {
    return null
  }

  return parsed.toISOString().slice(0, 10)
}

export function parseDateToTimestamp(value) {
  const iso = parseDateToIso(value)
  if (!iso) {
    return null
  }

  const [year, month, day] = iso.split('-').map((part) => Number(part))
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null
  }

  const ts = new Date(year, month - 1, day).getTime()
  return Number.isFinite(ts) ? ts : null
}

export function getPerformanceDateKey(performance) {
  return parseDateToIso(performance?.performanceDate)
}

export function getCreatedAtTimestamp(performance) {
  const createdAtTs = new Date(performance?.createdAt || 0).getTime()
  if (Number.isFinite(createdAtTs) && createdAtTs > 0) {
    return createdAtTs
  }
  return null
}

export function isCreatedAtSameDayAsPerformanceDate(performance) {
  const performanceDate = getPerformanceDateKey(performance)
  const createdAtDate = String(performance?.createdAt || '').slice(0, 10)
  return Boolean(performanceDate && createdAtDate && performanceDate === createdAtDate)
}

export function getPerformanceTimestamp(performance) {
  // On veut un "timestamp" fiable pour comparer l'ordre des perfs.
  // - Si `createdAt` existe ET que c'est le même jour que `performanceDate`,
  //   on utilise `createdAt` (plus précis) pour distinguer plusieurs séries le même jour.
  // - Sinon, on retombe sur `performanceDate` (jour) qui est moins précis mais stable.
  const createdAtTs = getCreatedAtTimestamp(performance)
  if (createdAtTs !== null && isCreatedAtSameDayAsPerformanceDate(performance)) {
    return createdAtTs
  }

  const performanceDateTs = parseDateToTimestamp(performance?.performanceDate)
  if (Number.isFinite(performanceDateTs)) {
    return performanceDateTs
  }

  return null
}

export function formatWeight(weight) {
  const parsed = toNumber(weight)
  if (parsed === null) {
    return '-'
  }
  return String(Math.round(parsed * 100) / 100).replace('.', ',')
}

export function getVariantIdentityKeys(performance) {
  const keys = []
  const variantId = performance?.variantId || null
  const variantName = normalizeVariantName(performance?.variantName)

  if (variantId) {
    keys.push(`id:${variantId}`)
  }
  keys.push(`name:${variantName}`)
  return keys
}

export function getExerciseIdentityKeys(exerciseId, performance) {
  const keys = []

  if (exerciseId) {
    keys.push(`id:${exerciseId}`)
  }

  const exerciseName = normalizeExerciseName(performance?.exerciseName)
  if (exerciseName) {
    keys.push(`name:${exerciseName}`)
  }

  return keys
}

export function buildHistoryIndex(historyPerformances) {
  // Construit un index de TOUT l'historique (toutes séances) pour retrouver rapidement
  // la "meilleure référence" d'un exercice/variante à un nombre de reps donné.
  //
  // Structure:
  // Map[
  //   "<exerciseKey>::<variantKey>" => Map[
  //     reps => [ { reps, weight, date, timestamp }, ... ]
  //   ]
  // ]
  const byVariantAndReps = new Map()

  historyPerformances.forEach((performance) => {
    const reps = toNumber(performance?.reps)
    const weight = toNumber(performance?.weight)
    const exerciseId = performance?.exerciseId
    const exerciseName = normalizeExerciseName(performance?.exerciseName)
    const date = getPerformanceDateKey(performance)
    const timestamp = getPerformanceTimestamp(performance)

    if (
      (!exerciseId && !exerciseName) ||
      !date ||
      !Number.isFinite(timestamp) ||
      !Number.isFinite(reps) ||
      reps <= 0 ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      return
    }

    const candidate = {
      reps,
      weight,
      date,
      timestamp
    }

    const exerciseKeys = getExerciseIdentityKeys(exerciseId, performance)
    getVariantIdentityKeys(performance).forEach((variantKey) => {
      exerciseKeys.forEach((exerciseKey) => {
        const baseKey = `${exerciseKey}::${variantKey}`
        const repsMap = byVariantAndReps.get(baseKey) || new Map()
        const existing = repsMap.get(reps) || []
        repsMap.set(reps, [...existing, candidate])
        byVariantAndReps.set(baseKey, repsMap)
      })
    })
  })

  return byVariantAndReps
}

export function pickHeaviest(candidates) {
  // Parmi une liste de candidats, on garde la charge la plus lourde.
  // Si les charges sont quasi égales (<= 0.01), on prend la plus récente (timestamp).
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null
  }

  return candidates.reduce((best, candidate) => {
    if (!best) {
      return candidate
    }

    if (candidate.weight > best.weight) {
      return candidate
    }

    if (
      Math.abs(candidate.weight - best.weight) <= 0.01 &&
      candidate.timestamp > best.timestamp
    ) {
      return candidate
    }

    return best
  }, null)
}

export function dedupeCandidates(candidates) {
  const unique = new Map()

  candidates.forEach((candidate) => {
    const key = `${candidate?.reps}::${candidate?.weight}::${candidate?.date}::${candidate?.timestamp}`
    if (!unique.has(key)) {
      unique.set(key, candidate)
    }
  })

  return Array.from(unique.values())
}

export function findAllCandidates(index, exerciseId, performance) {
  const exerciseKeys = getExerciseIdentityKeys(exerciseId, performance)
  if (exerciseKeys.length === 0) {
    return []
  }

  const keys = getVariantIdentityKeys(performance)
  const merged = []

  exerciseKeys.forEach((exerciseKey) => {
    keys.forEach((variantKey) => {
      const repsMap = index.get(`${exerciseKey}::${variantKey}`)
      if (!repsMap) {
        return
      }

      repsMap.forEach((candidates) => {
        merged.push(...candidates)
      })
    })
  })

  return dedupeCandidates(merged)
}

export function isObsoleteReference(candidate, allCandidates) {
  // Une référence est dite "obsolète" si elle est entièrement dominée par une autre perf:
  // l'autre perf a AU MOINS autant de reps ET AU MOINS autant de charge,
  // et strictement plus sur au moins un des deux axes.
  //
  // Important: quand on l'utilise pour choisir une référence, `allCandidates` doit être
  // limité aux perfs "dans le passé" (timestamp < perf courante). Sinon une perf future
  // (ex: une série plus tard dans la même séance) peut rendre obsolète une référence
  // et casser la détection des PR hybrides.
  const candidateWeight = Number(candidate?.weight)
  const candidateReps = Number(candidate?.reps)

  return allCandidates.some((other) => (
    other !== candidate &&
    Number(other?.reps) >= candidateReps &&
    (
      Number(other?.weight) >= (candidateWeight - PR_EPSILON)
    ) &&
    (
      Number(other?.reps) > candidateReps ||
      Number(other?.weight) > (candidateWeight + PR_EPSILON)
    )
  ))
}

export function doesPerformanceMatchExercise(exercise, performance) {
  if (!exercise || !performance) {
    return false
  }

  if (exercise.id && performance.exerciseId && exercise.id === performance.exerciseId) {
    return true
  }

  const exerciseName = normalizeExerciseName(exercise.name)
  const performanceExerciseName = normalizeExerciseName(performance.exerciseName)
  if (!exerciseName || !performanceExerciseName) {
    return false
  }

  return exerciseName === performanceExerciseName
}

export function findPreviousBest(index, exerciseId, performance) {
  // Objectif: trouver une référence "précédente" (timestamp strictement inférieur) pour comparer un set actuel.
  //
  // Règle:
  // 1) On cherche d'abord à reps identiques (même nombre de reps) -> comparaison directe.
  // 2) Si pas trouvé, on cherche la rep inférieure la plus proche (reps-1, reps-2, ...) et on prend
  //    la meilleure charge à cette rep (en filtrant des références dominées par d'autres perfs).
  //
  // La fonction renvoie la perf de référence + un `comparisonType`:
  // - "same-reps" : référence à reps identiques
  // - "lower-reps": référence à une rep plus basse (la plus proche disponible)
  const reps = toNumber(performance?.reps)
  const currentWeight = toNumber(performance?.weight)
  const currentTimestamp = getPerformanceTimestamp(performance)
  const exerciseKeys = getExerciseIdentityKeys(exerciseId, performance)
  if (
    exerciseKeys.length === 0 ||
    !reps ||
    reps <= 0 ||
    !Number.isFinite(currentWeight) ||
    !Number.isFinite(currentTimestamp)
  ) {
    return null
  }

  const allCandidates = findAllCandidates(index, exerciseId, performance)
  const filterCandidates = (candidates) => dedupeCandidates(candidates)
    .filter((candidate) => candidate && candidate.timestamp < currentTimestamp)
  const previousCandidates = filterCandidates(allCandidates)
  // "PR table" (comme dans l'UI): on ne garde que les points non-dominés (frontière de Pareto).
  // Ça évite de comparer à des perfs historiques déjà "battues" (dominées) par une perf meilleure.
  const prFrontier = previousCandidates.filter((candidate) => !isObsoleteReference(candidate, previousCandidates))

  // 1) Même nombre de reps: on compare "à armes égales".
  const exactBest = pickHeaviest(prFrontier.filter((candidate) => candidate.reps === reps))
  if (exactBest) {
    return {
      ...exactBest,
      comparisonType: 'same-reps'
    }
  }

  // 2) Sinon: on descend en reps jusqu'à trouver une référence.
  // On s'arrête à la première rep inférieure qui existe.
  for (let lowerReps = reps - 1; lowerReps >= 1; lowerReps -= 1) {
    const candidatesAtLowerReps = prFrontier.filter((candidate) => candidate.reps === lowerReps)
    if (candidatesAtLowerReps.length === 0) {
      continue
    }

    // Regle demandee:
    // prendre la rep inferieure la plus proche en descendant,
    // puis comparer a la meilleure charge (la plus lourde) a cette rep.
    const lowerBest = pickHeaviest(candidatesAtLowerReps)
    return {
      ...lowerBest,
      comparisonType: 'lower-reps'
    }
  }

  // 3) Dernier cas: si une perf PR (frontière) domine déjà le set actuel (plus lourd ET + reps),
  // on renvoie cette référence pour pouvoir afficher "sous la référence" plutôt que "prise de données".
  const dominatingReference = prFrontier
    .filter((candidate) => (
      candidate.reps >= reps &&
      candidate.weight >= (currentWeight - PR_EPSILON) &&
      (candidate.reps > reps || candidate.weight > (currentWeight + PR_EPSILON))
    ))
    .sort((a, b) => {
      // Choisir la référence la "plus proche": d'abord reps les plus proches au-dessus,
      // puis la plus légère (moins punitive), puis la plus récente.
      const aRepsDelta = a.reps - reps
      const bRepsDelta = b.reps - reps
      if (aRepsDelta !== bRepsDelta) return aRepsDelta - bRepsDelta
      if (a.weight !== b.weight) return a.weight - b.weight
      return b.timestamp - a.timestamp
    })[0] || null

  if (dominatingReference) {
    return {
      ...dominatingReference,
      comparisonType: 'higher-reps'
    }
  }

  return null
}
