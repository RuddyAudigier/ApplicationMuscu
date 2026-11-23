import { useEffect, useState } from 'react'
import GeneralAdviceBoard from '../components/GeneralAdviceBoard'
import '../styles/SettingsPage.css'
import { DATA_BACKEND } from '../services'

const STORAGE_KEYS = {
  reduceMotion: 'pref_reduce_motion_v1',
  fontScale: 'pref_font_scale_v1'
}

function readStoredFontScale() {
  const raw = window.localStorage.getItem(STORAGE_KEYS.fontScale)
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 1
  if (parsed < 1) return 1
  if (parsed > 1.2) return 1.2
  return Math.round(parsed * 100) / 100
}

export default function SettingsPage() {
  const [reduceMotion, setReduceMotion] = useState(() => window.localStorage.getItem(STORAGE_KEYS.reduceMotion) === '1')
  const [fontScale, setFontScale] = useState(() => readStoredFontScale())

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.reduceMotion, reduceMotion ? '1' : '0')
    document.documentElement.classList.toggle('reduce-motion', reduceMotion)
  }, [reduceMotion])

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.fontScale, String(fontScale))
    document.documentElement.style.setProperty('--font-scale', String(fontScale))
  }, [fontScale])

  const backendLabel = DATA_BACKEND === 'mock'
    ? 'Mock (local)'
    : DATA_BACKEND === 'supabase'
      ? 'Supabase'
      : String(DATA_BACKEND || 'inconnu')

  return (
    <div className="settings-page">
      <div className="page-header">
        <h1>Paramètres</h1>
        <p>Accessibilité, préférences et notes rapides.</p>
      </div>

      <section className="settings-card">
        <h2>Accessibilité</h2>

        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Réduire les animations</strong>
            <span>Transitions plus discrètes (utile si tu es sensible au motion).</span>
          </div>
          <label className="switch" aria-label="Réduire les animations">
            <input
              type="checkbox"
              checked={reduceMotion}
              onChange={(e) => setReduceMotion(e.target.checked)}
            />
            <span className="switch-ui" aria-hidden="true" />
          </label>
        </div>

        <div className="settings-row">
          <div className="settings-row-text">
            <strong>Taille du texte</strong>
            <span>Augmente la lisibilité sans casser la mise en page.</span>
          </div>
          <select
            className="settings-select"
            value={String(fontScale)}
            onChange={(e) => setFontScale(Number(e.target.value))}
            aria-label="Taille du texte"
          >
            <option value="1">100%</option>
            <option value="1.1">110%</option>
            <option value="1.2">120%</option>
          </select>
        </div>
      </section>

      <section className="settings-card">
        <h2>Infos</h2>
        <p className="settings-muted">Backend données: <strong className="settings-inline-strong">{backendLabel}</strong></p>
      </section>

      <GeneralAdviceBoard title="Notes rapides" variant="postit" />
    </div>
  )
}
