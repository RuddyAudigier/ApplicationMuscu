-- Migration pour ajouter le champ session_date à la table sessions
-- Permet de stocker la date de la séance pour une meilleure détection des PR

-- Ajouter le champ session_date à la table sessions
ALTER TABLE sessions 
ADD COLUMN session_date DATE;

-- Mettre à jour les séances existantes avec leur date de création comme date de séance
UPDATE sessions 
SET session_date = DATE(created_at) 
WHERE session_date IS NULL;

-- Créer un index pour optimiser les requêtes sur les dates de séances
CREATE INDEX idx_sessions_session_date ON sessions(session_date);

-- Commentaire pour expliquer le nouveau champ
COMMENT ON COLUMN sessions.session_date IS 'Date à laquelle la séance est effectuée. Utilisée pour la détection des records personnels et le partage.';
