import '../styles/RecentSessionsCarousel.css'

function RecentSessionsCarousel({ sessions = [] }) {
  if (sessions.length === 0) {
    return null
  }

  return (
    <section className="recent-sessions-section">
      <h2 className="recent-sessions-title">Séances Récentes</h2>
      
      <div className="sessions-carousel">
        {sessions.map((session, idx) => (
          <div key={session.id || idx} className="session-carousel-card">
            <div className="session-card-header">
              <h3 className="session-card-name">{session.name || 'Session'}</h3>
              <span className="session-card-date">
                {session.date ? new Date(session.date).toLocaleDateString('fr-FR') : '---'}
              </span>
            </div>

            <div className="session-card-info">
              <div className="info-item">
                <span className="info-label">Exercices</span>
                <span className="info-value">{session.exercises?.length || 0}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Durée</span>
                <span className="info-value">{session.duration || '---'}</span>
              </div>
            </div>

            <div className="session-card-footer">
              <button className="session-card-btn">Voir</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default RecentSessionsCarousel
