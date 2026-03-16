-- Script pour déboguer et trouver le nom exact de ta séance

-- 1. Voir toutes les séances existantes
SELECT 
    id,
    name,
    created_at,
    session_date,
    LENGTH(name) as name_length
FROM sessions 
ORDER BY created_at DESC;

-- 2. Chercher les séances qui contiennent "haut du corps"
SELECT 
    id,
    name,
    created_at,
    session_date
FROM sessions 
WHERE name ILIKE '%haut du corps%'
   OR name ILIKE '%cycle%'
   OR name ILIKE '%cycle 2%';

-- 3. Voir les performances pour trouver le bon nom de séance
SELECT DISTINCT 
    session_name,
    COUNT(*) as nombre_performances,
    MAX(performance_date) as derniere_date
FROM performances 
WHERE session_name ILIKE '%haut du corps%'
   OR session_name ILIKE '%cycle%'
   OR session_name ILIKE '%cycle 2%'
GROUP BY session_name;

-- 4. Voir les performances exactes de "Cycle 2 : haut du corps"
SELECT 
    p.id,
    p.exercise_name,
    p.reps,
    p.weight,
    p.performance_date,
    p.session_name,
    p.created_at
FROM performances p 
WHERE p.session_name = 'Cycle 2 : haut du corps'
ORDER BY p.performance_date DESC, p.exercise_name;
