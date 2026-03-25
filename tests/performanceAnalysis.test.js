import { describe, it, expect, beforeEach } from 'vitest'
import { PerformanceExtractor, PerformanceIdentifier, PerformanceAnalyzer } from '../src/utils/performanceAnalysis'

describe('PerformanceExtractor', () => {
  describe('getDateKey', () => {
    it('should return ISO date from performance date', () => {
      const perf = { performanceDate: '2026-03-24' }
      expect(PerformanceExtractor.getDateKey(perf)).toBe('2026-03-24')
    })

    it('should return null for missing date', () => {
      expect(PerformanceExtractor.getDateKey({})).toBeNull()
    })
  })

  describe('getCreatedAtTimestamp', () => {
    it('should return timestamp of createdAt', () => {
      const iso = '2026-03-24T10:30:00Z'
      const ts = new Date(iso).getTime()
      const perf = { createdAt: iso }
      expect(PerformanceExtractor.getCreatedAtTimestamp(perf)).toBe(ts)
    })

    it('should return null for invalid timestamp', () => {
      expect(PerformanceExtractor.getCreatedAtTimestamp({})).toBeNull()
    })

    it('should return null for zero/negative timestamp', () => {
      expect(PerformanceExtractor.getCreatedAtTimestamp({ createdAt: '1970-01-01' })).toBeNull()
    })
  })

  describe('isCreatedAtSameDayAsPerformanceDate', () => {
    it('should return true when created and performed same day', () => {
      const perf = {
        performanceDate: '2026-03-24',
        createdAt: '2026-03-24T10:30:00Z'
      }
      expect(PerformanceExtractor.isCreatedAtSameDayAsPerformanceDate(perf)).toBe(true)
    })

    it('should return false when different days', () => {
      const perf = {
        performanceDate: '2026-03-24',
        createdAt: '2026-03-23T10:30:00Z'
      }
      expect(PerformanceExtractor.isCreatedAtSameDayAsPerformanceDate(perf)).toBe(false)
    })

    it('should return false for missing data', () => {
      expect(PerformanceExtractor.isCreatedAtSameDayAsPerformanceDate({})).toBe(false)
    })
  })

  describe('getTimestamp', () => {
    it('should use createdAt when same day as performanceDate', () => {
      const iso = '2026-03-24T10:30:00Z'
      const ts = new Date(iso).getTime()
      const perf = {
        performanceDate: '2026-03-24',
        createdAt: iso
      }
      expect(PerformanceExtractor.getTimestamp(perf)).toBe(ts)
    })

    it('should use performanceDate as fallback', () => {
      const perf = {
        performanceDate: '2026-03-24',
        createdAt: '2026-03-23T10:30:00Z'
      }
      const expected = new Date(2026, 2, 24).getTime()
      expect(PerformanceExtractor.getTimestamp(perf)).toBe(expected)
    })

    it('should return null for invalid data', () => {
      expect(PerformanceExtractor.getTimestamp({})).toBeNull()
    })
  })
})

describe('PerformanceIdentifier', () => {
  describe('getVariantKeys', () => {
    it('should include variant ID if present', () => {
      const perf = { variantId: 'var-123', variantName: 'Pause' }
      const keys = PerformanceIdentifier.getVariantKeys(perf)
      expect(keys).toContain('id:var-123')
    })

    it('should always include variant name key', () => {
      const perf = { variantName: 'Pause' }
      const keys = PerformanceIdentifier.getVariantKeys(perf)
      expect(keys).toContain('name:pause')
    })

    it('should normalize variant name', () => {
      const perf = { variantName: 'PAUSE' }
      const keys = PerformanceIdentifier.getVariantKeys(perf)
      expect(keys).toContain('name:pause')
    })

    it('should default to Touch and Go', () => {
      const perf = {}
      const keys = PerformanceIdentifier.getVariantKeys(perf)
      expect(keys).toContain('name:touch and go')
    })
  })

  describe('getExerciseKeys', () => {
    it('should include exercise ID if present', () => {
      const keys = PerformanceIdentifier.getExerciseKeys('ex-123', { exerciseName: 'Bench' })
      expect(keys).toContain('id:ex-123')
    })

    it('should include normalized exercise name', () => {
      const keys = PerformanceIdentifier.getExerciseKeys(null, { exerciseName: 'Développé Couché' })
      expect(keys).toContain('name:developpe couche')
    })

    it('should handle no keys', () => {
      const keys = PerformanceIdentifier.getExerciseKeys(null, { exerciseName: '' })
      expect(keys.length).toBe(0)
    })
  })

  describe('getCompositeKey', () => {
    it('should create composite key', () => {
      const key = PerformanceIdentifier.getCompositeKey('id:ex-123', 'name:pause')
      expect(key).toBe('id:ex-123::name:pause')
    })
  })
})

describe('PerformanceAnalyzer', () => {
  describe('buildHistoryIndex', () => {
    it('should build index from performances', () => {
      const perfs = [
        {
          exerciseId: 'ex-1',
          variantId: 'var-1',
          reps: 5,
          weight: 90,
          performanceDate: '2026-03-24',
          createdAt: '2026-03-24T10:00:00Z'
        }
      ]
      const index = PerformanceAnalyzer.buildHistoryIndex(perfs)
      expect(index.size).toBeGreaterThan(0)
    })

    it('should skip invalid performances', () => {
      const perfs = [
        { exerciseId: 'ex-1' }, // missing reps/weight
        { reps: 5, weight: null }, // invalid weight
        { reps: 'invalid', weight: 90 } // invalid reps
      ]
      const index = PerformanceAnalyzer.buildHistoryIndex(perfs)
      expect(index.size).toBe(0)
    })

    it('should skip negative weights', () => {
      const perfs = [
        {
          exerciseId: 'ex-1',
          reps: 5,
          weight: -90,
          performanceDate: '2026-03-24',
          createdAt: '2026-03-24T10:00:00Z'
        }
      ]
      const index = PerformanceAnalyzer.buildHistoryIndex(perfs)
      expect(index.size).toBe(0)
    })

    it('should skip zero or negative reps', () => {
      const perfs = [
        {
          exerciseId: 'ex-1',
          reps: 0,
          weight: 90,
          performanceDate: '2026-03-24',
          createdAt: '2026-03-24T10:00:00Z'
        }
      ]
      const index = PerformanceAnalyzer.buildHistoryIndex(perfs)
      expect(index.size).toBe(0)
    })
  })

  describe('findBestReference', () => {
    let index

    beforeEach(() => {
      const perfs = [
        {
          exerciseId: 'ex-1',
          reps: 5,
          weight: 90,
          performanceDate: '2026-03-20',
          createdAt: '2026-03-20T10:00:00Z'
        },
        {
          exerciseId: 'ex-1',
          reps: 5,
          weight: 92.5,
          performanceDate: '2026-03-24',
          createdAt: '2026-03-24T10:00:00Z'
        },
        {
          exerciseId: 'ex-1',
          reps: 4,
          weight: 95,
          performanceDate: '2026-03-10',
          createdAt: '2026-03-10T10:00:00Z'
        }
      ]
      index = PerformanceAnalyzer.buildHistoryIndex(perfs)
    })

    it('should find exact reps match (latest)', () => {
      const key = 'id:ex-1::name:touch and go'
      const ref = PerformanceAnalyzer.findBestReference(index, key, 5)
      expect(ref?.weight).toBe(92.5)
      expect(ref?.reps).toBe(5)
    })

    it('should find lower reps reference', () => {
      const key = 'id:ex-1::name:touch and go'
      const ref = PerformanceAnalyzer.findBestReference(index, key, 6)
      expect(ref?.reps).toBe(5)
    })

    it('should return null for no match', () => {
      const key = 'id:ex-999::name:pause'
      const ref = PerformanceAnalyzer.findBestReference(index, key, 5)
      expect(ref).toBeNull()
    })
  })
})
