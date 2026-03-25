import { describe, it, expect } from 'vitest'
import { DateFormatter, NumberFormatter, NameNormalizer, parseDateToTimestamp, parseDateToIso, toNumber } from '../src/utils/formatters'

describe('DateFormatter', () => {
  describe('parseToIso', () => {
    it('should parse ISO date format', () => {
      expect(DateFormatter.parseToIso('2026-03-24')).toBe('2026-03-24')
    })

    it('should parse ISO datetime format', () => {
      expect(DateFormatter.parseToIso('2026-03-24T10:30:00')).toBe('2026-03-24')
    })

    it('should parse French date format (dd/mm/yyyy)', () => {
      expect(DateFormatter.parseToIso('24/03/2026')).toBe('2026-03-24')
    })

    it('should parse French date format with dashes', () => {
      expect(DateFormatter.parseToIso('24-03-2026')).toBe('2026-03-24')
    })

    it('should parse single digit month and day', () => {
      expect(DateFormatter.parseToIso('5/3/2026')).toBe('2026-03-05')
    })

    it('should parse Date object', () => {
      const date = new Date('2026-03-24')
      const result = DateFormatter.parseToIso(date)
      expect(result).toBe('2026-03-24')
    })

    it('should return null for invalid input', () => {
      expect(DateFormatter.parseToIso(null)).toBeNull()
      expect(DateFormatter.parseToIso('')).toBeNull()
      expect(DateFormatter.parseToIso('invalid')).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(DateFormatter.parseToIso('   ')).toBeNull()
    })
  })

  describe('parseToTimestamp', () => {
    it('should parse ISO date to timestamp', () => {
      const ts = DateFormatter.parseToTimestamp('2026-03-24')
      const expected = new Date(2026, 2, 24).getTime()
      expect(ts).toBe(expected)
    })

    it('should parse French date to timestamp', () => {
      const ts = DateFormatter.parseToTimestamp('24/03/2026')
      const expected = new Date(2026, 2, 24).getTime()
      expect(ts).toBe(expected)
    })

    it('should return null for invalid date', () => {
      expect(DateFormatter.parseToTimestamp(null)).toBeNull()
      expect(DateFormatter.parseToTimestamp('invalid')).toBeNull()
    })
  })

  describe('isoToFr', () => {
    it('should format ISO date to French locale', () => {
      const result = DateFormatter.isoToFr('2026-03-24')
      expect(result).toMatch(/24.*03.*2026/)
    })

    it('should return null for invalid date', () => {
      expect(DateFormatter.isoToFr(null)).toBeNull()
      expect(DateFormatter.isoToFr('invalid')).toBeNull()
    })
  })
})

describe('NumberFormatter', () => {
  describe('toNumber', () => {
    it('should convert string to number', () => {
      expect(NumberFormatter.toNumber('42')).toBe(42)
    })

    it('should convert string with comma to number', () => {
      expect(NumberFormatter.toNumber('3,14')).toBe(3.14)
    })

    it('should convert float string', () => {
      expect(NumberFormatter.toNumber('3.14')).toBe(3.14)
    })

    it('should convert number', () => {
      expect(NumberFormatter.toNumber(42)).toBe(42)
    })

    it('should return null for null', () => {
      expect(NumberFormatter.toNumber(null)).toBeNull()
    })

    it('should return null for undefined', () => {
      expect(NumberFormatter.toNumber(undefined)).toBeNull()
    })

    it('should return null for empty string', () => {
      expect(NumberFormatter.toNumber('')).toBeNull()
    })

    it('should return null for non-numeric string', () => {
      expect(NumberFormatter.toNumber('abc')).toBeNull()
    })

    it('should handle whitespace', () => {
      expect(NumberFormatter.toNumber('  42  ')).toBe(42)
    })
  })

  describe('formatWeight', () => {
    it('should format weight with comma', () => {
      expect(NumberFormatter.formatWeight(90.5)).toBe('90,5')
    })

    it('should round weight to 2 decimals', () => {
      expect(NumberFormatter.formatWeight(90.555)).toBe('90,56')
    })

    it('should return dash for null', () => {
      expect(NumberFormatter.formatWeight(null)).toBe('-')
    })

    it('should return dash for invalid input', () => {
      expect(NumberFormatter.formatWeight('invalid')).toBe('-')
    })

    it('should handle string input', () => {
      expect(NumberFormatter.formatWeight('100,5')).toBe('100,5')
    })
  })
})

describe('NameNormalizer', () => {
  describe('exercise', () => {
    it('should normalize exercise name to lowercase', () => {
      expect(NameNormalizer.exercise('Développé Couché')).toBe('developpe couche')
    })

    it('should remove accents', () => {
      expect(NameNormalizer.exercise('Développé')).toBe('developpe')
    })

    it('should remove special characters', () => {
      expect(NameNormalizer.exercise('Curl-Haltère')).toBe('curl haltere')
    })

    it('should collapse multiple spaces', () => {
      expect(NameNormalizer.exercise('Développé    Couché')).toBe('developpe couche')
    })

    it('should handle empty/null input', () => {
      expect(NameNormalizer.exercise('')).toBeNull()
      expect(NameNormalizer.exercise(null)).toBeNull()
    })

    it('should trim whitespace', () => {
      expect(NameNormalizer.exercise('  Développé Couché  ')).toBe('developpe couche')
    })
  })

  describe('variant', () => {
    it('should normalize variant name to lowercase', () => {
      expect(NameNormalizer.variant('Pause')).toBe('pause')
    })

    it('should default to Touch and Go', () => {
      expect(NameNormalizer.variant(null)).toBe('touch and go')
    })

    it('should collapse multiple spaces', () => {
      expect(NameNormalizer.variant('Touch  and   Go')).toBe('touch and go')
    })

    it('should trim whitespace', () => {
      expect(NameNormalizer.variant('  Pause  ')).toBe('pause')
    })
  })
})

describe('Helper functions', () => {
  describe('parseDateToTimestamp', () => {
    it('should delegate to DateFormatter', () => {
      const ts = parseDateToTimestamp('2026-03-24')
      const expected = new Date(2026, 2, 24).getTime()
      expect(ts).toBe(expected)
    })
  })

  describe('parseDateToIso', () => {
    it('should delegate to DateFormatter', () => {
      expect(parseDateToIso('24/03/2026')).toBe('2026-03-24')
    })
  })

  describe('toNumber', () => {
    it('should delegate to NumberFormatter', () => {
      expect(toNumber('42')).toBe(42)
    })
  })
})
