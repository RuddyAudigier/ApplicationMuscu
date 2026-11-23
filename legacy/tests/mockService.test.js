import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as mockService from '../src/services/mockService'

describe('mockService - exercisesService', () => {
  beforeEach(() => {
    localStorage.clear()
    if (mockService.resetMockDatabase) {
      mockService.resetMockDatabase()
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getExercises', () => {
    it('should return seed exercises', async () => {
      const exercises = await mockService.exercisesService.getExercises()
      expect(Array.isArray(exercises)).toBe(true)
      expect(exercises.length).toBeGreaterThan(0)
    })

    it('should return exercises with required fields', async () => {
      const exercises = await mockService.exercisesService.getExercises()
      exercises.forEach((exercise) => {
        expect(exercise.id).toBeDefined()
        expect(exercise.name).toBeDefined()
        expect(exercise.description).toBeDefined()
        expect(Array.isArray(exercise.muscleGroups)).toBe(true)
        expect(Array.isArray(exercise.variants)).toBe(true)
      })
    })
  })

  describe('addExercise', () => {
    it('should add new exercise', async () => {
      const newExercise = {
        name: 'Test Exercise',
        description: 'Test',
        muscleGroups: ['Pectoraux'],
        variants: [{ name: 'Standard' }],
        isCustom: true
      }

      const exercise = await mockService.exercisesService.addExercise(newExercise)

      expect(exercise.id).toBeDefined()
      expect(exercise.name).toBe('Test Exercise')
      expect(exercise.isCustom).toBe(true)
    })

    it('should throw error for empty name', async () => {
      const invalidExercise = {
        name: '',
        description: 'Test'
      }

      await expect(mockService.exercisesService.addExercise(invalidExercise)).rejects.toThrow()
    })

    it('should trim exercise name', async () => {
      const newExercise = {
        name: '  Bench Press  ',
        description: 'Test'
      }

      const exercise = await mockService.exercisesService.addExercise(newExercise)

      expect(exercise.name).toBe('Bench Press')
    })

    it('should create variants with IDs', async () => {
      const newExercise = {
        name: 'Bench',
        variants: [{ name: 'Standard' }, { name: 'Pause' }]
      }

      const exercise = await mockService.exercisesService.addExercise(newExercise)

      exercise.variants.forEach((variant) => {
        expect(variant.id).toBeDefined()
        expect(variant.exerciseId).toBe(exercise.id)
      })
    })
  })

  describe('deleteExercise', () => {
    it('should delete exercise', async () => {
      const exercises = await mockService.exercisesService.getExercises()
      const firstId = exercises[0].id

      await mockService.exercisesService.deleteExercise(firstId)

      const updated = await mockService.exercisesService.getExercises()
      expect(updated.find((e) => e.id === firstId)).toBeUndefined()
    })
  })

  describe('updateExercise', () => {
    it('should update exercise', async () => {
      const exercises = await mockService.exercisesService.getExercises()
      const exercise = exercises[0]

      const updated = await mockService.exercisesService.updateExercise(exercise.id, {
        name: exercise.name,
        description: 'Updated'
      })

      expect(updated.description).toBe('Updated')
    })

    it('should throw error if name is empty', async () => {
      const exercises = await mockService.exercisesService.getExercises()
      const exercise = exercises[0]

      await expect(
        mockService.exercisesService.updateExercise(exercise.id, { name: '' })
      ).rejects.toThrow()
    })
  })
})

describe('mockService - sessionsService', () => {
  beforeEach(() => {
    localStorage.clear()
    if (mockService.resetMockDatabase) {
      mockService.resetMockDatabase()
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getSessions', () => {
    it('should return sessions', async () => {
      const sessions = await mockService.sessionsService.getSessions()
      expect(Array.isArray(sessions)).toBe(true)
    })
  })

  describe('addSession', () => {
    it('should add new session', async () => {
      const newSession = {
        name: 'New Session',
        exercises: []
      }

      const session = await mockService.sessionsService.addSession(newSession)

      expect(session.id).toBeDefined()
      expect(session.name).toBe('New Session')
      expect(session.exercises).toEqual([])
    })
  })

  describe('deleteSession', () => {
    it('should delete session', async () => {
      const sessions = await mockService.sessionsService.getSessions()
      const firstId = sessions[0].id

      await mockService.sessionsService.deleteSession(firstId)

      const updated = await mockService.sessionsService.getSessions()
      expect(updated.find((s) => s.id === firstId)).toBeUndefined()
    })
  })
})

describe('mockService - performancesService', () => {
  beforeEach(() => {
    localStorage.clear()
    if (mockService.resetMockDatabase) {
      mockService.resetMockDatabase()
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getPerformances', () => {
    it('should return performances', async () => {
      const performances = await mockService.performancesService.getPerformances()
      expect(Array.isArray(performances)).toBe(true)
    })
  })

  describe('addPerformances', () => {
    it('should add performances', async () => {
      const exercises = await mockService.exercisesService.getExercises()
      const newPerformances = [
        {
          exercise_id: exercises[0].id,
          exercise_name: exercises[0].name,
          reps: 8,
          weight: 100,
          rpe: 8,
          performance_date: '2026-03-24'
        }
      ]

      await mockService.performancesService.addPerformances(newPerformances)

      const performances = await mockService.performancesService.getPerformances()
      expect(performances.length).toBeGreaterThan(0)
    })
  })
})

describe('mockService - coachNotesService', () => {
  beforeEach(() => {
    localStorage.clear()
    if (mockService.resetMockDatabase) {
      mockService.resetMockDatabase()
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getCoachNotes', () => {
    it('should return coach notes as string', async () => {
      const notes = await mockService.coachNotesService.getCoachNotes('ex-123')
      expect(typeof notes).toBe('string')
    })

    it('should return empty string for non-existent exercise', async () => {
      const notes = await mockService.coachNotesService.getCoachNotes('non-existent')
      expect(notes).toBe('')
    })
  })

  describe('saveCoachNotes', () => {
    it('should save coach notes', async () => {
      const exerciseId = 'ex-test-' + Date.now()
      await mockService.coachNotesService.saveCoachNotes(exerciseId, 'Test note')

      const retrieved = await mockService.coachNotesService.getCoachNotes(exerciseId)
      expect(retrieved).toBe('Test note')
    })

    it('should throw error without exerciseId', async () => {
      await expect(
        mockService.coachNotesService.saveCoachNotes(null, 'Note')
      ).rejects.toThrow()
    })
  })
})

describe('mockService - generalAdviceService', () => {
  beforeEach(() => {
    localStorage.clear()
    if (mockService.resetMockDatabase) {
      mockService.resetMockDatabase()
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getGeneralAdvice', () => {
    it('should return general advice object', async () => {
      const advice = await mockService.generalAdviceService.getGeneralAdvice()
      expect(typeof advice).toBe('object')
    })
  })

  describe('saveGeneralAdvice', () => {
    it('should save general advice', async () => {
      const newAdvice = {
        training: 'Updated training',
        nutrition: 'Updated nutrition',
        sleep: 'Updated sleep'
      }

      await mockService.generalAdviceService.saveGeneralAdvice(newAdvice)

      const retrieved = await mockService.generalAdviceService.getGeneralAdvice()
      expect(retrieved.training).toBe('Updated training')
      expect(retrieved.nutrition).toBe('Updated nutrition')
      expect(retrieved.sleep).toBe('Updated sleep')
    })
  })
})

describe('mockService - sharedSessionsService', () => {
  beforeEach(() => {
    localStorage.clear()
    if (mockService.resetMockDatabase) {
      mockService.resetMockDatabase()
    }
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getSharedSession', () => {
    it('should handle missing share ID', async () => {
      const result = await mockService.sharedSessionsService.getSharedSession('non-existent')
      expect(result).toBeNull()
    })
  })
})
