import { useEffect, useState } from 'react'
import { generalAdviceService } from '../services'
import '../styles/GeneralAdviceBoard.css'

const STORAGE_KEY = 'general_advice_board_v1'

const DEFAULT_ADVICE = {
  training: '',
  nutrition: '',
  sleep: ''
}

export default function GeneralAdviceBoard({ title = 'Conseils généraux' }) {
  const [advice, setAdvice] = useState(DEFAULT_ADVICE)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    let isActive = true

    const loadAdvice = async () => {
      const remoteAdvice = await generalAdviceService.getGeneralAdvice()
      if (isActive && remoteAdvice) {
        setAdvice(remoteAdvice)
        setIsHydrated(true)
        return
      }

      try {
        const saved = window.localStorage.getItem(STORAGE_KEY)
        if (saved && isActive) {
          const parsed = JSON.parse(saved)
          setAdvice({
            training: String(parsed?.training || ''),
            nutrition: String(parsed?.nutrition || ''),
            sleep: String(parsed?.sleep || '')
          })
        }
      } catch (error) {
        console.error('Erreur lecture conseils généraux local:', error)
      } finally {
        if (isActive) {
          setIsHydrated(true)
        }
      }
    }

    loadAdvice()
    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) {
      return
    }

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(advice))
    } catch (error) {
      console.error('Erreur sauvegarde conseils généraux local:', error)
    }

    const saveTimer = window.setTimeout(async () => {
      try {
        await generalAdviceService.saveGeneralAdvice(advice)
      } catch (error) {
        // Fallback local déjà fait plus haut.
      }
    }, 450)

    return () => {
      window.clearTimeout(saveTimer)
    }
  }, [advice, isHydrated])

  const updateAdvice = (field, value) => {
    const next = {
      ...advice,
      [field]: value
    }
    setAdvice(next)
  }

  return (
    <section className="general-advice-board">
      <div className="general-advice-header">
        <h2>{title}</h2>
        <p>Notes perso visibles partout dans l&apos;app.</p>
      </div>

      <div className="general-advice-grid">
        <div className="general-advice-card">
          <h3>Entrainement</h3>
          <textarea
            value={advice.training}
            onChange={(event) => updateAdvice('training', event.target.value)}
            placeholder="Ex: garder 1-2 reps en reserve sur les polyarticulaires."
          />
        </div>

        <div className="general-advice-card">
          <h3>Nutrition</h3>
          <textarea
            value={advice.nutrition}
            onChange={(event) => updateAdvice('nutrition', event.target.value)}
            placeholder="Ex: 30-40g proteines sur le repas post-seance."
          />
        </div>

        <div className="general-advice-card">
          <h3>Sommeil</h3>
          <textarea
            value={advice.sleep}
            onChange={(event) => updateAdvice('sleep', event.target.value)}
            placeholder="Ex: viser 7h30 mini, coucher avant 23h."
          />
        </div>
      </div>
    </section>
  )
}
