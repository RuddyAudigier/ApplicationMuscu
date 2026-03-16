-- Vérifier quelles données restent et contribuent aux PR

-- 1. Voir toutes tes performances restantes
SELECT 
    p.exercise_name,
    p.reps,
    p.weight,
    p.performance_date,
    p.session_name,
    p.variant_name
FROM performances p 
WHERE p.exercise_name ILIKE '%développé%' OR p.exercise_name ILIKE '%developpe%'
ORDER BY p.performance_date DESC, p.weight DESC;

-- 2. Voir toutes tes séances restantes
SELECT 
    id,
    name,
    created_at,
    session_date
FROM sessions 
ORDER BY created_at DESC;

-- 3. Compter les performances par exercice
SELECT 
    exercise_name,
    COUNT(*) as nb_performances,
    MAX(weight) as max_poids,
    MAX(reps) as max_reps
FROM performances 
GROUP BY exercise_name 
ORDER BY exercise_name;
