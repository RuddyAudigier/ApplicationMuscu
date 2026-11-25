import { useMemo } from 'react'
import { normalizeMuscleGroups } from '../utils/muscleGroups'
import Body from '@mjcdev/react-body-highlighter'
import '../styles/MuscleMap.css'

function normalizeKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

const MUSCLE_TO_SLUGS = {
  pecs: ['chest'],
  trapeze: ['trapezius'],
  'grand dorsal': ['upper-back'],
  ischios: ['hamstring'],
  quadriceps: ['quadriceps'],
  epaules: ['deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  abdominaux: ['abs', 'obliques'],
  'avant-bras': ['forearm'],
  fessiers: ['gluteal'],
  mollets: ['calves'],
  'bas du dos': ['lower-back'],
  abducteurs: ['adductors'],
  adducteurs: ['adductors']
}

function buildHighlightData(muscleGroups) {
  const normalized = normalizeMuscleGroups(muscleGroups).map(normalizeKey)
  const active = new Map()
  normalized.forEach((key) => {
    const slugs = MUSCLE_TO_SLUGS[key]
    if (!slugs) return
    slugs.forEach((slug) => {
      const current = active.get(slug) || 0
      active.set(slug, Math.max(current, slug === 'obliques' ? 1 : 2))
    })
  })
  return Array.from(active.entries()).map(([slug, intensity]) => ({ slug, intensity }))
}

function resolvePreferredSideFromData(data) {
  const frontOnly = new Set(['chest', 'biceps', 'abs', 'obliques', 'quadriceps', 'tibialis'])
  const backOnly = new Set(['upper-back', 'lower-back', 'hamstring', 'gluteal', 'trapezius'])

  const slugs = (Array.isArray(data) ? data : []).map((entry) => entry?.slug).filter(Boolean)
  const hasFront = slugs.some((slug) => frontOnly.has(slug))
  const hasBack = slugs.some((slug) => backOnly.has(slug))

  if (hasBack && !hasFront) return 'back'
  return 'front'
}

export default function MuscleMap({
  muscleGroups = [],
  label = 'Carte musculaire',
  compact = false,
  view = 'dual',
  showTitles = true,
  scale: scaleOverride
}) {
  const data = useMemo(() => buildHighlightData(muscleGroups), [muscleGroups])
  const scale = typeof scaleOverride === 'number'
    ? scaleOverride
    : (compact ? 1.45 : 1.65)
  const border = 'rgba(248, 250, 252, 0.16)'
  const colors = ['#3b82f6', '#60a5fa', '#14b8a6']

  const resolvedView = useMemo(() => {
    if (view === 'auto') {
      return resolvePreferredSideFromData(data)
    }
    return view
  }, [data, view])

  return (
    <figure className={`muscle-map${compact ? ' compact' : ''}`} aria-label={label}>
      {resolvedView === 'dual' ? (
        <div className="muscle-map-grid" role="img" aria-label={label}>
          <div className="muscle-map-panel">
            {showTitles && <div className="muscle-map-title">Avant</div>}
            <Body data={data} gender="male" side="front" scale={scale} border={border} colors={colors} />
          </div>
          <div className="muscle-map-panel">
            {showTitles && <div className="muscle-map-title">Arrière</div>}
            <Body data={data} gender="male" side="back" scale={scale} border={border} colors={colors} />
          </div>
        </div>
      ) : (
        <div className="muscle-map-single" role="img" aria-label={label}>
          <div className="muscle-map-panel">
            {showTitles && (
              <div className="muscle-map-title">{resolvedView === 'back' ? 'Arrière' : 'Avant'}</div>
            )}
            <Body data={data} gender="male" side={resolvedView} scale={scale} border={border} colors={colors} />
          </div>
        </div>
      )}
    </figure>
  )
}
