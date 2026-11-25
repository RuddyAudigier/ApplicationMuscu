export function normalizeMuscleGroups(muscleGroups) {
  if (!Array.isArray(muscleGroups)) {
    return []
  }

  const uniqueByNormalizedValue = new Map()

  muscleGroups.forEach((group) => {
    if (typeof group !== 'string') {
      return
    }

    const trimmed = group.trim()
    if (!trimmed) {
      return
    }

    const normalizedKey = trimmed.toLocaleLowerCase('fr-FR')
    if (!uniqueByNormalizedValue.has(normalizedKey)) {
      uniqueByNormalizedValue.set(normalizedKey, trimmed)
    }
  })

  return Array.from(uniqueByNormalizedValue.values())
}
