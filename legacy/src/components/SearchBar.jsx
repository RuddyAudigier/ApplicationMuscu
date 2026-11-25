import { useState, useCallback } from 'react'
import '../styles/SearchBar.css'

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

const MUSCLE_ALIASES = {
  pecs: ['pec', 'pecs', 'pectoraux', 'pectoral', 'chest'],
  trapeze: ['trapeze', 'trap', 'traps', 'trapezius'],
  'grand dorsal': ['grand dorsal', 'dorsal', 'lats', 'latissimus', 'dos'],
  'bas du dos': ['bas du dos', 'lombaire', 'lombaires', 'lower back'],
  epaules: ['epaule', 'epaules', 'deltoide', 'deltoides', 'shoulder'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  'avant-bras': ['avant bras', 'avant-bras', 'forearm'],
  abdominaux: ['abdo', 'abdos', 'abdominaux', 'abdominal', 'abs', 'core', 'oblique', 'obliques'],
  quadriceps: ['quadriceps', 'quad', 'quads'],
  ischios: ['ischio', 'ischios', 'ischio-jambiers', 'hamstring', 'hamstrings'],
  fessiers: ['fessier', 'fessiers', 'glute', 'glutes', 'gluteal'],
  mollets: ['mollet', 'mollets', 'calf', 'calves'],
  abducteurs: ['abducteur', 'abducteurs', 'adducteur', 'adducteurs', 'adductors', 'abductors'],
  psoas: ['psoas', 'hip flexor', 'iliopsoas']
}

function resolveMuscleKeys(text) {
  const normalized = normalizeText(text)
  if (!normalized) return []

  return Object.entries(MUSCLE_ALIASES)
    .filter(([, aliases]) => aliases.some((alias) => normalized.includes(normalizeText(alias))))
    .map(([key]) => key)
}

function SearchBar({ exercises, onSearch, placeholder = 'Rechercher par nom ou groupe musculaire...' }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filterExercises = useCallback((query) => {
    const normalizedQuery = normalizeText(query)
    const queryKeys = resolveMuscleKeys(normalizedQuery)
    return exercises.filter((exercise) => {
      const matchesName = normalizeText(exercise?.name).includes(normalizedQuery)
      const matchesMuscle = Array.isArray(exercise?.muscleGroups)
        ? exercise.muscleGroups.some((mg) => {
          const normalizedMuscle = normalizeText(mg)
          if (normalizedMuscle.includes(normalizedQuery)) {
            return true
          }
          if (queryKeys.length === 0) {
            return false
          }
          const muscleKeys = resolveMuscleKeys(normalizedMuscle)
          return queryKeys.some((key) => muscleKeys.includes(key))
        })
        : false
      return matchesName || matchesMuscle
    })
  }, [exercises])

  const handleChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)

    if (value.length > 0) {
      const filteredExercises = filterExercises(value)
      const filteredNames = filteredExercises.map((exercise) => exercise.name)
      setSuggestions([...new Set(filteredNames)].slice(0, 8))
      setShowSuggestions(true)
      onSearch(filteredExercises)
    } else {
      setSuggestions([])
      setShowSuggestions(false)
      onSearch('')
    }
  }

  const handleSearch = (query) => {
    setSearchQuery(query)
    setShowSuggestions(false)
    onSearch(filterExercises(query))
  }

  const handleSuggestionClick = (suggestion) => {
    handleSearch(suggestion)
  }

  const handleClear = () => {
    setSearchQuery('')
    setSuggestions([])
    setShowSuggestions(false)
    onSearch('')
  }

  return (
    <div className="search-bar-container">
      <div className="search-wrapper">
        <span className="search-thumb" aria-hidden="true">
          <span className="search-icon">⌕</span>
        </span>
        <span className="search-field">
          <input
            type="text"
            value={searchQuery}
            onChange={handleChange}
            onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder={placeholder}
            className="search-input"
            aria-label="Rechercher un exercice"
          />
        </span>
        {searchQuery && (
          <button onClick={handleClear} className="clear-btn" title="Effacer">
            Effacer
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <ul className="suggestions-list">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              className="suggestion-item"
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default SearchBar
