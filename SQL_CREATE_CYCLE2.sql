-- Script pour recréer la séance "Cycle 2 : Haut du corps" avec les mêmes exercices

-- ÉTAPE 1 : Créer la séance
INSERT INTO sessions (name) 
VALUES ('Cycle 2 : Haut du corps')
RETURNING id;

-- Note : Récupère l'ID retourné (ça sera quelque chose comme xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)

-- ÉTAPE 2 : Ajouter les exercices à la séance
-- Remplacer SESSION_ID par l'ID retourné ci-dessus

-- Développé couché (4 séries)
INSERT INTO session_exercises (session_id, exercise_id, series_count)
VALUES 
    ('SESSION_ID', 'dev-couche', 4);

-- Rowing incliné haltères (3 séries) - si cet exercice existe
INSERT INTO session_exercises (session_id, exercise_id, series_count)
VALUES 
    ('SESSION_ID', 'rowing-incline-halt', 3);

-- Tractions (3 séries) - si cet exercice existe
INSERT INTO session_exercises (session_id, exercise_id, series_count)
VALUES 
    ('SESSION_ID', 'tractions', 3);

-- Élévations latérales (3 séries) - si cet exercice existe
INSERT INTO session_exercises (session_id, exercise_id, series_count)
VALUES 
    ('SESSION_ID', 'elevations-laterales', 3);

-- Flexions biceps (3 séries) - si cet exercice existe
INSERT INTO session_exercises (session_id, exercise_id, series_count)
VALUES 
    ('SESSION_ID', 'flexions-biceps', 3);

-- Vérification
SELECT 
    s.id as session_id,
    s.name as session_name,
    se.exercise_id,
    e.name as exercise_name,
    se.series_count
FROM sessions s
JOIN session_exercises se ON s.id = se.session_id
JOIN exercises e ON se.exercise_id = e.id
WHERE s.name = 'Cycle 2 : Haut du corps';
