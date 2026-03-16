import '../styles/HomePage.css'
import GeneralAdviceBoard from '../components/GeneralAdviceBoard'

export default function HomePage({ onNavigateToMusculation }) {
  return (
    <div className="home-page">
      <section className="hero">
        <div className="hero-content">
          <p className="hero-kicker">Plateforme de suivi musculation</p>
          <h1 className="hero-title">Structurez vos entraînements avec méthode.</h1>
          <p className="hero-description">
            Centralisez vos exercices, construisez vos séances et suivez votre progression
            dans une interface claire, pensée pour un usage quotidien.
          </p>
          <button className="cta-button" onClick={onNavigateToMusculation}>
            Accéder à l'espace entraînement
          </button>
        </div>

        <div className="hero-panel">
          <h2>En un coup d'oeil</h2>
          <ul>
            <li>Exercices personnalisés par groupe musculaire</li>
            <li>Séances configurables avec nombre de séries</li>
            <li>Historique des performances et statistiques</li>
          </ul>
        </div>
      </section>

      <section className="features">
        <article className="feature-card">
          <h3>Bibliothèque d'exercices</h3>
          <p>Créez, recherchez et organisez vos exercices en quelques secondes.</p>
        </article>

        <article className="feature-card">
          <h3>Construction de séances</h3>
          <p>Assemblez vos séances selon votre split et votre volume cible.</p>
        </article>

        <article className="feature-card">
          <h3>Mesure de progression</h3>
          <p>Suivez vos séries, charges et tendances pour ajuster votre plan.</p>
        </article>
      </section>

      <GeneralAdviceBoard title="Conseils généraux (coach/perso)" />
    </div>
  )
}
