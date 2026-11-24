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
| Records | `/records/:exerciseId?` |
| Ajouter un PR hors séance | `/records/add` |
| Exercices et fiche exercice | `/exercises`, `/exercises/:id` |
| Réglages | `/settings` |

### Accueil

- Cycle en cours (A ou B), semaine en cours et nombre de jours avant la bascule.
- Frise des blocs passés, en cours et à venir.
- « Séance du jour » avec son code (A1, A2, B1…) et le nombre de séries prévues, bouton **Démarrer**.
- Avec une semaine réglée dans Programme :
  - **séance manquée** (jour passé, séance non faite) : **La faire maintenant**, **Décaler…** (vers un jour d’ici dimanche) ou **Sauter cette semaine** (la séance reste au programme) ;
  - **prochaine séance** : celle du jour, sinon la suivante de la semaine, qu’on peut démarrer **en avance** ;
  - une séance compte comme faite dès qu’une série porte son nom cette semaine, même faite en avance ;
  - un décalage ou un saut ne vaut que pour la semaine en cours, et peut être annulé.
- Sans semaine réglée : la première séance du cycle pas encore faite depuis lundi.
- « Derniers PR » : les records les plus récents, avec leur type (charge, reps, hybride).

### Programme

- Onglets **A** / **B** : les séances de chaque cycle et leurs exercices.
- Durée du cycle en cours : **2 semaines** ou **3 semaines** (après une semaine manquée).
- Démarrage d’une séance depuis la liste.
- **Ma semaine** : une semaine type par cycle, réglée sous l’onglet A ou B. Pour chaque jour (lundi → dimanche), repos ou une séance du cycle, par exemple lundi : Haut du corps, jeudi : Bas du corps, samedi : Full body. Un cycle compte autant de séances que voulu. Pendant les semaines A, l’accueil suit la semaine A, puis la semaine B après la bascule.

### Séance en cours

- Saisie des séries (reps, charge, RPE) exercice par exercice.
- **Mes records** : le tableau des records 1 à 30 reps de l’exercice et de la variante, pour **choisir sa tentative avant la série**. Toucher une ligne fixe la cible.
- **Séries modulables** : on ajoute ou retire des séries selon la forme du jour.
- Détection en direct : chaque série validée est classée (PR charge, PR reps, hybride, égalé, en dessous, prise de données).
- Corriger ou supprimer une série validée, retirer un exercice, abandonner la séance.
- Choix de la date de la séance (utile pour saisir une séance passée).
- La séance en cours est conservée sur l’appareil : fermer l’application ne la perd pas.

### Compte rendu (PDF pour le coach)

Résumé de la séance (exercices, séries, PR obtenus), exportable en PDF et partageable.

### Records

- Tableau des records de 1 à 30 répétitions par exercice et par variante (poids, RPE, date). Les cases vides sont « à conquérir ».
- **Courbe** de progression de l’e1RM (formule d’Epley).
- **Import CSV** de performances (délimiteur `;` ou `,` détecté sur l’en-tête). Les lignes invalides, à 0 rep ou datées dans le futur sont refusées avec un message.
- **Ajouter un PR hors séance** : exercice, variante, reps, kg, RPE, date (Aujourd’hui, Hier, Autre). L’écran annonce avant l’enregistrement si c’est un PR.

### Exercices et fiche exercice

- Liste avec recherche et filtre par muscle, badges du cycle (A, B ou les deux).
- Création et modification d’un exercice : nom, description, muscles.
- **Variantes** (Classique, Pause, …) : chacune a ses propres records.
- **Remarques du coach** sur l’exercice.
- **Suppression protégée** : un exercice ou une variante qui a au moins une performance enregistrée ne peut pas être supprimé. Il faut le renommer.

### Réglages

- **Cycle en cours** : corriger manuellement le cycle (A/B) et sa date de début si l’application s’est trompée.
- **Hors-ligne** : nombre de séries en attente, état de l’envoi, boutons **Synchroniser** et **Renvoyer les éléments archivés**.
- **Affichage** : réduire les animations, taille du texte (Normal, Grand, Très grand).
- **Rappels** (APK uniquement) : rappel de séance à l’heure choisie et veille de bascule de cycle, d’après ta semaine type.
- **Données** : source utilisée (Supabase ou démo) ; en mode démo, réinitialisation des données de démonstration.

---

## La méthode fontesque

### Deux cycles A/B

On travaille **les mêmes muscles** dans les deux cycles, mais avec **des mouvements différents** (autres exercices, autres variantes). Chaque séance appartient au cycle A ou au cycle B.

### Alternance toutes les 2 semaines

Les cycles alternent par blocs de **2 semaines** : A, B, A, B… Changer de mouvements régulièrement :

- laisse récupérer tendons et articulations, sollicités différemment d’un cycle à l’autre ;
- garde la motivation : on retrouve un cycle avec ses records à battre.

L’application calcule seule le cycle du jour à partir du début du cycle en cours et de sa durée.

### Prolonger à 3 semaines

Une semaine manquée (vacances, maladie) ? Le bloc en cours passe à **3 semaines** dans Programme, et la bascule vers l’autre cycle est décalée d’autant.

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

### Migration des cycles

Exécuter `scripts/sql/2026-11-23_cycles.sql` dans l’éditeur SQL de Supabase. Ce script est **additif et idempotent** : il peut être rejoué sans risque et ne modifie aucune donnée existante. Il ajoute :

- `sessions.cycle` : cycle (A ou B) de la séance ;
- la table `cycle_state` : cycle en cours, date de début, durée (2 ou 3 semaines) ;
- `session_exercises.position` : ordre des exercices dans la séance.

Tant que ce script n’est pas joué, l’application enregistre le cycle **dans le stockage local de l’appareil** (clé `mymuscle_cycles_v1`) : rien n’est synchronisé entre appareils.

Si la RLS est activée sur `cycle_state`, ajouter des politiques de lecture, d’insertion et de mise à jour, sinon l’application recevra une erreur `42501`.

### Migration du planning

Exécuter `scripts/sql/2026-11-24_week_plan.sql` (additif, idempotent) : table `week_plan` (une semaine type par cycle, décalages). Le rejouer convertit l’ancien format (semaine commune aux deux cycles) en planning vide. Sans elle, le planning est gardé sur l’appareil (clé `mymuscle_week_plan_v1`). Le script `reset_complet.sql` l’inclut déjà.

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

---

## Android (Capacitor)

Identifiant `com.mymuscle.app`, nom « MyMuscle », contenu web servi depuis `dist/`.

```bash
npm run build          # build web avec les variables de .env.local
npm run android:sync   # copie dist/ dans android/
npm run android:open   # ouvre Android Studio
```

Dans Android Studio : lancer sur un appareil, ou **Build > Generate Signed Bundle / APK** pour une version installable.

Les rappels utilisent `@capacitor/local-notifications` : `npx cap sync android` a été exécuté pour l’ajouter, l’APK doit donc être reconstruit.

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
