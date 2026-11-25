import '../../styles/WorkoutInputPanel.css'

function WorkoutInputPanel({
  serieData,
  onWeightChange,
  onRepsChange,
  onRPEChange,
  onCoachNoteChange = null,
  isValidated = false
}) {
  if (!serieData) {
    return null
  }

  const rpeOptions = [6, 7, 8, 9, 10]

  return (
    <div className="workout-input-panel">
      <div className="input-field-container weight-field">
        <label htmlFor="weight-input" className="input-label">Poids (kg)</label>
        <input
          id="weight-input"
          type="number"
          step="0.5"
          inputMode="decimal"
          value={serieData.weight || ''}
          onChange={(e) => onWeightChange(e.target.value)}
          placeholder="0.0"
          className="large-input weight-input"
          disabled={isValidated}
        />
      </div>

      <div className="input-divider">×</div>

      <div className="input-field-container reps-field">
        <label htmlFor="reps-input" className="input-label">Reps</label>
        <input
          id="reps-input"
          type="number"
          inputMode="numeric"
          value={serieData.reps || ''}
          onChange={(e) => onRepsChange(e.target.value)}
          placeholder="0"
          className="large-input reps-input"
          disabled={isValidated}
        />
      </div>

      <div className="rpe-section">
        <label className="rpe-label">RPE (Ressenti)</label>
        <div className="rpe-buttons">
          {rpeOptions.map((rpe) => (
            <button
              key={rpe}
              className={`rpe-button rpe-${rpe} ${
                parseInt(serieData.rpe || '10') === rpe ? 'active' : ''
              }`}
              onClick={() => onRPEChange(String(rpe))}
              disabled={isValidated}
              aria-label={`RPE ${rpe}`}
              type="button"
            >
              {rpe}
            </button>
          ))}
        </div>
      </div>

      {onCoachNoteChange && (
        <div className="input-field-container notes-field">
          <label htmlFor="notes-input" className="input-label">Notes</label>
          <textarea
            id="notes-input"
            value={serieData.coachNote || ''}
            onChange={(e) => onCoachNoteChange(e.target.value)}
            placeholder="Ajouter une note..."
            className="notes-textarea"
            disabled={isValidated}
            rows="2"
          />
        </div>
      )}
    </div>
  )
}

export default WorkoutInputPanel
