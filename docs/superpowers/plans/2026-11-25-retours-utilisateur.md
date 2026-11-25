# Retours utilisateur Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Durée des cycles réglable + report, cible qui suit les reps, interface (glisser, en-têtes, coach, boutons), import Excel.

**Architecture:** Tâches indépendantes ; la 1 touche le domaine des cycles et ses usages, les autres sont des écrans.

**Tech Stack:** React 19, TanStack Query, Supabase, `read-excel-file`.

**Spec:** `docs/superpowers/specs/2026-11-25-retours-utilisateur-design.md`

## Global Constraints

- Pas de nouveaux tests ; vérif : `npx tsc --noEmit -p .`, `npx eslint src`, `npx vitest run` (adapter au minimum les tests existants cassés).
- Couches ESLint existantes ; textes en français ; design noir & citron (`src/ui`).
- Jours par durée : 1 → 7, 1,5 → 11, 2 → 14, 2,5 → 18, 3 → 21, 3,5 → 25, 4 → 28.
- Libellés : « Durée des cycles », « Reporter le prochain cycle d'une semaine », « Annuler un report », « Variante », « Mon état », « Remarques du coach », « Importer un fichier ».
- Ne pas toucher ni commiter `android/app/src/main/AndroidManifest.xml`, `.idea/`, `android/.kotlin/` ; jamais lire `.env*`.

## Review Focus

- Ancien `cycle_state` (weeks 2|3, sans colonnes) et repli localStorage : relus sans erreur, même cycle du jour qu'avant.
- Durée changée en cours de bloc : le cycle du jour ne saute pas en arrière (bloc en cours ne finit pas avant aujourd'hui).
- Glisser ne se déclenche pas en faisant défiler verticalement ni dans un champ / une feuille.
- Reps effacées : cible vide, pas de plantage.
- Fichier xlsx vide, illisible ou sans en-têtes connus : message clair, rien importé.

---

### Task 1: Durée des cycles et report
**Files:** `src/domain/model.ts`, `src/domain/cycles.ts` (+ helpers `daysForWeeks(w)`, `postponeCycle`, `cancelPostpone`, `setCycleLength`), data cycles (supabase repo, mappers, cycleFallback, mock), `scripts/sql/2026-11-25_cycle_length.sql` + `reset_complet.sql`, tous les usages de `weeks` (grep : home, program, settings, reminders, blockReview, planning), README.
- [ ] Modèle et conversions des anciennes données ; `cycleStatus` renvoie `weeks = ⌈bloc/7⌉`, `daysLeft`, `week`.
- [ ] Programme : sélecteur « Durée des cycles » (1 → 4 par 0,5) + boutons report / annulation, texte « Prochain cycle X le jeudi 12 déc. » (+ « reporté de N semaine(s) »). Réglages : correction manuelle adaptée.
- [ ] Vérif ; commit `feat(cycles): durée réglable de 1 à 4 semaines et report du prochain cycle`.

### Task 2: Séance — cible liée aux reps, variante / état distingués
**Files:** `src/domain/workout.ts` (action `setField` reps → recalcul de la cible via le tableau des records de la variante), `src/features/workout/*`.
- [ ] Cible = record à ce nombre de reps (même variante) ou vide ; choix depuis « Mes records » inchangé.
- [ ] Rangées « Variante » et « Mon état » visuellement séparées (spec §2).
- [ ] Vérif ; commit `feat(séance): cible liée aux reps, variante et état distingués`.

### Task 3: Interface
**Files:** `src/ui` (en-tête commun, hook de glissement), `src/app/Layout.tsx`, écrans home/program/records/exercises/settings/review, édition d'exercice (remarques du coach), `src/features/home/ScheduledSessions.tsx` (+ css).
- [ ] Glisser entre onglets (spec §3), en-têtes alignés, champ coach simple, boutons Décaler/Sauter dans l'encadré citron.
- [ ] Vérif ; commit `feat(ui): glisser entre onglets, en-têtes alignés, finitions accueil et coach`.

### Task 4: Import Excel
**Files:** `package.json` (`read-excel-file`), `src/platform` (lecture xlsx → lignes) ou `src/features/records`, `src/domain/csv.ts` (entrée lignes), `CsvImportSheet` → import fichier, `RecordsScreen`.
- [ ] Bouton visible « Importer un fichier » (.xlsx, .csv), colonnes rappelées, même validation.
- [ ] Vérif ; commit `feat(records): import de fichier Excel ou CSV`.
