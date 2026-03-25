import { describe, it, expect } from 'vitest'
import { DEFAULT_VARIANT_NAME, buildDefaultVariant, normalizeVariants, getDefaultVariant } from '../src/utils/variants'

describe('variants', () => {
  describe('buildDefaultVariant', () => {
    it('should create default variant', () => {
      const variant = buildDefaultVariant()
      expect(variant.id).toBeNull()
      expect(variant.name).toBe(DEFAULT_VARIANT_NAME)
      expect(variant.isDefault).toBe(true)
    })

    it('should include exercise ID if provided', () => {
      const variant = buildDefaultVariant('ex-123')
      expect(variant.exerciseId).toBe('ex-123')
    })
  })

  describe('normalizeVariants', () => {
    it('should normalize string variants to objects', () => {
      const variants = normalizeVariants(['Pause', 'Touch and Go'])
      expect(variants).toHaveLength(2)
      expect(variants[0].name).toBe('Pause')
      expect(variants[1].name).toBe('Touch and Go')
    })

    it('should remove duplicates (case-insensitive)', () => {
      const variants = normalizeVariants(['Pause', 'pause', 'PAUSE'])
      expect(variants).toHaveLength(1)
      expect(variants[0].name).toBe('Pause')
    })

    it('should filter empty strings', () => {
      const variants = normalizeVariants(['Pause', '', '  ', 'Touch and Go'])
      expect(variants).toHaveLength(2)
    })

    it('should return default variant if empty', () => {
      const variants = normalizeVariants([])
      expect(variants).toHaveLength(1)
      expect(variants[0].name).toBe(DEFAULT_VARIANT_NAME)
    })

    it('should return default variant if null', () => {
      const variants = normalizeVariants(null)
      expect(variants).toHaveLength(1)
      expect(variants[0].name).toBe(DEFAULT_VARIANT_NAME)
    })

    it('should filter non-string items', () => {
      const variants = normalizeVariants([{ name: 'Pause' }, 'Touch and Go', null, 123])
      expect(variants).toHaveLength(2)
    })

    it('should preserve object structure', () => {
      const variants = normalizeVariants([{ id: 'var-1', name: 'Pause', isDefault: true }])
      expect(variants[0].id).toBe('var-1')
      expect(variants[0].isDefault).toBe(true)
    })

    it('should mark first variant as default if none marked', () => {
      const variants = normalizeVariants(['Pause', 'Touch and Go'])
      const hasDefault = variants.some((v) => v.isDefault)
      expect(hasDefault).toBe(true)
    })

    it('should mark Touch and Go as default if present and not marked', () => {
      const variants = normalizeVariants(['Pause', 'Touch and Go'], 'ex-1')
      const touchAndGo = variants.find((v) => v.name === 'Touch and Go')
      expect(touchAndGo.isDefault).toBe(true)
    })

    it('should include exercise ID', () => {
      const variants = normalizeVariants(['Pause'], 'ex-123')
      expect(variants[0].exerciseId).toBe('ex-123')
    })
  })

  describe('getDefaultVariant', () => {
    it('should return variant marked as default', () => {
      const variants = [
        { name: 'Pause', isDefault: false },
        { name: 'Touch and Go', isDefault: true }
      ]
      const defaultVar = getDefaultVariant(variants)
      expect(defaultVar.name).toBe('Touch and Go')
    })

    it('should mark Touch and Go as default if none marked (and it exists)', () => {
      const variants = [
        { name: 'Pause' },
        { name: 'Touch and Go' }
      ]
      const defaultVar = getDefaultVariant(variants)
      // Touch and Go should be marked as default because it's in the list
      expect(defaultVar.name).toBe('Touch and Go')
    })

    it('should return first variant if none marked and no Touch and Go', () => {
      const variants = [
        { name: 'Pause' },
        { name: 'Strict' }
      ]
      const defaultVar = getDefaultVariant(variants)
      expect(defaultVar.name).toBe('Pause')
    })

    it('should normalize before returning default', () => {
      const defaultVar = getDefaultVariant(['Pause'])
      expect(defaultVar.isDefault).toBe(true)
    })

    it('should handle empty variants', () => {
      const defaultVar = getDefaultVariant([])
      expect(defaultVar.name).toBe(DEFAULT_VARIANT_NAME)
    })
  })
})
