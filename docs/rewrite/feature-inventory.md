# Inventaire fonctionnel — référence de parité pour la réécriture

Date : 2026-11-23 · Branche : `rewrite` · Base analysée : commit `103a5b8`.

Ce document décrit le comportement **actuel** de l'application, bugs compris. Les bugs sont listés
en section 6. Ils ne font pas partie de la parité, sauf mention contraire. Chaque règle cite
`fichier:ligne`. Les chemins sont relatifs à la racine du dépôt.

Conventions :
- « UTC today » signifie `new Date().toISOString().split('T')[0]` : la date du jour **en UTC**, pas
  en heure locale.
- `alert` / `confirm` / `prompt` désignent les boîtes natives `window.*`. Le texte est reproduit
  à l'identique.
- La « séance modèle » (fiche) est la ligne `sessions`. La « séance réalisée » est un ensemble de
  lignes `performances` qui partagent `session_name` + `performance_date`.

---

## 1. Écrans et navigation

### 1.1 Routage et coquille (`src/App.jsx`)

- Pas de routeur. La page courante est un état React `currentPage` initialisé à `'home'`
  (`src/App.jsx:985`). Valeurs : `home`, `exercises`, `sessions`, `performances`, `progress`,
  `session-runner`, `settings` (`src/App.jsx:1642-1711`). Aucune URL ne change. Le bouton retour
  Android n'est pas géré (pas de plugin `@capacitor/app`) : il ferme l'app.
- Seule exception, le lien de partage public. Au montage (`src/App.jsx:1073-1089`) :
  - query `?sharedId=<id>` ou `?shared=<id>` : charge la séance partagée ;
  - sinon pathname `^/shared/([0-9a-fA-F-]+)$` : charge la séance partagée ;
  - sinon `loadData()`.
- **Chargement** : tant que `loading` est vrai, l'écran affiche le texte centré
  « Chargement des données... » (`src/App.jsx:1573-1587`). `loading` démarre à `true`.
- **Erreur de chargement** : seulement `console.error` (`src/App.jsx:1181-1182`). L'app s'affiche
  avec des listes vides. Aucun écran d'erreur. Les services Supabase `get*` renvoient déjà `[]` en
  cas d'erreur (`src/services/supabaseService.js:123-126`, `:353-356`, `:639-642`).
- **Bandeau mode mock** (si `DATA_BACKEND === 'mock'`) en haut de page (`src/App.jsx:1605-1639`) :
  texte « **Mode test local (mock)** — aucune écriture en base. » + bouton « Reset données ».
  Le bouton ouvre `confirm('Réinitialiser les données de test locales ?\n\nÇa efface uniquement le stockage local du mode mock (pas la base Supabase).')`.
  Si OK : `resetTestDatabase()` puis `window.location.reload()` (`src/App.jsx:1051-1065`).
- **Barre de navigation basse** toujours visible, y compris pendant une séance
  (`src/App.jsx:1776`, `src/components/BottomNavigation.jsx:5-11`). 5 onglets, dans l'ordre :
  `home` « Accueil », `exercises` « Exos », `sessions` « Séances », `performances` « Perfs »,
  `settings` « Réglages ». L'onglet actif a la classe `active` et `aria-current="page"`. Les pages
  `progress` et `session-runner` n'ont pas d'onglet actif. Icônes SVG inline :
  `src/components/BottomNavIcons.jsx`.
- **Modale « Fiche exercice »** (`ExerciseDetailsModal`) globale, montée hors des pages
  (`src/App.jsx:1714-1718`). Elle s'ouvre via `handleOpenExerciseDetails(exerciseId)`
  (`src/App.jsx:1006-1011`) depuis : le nom d'un exercice dans la carte exercice, la liste des
  séances, la séance en cours et le tableau des performances. Elle reçoit uniquement les
  performances dont `exerciseId === exercise.id` (`src/App.jsx:1598-1601`).
- **Modale « Partage de la séance »** (`shareAssist`, `src/App.jsx:1720-1774`) : voir 3.12.

### 1.2 Accueil — `home` (`src/pages/HomePage.jsx`)

- Accès : page initiale, onglet « Accueil ».
- Contenu statique : kicker « Plateforme de suivi musculation », titre « Structurez vos
  entraînements avec méthode. », description, panneau « En un coup d'oeil » (3 puces), 3 cartes
  fonctionnalités (`src/pages/HomePage.jsx:7-45`).
- Bouton CTA « Accéder à l'espace entraînement » : va à `exercises` (`src/pages/HomePage.jsx:15`,
  `src/App.jsx:1643`).
- Tableau de conseils `GeneralAdviceBoard` titre « Conseils généraux (entrainement, nutrition,
  sommeil) », variante `postit` (`src/pages/HomePage.jsx:47`). Voir 1.9.

### 1.3 Exercices — `exercises` (`src/pages/ExercisesPage.jsx`)

- Accès : onglet « Exos », CTA de l'accueil, bouton « Exercices » de la page Séances.
- En-tête : titre « Exercices », sous-titre. Bascule « Exercices (n/total) » (active) /
  « Séances » qui navigue (`src/pages/ExercisesPage.jsx:91-98`). Le compteur `n/total` reflète
  **uniquement** la recherche texte, pas le filtre muscle (`src/pages/ExercisesPage.jsx:57-62`).
- Section « Bibliothèque ».
- **Recherche** (`SearchBar`, voir 3.15) : placeholder « Rechercher par nom ou groupe
  musculaire ». Suggestions (max 8 noms uniques) sous le champ. Clic sur une suggestion = recherche
  sur ce nom. Bouton « Effacer » visible si texte. Les suggestions se ferment 200 ms après le blur
  (`src/components/SearchBar.jsx:112`).
- **Filtre muscle** (`MuscleFilter`) : bouton avec miniature de silhouette (`MuscleMap`), libellé
  « Filtrer par muscle » + valeur (« Tous les muscles » par défaut). Le clic ouvre un popover
  « Muscles » avec bouton « Fermer », un item « Tous / Afficher toute la bibliothèque » et
  15 muscles (`src/components/MuscleFilter.jsx:8-24`) : Pecs, Trapeze, Grand dorsal, Bas du dos,
  Épaules, Biceps, Triceps, Avant-bras, Abdominaux, Quadriceps, Ischios, Fessiers, Mollets,
  Abducteurs, Psoas. Chaque item a une miniature et le texte « Filtrer les exercices ». La sélection
  ferme le popover.
  - Règle de filtrage : égalité exacte après `normalizeMuscleGroups` (trim + comparaison de la
    valeur conservée), donc sensible à la casse et aux accents (`src/pages/ExercisesPage.jsx:66-76`).
    Les alias ne sont pas pris en compte.
  - Le filtre s'applique au résultat de la recherche.
- **Liste** (`ExerciseList`) : si vide, « Aucun exercice trouvé » / « Essayez une autre recherche ou
  ajoutez un nouvel exercice. » (`src/components/ExerciseList.jsx:11-18`). Sinon titre « Exercices
  disponibles » + « N exercice(s) » + une `ExerciseCard` par exercice.
- **Carte exercice** (`src/components/ExerciseCard.jsx`) :
  - Nom cliquable + « Voir la fiche complète » : ouvre la modale fiche (`:199-209`).
  - « Détails rapides » / « Masquer détails rapides » : puces muscles (repli sur l'ancien champ
    `exercise.muscleGroup` si la liste est vide, `:215-221`), « Variantes d'exécution » avec badge
    « Base » sur la variante par défaut, description si présente (`:212-240`).
  - « Modifier » / « Fermer édition » : formulaire d'édition (`:276-414`) :
    - Nom (texte), Description (textarea).
    - Groupes musculaires : select catalogue de 14 entrées (sans Psoas, `:13-28`) + « Ajouter » ;
      champ libre « Ajouter une etiquette libre » + « Ajouter texte ». Ce sont les « étiquettes »
      libres. Les puces sont supprimables par « x ». Le dédoublonnage passe par
      `normalizeMuscleGroups`.
    - Variantes : aide « Exemple: Touch and Go (base), Pause 2.0.2.0, Tempo 3.1.1.0. », champ
      « Ex: Pause 2.0.2.0 » + « Ajouter variante ». Liste éditable : nom inline, radio « Base »
      (une seule par défaut), « Supprimer » (désactivé s'il reste une seule variante).
    - « Enregistrer les modifications » / « Enregistrement... ». Validations par `alert` :
      « Le nom de l'exercice est requis. », « Ajoute au moins un groupe musculaire. »,
      « Ajoute au moins une variante. » (`:166-179`). Succès : `alert('Exercice modifié.')` et
      fermeture (`:189-190`).
  - « Supprimer » : `confirm("Supprimer cet exercice ? Cela retirera aussi ses donnees associees.")`
    (`:255-267`).
  - « Remarques Coach » / « Fermer » : bloc « Remarques du Coach » (`:416-439`). Affiche
    « Dernières remarques: » + texte existant (`white-space` préservé via CSS), textarea
    « Ajouter les remarques du coach... », bouton « Enregistrer les Remarques ». Voir 3.16.
- **Tuile « Créer un exercice »** : ouvre la modale « Nouveau exercice »
  (`src/pages/ExercisesPage.jsx:127-167`). Fermeture par « Fermer », clic sur l'overlay
  (`mousedown` sur l'overlay lui-même) ou Échap (`:27-40`). Focus auto sur `#name` au prochain
  frame (`:42-54`).
- **Formulaire de création** (`src/components/AddExerciseForm.jsx`) : titre « Ajouter un Exercice
  Personnalisé ». Nom requis. Select de 15 muscles (avec Psoas, `:10-26`) + « Ajouter Muscle »
  (lit le select via `document.getElementById('muscleSelect')`, `:93`). Liste « Muscles
  sélectionnés » (« Aucun muscle sélectionné » si vide) avec ✕. Description. Bouton « Ajouter
  l'Exercice ». Soumission seulement si nom trimé non vide **et** au moins 1 muscle. Sinon rien ne
  se passe, sans message (`:45-55`). Pas de saisie de variante à la création : la variante
  « Touch and Go » par défaut est créée. La modale se ferme immédiatement, sans attendre la
  réponse du service (`src/pages/ExercisesPage.jsx:78-81`).

### 1.4 Séances — `sessions` (`src/pages/SessionsPage.jsx`)

- Accès : onglet « Séances », bascule depuis Exercices. Retour automatique ici après « Terminer »
  ou « Abandonner » une séance (`src/App.jsx:1426`, `:1492`).
- En-tête « Séances » + bascule « Exercices » / « Séances (n) ».
- Section « Gestion » : bouton qui bascule le constructeur. Libellé « Créer une séance »,
  « Fermer la création » ou « Annuler la modification » (`src/pages/SessionsPage.jsx:69-75`).
- **Liste** (`src/components/SessionsList.jsx`) :
  - Vide : « Aucune séance créée » + `Utilisez le bouton \"Créer une séance\" pour démarrer.`.
    Les antislashs s'affichent réellement à l'écran (`:37`).
  - Titre « Mes séances ». Une carte par séance, dans l'ordre du state (voir 2.3 pour l'ordre).
    La carte de la séance en cours a la classe `active`.
  - Méta : « Créée le {createdAt} » (chaîne FR déjà formatée), « N exos », « N séries » (somme de
    `series`), puis jusqu'à 3 muscles principaux. Le calcul compte les 2 premiers groupes de chaque
    exercice et trie par fréquence décroissante (`:3-21`). Avec Supabase, `muscleGroups` des
    exercices de séance vaut `[]`, donc rien ne s'affiche (voir 6).
  - Actions (`:74-131`) :
    - séance en cours : « ▶ Continuer » (`onResumeSession`) et « ↻ Redémarrer »
      (`onLaunchSession`). Redémarrer reprend en fait la séance existante (bug 6) ;
    - sinon : « ▶ Démarrer » ;
    - « ⤴ Partager » : partage image de la **dernière séance réalisée** (3.10 à 3.13) ;
    - « ✏️ Modifier » : ouvre le constructeur en édition ;
    - « 🗑 Supprimer » : `confirm('Supprimer cette séance ?')`.
  - Corps : « Exercices inclus » + nombre. Liste ordonnée des 5 premiers exercices : nom cliquable
    (fiche), 2 premiers tags muscle + « +N », badge « N séries ». Puis « +N exercices » s'il y en a
    plus de 5.
- **Constructeur** (modale large, `src/components/SessionBuilder.jsx`) : titre « Nouvelle séance »
  ou « Modifier la séance » avec sous-titre. Fermeture : bouton « Fermer » ou clic sur l'overlay.
  - « Identité de la séance » : input nom, placeholder « Ex: Poussée (Pectoraux/Triceps) ».
  - Colonne « Bibliothèque d'exos » : recherche « 🔍 Rechercher un exercice... ». Filtre
    `name.toLowerCase().includes(q)` OU un muscle `toLowerCase().includes(q)`, sans normalisation
    des accents (`:27-30`). Cartes avec 2 tags et bouton « + », ou « ✓ » si déjà ajouté (le clic
    sur ✓ ne fait rien). Vide : « Aucun résultat ».
  - Colonne « Composition (n) » : items numérotés, input « séries » (`min=1 max=10`, mais la valeur
    vaut `parseInt || 0`, donc 0 ou plus de 10 restent possibles à la saisie, `:42-48`), bouton ✕.
    Vide : « 📂 Ta séance est vide / Ajoute des exercices depuis la liste de gauche ».
  - Ajout d'un exercice : `series: 3` par défaut (`:32-36`).
  - Bouton « Finaliser la séance » ou « Enregistrer les modifications ». Exige un nom trimé non
    vide et au moins 1 exercice. Sinon : `alert('Veuillez entrer un nom et sélectionner au moins un exercice.')`
    (`:50-66`). Le nom est envoyé **non trimé**. La modale se ferme sans attendre le service
    (`src/pages/SessionsPage.jsx:22-31`).

### 1.5 Séance en cours — `session-runner` (`src/pages/SessionRunner.jsx`)

- Accès : « Démarrer » / « Continuer » / « Redémarrer » dans la liste des séances
  (`src/App.jsx:1295-1329`).
  - Si une autre séance est en cours :
    `confirm('Une séance est déjà en cours. Voulez-vous l\'abandonner et démarrer cette nouvelle séance ?')`.
    Annuler ne change rien.
  - Même séance déjà en cours : simple navigation, état conservé.
  - Sinon : `ongoingSession = { session: buildSessionWithDetails(session, exercises), progress: null }`.
- Rendu `null` si la séance n'a aucun exercice (`:378-380`).
- Carte d'en-tête : nom de la séance. Sélecteur « Date de la séance: » (`input type=date`, défaut
  et `max` = UTC today) avec l'aide « Cette date sera utilisée pour détecter tes records
  personnels ». Puis « N exercice(s) sur cette page », barre de progression et « X% complété »
  (`:384-402`).
- Par exercice (`:405-555`) :
  - nom cliquable (fiche) et bouton ✕ « Retirer cet exercice » :
    `confirm('Retirer cet exercice de la séance en cours ?')` ;
  - bloc « Remarques coach » si `coachNotes` est non vide ;
  - puces muscles et badge « N séries » ;
  - une ligne par série : libellé « Série i », select variante, input reps (`number 0..100`,
    placeholder « Reps »), input poids (`number min 0 step 0.01`, placeholder « Poids (kg) »),
    select RPE 6 à 10 (« RPE 6 » … « RPE 10 », classe couleur `runner-rpe-{n}`). Tous les champs
    sont désactivés quand la série est validée ;
  - bouton ✓ « Valider la série » (désactivé tant que `canValidateSerie` est faux), remplacé par
    « Modifier » une fois validée ;
  - bouton ✕ « Supprimer la série » (masqué si validée) : `confirm('Supprimer cette série ?')` ;
  - bandeau live « Record battu sur {reps} reps ({variantName}) » avec animation `runner-pr-animate`
    (règle en 3.8) ;
  - « Complété » si la série est validée et valide ;
  - « + Ajouter une série » : ajoute une série vide avec la variante par défaut.
- Actions bas de page :
  - « + Ajouter un exercice » ouvre la modale « Ajouter un exercice » / « Ajoutez un exercice bonus
    à votre séance en cours. ». Elle contient une recherche « Rechercher un exercice... » (nom ou
    muscle, `toLowerCase().includes`) et liste les exercices pas encore présents, avec un bouton
    « + ». L'ajout crée 3 séries et ferme la modale (`:169-192`, `:575-628`). Fermeture aussi par
    « Fermer » ou clic overlay.
  - « Terminer la séance » : voir 3.9.
  - « Abandonner la séance » : **sans confirmation**. Vide la séance en cours et retourne à
    `sessions` (`:571-573`, `src/App.jsx:1424-1427`).
- Persistance de la progression : à chaque changement de `seriesData`, `onProgressChange({ currentExerciseIndex: 0, seriesData })`
  remonte l'état dans `App` (mémoire seulement, `:83-92`, `src/App.jsx:1404-1422`). Quitter
  l'écran via la barre basse puis revenir restaure `seriesData`. En revanche la date, la liste des
  exercices bonus et la modale ne sont pas restaurées (bug 6). Un rechargement de page perd tout.

### 1.6 Performances — `performances` (`src/pages/PerformancesPage.jsx`)

- Accès : onglet « Perfs ». Retour depuis la page Progression.
- En-tête « Performances » / « Analyse de vos séries, charges et régularité d'entraînement. ».
  Boutons :
  - « Progression » (désactivé si aucun exercice) : ouvre `progress` sans exercice présélectionné
    (`:388-396`, `src/App.jsx:1681`) ;
  - « Ajout manuel » / « Fermer ajout manuel » (`:397-403`).
- **Section ajout manuel** (`:407-540`) : titre « Ajouter une performance manuellement » et texte
  d'aide.
  - **Import CSV** : texte des colonnes acceptées, `input type=file accept=".csv,text/csv"`
    (désactivé pendant l'import ou s'il n'y a aucun exercice), libellé « Importer un fichier CSV »
    ou « Import en cours... ». Règles en 3.14.
  - **Formulaire** :
    - Exercice (select ; « Aucun exercice » si la liste est vide) ;
    - Reps (`number min 0`, requis) ;
    - Variante (select des variantes normalisées, valeur `id` ou `name:<nom>`) ;
    - Poids (kg) (`number min 0 step 0.01`, requis) ;
    - RPE (6 à 10, défaut 10) ;
    - Date (`date`, défaut UTC today, requise) ;
    - « Nom de séance (optionnel) » (défaut « Ajout manuel », placeholder « Ex: Bloc force
      semaine 3 »).

    Bouton « Ajouter au tableau » / « Ajout... ». Validation :
    `alert('Sélectionne un exercice.')` ou
    `alert('Saisie invalide: soit reps=0 (tentative ratée), soit reps>0 avec un poids ≥0.')`
    (`:198-209`). Envoi : `serieNumber: 1`, `sessionName: trim || 'Ajout manuel'`. Succès :
    `alert('Performance ajoutée.')` (`src/App.jsx:1547`) puis remise à zéro de reps, poids et
    RPE=10. Erreur : `alert("Erreur lors de l'ajout de la performance.\nDétail: …")`.
    Quand l'exercice change, la variante revient à la variante par défaut si l'ancienne n'existe
    plus (`:127-158`).
- **Statistiques** (4 cartes, `:542-576`) :
  - « Total séries » = nombre de performances ;
  - « Exercices suivis » = nombre d'exercices connus ayant au moins une perf ;
  - « Charge moyenne » = `Σ(weight||0)/n` arrondi `toFixed(1)` + « kg » ;
  - « Dernière séance » = champ `date` (FR) de la perf au `performanceDate` le plus grand, ou
    « Aucune ».
- **Filtre par exercice** (si au moins 1 exercice a des perfs, `:578-612`) : bouton « Tous (n) »,
  puis les 5 premiers noms en boutons, puis un select « Autres exercices... » pour le reste. Les
  perfs sont regroupées **par nom d'exercice**, dans l'ordre de la liste `exercises`
  (`:160-168`).
- **Tableau** (`PerformanceTable`, voir 3.7). État vide : « Aucune donnée de performance pour le
  moment » / « Complétez une séance pour alimenter vos statistiques. » (`:622-627`).

### 1.7 Progression exercice — `progress` (`src/pages/ExerciseProgressPage.jsx`)

- Accès : bouton « Progression » (sans exercice) ou bouton « Graphique » d'un bloc du tableau des
  performances (avec `exerciseId`) (`src/App.jsx:1017-1020`).
- Bouton « Retour » vers `performances` (`src/App.jsx:1692`). Titre « Progression par exercice »
  et sous-titre.
- Select « Choisir un exercice : » avec l'option « -- Sélectionner -- » et tous les exercices.
  Sans exercice initial, le premier exercice est auto-sélectionné (`:36-44`). Bug : avec un
  exercice initial, impossible d'en changer (voir 6).
- Select « Variante : » affiché seulement s'il existe plus d'une variante **dans les performances**
  de l'exercice (`:243-259`). Règles en 3.6.
- États vides : « Ajoute au moins un exercice pour voir la progression. » (aucun exercice) ;
  « Aucune performance enregistrée pour cet exercice. » (`:261-267`).
- Stats (4 cartes) : « Poids MAX » (`toFixed(1)` kg), « e1RM MAX », « Volume Total »
  (`toFixed(0)` kg), « Progression » (delta e1RM signé `+`, ou « -- »).
- Bascule de vue : « 📊 Progression par reps » (défaut `table`) / « 📈 Graphiques ».
- Vue tableau : légende (🏆 Record perso / ↓ Régression / = Stable). Tableau avec une ligne par
  nombre de reps et des colonnes « Reps », « PR », « Courbe » (sparkline SVG 80×30), puis une
  colonne par date (`dd/mm`). Cellule : « {poids} kg » + badge « PR » ou flèche « ↓ », ou « · » si
  vide. Tooltip `"{iso}: {w} kg × {r} rep(s)"` ou `"{iso}: aucune donnée pour {r} rep(s)"`.
- Vue graphiques : 3 histogrammes CSS (« Évolution du Poids Max », « Évolution du e1RM estimé »,
  « Évolution du Volume Total (Poids × Reps) ») et un tableau « Historique détaillé » (Date ISO,
  Variante, Poids `toFixed(1)`, Reps, e1RM, Volume `toFixed(0)`, RPE ou « - »), du plus récent au
  plus ancien.

### 1.8 Réglages — `settings` (`src/pages/SettingsPage.jsx`)

- Accès : onglet « Réglages ».
- « Accessibilité » :
  - interrupteur « Réduire les animations » : `localStorage['pref_reduce_motion_v1'] = '1'|'0'`,
    classe `reduce-motion` sur `<html>` (`:24-27`). Le CSS `.reduce-motion *` neutralise les
    animations (`src/styles/Animations.css:54-56`) ;
  - select « Taille du texte » 100 / 110 / 120 % : `localStorage['pref_font_scale_v1']`, variable
    CSS `--font-scale` sur `<html>` (`:29-32`). Le `font-size` racine vaut
    `calc(16px * var(--font-scale))` (`src/App.css:122`). Lecture bornée à [1 ; 1,2], arrondie au
    centième, défaut 1 (`:11-18`).
  - Les préférences ne sont appliquées qu'au montage de cette page, pas au démarrage de l'app
    (bug 6).
- « Infos » : « Backend données: Mock (local) | Supabase » (`:34-38`, `:83-86`).
- `GeneralAdviceBoard` titré « Notes rapides ». Ce sont **les mêmes données** que les conseils
  de l'accueil (`:88`).

### 1.9 Conseils généraux / Notes rapides (`src/components/GeneralAdviceBoard.jsx`)

- Composant partagé par l'Accueil et les Réglages. Sous-titre « Notes perso visibles partout dans
  l'app. ». 3 textareas :
  - « Entrainement » (placeholder « Ex: garder 1-2 reps en reserve sur les polyarticulaires. ») ;
  - « Nutrition » (« Ex: 30-40g proteines sur le repas post-seance. ») ;
  - « Sommeil » (« Ex: viser 7h30 mini, coucher avant 23h. »).
- Chargement (`:17-51`) : `generalAdviceService.getGeneralAdvice()`. Si `null`, repli sur
  `localStorage['general_advice_board_v1']` (JSON `{training, nutrition, sleep}`).
- Sauvegarde automatique (`:53-75`), après hydratation et à chaque frappe : écriture immédiate en
  localStorage, puis upsert distant avec un debounce de **450 ms**. Les erreurs distantes sont
  ignorées en silence. Il n'y a pas de bouton « Enregistrer ».

### 1.10 Page de partage public (`src/pages/ShareSessionPage.jsx`)

- Accès : URL `/shared/<uuid>` ou `?sharedId=` / `?shared=`. Rendue à la place de l'app, sans
  barre basse (`src/App.jsx:1589-1596`).
- Id introuvable : kicker « Lien de partage », « Lien invalide ou expiré », « ID: {id} », « Le lien
  existe mais la séance n'a pas été retrouvée en base. », bouton « Retour à l'application »
  (`:9-23`).
- Sinon : kicker « Séance effectuée partagée » si `shareType === 'completed-workout'`, sinon
  « Fiche séance partagée ». Puis le nom, « Lien généré le {sharedAt} », « Séance réalisée le
  {workoutDate} » si présent. Une carte par exercice : nom, tags muscles, « Remarques coach: », et
  un tableau Série / Variante / Reps / Poids (kg) / RPE (chip `rpe-{n}`), avec « - » si la valeur
  est nulle.
- « Retour à l'application » : `window.location.href = origin + '/'` (`src/App.jsx:1569-1571`).
- **Note** : plus aucun code ne crée de lien. `createSharedSession` n'est jamais appelé. La page ne
  sert qu'à lire les anciens liens.

### 1.11 Écrans / composants morts (non montés)

`src/pages/MusculationPage.jsx` (ancienne page combinée), `src/components/Navbar.jsx`,
`RecentSessionsCarousel.jsx`, `StatsSection.jsx` (valeurs factices 142 / 34 / 847,5,
`src/components/StatsSection.jsx:4-8`), `SessionHeader.jsx`, `WorkoutInputPanel.jsx`,
`ExerciseWorkoutCard.jsx`. Les trois derniers importent `'../../styles/...'`, un chemin cassé
(`src/components/SessionHeader.jsx:1`, `WorkoutInputPanel.jsx:1`, `ExerciseWorkoutCard.jsx:1`).
`WorkoutIcon` est aussi inutilisé (`src/components/BottomNavIcons.jsx:12`). Rien de tout cela
n'est à reproduire.

---

## 2. Modèle de données Supabase

Aucun fichier de schéma n'est versionné. Le README cite `SQL_SCHEMA.sql` et `SUPABASE_GUIDE.md`,
absents du dépôt. Le schéma ci-dessous est **inféré du code**. Tout le client tourne avec la clé
`anon`, sans auth (`src/supabase.js:5-9`).

### 2.1 Tables et vues

| Objet | Colonnes utilisées (type inféré) | Lu / écrit | Notes |
|---|---|---|---|
| `exercises` | `id` (uuid, PK), `name` (text), `description` (text, nullable), `is_custom` (bool), `created_at` (timestamptz), `updated_at` (timestamptz, **optionnelle**) | R via la vue, W insert/update/delete | `is_custom` est toujours écrit `true` (`exerciseData.isCustom || true`, `supabaseService.js:30`). L'update retente sans `updated_at` si la colonne n'existe pas (code `42703`, `:160-182`). |
| `exercises_with_muscles` (vue) | `id`, `name`, `description`, `muscle_groups` (text[] ou json array), `is_custom`, `created_at` | R `select('*').order('created_at', desc)` | Agrège `muscle_groups` par exercice (`:76-122`). |
| `muscle_groups` | `exercise_id` (uuid FK → exercises), `muscle_group` (text) | W insert, delete by `exercise_id` | Une ligne par muscle. Update = delete all + insert (`:186-204`). |
| `exercise_variants` | `id` (uuid), `exercise_id` (FK), `name` (text), `is_default` (bool), `created_at` | R `.in('exercise_id', ids).order('created_at', asc)`, W insert/update/delete | Table optionnelle : erreurs `42P01`, `42703`, `PGRST204` ou message contenant `exercise_variants` tolérées (`:62`, `:251-274`). |
| `sessions` | `id` (uuid), `name` (text), `created_at` (timestamptz) | R `order created_at desc`, W insert/update(name)/delete | |
| `session_exercises` | `session_id` (FK), `exercise_id` (FK → exercises, jointure `exercises(*)`), `series_count` (int) | R par séance, W insert, delete by `session_id` | **Pas de colonne d'ordre** : l'ordre de lecture n'est pas garanti (`:333-336`). Update = delete all + insert (`:386-406`). |
| `performances` | `id` (uuid/int), `exercise_id` (uuid, nullable ?), `exercise_name` (text), `session_name` (text), `reps` (int), `weight` (numeric, nullable), `rpe` (numeric, nullable, colonne optionnelle), `variant_id` (uuid, nullable, optionnelle), `variant_name` (text, optionnelle), `series_number` (int), `performance_date` (date `YYYY-MM-DD`), `created_at` (timestamptz, défaut serveur) | R tout, W insert/delete | **Pas de FK vers `sessions`** : le lien passe par `session_name` (texte). Si l'insert échoue (code `PGRST204`/`42703` ou message contenant `rpe`/`variant`), il est retenté sans `rpe`, `variant_id` ni `variant_name` (`:576-603`). |
| `coach_notes` | `id`, `exercise_id` (FK), `notes` (text), `updated_at` | R `.eq(exercise_id).single()`, W update/insert | Une note par exercice (select puis update ou insert, pas d'upsert, `:723-758`). `PGRST116` (aucune ligne) donne `''`. |
| `shared_sessions` | `id` (uuid, défaut serveur), `payload` (jsonb) | R `.eq(id).single()` ; W insert (code mort) | `payload` contient l'objet de partage (3.10). |
| `general_advice` | `id` (int, singleton `1`), `training_notes`, `nutrition_notes`, `sleep_notes` (text), `updated_at` (timestamptz) | R `.eq('id',1).single()`, W `upsert(onConflict:'id')` | (`:819-878`) |

Relations et cascades : inconnues côté base. `deleteExercise` et `deleteSession` ne suppriment
que la ligne parente (`:130-142`, `:360-372`). Le code suppose des `ON DELETE CASCADE` pour
`muscle_groups`, `exercise_variants`, `session_exercises` et `coach_notes`. Les `performances`
d'une séance supprimée restent, puisqu'elles sont liées par nom. Les performances d'un exercice
supprimé restent aussi, sauf cascade sur `performances.exercise_id`. Le mock, lui, les supprime
(`src/services/mockService.js:308-315`).

### 2.2 Mapping snake_case vers camelCase (modèles du domaine)

**Exercise** (`supabaseService.js:114-122`) :
`{ id, name, description, muscleGroups: normalizeMuscleGroups(muscle_groups), variants: normalizeVariants(variantsByExerciseId[id], id), isCustom: is_custom, createdAt: created_at }`.
Côté App, on ajoute `coachNotes: string` après un appel par exercice à `getCoachNotes`
(`src/App.jsx:1171-1176`).

**Variant** : `{ id, exerciseId: exercise_id, name, isDefault: is_default }`
(`supabaseService.js:102-107`). Une variante non encore persistée a `id: null`.

**Session** (`:338-348`) :
`{ id, name, createdAt: new Date(created_at).toLocaleDateString('fr-FR'), exercises: [{ id: exercise_id, name: exercises.name, muscleGroups: [], series: series_count }] }`.
`createdAt` est une **chaîne FR**, pas une date ISO.

**Performance** (`:624-638`) :
`{ id, exerciseName: exercise_name, reps: Number(reps), weight: weight !== null ? Number(weight) : null, rpe: rpe !== null ? Number(rpe) : null, variantId: variant_id ?? null, variantName: variant_name || 'Touch and Go', performanceDate: performance_date, createdAt: created_at ?? null, date: new Date(performance_date).toLocaleDateString('fr-FR'), exerciseId: exercise_id, serieNumber: series_number, sessionName: session_name }`.
Note : si `rpe` est `undefined` (colonne absente), `Number(undefined)` donne `NaN`.

**Payload d'écriture de performance** (entrée de `addPerformances`, produit par le runner, l'ajout
manuel et l'import) :
`{ exerciseId, exerciseName, sessionName, reps, weight, rpe, variantId|null, variantName|null, performanceDate (ISO), createdAt? (ISO, ignoré par Supabase), serieNumber }`.
Écrit en base (`:551-565`) :
`exercise_id, exercise_name, session_name, reps: Number(reps), weight: normalizeWeight(weight), rpe: rpe ?? 10, variant_id: variantId || null, variant_name: variantName || 'Touch and Go', series_number: serieNumber, performance_date: performanceDate || UTC today`.

**GeneralAdvice** : `{ training, nutrition, sleep }` ↔ `training_notes, nutrition_notes, sleep_notes`.

### 2.3 API des services (interface commune Supabase / mock)

Sélection dans `src/services/index.js:4-21` (voir 4).

`exercisesService`
- `addExercise(data: { name, description, muscleGroups: string[], variants?, isCustom? }) → { id, ...data, variants: Variant[] }`.
  Supabase : insère l'exercice, puis les muscles, puis les variantes normalisées. Les variantes
  renvoyées ont `id: null`, car les ids insérés ne sont pas relus (`:51-68`). Mock : nom trimé
  requis, variantes avec id générés, ajout **en tête** (`mockService.js:269-292`).
- `getExercises() → Exercise[]` (tri `created_at` desc ; `[]` en cas d'erreur).
- `deleteExercise(id) → void` (throw en cas d'erreur).
- `updateExercise(id, { name, description, muscleGroups, variants }) → void` (Supabase) /
  `Exercise` (mock). Nom trimé requis : `throw new Error("Le nom de l'exercice est requis.")`.
  Synchronisation des variantes (`:208-261`) : supprime les ids existants absents de la nouvelle
  liste, met à jour celles qui ont un id, insère celles qui n'en ont pas. Non transactionnel.

`sessionsService`
- `addSession({ name, exercises: [{ id, series }] }) → { id, ...sessionData }` (renvoie l'objet
  d'entrée, exercices complets compris). Mock : nom trimé requis (« Nom de séance manquant. »),
  `seriesCount = Number(series) || 1`.
- `getSessions() → Session[]` : 1 requête pour les séances, puis **1 requête par séance**
  (N+1, `:331-350`). `[]` en cas d'erreur.
- `deleteSession(id) → void`.
- `updateSession(id, { name, exercises }) → { id, ...sessionData }` : update du nom, delete de tous
  les `session_exercises`, puis insert.

`performancesService`
- `addPerformances(perfs: PerformanceInput[]) → void`. Règles en 3.4.
- `cleanupObsoletePerformances(perfs) → void` (appelé après insert). Règles en 3.5.
- `getPerformances() → Performance[]` : tri `created_at desc`, puis `performance_date desc`. Pas de
  pagination (voir 6 : limite PostgREST).
- `getPerformancesByExercise(exerciseId) → rows bruts snake_case` — **non utilisé**.
- `deletePerformance(id)`, `deletePerformancesBySessionAndDate(sessionName, isoDate)`,
  `deletePerformancesBySessionName(sessionName)` — **non utilisés par l'UI**. Ils lèvent
  « Nom de séance manquant. » / « Date de séance manquante. ».

`coachNotesService`
- `getCoachNotes(exerciseId) → string` (`''` si absent ou en erreur).
- `saveCoachNotes(exerciseId, notes) → void` (throw). Mock : `exerciseId` requis
  (« exerciseId manquant. »).

`sharedSessionsService`
- `getSharedSession(id) → payload | null`.
- `createSharedSession(payload) → id` — **non utilisé**.

`generalAdviceService`
- `getGeneralAdvice() → { training, nutrition, sleep } | null` (mock : peut aussi contenir
  `updatedAt`).
- `saveGeneralAdvice({ training, nutrition, sleep }) → void` (throw).

`resetTestDatabase` : `resetMockDatabase` en mode mock, sinon `null`.

### 2.4 Particularités à préserver ou décider

- **Lien performance ↔ séance par nom** : `performances.session_name` est une copie texte du nom.
  Renommer une séance détache tout son historique (le partage ne trouve plus rien). Supprimer une
  séance laisse les perfs. Les perfs manuelles ou importées ont un nom libre (« Ajout manuel »,
  « Import CSV », ou celui saisi).
- **Lien performance ↔ exercice** : par `exercise_id`, avec copie de `exercise_name`. L'algorithme
  de PR matche aussi par nom normalisé (3.2).
- **Lien performance ↔ variante** : `variant_id` (nullable) + `variant_name` (défaut
  « Touch and Go »). Pour les variantes sans id connu côté client (création récente, ou
  `name:<nom>` dans le runner), seul `variant_name` est écrit.
- **Dates** : `performance_date` est une date pure ISO. Le défaut est la date **UTC** du jour
  (`:512`). `created_at` est un timestamp serveur. Le champ dérivé `date` (FR) est calculé via
  `new Date('YYYY-MM-DD')`, donc parsé en UTC.
- **Poids** : `normalizeWeight` accepte la virgule, `parseFloat`, refuse les valeurs négatives ou
  non finies (`null`) et arrondit au centième (`:5-17`).
- **RPE** : entier 6 à 10 côté UI. Défaut 10 à l'écriture (`rpe ?? 10`). Les baselines ont
  `rpe: null`.
- **Codes d'erreur Supabase tolérés** : `42P01` (table absente), `42703` (colonne absente),
  `PGRST204` (colonne absente du cache de schéma), `PGRST116` (0 ligne avec `.single()`).
- **Scripts SQL ponctuels** (`scripts/sql/`) : corrections manuelles d'historique pour
  « Extension triceps poulie basse » / « Touch and Go » / 13 reps.
  `fix_triceps_pr_14_8_to_14_6.sql` supprime une ligne de test (session « SEANCE TRICEPS TEST »,
  2026-03-06). `repair_triceps_baseline_13x12_5.sql` insère une baseline 13×12,5 kg datée
  2026-02-07 (session « Historique Cycle 1 ») si elle manque. Ils confirment le matching SQL
  `LOWER(TRIM(exercise_name))` et `LOWER(REGEXP_REPLACE(TRIM(variant_name), '\s+', ' ', 'g'))`.
  La réécriture ne doit pas les rejouer.

---

## 3. Règles métier

### 3.1 Normalisations

| Fonction | Règle | Source |
|---|---|---|
| `normalizeExerciseName` | `String(v||'')` → trim → lowercase → NFD → retire `[̀-ͯ]` → `[^a-z0-9]+` → espace → espaces multiples réduits → trim. Renvoie `null` si vide. | `src/App.jsx:65-75` (dupliqué : `src/utils/formatters.js:71-81`, `src/utils/baselinePerformances.js:86-95` qui renvoie `''`) |
| `normalizeVariantName` | `String(v || 'Touch and Go')` → trim → lowercase → `\s+` → un espace. **Pas** de retrait des accents. | `src/App.jsx:58-63` (`formatters.js:83-88`, `baselinePerformances.js:97-102`) |
| `normalizeMuscleGroups` | Ignore les non-arrays et non-strings, trim, retire les vides, dédoublonne par `toLocaleLowerCase('fr-FR')` en gardant la **première** casse, préserve l'ordre. | `src/utils/muscleGroups.js:1-25` |
| `normalizeVariants(variants, exerciseId)` | Accepte des strings ou `{name}` ; trim ; ignore les vides ; dédoublonne par nom en lowercase fr en gardant le premier `{id||null, exerciseId, name, isDefault: Boolean}`. Liste vide : `[{id:null, exerciseId, name:'Touch and Go', isDefault:true}]`. Sans variante par défaut, marque « Touch and Go » (insensible à la casse) ou à défaut la première. Plusieurs `isDefault` peuvent rester à `true`. | `src/utils/variants.js:12-55` |
| `getDefaultVariant` | Première variante `isDefault` de la liste normalisée, sinon `[0]`. | `src/utils/variants.js:57-60` |
| `toNumber` | `null` pour `null`/`undefined`/`''` ; si string, remplace **la première** `,` par `.` puis trim ; `Number()` ; `null` si non fini. | `src/App.jsx:77-88` |
| Recherche (`normalizeText`) | trim + lowercase + NFD sans accents. | `src/components/SearchBar.jsx:4-10` |
| Clés muscle (carte / filtre) | trim + lowercase + NFD sans accents + espaces réduits. | `src/components/MuscleMap.jsx:6-13`, `MuscleFilter.jsx:26-33` |
| En-têtes CSV (import manuel) | trim + lowercase + NFD sans accents + `\s+` → `_`. | `src/pages/PerformancesPage.jsx:40-47` |
| En-têtes CSV (baseline) | idem, mais `[^a-z0-9]+` → `_` puis trim des `_`. | `src/utils/baselinePerformances.js:5-13` |
| Nom d'exercice (import CSV) | `trim().toLowerCase()` uniquement : les accents comptent. | `src/pages/PerformancesPage.jsx:259-262`, `:289-291` |
| Variante (page progression) | `String(variantName || 'Touch and Go').trim().toLowerCase()`. | `src/pages/ExerciseProgressPage.jsx:20-24` |
| Variante (runner) | égalité `variantId` OU `variantName.toLocaleLowerCase('fr-FR')`. | `src/pages/SessionRunner.jsx:244-247`, `:263-266` |

### 3.2 Dates et horodatage (`src/App.jsx:90-170`)

- `parseDateToIso(value)` accepte, dans cet ordre :
  1. ISO `^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$`, qui donne `YYYY-MM-DD` (jour et mois sur
     2 chiffres obligatoires) ;
  2. FR `^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:\s+.*)?$`, qui donne `YYYY-MM-DD` avec padding.
     Donc `d/m/yyyy`, `dd.mm.yyyy`, `dd-mm-yyyy`, suivi éventuellement d'une heure. **Toujours
     jour/mois**, jamais mois/jour ;
  3. sinon `new Date(raw)`. Si la date est valide, `toISOString().slice(0,10)` (jour **UTC**),
     sinon `null`.
  Le jour et le mois ne sont pas validés (ex. `31/02/2026` donne `2026-02-31`).
- Variante baseline (`src/utils/baselinePerformances.js:55-75`) : mêmes motifs **sans ancre de
  fin** (préfixe suffisant).
- Variante import CSV (`src/pages/PerformancesPage.jsx:58-83`) : identique à App.
- `parseDateToTimestamp` : ISO, puis `new Date(y, m-1, d)` à **minuit local** (`:121-134`).
- `getPerformanceTimestamp(p)` (`:154-170`) : si `createdAt` est valide (> 0) **et**
  `createdAt.slice(0,10) === parseDateToIso(performanceDate)`, renvoie le timestamp de `createdAt`
  (précision intra-journée). Sinon, minuit local de `performanceDate`. Sinon `null`.
- `formatIsoToFr(iso)` : `toLocaleDateString('fr-FR')` du timestamp local (`:50-56`).
- Formats d'affichage : FR `jj/mm/aaaa` partout. `dd/mm` dans les en-têtes de la page
  progression (`src/pages/ExerciseProgressPage.jsx:6-12`, parse `T00:00:00` local). ISO brut dans
  « Historique détaillé » et dans les tooltips.

### 3.3 e1RM (`src/utils/e1rm.js`)

- Formule d'**Epley** : `e1rm = weight × (1 + reps / 30)` (`:10`). Pour reps = 1, cela donne
  `1,0333 × weight`, pas `weight`.
- Entrées : chaînes acceptées (`parseFloat`, `parseInt`). `null` si non fini, `weight <= 0` ou
  `reps <= 0` (`:1-8`).
- `roundE1RM(v)` : `Math.round(v × 10) / 10`, `null` si non fini (`:13-19`).
- Le RPE n'intervient dans aucun calcul.
- Usages :
  - meilleur e1RM par exercice (`PerformanceTable.jsx:260-265`) ;
  - page progression : bucket par date, e1RM max, delta, tableau détaillé
    (`ExerciseProgressPage.jsx:126`, `:278`, `:530`).

### 3.4 Écriture de performances (`addPerformances`, `supabaseService.js:510-611`, mock `:446-501`)

1. Validation globale. Une entrée est **invalide** si elle n'a pas `reps === 0` (après `Number`) et
   que `reps` est non fini, ou `reps <= 0`, ou `normalizeWeight(weight) === null`. Une seule
   entrée invalide fait échouer tout le lot :
   `throw new Error('Entrée performance invalide: mets reps > 0 avec un poids >= 0, ou reps=0 et poids vide pour une série non complétée.')`.
2. **Filtre** : seules les entrées `reps > 0` sont écrites. Les séries ratées (0 rep) et les
   séries non complétées ne sont **jamais** stockées. Si rien ne reste, retour silencieux.
3. Insert en lot (mapping en 2.2). Sur erreur de schéma, retry « legacy » sans `rpe`/`variant_*`.
4. Puis `cleanupObsoletePerformances(performancesToSave)`.
- Mock : identique. Ajoute `id` et `created_at = now`, et place les nouvelles lignes **en tête**.

### 3.5 Nettoyage des performances « obsolètes » (après chaque écriture)

Supabase (`supabaseService.js:418-507`) :
- Groupes uniques par `(exerciseId, variantId || null, variantName || 'Touch and Go')`, en
  ignorant les entrées sans `exerciseId`.
- Pour chaque groupe : lecture de toutes les perfs de l'exercice avec ce `variant_id`, ou
  `variant_id IS NULL AND variant_name = <nom exact>`.
- On ne garde que `reps > 0` et `weight > 0` (les perfs à 0 kg ne sont jamais nettoyées). Arrêt
  si moins de 2 lignes.
- Regroupement par point `reps::weight`. Dans chaque groupe de taille > 1, tri par
  `timestamp = new Date(performance_date || created_at)` décroissant. On **garde la première** et
  on **supprime les autres** (`:471-488`).
- Les perfs « dominées » entre reps différentes ne sont **pas** supprimées (`:490-492`).
- Erreur de suppression : `console.warn`.
- Effet réel : refaire 5×100 kg une semaine plus tard **efface** la ligne 5×100 de la semaine
  précédente, quelle que soit la séance. Cela retire de l'historique des séries de séances passées
  (comptage de séances, graphiques, partage). Voir 6.

Mock (`mockService.js:218-265`) : même principe, avec deux écarts. Le filtre garde `weight !== null`
(0 kg inclus) et le tri utilise `created_at` au lieu de `performance_date`.

### 3.6 Progression par exercice (`src/pages/ExerciseProgressPage.jsx`)

- Options de variante (`:53-68`) : construites à partir des **performances** de l'exercice, pas
  des variantes déclarées. Clé = nom trimé en lowercase. Libellé = première casse rencontrée. Tri
  `localeCompare(..., 'fr-FR')`.
- Variante effective (`:71-81`) : la sélection si elle existe encore, sinon l'option dont le
  libellé vaut « touch and go », sinon la première option.
- Perfs retenues (`:83-104`) : bon exercice, bonne variante. `reps = toNumber(reps) ?? 0`,
  `weight = toNumber(weight)`, `performanceDate` tronqué à 10 caractères. Filtre
  `performanceDate && reps > 0 && weight !== null` (0 kg accepté). Tri par date, puis par
  `createdAt` croissant.
- Points par date (`:106-158`) : `maxWeight`, `bestE1rm` (e1RM `null` compté comme 0),
  `volume = Σ weight × reps`, `totalReps`, `series`.
- Statistiques :
  - `maxWeight` : max des `maxWeight` journaliers ;
  - `maxE1rm` ;
  - `totalVolume` : Σ des volumes ;
  - `sessions` : nombre de dates distinctes ;
  - `deltaWeight = last.maxWeight − first.maxWeight` : calculé mais **non affiché** ;
  - **`deltaE1rm = maxE1rm − first.bestE1rm`** (max global moins le premier jour, et non dernier
    moins premier), `null` s'il y a moins de 2 dates. Affiché arrondi au dixième avec `+` si ≥ 0.
- Tableau reps × dates (`:161-210`) :
  - cellule = perf de poids max pour `(date, reps)`. Les lignes de reps sont triées par ordre
    croissant ;
  - statut, parcouru chronologiquement par ligne : `pr` si `weight > allTimeMax` (`allTimeMax`
    démarre à 0, donc la première valeur > 0 est toujours PR) ; sinon `down` si
    `weight < poids de la cellule précédente non vide` ; sinon `normal`. Les cellules vides sont
    `empty` ;
  - colonne « PR » : `allTimeMax` final, affiché `"{n} kg"`, ou `-` si 0 ;
  - sparkline : x = `index(date)/(nbDates−1) × 76 + 2`, y = `26 − (w − minW)/(maxW − minW || 1) × 22`.
    Points : PR `#fbbf24` (r 3,5), down `#f87171`, normal `#94a3b8` (r 2,5). Un seul point :
    cercle centré (40,15). Ligne `rgba(34,211,238,0.5)`.
- Histogrammes : hauteur = `(v − min)/(max − min || 1) × 100 %`, minimum 5 %. Volume :
  `v / maxVolume`. Une étiquette de date toutes les `ceil(n/5)` barres.

### 3.7 Tableau des performances (`src/components/PerformanceTable.jsx`)

- Regroupement par `exerciseId`. Le titre vient du `exerciseName` de la première perf
  (`:55-64`).
- Colonnes de variantes : `normalizeVariants(exercise.variants)` si l'exercice est connu, sinon
  dérivées des noms de variantes des perfs (`:74-78`).
- Appartenance d'une perf à une colonne : `(perf.variantId || perf.variantName || 'Touch and Go') === (variant.id || variant.name)`
  OU `perf.variantName === variant.name` (exact, sensible à la casse) (`:87-91`).
- Pour reps 1 à 30 (les perfs hors [1 ; 30] sont ignorées), on garde la perf de poids max. À
  égalité de poids, la plus récente par `performanceDate || date` (`:81-111`).
- **Masquage des entrées dominées (frontière de Pareto)** : une cellule est vidée s'il existe une
  autre cellule avec `reps ≥` et `weight ≥`, dont l'un est strict. Pas d'epsilon (`:113-140`).
- Affichage : 30 lignes fixes. 3 colonnes par variante : « Poids (kg) » (valeur brute ou `-`),
  « RPE » (chip `RPE n` ou `-`), « Date » (`date` FR ou `-`). Filtre « Variante » par exercice :
  « Toutes les variantes » ou une variante (`:179-196`).
- Bouton « Copier Excel » par variante (`:22-44`) : 30 lignes `"{poids}\t{date}"`. Le poids est
  arrondi au centième, avec une virgule décimale ; vide si absent. Les lignes sont jointes par
  `\n`. Copie via `navigator.clipboard.writeText` puis
  `alert('Copié: {variante} (Poids + Date, 30 lignes).')`. Repli :
  `prompt('Copiez ce contenu (Poids + Date):', payload)`. On copie la frontière, donc les entrées
  dominées sont vides.
- Bouton « Graphique » : ouvre la progression de l'exercice. Il est absent dans la modale fiche.
- Pied de bloc : « Total des séances: » = nombre de `date` distinctes ; « Meilleur e1RM: »
  arrondi au dixième + « kg » (`:257-266`).
- « Statistiques globales » : « Total de séries », « Poids total levé (kg) » = `round2(Σ reps × weight)`,
  « Reps totales », « Exercices suivis » = nombre de `exerciseName` distincts (`:271-291`).
- Vide : « Aucune performance enregistrée » / « Lancez et complétez une séance pour enregistrer vos
  performances. ».

### 3.8 Détection de record en direct (séance en cours)

Algorithme **différent** de celui du partage (3.11). `src/pages/SessionRunner.jsx:234-297` :
- Il ne s'affiche que si les champs reps et poids sont non vides (`:533`).
- `isSerieRepPR` : `weight = parseWeightValue` doit être fini et > 0. Il y a record si
  `weight > baseline + 0.01`.
- `baseline = max(historique, séance)`, à reps **identiques** et même variante :
  - historique : perfs `performance.exerciseId === exerciseId` (pas de matching par nom, pas de
    baselines CSV) dont la variante correspond (id ou nom lowercase fr). Valeur =
    `max(performance.weight || 0)` à `performance.reps === reps` ;
  - séance : séries précédentes (index plus petit) **validées et valides**, même variante,
    mêmes reps, `weight > 0`.
- S'il n'existe aucune référence, la baseline vaut 0, donc tout poids > 0,01 affiche « Record
  battu » dès la première fois. Pas de notion de reps inférieures, de PR hybride ni de frontière.

### 3.9 Séance en cours : validation et fin

- `parseWeightValue` (`:5-21`) : virgule acceptée, `parseFloat`, ≥ 0, arrondi au centième, sinon
  `null`.
- `canValidateSerie` (`:99-109`) : `reps = parseInt` fini et ≥ 0 ; si `reps > 0`, le poids est non
  nul ; `rpe = parseInt` dans [6 ; 10]. **0 rep est validable sans poids** (tentative ratée).
- `isSerieValid = validated && canValidateSerie`.
- Progression % = `round(validées valides / total séries × 100)`, sur toutes les séries de
  `seriesData` (`:299-308`).
- Valeur de variante d'une série : `variant.id`, ou `name:<nom>` si pas d'id (`:76`).
- **Terminer** (`:310-376`) :
  1. Collecte des séries non valides parmi les exercices **de la fiche** (`session.exercises`,
     pas les exercices bonus). Libellés `"{nom} - Série {i}"`.
  2. S'il y en a :
     `confirm('Il y a {n} série(s) non validée(s).\nSi vous continuez, elles seront enregistrées avec 0 répétition et poids null.\n\nContinuer ?')`.
     Annuler interrompt.
  3. Construction sur `activeExercises` (fiche + bonus − retirés). Série valide :
     `{ exerciseName, reps: parseInt, weight: parseWeightValue, rpe: parseInt, variantId: startsWith('name:') ? null : id, variantName || 'Touch and Go', date & performanceDate: sessionDate, exerciseId, serieNumber: index+1, sessionName: session.name }`.
     Série non valide, si l'utilisateur a accepté : idem avec `reps: 0, weight: null, rpe: parseInt || 10`.
     Ces lignes sont ensuite **filtrées par le service** et ne sont donc jamais écrites
     (contrairement au message).
  4. `onEndSession(performanceData)`, puis `App.handleEndSession` (`src/App.jsx:1429-1514`) :
     - formatage, avec `performanceDate || UTC today` et `createdAt = now ISO` ;
     - **avant** l'écriture : construction du payload de partage et de l'image, à partir de
       baselines + perfs en mémoire + nouvelles perfs. Une erreur ici donne un `console.warn` et le
       flux continue ;
     - `addPerformances`, puis rechargement complet des perfs, puis `ongoingSession = null`, puis
       page `sessions` ;
     - si une image a été préparée, ouverture de la modale `shareAssist` ;
     - `alert('Séance enregistrée.')` ;
     - **échec** (toute exception) : mise en file locale (3.17), séance vidée, page `sessions`,
       puis `alert('Connexion instable: la séance est sauvegardée localement et sera envoyée automatiquement à la prochaine ouverture.\nDétail: {message}')`.

### 3.10 Construction du payload de partage (`buildSharedSessionPayload`, `src/App.jsx:457-662`)

Entrées : séance modèle, exercices, historique =
`[...baselines(session.name), ...performances, (+ nouvelles perfs en fin de séance)]`.

1. `sessionWithDetails = buildSessionWithDetails(session, exercises)` (`:35-48`). Pour chaque
   exercice de la fiche, on prend les `muscleGroups` (normalisés), les `variants` (normalisés) et
   les `coachNotes` de l'exercice complet, avec repli sur les valeurs de la fiche.
2. Perfs de la séance = `performance.sessionName === session.name` (égalité stricte) avec
   `performanceDate` non vide. Aucune perf : `null`.
3. Date de la séance partagée = **max** des `parseDateToIso(performanceDate)` (tri `localeCompare`
   décroissant). On ne garde que les perfs de ce jour-là.
4. Index historique = `buildHistoryIndex(historique complet)` (3.11).
5. Pour chaque exercice de la fiche, pour `serieNumber` de 1 à `exercise.series` (nombre prévu par
   la fiche) :
   - perfs du jour qui matchent l'exercice (`doesPerformanceMatchExercise` : même `id`, sinon même
     `normalizeExerciseName`, `:351-367`) et `serieNumber` ;
   - on garde la plus récente par `getPerformanceTimestamp` ;
   - si `exerciseName` manque, on prend le nom de l'exercice (`:514-516`) ;
   - perf valide si `reps` fini > 0 et `weight` fini ≥ 0. Sinon `improvementStatus = 'none'`,
     non compté dans le résumé ;
   - `previousBest = findPreviousBest(index, exercise.id, perf)` ;
   - classement (`:546-606`, `PR_EPSILON = 0.01`, `:30`). `Δw = weight − ref.weight`,
     `Δr = reps − ref.reps`, deltas arrondis au centième :

     | Cas | Condition | `improvementStatus` | Drapeaux |
     |---|---|---|---|
     | pas de référence | — | `data-capture` | |
     | `same-reps` | `Δw > 0.01` | `improved` | |
     | `same-reps` | `|Δw| ≤ 0.01` | `equaled` | |
     | `same-reps` | sinon | `below` | |
     | `lower-reps` | `Δw > 0.01` | `improved` | `isHybridPr` |
     | `lower-reps` | `|Δw| ≤ 0.01` | `improved` | `isRepsPr` |
     | `lower-reps` | sinon | `data-capture` | |
     | `higher-reps` | toujours | `below` | |

   - compteurs `summary.improved / equaled / below / dataCapture`.
   - entrée `seriesData` :
     `{ serieNumber, reps, weight, rpe, variantId, variantName, previousBestReps, previousBestWeight, previousBestDate (ISO), previousBestDateFr, previousBestComparisonType, improvementStatus, improvementDelta, improvementDeltaReps, isHybridPr, isRepsPr }`.
     Les champs valent `null` s'il n'y a pas de perf.
6. Résultat :
   `{ shareType: 'completed-workout', name, sharedAt: today FR, workoutDate: new Date(iso).toLocaleDateString('fr-FR'), workoutDateISO, summary, exercises: [{ id, name, muscleGroups, variants, coachNotes, seriesData }] }`.

Conséquences à connaître :
- Les séries ajoutées au-delà du nombre prévu et les exercices bonus **n'apparaissent pas** dans
  le partage.
- Les lignes baseline portent `sessionName = nom de la séance`, donc elles font partie des « perfs
  de la séance ». Sans aucune perf réelle, la baseline elle-même devient la « séance partagée ».

### 3.11 Référence précédente / PR (`buildHistoryIndex`, `findPreviousBest`, `src/App.jsx:180-455`)

- **Clés d'identité** :
  - exercice : `id:<exerciseId>` (si présent) + `name:<normalizeExerciseName>` (si non vide)
    (`:192-205`) ;
  - variante : `id:<variantId>` (si présent) + `name:<normalizeVariantName>` (toujours)
    (`:180-190`).
- **Index** (`:207-259`) : `Map<"exKey::varKey", Map<reps, Candidate[]>>` avec
  `Candidate = { reps, weight, date (ISO), timestamp }`. Une perf est indexée sous **toutes** les
  combinaisons (2×2 au plus). Exclusions : pas d'id ni de nom, date absente, timestamp non fini,
  `reps ≤ 0`, `weight < 0` ou non fini.
- **Candidats** (`findAllCandidates`, `:301-324`) : union de toutes les clés de la perf courante,
  dédoublonnée par `reps::weight::date::timestamp` (`:288-299`). Une perf d'un autre exercice de
  même nom normalisé, ou d'une autre variante de même nom normalisé, est donc comparable.
- **`findPreviousBest(index, exerciseId, perf)`** (`:369-455`). Retourne `null` si pas de clé,
  `reps` falsy ou ≤ 0, poids non fini ou timestamp non fini.
  1. `previous` = candidats avec `timestamp < timestamp(perf)` (**strict**). Les séries d'une même
     séance enregistrée en lot partagent `createdAt`, elles ne se comparent donc pas entre elles.
     Une séance antérieure du même jour avec un `createdAt` plus ancien compte.
  2. **Frontière** = `previous` sans les références obsolètes. `isObsoleteReference(c, all)`
     (`:326-349`) est vrai s'il existe `o ≠ c` avec `o.reps ≥ c.reps`,
     `o.weight ≥ c.weight − 0.01`, et (`o.reps > c.reps` ou `o.weight > c.weight + 0.01`).
  3. **Même reps** : `pickHeaviest(frontier.filter(reps === reps))`. Résultat
     `comparisonType: 'same-reps'`.
  4. Sinon, **rep inférieure la plus proche** : pour `r = reps−1` jusqu'à 1, le premier `r` qui a
     des candidats sur la frontière, puis `pickHeaviest`. Résultat `'lower-reps'`.
  5. Sinon, **référence dominante** : candidats de la frontière avec `reps ≥ reps`,
     `weight ≥ w − 0.01`, et (`reps > reps` ou `weight > w + 0.01`). Tri par
     `(reps − reps)` croissant, puis poids croissant, puis timestamp décroissant. On prend le
     premier. Résultat `'higher-reps'`.
  6. Sinon `null`.
- **`pickHeaviest`** (`:261-286`) : poids max. Si l'écart est ≤ 0,01, le timestamp le plus récent
  l'emporte.
- **Versions et debug** : `SHARE_ALGO_VERSION = 'PR-v10'` (imprimé sur l'image),
  `DEBUG_SHARE_PR = false` (`:27-33`).
- **Copie divergente** : `src/utils/performanceAnalysis.js` duplique l'index, mais son
  `findBestReference` (`:142-168`) applique une autre règle (le plus **récent** au lieu du plus
  lourd, pas de frontière, pas de filtre temporel). Il n'est utilisé que par les tests. La
  référence de parité est **`App.jsx`**.

### 3.12 Texte et image de partage

`formatWeight(w)` (`src/App.jsx:172-178`) : `toNumber`, puis `'-'` si nul, sinon arrondi au
centième, en chaîne avec `.` remplacé par `,` (`62.5` donne `62,5` ; `100` donne `100`).

`formatSignedWeight(v)` (`:664-673`) : `'-'` si nul ; sinon `(r ≥ 0 ? '+' : '-') + |r|` à la
virgule, avec `r = round2(v)`. `0` donne `+0`.

`formatSerieForShare(serie)` (`:675-724`) renvoie `null` si `reps ≤ 0` (ou null) **et**
`weight === null`. Sinon :
- `mainLine = "S{n}: {reps} reps x {formatWeight(weight)} kg[ · RPE {rpe}][ · {variantName}]"`
  (le RPE est omis s'il est falsy) ;
- `benchmarkLine` / `status` :

| Statut / type | Texte exact |
|---|---|
| défaut (data-capture, none) | `Prise de données à {reps} reps` |
| improved + lower-reps + isRepsPr | `▲ Record reps: +{ΔR||0} rep(s) à {W} kg vs {refW} kg x {refR||'-'} reps ({refDateFr||'-'})` |
| improved + lower-reps + isHybridPr | `▲ PR hybride: {±ΔW} kg et +{ΔR||0} rep(s) vs {refW} kg x {refR||'-'} reps ({refDateFr||'-'})` |
| improved + lower-reps (autre, inatteignable) | `▲ Record battu: {±ΔW} kg et +{ΔR||0} rep(s) vs {refW} kg x {refR} reps ({date})` |
| improved + same-reps | `▲ Record battu: {±ΔW} kg vs {refW} kg ({refDateFr||'-'})` |
| equaled | `= Record égalé: {refW} kg ({refDateFr||'-'})` |
| below + higher-reps | `↘ Sous la référence: {refW} kg x {refR||'-'} reps ({date})` |
| below + lower-reps (inatteignable) | `↘ Sous la référence: {|ΔW|} kg sous {refW} kg x {refR} reps ({date})` |
| below + same-reps | `↘ Sous la référence: {|ΔW|} kg sous {refW} kg ({date})` |

**Image** (`buildWorkoutShareImageBlob`, `:726-854`), canvas 2D :
- largeur 1200 ; hauteur `min(3600, max(1400, 280 + 56 × nbExercices + 72 × nbSériesFaites + 120))`,
  où une « série faite » a `reps > 0` et `weight !== null` ;
- fond `#f8fafc` ;
- nom de la séance : `700 48px Arial`, `#0f172a`, position (64, 90) ;
- `Séance réalisée le {workoutDate}` : `600 28px`, `#334155`, (64, 136) ;
- résumé `600 22px` à y = 176 :
  - `▲ {n} améliorées` en `#166534` à x 64 ;
  - `= {n} égalées` en `#64748b` à x 280 ;
  - `↘ {n} en-dessous` en `#b91c1c` à x 468 ;
  - `● {n} prises de données` en `#1e40af` à x 698 ;
- séparateur `#cbd5e1`, 2 px, de (64, 198) à (1136, 198) ;
- corps à partir de y = 246, `maxY = hauteur − 80` :
  - un exercice sans série formatée est sauté. Si `y > maxY − 100`, troncature ;
  - nom de l'exercice : `700 30px`, `#1e293b`, x 64, puis y += 38 ;
  - pour chaque série : si `y > maxY`, troncature. Sinon `• {mainLine}` en `500 25px`,
    `#334155`, x 84, y += 34 ; puis `"  " + benchmarkLine` en `600 22px`, x 104, y += 30. Couleur
    selon le statut : improved `#166534`, equaled `#64748b`, below `#b91c1c`, autre `#1e40af` ;
  - y += 22 entre exercices ;
- troncature : `… contenu tronqué (séance très longue)` en `700 24px`, `#b91c1c`, à
  (64, maxY + 24) ;
- pied : `Partagé depuis Mon Carnet - {sharedAt} - PR-v10` en `500 20px`, `#64748b`, à
  (64, hauteur − 26) ;
- `canvas.toBlob(mime, 0.84)`. JPEG d'abord. En cas d'exception, PNG.
- Messages d'erreur : « Impossible de générer l'image de partage. » (pas de contexte 2D) et
  « Impossible de finaliser l'image de partage. » (blob nul).

Nom de fichier : `seance-{name}-{workoutDateISO||'export'}` en lowercase, espaces remplacés par
`-`, extension `.jpg` ou `.png` selon `blob.type` (`:1346-1350`). Les autres caractères (`:`, `/`,
etc.) sont conservés.

### 3.13 Flux de partage (bouton « Partager », `src/App.jsx:1331-1402`)

1. Baselines + payload. Si `null` :
   `alert('Aucune séance effectuée à partager pour cette fiche. Fais au moins une séance complète, puis partage.')`.
2. Image JPEG (repli PNG), puis `File`.
3. **Capacitor natif** (`tryNativeCapacitorShareImage`, `:885-930`). Actif si
   `window.Capacitor.isNativePlatform()` et que `window.Capacitor.Plugins.Share.share`,
   `Filesystem.writeFile` et `Filesystem.getUri` existent :
   - blob converti en base64 via `FileReader.readAsDataURL`, en gardant la partie après la virgule
     (`:868-883`) ;
   - `Filesystem.writeFile({ path: 'shares/{Date.now()}-{fileName}', data, directory: 'CACHE', recursive: true })` ;
   - `Filesystem.getUri({ path, directory: 'CACHE' })` ;
   - `Share.share({ title: 'Séance effectuée - {name}', text: 'Voici ma séance du {workoutDate} ({name})', url: uri, dialogTitle: 'Partager la séance' })` ;
   - succès, ou `AbortError`, donne `true` ; toute autre erreur donne `false`.
4. **Web Share** (`tryShareImageFile`, `:932-953`) : `navigator.share({ title, text, files: [file] })`
   **sans** `canShare` préalable (contournement Honor). `AbortError` compte comme un succès.
5. Si le JPEG a échoué : on régénère en PNG et on réessaie natif puis web.
6. **Presse-papiers** (`tryCopyImageToClipboard`, `:955-982`) : `ClipboardItem({'image/png': blob})`.
   Si `clipboard.read` existe, on relit pour vérifier qu'une image est présente. Sinon, succès
   seulement hors mobile. En cas de succès :
   `alert("Image copiée. Tu peux la coller directement dans ton message à ton coach.")`.
7. Sinon, ouverture de la **modale d'assistance** : titre « Partage de la séance », texte « Si le
   partage auto ne marche pas, appui long sur l'image puis partage. ». Boutons :
   - « Partager maintenant » : web share. En cas d'échec,
     `alert('Partage natif indisponible ici. Utilise "Copier l’image" ou appui long sur l’aperçu.')` ;
   - « Copier l'image » : succès `alert('Image copiée. Colle-la dans ton message.')`, échec
     `alert("Copie image indisponible ici. Appui long sur l'image puis 'Copier' ou 'Partager'.")` ;
   - « Fermer » (révoque l'URL objet).

   La modale montre l'aperçu de l'image (`src/App.jsx:1022-1049`, `:1720-1774`).
8. Exception globale :
   `alert("Impossible de partager l'image de la séance sur ce téléphone pour le moment.")`.

En fin de séance, aucun partage automatique n'est tenté : la modale d'assistance s'ouvre
directement avec l'image préparée (`:1494-1503`).

Détection :
- `isMobileDevice()` : `/Android|iPhone|iPad|iPod|Mobile/i` sur `navigator.userAgent`
  (`:856-858`) ;
- `isNativeCapacitorApp()` : `window.Capacitor.isNativePlatform()` (`:860-866`).

### 3.14 Import CSV (`src/pages/PerformancesPage.jsx:241-378`)

- Texte normalisé (CRLF → LF, trim). Vide : « Le fichier CSV est vide. ». Moins de 2 lignes non
  vides : « Le CSV doit contenir une ligne d'en-tête et au moins une ligne de données. ».
- Délimiteur `;` si l'en-tête en contient un, sinon `,`. Parser avec guillemets et `""` échappé
  (`:8-38`).
- Alias d'en-têtes (après normalisation) :
  - id : `exercise_id | exo_id | id_exercice` ;
  - nom : `exercise_name | exercise | exercice | nom_exercice | name` ;
  - `reps | repetitions` ;
  - `weight | poids | kg | charge` ;
  - `rpe` ;
  - `variant | variante | variant_name` ;
  - série : `series_number | serie_number | serie | series | set` ;
  - `performance_date | date` ;
  - séance : `session_name | session | seance`.
- Exercice : par id exact d'abord, sinon par `name.trim().toLowerCase()`.
- Règles par ligne. `lineNumber = i + 1`. Les erreurs sont collectées et la ligne est sautée :
  - `Ligne N: exercice introuvable ({nom||id||'vide'}).` ;
  - `Ligne N: reps invalide.` (`parseInt`, < 0) ;
  - `Ligne N: poids invalide.` (poids **obligatoire**, ≥ 0) ;
  - `Ligne N: numéro de série invalide.` (`parseInt(serie || '1')` ≤ 0) ;
  - `Ligne N: RPE doit être entre 6 et 10.` (RPE vide donne 10) ;
  - `Ligne N: date invalide ({v}).`.
- Variante : correspondance insensible à la casse (fr) avec les variantes de l'exercice ;
  variante par défaut si la colonne est vide. Variante inconnue : `variantId null`,
  `variantName = valeur brute`.
- Défauts : `sessionName = 'Import CSV'`, `performanceDate = UTC today`.
- Aucune ligne valide : `alert('Aucune ligne importable.\n' + 8 premières erreurs)`. Sinon import
  en lot (une seule ligne invalide côté service fait échouer tout le lot), puis
  `alert('{n} performance(s) importée(s).' + ['\n{k} ligne(s) ignorée(s).'])`. Exception :
  `alert(error.message || "Erreur lors de l'import CSV")`. L'input fichier est toujours remis à
  zéro.
- Les lignes avec 0 rep passent la validation UI puis sont filtrées par le service, mais elles sont
  comptées « importées ».

### 3.15 Baselines historiques (`src/utils/baselinePerformances.js`)

- Table de correspondance en dur : `'Cycle 2 : haut du corps'` →
  `'/baselines/cycle2_haut_du_corps_historique.csv'` (`:1-3`). La clé est le nom de séance trimé,
  en égalité stricte. C'est le seul usage de la notion de « cycle ».
- Contenu actuel du CSV : en-tête `exercise_name;variant;rm;poids;date` et une seule ligne
  d'exemple, `Exemple Developpe couche;Touch and Go;4;62,5;17/02/2026`.
- `fetch(url, { cache: 'no-cache' })`. La promesse est mise en cache par URL pour toute la vie de
  la page, **rejets compris** (`:104-118`). Erreur HTTP ou réseau : `[]`.
- Alias : nom `exercise_name|exercise|exercice|nom_exercice|name`, reps `reps|repetitions|rm`,
  poids `weight|poids|kg|charge`, date `performance_date|date`, variante
  `variant|variante|variant_name`. Seules les valeurs non vides sont retenues.
- Une ligne est rejetée si : nom vide, reps non fini ou ≤ 0, poids non fini ou < 0, date
  invalide.
- Ligne produite :
  `{ exerciseId: exercice matché par nom normalisé || null, exerciseName: nom matché || brut, sessionName, reps: Math.trunc(reps), weight, rpe: null, variantId: null, variantName: valeur || 'Touch and Go', performanceDate, createdAt: null, serieNumber: 1, _baseline: true }`.
  Si l'exercice est matché, `variantId` et `variantName` sont résolus par nom de variante
  normalisé (`:203-219`).
- Utilisées **uniquement** pour le partage (bouton et fin de séance). Pas pour le direct, le
  tableau ni la progression.

### 3.16 Remarques du coach

- Les CRLF et CR sont convertis en LF, côté carte (`ExerciseCard.jsx:55-71`) et côté App
  (`src/App.jsx:1516-1540`). Si le texte est inchangé, rien n'est envoyé et le panneau se ferme.
- Après sauvegarde, l'exercice et la séance en cours sont mis à jour (les remarques sont visibles
  dans le runner). Erreur : `alert('Erreur lors de la sauvegarde des remarques')`.
- Les notes apparaissent dans : la carte (« Dernières remarques: »), le runner (« Remarques
  coach »), le payload de partage et la page de partage.

### 3.17 File d'attente hors-ligne des performances (`src/App.jsx:26`, `:1108-1159`)

- Clé `localStorage['pending_performances_queue_v1']` = `[{ createdAt: ISO, payload: PerformanceInput[] }]`.
- Ajout à la file quand `handleEndSession` échoue (n'importe quelle exception, validation
  comprise).
- Synchronisation **uniquement au démarrage** (`loadData`, avant les lectures). Les entrées sont
  envoyées une par une. Celles en échec restent, les autres sont retirées. Si tout passe, la clé
  est supprimée. Erreur de JSON : `console.error`, la clé reste.

### 3.18 Mise à jour croisée après modification d'un exercice (`src/App.jsx:1208-1252`)

- L'exercice est mis à jour dans le state (nom, description, muscles et variantes normalisés).
- Les `sessions` en mémoire sont mises à jour : `name`, `muscleGroups` et `variants` des entrées
  dont l'id correspond.
- La séance en cours est reconstruite par `buildSessionWithDetails`.
- Erreur : `alert("Erreur lors de la mise à jour de l'exercice")` puis l'erreur est relancée.
- Ajout d'exercice : il est ajouté **en fin** de liste en mémoire, avec `coachNotes: ''`. Erreur :
  `alert("Erreur lors de l'ajout de l'exercice")`.
- Suppression : il est retiré de la liste. Les séances en mémoire ne sont **pas** nettoyées.
  Erreur : `alert('Erreur lors de la suppression')`.
- Séances :
  - ajout en fin de liste. Erreur : `alert('Erreur lors de la création de la séance')` ;
  - mise à jour : remplacement de la séance et reconstruction de la séance en cours si c'est elle.
    Erreur : `alert('Erreur lors de la mise à jour de la séance')` ;
  - suppression : retrait de la séance ; si c'est la séance en cours, elle est annulée. Erreur :
    `alert('Erreur lors de la suppression')`.

### 3.19 Carte musculaire (body highlighter)

Librairie `@mjcdev/react-body-highlighter@0.0.4`, `gender="male"`.
`src/components/MuscleMap.jsx` :
- Correspondance (clé normalisée → slugs) (`:15-31`) :
  - `pecs` → chest ;
  - `trapeze` → trapezius ;
  - `grand dorsal` → upper-back ;
  - `ischios` → hamstring ;
  - `quadriceps` → quadriceps ;
  - `epaules` → deltoids ;
  - `biceps` → biceps ;
  - `triceps` → triceps ;
  - `abdominaux` → abs + obliques ;
  - `avant-bras` → forearm ;
  - `fessiers` → gluteal ;
  - `mollets` → calves ;
  - `bas du dos` → lower-back ;
  - `abducteurs` et `adducteurs` → adductors.

  `Psoas` et toute autre étiquette libre (ex. « Pectoraux ») n'ont **aucun** slug : rien n'est
  surligné.
- Intensité : 2 pour tout slug, sauf `obliques` = 1 (`:33-45`). Couleurs
  `['#3b82f6', '#60a5fa', '#14b8a6']`, bordure `rgba(248,250,252,0.16)` (`:71-72`).
- Vues :
  - `dual` (défaut) : Avant + Arrière avec titres ;
  - `front` ou `back` ;
  - `auto` : `back` si au moins un slug « dos » (upper-back, lower-back, hamstring, gluteal,
    trapezius) et aucun slug « face » (chest, biceps, abs, obliques, quadriceps, tibialis) ; sinon
    `front` (`:47-57`).
- Échelle : `compact` 1,45, défaut 1,65. Surcharges : 1,75 pour la miniature du filtre, 1,85 pour
  les items (`MuscleFilter.jsx:5-6`).
- Usages : modale fiche (dual, grande taille) ; filtre muscle (miniatures : `front` si rien n'est
  sélectionné, sinon `auto`).

### 3.20 Recherche avec alias (`src/components/SearchBar.jsx:12-64`)

- Une requête correspond à un exercice si le nom normalisé contient la requête, OU si un muscle
  normalisé contient la requête, OU si une clé d'alias commune existe entre la requête et le
  muscle. `resolveMuscleKeys(text)` renvoie les clés dont un alias est **contenu** dans le texte.
- Table d'alias :
  - pecs : pec, pecs, pectoraux, pectoral, chest ;
  - trapeze : trapeze, trap, traps, trapezius ;
  - grand dorsal : grand dorsal, dorsal, lats, latissimus, dos ;
  - bas du dos : bas du dos, lombaire(s), lower back ;
  - epaules : epaule(s), deltoide(s), shoulder ;
  - biceps : biceps ;
  - triceps : triceps ;
  - avant-bras : avant bras, avant-bras, forearm ;
  - abdominaux : abdo(s), abdominaux, abdominal, abs, core, oblique(s) ;
  - quadriceps : quadriceps, quad(s) ;
  - ischios : ischio(s), ischio-jambiers, hamstring(s) ;
  - fessiers : fessier(s), glute(s), gluteal ;
  - mollets : mollet(s), calf, calves ;
  - abducteurs : abducteur(s), adducteur(s), adductors, abductors ;
  - psoas : psoas, hip flexor, iliopsoas.
- Requête vide : `onSearch('')`, qui fait revenir à la liste complète.

---

## 4. Mode mock (`VITE_DATA_BACKEND`)

- Activation : `VITE_DATA_BACKEND` (trim, lowercase) ∈ {`mock`, `local`, `test`} donne `'mock'`.
  Toute autre valeur donne `'supabase'` (`src/services/index.js:4-7`).
- Attention : les scripts `dev:mock` utilisent `vite --mode mock`, mais aucun fichier `.env.mock`
  n'existe dans le dépôt. Sans cette variable, le mode mock **ne s'active pas** (voir 6).
- Stockage : `localStorage['local_test_db_v1']`, document JSON de `version: 1`. Si la version
  diffère ou si le JSON est invalide, la base est réinitialisée avec le seed
  (`src/services/mockService.js:193-203`). Chaque `saveDb` met à jour `updatedAt`.
- Ids : `crypto.randomUUID()`, sinon `{prefix}_{Date.now()}_{hex}` (`:10-16`).
- Structure : `{ version, createdAt, updatedAt, exercises[{id,name,description,muscleGroups,variants,isCustom,createdAt}], sessions[{id,name,createdAt}], sessionExercises[{sessionId,exerciseId,seriesCount}], performances[rows snake_case], coachNotesByExerciseId{[id]:{notes,updatedAt}}, sharedSessions[{id,payload,createdAt}], generalAdvice|null }`.
- **Seed** (`:56-191`) :
  - Exercices :
    - « Développé couché » : muscles `['Pectoraux', 'Triceps']`, variantes « Touch and Go »
      (défaut) et « Pause » ;
    - « Squat » : `['Quadriceps', 'Fessiers']`, variante « Touch and Go ».

    Description « Exercice de test (mock). ».
  - Séance « Séance test (mock) » : Développé couché ×3 séries, Squat ×3 séries.
  - Performances (variante Touch and Go, session « Séance test (mock) ») :
    - Bench 5×90 (RPE 9, S1, 2026-03-01) ;
    - Bench 6×90 (RPE 9, S1, 2026-03-05), cas « record reps » ;
    - Bench 6×92,5 (RPE 9,5, S2, 2026-03-10), cas « PR hybride » ;
    - Squat 5×120 (RPE 9, S1, 2026-03-01) ;
    - Squat 5×122,5 (RPE 9, S1, 2026-03-10), cas PR same-reps.

    Toutes ont `created_at` = heure du seed.
- Écarts de comportement avec Supabase :
  - noms trimés et validés à l'écriture des exercices et des séances ;
  - `seriesCount = Number(series) || 1` ;
  - `deleteExercise` cascade vers les `sessionExercises`, les performances et les notes ;
  - `getExercises` renvoie des variantes **avec ids** (`ensureVariantIds`) ;
  - le nettoyage des perfs diffère (3.5) ;
  - `getSessions` trie par `createdAt` desc et affiche « Exercice » pour un exercice disparu ;
  - `updateExercise` renvoie l'exercice.
- Reset : `resetMockDatabase()` supprime la clé, puis la page se recharge (bandeau).

---

## 5. PWA, Android, déploiement

- **Service worker** `public/sw.js` : cache `mymuscle-v1`. Précache `/`, `/index.html` et
  `/manifest.webmanifest`. Stratégie *cache-first* sur tous les `GET` : les réponses `200` de type
  `basic` (même origine) sont mises en cache, les requêtes cross-origin (Supabase) ne le sont pas.
  En cas d'échec réseau, repli sur `/index.html`. `skipWaiting` + `clients.claim`. À l'activation,
  suppression des autres caches (`:1-54`).
  **Il n'est jamais enregistré** : `registerServiceWorker()` (`src/registerServiceWorker.js:1-24`)
  n'est appelé nulle part (`src/main.jsx:1-10`). Sur une plateforme native, cette fonction
  désenregistre les SW.
- **Manifest** `public/manifest.webmanifest` :
  - `name` et `short_name` « MyMuscle » ;
  - `description` « Suivi de musculation et gestion des séances. » ;
  - `start_url` `/`, `display` `standalone`, `orientation` `portrait-primary` ;
  - `background_color` `#f3f4f6`, `theme_color` `#1e3a8a` ;
  - icône unique `/vite.svg` (logo Vite).
- `index.html` :
  - `lang="en"` alors que l'UI est en français ;
  - favicon `href=""` ;
  - viewport `viewport-fit=cover` ;
  - `theme-color` `#1e3a8a` ;
  - balises `mobile-web-app-capable` et Apple ;
  - `<title>MyMuscle</title>`.
- Mise en page : thème sombre fixe (`color-scheme: dark`). Tokens dans `src/App.css` :
  - fonds : `--bg-page` `#0b1020`, `--bg-surface` `#111a33` ;
  - couleurs : `--primary` `#3b82f6`, `--secondary` `#14b8a6`, `--danger` `#ef4444`,
    `--success` `#22c55e`, `--warning` `#f59e0b` ;
  - `--bottom-nav-height` 76px ;
  - safe-area insets respectés (`src/App.css:168-171`, `src/styles/BottomNavigation.css:19`) ;
  - `@media (prefers-reduced-motion: reduce)` existe aussi (`src/styles/Animations.css:42`).
- **Capacitor** (`capacitor.config.ts`) :
  - `appId: 'com.mymuscle.app'`, `appName: 'MyMuscle'`, `webDir: 'dist'` ;
  - `bundledWebRuntime: false` (option obsolète) ;
  - `server.androidScheme: 'https'`.

  Plugins natifs : `@capacitor/filesystem`, `@capacitor/share`. Ils sont appelés via
  `window.Capacitor.Plugins` et ne sont pas importés en JS.
- **Android** :
  - `applicationId com.mymuscle.app`, `versionCode 1`, `versionName "1.0"` ;
  - `minSdk 24`, `compile` et `target` 36 ;
  - permission `INTERNET` uniquement ;
  - `FileProvider` `${applicationId}.fileprovider` avec `external-path` et `cache-path` `.` ;
  - `MainActivity` appelle `WindowCompat.setDecorFitsSystemWindows(window, true)` ;
  - activité `singleTask`, splash et icônes générés ;
  - scripts npm `android:add`, `android:sync`, `android:open`.
- **Déploiement web** : réécriture SPA de toutes les routes vers `/index.html`, dans
  `netlify.toml`, `public/_redirects` (`/* /index.html 200`) et `vercel.json`. Elle est nécessaire
  pour `/shared/:id`.
- **Variables d'environnement** :
  - `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (repli sur des placeholders
    `https://your-project.supabase.co` / `your-anon-key`, `src/supabase.js:5-6`) ;
  - `VITE_DATA_BACKEND` ;
  - `VITE_PUBLIC_APP_URL` : présente dans `.env.local` mais inutilisée.
- Build : Vite 5, plugin React. Tests : Vitest 1 + jsdom, setup qui vide `localStorage`.

---

## 6. Dette et bugs constatés

### Bugs fonctionnels
1. **Changement d'exercice impossible sur la page Progression** ouverte depuis « Graphique ».
   L'effet `[exercises, initialExerciseId, selectedExerciseId]` remet `initialExerciseId` à chaque
   changement. Choisir « -- Sélectionner -- » remet aussi le premier exercice
   (`src/pages/ExerciseProgressPage.jsx:36-44`).
2. **« Redémarrer » = « Continuer »** : même id, donc simple navigation, sans remise à zéro
   (`src/App.jsx:1306-1309`, `src/components/SessionsList.jsx:84-91`).
3. **Abandon sans confirmation** (`src/pages/SessionRunner.jsx:571`).
4. **Message trompeur sur les séries incomplètes** : « enregistrées avec 0 répétition » alors que le
   service filtre `reps > 0` (`SessionRunner.jsx:326`, `supabaseService.js:541-544`). Même chose
   pour l'ajout manuel à 0 rep : « Performance ajoutée. » alors que rien n'est écrit
   (`PerformancesPage.jsx:204`, `App.jsx:1547`). Même chose pour l'import CSV.
5. **Les séries non validées des exercices bonus sont ignorées** par la vérification de fin, qui ne
   parcourt que `session.exercises` (`SessionRunner.jsx:314`). Elles sont perdues en silence.
6. **Perte d'état de la séance en cours** : en revenant sur le runner, `activeExercises` repart de
   la fiche (bonus et retraits perdus, `SessionRunner.jsx:69`, `:79`). `sessionDate` revient à
   aujourd'hui. Les données des bonus restent orphelines dans `seriesData`. Un rechargement perd
   tout (état en mémoire seulement).
7. **Dates UTC** :
   - date de séance par défaut et maximum (`SessionRunner.jsx:71`, `:393`) ;
   - ajout manuel (`PerformancesPage.jsx:124`) ;
   - défaut du service (`supabaseService.js:512`) ;
   - import (`PerformancesPage.jsx:342`).

   En France, entre 00h et 01h/02h, c'est la date de la veille. Le champ `date` et `workoutDate`
   sont parsés en UTC via `new Date('YYYY-MM-DD')` (`supabaseService.js:634`, `App.jsx:652`).
8. **Préférences d'accessibilité non appliquées au démarrage** : elles ne s'appliquent qu'au
   montage de `SettingsPage` (`src/pages/SettingsPage.jsx:24-32`).
9. **Service worker jamais enregistré** : pas de hors-ligne réel (`src/main.jsx`). Le manifest
   pointe une icône Vite.
10. **Nettoyage destructeur de l'historique** : suppression des doublons `reps×poids` sur toutes
    les dates (`supabaseService.js:471-488`). Le mock diverge (`mockService.js:243-260`).
11. **Deux algorithmes de PR incohérents** : direct (3.8) et partage (3.11). Le direct affiche
    « Record battu » sans aucun historique.
12. **Presse-papiers** : `ClipboardItem({'image/png': blob})` avec un blob JPEG
    (`App.jsx:961-963`).
13. **Nom de fichier de partage non assaini** (`:`, `/`, etc.) : `App.jsx:1346-1348`. Exemple :
    « Cycle 2 : haut du corps ».
14. **Annulation du partage natif Capacitor** : le plugin rejette avec « Share canceled », pas
    `AbortError`. Le flux enchaîne alors sur le web share, le PNG, etc. (`App.jsx:924-929`).
15. **Antislashs affichés** dans l'état vide des séances (`SessionsList.jsx:37`).
16. **Filtre muscle non tolérant** (casse, accents, alias). Les étiquettes libres et le seed mock
    (« Pectoraux ») ne matchent pas « Pecs » et ne s'affichent pas sur la carte
    (`ExercisesPage.jsx:66-76`, `MuscleMap.jsx:15-31`). Psoas est au catalogue mais n'a pas de
    slug.
17. **Séances Supabase sans muscles** : `muscleGroups: []` à la lecture
    (`supabaseService.js:345`). Les muscles principaux et les tags n'apparaissent qu'après une
    création ou une modification en mémoire.
18. **`getSessions` fragile** : `sessionExercises` est `null` en cas d'erreur, ou `se.exercises`
    est `null` pour un exercice supprimé. L'exception tombe dans le `catch` et **toutes** les
    séances disparaissent (`supabaseService.js:333-347`). Requêtes N+1.
19. **Ids de variantes non relus** après `addExercise` / `updateExercise` côté Supabase
    (`supabaseService.js:64-68`, `App.jsx:1219`). Jusqu'au rechargement, les perfs sont écrites
    avec `variant_id = null`.
20. **Renommer une variante avec un nom déjà pris** fait disparaître l'une des deux
    (`normalizeVariants`), puis supprime la ligne en base (`supabaseService.js:215-226`). Les
    performances peuvent garder un `variant_id` orphelin.
21. **File hors-ligne** : les erreurs de validation y sont aussi mises et rejouées à l'infini
    (`App.jsx:1506-1508`). Synchronisation seulement au démarrage. Risque de doublons si l'insert a
    réussi avant l'exception.
22. **`is_custom` toujours vrai** (`supabaseService.js:30`).
23. **Ordre des exercices d'une séance non garanti** : aucune colonne d'ordre dans
    `session_exercises`.
24. **Opérations non transactionnelles** : séance créée puis exercices en échec ; update de séance
    ou de muscles en « delete puis insert » (`supabaseService.js:186-204`, `:386-406`).
25. **Le cache de baseline mémorise les rejets** (`baselinePerformances.js:104-118`). Le partage
    peut prendre la baseline comme « séance » s'il n'y a aucune perf réelle (3.10).
26. **Le constructeur accepte 0 série** (`SessionBuilder.jsx:45`). Le nom n'est pas trimé.
27. **`AddExerciseForm`** : pas de retour si aucun muscle n'est choisi. Le formulaire lit le DOM
    via `getElementById` (`AddExerciseForm.jsx:45-55`, `:93`). La modale se ferme avant la réponse.
28. **« Dernière séance »** sur Performances : tri avec `new Date(performanceDate || date)`
    (`PerformancesPage.jsx:176-180`). Regroupement des filtres par nom (collision possible si deux
    exercices portent le même nom, `:160-166`).
29. **Lien séance ↔ perfs par nom** : renommer une séance casse le partage (2.4).
30. **Repli « muscleGroup » legacy** : `ExerciseCard.jsx:220` affiche une puce vide.
31. Le partage ignore les séries au-delà du nombre prévu et les exercices bonus (3.10).
32. **Limite PostgREST** : `getPerformances()` lit tout sans pagination. Si la limite `max-rows`
    est active (1000 par défaut sur Supabase), l'historique est **tronqué en silence** et les PR
    deviennent faux (`supabaseService.js:614-643`).

### Sécurité
- Pas d'authentification. Le client utilise la clé `anon`. Toutes les tables sont lisibles,
  modifiables et supprimables par quiconque possède l'URL et la clé, sauf si des politiques RLS
  l'empêchent. Rien dans le dépôt ne le garantit (`src/supabase.js`).
- `shared_sessions` est lisible par id (UUID devinable seulement par fuite).
- `.env.local` existe localement (ignoré par git). La spec indique que la clé a fuité dans
  l'historique : rotation à prévoir.

### Qualité, lint, code mort
- **Lint** : 2 erreurs, 9 warnings.
  - Erreurs : `onOpenExerciseDetails` inutilisé (`src/components/SessionBuilder.jsx:9`) ;
    `onNavigate` inutilisé (`src/pages/PerformancesPage.jsx:93`).
  - Warnings : dépendances de hooks (`App.jsx:1065`, `:1089` ; `SessionRunner.jsx:81`, `:297`,
    `:308`) et `set-state-in-effect` (`SessionBuilder.jsx:19`, `ExerciseProgressPage.jsx:38`,
    `:48`, `SessionRunner.jsx:79`).
- **Logique dupliquée** : `App.jsx:50-170` duplique `utils/formatters.js` et
  `utils/performanceAnalysis.js`. `buildSessionWithDetails` (`App.jsx:35-48`) duplique
  `utils/sessionUtils.js`. Il existe 3 copies du parse de date (App, PerformancesPage, baseline),
  3 copies de `normalizeWeight`/`parseWeightValue` (`supabaseService.js:5`, `mockService.js:34`,
  `SessionRunner.jsx:5`, `PerformancesPage.jsx:95`) et 2 copies de `parseCsvLine`.
- **Tests trompeurs** : les 120 tests passent, mais `formatters`, `performanceAnalysis` et
  `sessionUtils` sont du code **non utilisé en production**. `findBestReference` testé n'a pas la
  sémantique de `findPreviousBest`. `App.jsx`, les composants, les pages, `supabaseService` et
  `baselinePerformances` sont exclus de la couverture (`vitest.config.js:24-48`).
- **Code mort** :
  - composants listés en 1.11 et `MusculationPage` ;
  - `registerServiceWorker.js` ;
  - `createSharedSession`, `getPerformancesByExercise`, `deletePerformance`,
    `deletePerformancesBySession*` ;
  - `DEBUG_SHARE_PR` ;
  - `deltaWeight` ;
  - `src/assets/react.svg` ;
  - `progress.currentExerciseIndex` (toujours 0).
- **Dépendances mortes ou incohérentes** :
  - `firebase` (dépendance de production, jamais importée) ;
  - `@tauri-apps/cli` + scripts `tauri:*` ;
  - script `test:mutation` (Stryker non installé) ;
  - `typescript` installé sans fichier TS côté web ;
  - `@testing-library/react@14` incompatible en peer avec React 19 (`npm ci` exige
    `--legacy-peer-deps`).
- **Performance** :
  - N+1 au démarrage (1 requête de notes par exercice, `App.jsx:1171-1176` ; 1 requête par
    séance) ;
  - `buildHistoryIndex` copie les tableaux à chaque insertion (`[...existing, candidate]`,
    `App.jsx:252`), en O(n²) ;
  - `PerformanceTable` recalcule tout à chaque rendu ;
  - le PR live parcourt toutes les perfs pour chaque série à chaque frappe ;
  - un seul gros bundle (avertissement de taille de chunk).
- **Gestion d'erreurs** : `alert` partout ; les lectures renvoient `[]` en silence ; aucun écran
  d'erreur ni bouton « réessayer » ; les promesses relancées par `handleUpdateExercise` ne sont pas
  attrapées dans `ExerciseCard` (`ExerciseCard.jsx:181-193`).
- **Accessibilité** : modales sans piège de focus. Le bouton « Partager » de la modale d'assistance
  est en styles inline. `lang="en"`.
- `src/components/SessionHeader.jsx`, `WorkoutInputPanel.jsx` et `ExerciseWorkoutCard.jsx`
  importent des CSS par un chemin inexistant (`../../styles`).

---

## 7. Checklist de parité

### Exercices
- [ ] Liste des exercices triée par création décroissante, avec compteur « N exercice(s) ».
- [ ] État vide « Aucun exercice trouvé ».
- [ ] Recherche par nom ou muscle, insensible à la casse et aux accents, avec alias musculaires (3.20).
- [ ] Suggestions (max 8) cliquables, bouton « Effacer ».
- [ ] Compteur « n/total » selon la recherche.
- [ ] Filtre par muscle (15 muscles + « Tous ») avec miniatures de silhouette.
- [ ] Création : nom requis, ≥ 1 muscle (catalogue de 15), description optionnelle, variante « Touch and Go » par défaut.
- [ ] Modale de création fermable par bouton, overlay ou Échap, avec focus sur le nom.
- [ ] Détails rapides : muscles, variantes avec badge « Base », description.
- [ ] Édition : nom, description, muscles (catalogue + étiquettes libres, suppression).
- [ ] Édition des variantes : ajout, renommage, choix de la base, suppression (min 1).
- [ ] Validations d'édition avec leurs messages, puis « Exercice modifié. ».
- [ ] Une modification d'exercice se répercute sur les séances et sur la séance en cours.
- [ ] Suppression avec confirmation.
- [ ] Fiche exercice (modale) : description, carte musculaire avant/arrière, puces, variantes « (base) », tableau des performances.
- [ ] Fiche ouvrable depuis la carte, la liste des séances, le runner et le tableau des perfs.
- [ ] Fiche fermable par bouton, overlay ou Échap.
- [ ] Carte musculaire : correspondance muscles → zones (3.19), vue auto avant/arrière.

### Séances
- [ ] Liste des séances : nom, date de création FR, nombre d'exos, total de séries, 3 muscles principaux.
- [ ] Aperçu des 5 premiers exercices (+N), tags muscles, badge de séries.
- [ ] Carte de la séance en cours mise en évidence, avec Continuer / Redémarrer ; sinon Démarrer.
- [ ] Constructeur : nom, recherche dans la bibliothèque, ajout (3 séries par défaut), ordre affiché, nombre de séries modifiable, retrait.
- [ ] Validation du constructeur : nom + ≥ 1 exercice, avec message.
- [ ] Modification d'une séance existante (pré-remplie).
- [ ] Suppression avec confirmation ; annule la séance en cours si c'est elle.
- [ ] Démarrer alors qu'une autre séance est en cours : confirmation d'abandon.
- [ ] Bascule Exercices ↔ Séances en tête de page.

### Séance en cours
- [ ] Choix de la date (défaut aujourd'hui, pas de date future).
- [ ] Barre de progression en % de séries validées.
- [ ] Par exercice : remarques coach, muscles, nombre de séries.
- [ ] Par série : variante, reps, poids (virgule acceptée, 2 décimales), RPE 6 à 10 (défaut 10, couleur par niveau).
- [ ] Validation d'une série selon `canValidateSerie` (0 rep autorisé sans poids) ; verrouillage ; « Modifier » pour déverrouiller.
- [ ] Ajout et suppression de série (confirmation).
- [ ] Ajout d'un exercice bonus (recherche, 3 séries) et retrait d'un exercice (confirmation).
- [ ] Bandeau animé « Record battu sur N reps (variante) » selon la règle live (3.8), ou règle unifiée si décision explicite.
- [ ] Terminer : avertissement si séries non validées, enregistrement, retour aux Séances, « Séance enregistrée. ».
- [ ] Après enregistrement : modale de partage avec l'image.
- [ ] Échec d'enregistrement : sauvegarde locale + message « Connexion instable… ».
- [ ] Abandonner la séance.
- [ ] Quitter le runner via la navigation conserve la séance en cours ; on la reprend via « Continuer ».

### Performances
- [ ] 4 stats : total séries, exercices suivis, charge moyenne, dernière séance.
- [ ] Filtre par exercice : « Tous », 5 boutons, puis menu « Autres exercices... ».
- [ ] Tableau par exercice : reps 1 à 30 × variantes (poids, RPE, date), meilleure charge par reps, entrées dominées masquées.
- [ ] Filtre de variante par exercice.
- [ ] « Copier Excel » par variante (30 lignes poids⇥date, virgule décimale), avec repli `prompt`.
- [ ] Pied de bloc : nombre de séances, meilleur e1RM (Epley, arrondi au dixième).
- [ ] Statistiques globales : séries, tonnage, reps, exercices.
- [ ] Ajout manuel : exercice, variante, reps, poids, RPE, date, nom de séance (« Ajout manuel » par défaut).
- [ ] Import CSV avec alias de colonnes, délimiteur `;` ou `,`, dates ISO ou FR, erreurs par ligne et résumé.
- [ ] États vides.

### Progression exercice
- [ ] Choix de l'exercice (premier par défaut, ou celui passé en paramètre).
- [ ] Choix de la variante issue des performances, « Touch and Go » par défaut.
- [ ] Stats : poids max, e1RM max, volume total, progression e1RM (max − premier).
- [ ] Vue « Progression par reps » : grille reps × dates, PR / régression / stable, colonne PR, sparkline.
- [ ] Vue « Graphiques » : poids max, e1RM, volume par date.
- [ ] Historique détaillé du plus récent au plus ancien.
- [ ] Bouton Retour vers Performances.
- [ ] Changement d'exercice possible (corriger le bug 1).

### Partage
- [ ] Bouton « Partager » d'une séance : dernière séance réalisée (par nom de séance), baselines CSV incluses.
- [ ] Message si aucune séance réalisée.
- [ ] Détection référence / PR identique à `findPreviousBest` (même reps, rep inférieure, référence dominante, frontière de Pareto, epsilon 0,01, ordre temporel strict).
- [ ] Statuts : amélioré, égalé, en-dessous, prise de données ; PR hybride, record reps.
- [ ] Textes de série et de comparaison identiques (3.12), poids à la virgule.
- [ ] Image 1200 px de large : en-tête, résumé coloré, exercices et séries, troncature, pied « Partagé depuis Mon Carnet - date - PR-v10 ».
- [ ] Ordre des tentatives : partage natif Android (fichier en cache + feuille de partage) → Web Share avec fichier → repli PNG → copie presse-papiers → modale d'assistance (Partager maintenant / Copier l'image / Fermer + aperçu).
- [ ] L'annulation par l'utilisateur n'est pas traitée comme une erreur.
- [ ] Page publique `/shared/:id` (et `?sharedId=` / `?shared=`) : lecture d'un partage existant, état « Lien invalide ou expiré », retour à l'app.

### Accueil / Conseils
- [ ] Hero, panneau et 3 cartes ; CTA vers les Exercices.
- [ ] Conseils généraux (Entraînement, Nutrition, Sommeil) : sauvegarde automatique (locale immédiate + distante avec debounce de 450 ms), relecture distante puis repli local.
- [ ] Mêmes données visibles dans Réglages (« Notes rapides »).

### Réglages
- [ ] Réduire les animations (persisté, appliqué globalement, idéalement dès le démarrage).
- [ ] Taille du texte 100 / 110 / 120 % (persistée).
- [ ] Affichage du backend de données (Mock / Supabase).

### Notes coach
- [ ] Éditer les remarques par exercice (fins de ligne normalisées, pas d'envoi si inchangé).
- [ ] Remarques affichées dans la carte, le runner, la fiche partagée et le payload de partage.

### Mode mock
- [ ] Bascule par `VITE_DATA_BACKEND` (`mock` / `local` / `test`).
- [ ] Seed identique (2 exercices, 1 séance, 5 perfs couvrant record reps, PR hybride et PR same-reps).
- [ ] Bandeau « Mode test local (mock) » + « Reset données » avec confirmation et rechargement.

### Hors-ligne / PWA
- [ ] File locale des performances non envoyées, rejouée au démarrage.
- [ ] Manifest installable (nom MyMuscle, standalone, portrait, couleurs).
- [ ] Service worker enregistré sur le web, désenregistré en natif (comportement prévu par le code actuel, aujourd'hui inactif).
- [ ] Réécriture SPA (Netlify, Vercel, `_redirects`).

### Android
- [ ] `appId com.mymuscle.app`, `appName MyMuscle`, scheme `https`, `webDir dist`.
- [ ] Plugins Share et Filesystem ; FileProvider configuré ; partage d'image depuis le cache.
- [ ] Respect des safe-areas (barre basse, haut de page).
- [ ] Bouton retour Android (aujourd'hui non géré : décision à prendre, la navigation par URL de la réécriture le rendra utile).
