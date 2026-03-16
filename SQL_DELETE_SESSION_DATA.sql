-- Script pour supprimer toutes les données d'une séance spécifique
-- À utiliser avec précaution - cette action est irréversible !

-- =================================================================
-- INSTRUCTIONS :
-- 1. Remplacer 'NOM_DE_LA_SEANCE' par le nom exact de ta séance
-- 2. Exécuter ce script dans l'éditeur SQL Supabase
-- 3. Vérifier les résultats avant de valider
-- =================================================================

-- 🔍 ÉTAPE 1 : Vérifier ce qui va être supprimé (optionnel mais recommandé)
-- =================================================================

-- Voir les performances qui vont être supprimées
SELECT 
    p.id,
    p.exercise_name,
    p.reps,
    p.weight,
    p.performance_date,
    p.session_name
FROM performances p 
WHERE p.session_name = 'Cycle 2 : Haut du corps'
ORDER BY p.performance_date DESC, p.exercise_name;

-- Voir les exercices de séance qui vont être supprimés
SELECT 
    se.id,
    s.name as session_name,
    e.name as exercise_name,
    se.series_count
FROM session_exercises se
JOIN sessions s ON se.session_id = s.id
JOIN exercises e ON se.exercise_id = e.id
WHERE s.name = 'Cycle 2 : Haut du corps';

-- Voir la séance qui va être supprimée
SELECT 
    id,
    name,
    created_at,
    session_date
FROM sessions 
WHERE name = 'Cycle 2 : Haut du corps';

-- =================================================================
-- 🗑️ ÉTAPE 2 : Suppression des données (exécuter seulement après vérification)
-- =================================================================

-- DÉBUT DE LA TRANSACTION - pour pouvoir annuler si erreur
BEGIN;

-- 1. Supprimer toutes les performances de la séance
DELETE FROM performances 
WHERE session_name = 'Cycle 2 : haut du corps';

-- 2. Supprimer les exercices de la séance
DELETE FROM session_exercises 
WHERE session_id IN (
    SELECT id FROM sessions 
    WHERE name = 'Cycle 2 : Haut du corps'
);

-- 3. Supprimer la séance elle-même
DELETE FROM sessions 
WHERE name = 'Cycle 2 : Haut du corps';

-- Valider toutes les suppressions
COMMIT;

-- =================================================================
-- ✅ ÉTAPE 3 : Vérifier que tout a été supprimé
-- =================================================================

-- Vérifier qu'il ne reste plus de performances
SELECT COUNT(*) as performances_restantes
FROM performances 
WHERE session_name = 'Cycle 2 : haut du corps';

-- Vérifier qu'il ne reste plus d'exercices de séance
SELECT COUNT(*) as exercises_restants
FROM session_exercises se
JOIN sessions s ON se.session_id = s.id
WHERE s.name = 'Cycle 2 : Haut du corps';

-- Vérifier qu'il ne reste plus la séance
SELECT COUNT(*) as sessions_restantes
FROM sessions 
WHERE name = 'Cycle 2 : Haut du corps';

-- =================================================================
-- 📝 NOTES IMPORTANTES
-- =================================================================

/*
⚠️  AVERTISSEMENTS :
- Cette action est IRRÉVERSIBLE
- Toutes les performances de cette séance seront perdues
- Les PR basés sur ces performances disparaîtront
- Fais une sauvegarde si tu as besoin des données

💡 CONSEILS :
- Exécute d'abord les requêtes de vérification (étape 1)
- Compte bien les enregistrements avant de supprimer
- Note les performances importantes si tu veux les recréer

🔄 APRÈS SUPPRESSION :
- Crée une nouvelle séance avec la bonne date
- Refais tes performances avec les vraies charges
- Les PR seront correctement détectés avec la nouvelle logique
*/
