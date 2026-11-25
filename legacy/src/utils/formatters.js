/**
 * Formatters et parseurs (Single Responsibility: conversion de données)
 */

export const DateFormatter = {
  isoToFr(isoDate) {
    const timestamp = parseDateToTimestamp(isoDate)
    if (!Number.isFinite(timestamp)) return null
    return new Date(timestamp).toLocaleDateString('fr-FR')
  },

  parseToIso(value) {
    if (!value) return null
    const raw = String(value).trim()
    if (!raw) return null

    const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
    if (isoMatch) {
      return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`
    }

    const frMatch = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+.*)?$/)
    if (frMatch) {
      const day = frMatch[1].padStart(2, '0')
      const month = frMatch[2].padStart(2, '0')
      return `${frMatch[3]}-${month}-${day}`
    }

    const parsed = new Date(raw)
    const parsedTs = parsed.getTime()
    if (!Number.isFinite(parsedTs)) return null
    return parsed.toISOString().slice(0, 10)
  },

  parseToTimestamp(value) {
    const iso = this.parseToIso(value)
    if (!iso) return null

    const [year, month, day] = iso.split('-').map((part) => Number(part))
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
      return null
    }

    const ts = new Date(year, month - 1, day).getTime()
    return Number.isFinite(ts) ? ts : null
  }
}

export const NumberFormatter = {
  toNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null
    }

    const normalized = typeof value === 'string'
      ? value.replace(',', '.').trim()
      : value

    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : null
  },

  formatWeight(weight) {
    const parsed = this.toNumber(weight)
    if (parsed === null) return '-'
    return String(Math.round(parsed * 100) / 100).replace('.', ',')
  }
}

export const NameNormalizer = {
  exercise(value) {
    const name = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return name || null
  },

  variant(value) {
    return String(value || 'Touch and Go')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ')
  }
}

// Helper functions using refactored modules
export function parseDateToTimestamp(value) {
  return DateFormatter.parseToTimestamp(value)
}

export function parseDateToIso(value) {
  return DateFormatter.parseToIso(value)
}

export function toNumber(value) {
  return NumberFormatter.toNumber(value)
}
