import { useEffect, useState } from 'react'
import { normalizeMuscleGroups } from '../utils/muscleGroups'
import { normalizeVariants } from '../utils/variants'
import '../styles/ExerciseCard.css'

export default function ExerciseCard({
  exercise,
  onDelete,
  onUpdateExercise,
  onUpdateCoachNotes,
  onOpenExerciseDetails
}) {
  const muscleGroupsCatalog = [
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
    'Abducteurs'
  ]

  const [showCoachNotes, setShowCoachNotes] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [coachNotes, setCoachNotes] = useState(exercise.coachNotes || '')
  const [showEditForm, setShowEditForm] = useState(false)
  const [selectedMuscle, setSelectedMuscle] = useState('')
  const [customMuscle, setCustomMuscle] = useState('')
  const [newVariantName, setNewVariantName] = useState('')
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editData, setEditData] = useState({
    name: exercise.name || '',
    description: exercise.description || '',
    muscleGroups: normalizeMuscleGroups(exercise.muscleGroups),
    variants: normalizeVariants(exercise.variants, exercise.id)
  })

  useEffect(() => {
    setCoachNotes(exercise.coachNotes || '')
    setEditData({
      name: exercise.name || '',
      description: exercise.description || '',
      muscleGroups: normalizeMuscleGroups(exercise.muscleGroups),
      variants: normalizeVariants(exercise.variants, exercise.id)
    })
  }, [exercise])

  const handleSaveCoachNotes = () => {
    const normalizedNotes = String(coachNotes ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    const currentNotes = String(exercise.coachNotes ?? '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')

    if (normalizedNotes === currentNotes) {
      setShowCoachNotes(false)
      return
    }

    onUpdateCoachNotes(exercise.id, normalizedNotes)
    setShowCoachNotes(false)
  }

  const handleEditFieldChange = (field, value) => {
    setEditData((prev) => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddMuscleGroup = () => {
    if (!selectedMuscle) {
      return
    }

    setEditData((prev) => ({
      ...prev,
      muscleGroups: normalizeMuscleGroups([...prev.muscleGroups, selectedMuscle])
    }))
    setSelectedMuscle('')
  }

  const handleAddCustomMuscleGroup = () => {
    const cleanedCustomMuscle = customMuscle.trim()
    if (!cleanedCustomMuscle) {
      return
    }

    setEditData((prev) => ({
      ...prev,
      muscleGroups: normalizeMuscleGroups([...prev.muscleGroups, cleanedCustomMuscle])
    }))
    setCustomMuscle('')
  }

  const handleRemoveMuscleGroup = (groupToRemove) => {
    setEditData((prev) => ({
      ...prev,
      muscleGroups: prev.muscleGroups.filter((group) => group !== groupToRemove)
    }))
  }

  const handleAddVariant = () => {
    const cleanedName = newVariantName.trim()
    if (!cleanedName) {
      return
    }

    setEditData((prev) => ({
      ...prev,
      variants: normalizeVariants([
        ...prev.variants,
        { name: cleanedName, isDefault: false, exerciseId: exercise.id }
      ], exercise.id)
    }))
    setNewVariantName('')
  }

  const handleVariantNameChange = (targetIndex, value) => {
    setEditData((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, index) => (
        index === targetIndex ? { ...variant, name: value } : variant
      ))
    }))
  }

  const handleSetDefaultVariant = (targetIndex) => {
    setEditData((prev) => ({
      ...prev,
      variants: prev.variants.map((variant, index) => ({
        ...variant,
        isDefault: index === targetIndex
      }))
    }))
  }

  const handleRemoveVariant = (targetIndex) => {
    setEditData((prev) => {
      if (prev.variants.length <= 1) {
        return prev
      }

      const nextVariants = prev.variants.filter((_, index) => index !== targetIndex)
      return {
        ...prev,
        variants: normalizeVariants(nextVariants, exercise.id)
      }
    })
  }

  const handleSaveExercise = async () => {
    const cleanedName = editData.name.trim()
    const cleanedMuscles = normalizeMuscleGroups(editData.muscleGroups)
    const cleanedVariants = normalizeVariants(editData.variants, exercise.id)

    if (!cleanedName) {
      alert("Le nom de l'exercice est requis.")
      return
    }

    if (cleanedMuscles.length === 0) {
      alert('Ajoute au moins un groupe musculaire.')
      return
    }

    if (cleanedVariants.length === 0) {
      alert('Ajoute au moins une variante.')
      return
    }

    try {
      setIsSavingEdit(true)
      await onUpdateExercise(exercise.id, {
        name: cleanedName,
        description: editData.description,
        muscleGroups: cleanedMuscles,
        variants: cleanedVariants
      })
      alert('Exercice modifié.')
      setShowEditForm(false)
    } finally {
      setIsSavingEdit(false)
    }
  }

  return (
    <div className="exercise-card">
      <div className="card-header">
        <button
          type="button"
          className="exercise-name-toggle"
          onClick={() => onOpenExerciseDetails?.(exercise.id)}
          aria-label={`Ouvrir la fiche de ${exercise.name}`}
        >
          <h3>{exercise.name}</h3>
          <span className="exercise-name-hint">
            Voir la fiche complète
          </span>
        </button>
      </div>

      {showDetails && (
        <div className="exercise-details-panel">
          <div>
            {normalizeMuscleGroups(exercise.muscleGroups).length > 0 ? (
              normalizeMuscleGroups(exercise.muscleGroups).map(group => (
                <span key={group} className="muscle-group">{group}</span>
              ))
            ) : (
              <span className="muscle-group">{exercise.muscleGroup}</span>
            )}
          </div>

          <div className="exercise-variants-section">
            <h5>Variantes d'exécution</h5>
            <ul className="exercise-variants-list">
              {normalizeVariants(exercise.variants, exercise.id).map((variant) => (
                <li key={variant.id || variant.name} className="exercise-variant-item">
                  <span className="exercise-variant-name">{variant.name}</span>
                  {variant.isDefault && <span className="exercise-variant-default">Base</span>}
                </li>
              ))}
            </ul>
          </div>

          {exercise.description && (
            <p className="exercise-description">{exercise.description}</p>
          )}
        </div>
      )}

      <div className="exercise-buttons">
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Masquer détails rapides' : 'Détails rapides'}
        </button>
        <button
          className="btn btn-secondary btn-small"
          onClick={() => setShowEditForm(!showEditForm)}
        >
          {showEditForm ? 'Fermer édition' : 'Modifier'}
        </button>
        <button
          className="btn btn-danger btn-small"
          onClick={() => {
            const shouldDelete = window.confirm(
              "Supprimer cet exercice ? Cela retirera aussi ses donnees associees."
            )
            if (shouldDelete) {
              onDelete(exercise.id)
            }
          }}
        >
          Supprimer
        </button>
        <button 
          className="btn btn-primary btn-small"
          onClick={() => setShowCoachNotes(!showCoachNotes)}
        >
          {showCoachNotes ? 'Fermer' : 'Remarques Coach'}
        </button>
      </div>

      {showEditForm && (
        <div className="edit-exercise-form">
          <h4>Modifier l'exercice</h4>
          <div className="form-group">
            <label htmlFor={`edit-name-${exercise.id}`}>Nom</label>
            <input
              id={`edit-name-${exercise.id}`}
              type="text"
              value={editData.name}
              onChange={(e) => handleEditFieldChange('name', e.target.value)}
              placeholder="Nom de l'exercice"
            />
          </div>

          <div className="form-group">
            <label htmlFor={`edit-description-${exercise.id}`}>Description</label>
            <textarea
              id={`edit-description-${exercise.id}`}
              value={editData.description}
              onChange={(e) => handleEditFieldChange('description', e.target.value)}
              placeholder="Description de l'exercice"
            />
          </div>

          <div className="form-group">
            <label>Groupes musculaires</label>
            <div className="edit-muscle-controls">
              <select
                value={selectedMuscle}
                onChange={(e) => setSelectedMuscle(e.target.value)}
              >
                <option value="">-- Choisir un muscle --</option>
                {muscleGroupsCatalog.map((group) => (
                  <option key={group} value={group}>{group}</option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-primary btn-small"
                onClick={handleAddMuscleGroup}
              >
                Ajouter
              </button>
            </div>

            <div className="edit-muscle-controls" style={{ marginTop: '0.45rem' }}>
              <input
                type="text"
                value={customMuscle}
                onChange={(e) => setCustomMuscle(e.target.value)}
                placeholder="Ajouter une etiquette libre"
              />
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleAddCustomMuscleGroup}
              >
                Ajouter texte
              </button>
            </div>

            <div className="edit-muscle-list">
              {editData.muscleGroups.map((group) => (
                <span key={group} className="edit-muscle-item">
                  {group}
                  <button
                    type="button"
                    className="edit-muscle-remove"
                    onClick={() => handleRemoveMuscleGroup(group)}
                    aria-label={`Supprimer ${group}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Variantes</label>
            <p className="variants-helper">
              Exemple: Touch and Go (base), Pause 2.0.2.0, Tempo 3.1.1.0.
            </p>
            <div className="edit-muscle-controls">
              <input
                type="text"
                value={newVariantName}
                onChange={(e) => setNewVariantName(e.target.value)}
                placeholder="Ex: Pause 2.0.2.0"
              />
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={handleAddVariant}
              >
                Ajouter variante
              </button>
            </div>

            <div className="variants-editor-list">
              {editData.variants.map((variant, index) => (
                <div key={variant.id || `${variant.name}-${index}`} className="variant-editor-row">
                  <input
                    type="text"
                    value={variant.name}
                    onChange={(e) => handleVariantNameChange(index, e.target.value)}
                    placeholder="Nom de variante"
                  />
                  <label className="variant-default-toggle">
                    <input
                      type="radio"
                      name={`default-variant-${exercise.id}`}
                      checked={variant.isDefault}
                      onChange={() => handleSetDefaultVariant(index)}
                    />
                    Base
                  </label>
                  <button
                    type="button"
                    className="btn btn-danger btn-small"
                    onClick={() => handleRemoveVariant(index)}
                    disabled={editData.variants.length <= 1}
                  >
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button
            className="btn btn-primary btn-small"
            onClick={handleSaveExercise}
            disabled={isSavingEdit}
          >
            {isSavingEdit ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </button>
        </div>
      )}

      {showCoachNotes && (
        <div className="coach-notes">
          <h4>Remarques du Coach</h4>
          {exercise.coachNotes && (
            <div className="coach-notes-display">
              <strong>Dernières remarques:</strong>
              <p className="coach-notes-content">{exercise.coachNotes}</p>
            </div>
          )}
          <textarea
            className="coach-notes-textarea"
            value={coachNotes}
            onChange={(e) => setCoachNotes(e.target.value)}
            placeholder="Ajouter les remarques du coach..."
          />
          <button 
            className="btn btn-primary btn-small"
            onClick={handleSaveCoachNotes}
            style={{ marginTop: '0.75rem' }}
          >
            Enregistrer les Remarques
          </button>
        </div>
      )}
    </div>
  )
}
