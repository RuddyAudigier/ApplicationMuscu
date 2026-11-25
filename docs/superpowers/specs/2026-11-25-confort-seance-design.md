# Confort de séance et finitions — design

Demande : idées 1 (boutons − / +), 4 (glisser entre exercices), 9 (anneau de progression), 10 (calendrier du mois), 11 (transition entre onglets) ; puis autocritique du code et de l'esthétique, puis README. Pas de nouveaux tests.

## 1. Boutons − / +
- Sur chaque série de travail non validée : − / + autour des kilos (pas **0,5 kg**, minimum 0) et des reps (pas 1, minimum 1). Choix : reps au pas de 1 (une demi-rep n'existe pas) ; mêmes boutons sur les séries de chauffe.
- Champ vide : + met 0,5 kg / 1 rep. Les boutons déclenchent le même chemin que la saisie (la cible suit les reps).
- Cibles tactiles ≥ 44 px, appui long non requis.

## 2. Glisser entre exercices
- Pendant la séance, glisser à gauche / à droite passe à l'exercice suivant / précédent (mêmes règles que le glisser d'onglets : seuil 60 px, ratio 1,5, bords 24 px ignorés, champs et feuilles ignorés). Le bouton « Exercice suivant › » reste.

## 3. Anneau de progression
- En-tête de séance : anneau citron « séries validées / séries prévues » (prévues = somme des séries de travail actuelles), avec le texte « 9/14 ». Animation douce, coupée si animations réduites.

## 4. Calendrier du mois (accueil)
- Carte « Ce mois-ci » : grille lundi → dimanche du mois courant, un point par jour avec séance (perfs), couleur du cycle de ce jour (A = citron plein, B = citron contour) ; aujourd'hui entouré ; flèches mois précédent / suivant ; total « N séances ». Toucher un jour n'ouvre rien (Choix).

## 5. Transition entre onglets
- Changement d'onglet (barre ou glisser) : glissement horizontal court (≈ 200 ms) dans le sens de la navigation ; rien si animations réduites. Pas de transition sur les autres écrans.

## 6. Autocritique puis README
- Revue complète du code et de l'esthétique de l'app (cohérence visuelle, espacements, contrastes, états vides / chargement / erreur, accessibilité, code mort, duplication) ; correctifs ; puis README à jour de toutes les fonctionnalités.
