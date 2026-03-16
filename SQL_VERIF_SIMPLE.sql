-- VÉRIFICATION SIMPLE

-- Est-ce que t'as le 65kg x 4 reps ?
SELECT * FROM performances 
WHERE weight = 65 AND reps = 4
ORDER BY performance_date DESC;

-- Est-ce que t'as le 62.5kg x 4 reps en historique ?
SELECT * FROM performances 
WHERE weight = 62.5 AND reps = 4
ORDER BY performance_date DESC;
