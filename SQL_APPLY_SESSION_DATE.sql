-- Migration pour ajouter le champ session_date (si pas déjà fait)
-- Exécuter ce script une seule fois

-- Vérifier si le champ existe déjà
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'sessions' 
  AND column_name = 'session_date';

-- Si le champ n'existe pas, l'ajouter
-- ALTER TABLE sessions ADD COLUMN session_date DATE;

-- Mettre à jour les séances existantes avec leur date de création comme date de séance
-- UPDATE sessions SET session_date = DATE(created_at) WHERE session_date IS NULL;

-- Créer un index pour optimiser les requêtes sur les dates de séances
-- CREATE INDEX IF NOT EXISTS idx_sessions_session_date ON sessions(session_date);

-- Commentaire pour expliquer le nouveau champ
-- COMMENT ON COLUMN sessions.session_date IS 'Date à laquelle la séance est effectuée. Utilisée pour la détection des records personnels et le partage.';
