import { useMemo, useState } from 'react'
import MuscleMap from './MuscleMap'
import '../styles/MuscleFilter.css'

const FILTER_THUMB_SCALE = 1.75
const ITEM_THUMB_SCALE = 1.85

const MUSCLES = [
  'Pecs',
  'Trapeze',
  'Grand dorsal',
  'Bas du dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Avant-bras',
  'Abdominaux',
  'Quadriceps',
  'Ischios',
  'Fessiers',
  'Mollets',
  'Abducteurs',
  'Psoas'
]

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export default function MuscleFilter({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const popoverId = 'muscle-filter-popover'
  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev
      return next
    })
  }

  const selectedLabel = useMemo(() => {
    if (!value) return 'Tous les muscles'
    const match = MUSCLES.find((m) => normalizeKey(m) === normalizeKey(value))
    return match || value
  }, [value])

  return (
    <div className="muscle-filter">
      <button
        type="button"
        className="muscle-filter-button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? popoverId : undefined}
      >
        <span className="muscle-filter-thumb">
          <MuscleMap
            muscleGroups={value ? [value] : []}
            compact
            view={value ? 'auto' : 'front'}
            showTitles={false}
            label="Aperçu muscle"
            scale={FILTER_THUMB_SCALE}
          />
        </span>
        <span className="muscle-filter-text">
          <span className="muscle-filter-label">Filtrer par muscle</span>
          <span className="muscle-filter-value">{selectedLabel}</span>
        </span>
        <span className="muscle-filter-caret" aria-hidden="true">▾</span>
      </button>

      {open && (
        <div id={popoverId} className="muscle-filter-popover" role="listbox" aria-label="Filtrer par muscle">
          <div className="muscle-filter-popover-header">
            <div className="muscle-filter-popover-title">Muscles</div>
            <button type="button" className="btn btn-secondary btn-small" onClick={() => setOpen(false)}>
              Fermer
            </button>
          </div>

          <div className="muscle-filter-items">
          <button
            type="button"
            className={`muscle-filter-item${value ? '' : ' active'}`}
            onClick={() => {
              onChange?.('')
              setOpen(false)
            }}
          >
            <span className="muscle-filter-item-thumb">
              <MuscleMap
                muscleGroups={[]}
                compact
                view="front"
                showTitles={false}
                label="Tous"
                scale={ITEM_THUMB_SCALE}
              />
            </span>
            <span className="muscle-filter-item-text">
              <strong>Tous</strong>
              <span>Afficher toute la bibliothèque</span>
            </span>
          </button>

          {MUSCLES.map((muscle) => {
            const active = normalizeKey(muscle) === normalizeKey(value)
            return (
              <button
                key={muscle}
                type="button"
                className={`muscle-filter-item${active ? ' active' : ''}`}
                onClick={() => {
                  onChange?.(muscle)
                  setOpen(false)
                }}
              >
                <span className="muscle-filter-item-thumb">
                  <MuscleMap
                    muscleGroups={[muscle]}
                    compact
                    view="auto"
                    showTitles={false}
                    label={muscle}
                    scale={ITEM_THUMB_SCALE}
                  />
                </span>
                <span className="muscle-filter-item-text">
                  <strong>{muscle}</strong>
                  <span>Filtrer les exercices</span>
                </span>
              </button>
            )
          })}
          </div>
        </div>
      )}
    </div>
  )
}
