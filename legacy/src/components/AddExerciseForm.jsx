import { useState } from 'react'

export default function AddExerciseForm({ onAddExercise }) {
  const [formData, setFormData] = useState({
    name: '',
    muscleGroups: [],
    description: ''
  })

  const muscleGroups = [
    'Pecs',
    'Trapeze',
    'Grand dorsal',
    'Ischios',
    'Quadriceps',
    'Épaules',
    'Biceps',
    'Triceps',
    'Abdominaux',
    'Avant-bras',
    'Fessiers',
    'Mollets',
    'Bas du dos',
    'Abducteurs',
    'Psoas',
  ]

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleMuscleGroupToggle = (group) => {
    setFormData(prev => ({
      ...prev,
      muscleGroups: prev.muscleGroups.includes(group)
        ? prev.muscleGroups.filter(g => g !== group)
        : [...prev.muscleGroups, group]
    }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (formData.name.trim() && formData.muscleGroups.length > 0) {
      onAddExercise(formData)
      setFormData({
        name: '',
        muscleGroups: [],
        description: ''
      })
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit}>
      <h2>Ajouter un Exercice Personnalisé</h2>
      
      <div className="form-group">
        <label htmlFor="name">Nom de l'Exercice *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Ex: Mon exercice personnalisé"
          required
        />
      </div>

      <div className="form-group">
        <label>Groupes Musculaires Ciblés *</label>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Sélectionner un muscle:
            </label>
            <select id="muscleSelect">
              <option value="">-- Choisir un muscle --</option>
              {muscleGroups.map(group => (
                <option key={group} value={group}>{group}</option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: '0.5rem', width: '100%' }}
              onClick={(e) => {
                e.preventDefault()
                const select = document.getElementById('muscleSelect')
                if (select.value && !formData.muscleGroups.includes(select.value)) {
                  handleMuscleGroupToggle(select.value)
                  select.value = ''
                }
              }}
            >
              Ajouter Muscle
            </button>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              Muscles sélectionnés:
            </label>
            <div style={{
              border: '1px solid rgba(248, 250, 252, 0.14)',
              borderRadius: '10px',
              padding: '0.75rem',
              minHeight: '120px',
              backgroundColor: 'rgba(15, 23, 42, 0.35)'
            }}>
              {formData.muscleGroups.length === 0 ? (
                <p style={{ color: 'var(--text-dim)', margin: 0, fontSize: '0.9rem' }}>Aucun muscle sélectionné</p>
              ) : (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {formData.muscleGroups.map(group => (
                    <li 
                      key={group}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem',
                        backgroundColor: 'rgba(17, 26, 51, 0.55)',
                        marginBottom: '0.5rem',
                        borderRadius: '10px',
                        border: '1px solid rgba(248, 250, 252, 0.10)'
                      }}
                    >
                      <span style={{ color: 'var(--text-primary)' }}>{group}</span>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        onClick={(e) => {
                          e.preventDefault()
                          handleMuscleGroupToggle(group)
                        }}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Décrivez l'exercice..."
        />
      </div>

      <div className="form-buttons">
        <button type="submit" className="btn btn-primary">
          Ajouter l'Exercice
        </button>
      </div>
    </form>
  )
}
