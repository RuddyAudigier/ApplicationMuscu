import { useState, useCallback } from 'react'
import '../styles/SearchBar.css'

function SearchBar({ exercises, onSearch, placeholder = 'Rechercher par nom ou groupe musculaire...' }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const filterExercises = useCallback((query) => {
    const lowerQuery = query.toLowerCase()
    return exercises.filter((exercise) => {
      const matchesName = exercise.name.toLowerCase().includes(lowerQuery)
      const matchesMuscle = exercise.muscleGroups?.some((mg) =>
        mg.toLowerCase().includes(lowerQuery)
      )
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
        <span className="search-icon">Rechercher</span>
        <input
          type="text"
          value={searchQuery}
          onChange={handleChange}
          onFocus={() => searchQuery.length > 0 && setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          placeholder={placeholder}
          className="search-input"
        />
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
