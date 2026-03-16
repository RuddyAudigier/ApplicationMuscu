-- Solution intelligente : Reset temporaire du développé couché pour permettre la détection PR
-- On sauvegarde l'ancien record, on supprime temporairement, puis on recrée

-- ÉTAPE 1 : Sauvegarder les infos importantes avant suppression
CREATE TEMPORARY TABLE backup_developpe_couche AS
SELECT 
    p.*,
    ROW_NUMBER() OVER (PARTITION BY p.reps ORDER BY p.weight DESC, p.performance_date DESC) as rank_by_reps
FROM performances p 
WHERE p.exercise_name ILIKE '%développé%' OR p.exercise_name ILIKE '%developpe%';

-- Voir ce qui va être sauvegardé
SELECT * FROM backup_developpe_couche ORDER BY reps, weight DESC;

-- ÉTAPE 2 : Supprimer seulement les performances de développé couché
DELETE FROM performances 
WHERE exercise_name ILIKE '%développé%' OR exercise_name ILIKE '%developpe%';

-- ÉTAPE 3 : Vérifier que c'est bien supprimé
SELECT COUNT(*) as nb_developpe_restant FROM performances 
WHERE exercise_name ILIKE '%développé%' OR exercise_name ILIKE '%developpe%';

-- =================================================================
-- MAINTENANT :
-- 1. Crée ta nouvelle séance "Cycle 2 : Haut du corps" avec la bonne date
-- 2. Fais tes 65kg x 4 reps et autres performances
-- 3. Vérifie que les PR sont bien détectés
-- =================================================================

-- ÉTAPE 4 (OPTIONNEL) : Restaurer l'ancien record si besoin plus tard
-- Pour restaurer l'ancien record de 4 reps à 62.5kg :
/*
INSERT INTO performances (
    id, exercise_name, reps, weight, rpe, variant_id, variant_name, 
    performance_date, created_at, exercise_id, serie_number, session_name
)
SELECT 
    gen_random_uuid(),
    exercise_name,
    reps,
    weight,
    rpe,
    variant_id,
    variant_name,
    performance_date,
    created_at,
    exercise_id,
    serie_number,
    session_name
FROM backup_developpe_couche 
WHERE reps = 4 AND rank_by_reps = 2; -- Le 2ème meilleur pour 4 reps
*/

-- Nettoyer la table temporaire quand c'est bon
DROP TABLE IF EXISTS backup_developpe_couche;
