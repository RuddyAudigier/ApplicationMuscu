/**
 * Performance utilities (Single Responsibility: extraction et analysis de données)
 */

import { NumberFormatter, NameNormalizer, parseDateToTimestamp, DateFormatter } from './formatters'

export const PerformanceExtractor = {
  /**
   * Get the performance date in ISO format
   */
  getDateKey(performance) {
    return DateFormatter.parseToIso(performance?.performanceDate)
  },

  /**
   * Get timestamp of performance creation
   */
  getCreatedAtTimestamp(performance) {
    const createdAtTs = new Date(performance?.createdAt || 0).getTime()
    if (Number.isFinite(createdAtTs) && createdAtTs > 0) {
      return createdAtTs
    }
    return null
  },

  /**
   * Check if creation date and performance date are the same day
   */
  isCreatedAtSameDayAsPerformanceDate(performance) {
    const performanceDate = this.getDateKey(performance)
    const createdAtDate = String(performance?.createdAt || '').slice(0, 10)
    return Boolean(performanceDate && createdAtDate && performanceDate === createdAtDate)
  },

  /**
   * Get reliable timestamp for sorting performances
   * Uses createdAt if same day as performanceDate, else uses performanceDate
   */
  getTimestamp(performance) {
    const createdAtTs = this.getCreatedAtTimestamp(performance)
    if (createdAtTs !== null && this.isCreatedAtSameDayAsPerformanceDate(performance)) {
      return createdAtTs
    }

    const performanceDateTs = parseDateToTimestamp(performance?.performanceDate)
    if (Number.isFinite(performanceDateTs)) {
      return performanceDateTs
    }

    return null
  }
}

export const PerformanceIdentifier = {
  /**
   * Get variant identity keys for a performance
   */
  getVariantKeys(performance) {
    const keys = []
    const variantId = performance?.variantId || null
    const variantName = NameNormalizer.variant(performance?.variantName)

    if (variantId) {
      keys.push(`id:${variantId}`)
    }
    keys.push(`name:${variantName}`)
    return keys
  },

  /**
   * Get exercise identity keys for a performance
   */
  getExerciseKeys(exerciseId, performance) {
    const keys = []

    if (exerciseId) {
      keys.push(`id:${exerciseId}`)
    }

    const exerciseName = NameNormalizer.exercise(performance?.exerciseName)
    if (exerciseName) {
      keys.push(`name:${exerciseName}`)
    }

    return keys
  },

  /**
   * Build composite key for exercise variant combination
   */
  getCompositeKey(exerciseKey, variantKey) {
    return `${exerciseKey}::${variantKey}`
  }
}

export const PerformanceAnalyzer = {
  /**
   * Build index of all performances for quick lookups
   */
  buildHistoryIndex(historyPerformances) {
    const byVariantAndReps = new Map()

    historyPerformances.forEach((performance) => {
      const reps = NumberFormatter.toNumber(performance?.reps)
      const weight = NumberFormatter.toNumber(performance?.weight)
      const exerciseId = performance?.exerciseId
      const date = PerformanceExtractor.getDateKey(performance)
      const timestamp = PerformanceExtractor.getTimestamp(performance)

      if (
        (!exerciseId && !NameNormalizer.exercise(performance?.exerciseName)) ||
        !date ||
        !Number.isFinite(timestamp) ||
        !Number.isFinite(reps) ||
        reps <= 0 ||
        !Number.isFinite(weight) ||
        weight < 0
      ) {
        return
      }

      const candidate = { reps, weight, date, timestamp }

      const exerciseKeys = PerformanceIdentifier.getExerciseKeys(exerciseId, performance)
      PerformanceIdentifier.getVariantKeys(performance).forEach((variantKey) => {
        exerciseKeys.forEach((exerciseKey) => {
          const baseKey = PerformanceIdentifier.getCompositeKey(exerciseKey, variantKey)
          const repsMap = byVariantAndReps.get(baseKey) || new Map()
          const existing = repsMap.get(reps) || []
          repsMap.set(reps, [...existing, candidate])
          byVariantAndReps.set(baseKey, repsMap)
        })
      })
    })

    return byVariantAndReps
  },

  /**
   * Find best reference performance for comparison
   */
  findBestReference(index, key, reps) {
    const repsMap = index.get(key)
    if (!repsMap || repsMap.size === 0) return null

    // Try exact reps match first
    let candidates = repsMap.get(reps)
    if (candidates && candidates.length > 0) {
      return candidates.reduce((best, current) => 
        current.timestamp > best.timestamp ? current : best
      )
    }

    // Try lower reps references
    const lowerReps = Array.from(repsMap.keys())
      .filter(r => r < reps)
      .sort((a, b) => b - a)

    for (const r of lowerReps) {
      const candidates = repsMap.get(r)
      const best = candidates.reduce((best, current) => 
        current.timestamp > best.timestamp ? current : best
      )
      if (best.weight >= 0) return best
    }

    return null
  }
}
