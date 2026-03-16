import '../styles/Navbar.css'

function Navbar({ currentPage, onNavigate }) {
  const navItems = [
    { key: 'home', label: 'Accueil' },
    { key: 'musculation', label: 'Entraînement' },
    { key: 'performances', label: 'Performances' }
  ]

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <button className="navbar-logo" onClick={() => onNavigate('home')}>
          <span className="logo-mark" aria-hidden="true">MM</span>
          <span className="logo-text">MyMuscle</span>
        </button>

        <ul className="nav-menu">
          {navItems.map((item) => (
            <li key={item.key} className="nav-item">
              <button
                className={`nav-link ${currentPage === item.key ? 'active' : ''}`}
                onClick={() => onNavigate(item.key)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  )
}

export default Navbar
