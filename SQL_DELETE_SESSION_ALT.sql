-- Script de suppression alternatif avec plus de sécurité et de débogage

-- ÉTAPE 1 : Trouver l'ID exact de la séance
SELECT id, name FROM sessions WHERE name = 'Cycle 2 : haut du corps';

-- Si la requête ci-dessus ne retourne rien, essaie celle-ci :
SELECT id, name FROM sessions WHERE name ILIKE '%cycle%haut%corps%';

-- ÉTAPE 2 : Compter avant suppression (pour vérifier)
SELECT 
    (SELECT COUNT(*) FROM performances WHERE session_name = 'Cycle 2 : haut du corps') as nb_performances,
    (SELECT COUNT(*) FROM session_exercises WHERE session_id = (SELECT id FROM sessions WHERE name = 'Cycle 2 : haut du corps')) as nb_exercises,
    (SELECT COUNT(*) FROM sessions WHERE name = 'Cycle 2 : haut du corps') as nb_sessions;

-- ÉTAPE 3 : Suppression avec l'ID (plus fiable)
-- Remplace XXX par l'ID trouvé à l'étape 1

-- D'abord les performances
DELETE FROM performances 
WHERE session_name = 'Cycle 2 : haut du corps';

-- Ensuite les exercices de séance (remplace XXX par l'ID)
DELETE FROM session_exercises 
WHERE session_id = XXX;

-- Enfin la séance (remplace XXX par l'ID)
DELETE FROM sessions 
WHERE id = XXX;

-- ÉTAPE 4 : Vérification
SELECT 
    (SELECT COUNT(*) FROM performances WHERE session_name = 'Cycle 2 : haut du corps') as performances_restantes,
    (SELECT COUNT(*) FROM sessions WHERE name = 'Cycle 2 : haut du corps') as sessions_restantes;
