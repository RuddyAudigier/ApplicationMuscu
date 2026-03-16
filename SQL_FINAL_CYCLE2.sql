-- SCRIPT SIMPLE ET GARANTI POUR RECREER LA SÉANCE
-- EXÉCUTEZ ÇA DIRECTEMENT

-- 1. Créer la séance
INSERT INTO sessions (name) 
VALUES ('Cycle 2 : Haut du corps')
RETURNING id;

-- 2. Récupérer l'ID qui vient d'être créé
-- Copiez l'ID retourné ci-dessous et remplacez XXXXXX dans la suite

-- 3. Ajouter les exercices (remplacez XXXXXX par l'ID ci-dessus)
INSERT INTO session_exercises (session_id, exercise_id, series_count) VALUES
    ('XXXXXX', 'dev-couche', 4),
    ('XXXXXX', 'tractions', 3),
    ('XXXXXX', 'elevations-laterales', 3),
    ('XXXXXX', 'flexions-biceps', 3);

-- 4. Vérifier que tout est bien créé
SELECT 
    s.name as session_name,
    e.name as exercise_name,
    se.series_count
FROM sessions s
JOIN session_exercises se ON s.id = se.session_id
JOIN exercises e ON se.exercise_id = e.id
WHERE s.name = 'Cycle 2 : Haut du corps'
ORDER BY e.name;
