# Retours utilisateur (lot du 25/11) — design

Notes de l'utilisateur, avec ses réponses : demi-semaine arrondie à 4 jours ; le glissement concerne la barre du bas.
Les autres choix sont marqués « Choix ». Pas de nouveaux tests (demande explicite).

## 1. Durée des cycles et report
- Réglage général « Durée des cycles » : 1 à 4 semaines par pas de 0,5. Jours : 1 → 7, 1,5 → 11, 2 → 14, 2,5 → 18, 3 → 21, 3,5 → 25, 4 → 28 (demi-semaine = 4 jours).
- Le choix « 2 ou 3 semaines » disparaît. À la place : « Reporter le prochain cycle d'une semaine » (+7 jours sur le bloc en cours, sans limite) et « Annuler un report » (−7 jours, impossible si le bloc finirait avant aujourd'hui).
- Le report ne vaut que pour le bloc en cours ; les blocs suivants reprennent la durée générale.
- Modèle : `CycleState { current, startedOn, lengthDays, extraDays }` (bloc en cours = lengthDays + extraDays). Anciennes données `weeks: 2|3` → lengthDays 14, extraDays (weeks−2)×7.
- « Semaine N sur M » : M = ⌈jours du bloc / 7⌉. Tout ce qui utilisait `weeks` (accueil, frise, Programme, Réglages, rappels, bilan de bloc, planning) suit la nouvelle durée.
- Stockage : colonnes `length_days` (7–28) et `extra_days` (≥ 0, multiple de 7) sur `cycle_state`, migration additive ; Choix : la contrainte `weeks in (2,3)` est retirée et `weeks` reste écrit (⌈bloc/7⌉) pour compatibilité.

## 2. Séance
- La cible suit le nombre de reps : modifier les reps d'une série met la cible sur le record à ce nombre de reps (même variante) ; sans record à ce nombre, cible vide (« à conquérir »). Une cible choisie dans « Mes records » remplit reps et cible comme aujourd'hui.
- Variantes et état de l'exercice mieux distingués : Choix : la variante reste une rangée de puces pleines sous le nom de l'exercice, libellée « Variante » ; l'état devient une rangée séparée, libellée « Mon état », puces contour avec pastille, séparée par un filet et plus d'espace.

## 3. Interface
- Glisser à gauche / à droite sur les 4 écrans principaux passe à l'onglet voisin de la barre du bas (Accueil ↔ Programme ↔ Records ↔ Exercices). Ignoré si le geste part d'un champ, d'une zone qui défile horizontalement ou d'une feuille ouverte ; seuil horizontal net (> 60 px et nettement plus horizontal que vertical).
- Hauteur des débuts de page alignée : un composant d'en-tête commun (même marge haute, même taille de titre) pour Accueil, Programme, Records, Exercices (et Réglages, Bilan).
- Remarques du coach (édition d'exercice) : plus de double encadré jaune ; un seul champ au style des autres champs, libellé « Remarques du coach ».
- Accueil : « Décaler… » et « Sauter cette semaine » passent **dans** l'encadré citron de la prochaine séance, en bas, sous les séries (idem pour les cartes de séance manquée).

## 4. Import Excel
- Comme la 1re version, mais visible : bouton « Importer un fichier » sur l'écran Records (plus caché dans le menu ⋯), avec rappel des colonnes acceptées.
- Fichiers `.xlsx` (première feuille) et `.csv` ; Choix : bibliothèque `read-excel-file` (légère) pour lire l'xlsx, convertie en lignes pour la logique d'import existante (`domain/csv`), mêmes règles de validation et même retour ligne par ligne.
