-- TEST DIRECT DE LA LOGIQUE PR AVEC TES DONNÉES
-- On va tester le buildSharedSessionPayload manuellement

-- 1. Voir toutes les performances du développé couché
SELECT 
    p.id,
    p.exercise_name,
    p.reps,
    p.weight,
    p.performance_date,
    p.series_number,
    p.session_name,
    -- Calculer la clé comme dans le code
    (COALESCE(p.exercise_id, '')::text || COALESCE(p.exercise_name, '')::text || 'unknown')::text || '::'::text || COALESCE(p.series_number, 1)::text) as exercise_key,
    -- Timestamp comme dans le code
    CASE 
        WHEN p.created_at IS NOT NULL AND DATE(p.created_at) = p.performance_date 
        THEN EXTRACT(EPOCH FROM p.created_at) * 1000
        ELSE EXTRACT(EPOCH FROM p.performance_date) * 1000
    END as timestamp
FROM performances p 
WHERE p.exercise_name ILIKE '%développé%' 
   OR p.exercise_name ILIKE '%developpe%'
ORDER BY p.performance_date DESC, p.exercise_key;

-- 2. Simuler la logique de sélection des "latest performances"
-- Trouver la performance la plus récente pour chaque exercice/série

-- 3. Voir les performances historiques AVANT ta séance du 21/02/2026
SELECT 
    p.exercise_name,
    p.reps,
    p.weight,
    p.performance_date,
    'HISTORIQUE' as type
FROM performances p 
WHERE (p.exercise_name ILIKE '%développé%' OR p.exercise_name ILIKE '%developpe%')
  AND p.performance_date < '2026-02-21'
  AND p.reps = 4
ORDER BY p.weight DESC, p.performance_date DESC
LIMIT 5;

-- 4. Voir les performances de ta séance du 21/02/2026
SELECT 
    p.exercise_name,
    p.reps,
    p.weight,
    p.performance_date,
    'ACTUELLE' as type
FROM performances p 
WHERE (p.exercise_name ILIKE '%développé%' OR p.exercise_name ILIKE '%developpe%')
  AND p.performance_date = '2026-02-21'
  AND p.reps = 4
ORDER BY p.weight DESC, p.performance_date DESC;
