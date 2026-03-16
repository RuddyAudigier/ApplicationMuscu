-- Vérification simple : est-ce que tout a été supprimé ?

-- 1. Performances restantes pour cette séance
SELECT COUNT(*) as performances_restantes FROM performances 
WHERE session_name = 'Cycle 2 : Haut du corps';

-- 2. Si > 0, les supprimer
DELETE FROM performances 
WHERE session_name = 'Cycle 2 : Haut du corps';

-- 3. Vérifier que c'est bon
SELECT COUNT(*) as performances_apres_suppression FROM performances 
WHERE session_name = 'Cycle 2 : Haut du corps';

-- 4. Vérifier que la séance est bien supprimée
SELECT COUNT(*) as sessions_restantes FROM sessions 
WHERE name = 'Cycle 2 : Haut du corps';
