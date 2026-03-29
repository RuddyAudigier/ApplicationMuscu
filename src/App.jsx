import { useState, useEffect, useCallback } from 'react'
import './App.css'
import BottomNavigation from './components/BottomNavigation'
import HomePage from './pages/HomePage'
import ExercisesPage from './pages/ExercisesPage'
import SessionsPage from './pages/SessionsPage'
import SessionRunner from './pages/SessionRunner'
import PerformancesPage from './pages/PerformancesPage'
import ExerciseProgressPage from './pages/ExerciseProgressPage'
import ShareSessionPage from './pages/ShareSessionPage'
import SettingsPage from './pages/SettingsPage'
import ExerciseDetailsModal from './components/ExerciseDetailsModal'
import { normalizeMuscleGroups } from './utils/muscleGroups'
import { normalizeVariants } from './utils/variants'
import { getBaselinePerformancesForSession } from './utils/baselinePerformances'
import {
  exercisesService,
  sessionsService,
  performancesService,
  coachNotesService,
  sharedSessionsService,
  DATA_BACKEND,
  resetTestDatabase
} from './services'

const PENDING_PERFS_STORAGE_KEY = 'pending_performances_queue_v1'
const SHARE_ALGO_VERSION = 'PR-v10'
// Tolérance utilisée pour éviter les faux PR / faux "en-dessous" à cause des arrondis
// (ex: 100 vs 99.999999, ou stockage/affichage à 2 décimales).
const PR_EPSILON = 0.01

// Active ce flag temporairement si tu veux comprendre ce que le code compare.
const DEBUG_SHARE_PR = false

function buildSessionWithDetails(session, allExercises) {
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

function formatIsoToFr(isoDate) {
  const dateTs = parseDateToTimestamp(isoDate)
  if (!Number.isFinite(dateTs)) {
    return null
  }
  return new Date(dateTs).toLocaleDateString('fr-FR')
}

function normalizeVariantName(value) {
  return String(value || 'Touch and Go')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

function normalizeExerciseName(value) {
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

function toNumber(value) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const normalized = typeof value === 'string'
    ? value.replace(',', '.').trim()
    : value

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseDateToIso(value) {
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

function parseDateToTimestamp(value) {
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

function getPerformanceDateKey(performance) {
  return parseDateToIso(performance?.performanceDate)
}

function getCreatedAtTimestamp(performance) {
  const createdAtTs = new Date(performance?.createdAt || 0).getTime()
  if (Number.isFinite(createdAtTs) && createdAtTs > 0) {
    return createdAtTs
  }
  return null
}

function isCreatedAtSameDayAsPerformanceDate(performance) {
  const performanceDate = getPerformanceDateKey(performance)
  const createdAtDate = String(performance?.createdAt || '').slice(0, 10)
  return Boolean(performanceDate && createdAtDate && performanceDate === createdAtDate)
}

function getPerformanceTimestamp(performance) {
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

function formatWeight(weight) {
  const parsed = toNumber(weight)
  if (parsed === null) {
    return '-'
  }
  return String(Math.round(parsed * 100) / 100).replace('.', ',')
}

function getVariantIdentityKeys(performance) {
  const keys = []
  const variantId = performance?.variantId || null
  const variantName = normalizeVariantName(performance?.variantName)

  if (variantId) {
    keys.push(`id:${variantId}`)
  }
  keys.push(`name:${variantName}`)
  return keys
}

function getExerciseIdentityKeys(exerciseId, performance) {
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

function buildHistoryIndex(historyPerformances) {
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

function pickHeaviest(candidates) {
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

function dedupeCandidates(candidates) {
  const unique = new Map()

  candidates.forEach((candidate) => {
    const key = `${candidate?.reps}::${candidate?.weight}::${candidate?.date}::${candidate?.timestamp}`
    if (!unique.has(key)) {
      unique.set(key, candidate)
    }
  })

  return Array.from(unique.values())
}

function findAllCandidates(index, exerciseId, performance) {
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

function isObsoleteReference(candidate, allCandidates) {
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

function doesPerformanceMatchExercise(exercise, performance) {
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

function findPreviousBest(index, exerciseId, performance) {
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

function buildSharedSessionPayload(session, allExercises, allPerformances) {
  // Construit le "payload" qui servira à générer l'image de partage.
  // Important: on partage la DERNIÈRE séance réalisée (dernière date) pour cette fiche.
  const sessionWithDetails = buildSessionWithDetails(session, allExercises)
  const sessionPerformances = allPerformances.filter((performance) => (
    performance.sessionName === session.name && Boolean(performance.performanceDate)
  ))

  if (sessionPerformances.length === 0) {
    return null
  }

  const uniqueDates = Array.from(new Set(
    sessionPerformances.map((performance) => getPerformanceDateKey(performance))
  )).filter(Boolean)

  if (uniqueDates.length === 0) {
    return null
  }

  uniqueDates.sort((a, b) => b.localeCompare(a))
  const latestWorkoutDate = uniqueDates[0]

  // On ne garde que les performances du dernier jour réalisé.
  const effectiveLatestWorkoutPerformances = sessionPerformances.filter(
    (performance) => getPerformanceDateKey(performance) === latestWorkoutDate
  )

  // On indexe tout l'historique, puis on filtre dans `findPreviousBest` avec un timestamp strictement inférieur.
  // Ca permet de trouver une référence même si elle est le même jour que la séance partagée.
  const historyBestIndex = buildHistoryIndex(allPerformances)
  let totalImproved = 0
  let totalEqualed = 0
  let totalBelow = 0
  let totalDataCapture = 0

  const exercises = sessionWithDetails.exercises.map((exercise) => {
    // Toutes les performances du dernier jour qui correspondent à cet exercice.
    const exercisePerformances = effectiveLatestWorkoutPerformances.filter(
      (performance) => doesPerformanceMatchExercise(exercise, performance)
    )

    const seriesData = []
    // On veut une entrée (même vide) pour chaque numéro de série prévu dans la fiche.
    for (let serieNumber = 1; serieNumber <= exercise.series; serieNumber += 1) {
      // On peut avoir plusieurs enregistrements pour un même `serieNumber` (modifications, reprises...).
      // On prend le plus récent.
      const matchingPerformance = exercisePerformances
        .filter((performance) => performance.serieNumber === serieNumber)
        .sort((a, b) => {
          const aTs = getPerformanceTimestamp(a) || 0
          const bTs = getPerformanceTimestamp(b) || 0
          return bTs - aTs
        })[0]

      // Certaines perfs importees/anciennes peuvent manquer `exerciseName`.
      // Pour matcher l'historique (souvent indexe par nom), on fallback sur le nom de l'exercice.
      const identityPerformance = matchingPerformance
        ? { ...matchingPerformance, exerciseName: matchingPerformance.exerciseName || exercise.name }
        : matchingPerformance

      // On valide reps/weight avant de comparer (sinon: pas de comparaison).
      const reps = toNumber(identityPerformance?.reps)
      const weight = toNumber(identityPerformance?.weight)
      const hasValidPerformance = Boolean(
        Number.isFinite(reps) &&
        reps > 0 &&
        Number.isFinite(weight) &&
        weight >= 0
      )
      const previousBest = hasValidPerformance
        ? findPreviousBest(historyBestIndex, exercise.id, identityPerformance)
        : null

      if (DEBUG_SHARE_PR) {
        console.log('DEBUG PR comparison:', {
          algo: SHARE_ALGO_VERSION,
          exerciseName: exercise.name,
          serieNumber,
          current: { weight: matchingPerformance?.weight, reps: matchingPerformance?.reps },
          previousBest
        })
      }

      // `improvementStatus` est ce qui drive l'affichage de l'image:
      // - "improved": PR (record battu / record reps / PR hybride)
      // - "equaled" : record égalé (uniquement possible à reps identiques)
      // - "below"   : en-dessous de la référence (uniquement possible à reps identiques)
      // - "data-capture": prise de données (pas de référence comparable, ou référence trop différente)
      let improvementStatus = 'none'
      let improvementDelta = null
      let improvementDeltaReps = null
      let isHybridPr = false
      let isRepsPr = false
      if (hasValidPerformance) {
        // Pas de référence historique -> prise de données (première fois sur cet exo/variante/reps).
        if (!previousBest) {
          improvementStatus = 'data-capture'
        } else {
          const rawDeltaWeight = weight - previousBest.weight
          const rawDeltaReps = reps - previousBest.reps
          improvementDelta = Math.round(rawDeltaWeight * 100) / 100
          improvementDeltaReps = Math.round(rawDeltaReps * 100) / 100

          // Cas 1: référence à reps identiques.
          // Là on peut dire "PR / égalé / en-dessous" proprement.
          if (previousBest.comparisonType === 'same-reps') {
            if (rawDeltaWeight > PR_EPSILON) {
              improvementStatus = 'improved'
            } else if (Math.abs(rawDeltaWeight) <= PR_EPSILON) {
              improvementStatus = 'equaled'
            } else {
              improvementStatus = 'below'
            }
          } else if (previousBest.comparisonType === 'lower-reps') {
            // Cas 2: référence à moins de reps (rep inférieure la plus proche).
            // Ici la comparaison est "asymétrique": on compare un set à X reps
            // à une référence à (X-1) reps (ou X-2, etc).
            //
            // Interprétation simple:
            // - Si tu mets plus lourd que la référence (malgré + de reps): PR (ici on le marque "hybride"
            //   car on améliore à la fois la charge ET les reps vs la référence).
            // - Si tu mets (quasi) pareil: PR "record reps" (plus de reps à même poids).
            // - Si tu mets moins lourd: on ne dit pas "en-dessous" (ce n'est pas comparable proprement),
            //   on considère que c'est une prise de données à cette rep.
            if (rawDeltaWeight > PR_EPSILON) {
              improvementStatus = 'improved'
              isHybridPr = true
              isRepsPr = false
            } else if (Math.abs(rawDeltaWeight) <= PR_EPSILON) {
              improvementStatus = 'improved'
              // Plus de reps à poids (quasi) égal = record reps.
              isHybridPr = false
              isRepsPr = true
            } else {
              improvementStatus = 'data-capture'
              isHybridPr = false
              isRepsPr = false
            }
          } else if (previousBest.comparisonType === 'higher-reps') {
            // La référence trouvée domine déjà le set actuel (plus lourd ET plus de reps).
            // On affiche donc "sous la référence".
            improvementStatus = 'below'
            isHybridPr = false
            isRepsPr = false
          } else {
            improvementStatus = 'data-capture'
          }
        }
      }

      if (improvementStatus === 'improved') {
        totalImproved += 1
      } else if (improvementStatus === 'equaled') {
        totalEqualed += 1
      } else if (improvementStatus === 'below') {
        totalBelow += 1
      } else if (improvementStatus === 'data-capture') {
        totalDataCapture += 1
      }

      seriesData.push({
        serieNumber,
        reps: matchingPerformance?.reps ?? null,
        weight: matchingPerformance?.weight ?? null,
        rpe: matchingPerformance?.rpe ?? null,
        variantId: matchingPerformance?.variantId ?? null,
        variantName: matchingPerformance?.variantName ?? null,
        previousBestReps: previousBest?.reps ?? null,
        previousBestWeight: previousBest?.weight ?? null,
        previousBestDate: previousBest?.date ?? null,
        previousBestDateFr: previousBest?.date ? formatIsoToFr(previousBest.date) : null,
        previousBestComparisonType: previousBest?.comparisonType ?? null,
        improvementStatus,
        improvementDelta,
        improvementDeltaReps,
        isHybridPr,
        isRepsPr
      })
    }

    return {
      id: exercise.id,
      name: exercise.name,
      muscleGroups: normalizeMuscleGroups(exercise.muscleGroups || []),
      variants: normalizeVariants(exercise.variants, exercise.id),
      coachNotes: exercise.coachNotes || '',
      seriesData
    }
  })

  return {
    shareType: 'completed-workout',
    name: session.name,
    sharedAt: new Date().toLocaleDateString('fr-FR'),
    workoutDate: new Date(latestWorkoutDate).toLocaleDateString('fr-FR'),
    workoutDateISO: latestWorkoutDate,
    summary: {
      improved: totalImproved,
      equaled: totalEqualed,
      below: totalBelow,
      dataCapture: totalDataCapture
    },
    exercises
  }
}

function formatSignedWeight(value) {
  const parsed = toNumber(value)
  if (parsed === null) {
    return '-'
  }

  const rounded = Math.round(parsed * 100) / 100
  const abs = String(Math.abs(rounded)).replace('.', ',')
  return `${rounded >= 0 ? '+' : '-'}${abs}`
}

function formatSerieForShare(serie) {
  // Transforme une "serie" (objet de `seriesData`) en lignes de texte à dessiner sur l'image.
  // Si la série n'a pas de données (0 reps ET pas de charge), on ne l'affiche pas.
  const hasData = (serie?.reps ?? 0) > 0 || (serie?.weight ?? null) !== null
  if (!hasData) {
    return null
  }

  const reps = Number(serie?.reps ?? 0)
  const weight = Number(serie?.weight ?? 0)
  const rpe = serie?.rpe ? ` · RPE ${serie.rpe}` : ''
  const variant = serie?.variantName ? ` · ${serie.variantName}` : ''

  // Par défaut: prise de données (pas de PR détectable / pas de référence comparable).
  let benchmarkLine = `Prise de données à ${reps} reps`
  let status = 'data-capture'

  if (serie?.improvementStatus === 'improved') {
    if (serie?.previousBestComparisonType === 'lower-reps' && serie?.isRepsPr) {
      benchmarkLine = `▲ Record reps: +${serie.improvementDeltaReps || 0} rep(s) à ${formatWeight(weight)} kg vs ${formatWeight(serie.previousBestWeight)} kg x ${serie.previousBestReps || '-'} reps (${serie.previousBestDateFr || '-'})`
    } else if (serie?.previousBestComparisonType === 'lower-reps' && serie?.isHybridPr) {
      benchmarkLine = `▲ PR hybride: ${formatSignedWeight(serie.improvementDelta)} kg et +${serie.improvementDeltaReps || 0} rep(s) vs ${formatWeight(serie.previousBestWeight)} kg x ${serie.previousBestReps || '-'} reps (${serie.previousBestDateFr || '-'})`
    } else if (serie?.previousBestComparisonType === 'lower-reps') {
      benchmarkLine = `▲ Record battu: ${formatSignedWeight(serie.improvementDelta)} kg et +${serie.improvementDeltaReps || 0} rep(s) vs ${formatWeight(serie.previousBestWeight)} kg x ${serie.previousBestReps || '-'} reps (${serie.previousBestDateFr || '-'})`
    } else {
      benchmarkLine = `▲ Record battu: ${formatSignedWeight(serie.improvementDelta)} kg vs ${formatWeight(serie.previousBestWeight)} kg (${serie.previousBestDateFr || '-'})`
    }
    status = 'improved'
  } else if (serie?.improvementStatus === 'equaled') {
    benchmarkLine = `= Record égalé: ${formatWeight(serie.previousBestWeight)} kg (${serie.previousBestDateFr || '-'})`
    status = 'equaled'
  } else if (serie?.improvementStatus === 'below') {
    if (serie?.previousBestComparisonType === 'higher-reps') {
      benchmarkLine = `↘ Sous la référence: ${formatWeight(serie.previousBestWeight)} kg x ${serie.previousBestReps || '-'} reps (${serie.previousBestDateFr || '-'})`
    } else if (serie?.previousBestComparisonType === 'lower-reps') {
      benchmarkLine = `↘ Sous la référence: ${formatWeight(Math.abs(serie.improvementDelta))} kg sous ${formatWeight(serie.previousBestWeight)} kg x ${serie.previousBestReps || '-'} reps (${serie.previousBestDateFr || '-'})`
    } else {
      benchmarkLine = `↘ Sous la référence: ${formatWeight(Math.abs(serie.improvementDelta))} kg sous ${formatWeight(serie.previousBestWeight)} kg (${serie.previousBestDateFr || '-'})`
    }
    status = 'below'
  } else if (serie?.improvementStatus === 'data-capture') {
    status = 'data-capture'
  }

  return {
    mainLine: `S${serie.serieNumber}: ${reps} reps x ${formatWeight(weight)} kg${rpe}${variant}`,
    benchmarkLine,
    status
  }
}

async function buildWorkoutShareImageBlob(payload, mimeType = 'image/jpeg') {
  const totalPerformedSeries = payload.exercises.reduce((sum, exercise) => (
    sum + (exercise.seriesData || []).filter((serie) => (serie?.reps ?? 0) > 0 && (serie?.weight ?? null) !== null).length
  ), 0)

  const estimatedHeight = Math.max(
    1400,
    280 + (payload.exercises.length * 56) + (totalPerformedSeries * 72) + 120
  )

  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = Math.min(3600, estimatedHeight)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error("Impossible de générer l'image de partage.")
  }

  ctx.fillStyle = '#f8fafc'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#0f172a'
  ctx.font = '700 48px Arial'
  ctx.fillText(payload.name, 64, 90)

  ctx.fillStyle = '#334155'
  ctx.font = '600 28px Arial'
  ctx.fillText(`Séance réalisée le ${payload.workoutDate || '-'}`, 64, 136)

  const summary = payload.summary || { improved: 0, equaled: 0, below: 0, dataCapture: 0 }
  ctx.font = '600 22px Arial'
  ctx.fillStyle = '#166534'
  ctx.fillText(`▲ ${summary.improved} améliorées`, 64, 176)
  ctx.fillStyle = '#64748b'
  ctx.fillText(`= ${summary.equaled} égalées`, 280, 176)
  ctx.fillStyle = '#b91c1c'
  ctx.fillText(`↘ ${summary.below} en-dessous`, 468, 176)
  ctx.fillStyle = '#1e40af'
  ctx.fillText(`● ${summary.dataCapture} prises de données`, 698, 176)

  ctx.strokeStyle = '#cbd5e1'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(64, 198)
  ctx.lineTo(1136, 198)
  ctx.stroke()

  let y = 246
  const mainLineHeight = 34
  const benchmarkLineHeight = 30
  const blockSpacing = 22
  const maxY = canvas.height - 80
  let truncated = false

  for (const exercise of payload.exercises) {
    const performedSeries = (exercise.seriesData || [])
      .map(formatSerieForShare)
      .filter(Boolean)

    if (performedSeries.length === 0) {
      continue
    }

    if (y > maxY - 100) {
      truncated = true
      break
    }

    ctx.fillStyle = '#1e293b'
    ctx.font = '700 30px Arial'
    ctx.fillText(exercise.name, 64, y)
    y += 38

    ctx.fillStyle = '#334155'
    ctx.font = '500 25px Arial'

    for (const serieInfo of performedSeries) {
      if (y > maxY) {
        truncated = true
        break
      }
      ctx.fillStyle = '#334155'
      ctx.font = '500 25px Arial'
      ctx.fillText(`• ${serieInfo.mainLine}`, 84, y)
      y += mainLineHeight

      ctx.font = '600 22px Arial'
      if (serieInfo.status === 'improved') {
        ctx.fillStyle = '#166534'
      } else if (serieInfo.status === 'equaled') {
        ctx.fillStyle = '#64748b'
      } else if (serieInfo.status === 'below') {
        ctx.fillStyle = '#b91c1c'
      } else {
        ctx.fillStyle = '#1e40af'
      }
      ctx.fillText(`  ${serieInfo.benchmarkLine}`, 104, y)
      y += benchmarkLineHeight
    }

    if (truncated) {
      break
    }

    y += blockSpacing
  }

  if (truncated) {
    ctx.fillStyle = '#b91c1c'
    ctx.font = '700 24px Arial'
    ctx.fillText('… contenu tronqué (séance très longue)', 64, maxY + 24)
  }

  ctx.fillStyle = '#64748b'
  ctx.font = '500 20px Arial'
  ctx.fillText(`Partagé depuis Mon Carnet - ${payload.sharedAt} - ${SHARE_ALGO_VERSION}`, 64, canvas.height - 26)

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((generatedBlob) => {
      if (!generatedBlob) {
        reject(new Error("Impossible de finaliser l'image de partage."))
        return
      }
      resolve(generatedBlob)
    }, mimeType, 0.84)
  })

  return blob
}

function isMobileDevice() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '')
}

function isNativeCapacitorApp() {
  return Boolean(
    window?.Capacitor &&
    typeof window.Capacitor.isNativePlatform === 'function' &&
    window.Capacitor.isNativePlatform()
  )
}

function blobToBase64Data(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const parts = result.split(',')
      if (parts.length < 2) {
        reject(new Error('Conversion base64 invalide'))
        return
      }
      resolve(parts[1])
    }
    reader.onerror = () => reject(reader.error || new Error('Erreur lecture blob'))
    reader.readAsDataURL(blob)
  })
}

async function tryNativeCapacitorShareImage(imageBlob, fileName, sessionName, workoutDate) {
  if (!isNativeCapacitorApp()) {
    return false
  }

  const sharePlugin = window?.Capacitor?.Plugins?.Share
  const filesystemPlugin = window?.Capacitor?.Plugins?.Filesystem
  if (!sharePlugin?.share || !filesystemPlugin?.writeFile || !filesystemPlugin?.getUri) {
    return false
  }

  try {
    const base64Data = await blobToBase64Data(imageBlob)
    const filePath = `shares/${Date.now()}-${fileName}`

    await filesystemPlugin.writeFile({
      path: filePath,
      data: base64Data,
      directory: 'CACHE',
      recursive: true
    })

    const uriResult = await filesystemPlugin.getUri({
      path: filePath,
      directory: 'CACHE'
    })

    if (!uriResult?.uri) {
      return false
    }

    await sharePlugin.share({
      title: `Séance effectuée - ${sessionName}`,
      text: `Voici ma séance du ${workoutDate} (${sessionName})`,
      url: uriResult.uri,
      dialogTitle: 'Partager la séance'
    })

    return true
  } catch (error) {
    if (error?.name === 'AbortError') {
      return true
    }
    return false
  }
}

async function tryShareImageFile(imageFile, sessionName, workoutDate) {
  if (!navigator.share) {
    return false
  }

  try {
    // Sur certains appareils (Honor), navigator.canShare peut renvoyer false
    // alors que le partage fonctionne. On tente directement.
    await navigator.share({
      title: `Séance effectuée - ${sessionName}`,
      text: `Voici ma séance du ${workoutDate} (${sessionName})`,
      files: [imageFile]
    })
    return true
  } catch (error) {
    // Annulation utilisateur: on arrête proprement.
    if (error?.name === 'AbortError') {
      return true
    }
    return false
  }
}

async function tryCopyImageToClipboard(imageBlob) {
  if (!navigator.clipboard?.write || typeof window.ClipboardItem === 'undefined') {
    return false
  }

  try {
    const clipboardItem = new window.ClipboardItem({
      'image/png': imageBlob
    })
    await navigator.clipboard.write([clipboardItem])

    // Sur mobile, certains navigateurs "réussissent" mais ne collent rien.
    // Si possible, on vérifie réellement le contenu du presse-papiers.
    if (navigator.clipboard.read) {
      const items = await navigator.clipboard.read()
      const hasImage = items.some((item) => item.types.some((type) => type.startsWith('image/')))
      if (!hasImage) {
        return false
      }
      return true
    }

    // Sans API de lecture, on évite de promettre un succès sur mobile.
    return !isMobileDevice()
  } catch {
    return false
  }
}

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [exercises, setExercises] = useState([])
  const [sessions, setSessions] = useState([])
  const [performances, setPerformances] = useState([])
  const [progressExerciseId, setProgressExerciseId] = useState(null)
  const [ongoingSession, setOngoingSession] = useState(null)
  const [sharedSession, setSharedSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [shareAssist, setShareAssist] = useState(null)
  const [exerciseDetailsExerciseId, setExerciseDetailsExerciseId] = useState(null)
  const isMockBackend = DATA_BACKEND === 'mock'

  const closeShareAssist = useCallback(() => {
    setShareAssist((previous) => {
      if (previous?.imageUrl) {
        URL.revokeObjectURL(previous.imageUrl)
      }
      return null
    })
  }, [])

  const handleOpenExerciseDetails = useCallback((exerciseId) => {
    if (!exerciseId) {
      return
    }
    setExerciseDetailsExerciseId(exerciseId)
  }, [])

  const handleCloseExerciseDetails = useCallback(() => {
    setExerciseDetailsExerciseId(null)
  }, [])

  const handleOpenProgress = useCallback((exerciseId = null) => {
    setProgressExerciseId(exerciseId || null)
    setCurrentPage('progress')
  }, [])

  const handleShareAssistNow = useCallback(async () => {
    if (!shareAssist?.file) {
      return
    }

    const shared = await tryShareImageFile(shareAssist.file, shareAssist.sessionName, shareAssist.workoutDate)
    if (shared) {
      closeShareAssist()
      return
    }

    alert('Partage natif indisponible ici. Utilise "Copier l’image" ou appui long sur l’aperçu.')
  }, [shareAssist, closeShareAssist])

  const handleShareAssistCopyImage = useCallback(async () => {
    if (!shareAssist?.blob) {
      return
    }

    const copied = await tryCopyImageToClipboard(shareAssist.blob)
    if (copied) {
      alert('Image copiée. Colle-la dans ton message.')
      closeShareAssist()
      return
    }

    alert("Copie image indisponible ici. Appui long sur l'image puis 'Copier' ou 'Partager'.")
  }, [shareAssist, closeShareAssist])

  const handleResetTestData = useCallback(() => {
    if (!isMockBackend || typeof resetTestDatabase !== 'function') {
      return
    }

    const shouldReset = window.confirm(
      'Réinitialiser les données de test locales ?\n\nÇa efface uniquement le stockage local du mode mock (pas la base Supabase).'
    )
    if (!shouldReset) {
      return
    }

    resetTestDatabase()
    window.location.reload()
  }, [isMockBackend, resetTestDatabase])

  useEffect(() => () => {
    if (shareAssist?.imageUrl) {
      URL.revokeObjectURL(shareAssist.imageUrl)
    }
  }, [shareAssist])

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    const sharedIdFromQuery = searchParams.get('sharedId') || searchParams.get('shared')
    const sharedPathMatch = window.location.pathname.match(/^\/shared\/([0-9a-fA-F-]+)$/)

    if (sharedIdFromQuery) {
      loadSharedSession(sharedIdFromQuery)
      return
    }

    if (sharedPathMatch?.[1]) {
      loadSharedSession(sharedPathMatch[1])
      return
    }

    loadData()
  }, [])

  const loadSharedSession = async (sharedId) => {
    try {
      setLoading(true)
      const payload = await sharedSessionsService.getSharedSession(sharedId)
      if (!payload) {
        setSharedSession({
          invalid: true,
          sharedId
        })
        return
      }
      setSharedSession(payload)
    } finally {
      setLoading(false)
    }
  }

  const enqueuePendingPerformances = (payload) => {
    try {
      const existingRaw = window.localStorage.getItem(PENDING_PERFS_STORAGE_KEY)
      const existing = existingRaw ? JSON.parse(existingRaw) : []
      const next = [
        ...existing,
        {
          createdAt: new Date().toISOString(),
          payload
        }
      ]
      window.localStorage.setItem(PENDING_PERFS_STORAGE_KEY, JSON.stringify(next))
    } catch (error) {
      console.error('Erreur sauvegarde locale performances en attente:', error)
    }
  }

  const syncPendingPerformances = async () => {
    try {
      const raw = window.localStorage.getItem(PENDING_PERFS_STORAGE_KEY)
      if (!raw) {
        return
      }

      const pending = JSON.parse(raw)
      if (!Array.isArray(pending) || pending.length === 0) {
        window.localStorage.removeItem(PENDING_PERFS_STORAGE_KEY)
        return
      }

      const stillPending = []

      for (const entry of pending) {
        try {
          if (Array.isArray(entry?.payload) && entry.payload.length > 0) {
            await performancesService.addPerformances(entry.payload)
          }
        } catch {
          stillPending.push(entry)
        }
      }

      if (stillPending.length === 0) {
        window.localStorage.removeItem(PENDING_PERFS_STORAGE_KEY)
        return
      }

      window.localStorage.setItem(PENDING_PERFS_STORAGE_KEY, JSON.stringify(stillPending))
    } catch (error) {
      console.error('Erreur sync performances en attente:', error)
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      await syncPendingPerformances()
      const [exos, seances, perfs] = await Promise.all([
        exercisesService.getExercises(),
        sessionsService.getSessions(),
        performancesService.getPerformances()
      ])

      const exercisesWithNotes = await Promise.all(
        exos.map(async (exercise) => ({
          ...exercise,
          coachNotes: await coachNotesService.getCoachNotes(exercise.id)
        }))
      )

      setExercises(exercisesWithNotes)
      setSessions(seances)
      setPerformances(perfs)
    } catch (error) {
      console.error('Erreur chargement données:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddExercise = async (exerciseData) => {
    try {
      const newExercise = await exercisesService.addExercise(exerciseData)
      setExercises([...exercises, { ...newExercise, coachNotes: '' }])
    } catch (error) {
      console.error('Erreur ajout exercice:', error)
      alert("Erreur lors de l'ajout de l'exercice")
    }
  }

  const handleDeleteExercise = async (exerciseId) => {
    try {
      await exercisesService.deleteExercise(exerciseId)
      setExercises(exercises.filter((ex) => ex.id !== exerciseId))
    } catch (error) {
      console.error('Erreur suppression:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const handleUpdateExercise = async (exerciseId, exerciseData) => {
    try {
      await exercisesService.updateExercise(exerciseId, exerciseData)

      const updatedExercises = exercises.map((exercise) => (
        exercise.id === exerciseId
          ? {
            ...exercise,
            name: exerciseData.name,
            description: exerciseData.description,
            muscleGroups: normalizeMuscleGroups(exerciseData.muscleGroups),
            variants: normalizeVariants(exerciseData.variants, exerciseId)
          }
          : exercise
      ))
      setExercises(updatedExercises)

      const updatedSessions = sessions.map((session) => ({
        ...session,
        exercises: session.exercises.map((sessionExercise) => (
          sessionExercise.id === exerciseId
            ? {
              ...sessionExercise,
              name: exerciseData.name,
              muscleGroups: normalizeMuscleGroups(exerciseData.muscleGroups),
              variants: normalizeVariants(exerciseData.variants, exerciseId)
            }
            : sessionExercise
        ))
      }))
      setSessions(updatedSessions)

      if (ongoingSession) {
        const updatedOngoingSession = {
          ...ongoingSession,
          session: buildSessionWithDetails(ongoingSession.session, updatedExercises)
        }
        setOngoingSession(updatedOngoingSession)
      }
    } catch (error) {
      console.error('Erreur mise à jour exercice:', error)
      alert("Erreur lors de la mise à jour de l'exercice")
      throw error
    }
  }

  const handleAddSession = async (session) => {
    try {
      const newSession = await sessionsService.addSession(session)
      setSessions([...sessions, newSession])
    } catch (error) {
      console.error('Erreur ajout séance:', error)
      alert('Erreur lors de la création de la séance')
    }
  }

  const handleDeleteSession = async (sessionId) => {
    try {
      await sessionsService.deleteSession(sessionId)
      setSessions(sessions.filter((s) => s.id !== sessionId))

      if (ongoingSession?.session.id === sessionId) {
        setOngoingSession(null)
      }
    } catch (error) {
      console.error('Erreur suppression séance:', error)
      alert('Erreur lors de la suppression')
    }
  }

  const handleLaunchSession = (session) => {
    if (ongoingSession && ongoingSession.session.id !== session.id) {
      const shouldAbandonCurrent = window.confirm(
        'Une séance est déjà en cours. Voulez-vous l\'abandonner et démarrer cette nouvelle séance ?'
      )

      if (!shouldAbandonCurrent) {
        return
      }
    }

    if (ongoingSession && ongoingSession.session.id === session.id) {
      setCurrentPage('session-runner')
      return
    }

    const sessionWithDetails = buildSessionWithDetails(session, exercises)
    setOngoingSession({
      session: sessionWithDetails,
      progress: null
    })
    setCurrentPage('session-runner')
  }

  const handleResumeSession = (sessionId) => {
    if (ongoingSession?.session.id === sessionId) {
      setCurrentPage('session-runner')
      return
    }

    const targetSession = sessions.find((session) => session.id === sessionId)
    if (targetSession) {
      handleLaunchSession(targetSession)
    }
  }

  const handleShareSession = async (session) => {
    try {
      const baselinePerformances = await getBaselinePerformancesForSession(session?.name, exercises)
      const payload = buildSharedSessionPayload(session, exercises, [...baselinePerformances, ...performances])
      if (!payload) {
        alert('Aucune séance effectuée à partager pour cette fiche. Fais au moins une séance complète, puis partage.')
        return
      }
      let imageBlob = null
      try {
        imageBlob = await buildWorkoutShareImageBlob(payload, 'image/jpeg')
      } catch {
        imageBlob = await buildWorkoutShareImageBlob(payload, 'image/png')
      }

      const fileName = `seance-${payload.name}-${payload.workoutDateISO || 'export'}`
        .toLowerCase()
        .replace(/ /g, '-')
      const imageExtension = (imageBlob.type || 'image/jpeg').includes('png') ? 'png' : 'jpg'
      const imageFile = new File([imageBlob], `${fileName}.${imageExtension}`, { type: imageBlob.type || 'image/jpeg' })

      const didNativeShare = await tryNativeCapacitorShareImage(
        imageBlob,
        `${fileName}.${imageExtension}`,
        session.name,
        payload.workoutDate
      )
      if (didNativeShare) {
        return
      }

      let didShare = await tryShareImageFile(imageFile, session.name, payload.workoutDate)
      if (!didShare && imageExtension !== 'png') {
        const pngBlob = await buildWorkoutShareImageBlob(payload, 'image/png')
        const pngFile = new File([pngBlob], `${fileName}.png`, { type: 'image/png' })
        const didNativeSharePng = await tryNativeCapacitorShareImage(
          pngBlob,
          `${fileName}.png`,
          session.name,
          payload.workoutDate
        )
        if (didNativeSharePng) {
          return
        }
        didShare = await tryShareImageFile(pngFile, session.name, payload.workoutDate)
        if (didShare) {
          return
        }
      }

      if (didShare) {
        return
      }

      const didCopy = await tryCopyImageToClipboard(imageBlob)
      if (didCopy) {
        alert("Image copiée. Tu peux la coller directement dans ton message à ton coach.")
        return
      }
      const imageUrl = URL.createObjectURL(imageBlob)
      setShareAssist({
        imageUrl,
        blob: imageBlob,
        file: imageFile,
        sessionName: session.name,
        workoutDate: payload.workoutDate
      })
    } catch (error) {
      console.error('Erreur partage séance:', error)
      alert("Impossible de partager l'image de la séance sur ce téléphone pour le moment.")
    }
  }

  const handleProgressChange = useCallback((progress) => {
    setOngoingSession((previousState) => {
      if (!previousState) {
        return previousState
      }

      const sameIndex = previousState.progress?.currentExerciseIndex === progress.currentExerciseIndex
      const sameSeriesData = previousState.progress?.seriesData === progress.seriesData

      if (sameIndex && sameSeriesData) {
        return previousState
      }

      return {
        ...previousState,
        progress
      }
    })
  }, [])

  const handleAbandonSession = () => {
    setOngoingSession(null)
    setCurrentPage('sessions')
  }

  const handleEndSession = async (performanceData) => {
    let formattedData = []
    let sharePreparation = null
    try {
      const nowIso = new Date().toISOString()
      formattedData = performanceData.map((p) => ({
        exerciseId: p.exerciseId,
        exerciseName: p.exerciseName,
        sessionName: p.sessionName,
        reps: p.reps,
        weight: p.weight,
        rpe: p.rpe,
        variantId: p.variantId || null,
        variantName: p.variantName || null,
        performanceDate: p.performanceDate || nowIso.slice(0, 10),
        createdAt: nowIso,
        serieNumber: p.serieNumber
      }))

      // Génère l'image AVANT d'envoyer / recharger les performances,
      // pour comparer proprement à l'historique (sans effet de bord du refresh).
      try {
        const sessionForShare = ongoingSession?.session
        if (sessionForShare) {
          const baselinePerformances = await getBaselinePerformancesForSession(sessionForShare?.name, exercises)
          const payload = buildSharedSessionPayload(
            sessionForShare,
            exercises,
            [...baselinePerformances, ...performances, ...formattedData]
          )

          if (payload) {
            let imageBlob = null
            try {
              imageBlob = await buildWorkoutShareImageBlob(payload, 'image/jpeg')
            } catch {
              imageBlob = await buildWorkoutShareImageBlob(payload, 'image/png')
            }

            const fileName = `seance-${payload.name}-${payload.workoutDateISO || 'export'}`
              .toLowerCase()
              .replace(/ /g, '-')
            const imageExtension = (imageBlob.type || 'image/jpeg').includes('png') ? 'png' : 'jpg'
            const imageFile = new File([imageBlob], `${fileName}.${imageExtension}`, { type: imageBlob.type || 'image/jpeg' })

            sharePreparation = {
              payload,
              imageBlob,
              imageFile,
              fileName: `${fileName}.${imageExtension}`
            }
          }
        }
      } catch (error) {
        console.warn('Préparation image de partage ignorée:', error)
      }

      await performancesService.addPerformances(formattedData)

      const updatedPerformances = await performancesService.getPerformances()
      setPerformances(updatedPerformances)

      setOngoingSession(null)
      setCurrentPage('sessions')

      if (sharePreparation?.imageBlob && sharePreparation?.imageFile) {
        const imageUrl = URL.createObjectURL(sharePreparation.imageBlob)
        setShareAssist({
          imageUrl,
          blob: sharePreparation.imageBlob,
          file: sharePreparation.imageFile,
          sessionName: sharePreparation.payload?.name || formattedData?.[0]?.sessionName || '',
          workoutDate: sharePreparation.payload?.workoutDate || ''
        })
      }

      alert('Séance enregistrée.')
  } catch (error) {
      console.error('Erreur enregistrement séance:', error)
      enqueuePendingPerformances(formattedData)
      setOngoingSession(null)
      setCurrentPage('sessions')
      const detail = error?.message ? `\nDétail: ${error.message}` : ''
      alert(`Connexion instable: la séance est sauvegardée localement et sera envoyée automatiquement à la prochaine ouverture.${detail}`)
    }
  }

  const handleUpdateCoachNotes = async (exerciseId, coachNotes) => {
    try {
      const normalizedCoachNotes = String(coachNotes ?? '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')

      await coachNotesService.saveCoachNotes(exerciseId, normalizedCoachNotes)

      const updatedExercises = exercises.map((exercise) =>
        exercise.id === exerciseId ? { ...exercise, coachNotes: normalizedCoachNotes } : exercise
      )
      setExercises(updatedExercises)

      if (ongoingSession) {
        const updatedOngoingSession = {
          ...ongoingSession,
          session: buildSessionWithDetails(ongoingSession.session, updatedExercises)
        }
        setOngoingSession(updatedOngoingSession)
      }
    } catch (error) {
      console.error('Erreur sauvegarde remarques:', error)
      alert('Erreur lors de la sauvegarde des remarques')
    }
  }

  const handleAddManualPerformance = async (performancePayload) => {
    try {
      await performancesService.addPerformances([performancePayload])
      const updatedPerformances = await performancesService.getPerformances()
      setPerformances(updatedPerformances)
      alert('Performance ajoutée.')
    } catch (error) {
      console.error('Erreur ajout performance manuelle:', error)
      const detail = error?.message ? `\nDétail: ${error.message}` : ''
      alert(`Erreur lors de l'ajout de la performance.${detail}`)
      throw error
    }
  }

  const handleImportPerformances = async (performancesPayload) => {
    try {
      await performancesService.addPerformances(performancesPayload)
      const updatedPerformances = await performancesService.getPerformances()
      setPerformances(updatedPerformances)
    } catch (error) {
      console.error('Erreur import performances:', error)
      const detail = error?.message ? `\nDétail: ${error.message}` : ''
      alert(`Erreur lors de l'import des performances.${detail}`)
      throw error
    }
  }

  const handleBackToAppFromSharedPage = () => {
    window.location.href = `${window.location.origin}/`
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100dvh',
        color: '#334155',
        fontSize: '1rem',
        fontWeight: 600
      }}>
        Chargement des données...
      </div>
    )
  }

  if (sharedSession) {
    return (
      <ShareSessionPage
        sharedSession={sharedSession}
        onBackToApp={handleBackToAppFromSharedPage}
      />
    )
  }

  const selectedExerciseDetails = exercises.find((exercise) => exercise.id === exerciseDetailsExerciseId) || null
  const selectedExercisePerformances = selectedExerciseDetails
    ? performances.filter((performance) => performance.exerciseId === selectedExerciseDetails.id)
    : []

  return (
    <div className="app">
      {isMockBackend && (
        <div
          style={{
            background: '#fef3c7',
            borderBottom: '1px solid #f59e0b',
            color: '#92400e',
            padding: '0.55rem 0.9rem',
            fontSize: '0.92rem',
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 999
          }}
        >
          <div>
            <strong>Mode test local (mock)</strong> — aucune écriture en base.
          </div>
          <button
            type="button"
            onClick={handleResetTestData}
            style={{
              background: '#92400e',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              padding: '0.35rem 0.6rem',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            Reset données
          </button>
        </div>
      )}

      <main className="app-content">
        {currentPage === 'home' && (
          <HomePage onNavigateToExercises={() => setCurrentPage('exercises')} />
        )}

        {currentPage === 'exercises' && (
          <ExercisesPage
            exercises={exercises}
            onAddExercise={handleAddExercise}
            onDeleteExercise={handleDeleteExercise}
            onUpdateExercise={handleUpdateExercise}
            onUpdateCoachNotes={handleUpdateCoachNotes}
            onOpenExerciseDetails={handleOpenExerciseDetails}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'sessions' && (
          <SessionsPage
            exercises={exercises}
            sessions={sessions}
            onAddSession={handleAddSession}
            onDeleteSession={handleDeleteSession}
            onLaunchSession={handleLaunchSession}
            onResumeSession={handleResumeSession}
            onShareSession={handleShareSession}
            activeSessionId={ongoingSession?.session.id || null}
            onOpenExerciseDetails={handleOpenExerciseDetails}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'performances' && (
          <PerformancesPage
            performances={performances}
            exercises={exercises}
            onAddPerformance={handleAddManualPerformance}
            onImportPerformances={handleImportPerformances}
            onOpenExerciseDetails={handleOpenExerciseDetails}
            onOpenProgress={() => handleOpenProgress(null)}
            onOpenExerciseProgress={(exerciseId) => handleOpenProgress(exerciseId)}
            onNavigate={setCurrentPage}
          />
        )}

        {currentPage === 'progress' && (
          <ExerciseProgressPage
            exercises={exercises}
            performances={performances}
            initialExerciseId={progressExerciseId}
            onBack={() => setCurrentPage('performances')}
          />
        )}

        {currentPage === 'session-runner' && ongoingSession?.session && (
          <SessionRunner
            session={ongoingSession.session}
            performances={performances}
            initialState={ongoingSession.progress}
            onProgressChange={handleProgressChange}
            onEndSession={handleEndSession}
            onAbandonSession={handleAbandonSession}
            onOpenExerciseDetails={handleOpenExerciseDetails}
          />
        )}

        {currentPage === 'settings' && (
          <SettingsPage />
        )}
      </main>

      <ExerciseDetailsModal
        exercise={selectedExerciseDetails}
        performances={selectedExercisePerformances}
        onClose={handleCloseExerciseDetails}
      />

      {shareAssist && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'var(--bg-overlay-strong)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0.9rem'
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '760px',
              maxHeight: '92dvh',
              overflow: 'auto',
              borderRadius: '14px',
              background: 'rgba(17, 26, 51, 0.88)',
              padding: '0.95rem',
              border: '1px solid var(--border-color)',
              backdropFilter: 'blur(18px)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <h3 style={{ margin: '0 0 0.35rem 0', color: 'var(--text-primary)' }}>Partage de la séance</h3>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Si le partage auto ne marche pas, appui long sur l&apos;image puis partage.
            </p>
            <div style={{ display: 'flex', gap: '0.55rem', flexWrap: 'wrap', margin: '0.75rem 0' }}>
              <button type="button" className="btn btn-primary" onClick={handleShareAssistNow}>
                Partager maintenant
              </button>
              <button type="button" className="btn btn-secondary" onClick={handleShareAssistCopyImage}>
                Copier l&apos;image
              </button>
              <button type="button" className="btn btn-secondary" onClick={closeShareAssist}>
                Fermer
              </button>
            </div>
            <img
              src={shareAssist.imageUrl}
              alt="Aperçu partage séance"
              style={{
                width: '100%',
                borderRadius: '12px',
                border: '1px solid rgba(248, 250, 252, 0.14)',
                display: 'block'
              }}
            />
          </div>
        </div>
      )}

      <BottomNavigation currentPage={currentPage} onNavigate={setCurrentPage} />
    </div>
  )
}

export default App
