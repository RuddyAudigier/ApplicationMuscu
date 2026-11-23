import * as supabaseServices from './supabaseService'
import * as mockServices from './mockService'

const rawBackend = String(import.meta.env.VITE_DATA_BACKEND || '').trim().toLowerCase()
export const DATA_BACKEND = rawBackend === 'mock' || rawBackend === 'local' || rawBackend === 'test'
  ? 'mock'
  : 'supabase'

const services = DATA_BACKEND === 'mock' ? mockServices : supabaseServices

export const exercisesService = services.exercisesService
export const sessionsService = services.sessionsService
export const performancesService = services.performancesService
export const coachNotesService = services.coachNotesService
export const sharedSessionsService = services.sharedSessionsService
export const generalAdviceService = services.generalAdviceService

// Utils optionnels (uniquement utiles en mode `mock`).
export const resetTestDatabase = DATA_BACKEND === 'mock'
  ? mockServices.resetMockDatabase
  : null

