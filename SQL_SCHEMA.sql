-- ==========================================
-- SCRIPTS SQL POUR MUSCULATION APP
-- À exécuter dans Supabase SQL Editor
-- ==========================================

-- ===== CRÉER LES TABLES =====

-- Table: exercises (Exercices)
CREATE TABLE IF NOT EXISTS exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_custom BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: muscle_groups (Groupes musculaires pour chaque exercice)
CREATE TABLE IF NOT EXISTS muscle_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  muscle_group VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: sessions (Séances d'entraînement)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: exercise_variants (Variantes d'exécution par exercice)
CREATE TABLE IF NOT EXISTS exercise_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: session_exercises (Exercices dans une séance)
CREATE TABLE IF NOT EXISTS session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  series_count INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: performances (Performances/Résultats)
CREATE TABLE IF NOT EXISTS performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  exercise_name VARCHAR(255) NOT NULL,
  session_name VARCHAR(255),
  variant_id UUID REFERENCES exercise_variants(id) ON DELETE SET NULL,
  variant_name VARCHAR(150) NOT NULL DEFAULT 'Touch and Go',
  reps INTEGER NOT NULL CHECK (reps >= 0),
  weight DECIMAL(10, 2) CHECK (weight IS NULL OR weight > 0),
  rpe INTEGER CHECK (rpe BETWEEN 6 AND 10),
  series_number INTEGER NOT NULL,
  performance_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: coach_notes (Remarques du coach)
CREATE TABLE IF NOT EXISTS coach_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Table: shared_sessions (Liens publics de partage de séance)
CREATE TABLE IF NOT EXISTS shared_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===== CRÉER LES INDEX =====

-- Index pour améliorer les performances des requêtes
CREATE INDEX IF NOT EXISTS idx_muscle_groups_exercise_id ON muscle_groups(exercise_id);
CREATE INDEX IF NOT EXISTS idx_exercise_variants_exercise_id ON exercise_variants(exercise_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_session_id ON session_exercises(session_id);
CREATE INDEX IF NOT EXISTS idx_session_exercises_exercise_id ON session_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_performances_exercise_id ON performances(exercise_id);
CREATE INDEX IF NOT EXISTS idx_performances_variant_id ON performances(variant_id);
CREATE INDEX IF NOT EXISTS idx_performances_date ON performances(performance_date);
CREATE INDEX IF NOT EXISTS idx_coach_notes_exercise_id ON coach_notes(exercise_id);
CREATE INDEX IF NOT EXISTS idx_shared_sessions_created_at ON shared_sessions(created_at);

-- ===== INSÉRER DES DONNÉES PRÉDÉFINIES =====

-- Exercices prédéfinis
INSERT INTO exercises (name, description, is_custom) VALUES
('Développé Couché', 'Exercice de base pour la poitrine avec haltères ou barre', false),
('Tirage Horizontal', 'Exercice pour développer les muscles du dos', false),
('Squats', 'Exercice fondamental pour les jambes et les fessiers', false),
('Presse à Épaules', 'Développement des muscles des épaules', false),
('Biceps Curl', 'Exercice d''isolation pour les biceps', false),
('Extension Triceps', 'Exercice pour isoler les triceps', false),
('Deadlift', 'Exercice complet pour l''ensemble du corps, axé sur les jambes et le dos', false),
('Tractions', 'Exercice de poids corporel pour le dos et les bras', false)
ON CONFLICT DO NOTHING;

-- ===== AJOUTER LES GROUPES MUSCULAIRES AUX EXERCICES PRÉDÉFINIS =====

-- Récupérer les IDs des exercices et ajouter leurs groupes musculaires
DO $$
DECLARE
  dev_couche_id UUID;
  tirage_id UUID;
  squat_id UUID;
  presse_id UUID;
  biceps_id UUID;
  triceps_id UUID;
  deadlift_id UUID;
  tractions_id UUID;
BEGIN
  -- Récupérer les IDs
  SELECT id INTO dev_couche_id FROM exercises WHERE name = 'Développé Couché' LIMIT 1;
  SELECT id INTO tirage_id FROM exercises WHERE name = 'Tirage Horizontal' LIMIT 1;
  SELECT id INTO squat_id FROM exercises WHERE name = 'Squats' LIMIT 1;
  SELECT id INTO presse_id FROM exercises WHERE name = 'Presse à Épaules' LIMIT 1;
  SELECT id INTO biceps_id FROM exercises WHERE name = 'Biceps Curl' LIMIT 1;
  SELECT id INTO triceps_id FROM exercises WHERE name = 'Extension Triceps' LIMIT 1;
  SELECT id INTO deadlift_id FROM exercises WHERE name = 'Deadlift' LIMIT 1;
  SELECT id INTO tractions_id FROM exercises WHERE name = 'Tractions' LIMIT 1;

  -- Ajouter les groupes musculaires
  INSERT INTO muscle_groups (exercise_id, muscle_group) VALUES
  (dev_couche_id, 'Pecs'),
  (dev_couche_id, 'Triceps'),
  (dev_couche_id, 'Avant-bras'),
  (tirage_id, 'Grand dorsal'),
  (tirage_id, 'Biceps'),
  (tirage_id, 'Trapeze'),
  (squat_id, 'Quadriceps'),
  (squat_id, 'Fessiers'),
  (squat_id, 'Ischios'),
  (presse_id, 'Épaules'),
  (presse_id, 'Triceps'),
  (presse_id, 'Pecs'),
  (biceps_id, 'Biceps'),
  (biceps_id, 'Avant-bras'),
  (triceps_id, 'Triceps'),
  (triceps_id, 'Avant-bras'),
  (deadlift_id, 'Bas du dos'),
  (deadlift_id, 'Quadriceps'),
  (deadlift_id, 'Ischios'),
  (deadlift_id, 'Fessiers'),
  (deadlift_id, 'Grand dorsal'),
  (tractions_id, 'Grand dorsal'),
  (tractions_id, 'Biceps'),
  (tractions_id, 'Trapeze'),
  (tractions_id, 'Avant-bras')
  ON CONFLICT DO NOTHING;
END $$;

-- ===== AJOUTER LES VARIANTES PAR DÉFAUT =====
INSERT INTO exercise_variants (exercise_id, name, is_default)
SELECT e.id, 'Touch and Go', true
FROM exercises e
WHERE NOT EXISTS (
  SELECT 1
  FROM exercise_variants ev
  WHERE ev.exercise_id = e.id
    AND LOWER(ev.name) = LOWER('Touch and Go')
);

-- ===== VUE POUR RÉCUPÉRER LES EXERCICES AVEC LEURS GROUPES MUSCULAIRES =====

CREATE OR REPLACE VIEW exercises_with_muscles AS
SELECT 
  e.id,
  e.name,
  e.description,
  e.is_custom,
  e.created_at,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT mg.muscle_group ORDER BY mg.muscle_group), NULL) as muscle_groups
FROM exercises e
LEFT JOIN muscle_groups mg ON e.id = mg.exercise_id
GROUP BY e.id, e.name, e.description, e.is_custom, e.created_at;

-- ===== ACTIVER RLS (ROW LEVEL SECURITY) - OPTIONNEL =====

-- Décommenter si vous voulez ajouter l'authentification plus tard
/*
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE performances ENABLE ROW LEVEL SECURITY;
ALTER TABLE coach_notes ENABLE ROW LEVEL SECURITY;
*/

-- ===== REQUÊTES UTILES POUR TESTER =====

-- Voir tous les exercices avec leurs groupes musculaires:
-- SELECT * FROM exercises_with_muscles;

-- Voir les performances d'un exercice:
-- SELECT * FROM performances WHERE exercise_name = 'Développé Couché' ORDER BY performance_date DESC;

-- Voir les statistiques globales:
-- SELECT 
--   COUNT(*) as total_series,
--   COUNT(DISTINCT exercise_name) as exercices_differents,
--   SUM(reps) as total_reps,
--   ROUND(SUM(reps * weight)::numeric, 2) as poids_total_leve
-- FROM performances;
