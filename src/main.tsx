import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { applyStoredPreferences } from './features/settings';
import { registerServiceWorker } from './platform/sw';
// Sous-ensembles latins seulement (français) ; Space Grotesk n'est utilisée qu'en 700.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/space-grotesk/latin-700.css';
import './ui/tokens.css';
import './ui/global.css';

// Préférences d'affichage (animations, taille du texte) posées avant le premier rendu : pas de saut visuel.
applyStoredPreferences();
registerServiceWorker();

const root = document.getElementById('root');
if (!root) throw new Error('Élément #root introuvable');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
