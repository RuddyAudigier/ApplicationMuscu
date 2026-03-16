-- Correction ciblee (version 2):
-- Le "Record egalé 14,6 (06/03/2026)" vient de la ligne de la seance test.
-- On supprime uniquement la ligne test pour ne plus polluer l'historique.
--
-- Effet attendu ensuite:
-- ta vraie seance doit repasser en "Record battu ... vs 12,5".

BEGIN;

-- 1) Diagnostic: toutes les perfs 13 reps sur cet exo/variante.
SELECT
  'diagnostic_all_rows' AS step,
  id,
  exercise_name,
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
ORDER BY created_at DESC;

-- 2) Suppression de la ligne de la seance test (celle qui cree le "record egalé").
DELETE FROM performances
WHERE LOWER(TRIM(exercise_name)) = 'extension triceps poulie basse'
  AND LOWER(REGEXP_REPLACE(TRIM(variant_name), '\s+', ' ', 'g')) = 'touch and go'
  AND reps = 13
  AND weight IN (14.6, 14.8)
  AND performance_date = DATE '2026-03-06'
  AND session_name = 'SEANCE TRICEPS TEST';

-- 3) Verification apres suppression.
SELECT
  'after_delete_test_row' AS step,
  id,
  exercise_name,
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
ORDER BY created_at DESC;

COMMIT;
