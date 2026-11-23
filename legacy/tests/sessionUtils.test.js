import { describe, it, expect } from 'vitest'
import { SessionBuilder } from '../src/utils/sessionUtils'

describe('SessionBuilder', () => {
  describe('buildWithDetails', () => {
    it('should enrich session with exercise details', () => {
      const session = {
        id: 'sess-1',
        name: 'Upper',
        exercises: [
          { id: 'ex-1', seriesCount: 3 },
          { id: 'ex-2', seriesCount: 4 }
        ]
      }

      const allExercises = [
        {
          id: 'ex-1',
          name: 'Bench',
          muscleGroups: ['Pectoraux', 'Triceps'],
          variants: [{ id: 'var-1', name: 'Touch and Go' }],
          coachNotes: 'Form check needed'
        },
        {
          id: 'ex-2',
          name: 'Rows',
          muscleGroups: ['Back'],
          variants: [{ id: 'var-2', name: 'Pause' }],
          coachNotes: ''
        }
      ]

      const result = SessionBuilder.buildWithDetails(session, allExercises)

      expect(result.id).toBe('sess-1')
      expect(result.exercises).toHaveLength(2)
      expect(result.exercises[0].muscleGroups).toContain('Pectoraux')
      expect(result.exercises[0].coachNotes).toBe('Form check needed')
      expect(result.exercises[1].muscleGroups).toContain('Back')
    })

    it('should use session exercise defaults if not in allExercises', () => {
      const session = {
        id: 'sess-1',
        exercises: [
          { id: 'ex-1', seriesCount: 3, muscleGroups: ['Default Group'] }
        ]
      }

      const allExercises = []

      const result = SessionBuilder.buildWithDetails(session, allExercises)

      expect(result.exercises[0].muscleGroups).toContain('Default Group')
      expect(result.exercises[0].coachNotes).toBe('')
    })

    it('should handle empty exercises', () => {
      const session = { id: 'sess-1', exercises: [] }
      const allExercises = []

      const result = SessionBuilder.buildWithDetails(session, allExercises)

      expect(result.exercises).toHaveLength(0)
    })

    it('should normalize muscle groups', () => {
      const session = {
        id: 'sess-1',
        exercises: [{ id: 'ex-1' }]
      }

      const allExercises = [
        {
          id: 'ex-1',
          muscleGroups: ['  Pectoraux  ', 'triceps'],
          variants: [],
          coachNotes: ''
        }
      ]

      const result = SessionBuilder.buildWithDetails(session, allExercises)
      const groups = result.exercises[0].muscleGroups

      expect(groups).toBeDefined()
      expect(Array.isArray(groups)).toBe(true)
    })

    it('should normalize variants', () => {
      const session = {
        id: 'sess-1',
        exercises: [{ id: 'ex-1' }]
      }

      const allExercises = [
        {
          id: 'ex-1',
          muscleGroups: [],
          variants: [{ name: 'Pause' }],
          coachNotes: ''
        }
      ]

      const result = SessionBuilder.buildWithDetails(session, allExercises)

      expect(result.exercises[0].variants).toBeDefined()
      expect(Array.isArray(result.exercises[0].variants)).toBe(true)
    })

    it('should preserve original session data', () => {
      const session = {
        id: 'sess-1',
        name: 'My Session',
        createdAt: '2026-03-24',
        exercises: []
      }

      const result = SessionBuilder.buildWithDetails(session, [])

      expect(result.id).toBe('sess-1')
      expect(result.name).toBe('My Session')
      expect(result.createdAt).toBe('2026-03-24')
    })
  })
})
