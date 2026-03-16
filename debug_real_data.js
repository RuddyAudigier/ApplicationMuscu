// Script pour déboguer les données réelles de la base de données
import { performancesService } from './src/services/supabaseService.js'

// Fonctions utilitaires copiées depuis App.jsx
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

function getPerformanceDateKey(perf) {
  return parseDateToIso(perf.performanceDate)
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

async function debugRealData() {
  console.log('=== Debug des données réelles ===')
  
  try {
    // Récupérer toutes les performances
    const allPerformances = await performancesService.getPerformances()
    console.log(`Total performances dans la base: ${allPerformances.length}`)
    
    // Filtrer pour la séance "Cycle 2 : haut du corps"
    const sessionPerformances = allPerformances.filter(p => 
      p.sessionName === 'Cycle 2 : haut du corps' && p.performanceDate
    )
    console.log(`Performances pour la séance "Cycle 2 : haut du corps": ${sessionPerformances.length}`)
    
    // Grouper par date
    const byDate = new Map()
    sessionPerformances.forEach(p => {
      const dateKey = getPerformanceDateKey(p)
      if (!byDate.has(dateKey)) {
        byDate.set(dateKey, [])
      }
      byDate.get(dateKey).push(p)
    })
    
    console.log('\nPerformances par date:')
    for (const [date, perfs] of byDate.entries()) {
      console.log(`\n${date}:`)
      perfs.forEach(p => {
        console.log(`  - ${p.exerciseName} S${p.serieNumber}: ${p.weight}kg x ${p.reps} reps (${p.variantName})`)
      })
    }
    
    // Regarder spécifiquement le développé couché
    const devCouchePerfs = sessionPerformances.filter(p => 
      p.exerciseName.includes('Développé') || p.exerciseName.includes('développé')
    )
    console.log(`\nDéveloppé couché performances: ${devCouchePerfs.length}`)
    devCouchePerfs.forEach(p => {
      console.log(`  - S${p.serieNumber}: ${p.weight}kg x ${p.reps} reps le ${p.performanceDate}`)
    })
    
    // Chercher la performance 65kg x 4 reps
    const targetPerf = devCouchePerfs.find(p => 
      p.weight === 65 && p.reps === 4 && p.serieNumber === 1
    )
    
    if (targetPerf) {
      console.log('\nPerformance cible trouvée:')
      console.log(`  - ${targetPerf.weight}kg x ${targetPerf.reps} reps le ${targetPerf.performanceDate}`)
      
      // Chercher les performances historiques du même exercice avant cette date
      const historyBefore = allPerformances.filter(p => {
        const isSameExercise = p.exerciseName === targetPerf.exerciseName || 
          normalizeExerciseName(p.exerciseName) === normalizeExerciseName(targetPerf.exerciseName)
        const isBeforeDate = getPerformanceDateKey(p) < getPerformanceDateKey(targetPerf)
        const isSameReps = p.reps === targetPerf.reps
        return isSameExercise && isBeforeDate && isSameReps
      })
      
      console.log(`\nPerformances historiques du même exercice avec ${targetPerf.reps} reps avant ${targetPerf.performanceDate}:`)
      historyBefore.forEach(p => {
        console.log(`  - ${p.weight}kg x ${p.reps} reps le ${p.performanceDate}`)
      })
      
      // Trouver la meilleure performance historique pour 4 reps
      const bestHistory = historyBefore.reduce((best, current) => {
        if (!best || current.weight > best.weight) {
          return current
        }
        return best
      }, null)
      
      if (bestHistory) {
        console.log(`\nMeilleure performance historique pour 4 reps: ${bestHistory.weight}kg le ${bestHistory.performanceDate}`)
        console.log(`Comparaison: ${targetPerf.weight}kg vs ${bestHistory.weight}kg`)
        console.log(`Delta: ${targetPerf.weight - bestHistory.weight}kg`)
        console.log(`Devrait être un PR: ${targetPerf.weight > bestHistory.weight ? 'OUI' : 'NON'}`)
      } else {
        console.log('\nAucune performance historique trouvée pour 4 reps - devrait être un PR!')
      }
    } else {
      console.log('\nPerformance 65kg x 4 reps non trouvée dans la séance')
    }
    
  } catch (error) {
    console.error('Erreur:', error)
  }
}

debugRealData()
