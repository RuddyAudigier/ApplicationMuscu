import '../styles/StatsSection.css'

function StatsSection({ stats = {} }) {
  const {
    totalSessions = 142,
    totalExercises = 34,
    totalVolumeMonth = 847.5
  } = stats

  return (
    <section className="stats-section">
      <h2 className="stats-title">Votre Progrès</h2>
      
      <div className="stats-grid">
        <div className="stat-card sessions-stat">
          <div className="stat-icon">📋</div>
          <div className="stat-content">
            <p className="stat-label">Séances</p>
            <p className="stat-value">{totalSessions}</p>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: '72%' }} />
          </div>
        </div>

        <div className="stat-card exercises-stat">
          <div className="stat-icon">💪</div>
          <div className="stat-content">
            <p className="stat-label">Exercices</p>
            <p className="stat-value">{totalExercises}</p>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: '85%' }} />
          </div>
        </div>

        <div className="stat-card volume-stat">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <p className="stat-label">Volume (kg)</p>
            <p className="stat-value">{totalVolumeMonth.toLocaleString('fr-FR')}</p>
            <p className="stat-period">Ce mois</p>
          </div>
          <div className="stat-bar">
            <div className="stat-bar-fill" style={{ width: '65%' }} />
          </div>
        </div>
      </div>
    </section>
  )
}

export default StatsSection
