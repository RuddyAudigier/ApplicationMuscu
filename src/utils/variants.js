export const DEFAULT_VARIANT_NAME = 'Touch and Go'

export function buildDefaultVariant(exerciseId = null) {
  return {
    id: null,
    exerciseId,
    name: DEFAULT_VARIANT_NAME,
    isDefault: true
  }
}

export function normalizeVariants(variants, exerciseId = null) {
  const list = Array.isArray(variants) ? variants : []
  const unique = new Map()

  list.forEach((variant) => {
    const rawName = typeof variant === 'string' ? variant : variant?.name
    if (typeof rawName !== 'string') {
      return
    }

    const name = rawName.trim()
    if (!name) {
      return
    }

    const key = name.toLocaleLowerCase('fr-FR')
    if (!unique.has(key)) {
      unique.set(key, {
        id: variant?.id || null,
        exerciseId: variant?.exerciseId || exerciseId,
        name,
        isDefault: Boolean(variant?.isDefault)
      })
    }
  })

  const normalized = Array.from(unique.values())
  if (normalized.length === 0) {
    return [buildDefaultVariant(exerciseId)]
  }

  if (!normalized.some((variant) => variant.isDefault)) {
    const touchAndGo = normalized.find(
      (variant) => variant.name.toLocaleLowerCase('fr-FR') === DEFAULT_VARIANT_NAME.toLocaleLowerCase('fr-FR')
    )
    if (touchAndGo) {
      touchAndGo.isDefault = true
    } else {
      normalized[0].isDefault = true
    }
  }

  return normalized
}

export function getDefaultVariant(variants, exerciseId = null) {
  const normalized = normalizeVariants(variants, exerciseId)
  return normalized.find((variant) => variant.isDefault) || normalized[0]
}
