export function calculateE1RM(weight, reps) {
  const parsedWeight = typeof weight === 'string' ? parseFloat(weight) : weight
  const parsedReps = typeof reps === 'string' ? parseInt(reps, 10) : reps

  if (!Number.isFinite(parsedWeight) || !Number.isFinite(parsedReps) || parsedWeight <= 0 || parsedReps <= 0) {
    return null
  }

  // Epley formula.
  return parsedWeight * (1 + (parsedReps / 30))
}

export function roundE1RM(value) {
  if (!Number.isFinite(value)) {
    return null
  }

  return Math.round(value * 10) / 10
}
