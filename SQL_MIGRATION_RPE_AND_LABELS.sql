-- Migration pour base existante:
-- 1) Ajouter le RPE aux performances
-- 2) Ajouter les variantes d'exercice
-- 3) Lier les performances aux variantes
-- 4) Supprimer les doublons d'etiquettes musculaires dans la vue

ALTER TABLE performances
ADD COLUMN IF NOT EXISTS rpe INTEGER;

ALTER TABLE performances
DROP CONSTRAINT IF EXISTS performances_rpe_check;

ALTER TABLE performances
ADD CONSTRAINT performances_rpe_check CHECK (rpe IS NULL OR (rpe BETWEEN 6 AND 10));

CREATE TABLE IF NOT EXISTS exercise_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE performances
ADD COLUMN IF NOT EXISTS variant_id UUID REFERENCES exercise_variants(id) ON DELETE SET NULL;

ALTER TABLE performances
ADD COLUMN IF NOT EXISTS variant_name VARCHAR(150);

UPDATE performances
SET variant_name = 'Touch and Go'
WHERE variant_name IS NULL OR TRIM(variant_name) = '';

ALTER TABLE performances
ALTER COLUMN variant_name SET DEFAULT 'Touch and Go';

ALTER TABLE performances
ALTER COLUMN variant_name SET NOT NULL;

INSERT INTO exercise_variants (exercise_id, name, is_default)
SELECT e.id, 'Touch and Go', true
FROM exercises e
WHERE NOT EXISTS (
  SELECT 1
  FROM exercise_variants ev
  WHERE ev.exercise_id = e.id
    AND LOWER(ev.name) = LOWER('Touch and Go')
);

CREATE INDEX IF NOT EXISTS idx_exercise_variants_exercise_id ON exercise_variants(exercise_id);
CREATE INDEX IF NOT EXISTS idx_performances_variant_id ON performances(variant_id);

-- Autoriser les séries incomplètes quand l'utilisateur termine la séance
-- (reps = 0 et weight = NULL)
ALTER TABLE performances
ALTER COLUMN weight DROP NOT NULL;

ALTER TABLE performances
DROP CONSTRAINT IF EXISTS performances_reps_check;

ALTER TABLE performances
ADD CONSTRAINT performances_reps_check CHECK (reps >= 0);

ALTER TABLE performances
DROP CONSTRAINT IF EXISTS performances_weight_check;

ALTER TABLE performances
ADD CONSTRAINT performances_weight_check CHECK (weight IS NULL OR weight >= 0);

CREATE OR REPLACE VIEW exercises_with_muscles AS
SELECT
  e.id,
  e.name,
  e.description,
  e.is_custom,
  e.created_at,
  ARRAY_REMOVE(ARRAY_AGG(DISTINCT mg.muscle_group ORDER BY mg.muscle_group), NULL) AS muscle_groups
FROM exercises e
LEFT JOIN muscle_groups mg ON e.id = mg.exercise_id
GROUP BY e.id, e.name, e.description, e.is_custom, e.created_at;

-- Conseils généraux globaux (singleton id=1)
CREATE TABLE IF NOT EXISTS general_advice (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  training_notes TEXT NOT NULL DEFAULT '',
  nutrition_notes TEXT NOT NULL DEFAULT '',
  sleep_notes TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO general_advice (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;
