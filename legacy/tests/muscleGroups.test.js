import { describe, it, expect } from 'vitest'
import { normalizeMuscleGroups } from '../src/utils/muscleGroups'

describe('muscleGroups', () => {
  describe('normalizeMuscleGroups', () => {
    it('should return empty array for non-array input', () => {
      expect(normalizeMuscleGroups(null)).toEqual([])
      expect(normalizeMuscleGroups(undefined)).toEqual([])
      expect(normalizeMuscleGroups('Pectoraux')).toEqual([])
      expect(normalizeMuscleGroups({})).toEqual([])
    })

    it('should trim whitespace', () => {
      const result = normalizeMuscleGroups(['  Pectoraux  ', ' Back '])
      expect(result).toEqual(['Pectoraux', 'Back'])
    })

    it('should filter empty strings', () => {
      const result = normalizeMuscleGroups(['Pectoraux', '', '  ', 'Back'])
      expect(result).toEqual(['Pectoraux', 'Back'])
    })

    it('should remove duplicates (case-insensitive)', () => {
      const result = normalizeMuscleGroups(['Pectoraux', 'pectoraux', 'PECTORAUX', 'Back'])
      expect(result).toEqual(['Pectoraux', 'Back'])
    })

    it('should preserve first occurrence case', () => {
      const result = normalizeMuscleGroups(['PeCtOraUx', 'pectoraux', 'PECTORAUX'])
      expect(result[0]).toBe('PeCtOraUx')
    })

    it('should handle all common muscle groups', () => {
      const groups = [
        'Pectoraux',
        'Back',
        'Biceps',
        'Triceps',
        'Épaules',
        'Quadriceps',
        'Hamstrings',
        'Fessiers'
      ]
      const result = normalizeMuscleGroups(groups)
      expect(result).toEqual(groups)
    })

    it('should handle mixed case and accents', () => {
      const result = normalizeMuscleGroups(['ÉPAULES', 'épaules', 'Épaules'])
      expect(result).toHaveLength(1)
      expect(result[0]).toBe('ÉPAULES')
    })

    it('should filter non-string items', () => {
      const result = normalizeMuscleGroups(['Pectoraux', null, 123, { name: 'Back' }, 'Triceps'])
      expect(result).toEqual(['Pectoraux', 'Triceps'])
    })

    it('should handle empty array', () => {
      expect(normalizeMuscleGroups([])).toEqual([])
    })

    it('should maintain order of first occurrences', () => {
      const result = normalizeMuscleGroups(['Triceps', 'Pectoraux', 'Back', 'pectoraux', 'triceps'])
      expect(result).toEqual(['Triceps', 'Pectoraux', 'Back'])
    })
  })
})
