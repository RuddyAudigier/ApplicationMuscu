-- Vérifier les exercices disponibles dans ta base pour recréer la séance

-- Voir tous les exercices qui pourraient être dans "Haut du corps"
SELECT 
    id,
    name,
    created_at
FROM exercises 
WHERE name ILIKE '%développé%' 
   OR name ILIKE '%rowing%'
   OR name ILIKE '%traction%'
   OR name ILIKE '%élévation%'
   OR name ILIKE '%elevation%'
   OR name ILIKE '%biceps%'
   OR name ILIKE '%curl%'
   OR name ILIKE '%epaule%'
   OR name ILIKE '%delto%'
ORDER BY name;

-- Voir les exercices les plus courants pour haut du corps
SELECT 
    id,
    name,
    created_at
FROM exercises 
WHERE name ILIKE '%développé%'
   OR name ILIKE '%pompes%'
   OR name ILIKE '%dip%'
ORDER BY name;
