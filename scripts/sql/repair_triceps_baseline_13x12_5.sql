-- Reparation ciblee:
-- Garantir une reference historique "13 reps x 12.5 kg" pour
-- "Extension triceps poulie basse" / variante "Touch and Go",
-- date anterieure a la seance du 2026-03-06.
--
-- Pourquoi:
-- Si cette ligne n'existe pas (ou n'est pas rattachee au bon exercise_id),
-- la S1 a 13 reps reste en "Prise de donnees".

BEGIN;

-- 1) Diagnostic: toutes les lignes 13 reps pour cet exercice/variante.
SELECT
  'before_repair' AS step,
  id,
  exercise_id,
  exercise_name,
  variant_id,
  variant_name,
  reps,
  weight,
  performance_date,
  session_name,
  created_at
FROM performances
WHERE LOWER(TRIM(exercise_name)) = 'extension triceps poulie basse'
  AND LOWER(REGEXP_REPLACE(TRIM(variant_name), '\s+', ' ', 'g')) = 'touch and go'
  AND reps = 13
ORDER BY performance_date ASC, created_at ASC;

-- 2) Inserer la baseline si absente pour le bon exercice.
WITH target_exercise AS (
  SELECT
    p.exercise_id
  FROM performances p
  WHERE LOWER(TRIM(p.exercise_name)) = 'extension triceps poulie basse'
  ORDER BY p.created_at DESC
  LIMIT 1
),
target_variant AS (
  SELECT
    p.variant_id,
    p.variant_name
  FROM performances p
  JOIN target_exercise te ON te.exercise_id = p.exercise_id
  WHERE LOWER(REGEXP_REPLACE(TRIM(p.variant_name), '\s+', ' ', 'g')) = 'touch and go'
  ORDER BY p.created_at DESC
  LIMIT 1
)
INSERT INTO performances (
  exercise_id,
  exercise_name,
  session_name,
  reps,
  weight,
  rpe,
  variant_id,
  variant_name,
  series_number,
  performance_date
)
SELECT
  te.exercise_id,
  'Extension triceps poulie basse',
  'Historique Cycle 1',
  13,
  12.5,
  10,
  tv.variant_id,
  COALESCE(tv.variant_name, 'Touch and Go'),
  1,
  DATE '2026-02-07'
FROM target_exercise te
LEFT JOIN target_variant tv ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM performances p
  WHERE p.exercise_id = te.exercise_id
    AND LOWER(REGEXP_REPLACE(TRIM(p.variant_name), '\s+', ' ', 'g')) = 'touch and go'
    AND p.reps = 13
    AND p.weight = 12.5
    AND p.performance_date < DATE '2026-03-06'
);

-- 3) Verification apres reparation.
SELECT
  'after_repair' AS step,
  id,
  exercise_id,
  exercise_name,
  variant_id,
  variant_name,
  reps,
  weight,
  performance_date,
  session_name,
  created_at
FROM performances
WHERE LOWER(TRIM(exercise_name)) = 'extension triceps poulie basse'
  AND LOWER(REGEXP_REPLACE(TRIM(variant_name), '\s+', ' ', 'g')) = 'touch and go'
  AND reps = 13
ORDER BY performance_date ASC, created_at ASC;

COMMIT;

