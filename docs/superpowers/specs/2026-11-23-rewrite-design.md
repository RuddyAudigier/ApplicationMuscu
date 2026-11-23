# Réécriture ApplicationMuscu — Design

Date : 2026-11-23 · Branche : `rewrite`

## Intention

Refaire toute l'application (logique métier + front-end) pour obtenir un code maintenable,
testé et typé, avec une interface mobile-first cohérente. La réécriture est faite par des
agents en sous-tâches parallèles, encadrée par des contrôles qualité automatiques.

## Point de départ (mesuré)

- React 19 + Vite 5 + Supabase + Capacitor 8 (Android), JavaScript, ~16,8k lignes dans `src/`.
- `src/App.jsx` : 1781 lignes. Il mélange l'état global, la navigation par `useState('home')`,
  la détection de PR, la génération d'image de partage et le partage Capacitor. Il duplique
  une grande partie de `src/utils/*`.
- Lint : 2 erreurs, 9 warnings. Tests : 120 OK, uniquement sur `utils` et `mockService` ;
  composants, pages et `supabaseService` sont exclus de la couverture.
- Build OK mais un seul bundle trop gros (warning de taille de chunk).
- `npm ci` échoue sans `--legacy-peer-deps` : `@testing-library/react@14` exige React 18.
- Dépendances mortes : `firebase`, `@tauri-apps/cli`.
- Pas d'authentification : la base est accessible avec la clé anon (voir Sécurité).

La référence fonctionnelle complète est `docs/rewrite/feature-inventory.md`.

## Objectifs

1. Parité fonctionnelle complète avec l'app actuelle (checklist de l'inventaire).
2. Logique métier en TypeScript pur, sans React, testée unitairement (couverture ≥ 90 %).
3. Couche de données unique et typée, avec deux implémentations (Supabase, mock) derrière
   la même interface.
4. Front-end refait : design system (tokens, composants de base), mobile-first, thème
   sombre/clair, accessible (WCAG AA), navigation par URL.
5. Qualité contrôlée en CI : lint, typecheck, tests, couverture, build, budget de bundle.

## Non-objectifs

- Pas de changement du schéma Supabase et pas de migration de données.
- Pas de nouvelle fonctionnalité métier tant que la parité n'est pas atteinte.
- Pas de passage à React Native ni d'app iOS.

## Anti-objectifs (échec même si « ça marche »)

- Perte ou corruption de données existantes (performances, PR, baselines).
- Calculs différents de l'app actuelle (e1rm, PR, progression) sans décision explicite.
- Régression sur Android (partage d'image, retour arrière, hors-ligne).

## Approches envisagées

| Approche | Avantages | Inconvénients |
|---|---|---|
| **A. Réécriture parallèle dans `src/` sur la branche `rewrite`**, avec l'ancien code comme référence via git | Architecture propre dès le départ, découpage par agents simple, pas de cohabitation JS/TS | Rien de livrable avant la parité ; nécessite une checklist stricte |
| B. Strangler : migrer écran par écran dans l'app existante | Livrable à tout moment | `App.jsx` monolithique bloque tout découpage ; cohabitation longue et coûteuse |
| C. Refactor incrémental du JS existant | Risque minimal | Ne répond pas à la demande « refaire » ; dette structurelle conservée |

**Choix : A** (décision de Claude, mode auto). La branche `rewrite` isole le travail. `main`
reste déployable. La fusion n'a lieu qu'une fois la checklist de parité cochée et validée.

## Décisions techniques (calls de Claude)

- **Langage** : TypeScript `strict`, `noUncheckedIndexedAccess`.
- **Stack conservée** : React 19, Vite (mise à jour 6.x), Supabase JS v2, Capacitor 8.
- **Routing** : `react-router` v7 (mode bibliothèque), routes par écran. Le lien de partage
  devient une vraie route (`/share/:id`).
- **État serveur** : TanStack Query (cache, invalidation, états loading/erreur).
  État local UI : `useState`/`useReducer` ; séance en cours persistée en `localStorage`
  via un hook dédié.
- **Validation** : Zod aux frontières (lignes Supabase vers modèles du domaine).
- **Styles** : CSS Modules + tokens CSS (`:root` + thème sombre). Pas de framework CSS.
- **Tests** : Vitest + Testing Library v16 (compatible React 19) + MSW non requis (mock
  backend in-memory). Playwright pour 5 parcours e2e en mode mock.
- **Qualité** : ESLint flat + `typescript-eslint` strict + `jsx-a11y` + `react-hooks`,
  Prettier, `tsc --noEmit`, `knip` (code mort), budget de bundle, GitHub Actions.
- **Suppression** : `firebase`, `@tauri-apps/cli`, scripts Tauri, `ARCHITECTURE.md` obsolète.

## Décisions de comportement (écarts volontaires à la parité)

Prises par Claude en mode auto. Chacune corrige un bug de `docs/rewrite/feature-inventory.md`
§6. L'utilisateur peut en annuler une avant la tâche concernée.

| # | Décision | Bug(s) |
|---|---|---|
| D1 | **Suppression du nettoyage « obsolète »** : aucune écriture ne supprime d'historique. Le masquage des entrées dominées reste un calcul d'affichage. | 10 |
| D2 | **Une seule règle de PR** : le direct en séance utilise `findPreviousBest` (règle du partage). Sans référence, on affiche « Prise de données », pas « Record battu ». | 11 |
| D3 | **Dates locales** (fuseau de l'appareil) partout ; plus de `toISOString().slice(0,10)`. | 7 |
| D4 | **Lecture paginée des performances** par pages de 1000 jusqu'à épuisement. | 32 |
| D5 | **Renommer une séance** met aussi à jour `performances.session_name` (ancien nom vers nouveau). | 29 |
| D6 | **Séance en cours persistée** (`localStorage`), bonus et retraits compris ; « Redémarrer » remet à zéro ; « Abandonner » demande confirmation. | 2, 3, 5, 6 |
| D7 | **Messages honnêtes** : les séries à 0 rep ne sont pas annoncées comme enregistrées ; le nombre réellement écrit est affiché. | 4 |
| D8 | **File hors-ligne** : n'y vont que les erreurs réseau ; rejouée au démarrage et à l'événement `online`. | 21 |
| D9 | **Partage** : les séries supplémentaires et les exercices bonus de la séance apparaissent dans le payload. L'algorithme reste `PR-v10`. | 31 |
| D10 | **`alert`/`confirm` remplacés** par toasts et dialogues accessibles ; mêmes textes. | — |
| D11 | Variantes : ids relus après création/mise à jour ; renommer vers un nom existant est refusé avec message. | 19, 20 |
| D12 | `getSessions` : une seule requête avec jointure ; un exercice supprimé est ignoré, pas toute la liste. | 17, 18 |

Restent hors périmètre (schéma inchangé) : ordre des exercices d'une séance (bug 23, pas
de colonne d'ordre), transactions (bug 24). À traiter plus tard par une migration SQL.

## Architecture cible

```
src/
  app/            # bootstrap : providers, router, layout, error boundary
  domain/         # TS pur, zéro import React/Supabase
    model.ts      #   types : Exercise, Variant, MuscleGroup, Session, Performance...
    e1rm.ts, records.ts, progression.ts, dates.ts, names.ts, share-text.ts, baseline.ts
  data/
    ports.ts      # interfaces des repositories
    supabase/     # implémentation Supabase + mappers Zod
    mock/         # implémentation in-memory + seed
    index.ts      # sélection via VITE_DATA_BACKEND
    queries/      # hooks TanStack Query par entité
  features/       # un dossier par fonctionnalité : composants, hooks, routes
    exercises/ sessions/ workout/ performances/ progress/ share/ home/ settings/
  ui/             # design system : tokens.css, Button, Card, Sheet/Modal, Field,
                  # NumberStepper, Tabs, BottomNav, EmptyState, Skeleton, Toast
  platform/       # Capacitor : partage, filesystem, détection natif ; fallbacks web
tests/e2e/        # Playwright
```

Règles de dépendances (vérifiées par ESLint `no-restricted-imports`) :
`domain` n'importe rien. `data` importe `domain`. `ui` n'importe ni `data` ni `features`.
`features` importe `domain`, `data`, `ui`, `platform`. `app` assemble.

## Qualité : plan de contrôle

| Contrôle | Outil | Seuil bloquant en CI |
|---|---|---|
| Lint | ESLint | 0 erreur, 0 warning |
| Types | `tsc --noEmit` | 0 erreur |
| Tests unitaires | Vitest | 100 % verts ; couverture `domain/` ≥ 90 %, global ≥ 75 % |
| Parité calculs | tests « golden » | mêmes résultats que l'ancien code sur jeux de données réels |
| e2e | Playwright (mode mock) | 5 parcours verts |
| Code mort | knip | 0 export/dépendance inutilisée |
| Bundle | build Vite | chunk initial ≤ 250 kB gzip |
| Accessibilité | jsx-a11y + axe dans e2e | 0 violation sérieuse |
| Revue | agents reviewer | chaque lot revu avant fusion dans `rewrite` |

## Sécurité

L'app n'a pas d'authentification et la clé anon a été exposée dans l'historique public.
La réécriture n'ajoute pas l'auth (non-objectif), mais le plan inclut une tâche de
vérification des politiques RLS côté Supabase et une recommandation de rotation de clé.
À traiter par l'utilisateur dans le dashboard Supabase.

## Laissé au builder

Structure interne des composants, nommage, choix des icônes (SVG inline), détails visuels
dans le cadre des tokens.
