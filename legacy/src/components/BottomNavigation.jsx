import '../styles/BottomNavigation.css'
import { HomeIcon, PerformanceIcon, SettingsIcon, ExercisesIcon, SessionsIcon } from './BottomNavIcons'

function BottomNavigation({ currentPage, onNavigate }) {
  const navItems = [
    { key: 'home', label: 'Accueil', Icon: HomeIcon },
    { key: 'exercises', label: 'Exos', Icon: ExercisesIcon },
    { key: 'sessions', label: 'Séances', Icon: SessionsIcon },
    { key: 'performances', label: 'Perfs', Icon: PerformanceIcon },
    { key: 'settings', label: 'Réglages', Icon: SettingsIcon }
  ]

  return (
    <nav className="bottom-navigation">
      <div className="bottom-nav-container" style={{ '--bottom-nav-items': navItems.length }}>
        {navItems.map((item) => (
          <button
            key={item.key}
            className={`nav-button ${currentPage === item.key ? 'active' : ''}`}
            onClick={() => onNavigate(item.key)}
            aria-label={item.label}
            aria-current={currentPage === item.key ? 'page' : undefined}
            title={item.label}
          >
            <span className="nav-icon" aria-hidden="true">
              <item.Icon />
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}

export default BottomNavigation
