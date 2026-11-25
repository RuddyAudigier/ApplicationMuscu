# MyMuscle

MyMuscle est une application de suivi de musculation pensée pour la **méthode fontesque** : deux cycles A/B qui alternent, des tentatives de record choisies avant la série et des séries modulables selon la forme du jour. Elle fonctionne dans le navigateur et sur Android (Capacitor), avec Supabase comme base de données et un mode démo entièrement local.

Le design est sombre, « noir & citron » : fond noir, accents jaune citron, typographie lisible en salle.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [La méthode fontesque](#la-méthode-fontesque)
3. [Règles de PR](#règles-de-pr)
4. [Installation et lancement](#installation-et-lancement)
5. [Base de données Supabase](#base-de-données-supabase)
6. [Hors-ligne](#hors-ligne)
7. [Android (Capacitor)](#android-capacitor)
8. [Architecture et qualité](#architecture-et-qualité)
9. [Sécurité — actions à faire](#sécurité--actions-à-faire)
10. [Fonctionnalités de l’ancienne version non reprises](#fonctionnalités-de-lancienne-version-non-reprises)
11. [Dépannage](#dépannage)

---

## Fonctionnalités

| Écran | Route |
| --- | --- |
| Accueil | `/` |
| Programme | `/program` |
| Séance en cours | `/workout` |
| Compte rendu | `/report` |
| Bilan du bloc | `/bilan` |
| Records | `/records/:exerciseId?` |
| Ajouter un PR hors séance | `/records/add` |
| Exercices et fiche exercice | `/exercises`, `/exercises/:id` |
| Réglages | `/settings` |

### Navigation

- Barre du bas : Accueil, Programme, Records, Exercices.
- **Glisser à gauche ou à droite** sur ces quatre écrans passe à l’onglet voisin. Le geste est ignoré s’il part d’un champ, d’une zone qui défile horizontalement ou d’une feuille ouverte.
- Le changement d’onglet (barre ou glisser) joue une courte transition horizontale ; pas de transition sur les autres écrans, ni si « réduire les animations » est activé.

### Accueil

- Cycle en cours (A ou B), « semaine N sur M » et jours avant la bascule.
- **Frise** des blocs passés, en cours et à venir.
- **Séance du jour** (ou prochaine séance) : nom, exercices, séries prévues, bouton **Démarrer**.
- Avec une **semaine type** réglée dans Programme :
  - **séance manquée** : **La faire maintenant**, **Décaler…** (vers un jour d’ici dimanche) ou **Sauter cette semaine** ;
  - **prochaine séance** : celle du jour, sinon la suivante de la semaine, démarrable **en avance** ;
  - **Décaler…** et **Sauter cette semaine** se trouvent dans la carte citron de la séance, sous les séries ;
  - une séance compte comme faite dès qu’une série porte son nom cette semaine ; décalage et saut ne valent que pour la semaine en cours et s’annulent.
- Sans semaine type : la première séance du cycle pas encore faite depuis lundi.
- **Ce mois-ci** : calendrier du mois (lundi → dimanche), un point par jour avec séance (A plein, B contour), aujourd’hui entouré, mois précédent / suivant, total de séances.
- **Bilan du bloc** : carte d’accès, mise en avant les 3 derniers jours du bloc.
- **Derniers PR** : records récents avec leur type (charge, reps, hybride).

### Programme

- Onglets **A** / **B** : séances de chaque cycle et leurs exercices, démarrage d’une séance depuis la liste.
- **Durée des cycles** : de **1 à 4 semaines** par demi-semaine (1 → 7 j, 1,5 → 11 j, 2 → 14 j, 2,5 → 18 j, 3 → 21 j, 3,5 → 25 j, 4 → 28 j).
- **Reporter le prochain cycle d’une semaine** (+7 jours, sans limite) et **Annuler un report** (−7 jours). Le report ne vaut que pour le bloc en cours.
- **Ma semaine** : une semaine type **par cycle**, réglée sous l’onglet A ou B. Pour chaque jour (lundi → dimanche) : repos ou une séance du cycle. L’accueil suit la semaine du cycle en cours.
- **Échauffements** : catalogue d’échauffements généraux (nom + détail, ex. « Rotations d’épaules » / « 2 × 15 avec élastique »). Chaque séance choisit les siens dans le constructeur de séance.

### Séance en cours

- **Forme du jour** au démarrage : **Frais** (séries prévues) ou **Fatigué** (séries prévues − 1, minimum 1).
- En-tête : **anneau de progression** « séries validées / séries prévues » (ex. 9/14).
- Saisie des séries (reps, charge, RPE) exercice par exercice, avec boutons **− / +** : **0,5 kg** pour la charge, **1 rep** pour les reps (champ vide : + met 0,5 kg ou 1 rep). Mêmes boutons sur les séries de chauffe.
- **La cible suit les reps** : changer les reps d’une série cale la cible sur le record à ce nombre de reps (même variante) ; sans record, la cible est vide (« à conquérir »).
- **Mes records** : tableau 1 à 30 reps de l’exercice et de la variante pour choisir sa tentative avant la série ; toucher une ligne fixe reps et cible.
- **Variante** : rangée de puces sous le nom de l’exercice. **Mon état** : rangée séparée (fatigué, motivé, énergique, mou, ou aucun).
- **État général** : texte libre, modifiable pendant la séance et dans le compte rendu.
- **Échauffement** : bloc à cocher en tête de séance (choisi dans Programme). **Séries de chauffe** par exercice (« + Série de chauffe », reps × kg) : séparées des séries de travail, jamais comparées aux records, **jamais enregistrées comme performances**.
- **Glisser à gauche ou à droite** passe à l’exercice suivant ou précédent ; le bouton « Exercice suivant › » reste.
- **Séries modulables** : ajouter ou retirer des séries.
- Détection en direct de chaque série validée : PR charge, PR reps, hybride, égalé, en dessous, prise de données.
- **Valider** enregistre la série. Corriger ou supprimer une série validée, retirer un exercice, abandonner la séance, choisir la date (saisie d’une séance passée).
- La séance en cours est conservée sur l’appareil : fermer l’application ne la perd pas.

### Compte rendu

- Résumé de la séance : exercices, séries, PR obtenus.
- Forme du jour, état général, état de chaque exercice, échauffement fait et lignes « Chauffe : 10 × 40 kg, … » sous chaque exercice (style atténué).
- Forme, état et échauffement sont **modifiables depuis l’écran** ; le **PDF** pour le coach reflète les modifications. Partageable.
- Enregistré dans le journal (voir Base de données) à « Terminer » puis à chaque modification.

### Bilan du bloc

- Bloc en cours par défaut, sélecteur des **6 blocs précédents** (reconstitués par tranches de la durée générale du cycle ; les reports passés ne sont pas mémorisés).
- Contenu : cycle et dates, séances faites / prévues / sautées / manquées, PR par exercice, exercices sans PR, répartition Frais / Fatigué, états par exercice, états généraux datés.
- **Ressenti du bloc** : texte libre enregistré dans le journal.
- Export **PDF** partageable pour le coach.

### Records

- Tableau des records de 1 à 30 répétitions par exercice et par variante (poids, RPE, date). Cases vides : « à conquérir ».
- **Courbe** de progression de l’e1RM (formule d’Epley).
- **Importer un fichier** : bouton visible sur l’écran, avec rappel des colonnes. Formats **Excel (.xlsx, première feuille)** et **CSV** (délimiteur `;` ou `,` détecté sur l’en-tête). Les lignes invalides, à 0 rep ou datées dans le futur sont refusées avec un message ligne par ligne.
- **Ajouter un PR hors séance** : exercice, variante, reps, kg, RPE, date (Aujourd’hui, Hier, Autre). L’écran annonce avant l’enregistrement si c’est un PR.

### Exercices et fiche exercice

- Liste avec recherche et filtre par muscle, badges du cycle (A, B ou les deux).
- Création et modification : nom, description, muscles.
- **Variantes** (Classique, Pause, …) : chacune a ses propres records.
- **Remarques du coach** : un champ unique, visible pendant la séance.
- **Suppression protégée** : un exercice ou une variante avec au moins une performance ne peut pas être supprimé ; il faut le renommer.

### Réglages

- **Cycle en cours** : corriger le cycle (A/B) et sa date de début.
- **Rappels** (APK uniquement) : interrupteur et heure (8 h 00 par défaut).
  - Rappel de séance à l’heure choisie, d’après la semaine type (séance décalée : à la date décalée ; rien pour un repos, une séance faite ou sautée).
  - Rappel la veille d’une bascule de cycle, avec le bilan du bloc terminé.
  - Permission de notification demandée à l’activation (Android 13+). **Alarmes exactes** utilisées seulement si Android les autorise déjà, sinon rappels non exacts.
  - Reprogrammés à chaque ouverture et changement, sur 28 jours : sans ouvrir l’application pendant plus de 4 semaines, plus de rappels.
- **Hors-ligne** : séries en attente, état de l’envoi, **Synchroniser** et **Renvoyer les éléments archivés**.
- **Affichage** : réduire les animations, taille du texte (Normal, Grand, Très grand).
- **Données** : source utilisée (Supabase ou démo) ; en mode démo, réinitialisation des données.

---

## La méthode fontesque

### Deux cycles A/B

On travaille **les mêmes muscles** dans les deux cycles, mais avec **des mouvements différents** (autres exercices, autres variantes). Chaque séance appartient au cycle A ou au cycle B.

### Alternance par blocs

Les cycles alternent par blocs de **1 à 4 semaines** (2 par défaut, par demi-semaine) : A, B, A, B… Changer de mouvements régulièrement :

- laisse récupérer tendons et articulations, sollicités différemment d’un cycle à l’autre ;
- garde la motivation : on retrouve un cycle avec ses records à battre.

L’application calcule seule le cycle du jour à partir du début du cycle en cours et de sa durée.

### Reporter le prochain cycle

Une semaine manquée (vacances, maladie) ? Programme permet de **reporter d’une semaine** (autant de fois que besoin, annulable) : la bascule vers l’autre cycle est décalée d’autant.

### Séries modulables

Le nombre de séries s’adapte à la forme : **3 séries quand on est frais, 2 quand on est fatigué**. Le programme indique une fourchette (par exemple « 2–3 séries »), la séance permet d’ajouter ou de retirer des séries.

### Choisir sa tentative de PR avant la série

Avant chaque série, on ouvre **Mes records** : le tableau 1 à 30 reps montre, pour chaque nombre de reps, la meilleure charge déjà faite. On choisit sa cible (par exemple « battre 6 × 92,5 kg » ou « remplir la case 8 reps ») puis on exécute.

### Variantes

Une variante (pause, tempo, prise…) a **ses propres records** : un développé couché pause n’est jamais comparé à un développé couché classique.

### Un exercice dans les deux cycles

Un même exercice peut apparaître dans A et dans B. Ses records sont communs, seuls les programmes diffèrent.

### Remarques du coach et compte rendu

Les remarques du coach sont attachées à l’exercice et visibles pendant la séance. À la fin, le compte rendu PDF résume la séance pour le coach.

---

## Règles de PR

Source : `src/domain/records.ts` (`findPreviousBest`, `classify`, `latestPrs`).

### Principe

> Un PR, c’est **plus de charge à reps égales**, ou **plus de reps à charge égale**.

Chaque série est comparée à une **référence** prise dans l’historique du même exercice **et de la même variante**, strictement antérieur à la série.

### Choix de la référence

1. **Série dominée** : si une série antérieure a au moins autant de reps **et** au moins autant de charge (et strictement plus sur l’un des deux), la série est **en dessous**.
2. **Mêmes reps** : sinon, la référence est la charge la plus lourde déjà faite à ce nombre de reps.
3. **Reps inférieures** : sinon, la référence est le record au nombre de reps inférieur le plus proche.
4. Aucune référence : **prise de données**.

### Classements

| Classement | Condition | Exemple (historique → série) |
| --- | --- | --- |
| **PR charge** | mêmes reps, charge supérieure | 5 × 100 → 5 × 102,5 |
| **Égalé** | mêmes reps, même charge | 5 × 100 → 5 × 100 |
| **PR reps** | plus de reps, même charge (rien d’antérieur à ce nombre de reps ne la domine) | 3 × 100 → 4 × 100 |
| **PR hybride** | plus de reps **et** plus de charge | 3 × 100 → 4 × 105 |
| **En dessous** | dominée par une série antérieure | 10 × 100 → 8 × 100 ; 5 × 100 → 5 × 95 |
| **Prise de données** | aucune référence, ou plus de reps mais moins de charge | aucun historique ; 3 × 100 → 4 × 90 |

### Détails

- **Tolérance de 0,01 kg** (`PR_EPSILON`) : un écart inférieur ou égal à 0,01 kg compte comme une charge égale. Cela évite les faux PR et faux « en dessous » dus aux arrondis.
- **Variantes séparées** : la comparaison se fait par identifiant de variante, ou par nom normalisé quand l’identifiant manque. La variante par défaut s’affiche « Classique ».
- **Historique strictement antérieur** : seules les séries enregistrées avant la série comparée comptent (date puis horodatage). Pendant une séance, la comparaison se fait à l’instant de la saisie.
- **PR ajouté pour un jour passé** : il est comparé à tout l’historique **jusqu’à la fin de ce jour**. Ressaisir une série déjà faite ce jour-là ne passe donc jamais pour un PR.
- **e1RM** (courbe) : formule d’Epley, `charge × (1 + reps / 30)`.

### Différences volontaires avec l’ancienne application

- L’ancienne règle pouvait ignorer le record à reps égales et annoncer un PR pour une série dominée (par exemple 8 × 100 après 10 × 100). Désormais, une série dominée est toujours **en dessous**.
- Le choix de la charge maximale ne dépend plus de l’ordre de lecture de l’historique.
- Ces écarts sont documentés dans le test « golden » `tests/golden/records.golden.test.ts`.

---

## Installation et lancement

### Prérequis

- Node.js 20 ou plus récent et npm.
- Un projet Supabase actif (ou le mode démo, sans base).
- Android Studio, uniquement pour l’application Android.

### Installation

```bash
git clone https://github.com/RuddyAudigier/ApplicationMuscu.git
cd ApplicationMuscu
npm ci
```

### Variables d’environnement

Copier `.env.example` en `.env.local` et renseigner :

| Variable | Rôle |
| --- | --- |
| `VITE_SUPABASE_URL` | URL du projet Supabase (`https://<projet>.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Clé publique « anon » du projet |
| `VITE_DATA_BACKEND` | `mock`, `local` ou `test` pour le mode démo ; vide pour Supabase |

Ne jamais committer `.env.local`.

### Lancer

```bash
npm run dev        # Supabase, http://localhost:5173
npm run dev:mock   # mode démo : données locales, aucune base nécessaire
```

### Scripts

| Commande | Rôle |
| --- | --- |
| `npm run dev` | Serveur de développement (Supabase) |
| `npm run dev:mock` | Serveur de développement en mode démo |
| `npm run build` | Vérification des types puis build de production dans `dist/` |
| `npm run preview` | Sert le build de production (port 4173) |
| `npm run lint` | ESLint, zéro avertissement toléré |
| `npm run typecheck` | Vérification TypeScript |
| `npm test` | Tests unitaires (Vitest) |
| `npm run test:coverage` | Tests avec couverture |
| `npm run e2e` | Tests de bout en bout (Playwright) |
| `npm run check` | Lint, types et tests |
| `npm run knip` | Code et dépendances inutilisés |
| `npm run android:sync` | Copie le build web dans le projet Android |
| `npm run android:open` | Ouvre le projet dans Android Studio |

---

## Base de données Supabase

### Migrations

Chaque script est **additif et idempotent** : rejouable sans risque, sans modifier les données existantes. À exécuter dans l’éditeur SQL de Supabase, **dans cet ordre**, avant la première utilisation :

| # | Script | Effet |
| --- | --- | --- |
| 1 | `scripts/sql/2026-11-23_cycles.sql` | `sessions.cycle` (A ou B), table `cycle_state` (cycle en cours, début, durée), `session_exercises.position` (ordre des exercices). |
| 2 | `scripts/sql/2026-11-24_week_plan.sql` | Table `week_plan` : une semaine type par cycle, décalages et sauts. Convertit l’ancien format en planning vide. |
| 3 | `scripts/sql/2026-11-25_journal.sql` | Table `journal` (une ligne, jsonb) : comptes rendus de séance (forme, état, échauffement, séries de chauffe), notes de bloc, catalogue d’échauffements. |
| 4 | `scripts/sql/2026-11-25_cycle_length.sql` | `cycle_state.length_days` (durée générale, 7 à 28 jours) et `extra_days` (report du bloc en cours) ; retire la contrainte `weeks in (2,3)`. Les anciennes lignes à 3 semaines deviennent 14 jours + 7 jours de report. |

`scripts/sql/reset_complet.sql` repart de zéro et **inclut déjà toutes ces migrations**.

Tant qu’une migration n’est pas jouée, l’application garde la donnée correspondante **sur l’appareil** (clés `mymuscle_cycles_v1`, `mymuscle_week_plan_v1`, `mymuscle_journal_v1`) : rien n’est synchronisé entre appareils.

Si la RLS est activée sur `cycle_state`, ajouter des politiques de lecture, d’insertion et de mise à jour, sinon l’application recevra une erreur `42501`.

### Attention

**Ne pas exécuter** `scripts/sql/fix_triceps_*.sql` ni `scripts/sql/repair_triceps_*.sql`. Ce sont d’anciennes corrections ponctuelles qui **modifient l’historique** des performances.

---

## Hors-ligne

- Une série validée sans réseau est placée dans une **file d’attente** sur l’appareil, puis envoyée automatiquement au retour du réseau.
- La file est séparée entre Supabase et le mode démo : réinitialiser la démo n’efface jamais les séries réelles en attente.
- **Erreurs passagères** (réseau, 401, 403, 429, 5xx) : les séries restent dans la file et Réglages affiche « Envoi bloqué » avec l’erreur. Rien n’est perdu.
- **Refus définitif** du serveur, ou envoi au résultat incertain (502/504, envoi interrompu) : la série est **archivée** pour éviter les doublons.
- Dans Réglages : **Synchroniser** relance l’envoi, **Renvoyer les éléments archivés** remet les archives dans la file.
- Les autres modifications (séances, exercices, cycles, remarques) demandent du réseau : hors-ligne, elles sont refusées avec un message explicite.
- Le **journal** (compte rendu, état, chauffe) est aussi mis en file : en cas d’échec, un message l’indique, les données restent sur l’appareil et un nouvel essai a lieu à la modification suivante.

---

## Android (Capacitor)

Identifiant `com.mymuscle.app`, nom « MyMuscle », contenu web servi depuis `dist/`.

### Reconstruire l’APK

```bash
npm run build          # build web avec les variables de .env.local
npx cap sync android   # copie dist/ et les plugins dans android/ (= npm run android:sync)
npm run android:open   # ouvre Android Studio
```

Dans Android Studio : lancer sur un appareil, ou **Build > Generate Signed Bundle / APK** pour une version installable. À refaire après chaque changement de code ou de plugin.

### Rappels et permissions

- Les rappels utilisent `@capacitor/local-notifications`.
- Permissions déclarées : `USE_EXACT_ALARM` et `SCHEDULE_EXACT_ALARM` (alarmes exactes) ; la permission de notification est demandée à l’activation (Android 13+).
- Sur certains téléphones, l’**optimisation de la batterie** peut retarder ou bloquer les rappels : la désactiver pour MyMuscle (Paramètres > Applications > MyMuscle > Batterie > Sans restriction).

---

## Architecture et qualité

React 19, TypeScript, Vite, TanStack Query, React Router, Zod, Supabase, Capacitor.

| Couche | Dossier | Rôle |
| --- | --- | --- |
| Domaine | `src/domain` | Règles pures : PR, cycles, séances, e1RM, CSV, rapport. Aucune dépendance à React ni aux données. |
| Données | `src/data` | Ports, backends Supabase et démo, file hors-ligne, hooks de requêtes. |
| UI | `src/ui` | Composants génériques et jetons de design (`tokens.css`). |
| Plateforme | `src/platform` | Partage, PDF, presse-papiers, bouton retour Android, service worker. |
| Fonctionnalités | `src/features` | Écrans, qui assemblent domaine, données et UI. |
| Application | `src/app` | Routeur, layout, providers, gestion des erreurs. |

Des règles ESLint imposent le sens des dépendances : le domaine n’importe rien des autres couches, l’UI ne dépend pas des données, une fonctionnalité n’importe pas une autre fonctionnalité.

Tests :

- unitaires (Vitest + Testing Library) dans `tests/` ;
- tests « golden » qui comparent les règles de PR à l’ancienne application (`tests/golden`) ;
- de bout en bout avec Playwright et contrôle d’accessibilité axe (`tests/e2e`) ;
- seuils de couverture : 75 % global, 90 % des lignes et branches pour `src/domain`.

---

## Sécurité — actions à faire

- [ ] **Changer la clé anon Supabase** : l’ancienne clé figure dans l’historique public du dépôt.
- [ ] **Activer la RLS** avec des politiques explicites sur toutes les tables, y compris `cycle_state`.
- [ ] Vérifier que les clés étrangères `performances.exercise_id` et `performances.variant_id` ne sont **pas** en `ON DELETE CASCADE`. L’application refuse déjà de supprimer un exercice ou une variante avec historique, mais la base doit aussi protéger les performances.
- [ ] Vérifier que `performances.performance_date` est de type `date`.
- [ ] Exporter le schéma (DDL) actuel comme référence.
- [ ] Lancer `npm audit` et corriger les vulnérabilités.

---

## Fonctionnalités de l’ancienne version non reprises

- Conseils et notes rapides.
- Statistiques globales des records, copie Excel, pied de page de statistiques, graphiques de volume et de charge maximale.
- Partage d’image.
- Page de partage publique.
- Ancien bandeau d’accueil.

L’ancienne application reste consultable dans `legacy/`.

---

## Dépannage

**Tout reste sur « Chargement… » puis « Impossible de charger… »**
L’application ne joint pas Supabase. Ouvrir la console du navigateur (F12) :

- `net::ERR_NAME_NOT_RESOLVED` : l’adresse `VITE_SUPABASE_URL` n’existe pas. Le projet a été supprimé, ou l’URL est fausse. Copier l’URL depuis **Supabase > Project Settings > API**.
- Erreur 540 ou projet « paused » : réactiver le projet dans le tableau de bord Supabase (les projets gratuits sont mis en pause après une période d’inactivité).
- Erreur 401 : clé `VITE_SUPABASE_ANON_KEY` invalide.

Après avoir modifié `.env.local`, **redémarrer** `npm run dev`.

**« Configuration Supabase manquante »**
`VITE_SUPABASE_URL` ou `VITE_SUPABASE_ANON_KEY` est vide. Renseigner `.env.local`, ou lancer `npm run dev:mock`.

**Port 5173 déjà utilisé**
Un autre `npm run dev` tourne encore. L’arrêter avant d’en lancer un nouveau.
